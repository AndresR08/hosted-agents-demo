import { Router } from "express";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";
import { getRun, listRuns } from "../runStore.js";

export const runsRouter = Router();

/**
 * History of every hosted-agent invocation the broker has recorded —
 * `POST /ask` and `POST /agents/:name/invoke` both write to runStore.ts (see
 * that file for why askStore.ts is a separate, non-unifiable mechanism), so
 * both appear here in one collection. Reads the in-memory Map only: no
 * Foundry/Azure call of any kind, and nothing here is reconstructed or
 * guessed — every field is exactly what was recorded at invocation time.
 *
 * Deliberately narrow per item — prompt and full output are not projected
 * here; those belong to `GET /api/runs/:id`.
 */
runsRouter.get("/runs", asyncHandler(async (_req, res) => {
  res.json(
    listRuns().map((run) => ({
      runId: run.runId,
      agentName: run.agentName,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      duration: run.durationMs,
      model: run.model,
      provenance: liveNow(),
    })),
  );
}));

/**
 * Full detail for one previously recorded run — reads runStore.ts only,
 * exactly the record `recordRun` wrote at invocation time (from either
 * `/ask` or `/agents/:name/invoke`). No Foundry call, no Log Analytics call:
 * `prompt` and `response` are the exact strings already stored, not
 * reconstructed or re-fetched from anywhere. `usage` is `null`, never
 * fabricated, when Foundry didn't return it (observed live: it doesn't, for
 * this deployment — see agentInvocation.ts).
 *
 * 404 shape matches the one existing precedent for this same class of
 * lookup — an in-memory, session-scoped, id-keyed record —
 * `GET /observability/:askId` (routes/observability.ts).
 */
runsRouter.get("/runs/:id", asyncHandler(async (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({
      error: "Unknown runId",
      detail:
        "This run was not recorded through the broker in the current session. " +
        "Run history is in-memory and clears when the broker restarts.",
    });
    return;
  }

  res.json({
    runId: run.runId,
    agentName: run.agentName,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    duration: run.durationMs,
    model: run.model ?? null,
    prompt: run.prompt,
    response: run.output ?? null,
    usage: run.usage ?? null,
    provenance: liveNow(),
  });
}));
