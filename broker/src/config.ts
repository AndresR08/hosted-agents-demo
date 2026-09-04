import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  // App Service injects PORT; locally it falls back to the documented 4000.
  port: Number(process.env.PORT ?? 4000),
  /**
   * A single origin. `cors({ origin })` below treats a string as one origin
   * and echoes it verbatim, so a comma-separated value produces a header no
   * browser accepts - and the preflight still answers 204, so it only fails
   * in a real browser. See broker/.env.example. Accepting a list would mean
   * splitting this into an array here.
   */
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  /**
   * Directory holding the built frontend (demo-app/dist). When it exists, the
   * broker also serves the console, so browser and API share one origin and
   * CORS never enters the picture — this is how the App Service deployment
   * runs (see labs/.../scripts/modules/AppService.ps1). Absent locally, where
   * the Vite dev server serves the app instead; the broker then only exposes
   * /api and the CORS_ORIGIN above is what makes that work.
   */
  publicDir: process.env.PUBLIC_DIR ?? "",

  subscriptionId: required("AZURE_SUBSCRIPTION_ID"),
  resourceGroup: required("AZURE_RESOURCE_GROUP"),
  region: process.env.AZURE_REGION ?? "swedencentral",

  apimGatewayUrl: required("APIM_GATEWAY_URL"),
  apimServiceName: required("APIM_SERVICE_NAME"),
  apimSubscriptionKey: required("APIM_SUBSCRIPTION_KEY"),
  foundryAgentsProjectEndpoint: required("FOUNDRY_AGENTS_PROJECT_ENDPOINT"),
  foundryModelsAccountName: required("FOUNDRY_MODELS_ACCOUNT_NAME"),
  logAnalyticsWorkspaceId: required("LOG_ANALYTICS_WORKSPACE_ID"),
  containerRegistryName: required("CONTAINER_REGISTRY_NAME"),

  /**
   * Ceiling on one hosted-agent invocation (ask or invoke) before the broker
   * gives up and reports a timeout rather than hanging on a stuck upstream
   * call. Overridable so verification can force a real, fast timeout without
   * waiting out the default. No prior code path had a timeout at all.
   */
  agentInvokeTimeoutMs: Number(process.env.AGENT_INVOKE_TIMEOUT_MS ?? 60_000),
};

/**
 * The APIM path the hosted-agent Responses API is published under.
 *
 * Configurable rather than constant, and the reason is a scar. The lab moved
 * from its own API Management instance to a gateway shared with other teams,
 * where every name has to be prefixed per lab, so this path changed from
 * `hosted-agent-responses` to `hosted-agents-responses`. Three separate places
 * held their own copy of it: the deployment config, the deploy script's
 * verification step, and this file. The first two were found by a 404 during
 * deployment; this one survived to produce a 404 in production, from a console
 * that had otherwise deployed perfectly.
 *
 * deploy.ps1 now sets HOSTED_AGENT_API_PATH from config/lab.defaults.psd1, so
 * there is one source of truth and the fallback below only applies to a local
 * `npm run dev` against a gateway that still uses the old path.
 */
export const HOSTED_AGENT_API_PATH =
  process.env.HOSTED_AGENT_API_PATH ?? "hosted-agents-responses";

/**
 * The API Management API *names* (ApiId in the gateway logs), as opposed to the
 * path above.
 *
 * These are not cosmetic. `ApiManagementGatewayLogs.ApiId` carries the API name,
 * and both /api/journey and /api/observability select their hops by comparing
 * against it — so a stale name here does not produce an error, it produces a
 * screen that waits forever for telemetry that is arriving under a different
 * label. Renaming the APIs for the shared gateway silently broke exactly that,
 * after the deployment itself had gone green.
 *
 * Set by deploy.ps1 from config/lab.defaults.psd1.
 */
export const HOSTED_AGENT_API_NAME =
  process.env.HOSTED_AGENT_API_NAME ?? "hosted-agents-responses-api";

export const INFERENCE_API_NAME =
  process.env.INFERENCE_API_NAME ?? "hosted-agents-inference-api";

/**
 * The one place that knows how a hosted agent is addressed.
 *
 * The shape is the lab's own, from README.md §Get Started and
 * `src/frameworks/README.md` §"Important: Foundry Hosted Agent URL Format":
 * the agent name is a path segment, which is why one APIM API serves any
 * number of agents without reconfiguration.
 *
 * Every caller that reaches an agent goes through here, and so does the
 * template the UI displays — so the URL shown to a customer cannot drift from
 * the URL actually called.
 */
export function hostedAgentUrl(agentName: string): string {
  return (
    `${config.apimGatewayUrl}/${HOSTED_AGENT_API_PATH}` +
    `/agents/${encodeURIComponent(agentName)}/endpoint/protocols/openai/responses?api-version=v1`
  );
}

/** The same URL with `{agentName}` left in place, for display. */
export function hostedAgentUrlTemplate(): string {
  return hostedAgentUrl("{agentName}").replace("%7BagentName%7D", "{agentName}");
}
