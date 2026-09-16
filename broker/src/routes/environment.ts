import { Router } from "express";
import { config, hostedAgentUrlTemplate } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";

export const environmentRouter = Router();

/** Backs the header strip and the landing page's info cards — real resource count and region, not the documented 21 from ARCHITECTURE.md's manual inventory (which counts sub-resources this simple listing doesn't). */
environmentRouter.get("/environment", asyncHandler(async (_req, res) => {
  const token = await getAccessToken(SCOPES.arm);
  const url =
    `https://management.azure.com/subscriptions/${config.subscriptionId}` +
    `/resourceGroups/${config.resourceGroup}/resources?api-version=2021-04-01`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = response.ok
    ? ((await response.json()) as { value: { type?: string; sku?: { name?: string } }[] })
    : { value: [] };

  /**
   * The APIM tier actually deployed. The reference panel ("what else APIM
   * offers") compares tiers, and the row for the tier in use has to be marked
   * from real state rather than from a constant that would quietly go stale
   * the day someone changes tier.
   *
   * This used to be picked out of the resource listing above at no extra cost,
   * because the gateway lived in this lab's resource group. It does not any
   * more, so scanning that listing found nothing and the panel silently lost
   * its "you are here" marker. It is now a targeted read of the gateway
   * wherever it actually lives - one extra call, which is the price of the
   * gateway being shared.
   *
   * Left undefined when the read fails, so the panel says nothing rather than
   * guessing: a wrong "you are here" is worse than none.
   */
  let apimSku: string | undefined;
  try {
    const apimResponse = await fetch(
      `https://management.azure.com/subscriptions/${config.subscriptionId}` +
        `/resourceGroups/${config.apimResourceGroup}` +
        `/providers/Microsoft.ApiManagement/service/${config.apimServiceName}` +
        `?api-version=2022-08-01`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (apimResponse.ok) {
      apimSku = ((await apimResponse.json()) as { sku?: { name?: string } }).sku?.name;
    }
  } catch {
    // Reported as absent below, never as a guess.
  }

  res.json({
    region: config.region,
    resourceGroupName: config.resourceGroup,
    /**
     * null, not 0, when the listing was refused. A failed read used to fall
     * through to `{ value: [] }` and report 0 resources under a `live`
     * provenance - a number nobody measured, on the one screen element that
     * is always visible. The read this depends on is the one §4f found
     * missing its Reader grant, so this is a failure mode that has happened.
     */
    resourceCount: response.ok ? body.value.length : null,
    apimSku,
    /**
     * The address of a hosted agent, with the agent name left as a
     * placeholder. It is built by the same function the /ask and
     * /access-control-test routes call, so the URL the Gateway stop shows is
     * literally the URL this broker requests — the "one API serves N agents"
     * claim is then readable rather than asserted (README.md §Get Started).
     */
    agentRouteTemplate: hostedAgentUrlTemplate(),
    provenance: liveNow(),
  });
}));
