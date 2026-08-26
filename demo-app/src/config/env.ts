/**
 * Typed, validated read of build-time environment variables. Nothing else in
 * the app should touch `import.meta.env` directly — import from here so
 * there is exactly one place that knows the variable names and defaults.
 */

export type DemoMode = "live" | "replay";

export interface AppEnv {
  /**
   * Base URL of the broker process (../../../broker). See vite.config.ts.
   * Empty (built from `VITE_BROKER_BASE_URL=/`) means same origin — the
   * broker is serving this bundle, which is how the App Service deployment
   * runs.
   */
  brokerBaseUrl: string;
  /**
   * Demo mode the app boots into. "live" (shown in the UI as "Azure Live")
   * reads the real deployment through the broker, and is the mode the demo is
   * built for. "replay" (shown as "Simulation") is a placeholder scaffold, not
   * a working offline demo — see services/simulation/simulationService.ts.
   */
  defaultMode: DemoMode;
  region: string;
  resourceGroupName: string;
}

function readMode(value: string | undefined): DemoMode {
  return value === "replay" ? "replay" : "live";
}

/**
 * Trailing slashes are stripped, which is what makes `VITE_BROKER_BASE_URL=/`
 * mean *same origin*: it collapses to "", so every request below becomes a
 * relative `/api/...`. That is the value the App Service build uses, where
 * the broker serves this bundle itself and no absolute broker URL should ever
 * be baked into the browser bundle.
 *
 * `/` rather than an empty string because an empty environment variable is
 * indistinguishable from an unset one on Windows, so Vite would fall through
 * to the localhost default and the deployed console would call a broker that
 * isn't there.
 */
function readBrokerBaseUrl(value: string | undefined): string {
  if (!value) return "http://localhost:4000";
  return value.replace(/\/+$/, "");
}

export const env: AppEnv = {
  brokerBaseUrl: readBrokerBaseUrl(import.meta.env.VITE_BROKER_BASE_URL),
  defaultMode: readMode(import.meta.env.VITE_DEFAULT_MODE),
  region: import.meta.env.VITE_REGION || "swedencentral",
  resourceGroupName:
    import.meta.env.VITE_RESOURCE_GROUP_NAME ||
    "lab-ai-foundry-hosted-agents-custom-framework",
};
