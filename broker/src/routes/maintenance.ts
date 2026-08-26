import { Router } from "express";
import { config } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { clearManifestCache } from "./agents.js";

export const maintenanceRouter = Router();

/**
 * Presenter maintenance actions — the pre-flight checklist
 * (PRESENTATION_FLOW.md §2) made executable from inside the application
 * instead of a terminal.
 *
 * Every handler returns the same envelope: { ok, detail, elapsedMs }. The UI
 * renders Running / Completed / Failed from `ok` and shows `elapsedMs`, so a
 * presenter can see at a glance whether the environment is warm before the
 * room fills up.
 *
 * These are diagnostics, not new capability: each one exercises a path the
 * demo already uses. Nothing here changes Azure configuration — every call is
 * a read or a throwaway agent invocation.
 */

interface ActionResult {
  ok: boolean;
  detail: string;
  elapsedMs: number;
}

async function timed(fn: () => Promise<string>): Promise<ActionResult> {
  const started = Date.now();
  try {
    const detail = await fn();
    return { ok: true, detail, elapsedMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Unknown error",
      elapsedMs: Date.now() - started,
    };
  }
}

/** Liveness of the broker itself — the one action that never touches Azure. */
maintenanceRouter.get("/maintenance/ping", asyncHandler(async (_req, res) => {
  res.json(await timed(async () => `Broker responding on port ${config.port}`));
}));

/**
 * Sends a real, throwaway question through the full APIM → agent → APIM →
 * model path. This is the documented mitigation for the single largest live
 * risk in the lab: Foundry hosted-agent cold start (measured at 10–17s).
 */
maintenanceRouter.post("/maintenance/warm-agent", asyncHandler(async (req, res) => {
  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : "pydantic-agent";
  res.json(
    await timed(async () => {
      const url = `${config.apimGatewayUrl}/hosted-agent-responses/agents/${encodeURIComponent(agentName)}/endpoint/protocols/openai/responses?api-version=v1`;
      const started = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: { "api-key": config.apimSubscriptionKey, "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Reply with the single word: ready.", stream: false }),
      });
      if (!response.ok) throw new Error(`${agentName} returned HTTP ${response.status}`);
      const roundTrip = Date.now() - started;
      const state = roundTrip > 8000 ? "was cold, now warm" : "already warm";
      return `${agentName} ${state} — ${roundTrip} ms round trip`;
    }),
  );
}));

/** Same path as Warm Agent but reported as a pass/fail check rather than a warm-up. */
maintenanceRouter.post("/maintenance/test-hosted-agent", asyncHandler(async (req, res) => {
  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : "pydantic-agent";
  res.json(
    await timed(async () => {
      const url = `${config.apimGatewayUrl}/hosted-agent-responses/agents/${encodeURIComponent(agentName)}/endpoint/protocols/openai/responses?api-version=v1`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "api-key": config.apimSubscriptionKey, "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Reply with the single word: ok.", stream: false }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${agentName}`);
      const body = (await response.json()) as { agent_reference?: { name?: string; version?: string } };
      const ref = body.agent_reference;
      return ref?.name
        ? `HTTP 200 — answered by ${ref.name}:${ref.version ?? "?"}`
        : `HTTP 200 from ${agentName}`;
    }),
  );
}));

/**
 * Confirms APIM is enforcing subscription keys — deliberately calls *without*
 * a key and expects a 401. A 200 here would mean the gateway is not enforcing,
 * which is a finding, not a pass.
 */
maintenanceRouter.post("/maintenance/test-apim", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      const url = `${config.apimGatewayUrl}/hosted-agent-responses/agents/pydantic-agent/endpoint/protocols/openai/responses?api-version=v1`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "probe", stream: false }),
      });
      if (response.status === 401) return "Gateway reachable — 401 without a subscription key, as expected";
      throw new Error(`Expected 401 without a key, got HTTP ${response.status}`);
    }),
  );
}));

/** ARM resource inventory — the header's environment strip. */
maintenanceRouter.post("/maintenance/refresh-azure-status", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      const token = await getAccessToken(SCOPES.arm);
      const response = await fetch(
        `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}/resources?api-version=2021-04-01`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(`ARM returned HTTP ${response.status}`);
      const body = (await response.json()) as { value: unknown[] };
      return `${body.value.length} resources in ${config.resourceGroup} (${config.region})`;
    }),
  );
}));

/** Log Analytics reachability plus how far behind ingestion currently is. */
maintenanceRouter.post("/maintenance/reload-audit-logs", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      const token = await getAccessToken(SCOPES.logAnalytics);
      const response = await fetch(
        `https://api.loganalytics.io/v1/workspaces/${config.logAnalyticsWorkspaceId}/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "ApiManagementGatewayLlmLog | order by TimeGenerated desc | take 1 | project TimeGenerated",
          }),
        },
      );
      if (!response.ok) throw new Error(`Log Analytics returned HTTP ${response.status}`);
      const body = (await response.json()) as { tables: { rows: unknown[][] }[] };
      const row = body.tables?.[0]?.rows?.[0];
      if (!row) return "Query succeeded — no rows in ApiManagementGatewayLlmLog yet";
      const ageSeconds = Math.round((Date.now() - new Date(String(row[0])).getTime()) / 1000);
      return `Latest logged call is ${ageSeconds}s old (1–3 min ingestion lag is normal)`;
    }),
  );
}));

/** Re-fetches both live policy documents from ARM — the Beat 4 reveal. */
maintenanceRouter.post("/maintenance/reload-policies", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      const token = await getAccessToken(SCOPES.arm);
      const apis = ["hosted-agent-responses-api", "inference-api"];
      const sizes: string[] = [];
      for (const api of apis) {
        const response = await fetch(
          `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}` +
            `/providers/Microsoft.ApiManagement/service/${config.apimServiceName}/apis/${api}` +
            `/policies/policy?api-version=2022-08-01&format=xml`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) throw new Error(`${api} policy returned HTTP ${response.status}`);
        // With format=xml ARM returns the policy document itself, not JSON —
        // and with a leading UTF-8 BOM. Same handling as routes/policy.ts.
        const xml = (await response.text()).replace(/^﻿/, "");
        sizes.push(`${api} (${xml.length} chars)`);
      }
      return `Fetched ${sizes.join(", ")}`;
    }),
  );
}));

/**
 * Drops the 5-minute ACR manifest cache and re-reads the Foundry registry, so
 * an agent registered mid-session appears without restarting the broker.
 */
maintenanceRouter.post("/maintenance/refresh-agent-registry", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      clearManifestCache();
      const token = await getAccessToken(SCOPES.foundry);
      const response = await fetch(`${config.foundryAgentsProjectEndpoint}/agents?api-version=v1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Foundry returned HTTP ${response.status}`);
      const body = (await response.json()) as {
        data: { name: string; versions: { latest: { version: string } } }[];
      };
      const names = body.data.map((a) => `${a.name}:${a.versions.latest.version}`);
      return names.length ? `${names.length} registered — ${names.join(", ")}` : "No agents registered";
    }),
  );
}));

/** The deployment context the presenter may be asked to confirm out loud. */
maintenanceRouter.post("/maintenance/refresh-deployment-info", asyncHandler(async (_req, res) => {
  res.json(
    await timed(async () => {
      const token = await getAccessToken(SCOPES.arm);
      const response = await fetch(
        `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}` +
          `/providers/Microsoft.ApiManagement/service/${config.apimServiceName}?api-version=2022-08-01`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(`ARM returned HTTP ${response.status}`);
      const body = (await response.json()) as {
        sku?: { name?: string };
        location?: string;
        properties?: { gatewayUrl?: string };
      };
      return `${config.apimServiceName} · ${body.sku?.name ?? "?"} · ${body.location ?? config.region} · ${body.properties?.gatewayUrl ?? config.apimGatewayUrl}`;
    }),
  );
}));
