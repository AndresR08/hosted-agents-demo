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
  };
}
