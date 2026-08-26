import { FlashRegular, PlugConnectedRegular } from "@fluentui/react-icons";
import { EmptyState } from "@/components/EmptyState";
import { type Fact, FactList } from "@/components/FactList";
import { MaintenanceActionButton } from "@/components/MaintenanceActionButton";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useTranslation } from "@/i18n/useTranslation";
import { formatTime } from "@/lib/format";
import type { AgentDetail } from "@/services/contracts";
import type { AgentName } from "@/state/types";

function formatProtocolVersions(versions?: { protocol: string; version: string }[]): string | undefined {
  if (!versions || versions.length === 0) return undefined;
  return versions.map((v) => `${v.protocol}/${v.version}`).join(" · ");
}

/** Shape unverified against this deployment (always empty so far) — rendered defensively, never assumed. */
function formatUnknownList(values?: unknown[]): string | undefined {
  if (!values || values.length === 0) return undefined;
  return values.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" · ");
}

/**
 * AGENT › SUMMARY — ARCHITECTURE.md Every field here comes
 * from one call, fetched fresh for whichever agent is selected:
 * `GET /api/agents/:name` (`DemoDataService.getAgentDetail`). Never derived
 * from `listAgents()`'s rows — the list and this panel are two independent
 * reads of two different broker endpoints.
 *
 * `status` is Foundry's own raw value here (e.g. "active"), not the
 * "Running"/"Unknown" the list translates — this panel shows exactly what
 * the contract returns, nothing rephrased.
 */
export function AgentOverview({
  agentName,
  agent,
  loading,
  error,
}: {
  /** The current selection, shown in the header even while `agent` is still loading. */
  agentName: AgentName;
  agent: AgentDetail | null;
  loading: boolean;
  /** Set when the last `getAgentDetail()` call failed (e.g. 404 for an unregistered name). */
  error?: string | null;
}) {
  const t = useTranslation();

  if (!loading && !error && !agent) {
    return (
      <section className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-border">
        <EmptyState>{t("agents.overview.empty")}</EmptyState>
      </section>
    );
  }

  const facts: Fact[] = [
    { label: t("agents.detail.name"), value: agent?.name },
    { label: t("agents.detail.description"), value: agent?.description || undefined },
    { label: t("ha.fact.status"), value: agent?.status },
    { label: t("agents.detail.version"), value: agent ? `:${agent.latestVersion}` : undefined },
    { label: t("ha.fact.image"), value: agent?.image, mono: true },
    { label: t("ha.fact.cpu"), value: agent?.cpu },
    { label: t("ha.fact.memory"), value: agent?.memory },
    { label: t("ha.fact.protocol"), value: formatProtocolVersions(agent?.protocolVersions) },
    {
      label: t("agents.detail.containerProtocolVersions"),
      value: formatUnknownList(agent?.containerProtocolVersions),
    },
    {
      label: t("ha.fact.env"),
      value: agent?.environmentVariableKeys?.length
        ? agent.environmentVariableKeys.join(" · ")
        : undefined,
      mono: true,
      note: t("ha.envNote"),
    },
    { label: t("ha.fact.registered"), value: formatTime(agent?.createdAt) },
    // "solo si existe" — this deployment has never returned it, so the row itself is
    // omitted rather than shown as "unavailable"; a field the contract never populates
    // is different from one Foundry declined to answer.
    ...(agent?.updatedAt
      ? [{ label: t("agents.detail.updatedAt"), value: formatTime(agent.updatedAt) }]
      : []),
  ];

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border">
      <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-border bg-illustrative-bg/50 px-3 py-2">
        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {t("agents.overview.title")}
        </p>
        <span className="shrink-0 truncate font-mono text-caption text-ink-muted">{agentName}</span>
      </header>

      {error && !loading ? (
        <p className="px-3 py-2.5 text-caption text-ink">
          {t("assistant.liveError")} ({error})
        </p>
      ) : (
        <FactList facts={facts} loading={loading} className="px-3 py-2.5" />
      )}

      {agent && !error && (
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("agents.overview.actionsTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <MaintenanceActionButton
              action="warm-agent"
              agentName={agent.name}
              icon={<FlashRegular />}
              label={t("maintenance.action.warm-agent")}
            />
            <MaintenanceActionButton
              action="test-hosted-agent"
              agentName={agent.name}
              icon={<PlugConnectedRegular />}
              label={t("maintenance.action.test-hosted-agent")}
            />
          </div>
        </div>
      )}

      {agent && !loading && !error && (
        <div className="border-t border-border px-3 py-2">
          <ProvenanceBadge provenance={agent.provenance} />
        </div>
      )}
    </section>
  );
}
