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
 * The APIM path the hosted-agent Responses API is published under —
 * `hostedAgentResponsesApiPath` in main.bicep, whose default the lab notebook
 * uses unchanged.
 */
export const HOSTED_AGENT_API_PATH = "hosted-agent-responses";

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
