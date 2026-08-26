/**
 * In-memory record of every hosted-agent invocation the broker has made —
 * both `POST /ask` and `POST /agents/:name/invoke` write here, and
 * `GET /api/runs` / `GET /api/runs/:id` read from here. Bounded and cleared
 * on restart, deliberately: same kind of live-demo aid as askStore.ts.
 *
 * ## Why this is not the same store as askStore.ts
 *
 * Both stores record "one call to a hosted agent," which makes them look
 * like duplication of the same domain concept. They are not fully unifiable
 * without breaking existing contracts, for one concrete reason: askStore.ts
 * carries fields that exist *only* to serve two already-shipped consumers
 * that have nothing to do with the "Run" domain object —
 *
 * - `traceId` / `apimRequestId` / `sessionId` / `region` / `servedByCluster`
 *   / `platformServer` — correlation keys `GET /api/journey/:askId` uses to
 *   assemble a distributed trace (routes/journey.ts).
 * - `prompt` matched by *containment* against Log Analytics rows —
 *   `findAskByPrompt()`, the attribution mechanism behind the audit record
 *   (routes/auditRecord.ts). This lookup is keyed by askId and depends on
 *   askStore's exact shape and its `listAsks()` ordering.
 *
 * A `RunRecord` has no use for any of that: `GET /api/runs` promises exactly
 * `runId, agentName, status, startedAt, finishedAt, duration, model,
 * provenance` per item, and even `GET /api/runs/:id` (not implemented yet)
 * is scoped to the invocation itself, not to APIM/App Insights correlation.
 * Moving journey/audit onto RunRecord would mean widening the Run domain
 * object with fields that only exist for observability plumbing, which is
 * the opposite of what a domain object is for — and would require editing
 * routes/journey.ts and routes/auditRecord.ts, i.e. touching contracts nowhere
 * near the scope of this endpoint.
 *
 * So: askStore.ts keeps doing exactly what it already did (unchanged), and
 * `/ask` now *also* calls `recordRun` here alongside its existing
 * `recordAsk` call — same invocation, two read-models, one for
 * correlation/audit, one for the Run history. This is the "single
 * persistence mechanism" for the Run concept specifically: every Run, from
 * either route, lands in exactly one place — this Map.
 */

/**
 * Foundry's own value on success (observed live: "completed"), never
 * translated — see agentInvocation.ts. "failed" and "timeout" are
 * synthesized by the broker itself for the two cases where there is no
 * upstream payload to read a status from at all.
 */
export type RunStatus = string;

export interface RunRecord {
  runId: string;
  agentName: string;
  /** e.g. ":3" — only known on success, from the response's `agent_reference`. */
  agentVersion?: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  prompt: string;
  output?: string;
  usage?: Record<string, unknown>;
  model?: string;
  httpStatus: number;
  /** Upstream error text, only present when status is "failed" or "timeout". */
  errorDetail?: string;
}

const runs = new Map<string, RunRecord>();

/** Bounded so a long session can't grow this without limit. Oldest evicted first. */
const MAX_RECORDS = 200;

export function recordRun(record: RunRecord) {
  runs.set(record.runId, record);
  while (runs.size > MAX_RECORDS) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) break;
    runs.delete(oldest);
  }
}

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

/** Most recent runs first. */
export function listRuns(): RunRecord[] {
  return [...runs.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}
