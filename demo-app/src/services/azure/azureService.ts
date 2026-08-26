import { env } from "@/config/env";
import type {
  AccessControlResult,
  AgentDetail,
  AgentProvenance,
  AgentSummary,
  AgentVersionHistory,
  AskOptions,
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
  RequestJourney,
  RequestObservability,
  RunDetail,
  RunSummary,
} from "../contracts";
import type { AgentName } from "@/state/types";

/**
 * Live implementation of DemoDataService. Talks only to the local broker
 * (`env.brokerBaseUrl`) — see ../../../broker and AZURE_INTEGRATION_REPORT.md.
 * Per DESIGN_DECISIONS.md / ARCHITECTURE.md, this class must never
 * call Azure directly: neither the Foundry endpoint nor APIM emits CORS
 * headers for an arbitrary browser origin, and the APIM subscription key /
 * Entra token must never reach client-side script. The broker holds both;
 * this class holds neither.
 */
async function brokerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.brokerBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Broker request failed (${response.status}) for ${path}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export class AzureService implements DemoDataService {
  getEnvironmentContext(): Promise<EnvironmentContext> {
    return brokerFetch<EnvironmentContext>("/api/environment");
  }

  ask(prompt: string, agentName: AgentName, options?: AskOptions): Promise<AskResult> {
    return brokerFetch<AskResult>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, agentName, skipKnowledge: options?.skipKnowledge ?? false }),
    });
  }

  getRequestJourney(askId: string): Promise<RequestJourney> {
    return brokerFetch<RequestJourney>(`/api/journey/${encodeURIComponent(askId)}`);
  }

  runAccessControlTests(): Promise<AccessControlResult> {
    return brokerFetch<AccessControlResult>("/api/access-control-test", { method: "POST" });
  }

  getPolicyDocument(apiName: PolicyDocument["apiName"]): Promise<PolicyDocument> {
    return brokerFetch<PolicyDocument>(`/api/policy/${encodeURIComponent(apiName)}`);
  }

  listAgents(): Promise<AgentSummary[]> {
    return brokerFetch<AgentSummary[]>("/api/agents");
  }

  createAgent(input: CreateAgentInput): Promise<AgentDetail> {
    return brokerFetch<AgentDetail>("/api/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteAgent(agentName: AgentName): Promise<{ name: string; deleted: boolean }> {
    return brokerFetch<{ name: string; deleted: boolean }>(
      `/api/agents/${encodeURIComponent(agentName)}`,
      { method: "DELETE" },
    );
  }

  getAgentDetail(agentName: AgentName): Promise<AgentDetail> {
    return brokerFetch<AgentDetail>(`/api/agents/${encodeURIComponent(agentName)}`);
  }

  getAgentVersions(agentName: AgentName): Promise<AgentVersionHistory> {
    return brokerFetch<AgentVersionHistory>(`/api/agents/${encodeURIComponent(agentName)}/versions`);
  }

  invokeAgent(agentName: AgentName, prompt: string): Promise<InvokeAgentResult> {
    return brokerFetch<InvokeAgentResult>(`/api/agents/${encodeURIComponent(agentName)}/invoke`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }

  listRuns(): Promise<RunSummary[]> {
    return brokerFetch<RunSummary[]>("/api/runs");
  }

  getRun(runId: string): Promise<RunDetail> {
    return brokerFetch<RunDetail>(`/api/runs/${encodeURIComponent(runId)}`);
  }

  getAgentProvenance(agentName: AgentName): Promise<AgentProvenance> {
    return brokerFetch<AgentProvenance>(`/api/agents/${encodeURIComponent(agentName)}/provenance`);
  }

  getControlsCatalogue(): Promise<ControlsCatalogue> {
    return brokerFetch<ControlsCatalogue>("/api/controls");
  }

  getAuditRecord(agentName?: AgentName): Promise<AuditRecord | null> {
    const query = agentName ? `?agentName=${encodeURIComponent(agentName)}` : "";
    return brokerFetch<AuditRecord | null>(`/api/audit-record${query}`);
  }

  /**
   * A 404 here is expected, not exceptional: the broker only knows asks made
   * in the current process lifetime, so an id from before a restart resolves
   * to `null` — the one case where "no data" is the honest, permanent answer,
   * not a transient failure. Any other error (network failure, 5xx) is
   * rethrown rather than folded into the same `null`, so the caller can tell
   * "this request will never have telemetry" apart from "the broker could
   * not be reached just now" and show the right message for each.
   */
  async getRequestObservability(askId: string): Promise<RequestObservability | null> {
    try {
      return await brokerFetch<RequestObservability>(
        `/api/observability/${encodeURIComponent(askId)}`,
      );
    } catch (err) {
      if (err instanceof Error && /\(404\)/.test(err.message)) return null;
      throw err;
    }
  }

  /**
   * `ping` is a GET because it must succeed even when Azure is unreachable —
   * it is the check that distinguishes "broker down" from "Azure down".
   * Everything else is a POST that performs a real read against Azure.
   */
  runMaintenanceAction(
    action: MaintenanceActionId,
    agentName?: AgentName,
  ): Promise<MaintenanceResult> {
    if (action === "ping") {
      return brokerFetch<MaintenanceResult>("/api/maintenance/ping");
    }
    return brokerFetch<MaintenanceResult>(`/api/maintenance/${action}`, {
      method: "POST",
      body: JSON.stringify({ agentName }),
    });
  }
}
