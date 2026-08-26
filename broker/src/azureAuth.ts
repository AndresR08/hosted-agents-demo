import { DefaultAzureCredential } from "@azure/identity";

/**
 * DefaultAzureCredential tries several credential sources in order; in this
 * environment (a presenter's or developer's own machine, already
 * `az login`'d) it resolves through AzureCliCredential. Nothing here is
 * bound to one identity type on purpose — the same code works unmodified
 * on a machine using a managed identity or a service principal instead.
 */
const credential = new DefaultAzureCredential();

const tokenCache = new Map<string, { token: string; expiresOnTimestamp: number }>();

/** Cached per-audience token — avoids a credential round-trip on every request. */
export async function getAccessToken(scope: string): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresOnTimestamp - Date.now() > 60_000) {
    return cached.token;
  }
  const result = await credential.getToken(scope);
  if (!result) throw new Error(`Failed to acquire a token for scope ${scope}`);
  tokenCache.set(scope, { token: result.token, expiresOnTimestamp: result.expiresOnTimestamp });
  return result.token;
}

export const SCOPES = {
  arm: "https://management.azure.com/.default",
  foundry: "https://ai.azure.com/.default",
  logAnalytics: "https://api.loganalytics.io/.default",
} as const;
