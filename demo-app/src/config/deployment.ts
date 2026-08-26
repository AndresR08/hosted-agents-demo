import { env } from "./env";

/**
 * Mirrors the 13 outputs of `main.bicep` (ARCHITECTURE.md §12). This is the
 * shape the broker process (../../../broker) returns after reading the
 * deployment outputs with `az deployment group show`.
 *
 * `apimSubscriptionKey` must never be logged, rendered in full, or sent
 * anywhere other than the broker — see DESIGN_DECISIONS.md (Access Control
 * masks it to the last four characters).
 */
export interface DeploymentOutputs {
  logAnalyticsWorkspaceId: string;
  apimServiceId: string;
  apimResourceGatewayUrl: string;
  apimSubscriptionKey: string;
  aiGatewayUrl: string;
  foundryProjectEndpoint: string;
  foundryAiServicesEndpoint: string;
  foundryAgentProjectEndpoint: string;
  foundryAgentAiServicesEndpoint: string;
  containerRegistryName: string;
  containerRegistryLoginServer: string;
  region: string;
  resourceGroupName: string;
}

/**
 * Placeholder loader. Returns config-derived stand-in values so the UI has
 * something to render during scaffolding — none of these are real Azure
 * resource identifiers. Replace with a call to the broker's
 * `/deployment-outputs` endpoint once that exists; do not point this at
 * Azure directly from the browser (see vite.config.ts).
 */
export async function loadDeploymentOutputs(): Promise<DeploymentOutputs> {
  return {
    logAnalyticsWorkspaceId: "PLACEHOLDER",
    apimServiceId: "PLACEHOLDER",
    apimResourceGatewayUrl: "PLACEHOLDER",
    apimSubscriptionKey: "PLACEHOLDER",
    aiGatewayUrl: "PLACEHOLDER",
    foundryProjectEndpoint: "PLACEHOLDER",
    foundryAiServicesEndpoint: "PLACEHOLDER",
    foundryAgentProjectEndpoint: "PLACEHOLDER",
    foundryAgentAiServicesEndpoint: "PLACEHOLDER",
    containerRegistryName: "PLACEHOLDER",
    containerRegistryLoginServer: "PLACEHOLDER",
    region: env.region,
    resourceGroupName: env.resourceGroupName,
  };
}
