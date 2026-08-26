import { Router } from "express";
import { config, hostedAgentUrl } from "../config.js";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";

export const accessControlRouter = Router();

const PROBE_BODY = JSON.stringify({ input: "ping", stream: false });
const DEFAULT_AGENT = "pydantic-agent";

function classify(status: number): "success" | "rejected" {
  return status >= 200 && status < 300 ? "success" : "rejected";
}

/**
 * Priority 4 — real Access Control. Three genuine HTTPS requests, exactly
 * as scripted in PRESENTATION_FLOW.md Beat 4 — nothing here is a canned
 * status code. Uses `pydantic-agent`, the one agent actually registered in
 * this deployment (see routes/agents.ts).
 */
accessControlRouter.post("/access-control-test", asyncHandler(async (_req, res) => {
  const gatewayUrl = hostedAgentUrl(DEFAULT_AGENT);
  const directFoundryUrl = `${config.foundryAgentsProjectEndpoint}/agents/${DEFAULT_AGENT}/endpoint/protocols/openai/responses?api-version=v1`;

  const [withKey, withoutKey, direct] = await Promise.all([
    fetch(gatewayUrl, {
      method: "POST",
      headers: { "api-key": config.apimSubscriptionKey, "Content-Type": "application/json" },
      body: PROBE_BODY,
    }),
    fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: PROBE_BODY,
    }),
    fetch(directFoundryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: PROBE_BODY,
    }),
  ]);

  res.json({
    attempts: [
      {
        id: "with-subscription-key",
        credentialPresented: "Subscription key",
        httpStatus: withKey.status,
        outcome: classify(withKey.status),
      },
      {
        id: "without-subscription-key",
        credentialPresented: "(none)",
        httpStatus: withoutKey.status,
        outcome: classify(withoutKey.status),
      },
      {
        id: "direct-to-foundry",
        credentialPresented: "Direct to Foundry, no Entra token",
        httpStatus: direct.status,
        outcome: classify(direct.status),
      },
    ],
    provenance: liveNow(),
  });
}));
