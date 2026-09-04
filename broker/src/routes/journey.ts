import { Router } from "express";
import { config, HOSTED_AGENT_API_NAME, INFERENCE_API_NAME } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { getAsk } from "../askStore.js";
import { liveNow } from "../provenance.js";
import type { Provenance } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";

export const journeyRouter = Router();

/**
 * Priority 2 — real request progress.
 *
 * The five-hop *structure* is architectural fact (ARCHITECTURE.md §4.1) and
 * doesn't change per request, so it's always returned as "live" — it's a
 * true description of the deployed policies, not a guess. The *total* latency
 * is real, carried over from the matching /api/ask call.
 *
 * ─── Per-hop timing (added after the telemetry inventory) ────────────────
 *
 * This was previously documented as not implementable. That was wrong.
 * `ApiManagementGatewayLogs` records `TotalTime` and `BackendTime` for every
 * gateway call, and both hops of one interaction appear as separate rows:
 *
 *   ApiId = HOSTED_AGENT_API_NAME   hop 1, client → agent
 *   ApiId = INFERENCE_API_NAME      hop 2, agent → model
 *
 * Both are configurable because the move to the shared gateway renamed them;
 * a literal here would silently stop matching.
 *
 * They carry *different* CorrelationIds, so they are associated by timestamp
 * containment — hop 2 starts after hop 1 starts and ends before hop 1 ends.
 * That is an association, not a single measured transaction, and the response
 * says so in `correlationMethod` rather than implying a stitched trace.
 *
 * The number worth showing is `TotalTime − BackendTime`: API Management's own
 * processing cost, measured at 1–4 ms against multi-second requests. It is
 * the direct answer to "won't a gateway slow us down?".
 *
 * Ingestion lag is 1–3 minutes, so a request that just completed legitimately
 * has no hop timing yet. That returns `null` with a `live-delayed` band — never
 * an estimate.
 *
 * The same band now also covers a second case that used to slip through as a
 * confident number: during that window the nearest-in-time row can belong to a
 * *previous* invocation, because the ask's own row has not landed yet. A hop
 * that claims more gateway time than the whole request took is not ours, and is
 * rejected rather than displayed — see the containment invariant below.
 */

interface GatewayRow {
  TimeGenerated: string;
  ApiId: string;
  CorrelationId: string;
  TotalTime: number;
  BackendTime: number;
  ResponseCode: number;
  Url: string;
}

/**
 * Slack allowed on the containment invariant below. The gateway span is
 * *inside* the span the broker timed, so honest rows come in under the ask's
 * own total; this only absorbs clock skew and rounding between APIM's
 * `TotalTime` and the broker's stopwatch. Kept small on purpose — the failure
 * it guards against was 4.5 seconds wide, so a quarter second cannot hide it.
 */
const CONTAINMENT_TOLERANCE_MS = 250;

async function fetchHopTimings(
  agentName: string,
  timestamp: number,
  totalLatencyMs: number,
): Promise<{ hop1?: GatewayRow; hop2?: GatewayRow }> {
  const token = await getAccessToken(SCOPES.logAnalytics);
  const from = new Date(timestamp - 120_000).toISOString();
  const to = new Date(timestamp + 120_000).toISOString();

  const response = await fetch(
    `https://api.loganalytics.io/v1/workspaces/${config.logAnalyticsWorkspaceId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          `ApiManagementGatewayLogs ` +
          `| where TimeGenerated between (datetime(${from}) .. datetime(${to})) ` +
          `| project TimeGenerated, ApiId, CorrelationId, TotalTime, BackendTime, ResponseCode, Url`,
      }),
    },
  );
  if (!response.ok) return {};

  const body = (await response.json()) as {
    tables?: { columns: { name: string }[]; rows: unknown[][] }[];
  };
  const table = body.tables?.[0];
  if (!table) return {};
  const columns = table.columns.map((c) => c.name);
  const rows = table.rows.map(
    (r) => Object.fromEntries(r.map((v, i) => [columns[i], v])) as unknown as GatewayRow,
  );

  // Match hop 1 on the agent name in the URL, so a concurrent call to the
  // other agent in the same window can't be picked up by mistake.
  const hop1 = rows
    .filter((r) => r.ApiId === HOSTED_AGENT_API_NAME && r.Url?.includes(`/agents/${agentName}/`))
    .sort(
      (a, b) =>
        Math.abs(new Date(a.TimeGenerated).getTime() - timestamp) -
        Math.abs(new Date(b.TimeGenerated).getTime() - timestamp),
    )[0];

  if (!hop1) return {};

  /*
   * Containment invariant — the difference between "no number yet" and "the
   * wrong number, presented as this ask's".
   *
   * Nearest-in-time is a guess, and during the ingestion window it is a guess
   * made from an incomplete table. Observed 2026-09-03: an Agents → Run
   * invocation at 14:01:18 (TotalTime 17909) and a copilot ask at 14:02:40
   * (TotalTime 13384) both sat inside the ±120s window. The ask's own row had
   * not been ingested yet, so the only candidate was the *earlier, unrelated*
   * invocation — and it was returned as this ask's timing with
   * `available: true`. The console then showed 7 ms / 8.5 s / 14 ms / 9.4 s
   * for a request whose real figures were 1 ms / 6.0 s / 5 ms / 7.4 s.
   *
   * The tell was already in the payload: hop1 claimed 17.9s of gateway time
   * inside a request the broker had timed end to end at 13.5s. A gateway span
   * is contained by the client span that wraps it, so that is not a slow hop,
   * it is a different request. Checking it costs nothing and is the only
   * signal available before the correct row lands.
   *
   * Rejecting rather than searching on is deliberate. A violating row proves
   * this candidate is not ours; it says nothing about whether a better one
   * exists yet, and picking the next-nearest would just be a second guess
   * wearing the same false confidence. Returning empty puts the response on
   * the `live-delayed` band it already uses for "not ingested yet", which is
   * exactly what the situation is. §4.5: never an estimate, never a stand-in.
   */
  if (totalLatencyMs > 0 && hop1.TotalTime > totalLatencyMs + CONTAINMENT_TOLERANCE_MS) {
    return {};
  }

  const start = new Date(hop1.TimeGenerated).getTime();
  const end = start + hop1.TotalTime;
  const hop2 = rows
    .filter((r) => r.ApiId === INFERENCE_API_NAME)
    .find((r) => {
      const s = new Date(r.TimeGenerated).getTime();
      return s >= start && s + r.TotalTime <= end + 1000;
    });

  return { hop1, hop2 };
}

journeyRouter.get("/journey/:askId", asyncHandler(async (req, res) => {
  const record = getAsk(req.params.askId);
  const structureProvenance: Provenance = liveNow();
  const notYetAvailable: Provenance = { band: "live-delayed", ageSeconds: 0 };

  // The agent that actually served this ask. Named in the hop labels so the
  // journey visibly re-renders when the presenter switches agents — the path
  // is identical for both, which is precisely the point being demonstrated.
  const agentName = record?.agentName;
  const agentVersion = record?.agentVersion ?? "";
  const agentLabel = agentName ? `${agentName}${agentVersion}` : "Foundry Agent";

  let hop1: GatewayRow | undefined;
  let hop2: GatewayRow | undefined;
  if (record?.agentName) {
    try {
      ({ hop1, hop2 } = await fetchHopTimings(
        record.agentName,
        record.timestamp,
        record.totalLatencyMs,
      ));
    } catch {
      // Timing is an enhancement — the flow structure stands on its own.
    }
  }

  const timingProvenance: Provenance = hop1
    ? { band: "live-delayed", ageSeconds: Math.max(0, (Date.now() - new Date(hop1.TimeGenerated).getTime()) / 1000) }
    : notYetAvailable;

  res.json({
    askId: req.params.askId,
    totalLatencyMs: record?.totalLatencyMs ?? 0,
    agentName,
    agentVersion,
    provenance: record ? liveNow() : notYetAvailable,

    /**
     * Real gateway timing, once Log Analytics has ingested it. `null` until
     * then — the UI must render the flow without it rather than showing zero.
     */
    timings: {
      available: Boolean(hop1),
      hop1: hop1
        ? {
            label: "Client → API Management → Agent",
            totalMs: hop1.TotalTime,
            backendMs: hop1.BackendTime,
            gatewayOverheadMs: hop1.TotalTime - hop1.BackendTime,
            responseCode: hop1.ResponseCode,
            correlationId: hop1.CorrelationId,
          }
        : null,
      hop2: hop2
        ? {
            label: "Agent → API Management → gpt-5-mini",
            totalMs: hop2.TotalTime,
            backendMs: hop2.BackendTime,
            gatewayOverheadMs: hop2.TotalTime - hop2.BackendTime,
            responseCode: hop2.ResponseCode,
            correlationId: hop2.CorrelationId,
          }
        : null,
      /** Combined APIM processing cost across both hops — the headline figure. */
      totalGatewayOverheadMs:
        hop1 && hop2
          ? hop1.TotalTime - hop1.BackendTime + (hop2.TotalTime - hop2.BackendTime)
          : hop1
            ? hop1.TotalTime - hop1.BackendTime
            : null,
      correlationMethod: hop2
        ? "Hop 2 associated with hop 1 by timestamp containment — an association, not a single measured transaction."
        : null,
      source: "ApiManagementGatewayLogs (TotalTime, BackendTime)",
      provenance: timingProvenance,
    },

    hops: [
      {
        id: "client-apim",
        label: "Client → API Management",
        credentialFact: "api-key",
        provenance: structureProvenance,
      },
      {
        id: "apim-agent",
        label: `API Management → ${agentLabel}`,
        credentialFact: "managed-identity token · ai.azure.com",
        durationMs: hop1?.TotalTime,
        provenance: structureProvenance,
      },
      {
        id: "agent-apim",
        label: `${agentLabel} → API Management`,
        credentialFact: "api-key (APIM_SUBSCRIPTION_KEY)",
        provenance: structureProvenance,
      },
      {
        id: "apim-model",
        label: "API Management → gpt-5-mini",
        credentialFact: "managed-identity token · cognitiveservices.azure.com",
        durationMs: hop2?.TotalTime,
        provenance: structureProvenance,
      },
      {
        id: "model",
        label: "gpt-5-mini",
        credentialFact: "Foundry model deployment",
        derived: false,
        provenance: structureProvenance,
      },
    ],
  });
}));
