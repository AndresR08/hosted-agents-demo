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
  const body = response.ok ? ((await response.json()) as { value: unknown[] }) : { value: [] };

  res.json({
    region: config.region,
    resourceGroupName: config.resourceGroup,
    resourceCount: body.value.length,
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
