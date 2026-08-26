import type {
  AccessControlResult,
  AgentDetail,
  AgentProvenance,
  AgentSummary,
  AgentVersionHistory,
  AskResult,
  AuditRecord,
  ControlsCatalogue,
  CreateAgentInput,
  DemoDataService,
  EnvironmentContext,
  InvokeAgentResult,
  MaintenanceActionId,
  MaintenanceResult,
  PolicyDocument,
  Provenance,
  RequestJourney,
  RequestObservability,
  RunDetail,
  RunSummary,
} from "../contracts";
import type { AgentName } from "@/state/types";

/**
 * Replay implementation of DemoDataService.
 *
 * Real usage: load a rehearsal capture recorded against the live deployment
 * (DESIGN_DECISIONS.md, "Demo-mode toggle") from a JSON file in /captures and
 * serve it verbatim, badged `replay`. That loader is not built yet — this
 * scaffold returns structurally valid, obviously-placeholder data so panels
 * have something to render and type against while the rest of the app is
 * built. Nothing below should be mistaken for actual demo content: nothing
 * here is the real banking prompt, the real policy XML, or a real audit
 * record, and none of it should be presented to a customer.
 */

function placeholderProvenance(): Provenance {
  return { band: "replay", capturedAt: "PLACEHOLDER — no capture loaded" };
}

export class SimulationService implements DemoDataService {
  async getEnvironmentContext(): Promise<EnvironmentContext> {
    return {
      region: "PLACEHOLDER",
      resourceGroupName: "PLACEHOLDER",
      resourceCount: 0,
      provenance: placeholderProvenance(),
    };
  }

  async ask(_prompt: string, agentName: AgentName): Promise<AskResult> {
    return {
      askId: "placeholder-ask",
      answerText: "PLACEHOLDER — load a rehearsal capture to populate this.",
      agentName,
      agentVersion: "PLACEHOLDER",
      latencyMs: 0,
      httpStatus: 0,
      provenance: placeholderProvenance(),
    };
  }

  async getRequestJourney(askId: string): Promise<RequestJourney> {
    return {
      askId,
      hops: [],
      totalLatencyMs: 0,
      provenance: placeholderProvenance(),
    };
  }

  async runAccessControlTests(): Promise<AccessControlResult> {
    return { attempts: [], provenance: placeholderProvenance() };
  }

  async getPolicyDocument(
    apiName: PolicyDocument["apiName"],
  ): Promise<PolicyDocument> {
    return {
      apiName,
      xml: "<!-- PLACEHOLDER — load a rehearsal capture to populate this. -->",
      provenance: placeholderProvenance(),
    };
  }

  async listAgents(): Promise<AgentSummary[]> {
    return [];
  }

  async createAgent(input: CreateAgentInput): Promise<AgentDetail> {
    return {
      id: "PLACEHOLDER",
      name: input.name,
      description: input.description ?? "",
      latestVersion: "PLACEHOLDER",
      status: "PLACEHOLDER",
      cpu: input.cpu,
      memory: input.memory,
      image: input.image,
      protocolVersions: [],
      containerProtocolVersions: [],
      environmentVariableKeys: [],
      createdAt: "PLACEHOLDER",
      provenance: placeholderProvenance(),
    };
  }

  async deleteAgent(agentName: AgentName): Promise<{ name: string; deleted: boolean }> {
    return { name: agentName, deleted: true };
  }

  async getAgentDetail(agentName: AgentName): Promise<AgentDetail> {
    return {
      id: "PLACEHOLDER",
      name: agentName,
      description: "",
      latestVersion: "PLACEHOLDER",
      status: "PLACEHOLDER",
      cpu: "PLACEHOLDER",
      memory: "PLACEHOLDER",
      image: "PLACEHOLDER",
      protocolVersions: [],
      containerProtocolVersions: [],
      environmentVariableKeys: [],
      createdAt: "PLACEHOLDER",
      provenance: placeholderProvenance(),
    };
  }

  async getAgentVersions(agentName: AgentName): Promise<AgentVersionHistory> {
    return { agentName, versions: [], provenance: placeholderProvenance() };
  }

  async invokeAgent(_agentName: AgentName, _prompt: string): Promise<InvokeAgentResult> {
    return {
      runId: "placeholder-run",
      status: "PLACEHOLDER",
      startedAt: "PLACEHOLDER",
      finishedAt: "PLACEHOLDER",
      duration: 0,
      output: "PLACEHOLDER — load a rehearsal capture to populate this.",
      provenance: placeholderProvenance(),
    };
  }

  async listRuns(): Promise<RunSummary[]> {
    return [];
  }

  async getRun(runId: string): Promise<RunDetail> {
    return {
      runId,
      agentName: "pydantic-agent",
      status: "PLACEHOLDER",
      startedAt: "PLACEHOLDER",
      finishedAt: "PLACEHOLDER",
      duration: 0,
      prompt: "PLACEHOLDER",
      provenance: placeholderProvenance(),
    };
  }

  async getAgentProvenance(agentName: AgentName): Promise<AgentProvenance> {
    return {
      agentName,
      imageUri: "PLACEHOLDER",
      imageDigest: "PLACEHOLDER",
      pushedAt: "PLACEHOLDER",
      versionCreatedAt: "PLACEHOLDER",
      environmentVariableKeys: [],
      provenance: placeholderProvenance(),
    };
  }

  async getControlsCatalogue(): Promise<ControlsCatalogue> {
    return { active: [], available: [], provenance: placeholderProvenance() };
  }

  async getAuditRecord(): Promise<AuditRecord | null> {
    return null;
  }

  /**
   * Null rather than placeholder telemetry. Observability is entirely a claim
   * about what Azure emitted; inventing a token count or a trace here would be
   * exactly the fabrication DESIGN_DECISIONS.md forbids. The panel renders its
   * "no telemetry" state instead, badged as Simulation.
   */
  async getRequestObservability(): Promise<RequestObservability | null> {
    return null;
  }

  /**
   * Answers locally without touching Azure. The point of Simulation mode is
   * that it works when the network doesn't — a maintenance panel that fails
   * here would report an outage that Simulation exists to survive. Results are
   * labelled so a presenter can never mistake one for a real check.
   */
  async runMaintenanceAction(action: MaintenanceActionId): Promise<MaintenanceResult> {
    return {
      ok: true,
      detail: `Simulation mode — "${action}" not executed against Azure`,
      elapsedMs: 0,
    };
  }
}
