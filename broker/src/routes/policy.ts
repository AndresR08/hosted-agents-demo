import { Router } from "express";
import { config } from "../config.js";
import { getAccessToken, SCOPES } from "../azureAuth.js";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";
import { HOSTED_AGENT_API_NAME, INFERENCE_API_NAME } from "../config.js";

export const policyRouter = Router();

/*
 * The console asks for a policy by a STABLE key; the value is the API's real
 * name on the gateway, which changed when this lab moved to the shared one
 * (names have to be lab-prefixed there). Keeping the key stable means the
 * frontend never has to know the deployed name.
 */
const API_IDS: Record<string, string> = {
  "hosted-agent-responses-api": HOSTED_AGENT_API_NAME,
  "inference-api": INFERENCE_API_NAME,
};

/**
 * Priority 4 — real APIM policy. Pulled from ARM at request time, not from
 * a copy of the .xml file in the repo — if someone edits the policy in the
 * portal five minutes before a demo, this reflects that change.
 */
policyRouter.get("/policy/:apiName", asyncHandler(async (req, res) => {
  const apiId = API_IDS[req.params.apiName as keyof typeof API_IDS];
  if (!apiId) {
    res.status(400).json({ error: `Unknown apiName: ${req.params.apiName}` });
    return;
  }

  const token = await getAccessToken(SCOPES.arm);
  const url =
    `https://management.azure.com/subscriptions/${config.subscriptionId}` +
    `/resourceGroups/${config.resourceGroup}/providers/Microsoft.ApiManagement/service/${config.apimServiceName}` +
    `/apis/${apiId}/policies/policy?api-version=2022-08-01&format=xml`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    res.status(response.status).json({ error: "Failed to fetch policy from ARM" });
    return;
  }

  // ARM returns the XML with a leading UTF-8 BOM.
  const xml = (await response.text()).replace(/^﻿/, "");

  res.json({ apiName: req.params.apiName, xml, provenance: liveNow() });
}));
