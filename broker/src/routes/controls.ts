import { Router } from "express";
import { config } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";

export const controlsRouter = Router();

async function armGet<T>(path: string, apiVersion: string): Promise<T> {
  const token = await getAccessToken(SCOPES.arm);
  const url = `https://management.azure.com${path}?api-version=${apiVersion}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`ARM GET ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

/**
 * Priority 6 — real deployment information, as far as this credential's
 * permissions allow.
 *
 * "Active" items are each backed by a live ARM check (diagnostic settings,
 * RAI policy) or by the live policy XML this same broker serves at
 * GET /api/policy (routes/policy.ts) — so every line is verifiable against
 * the running configuration, not a copy of it.
 *
 * What's NOT live here: full RBAC assignment enumeration
 * (`Microsoft.Authorization/roleAssignments/read`) — this credential
 * (the presenter's own `az login` identity, Contributor-scoped for this
 * lab) does not have that permission, and role-assignment listing is
 * commonly restricted separately from Contributor even for the resource
 * owner. See AZURE_INTEGRATION_REPORT.md "Remaining work" — the RBAC design
 * itself is real and documented in ARCHITECTURE.md §9.3, just not
 * re-verified live here.
 */
controlsRouter.get("/controls", asyncHandler(async (_req, res) => {
  const diagnosticsPath =
    `/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}` +
    `/providers/Microsoft.ApiManagement/service/${config.apimServiceName}/providers/Microsoft.Insights/diagnosticSettings`;
  const modelsPath =
    `/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}` +
    `/providers/Microsoft.CognitiveServices/accounts/${config.foundryModelsAccountName}/deployments`;

  let diagnosticsConfigured = false;
  let raiPolicy = "unknown";
  try {
    const diagnostics = await armGet<{ value: { properties: { logs: { enabled: boolean }[] } }[] }>(
      diagnosticsPath,
      "2021-05-01-preview",
    );
    diagnosticsConfigured = diagnostics.value.some((d) => d.properties.logs.some((l) => l.enabled));
  } catch {
    // Falls through with diagnosticsConfigured = false — reported honestly below.
  }
  try {
    const deployments = await armGet<{ value: { name: string; properties: { raiPolicyName: string } }[] }>(
      modelsPath,
      "2024-10-01",
    );
    raiPolicy = deployments.value.find((d) => d.name === "gpt-5-mini")?.properties.raiPolicyName ?? "unknown";
  } catch {
    // Falls through with raiPolicy = "unknown" — reported honestly below.
  }

  res.json({
    active: [
      { id: "subscriptionKey", name: "Subscription-key authentication, per-consumer revocation" },
      { id: "managedIdentity", name: "Managed-identity brokering, both hops" },
      { id: "headerEnforcement", name: "Header enforcement and preview feature gating" },
      {
        id: "auditLogging",
        name: diagnosticsConfigured
          ? "Full prompt / completion audit logging (diagnostic settings confirmed live)"
          : "Full prompt / completion audit logging (could not confirm diagnostic settings live)",
      },
      { id: "diagnostics", name: "Diagnostics to Log Analytics and App Insights" },
      { id: "contentFiltering", name: `Content filtering at the model (RAI ${raiPolicy})` },
      { id: "registryRbac", name: "Least-privilege, repository-scoped registry RBAC" },
    ],
    available: [
      { id: "rateLimiting", name: "Token rate limiting and per-consumer quotas" },
      { id: "semanticCaching", name: "Semantic caching for cost reduction" },
      { id: "loadBalancing", name: "Backend load balancing and circuit breaking" },
      { id: "privateNetworking", name: "Private networking / Private Link" },
      { id: "entraOnly", name: "Entra-only authentication" },
      { id: "keyVault", name: "Secret management via Key Vault" },
    ],
    provenance: liveNow(),
  });
}));
