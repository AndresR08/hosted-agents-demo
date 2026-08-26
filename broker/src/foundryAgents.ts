import { config } from "./config.js";
import { getAccessToken, SCOPES } from "./azureAuth.js";

/**
 * The Foundry agents registry, read once and shared.
 *
 * Two routes need the same facts for different reasons — /api/agents renders
 * the Framework Experience panel, /api/ask stamps every answer with the
 * container and framework that produced it (ARCHITECTURE.md
 * §9, 1.5). Before this module each did its own registry call, which meant the
 * ask path paid a second round trip on every question. The short cache below
 * exists for that reason: agent registration is never a live-demo activity, so
 * a minute of staleness costs nothing and the presenter can drop it explicitly
 * from Presenter Tools → Maintenance → Refresh Agent Registry.
 */

export interface FoundryAgentVersion {
  id: string;
  version: string;
  /** Human-readable description set at creation — "" when none was given (verified live). */
  description: string;
  created_at: number;
  status: string;
  definition: {
    cpu: string;
    memory: string;
    environment_variables: Record<string, string>;
    container_configuration: { image: string };
  };
}

export interface FoundryAgent {
  id: string;
  name: string;
  state: string;
  versions: { latest: FoundryAgentVersion };
}

/**
 * One element of `GET /agents/{name}/versions` — verified against the live
 * deployment (2026-08-03: pydantic-agent returned 3 versions, strands-agent
 * 1, both descending by `created_at`, no pagination needed at this scale).
 * Richer than `FoundryAgentVersion` above, which only ever came from
 * `versions.latest` on the `/agents` list call and never carried `id`,
 * `name`, `description`, `draft`, `metadata`, or the identity/blueprint
 * fields this shape has.
 *
 * `instance_identity`, `blueprint`, `blueprint_reference` and `agent_guid`
 * are real fields the service returns and are captured here for fidelity to
 * what was observed, but routes/agents.ts must never forward them to a
 * response — they are internal identity plumbing with no product use today,
 * unlike `environment_variables`, which routes must forward as keys only
 * (verified live: every version's `environment_variables` includes
 * `APIM_SUBSCRIPTION_KEY` in plaintext).
 */
export interface FoundryAgentVersionDetail {
  metadata: Record<string, string>;
  object: string;
  id: string;
  name: string;
  version: string;
  description: string;
  /** Unix seconds, same unit as FoundryAgentVersion.created_at. */
  created_at: number;
  /** Unix seconds. Presence unverified as of the last live check — kept optional. */
  updated_at?: number;
  definition: {
    kind: string;
    /** Always empty in every version observed live; shape of a populated entry is unverified. */
    container_protocol_versions: unknown[];
    cpu: string;
    memory: string;
    environment_variables: Record<string, string>;
    container_configuration: { image: string };
    protocol_versions: { protocol: string; version: string }[];
  };
  draft: boolean;
  /** Raw Foundry value — "active" observed live; "creating" | "failed" | "deleting" | "deleted" per the SDK's AgentVersionStatus, unverified against this deployment. Never translated here — see routes/agents.ts. */
  status: string;
  instance_identity?: { principal_id: string; client_id: string };
  blueprint?: { principal_id: string; client_id: string };
  blueprint_reference?: { type: string; blueprint_id: string };
  agent_guid?: string;
}

interface FoundryAgentVersionsListResponse {
  data: FoundryAgentVersionDetail[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
  object: string;
}

/**
 * Which framework each registered agent was built with.
 *
 * Deliberately a map rather than anything read from Azure: Foundry hosts a
 * container and has no opinion about what is inside it, which is precisely the
 * property this lab exists to demonstrate. The mapping is the lab's own — the
 * notebook's `frameworks` dict names `pydantic-agent` and `strands-agent`.
 */
export const FRAMEWORK_BY_AGENT: Record<string, string> = {
  "pydantic-agent": "Pydantic AI",
  "strands-agent": "Strands",
};

const CACHE_TTL_MS = 60 * 1000;
let cache: { agents: FoundryAgent[]; expiresAt: number } | null = null;

/** Drops the registry cache — see routes/maintenance.ts, Refresh Agent Registry. */
export function clearAgentCache() {
  cache = null;
}

/**
 * The one place that authenticates against the Foundry data plane. Every
 * call in this module goes through here, so there is a single Bearer-token
 * acquisition, a single `api-version=v1`, and a single place where that
 * would change. Returns the raw Response — callers decide what a non-2xx
 * means for them (list calls throw, `createAgentVersion` reports it).
 */
async function foundryFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken(SCOPES.foundry);
  return fetch(`${config.foundryAgentsProjectEndpoint}${path}?api-version=v1`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchFoundryAgents(): Promise<FoundryAgent[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.agents;

  const response = await foundryFetch("/agents");
  if (!response.ok) throw new Error(`Foundry agents list failed: ${response.status}`);
  const body = (await response.json()) as { data: FoundryAgent[] };

  cache = { agents: body.data, expiresAt: Date.now() + CACHE_TTL_MS };
  return body.data;
}

/**
 * Full version history for one agent — `GET /agents/{name}/versions`.
 * Deliberately uncached, unlike `fetchFoundryAgents()` above: this list
 * changes the moment a new version is registered, and a demo/console
 * flow that just registered one should see it appear immediately rather
 * than waiting out a TTL.
 *
 * Ordering is whatever the service returns — verified live to already be
 * descending by `created_at` (newest first), so callers must not re-sort;
 * doing so would mask a future change in the service's own ordering
 * instead of surfacing it.
 *
 * An agent name Foundry has never seen returns `data: []` here (verified
 * live: HTTP 200, not 404) rather than an error — existence must be
 * checked against `fetchFoundryAgents()` before calling this, exactly as
 * `/agents/:name/provenance` already does.
 */
export async function fetchAgentVersions(agentName: string): Promise<FoundryAgentVersionDetail[]> {
  const response = await foundryFetch(`/agents/${encodeURIComponent(agentName)}/versions`);
  if (!response.ok) throw new Error(`Foundry agent versions list failed: ${response.status}`);
  const body = (await response.json()) as FoundryAgentVersionsListResponse;
  return body.data;
}

/**
 * The environment variables this deployment's platform owns, read from an
 * agent that is already registered and working.
 *
 * These four keys are what wires a container to the model through APIM
 * (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`,
 * `AZURE_OPENAI_DEPLOYMENT`, `APIM_SUBSCRIPTION_KEY` — exactly the set the
 * lab notebook injects at creation time). They are rejected when a caller
 * supplies them (see routes/agents.ts) precisely because the platform sets
 * them, so creation has to supply them from somewhere.
 *
 * That "somewhere" is the existing registry rather than new broker config:
 * the values are already in memory from `fetchFoundryAgents()`, they are by
 * definition the correct working values for *this* deployment, and sourcing
 * them this way invents nothing and adds no environment variable the broker
 * did not already require. If no registered agent carries a key, it is
 * simply omitted — an agent created with an incomplete platform wiring is
 * honest about it, where a fabricated endpoint or key would not be.
 */
export const PLATFORM_MANAGED_ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_DEPLOYMENT",
  "APIM_SUBSCRIPTION_KEY",
] as const;

export async function getPlatformManagedEnvironmentVariables(): Promise<Record<string, string>> {
  const agents = await fetchFoundryAgents().catch(() => [] as FoundryAgent[]);
  const managed: Record<string, string> = {};
  for (const key of PLATFORM_MANAGED_ENV_KEYS) {
    for (const agent of agents) {
      const value = agent.versions.latest.definition.environment_variables?.[key];
      if (value) {
        managed[key] = value;
        break;
      }
    }
  }
  return managed;
}

export interface CreateAgentVersionInput {
  name: string;
  image: string;
  cpu: string;
  memory: string;
  description?: string;
  environmentVariables: Record<string, string>;
  protocolVersions: { protocol: string; version: string }[];
}

export type CreateAgentVersionResult =
  | { ok: true; version: FoundryAgentVersionDetail }
  | { ok: false; httpStatus: number; detail: string };

/**
 * Creates an agent — `POST /agents/{name}/versions`, the same URL the version
 * list reads from, because in Foundry an agent *is* its versions: creating
 * the first version is what brings the agent into existence (verified in the
 * installed SDK, `build_agents_create_version_request`, and the shape the lab
 * notebook itself posts).
 *
 * Failure is returned rather than thrown so the route can surface Foundry's
 * own status and message — a rejected image reference or a malformed name is
 * the caller's problem to see, not a generic 502.
 */
export async function createAgentVersion(
  input: CreateAgentVersionInput,
): Promise<CreateAgentVersionResult> {
  const response = await foundryFetch(`/agents/${encodeURIComponent(input.name)}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.description ? { description: input.description } : {}),
      definition: {
        kind: "hosted",
        cpu: input.cpu,
        memory: input.memory,
        container_configuration: { image: input.image },
        protocol_versions: input.protocolVersions,
        environment_variables: input.environmentVariables,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, httpStatus: response.status, detail };
  }

  // A newly created agent must be visible to the very next read.
  clearAgentCache();
  return { ok: true, version: (await response.json()) as FoundryAgentVersionDetail };
}

export type DeleteAgentResult = { ok: true } | { ok: false; httpStatus: number; detail: string };

/**
 * Deletes an agent — `DELETE /agents/{name}` (verified in the installed SDK,
 * `Agents.delete`). In Foundry an agent *is* its versions, so this cascades
 * to every version registered under `name`; there is no separate
 * per-version delete in this product.
 *
 * Never passes `force`: Foundry rejects with 409 if any version has active
 * sessions, and that rejection is returned to the caller unchanged rather
 * than silently overridden, exactly like `createAgentVersion` above.
 */
export async function deleteAgent(name: string): Promise<DeleteAgentResult> {
  const response = await foundryFetch(`/agents/${encodeURIComponent(name)}`, { method: "DELETE" });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, httpStatus: response.status, detail };
  }

  clearAgentCache();
  return { ok: true };
}

/**
 * The registry facts for one agent, or null when it is not registered.
 *
 * Never throws for an unknown agent and never invents one: a name that is not
 * in the registry genuinely is not deployed, and every caller renders that as
 * "not registered" rather than padding the list.
 */
export async function getAgentFacts(name: string): Promise<{
  name: string;
  version: string;
  framework: string;
  status: "Running" | "Unknown";
  imageUri: string;
  cpu: string;
  memory: string;
  environmentVariableKeys: string[];
  versionCreatedAt: string;
} | null> {
  const agents = await fetchFoundryAgents().catch(() => [] as FoundryAgent[]);
  const agent = agents.find((a) => a.name === name);
  if (!agent) return null;

  const version = agent.versions.latest;
  return {
    name: agent.name,
    version: `:${version.version}`,
    framework: FRAMEWORK_BY_AGENT[agent.name] ?? agent.name,
    status: version.status === "active" ? "Running" : "Unknown",
    imageUri: version.definition.container_configuration.image,
    cpu: version.definition.cpu,
    memory: version.definition.memory,
    environmentVariableKeys: Object.keys(version.definition.environment_variables),
    versionCreatedAt: new Date(version.created_at * 1000).toISOString(),
  };
}
