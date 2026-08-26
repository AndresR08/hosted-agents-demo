import { getAccessToken, SCOPES } from "./azureAuth.js";

/**
 * ACR manifest metadata over plain REST.
 *
 * This replaces the previous `az acr manifest list-metadata` shell-out
 * (azCli.ts). The Azure CLI is not present in the App Service Linux Node
 * image, so a broker deployed there could never resolve an image digest —
 * the call would fail on every request and the Framework Experience panel
 * would permanently show "unavailable" for the two fields that make the
 * provenance claim concrete.
 *
 * ACR's data plane has its own OAuth2 token exchange rather than accepting
 * an ARM bearer token directly. The three steps below are exactly what the
 * CLI does internally, documented under "Authenticate with an Azure
 * container registry" / the ACR token API:
 *
 *   1. ARM token for the signed-in identity (managed identity in Azure,
 *      az login locally — DefaultAzureCredential resolves both).
 *   2. POST /oauth2/exchange  → an ACR *refresh* token for the registry.
 *   3. POST /oauth2/token     → an ACR *access* token scoped to one
 *                               repository, which the catalog API accepts.
 *
 * The identity needs AcrPull on the registry; that role carries the
 * metadata/read action this scope requests.
 */

interface AcrTokenResponse {
  refresh_token?: string;
  access_token?: string;
}

export interface AcrManifest {
  digest: string;
  tags: string[];
  createdTime: string;
}

/**
 * The tenant id the ACR exchange requires, read from the ARM token's own
 * `tid` claim. Taking it from the token rather than from configuration keeps
 * this working for any identity type without a new environment variable —
 * and guarantees the tenant always matches the token being exchanged.
 */
function tenantIdFromToken(armToken: string): string {
  const payload = armToken.split(".")[1];
  if (!payload) throw new Error("ARM access token is not a JWT; cannot derive the tenant id for ACR.");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { tid?: string };
  if (!claims.tid) throw new Error("ARM access token carries no 'tid' claim; cannot authenticate to ACR.");
  return claims.tid;
}

async function postForm(url: string, form: Record<string, string>): Promise<AcrTokenResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ACR token request failed (${response.status}) for ${url}: ${body}`);
  }
  return (await response.json()) as AcrTokenResponse;
}

/** Repository-scoped ACR access token. Not cached — the manifest list above it is. */
async function getAcrAccessToken(registryName: string, repository: string): Promise<string> {
  const loginServer = `${registryName}.azurecr.io`;
  const armToken = await getAccessToken(SCOPES.arm);

  const exchanged = await postForm(`https://${loginServer}/oauth2/exchange`, {
    grant_type: "access_token",
    service: loginServer,
    tenant: tenantIdFromToken(armToken),
    access_token: armToken,
  });
  if (!exchanged.refresh_token) throw new Error(`ACR ${loginServer} returned no refresh token.`);

  const issued = await postForm(`https://${loginServer}/oauth2/token`, {
    grant_type: "refresh_token",
    service: loginServer,
    scope: `repository:${repository}:metadata_read`,
    refresh_token: exchanged.refresh_token,
  });
  if (!issued.access_token) throw new Error(`ACR ${loginServer} returned no access token for ${repository}.`);

  return issued.access_token;
}

/**
 * Manifests of one repository, newest first — the same records, and the same
 * three fields, the CLI call returned.
 */
export async function listManifests(registryName: string, repository: string): Promise<AcrManifest[]> {
  const token = await getAcrAccessToken(registryName, repository);
  const response = await fetch(
    `https://${registryName}.azurecr.io/acr/v1/${encodeURIComponent(repository)}/_manifests?n=100&orderby=timedesc`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ACR manifest listing failed (${response.status}) for ${repository}: ${body}`);
  }
  const body = (await response.json()) as { manifests?: AcrManifest[] };
  return body.manifests ?? [];
}
