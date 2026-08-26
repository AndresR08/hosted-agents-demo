/** In-memory correlation between an ask and its journey, for GET /api/journey/:askId right after the fact. Cleared on broker restart — fine, this is a live demo aid, not durable state. */
export interface AskRecord {
  askId: string;
  totalLatencyMs: number;
  timestamp: number;
  agentName: string;
  /** Version reported back by Foundry for the agent that answered, e.g. ":3". */
  agentVersion?: string;
  /**
   * The prompt exactly as sent to the agent. Kept so the audit record can be
   * *truthfully* attributed to an agent: `ApiManagementGatewayLlmLog` carries
   * no agent column, so the only honest way to say "this logged row came from
   * strands-agent" is to match the logged prompt against a prompt we know we
   * sent to that agent. See routes/auditRecord.ts.
   */
  prompt?: string;
  /** The answer text, so the audit view can render before Log Analytics ingests. */
  answerText?: string;
  httpStatus?: number;

  // ── Correlation keys and metadata read off the live response ────────────
  /**
   * The `X-Request-ID` response header. **This is the W3C trace id and equals
   * `OperationId` in Application Insights** — verified against this deployment.
   * It is the one key that ties an ask to its full distributed trace without
   * any guessing, which is why it is captured here rather than reconstructed.
   */
  traceId?: string;
  /**
   * APIM's own `apim-request-id` header. Recorded for display only: it does
   * **not** appear as `CorrelationId` in Log Analytics (verified — zero
   * matches), so it cannot be used as a join key.
   */
  apimRequestId?: string;
  /** `agent_session_id` (body) / `x-agent-session-id` (header) — also `microsoft.session.id` in App Insights. */
  sessionId?: string;
  /** `x-ms-region` response header. */
  region?: string;
  /** `azureml-served-by-cluster` — which Foundry cluster served the container. */
  servedByCluster?: string;
  /** `x-platform-server` — agent-server runtime and Python versions. */
  platformServer?: string;
  /** Foundry's own timestamps, in seconds. Their difference is server-side duration. */
  createdAt?: number;
  completedAt?: number;
  /** Which demo-knowledge entries were injected for this question. */
  knowledgeApplied?: string[];
}

const asks = new Map<string, AskRecord>();

/** Bounded so a long session can't grow this without limit. Oldest evicted first. */
const MAX_RECORDS = 200;

export function recordAsk(record: AskRecord) {
  asks.set(record.askId, record);
  while (asks.size > MAX_RECORDS) {
    const oldest = asks.keys().next().value;
    if (oldest === undefined) break;
    asks.delete(oldest);
  }
}

export function getAsk(askId: string): AskRecord | undefined {
  return asks.get(askId);
}

/**
 * Most recent asks first. Used by the audit record to attribute a Log
 * Analytics row to the agent that produced it, by prompt match.
 */
export function listAsks(): AskRecord[] {
  return [...asks.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Finds the ask whose prompt matches this logged prompt. Comparison is
 * whitespace-normalised because the gateway logs the message content it saw,
 * which may differ from what we sent by trailing whitespace only.
 *
 * Returns undefined when there is no match — the caller must then leave the
 * record unattributed rather than guessing.
 */
/**
 * Minimum length before containment matching is allowed. The augmented prompt
 * carries a long style directive, so real prompts are always far longer than
 * this — the guard exists only so a pathologically short stored prompt can
 * never match everything.
 */
const MIN_MATCH_LENGTH = 40;

/**
 * Matches by containment rather than equality, because frameworks rewrap the
 * text before it reaches the model — and it is the *model* call that
 * `ApiManagementGatewayLlmLog` records.
 *
 * Observed in this deployment: `pydantic-agent` flattens the turn into
 * `"user: <text>"` lines (ARCHITECTURE.md §7.4), while `strands-agent` sends
 * structured content parts. Both embed our text verbatim, so "the logged
 * prompt contains the prompt we sent" holds for both while exact equality
 * holds for neither. Containment on a string this long and distinctive cannot
 * realistically collide between two different asks.
 */
export function findAskByPrompt(loggedPrompt: unknown): AskRecord | undefined {
  const haystack = normalise(loggedPrompt);
  if (!haystack) return undefined;
  return listAsks().find((ask) => {
    const needle = normalise(ask.prompt);
    if (needle.length < MIN_MATCH_LENGTH) return false;
    return haystack === needle || haystack.includes(needle);
  });
}

/**
 * Accepts `unknown` deliberately. Log Analytics content is not guaranteed to
 * be a string (structured message parts are legal and do occur), and a
 * failed attribution must degrade to "unattributed" rather than throwing —
 * this runs on the path that renders the audit panel mid-demo.
 */
function normalise(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
