import { Router } from "express";
import { config } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { delayed } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";
import { findAskByPrompt } from "../askStore.js";
import {
  extractCompletion,
  extractLastUserMessage,
  extractQuestion,
  isCaptured,
} from "../llmLog.js";

export const auditRecordRouter = Router();

interface LlmLogRow {
  TimeGenerated: string;
  ModelName: string;
  DeploymentName: string;
  RequestMessages: string | null;
  ResponseMessages: string | null;
}

/**
 * Priority 5 — real telemetry. Queries `ApiManagementGatewayLlmLog`
 * directly (DESIGN_DECISIONS.md) — the same table and the same
 * known caveat: 1–3 minutes of ingestion lag, so a question asked seconds
 * ago will not appear yet. `subscriptionName` is filled from this
 * deployment's one real APIM subscription (`subscription1` — see
 * main.bicep `apimSubscriptionsConfig`) since the table itself doesn't
 * carry it; `modelName` falls back to the known deployment name only when
 * the column comes back empty, which it does for hosted-agent traffic.
 * Neither is invented — both are real, static facts about this deployment.
 */
auditRecordRouter.get("/audit-record", asyncHandler(async (req, res) => {
  const wantedAgent = typeof req.query.agentName === "string" ? req.query.agentName : undefined;
  const token = await getAccessToken(SCOPES.logAnalytics);
  // Take a window rather than a single row: attribution below scans it for a
  // row whose prompt we can genuinely tie to the requested agent. 25 covers a
  // demo session comfortably without making the query expensive.
  const query =
    "ApiManagementGatewayLlmLog | order by TimeGenerated desc | take 25 " +
    "| project TimeGenerated, ModelName, DeploymentName, RequestMessages, ResponseMessages";

  const response = await fetch(
    `https://api.loganalytics.io/v1/workspaces/${config.logAnalyticsWorkspaceId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    res.status(response.status).json({ error: "Log Analytics query failed" });
    return;
  }

  const body = (await response.json()) as {
    tables: { columns: { name: string }[]; rows: unknown[][] }[];
  };
  const table = body.tables?.[0];
  if (!table || table.rows.length === 0) {
    // Honest empty state — DESIGN_DECISIONS.md's documented fallback path.
    // The frontend is responsible for saying so rather than inventing a record.
    res.json(null);
    return;
  }

  const columns = table.columns.map((c) => c.name);
  const rows = table.rows.map(
    (row) => Object.fromEntries(row.map((value, i) => [columns[i], value])) as unknown as LlmLogRow,
  );

  /**
   * APIM writes one interaction as TWO rows sharing a TimeGenerated: one
   * carrying `RequestMessages` with `ResponseMessages` null, and one the other
   * way round. Reading a single row therefore always yields a prompt with no
   * completion, or a completion with no prompt — which is why the completion
   * previously appeared to be "not captured at the gateway". It is captured;
   * it just lives in the sibling row. Pairing them by timestamp recovers the
   * full interaction, which is the artefact the compliance story actually
   * needs (PRESENTATION_FLOW.md Beat 6).
   */
  const byTimestamp = new Map<string, { row: LlmLogRow; prompt: string; completion: string }>();
  for (const row of rows) {
    const key = row.TimeGenerated;
    const existing = byTimestamp.get(key);
    const prompt = extractLastUserMessage(row.RequestMessages);
    const completion = extractCompletion(row.ResponseMessages);
    byTimestamp.set(key, {
      row: existing?.row ?? row,
      // Keep whichever half of the pair actually carried content.
      prompt: isCaptured(existing?.prompt) ? existing!.prompt : prompt,
      completion: isCaptured(existing?.completion) ? existing!.completion : completion,
    });
  }
  const interactions = [...byTimestamp.values()].sort(
    (a, b) => new Date(b.row.TimeGenerated).getTime() - new Date(a.row.TimeGenerated).getTime(),
  );

  /**
   * Agent attribution, done honestly.
   *
   * `ApiManagementGatewayLlmLog` has no agent column — the model call it logs
   * happens on the *second* hop, by which point the request is just traffic to
   * gpt-5-mini. So the only truthful way to say "this row came from
   * strands-agent" is to recognise the prompt as one we sent to that agent in
   * this session (askStore). No match means no attribution: the row is still
   * returned, with agentName left undefined, and the UI says so.
   */
  const decorated = interactions.map((entry) => ({
    ...entry,
    ask: findAskByPrompt(entry.prompt),
  }));

  /**
   * Selection order. Every candidate is a real logged row — this only decides
   * which real row is the most useful one to show:
   *
   *   1. attributable to the requested agent AND complete (prompt + completion)
   *   2. attributable to the requested agent
   *   3. complete
   *   4. newest
   *
   * Completeness outranks recency because the request and response halves of an
   * interaction ingest a few seconds apart, so the very newest interaction is
   * often still missing its completion. A whole record from ninety seconds ago
   * makes the compliance point; a half-ingested one from thirty does not. The
   * 30-second poll picks up the newer record once its other half lands.
   */
  const forAgent = wantedAgent
    ? decorated.filter((d) => d.ask?.agentName === wantedAgent)
    : [];
  const chosen =
    forAgent.find((d) => isCaptured(d.completion) && isCaptured(d.prompt)) ??
    forAgent[0] ??
    decorated.find((d) => isCaptured(d.completion) && isCaptured(d.prompt)) ??
    decorated[0];

  const { row: raw, prompt, completion, ask } = chosen;
  const ageSeconds = Math.max(0, (Date.now() - new Date(raw.TimeGenerated).getTime()) / 1000);
  const question = extractQuestion(prompt);

  res.json({
    timestamp: raw.TimeGenerated,
    subscriptionName: "subscription1",
    agentName: ask?.agentName,
    agentVersion: ask?.agentVersion,
    /** True when this row could not be tied to a known ask — the UI must not imply attribution. */
    attributionAvailable: Boolean(ask),
    /** Echoes what was asked for, so the UI can say "no record yet for this agent". */
    requestedAgentName: wantedAgent,
    modelName: raw.ModelName || raw.DeploymentName || "gpt-5-mini",
    /**
     * The question as the presenter typed it, for display. When the broker
     * injected demo knowledge (demoKnowledge.ts) the logged prompt also
     * contains that preamble — `promptFull` below is what the gateway actually
     * captured, verbatim, and remains the authoritative audit artefact.
     */
    prompt: question ?? prompt,
    promptFull: prompt,
    /** True when the logged prompt contains injected reference context. */
    contextInjected: question !== null,
    completion,
    provenance: delayed(ageSeconds),
  });
}));

