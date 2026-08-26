import { Router } from "express";
import { liveNow } from "../provenance.js";
import { recordAsk } from "../askStore.js";
import { asyncHandler } from "../asyncHandler.js";
import { buildAugmentedPrompt, buildProbePrompt } from "../demoKnowledge.js";
import { getAgentFacts } from "../foundryAgents.js";
import { invokeHostedAgent } from "../agentInvocation.js";
import { recordRun } from "../runStore.js";

export const askRouter = Router();

/**
 * Priority 1 — real conversation. Calls the exact path documented in
 * ARCHITECTURE.md §4.1 step 1: client → APIM (subscription key) → Foundry
 * hosted agent → APIM (managed identity) → gpt-5-mini. The agent's own
 * outbound call to APIM happens entirely inside Azure; this handler only
 * makes the first hop and reads back the finished response.
 *
 * The prompt is augmented with local demo knowledge before it leaves
 * (see demoKnowledge.ts) so questions about this architecture are answered
 * from this deployment's facts rather than the model's general beliefs about
 * Azure. The call itself is unchanged: same URL, same credential, same real
 * round trip — only the text of the question is enriched.
 *
 * `skipKnowledge` turns that augmentation off, and exists for exactly one
 * caller: the Framework Experience panel's capability probe, which asks both
 * agents the same question in order to see how the two *containers* differ.
 * Injecting the same reference facts into both would make them answer from
 * identical borrowed text and destroy the very difference being demonstrated.
 * The style directive still applies, so both answer in the same voice — what
 * is withheld is the shared context, not the framing.
 */
askRouter.post("/ask", asyncHandler(async (req, res) => {
  const { prompt, agentName, skipKnowledge } = req.body as {
    prompt?: string;
    agentName?: string;
    skipKnowledge?: boolean;
  };
  if (!prompt || !agentName) {
    res.status(400).json({ error: "prompt and agentName are required" });
    return;
  }

  const { prompt: augmentedPrompt, matchedEntryIds } = skipKnowledge
    ? { prompt: buildProbePrompt(prompt), matchedEntryIds: [] as string[] }
    : buildAugmentedPrompt(prompt);

  /**
   * Which container is about to answer, read from the registry alongside the
   * call rather than after it. Every answer is stamped with its framework and
   * image so the room can see that a specific container they built produced
   * it — the Act 1 recognition in ARCHITECTURE.md
   * Best-effort by design: a registry read that fails must never cost the
   * presenter the answer itself.
   */
  const factsPromise = getAgentFacts(agentName).catch(() => null);

  // Wall-clock start/end around the call, purely for the Run record below —
  // separate from Foundry's own created_at/completed_at (seconds, server-side).
  const startedAt = new Date();
  const result = await invokeHostedAgent(agentName, augmentedPrompt);
  const finishedAt = new Date();
  // Same selection Foundry-id-first, fresh-UUID-fallback either way: on
  // success this becomes askId (unchanged from before); on failure it only
  // ever backs the Run record, since a failed ask never had an askId.
  const runId = result.ok ? (result.id ?? crypto.randomUUID()) : crypto.randomUUID();

  if (!result.ok) {
    recordRun({
      runId,
      agentName,
      status: result.timedOut ? "timeout" : "failed",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: result.latencyMs,
      prompt: augmentedPrompt,
      httpStatus: result.httpStatus,
      errorDetail: result.detail,
    });
    res
      .status(result.httpStatus)
      .json({ error: "Agent invocation failed", detail: result.detail, httpStatus: result.httpStatus });
    return;
  }

  const askId = runId;
  const facts = await factsPromise;
  // The response's own agent_reference is the most authoritative statement of
  // which version answered; the registry is the fallback when the protocol
  // omits it.
  const agentVersion = result.agentVersion ?? (facts?.version ?? "");
  const status = result.status ?? "completed";

  // The *augmented* prompt is stored, not the user's original: that is the
  // text APIM actually saw and therefore the text that will appear in
  // ApiManagementGatewayLlmLog, which is what the audit record matches on.
  recordAsk({
    askId,
    totalLatencyMs: result.latencyMs,
    timestamp: Date.now(),
    agentName,
    agentVersion,
    prompt: augmentedPrompt,
    answerText: result.outputText,
    httpStatus: result.httpStatus,
    traceId: result.traceId,
    apimRequestId: result.apimRequestId,
    sessionId: result.sessionId,
    region: result.region,
    servedByCluster: result.servedByCluster,
    platformServer: result.platformServer,
    createdAt: result.createdAt,
    completedAt: result.completedAt,
    knowledgeApplied: matchedEntryIds,
  });

  recordRun({
    runId,
    agentName,
    agentVersion,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: result.latencyMs,
    prompt: augmentedPrompt,
    output: result.outputText,
    usage: result.usage,
    model: result.model,
    httpStatus: result.httpStatus,
  });

  res.json({
    askId,
    answerText: result.outputText,
    agentName,
    agentVersion,
    latencyMs: result.latencyMs,
    httpStatus: result.httpStatus,
    /** The framework and container behind this specific answer — undefined if the registry read failed. */
    framework: facts?.framework,
    containerImage: facts?.imageUri,
    /** Which knowledge-base entries informed this answer; empty when none matched. */
    knowledgeApplied: matchedEntryIds,
    provenance: liveNow(),
  });
}));
