import { config, hostedAgentUrl } from "./config.js";

/**
 * One call to a Hosted Agent's Responses API — the exact path documented in
 * ARCHITECTURE.md §4.1 step 1: client → APIM (subscription key) → Foundry
 * hosted agent → APIM (managed identity) → model. Extracted so `/ask` (which
 * augments the prompt with demo knowledge first) and
 * `POST /agents/:name/invoke` (which sends the caller's prompt as-is) share
 * one auth header, one timeout, one correlation-header extraction and one
 * success/failure split, instead of each hand-rolling the same fetch.
 */

export interface HostedAgentInvocationSuccess {
  ok: true;
  id?: string;
  /** Foundry's own value (observed live: "completed") — passed through, never translated. */
  status?: string;
  outputText: string;
  model?: string;
  usage?: Record<string, unknown>;
  /** e.g. ":3" — from the response's own `agent_reference`, when present. */
  agentVersion?: string;
  sessionId?: string;
  /** Foundry's own timestamps, in seconds. */
  createdAt?: number;
  completedAt?: number;
  latencyMs: number;
  httpStatus: number;
  traceId?: string;
  apimRequestId?: string;
  region?: string;
  servedByCluster?: string;
  platformServer?: string;
  /** Hop 1 as measured by API Management's own policy — see readPolicyTiming. */
  policyTiming?: PolicyTiming;
}

/**
 * Hop 1's timing, measured inside the gateway by our responses-API policy
 * (labs/.../policies/hosted-agents-responses-policy.xml) and returned as
 * response headers. Same two quantities the gateway log carries, available
 * with the response instead of after Log Analytics ingestion.
 */
export interface PolicyTiming {
  backendMs: number;
  gatewayMs: number;
  /**
   * Hop 2 — the agent's own model call(s) — as measured by our inference-API
   * policy and handed to hop 1 through APIM's cache under the W3C trace id
   * both hops share. Absent when hop 2 did not carry hop 1's trace
   * (strands-agent) or the cache had no entry: then hop 2 is Log Analytics'
   * to report, later, and nothing is filled in meanwhile.
   */
  hop2?: {
    traceId: string;
    /**
     * One entry per model call the agent made during this invocation.
     * `backendMs` of a `streamed` call is time to first byte — the policy runs
     * when headers arrive — and must never be shown as the call's duration.
     */
    calls: { gatewayMs: number; backendMs: number; status: number; streamed: boolean }[];
  };
}

/**
 * Absent (undefined), never zero, when the headers are missing — a gateway
 * still running the upstream policy, or a response that failed before the
 * outbound section ran. The console then falls back to Log Analytics.
 */
function readPolicyTiming(headers: Headers): PolicyTiming | undefined {
  const backend = headers.get("x-hosted-agents-backend-ms");
  const gateway = headers.get("x-hosted-agents-gateway-ms");
  if (backend === null || gateway === null) return undefined;
  const backendMs = Number(backend);
  const gatewayMs = Number(gateway);
  if (!Number.isFinite(backendMs) || !Number.isFinite(gatewayMs)) return undefined;
  return { backendMs, gatewayMs, hop2: readHop2(headers) };
}

/**
 * `x-hosted-agents-hop2` is `gateway:backend:status:streamed;` per model call.
 * Any malformed entry voids the whole value. An entry without the streamed
 * flag (written by an earlier policy revision) is treated as streamed — the
 * reading that never overstates what `backend` means.
 */
function readHop2(headers: Headers): PolicyTiming["hop2"] {
  const raw = headers.get("x-hosted-agents-hop2");
  const traceId = headers.get("x-hosted-agents-trace-id");
  if (!raw || !traceId) return undefined;
  const calls = raw
    .split(";")
    .filter((entry) => entry.trim() !== "")
    .map((entry) => {
      const [gatewayMs, backendMs, status, streamed] = entry.split(":").map(Number);
      return { gatewayMs, backendMs, status, streamed: streamed !== 0 };
    });
  const wellFormed = calls.every(
    (c) => Number.isFinite(c.gatewayMs) && Number.isFinite(c.backendMs) && Number.isInteger(c.status),
  );
  return calls.length > 0 && wellFormed ? { traceId, calls } : undefined;
}

export interface HostedAgentInvocationFailure {
  ok: false;
  httpStatus: number;
  detail: string;
  timedOut: boolean;
  latencyMs: number;
}

export type HostedAgentInvocationResult = HostedAgentInvocationSuccess | HostedAgentInvocationFailure;

/**
 * Bounded by `config.agentInvokeTimeoutMs` — no prior caller of this endpoint
 * had a timeout at all, so a stuck upstream call would hang the request
 * indefinitely. Failure (non-2xx, network error, or timeout) is returned,
 * never thrown: both callers need the real upstream `httpStatus` to answer
 * with, which a thrown exception reaching the broker's generic 502 handler
 * would discard.
 */
export async function invokeHostedAgent(
  agentName: string,
  input: string,
): Promise<HostedAgentInvocationResult> {
  const url = hostedAgentUrl(agentName);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.agentInvokeTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": config.apimSubscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, stream: false }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      httpStatus: 504,
      detail: timedOut
        ? `Agent invocation timed out after ${config.agentInvokeTimeoutMs}ms`
        : err instanceof Error
          ? err.message
          : "Network error calling agent",
      timedOut,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - started;
  const httpStatus = response.status;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, httpStatus, detail: text, timedOut: false, latencyMs };
  }

  const body = (await response.json()) as {
    id?: string;
    status?: string;
    output?: { content?: { type: string; text?: string }[] }[];
    agent_reference?: { name?: string; version?: string };
    agent_session_id?: string;
    created_at?: number;
    completed_at?: number;
    model?: string;
    usage?: Record<string, unknown>;
  };

  const outputText =
    body.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ??
    body.output?.[0]?.content?.[0]?.text ??
    "";

  /**
   * Response headers carry the correlation keys this deployment exposes.
   * `X-Request-ID` is the W3C trace id and matches `OperationId` in
   * Application Insights exactly (verified — see routes/observability.ts).
   * APIM returns it comma-doubled, so take the first.
   */
  return {
    ok: true,
    id: body.id,
    status: body.status,
    outputText,
    model: body.model,
    usage: body.usage,
    agentVersion: body.agent_reference?.version ? `:${body.agent_reference.version}` : undefined,
    sessionId: body.agent_session_id ?? response.headers.get("x-agent-session-id") ?? undefined,
    createdAt: body.created_at,
    completedAt: body.completed_at,
    latencyMs,
    httpStatus,
    traceId: response.headers.get("x-request-id")?.split(",")[0]?.trim(),
    apimRequestId: response.headers.get("apim-request-id") ?? undefined,
    region: response.headers.get("x-ms-region") ?? undefined,
    servedByCluster: response.headers.get("azureml-served-by-cluster") ?? undefined,
    platformServer: response.headers.get("x-platform-server") ?? undefined,
    policyTiming: readPolicyTiming(response.headers),
  };
}
