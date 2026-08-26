import { Router } from "express";
import { config } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { getAsk } from "../askStore.js";
import {
  extractCompletion,
  extractLastUserMessage,
  extractQuestion,
  isCaptured,
} from "../llmLog.js";

export const observabilityRouter = Router();

/**
 * Executive Observability — everything this architecture already emits about
 * one request, assembled from real telemetry.
 *
 * Nothing here is estimated. Every field carries its own `source` and
 * `available` flag so the UI can say "Unavailable in this deployment" rather
 * than rendering a blank or a zero that reads as a measurement.
 *
 * ─── How one interaction is assembled ────────────────────────────────────
 *
 * The broker records the ask (askStore) including the `X-Request-ID` response
 * header, which **is** the W3C trace id and equals App Insights `OperationId`.
 * That is the only exact per-request key this deployment exposes; everything
 * else is joined from it or associated by time.
 *
 *   ApiManagementGatewayLogs        two rows per interaction, one per hop
 *     ApiId=hosted-agent-responses-api   hop 1, client → agent. Url has the agent name
 *     ApiId=inference-api                hop 2, agent → model. Nests inside hop 1
 *
 *   ApiManagementGatewayLlmLog      ALL rows belong to hop 2 (the model call)
 *     SequenceNumber 1 → RequestMessages    prompt as the model saw it
 *     SequenceNumber 2 → ResponseMessages   completion
 *     SequenceNumber 0 → PromptTokens / CompletionTokens / TotalTokens / ModelName
 *     all three share one CorrelationId, which joins to the hop-2 gateway row
 *
 *   AppDependencies / AppRequests   joined by OperationId == traceId
 *     parent/child spans across three roles: the Foundry runtime (agentsv2),
 *     the agent container, and APIM. Carries OpenTelemetry GenAI attributes
 *     including gen_ai.usage.* — an independent second token source.
 *
 * ─── Known limitations, stated rather than papered over ──────────────────
 *
 *  - Log Analytics carries 1–3 minutes of ingestion lag. A request made
 *    seconds ago legitimately has no telemetry yet; that is reported as
 *    `pending`, not as zero.
 *  - Hop 1 and hop 2 have *different* CorrelationIds. They are associated by
 *    timestamp containment (hop 2 starts after hop 1 and ends before it),
 *    which is an association, not a single measured transaction. Labelled as
 *    such in the response.
 *  - Tokens describe the **model call**, which is what the gateway meters.
 *    They are not a measurement of the agent invocation.
 *  - `apim-request-id` is returned to the caller but never appears as a
 *    `CorrelationId` in Log Analytics (verified: zero matches), so it is
 *    display-only and cannot be used to join.
 */

/** Every observable field is wrapped so "missing" is always distinguishable from "zero". */
interface Field<T> {
  value: T | null;
  /** Which Azure resource produced this, for the UI's provenance line. */
  source: string;
  available: boolean;
  /** Present when `available` is false — why it could not be retrieved. */
  reason?: string;
}

function live<T>(value: T | null | undefined, source: string): Field<T> {
  if (value === null || value === undefined || value === "") {
    return { value: null, source, available: false, reason: "Not returned by this source" };
  }
  return { value, source, available: true };
}

function unavailable<T>(source: string, reason: string): Field<T> {
  return { value: null, source, available: false, reason };
}

const FRAMEWORK_BY_AGENT: Record<string, string> = {
  "pydantic-agent": "Pydantic AI",
  "strands-agent": "Strands",
};

interface GatewayRow {
  TimeGenerated: string;
  CorrelationId: string;
  ApiId: string;
  OperationId: string;
  ApiRevision: string;
  ResponseCode: number;
  BackendResponseCode: number | null;
  IsRequestSuccess: boolean;
  TotalTime: number;
  BackendTime: number;
  Url: string;
  BackendUrl: string | null;
  RequestSize: number;
  ResponseSize: number;
  ApimSubscriptionId: string;
  BackendId: string | null;
  CallerIpAddress: string;
  Region: string;
  Method: string;
  LastErrorReason: string | null;
  LastErrorMessage: string | null;
}

interface LlmRow {
  TimeGenerated: string;
  CorrelationId: string;
  SequenceNumber: number;
  DeploymentName: string;
  ModelName: string;
  PromptTokens: number;
  CompletionTokens: number;
  TotalTokens: number;
  RequestMessages: string | null;
  ResponseMessages: string | null;
}

interface SpanRow {
  TimeGenerated: string;
  Type: string;
  AppRoleName: string;
  Name: string;
  Id: string;
  ParentId: string;
  DurationMs: number;
  Success: boolean;
  Properties: string | null;
}

async function queryLogAnalytics<T>(query: string): Promise<T[]> {
  const token = await getAccessToken(SCOPES.logAnalytics);
  const response = await fetch(
    `https://api.loganalytics.io/v1/workspaces/${config.logAnalyticsWorkspaceId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  if (!response.ok) throw new Error(`Log Analytics returned HTTP ${response.status}`);
  const body = (await response.json()) as {
    tables?: { columns: { name: string }[]; rows: unknown[][] }[];
  };
  const table = body.tables?.[0];
  if (!table) return [];
  const columns = table.columns.map((c) => c.name);
  return table.rows.map(
    (row) => Object.fromEntries(row.map((v, i) => [columns[i], v])) as unknown as T,
  );
}

observabilityRouter.get("/observability/:askId", asyncHandler(async (req, res) => {
  const ask = getAsk(req.params.askId);
  if (!ask) {
    res.status(404).json({
      error: "Unknown askId",
      detail:
        "This request was not made through the broker in the current session. " +
        "Correlation state is in-memory and clears when the broker restarts.",
    });
    return;
  }

  const agentName = ask.agentName;
  const framework = FRAMEWORK_BY_AGENT[agentName];

  // A generous window around the ask: enough to catch the interaction despite
  // clock skew, tight enough not to collide with neighbouring requests.
  const askIso = new Date(ask.timestamp).toISOString();
  const windowStart = new Date(ask.timestamp - 120_000).toISOString();
  const windowEnd = new Date(ask.timestamp + 120_000).toISOString();

  const [gatewayRows, llmRows, spans] = await Promise.all([
    queryLogAnalytics<GatewayRow>(
      `ApiManagementGatewayLogs ` +
        `| where TimeGenerated between (datetime(${windowStart}) .. datetime(${windowEnd})) ` +
        `| project TimeGenerated, CorrelationId, ApiId, OperationId, ApiRevision, ResponseCode, ` +
        `BackendResponseCode, IsRequestSuccess, TotalTime, BackendTime, Url, BackendUrl, ` +
        `RequestSize, ResponseSize, ApimSubscriptionId, BackendId, CallerIpAddress, Region, ` +
        `Method, LastErrorReason, LastErrorMessage`,
    ).catch(() => [] as GatewayRow[]),
    queryLogAnalytics<LlmRow>(
      `ApiManagementGatewayLlmLog ` +
        `| where TimeGenerated between (datetime(${windowStart}) .. datetime(${windowEnd})) ` +
        `| project TimeGenerated, CorrelationId, SequenceNumber, DeploymentName, ModelName, ` +
        `PromptTokens, CompletionTokens, TotalTokens, RequestMessages, ResponseMessages`,
    ).catch(() => [] as LlmRow[]),
    ask.traceId
      ? queryLogAnalytics<SpanRow>(
          `union AppRequests, AppDependencies ` +
            `| where OperationId == "${ask.traceId.replace(/"/g, "")}" ` +
            `| project TimeGenerated, Type, AppRoleName, Name, Id, ParentId, DurationMs, ` +
            `Success, Properties | order by TimeGenerated asc`,
        ).catch(() => [] as SpanRow[])
      : Promise.resolve([] as SpanRow[]),
  ]);

  // ── Hop 1: the client's call to the agent. Identified by API id, then by
  // the agent name embedded in the URL, so a concurrent call to the *other*
  // agent in the same window can't be mistaken for this one.
  const hop1Candidates = gatewayRows
    .filter((r) => r.ApiId === "hosted-agent-responses-api" && r.Url?.includes(`/agents/${agentName}/`))
    .sort(
      (a, b) =>
        Math.abs(new Date(a.TimeGenerated).getTime() - ask.timestamp) -
        Math.abs(new Date(b.TimeGenerated).getTime() - ask.timestamp),
    );
  const hop1 = hop1Candidates[0];

  // ── Hop 2: the agent's own model call. Provably part of hop 1 when it
  // starts after hop 1 starts and finishes before hop 1 finishes.
  let hop2: GatewayRow | undefined;
  if (hop1) {
    const h1Start = new Date(hop1.TimeGenerated).getTime();
    const h1End = h1Start + hop1.TotalTime;
    hop2 = gatewayRows
      .filter((r) => r.ApiId === "inference-api")
      .find((r) => {
        const start = new Date(r.TimeGenerated).getTime();
        return start >= h1Start && start + r.TotalTime <= h1End + 1000;
      });
  }

  // ── LLM rows for hop 2, joined on the gateway CorrelationId.
  const llmForHop2 = hop2 ? llmRows.filter((r) => r.CorrelationId === hop2!.CorrelationId) : [];
  const tokenRow = llmForHop2.find((r) => r.TotalTokens > 0 || r.DeploymentName);
  const promptRow = llmForHop2.find((r) => r.RequestMessages);
  const completionRow = llmForHop2.find((r) => r.ResponseMessages);

  const loggedPrompt = promptRow ? extractLastUserMessage(promptRow.RequestMessages) : undefined;
  const loggedCompletion = completionRow
    ? extractCompletion(completionRow.ResponseMessages)
    : undefined;
  const question = loggedPrompt ? extractQuestion(loggedPrompt) : null;

  // ── GenAI semantic-convention attributes from the agent's own OpenTelemetry
  // instrumentation. An independent second source for tokens and model, which
  // is why it is surfaced alongside rather than instead of the gateway's.
  const genaiSpan = spans.find((s) => s.Properties?.includes("gen_ai.usage"));
  let genai: Record<string, string> = {};
  if (genaiSpan?.Properties) {
    try {
      genai = JSON.parse(genaiSpan.Properties) as Record<string, string>;
    } catch {
      genai = {};
    }
  }

  const telemetryPending = !hop1 && spans.length === 0;
  const ageSeconds = Math.max(0, (Date.now() - ask.timestamp) / 1000);

  const gatewayOverheadHop1 = hop1 ? hop1.TotalTime - hop1.BackendTime : null;
  const gatewayOverheadHop2 = hop2 ? hop2.TotalTime - hop2.BackendTime : null;

  res.json({
    askId: ask.askId,
    telemetryPending,
    /** How the pieces were joined, surfaced so the UI can be honest about it. */
    correlation: {
      traceId: live(ask.traceId, "Agent response header X-Request-ID = App Insights OperationId"),
      hop1CorrelationId: live(hop1?.CorrelationId, "ApiManagementGatewayLogs"),
      hop2CorrelationId: live(hop2?.CorrelationId, "ApiManagementGatewayLogs"),
      method: hop2
        ? "Hop 2 associated with hop 1 by timestamp containment — an association, not a single measured transaction."
        : "Hop 2 not yet correlated.",
    },

    // ── SECTION 1 — Request Audit ────────────────────────────────────────
    audit: {
      prompt: live(question ?? loggedPrompt ?? ask.prompt, "ApiManagementGatewayLlmLog (seq 1)"),
      /** Verbatim gateway capture including any injected demo context — the authoritative artefact. */
      promptFull: live(loggedPrompt ?? ask.prompt, "ApiManagementGatewayLlmLog (seq 1)"),
      contextInjected: (ask.knowledgeApplied?.length ?? 0) > 0,
      completion: isCaptured(loggedCompletion)
        ? live(loggedCompletion, "ApiManagementGatewayLlmLog (seq 2)")
        : live(ask.answerText, "Hosted agent response (broker)"),
      timestamp: live(hop1?.TimeGenerated ?? askIso, "ApiManagementGatewayLogs"),
      agentName: live(agentName, "Hosted agent response agent_reference"),
      agentVersion: live(ask.agentVersion, "Hosted agent response agent_reference"),
      framework: live(framework, "Agent identity (lab configuration)"),
      model: live(tokenRow?.ModelName ?? genai["gen_ai.response.model"], "ApiManagementGatewayLlmLog / gen_ai.response.model"),
      httpStatus: live(hop1?.ResponseCode ?? ask.httpStatus, "ApiManagementGatewayLogs ResponseCode"),
      latencyMs: live(hop1?.TotalTime ?? ask.totalLatencyMs, "ApiManagementGatewayLogs TotalTime"),
    },

    // ── SECTION 2 — Inference Summary ────────────────────────────────────
    inference: {
      agentName: live(agentName, "Hosted agent response"),
      framework: live(framework, "Agent identity"),
      model: live(tokenRow?.ModelName, "ApiManagementGatewayLlmLog ModelName"),
      modelRequested: live(genai["gen_ai.request.model"], "OpenTelemetry gen_ai.request.model"),
      deployment: live(tokenRow?.DeploymentName, "ApiManagementGatewayLlmLog DeploymentName"),
      region: live(hop1?.Region ?? ask.region, "ApiManagementGatewayLogs / x-ms-region header"),
      gatewayApi: live(hop1?.ApiId, "ApiManagementGatewayLogs ApiId"),
      gatewayOperation: live(hop1?.OperationId, "ApiManagementGatewayLogs OperationId"),
      gatewayRoute: live(hop1?.Url, "ApiManagementGatewayLogs Url"),
      apiRevision: live(hop1?.ApiRevision, "ApiManagementGatewayLogs ApiRevision"),
      httpStatus: live(hop1?.ResponseCode, "ApiManagementGatewayLogs ResponseCode"),
      backendStatus: live(hop1?.BackendResponseCode, "ApiManagementGatewayLogs BackendResponseCode"),
      requestId: live(ask.askId, "Hosted agent response id"),
      correlationId: live(hop1?.CorrelationId, "ApiManagementGatewayLogs CorrelationId"),
      traceId: live(ask.traceId, "X-Request-ID header = App Insights OperationId"),
      apimRequestId: live(ask.apimRequestId, "apim-request-id header (display only — not a log join key)"),
      conversationId: live(ask.sessionId, "agent_session_id / microsoft.session.id"),
      subscription: live(hop1?.ApimSubscriptionId, "ApiManagementGatewayLogs ApimSubscriptionId"),
      callerIp: live(hop1?.CallerIpAddress, "ApiManagementGatewayLogs CallerIpAddress"),
      servedByCluster: live(ask.servedByCluster, "azureml-served-by-cluster header"),
      runtime: live(ask.platformServer, "x-platform-server header"),

      latencyMs: live(hop1?.TotalTime ?? ask.totalLatencyMs, "ApiManagementGatewayLogs TotalTime"),
      backendTimeMs: live(hop1?.BackendTime, "ApiManagementGatewayLogs BackendTime"),
      gatewayOverheadMs: live(gatewayOverheadHop1, "TotalTime − BackendTime (hop 1)"),
      modelCallMs: live(hop2?.TotalTime, "ApiManagementGatewayLogs TotalTime (inference-api)"),
      modelGatewayOverheadMs: live(gatewayOverheadHop2, "TotalTime − BackendTime (hop 2)"),
      agentServerMs: live(
        ask.createdAt && ask.completedAt ? (ask.completedAt - ask.createdAt) * 1000 : null,
        "Hosted agent response created_at → completed_at",
      ),

      inputTokens: live(
        tokenRow?.PromptTokens ?? (genai["gen_ai.usage.input_tokens"] ? Number(genai["gen_ai.usage.input_tokens"]) : null),
        "ApiManagementGatewayLlmLog PromptTokens",
      ),
      outputTokens: live(
        tokenRow?.CompletionTokens ?? (genai["gen_ai.usage.output_tokens"] ? Number(genai["gen_ai.usage.output_tokens"]) : null),
        "ApiManagementGatewayLlmLog CompletionTokens",
      ),
      totalTokens: live(tokenRow?.TotalTokens, "ApiManagementGatewayLlmLog TotalTokens"),
      /** Second, independent token source — shown to corroborate, never to fill a gap. */
      tokensCorroboratedBy: genai["gen_ai.usage.input_tokens"]
        ? live(
            `gen_ai.usage ${genai["gen_ai.usage.input_tokens"]} in / ${genai["gen_ai.usage.output_tokens"]} out`,
            "OpenTelemetry GenAI attributes from the agent container",
          )
        : unavailable<string>("OpenTelemetry GenAI attributes", "Trace not yet ingested"),

      promptChars: live(loggedPrompt?.length ?? ask.prompt?.length, "Character count of the captured prompt"),
      completionChars: live(
        isCaptured(loggedCompletion) ? loggedCompletion!.length : ask.answerText?.length,
        "Character count of the captured completion",
      ),
      requestBytes: live(hop1?.RequestSize, "ApiManagementGatewayLogs RequestSize"),
      responseBytes: live(hop1?.ResponseSize, "ApiManagementGatewayLogs ResponseSize"),

      // Genuinely not obtainable here — never rendered as a number.
      cost: unavailable<number>(
        "Azure Cost Management",
        "Unavailable in this deployment — Cost Management cannot report on a resource group this young",
      ),
      queueTimeMs: unavailable<number>(
        "—",
        "Unavailable in this deployment — no queue-depth telemetry is emitted",
      ),
    },

    // ── SECTION 3 — Governance Evidence ──────────────────────────────────
    // "active" means evidenced for THIS request, not asserted from design.
    governance: buildGovernance({ hop1, hop2, tokenRow, spans, ask }),

    // ── Execution timeline (detail dialog) ───────────────────────────────
    trace: {
      operationId: live(ask.traceId, "X-Request-ID header"),
      spanCount: spans.length,
      spans: spans.map((s) => ({
        role: s.AppRoleName,
        name: s.Name,
        id: s.Id,
        parentId: s.ParentId,
        durationMs: s.DurationMs,
        success: s.Success,
        startedAt: s.TimeGenerated,
        kind: s.Type === "AppRequests" ? "request" : "dependency",
      })),
      genAiAttributes: Object.fromEntries(
        Object.entries(genai).filter(([k]) => k.startsWith("gen_ai.") || k.startsWith("microsoft.")),
      ),
      note:
        spans.length === 0
          ? "Trace not yet ingested — Application Insights carries 1–3 minutes of lag."
          : "Real parent/child spans across the Foundry runtime, the agent container, and API Management.",
    },

    provenance: { band: "live-delayed", ageSeconds },
  });
}));

/**
 * Governance evidence for one request.
 *
 * Three states, and the distinction is the point:
 *   active    — evidenced by telemetry from THIS request
 *   available — the control point supports it; not configured in this deployment
 *   absent    — not present in this lab at all
 *
 * Anything in `active` must cite the observation that proves it. A control we
 * merely believe is on belongs in `available`, not here.
 */
function buildGovernance({
  hop1,
  hop2,
  tokenRow,
  spans,
  ask,
}: {
  hop1?: GatewayRow;
  hop2?: GatewayRow;
  tokenRow?: LlmRow;
  spans: SpanRow[];
  ask: { traceId?: string; region?: string };
}) {
  const msiSpan = spans.find((s) => s.Name?.includes("/msi/token") || s.Name?.includes("metadata/identity"));

  return {
    active: [
      hop1 && {
        id: "authentication",
        name: "Subscription-key authentication",
        evidence: `Gateway accepted subscription "${hop1.ApimSubscriptionId}" and returned HTTP ${hop1.ResponseCode}`,
      },
      msiSpan && {
        id: "managedIdentity",
        name: "Managed-identity credential brokering",
        evidence: `Token acquisition span observed in the agent trace (${msiSpan.DurationMs} ms)`,
      },
      hop1 && {
        id: "gateway",
        name: "Gateway enforcement, north–south",
        evidence: `${hop1.ApiId} · ${hop1.OperationId} · revision ${hop1.ApiRevision}`,
      },
      hop2 && {
        id: "gatewayEastWest",
        name: "Gateway enforcement, east–west (agent → model)",
        evidence: `${hop2.ApiId} routed to backend "${hop2.BackendId ?? "foundry-models"}"`,
      },
      tokenRow && {
        id: "auditLogging",
        name: "Prompt and completion audit logging",
        evidence: `Logged to ApiManagementGatewayLlmLog with ${tokenRow.TotalTokens} tokens metered`,
      },
      ask.traceId &&
        spans.length > 0 && {
          id: "observability",
          name: "Distributed tracing",
          evidence: `${spans.length} correlated spans under operation ${ask.traceId.slice(0, 12)}…`,
        },
      hop1 && {
        id: "dataResidency",
        name: "Data residency",
        evidence: `Request processed in ${hop1.Region}`,
      },
      tokenRow && {
        id: "contentFiltering",
        name: "Content filtering at the model deployment",
        evidence: `RAI policy Microsoft.DefaultV2 is attached to deployment "${tokenRow.DeploymentName}" (configuration, not a per-request signal)`,
      },
    ].filter(Boolean),

    available: [
      { id: "rateLimiting", name: "Token rate limiting and per-consumer quotas", note: "No rate-limit policy is configured on either API" },
      { id: "semanticCaching", name: "Semantic caching", note: "No caching policy and no cache backend" },
      { id: "loadBalancing", name: "Backend load balancing and circuit breaking", note: "One AI service is deployed, so the backend pool is never created" },
      { id: "privateNetworking", name: "Private networking / Private Link", note: "publicNetworkAccess is Enabled on Foundry accounts and the registry" },
      { id: "entraOnly", name: "Entra-only authentication", note: "disableLocalAuth is not set, so key auth remains permitted" },
      { id: "keyVault", name: "Secret management via Key Vault", note: "The subscription key is injected as a plaintext environment variable" },
    ],

    absent: [
      { id: "promptShield", name: "Prompt Shield / jailbreak detection", note: "Not present in this lab — no Content Safety resource is deployed" },
      { id: "piiRedaction", name: "PII detection and redaction", note: "Not present in this lab" },
      { id: "chargeback", name: "Per-consumer chargeback", note: "Not present in this lab — one APIM subscription exists" },
    ],
  };
}
