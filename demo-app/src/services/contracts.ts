import type { AgentName } from "@/state/types";

/**
 * Shared data contract for the demo application. `services/azure` and
 * `services/simulation` both implement `DemoDataService` — panels depend
 * only on this file, never on a concrete implementation (see
 * services/provider.ts). Shapes are derived directly from what
 * DESIGN_DECISIONS.md says this lab can and cannot produce; do not add a field
 * here that §3 does not support without updating that document first.
 */

/** DESIGN_DECISIONS.md — the provenance badge every data component carries. */
export type ProvenanceBand = "live" | "live-delayed" | "replay" | "illustrative";

export interface Provenance {
  band: ProvenanceBand;
  /** ISO timestamp the data was retrieved, when band is "live" or "live-delayed". */
  asOf?: string;
  /** Age of the underlying data in seconds, when band is "live-delayed". */
  ageSeconds?: number;
  /** ISO timestamp the replay capture was recorded, when band is "replay". */
  capturedAt?: string;
}

// ── Header (chrome) ─────────────────────────────────────────────────────

export interface EnvironmentContext {
  region: string;
  resourceGroupName: string;
  resourceCount: number;
  /**
   * The hosted-agent Responses URL with `{agentName}` left in place — the
   * mechanism behind "one API serves N agents" (README.md §Get Started,
   * `src/frameworks/README.md` §"Foundry Hosted Agent URL Format").
   *
   * Built by the broker from the same function it uses to *call* an agent, so
   * the route on screen cannot drift from the route actually requested.
   * Optional: an older broker simply omits it and the Gateway stop renders the
   * path without it rather than inventing one.
   */
  agentRouteTemplate?: string;
  /**
   * The APIM tier this deployment actually runs on ("Basicv2", "Consumption",
   * ...), read from ARM by the broker. The APIM reference panel marks the row
   * for the tier in use with it. Optional: an older broker omits it, and that
   * panel then shows the comparison without claiming which one is live -
   * which is the required behaviour, not a degraded one.
   */
  apimSku?: string;
  provenance: Provenance;
}

// ── The copilot conversation ────────────────────────────────────────────

export interface AskResult {
  askId: string;
  answerText: string;
  agentName: AgentName;
  agentVersion: string;
  /**
   * The framework and container that produced this answer, read from the
   * Foundry registry alongside the call. Every answer carries them so the
   * room can see a specific container they built responded — not "the AI".
   * Optional because a registry read that fails must not cost the answer.
   */
  framework?: string;
  containerImage?: string;
  latencyMs: number;
  httpStatus: number;
  /**
   * IDs of the local demo-knowledge entries the broker injected as reference
   * context for this question (broker/src/demoKnowledge.ts). Empty when the
   * question did not match the knowledge base and the agent answered from its
   * own capability.
   */
  knowledgeApplied?: string[];
  provenance: Provenance;
}

// ── ③ API Management — the request path ─────────────────────────────────

export interface JourneyHop {
  id: "client-apim" | "apim-agent" | "agent-apim" | "apim-model" | "model";
  label: string;
  credentialFact: string;
  policyLine?: string;
  durationMs?: number;
  /** True only for the arithmetic "agent internal time" hop — never present as measured (DESIGN_DECISIONS.md, Screen 4). */
  derived?: boolean;
  provenance: Provenance;
}

export interface RequestJourney {
  askId: string;
  hops: JourneyHop[];
  totalLatencyMs: number;
  /** The agent that served this ask — hop labels name it, so the journey re-renders per agent. */
  agentName?: AgentName;
  agentVersion?: string;
  /** Real per-hop gateway timing; `available: false` until Log Analytics ingests. */
  timings?: JourneyTimings;
  provenance: Provenance;
}

// ── ③ API Management — the credential attempts ──────────────────────────

export type AccessControlAttemptId =
  | "with-subscription-key"
  | "without-subscription-key"
  | "direct-to-foundry";

export interface AccessControlAttempt {
  id: AccessControlAttemptId;
  credentialPresented: string;
  httpStatus: number;
  /** "rejected" is the desired outcome for the latter two attempts — never render it as failure (DESIGN_DECISIONS.md). */
  outcome: "success" | "rejected";
}

export interface AccessControlResult {
  attempts: AccessControlAttempt[];
  provenance: Provenance;
}

export interface PolicyDocument {
  apiName: "hosted-agent-responses-api" | "inference-api";
  xml: string;
  provenance: Provenance;
}

// ── ② Hosted Agents ─────────────────────────────────────────────────────

/**
 * One registered agent as the Foundry registry reports it.
 *
 * The definition fields below (image, CPU, memory, environment-variable keys)
 * are what let the Hosted Agents stop show that two unrelated
 * containers became Hosted Agents under the *same* hosting contract — read
 * from the registry rather than asserted. All optional: an older broker, or a
 * registry that omits them, must degrade to name/version/status rather than
 * render a fabricated resource envelope.
 */
export interface AgentSummary {
  name: AgentName;
  version: string;
  /** Set at creation — often empty; render nothing rather than a placeholder when it is. */
  description?: string;
  /**
   * `FRAMEWORK_BY_AGENT` on the broker for the two demo agents, or the
   * agent's own name as a fallback for any other registered agent
   * (`broker/src/foundryAgents.ts`) — not a closed set once Create Agent can
   * register a name the broker has no framework mapping for.
   */
  framework: string;
  status: "Running" | "Unknown";
  imageUri?: string;
  cpu?: string;
  memory?: string;
  /** Keys only — values are never fetched into the browser. */
  environmentVariableKeys?: string[];
  versionCreatedAt?: string;
}

/**
 * The agent's full public definition — `GET /api/agents/:name`. Fetched
 * fresh on every selection; never derived from `AgentSummary` (the list
 * row `listAgents()` returns). Deliberately not the same shape as
 * `AgentSummary`: no `framework` (Foundry has no concept of it — that map
 * is local to the broker), and `status` here is Foundry's own raw value
 * (e.g. "active"), unlike `AgentSummary.status`, which the broker already
 * translates to "Running"/"Unknown".
 */
export interface AgentDetail {
  id: string;
  name: AgentName;
  description: string;
  latestVersion: string;
  /** Foundry's own value — never translated by this application. */
  status: string;
  cpu: string;
  memory: string;
  image: string;
  protocolVersions: { protocol: string; version: string }[];
  /** Shape unverified against this deployment — always empty in every observation so far. */
  containerProtocolVersions: unknown[];
  /** Keys only — values are never fetched into the browser. */
  environmentVariableKeys: string[];
  createdAt: string;
  /** Present only when Foundry returns it — this deployment has not, so far. */
  updatedAt?: string;
  provenance: Provenance;
}

/**
 * What creating a Hosted Agent needs — `POST /api/agents`
 * (broker/src/routes/agents.ts). `name`, `image`, `cpu`, `memory` are
 * required because Foundry requires them; the broker itself rejects the
 * four platform-managed environment variable keys with 400, so this client
 * does not re-validate that list — it only checks that required fields are
 * non-empty before submitting, the same "don't duplicate the backend's
 * validation" rule every other write in this app follows.
 */
export interface CreateAgentInput {
  name: string;
  image: string;
  cpu: string;
  memory: string;
  description?: string;
}

/**
 * One entry in an agent's version history — `GET /api/agents/:name/versions`.
 * A narrow subset of what the endpoint actually returns: `id`, `name`,
 * `description`, `draft`, `metadata`, `protocolVersions`,
 * `containerProtocolVersions` and `definition.kind` are real fields on the
 * wire (broker/src/routes/agents.ts) but not part of what this panel shows.
 * Nesting under `definition` matches the endpoint's real shape — unlike
 * `AgentDetail`, this is not flattened.
 */
export interface AgentVersionSummary {
  version: string;
  /** Foundry's own value — never translated by this application. */
  status: string;
  createdAt: string;
  definition: {
    cpu: string;
    memory: string;
    imageUri: string;
    /** Keys only — values are never fetched into the browser. */
    environmentVariableKeys: string[];
  };
}

/**
 * Full version history for one agent — `GET /api/agents/:name/versions`.
 * Fetched independently of `getAgentDetail()` and `listAgents()`; the
 * Versions panel never derives its rows from either.
 */
export interface AgentVersionHistory {
  agentName: AgentName;
  /** Exactly the order the broker returned — descending by createdAt, never re-sorted by this application. */
  versions: AgentVersionSummary[];
  provenance: Provenance;
}

/**
 * Result of one invocation — `POST /api/agents/:name/invoke`. Success only:
 * a non-2xx response rejects (see `brokerFetch`) and carries no `runId` in
 * its body, which is why a failed or timed-out invocation is discovered
 * afterwards via `listRuns()` rather than trusted from this response.
 */
export interface InvokeAgentResult {
  runId: string;
  /** Foundry's own value on success (observed live: "completed") — never translated. */
  status: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  output?: string;
  usage?: Record<string, unknown> | null;
  model?: string;
  provenance: Provenance;
}

/**
 * One entry in the run history — `GET /api/runs`. Deliberately narrow
 * (broker/src/routes/runs.ts): no `prompt`, no `response` — those belong to
 * `RunDetail` (`GET /api/runs/:id`) only.
 */
export interface RunSummary {
  runId: string;
  agentName: AgentName;
  /** "completed" on success, or the broker's own "failed"/"timeout" — never translated. */
  status: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  model?: string | null;
  provenance: Provenance;
}

/**
 * Full detail for one run — `GET /api/runs/:id`. `prompt` and `response`
 * are the exact strings the broker recorded at invocation time, not
 * reconstructed. `model`/`response`/`usage` are `null` when Foundry did not
 * return them (e.g. every run in this deployment has no `usage`) — never
 * fabricated.
 */
export interface RunDetail {
  runId: string;
  agentName: AgentName;
  status: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  model?: string | null;
  prompt: string;
  response?: string | null;
  usage?: Record<string, unknown> | null;
  provenance: Provenance;
}

export interface AgentProvenance {
  agentName: AgentName;
  imageUri: string;
  imageDigest: string;
  pushedAt: string;
  versionCreatedAt: string;
  /** Environment variable keys only — values are never fetched into the browser. */
  environmentVariableKeys: string[];
  provenance: Provenance;
}

// ── ⑤ Operations ────────────────────────────────────────────────────────

export interface ControlItem {
  id: string;
  name: string;
}

export interface ControlsCatalogue {
  active: ControlItem[];
  available: ControlItem[];
  provenance: Provenance;
}

// ── ④ Observability — the audit record ──────────────────────────────────

export interface AuditRecord {
  timestamp: string;
  subscriptionName: string;
  /**
   * `ApiManagementGatewayLlmLog` carries no agent column — the row it logs is
   * the *model* call on the second hop. The broker fills these only when it can
   * match the logged prompt to an ask it made in this session, which is the one
   * honest way to attribute a row. Undefined means "not attributable", and the
   * UI must say so rather than implying the agent on screen produced it.
   */
  agentName?: AgentName;
  agentVersion?: string;
  attributionAvailable?: boolean;
  /** The agent the panel asked for, echoed back so it can say "no record yet for this one". */
  requestedAgentName?: AgentName;
  modelName: string;
  /** The presenter's question, with any injected demo-knowledge preamble removed for display. */
  prompt: string;
  /** Exactly what the gateway captured, including injected context. The authoritative artefact. */
  promptFull?: string;
  /** True when the logged prompt contained broker-injected reference context. */
  contextInjected?: boolean;
  completion: string;
  provenance: Provenance;
}

// ── ④ Observability — the full request read ─────────────────────────────

/**
 * Every observable field arrives wrapped so the UI can always tell "we did not
 * get this" apart from "this is genuinely zero". A field with `available:false`
 * must render as "Unavailable in this deployment" with its `reason` — never as
 * a blank, a dash, or a 0 that reads like a measurement.
 */
export interface ObservableField<T> {
  value: T | null;
  /** Which Azure resource produced this — shown as the field's provenance. */
  source: string;
  available: boolean;
  reason?: string;
}

export interface GovernanceControl {
  id: string;
  name: string;
  /** Present on active controls: the observation from THIS request that proves it. */
  evidence?: string;
  /** Present on available/absent controls: why it is not in effect. */
  note?: string;
}

export interface TraceSpan {
  role: string;
  name: string;
  id: string;
  parentId: string;
  durationMs: number;
  success: boolean;
  startedAt: string;
  kind: "request" | "dependency";
}

export interface RequestObservability {
  askId: string;
  /** True while Log Analytics has not yet ingested this request (1–3 min lag). */
  telemetryPending: boolean;
  correlation: {
    traceId: ObservableField<string>;
    hop1CorrelationId: ObservableField<string>;
    hop2CorrelationId: ObservableField<string>;
    method: string;
  };
  audit: {
    prompt: ObservableField<string>;
    promptFull: ObservableField<string>;
    contextInjected: boolean;
    completion: ObservableField<string>;
    timestamp: ObservableField<string>;
    agentName: ObservableField<string>;
    agentVersion: ObservableField<string>;
    framework: ObservableField<string>;
    model: ObservableField<string>;
    httpStatus: ObservableField<number>;
    latencyMs: ObservableField<number>;
  };
  /** Keyed access — the panel renders these in a declared order, see ObservabilityStop. */
  inference: Record<string, ObservableField<string | number>>;
  governance: {
    active: GovernanceControl[];
    available: GovernanceControl[];
    absent: GovernanceControl[];
  };
  trace: {
    operationId: ObservableField<string>;
    spanCount: number;
    spans: TraceSpan[];
    genAiAttributes: Record<string, string>;
    note: string;
  };
  provenance: Provenance;
}

/** Per-hop gateway timing on the Request Journey — real, from ApiManagementGatewayLogs. */
export interface JourneyHopTiming {
  label: string;
  totalMs: number;
  backendMs: number;
  /** TotalTime − BackendTime: API Management's own processing cost. */
  gatewayOverheadMs: number;
  responseCode: number;
  correlationId: string;
}

export interface JourneyTimings {
  available: boolean;
  hop1: JourneyHopTiming | null;
  hop2: JourneyHopTiming | null;
  totalGatewayOverheadMs: number | null;
  /** Non-null when hop 2 was associated with hop 1 — states that it is an association. */
  correlationMethod: string | null;
  source: string;
  provenance: Provenance;
}

// ── Presenter maintenance ───────────────────────────────────────────────

export type MaintenanceActionId =
  | "ping"
  | "warm-agent"
  | "test-hosted-agent"
  | "test-apim"
  | "refresh-azure-status"
  | "reload-audit-logs"
  | "reload-policies"
  | "refresh-agent-registry"
  | "refresh-deployment-info";

export interface MaintenanceResult {
  ok: boolean;
  detail: string;
  elapsedMs: number;
}

// ── Service contract ────────────────────────────────────────────────────

export interface AskOptions {
  /**
   * Send the question without the broker's local demo-knowledge context.
   *
   * Set only by the Framework Experience capability probe, which asks both
   * agents the same question: injecting identical reference facts into both
   * would have them recite the same borrowed answer and erase the difference
   * the probe exists to show.
   */
  skipKnowledge?: boolean;
}

export interface DemoDataService {
  getEnvironmentContext(): Promise<EnvironmentContext>;
  ask(prompt: string, agentName: AgentName, options?: AskOptions): Promise<AskResult>;
  getRequestJourney(askId: string): Promise<RequestJourney>;
  runAccessControlTests(): Promise<AccessControlResult>;
  getPolicyDocument(apiName: PolicyDocument["apiName"]): Promise<PolicyDocument>;
  listAgents(): Promise<AgentSummary[]>;
  /**
   * `POST /api/agents`. Resolves with the same `AgentDetail` shape
   * `getAgentDetail()` returns — the created agent, as the broker sees it
   * immediately after creation. Rejects (400/409/502/…) on failure; this
   * client does not special-case any status, it shows whatever the broker
   * said through the same reused error pattern every other write in this
   * app uses.
   */
  createAgent(input: CreateAgentInput): Promise<AgentDetail>;
  /**
   * `DELETE /api/agents/:name`. Cascades to every version Foundry has
   * registered for this agent — there is no separate per-version delete in
   * this product. Rejects (404 unregistered, 409 active sessions) exactly
   * like every other write; this client does not special-case either.
   */
  deleteAgent(agentName: AgentName): Promise<{ name: string; deleted: boolean }>;
  /**
   * Full public definition of one agent — `GET /api/agents/:name`. Fetched
   * fresh on every selection, independent of `listAgents()`. Rejects for a
   * name Foundry does not have registered (404).
   */
  getAgentDetail(agentName: AgentName): Promise<AgentDetail>;
  /**
   * Full version history for one agent — `GET /api/agents/:name/versions`.
   * Fetched fresh whenever the Versions tab is open for the current
   * selection; never derived from `getAgentDetail()` or `listAgents()`.
   */
  getAgentVersions(agentName: AgentName): Promise<AgentVersionHistory>;
  /** `POST /api/agents/:name/invoke` — a real invocation, one call, no polling. */
  invokeAgent(agentName: AgentName, prompt: string): Promise<InvokeAgentResult>;
  /** `GET /api/runs` — every recorded run, most recent first. */
  listRuns(): Promise<RunSummary[]>;
  /** `GET /api/runs/:id`. Rejects (404) for an id the broker never recorded. */
  getRun(runId: string): Promise<RunDetail>;
  getAgentProvenance(agentName: AgentName): Promise<AgentProvenance>;
  getControlsCatalogue(): Promise<ControlsCatalogue>;
  /**
   * `agentName` asks for the newest record attributable to that agent; the
   * broker falls back to the newest record overall when it has none, so the
   * panel is never blank purely because the presenter switched agents.
   */
  getAuditRecord(agentName?: AgentName): Promise<AuditRecord | null>;
  /**
   * Full observability for one request. Returns null when the ask is unknown to
   * the broker (correlation state is in-memory and clears on restart).
   */
  getRequestObservability(askId: string): Promise<RequestObservability | null>;
  /**
   * Presenter diagnostics. Not part of the audience-facing data surface —
   * these exercise paths the demo already uses and report pass/fail with
   * timing. Simulation mode answers locally without touching Azure.
   */
  runMaintenanceAction(
    action: MaintenanceActionId,
    agentName?: AgentName,
  ): Promise<MaintenanceResult>;
}
