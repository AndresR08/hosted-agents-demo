import { Router } from "express";
import { config } from "../config.js";
import { listManifests, type AcrManifest } from "../acr.js";
import { liveNow } from "../provenance.js";
import { asyncHandler } from "../asyncHandler.js";
import {
  clearAgentCache,
  createAgentVersion,
  deleteAgent,
  fetchAgentVersions,
  fetchFoundryAgents,
  FRAMEWORK_BY_AGENT,
  getPlatformManagedEnvironmentVariables,
  PLATFORM_MANAGED_ENV_KEYS,
  type FoundryAgentVersionDetail,
} from "../foundryAgents.js";
import { invokeHostedAgent } from "../agentInvocation.js";
import { recordRun } from "../runStore.js";

export const agentsRouter = Router();

/**
 * One version, projected for the console. Kept as broad as what Foundry
 * actually returns — id, name, version, description, status, draft,
 * metadata, timestamps, the full definition minus secrets — because this
 * is read data with no frontend consumer yet and narrowing it now would
 * mean re-widening it the moment a screen needs a field that got cut.
 *
 * Excluded, deliberately, and only this: environment variable *values*
 * (keys only survive), and `instance_identity` / `blueprint` /
 * `blueprint_reference` / `agent_guid` — internal identity plumbing with
 * no product use today. `status` is passed through exactly as Foundry
 * reports it ("active", …) — no "Running"/"Unknown" translation here;
 * that presentation choice belongs to whichever screen renders this.
 */
interface AgentVersionSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  status: string;
  draft: boolean;
  metadata: Record<string, string>;
  createdAt: string;
  definition: {
    kind: string;
    cpu: string;
    memory: string;
    imageUri: string;
    protocolVersions: { protocol: string; version: string }[];
    containerProtocolVersions: unknown[];
    environmentVariableKeys: string[];
  };
}

/**
 * The container/protocol facts shared by every public projection of a raw
 * `FoundryAgentVersionDetail` — used by both `toVersionSummary` (one entry
 * in the version history) and `toAgentDetail` (the agent's latest version,
 * flattened). Keeping this in one place is what stops the environment-
 * variable-values / instance_identity / blueprint / agent_guid exclusion
 * list from having to be remembered twice.
 */
function toPublicVersionFields(v: FoundryAgentVersionDetail) {
  return {
    cpu: v.definition.cpu,
    memory: v.definition.memory,
    imageUri: v.definition.container_configuration.image,
    protocolVersions: v.definition.protocol_versions,
    containerProtocolVersions: v.definition.container_protocol_versions,
    environmentVariableKeys: Object.keys(v.definition.environment_variables),
  };
}

function toVersionSummary(v: FoundryAgentVersionDetail): AgentVersionSummary {
  return {
    id: v.id,
    name: v.name,
    version: v.version,
    description: v.description,
    status: v.status,
    draft: v.draft,
    metadata: v.metadata,
    createdAt: new Date(v.created_at * 1000).toISOString(),
    definition: {
      kind: v.definition.kind,
      ...toPublicVersionFields(v),
    },
  };
}

/**
 * The agent as a domain object — `GET /agents/:name`. Built from the same
 * raw `FoundryAgentVersionDetail` as `toVersionSummary`, just flattened and
 * limited to its *latest* version rather than the full history. Built from
 * the already-verified `/agents/:name/versions` call (taking entry 0, which
 * that endpoint's own contract guarantees is newest) rather than a separate
 * single-agent Foundry call, so this route needed no new Azure investigation.
 */
interface AgentDetail {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  status: string;
  cpu: string;
  memory: string;
  image: string;
  protocolVersions: { protocol: string; version: string }[];
  containerProtocolVersions: unknown[];
  environmentVariableKeys: string[];
  createdAt: string;
  updatedAt?: string;
}

function toAgentDetail(v: FoundryAgentVersionDetail): AgentDetail {
  const shared = toPublicVersionFields(v);
  return {
    id: v.id,
    name: v.name,
    description: v.description,
    latestVersion: v.version,
    status: v.status,
    cpu: shared.cpu,
    memory: shared.memory,
    image: shared.imageUri,
    protocolVersions: shared.protocolVersions,
    containerProtocolVersions: shared.containerProtocolVersions,
    environmentVariableKeys: shared.environmentVariableKeys,
    createdAt: new Date(v.created_at * 1000).toISOString(),
    ...(v.updated_at ? { updatedAt: new Date(v.updated_at * 1000).toISOString() } : {}),
  };
}

/**
 * Whether `name` is a registered Foundry agent — the existence check shared
 * by `/agents/:name`, `/agents/:name/versions` and `/agents/:name/provenance`.
 * The underlying `/versions` call doesn't 404 on an unknown name (it returns
 * `data: []`, verified live), so this registry check is what produces a
 * real 404 for both routes that build on it.
 */
async function isAgentRegistered(name: string): Promise<boolean> {
  const agents = await fetchFoundryAgents();
  return agents.some((a) => a.name === name);
}

// An ACR manifest lookup is three round-trips (two token calls plus the
// listing — see acr.ts). A short cache keeps the demo responsive on repeat
// views of the same agent. Five minutes because image pushes don't happen
// mid-demo.
const manifestCache = new Map<string, { manifests: AcrManifest[]; expiresAt: number }>();
const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Drops both the image cache and the Foundry registry cache, so a newly pushed
 * image or a just-registered agent shows up without restarting the broker.
 * Called by the Refresh Agent Registry maintenance action (routes/maintenance.ts).
 */
export function clearManifestCache() {
  manifestCache.clear();
  clearAgentCache();
}

async function getManifestsCached(repository: string): Promise<AcrManifest[]> {
  const cached = manifestCache.get(repository);
  if (cached && cached.expiresAt > Date.now()) return cached.manifests;
  const manifests = await listManifests(config.containerRegistryName, repository);
  manifestCache.set(repository, { manifests, expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS });
  return manifests;
}

/**
 * Priority 3 — real agent information.
 *
 * Only agents actually registered in this Foundry project are returned — the
 * frontend must never invent a row to match the script. Which agents that is
 * depends entirely on what was deployed: the lab automation registers one
 * hosted agent per framework it is asked for, and defaults to both
 * (`pydantic-agent` and `strands-agent`), which is what the two-framework beat
 * needs. Deploy only one and this endpoint correctly returns only that one,
 * and the panel shows the other as not registered. No version or count is
 * asserted here on purpose — the registry is the only source of truth for it.
 *
 * The response carries the whole agent *definition* — image, CPU, memory and
 * environment-variable keys — not just name and version. That is what turns
 * the Framework Experience panel's claim "both of these became Hosted Agents,
 * identically" from an assertion into something read from the registry:
 * two containers, two frameworks, the same hosting contract and the same
 * resource envelope, side by side.
 */
agentsRouter.get("/agents", asyncHandler(async (_req, res) => {
  const agents = await fetchFoundryAgents();
  res.json(
    agents.map((agent) => {
      const version = agent.versions.latest;
      return {
        name: agent.name,
        version: `:${version.version}`,
        description: version.description,
        framework: FRAMEWORK_BY_AGENT[agent.name] ?? agent.name,
        status: version.status === "active" ? "Running" : "Unknown",
        imageUri: version.definition.container_configuration.image,
        cpu: version.definition.cpu,
        memory: version.definition.memory,
        environmentVariableKeys: Object.keys(version.definition.environment_variables),
        versionCreatedAt: new Date(version.created_at * 1000).toISOString(),
      };
    }),
  );
}));

agentsRouter.get("/agents/:name/provenance", asyncHandler(async (req, res) => {
  const agents = await fetchFoundryAgents();
  const agent = agents.find((a) => a.name === req.params.name);
  if (!agent) {
    res.status(404).json({ error: `Agent ${req.params.name} is not registered` });
    return;
  }

  const version = agent.versions.latest;
  const imageUri = version.definition.container_configuration.image;
  const tag = imageUri.split(":").pop() ?? "";
  const repository = req.params.name;

  let imageDigest = "unavailable";
  let pushedAt = "unavailable";
  try {
    const manifests = await getManifestsCached(repository);
    const match = manifests.find((m) => m.tags?.includes(tag)) ?? manifests[0];
    if (match) {
      imageDigest = match.digest;
      pushedAt = match.createdTime;
    }
  } catch {
    // ACR lookup is best-effort — the Foundry-sourced fields below still stand on their own.
  }

  res.json({
    agentName: agent.name,
    imageUri,
    imageDigest,
    pushedAt,
    versionCreatedAt: new Date(version.created_at * 1000).toISOString(),
    environmentVariableKeys: Object.keys(version.definition.environment_variables),
    provenance: liveNow(),
  });
}));

/**
 * Create a Hosted Agent — `POST /agents`.
 *
 * Accepts only what creating one actually needs. `cpu` and `memory` are
 * required because Foundry requires them; `protocolVersions` defaults to the
 * one ingress protocol this deployment uses, and can be overridden.
 * Everything Foundry additionally accepts but this product does not use
 * (blueprints, drafts, code-based deployment, telemetry config, RAI config)
 * is deliberately not exposed.
 *
 * The four platform-managed environment variables are rejected rather than
 * silently dropped: a caller who thinks they are setting the model endpoint
 * or the APIM key needs to be told they are not. The broker supplies those
 * itself (see getPlatformManagedEnvironmentVariables) — any other variable
 * the caller sends is passed through to Foundry untouched.
 *
 * On success the response is the same `AgentDetail` DTO `GET /agents/:name`
 * returns, built by the same mapper, so a created agent and a fetched agent
 * are indistinguishable to a consumer — environment variable *values* never
 * appear in either, only their keys.
 */
agentsRouter.post("/agents", asyncHandler(async (req, res) => {
  const { name, image, cpu, memory, description, environmentVariables, protocolVersions } =
    req.body as {
      name?: string;
      image?: string;
      cpu?: string;
      memory?: string;
      description?: string;
      environmentVariables?: Record<string, string>;
      protocolVersions?: { protocol: string; version: string }[];
    };

  if (!name || !image || !cpu || !memory) {
    res.status(400).json({ error: "name, image, cpu and memory are required" });
    return;
  }

  const rejected = Object.keys(environmentVariables ?? {}).find((key) =>
    (PLATFORM_MANAGED_ENV_KEYS as readonly string[]).includes(key),
  );
  if (rejected) {
    res.status(400).json({
      error: `Environment variable ${rejected} is managed by the platform and cannot be set`,
    });
    return;
  }

  if (await isAgentRegistered(name)) {
    res.status(409).json({ error: `Agent ${name} already exists` });
    return;
  }

  const result = await createAgentVersion({
    name,
    image,
    cpu,
    memory,
    description,
    protocolVersions: protocolVersions ?? [{ protocol: "responses", version: "1.0.0" }],
    environmentVariables: {
      ...(environmentVariables ?? {}),
      ...(await getPlatformManagedEnvironmentVariables()),
    },
  });

  if (!result.ok) {
    res
      .status(result.httpStatus)
      .json({ error: "Agent creation failed", detail: result.detail, httpStatus: result.httpStatus });
    return;
  }

  res.status(201).json({
    ...toAgentDetail(result.version),
    provenance: liveNow(),
  });
}));

/**
 * Delete an agent — `DELETE /agents/:name`. Cascades to every version
 * Foundry has registered under this name (see `deleteAgent` in
 * foundryAgents.ts — there is no separate per-version delete route for this
 * product). A 409 from Foundry (active sessions) reaches the caller
 * unchanged rather than being retried with `force`.
 */
agentsRouter.delete("/agents/:name", asyncHandler(async (req, res) => {
  if (!(await isAgentRegistered(req.params.name))) {
    res.status(404).json({ error: `Agent ${req.params.name} is not registered` });
    return;
  }

  const result = await deleteAgent(req.params.name);
  if (!result.ok) {
    res
      .status(result.httpStatus)
      .json({ error: "Agent deletion failed", detail: result.detail, httpStatus: result.httpStatus });
    return;
  }

  res.json({ name: req.params.name, deleted: true, provenance: liveNow() });
}));

/**
 * The agent as a single domain object — `GET /agents/:name`. Reuses the
 * already-verified `/agents/:name/versions` service call rather than a new
 * Foundry endpoint: `fetchAgentVersions` is contractually descending, so
 * `[0]` is the latest version, and `toAgentDetail` flattens it into the
 * agent-shaped projection this route promises.
 */
agentsRouter.get("/agents/:name", asyncHandler(async (req, res) => {
  if (!(await isAgentRegistered(req.params.name))) {
    res.status(404).json({ error: `Agent ${req.params.name} is not registered` });
    return;
  }

  const versions = await fetchAgentVersions(req.params.name);
  const latest = versions[0];

  res.json({
    ...toAgentDetail(latest),
    provenance: liveNow(),
  });
}));

/**
 * Full version history for one agent — `GET /agents/{name}/versions`
 * (Foundry, api-version=v1, scope https://ai.azure.com/.default),
 * verified live: descending order, and no pagination needed at the scale a
 * demo deployment reaches — each `deploy.ps1` run adds one version per agent,
 * so the count tracks how often the lab has been redeployed rather than any
 * fixed number.
 *
 * The upstream route itself does not 404 for an unknown agent name — it
 * returns 200 with `data: []`, indistinguishable from "this agent exists
 * but somehow has no versions" (which cannot happen for a real agent, but
 * the wire format doesn't rule it out). Existence is therefore checked
 * against the already-cached registry first, exactly as
 * `/agents/:name/provenance` above does — no extra round trip in the
 * common case, and a real 404 for a name Foundry has never registered.
 */
agentsRouter.get("/agents/:name/versions", asyncHandler(async (req, res) => {
  if (!(await isAgentRegistered(req.params.name))) {
    res.status(404).json({ error: `Agent ${req.params.name} is not registered` });
    return;
  }

  const rawVersions = await fetchAgentVersions(req.params.name);

  res.json({
    agentName: req.params.name,
    versions: rawVersions.map(toVersionSummary),
    provenance: liveNow(),
  });
}));

/**
 * Invoke a Hosted Agent directly — `POST /agents/:name/invoke`. Exactly one
 * call to the same Responses API endpoint `/ask` uses (see
 * agentInvocation.ts), with the caller's prompt sent as-is: unlike `/ask`,
 * this route is not the presenter demo path and does not inject
 * demoKnowledge augmentation. The run is recorded via runStore.ts regardless
 * of outcome — completed, failed, or timed out — so a later
 * `GET /api/runs`/`GET /api/runs/:id` (not implemented yet) can list it.
 */
agentsRouter.post("/agents/:name/invoke", asyncHandler(async (req, res) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  if (!(await isAgentRegistered(req.params.name))) {
    res.status(404).json({ error: `Agent ${req.params.name} is not registered` });
    return;
  }

  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const result = await invokeHostedAgent(req.params.name, prompt);
  const finishedAt = new Date();

  if (!result.ok) {
    recordRun({
      runId,
      agentName: req.params.name,
      status: result.timedOut ? "timeout" : "failed",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: result.latencyMs,
      prompt,
      httpStatus: result.httpStatus,
      errorDetail: result.detail,
    });
    res
      .status(result.httpStatus)
      .json({ error: "Agent invocation failed", detail: result.detail, httpStatus: result.httpStatus });
    return;
  }

  const status = result.status ?? "completed";

  recordRun({
    runId,
    agentName: req.params.name,
    agentVersion: result.agentVersion,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: result.latencyMs,
    prompt,
    output: result.outputText,
    usage: result.usage,
    model: result.model,
    httpStatus: result.httpStatus,
  });

  res.json({
    runId,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    duration: result.latencyMs,
    output: result.outputText,
    usage: result.usage,
    model: result.model,
    provenance: liveNow(),
  });
}));
