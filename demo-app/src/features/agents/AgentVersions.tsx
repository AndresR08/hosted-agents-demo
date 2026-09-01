import { EmptyState } from "@/components/EmptyState";
import { type Fact, FactList } from "@/components/FactList";
import { PanelBody } from "@/components/PanelBody";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Skeleton } from "@/components/Skeleton";
import { LiveCallError } from "@/components/LiveCallError";
import { useTranslation } from "@/i18n/useTranslation";
import { formatTime } from "@/lib/format";
import type { AgentVersionHistory } from "@/services/contracts";
import type { AgentName } from "@/state/types";

/**
 * AGENT › VERSIONS — the full version history for the selected agent, one
 * call: `GET /api/agents/:name/versions` (`DemoDataService.getAgentVersions`).
 * Never derived from `getAgentDetail()` (Summary) or `listAgents()` (the
 * list) — a separate read of a separate broker endpoint, fetched fresh
 * whenever this tab is open for the current selection.
 *
 * Rows render in exactly the order the broker returned — the endpoint's own
 * contract is descending by `createdAt` (newest first); this component does
 * not re-sort, so a future change in the service's own ordering would be
 * visible here rather than masked.
 *
 * `status` is Foundry's own raw value per version (e.g. "active"), never
 * translated — same rule as Summary.
 */
export function AgentVersions({
  agentName,
  history,
  loading,
  error,
}: {
  /** The current selection, shown in the header even while `history` is still loading. */
  agentName: AgentName;
  history: AgentVersionHistory | null;
  loading: boolean;
  /** Set when the last `getAgentVersions()` call failed. */
  error?: string | null;
}) {
  const t = useTranslation();

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border">
      <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-border bg-illustrative-bg/50 px-3 py-2">
        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {t("agents.versions.title")}
        </p>
        <span className="shrink-0 truncate font-mono text-caption text-ink-muted">{agentName}</span>
      </header>

      <PanelBody className="flex flex-col gap-2 p-3">
        {error && !loading ? (
          <LiveCallError detail={error} />
        ) : loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !history || history.versions.length === 0 ? (
          <EmptyState>{t("agents.versions.empty")}</EmptyState>
        ) : (
          history.versions.map((v) => {
            const facts: Fact[] = [
              { label: t("agents.versions.version"), value: `:${v.version}` },
              { label: t("ha.fact.status"), value: v.status },
              { label: t("ha.fact.image"), value: v.definition.imageUri, mono: true },
              { label: t("ha.fact.cpu"), value: v.definition.cpu },
              { label: t("ha.fact.memory"), value: v.definition.memory },
              { label: t("ha.fact.registered"), value: formatTime(v.createdAt) },
              {
                label: t("ha.fact.env"),
                value: v.definition.environmentVariableKeys?.length
                  ? v.definition.environmentVariableKeys.join(" · ")
                  : undefined,
                mono: true,
                note: t("ha.envNote"),
              },
            ];
            return (
              <FactList
                key={v.version}
                facts={facts}
                className="rounded-md border border-border bg-illustrative-bg/40 p-3"
              />
            );
          })
        )}
      </PanelBody>

      {history && !loading && !error && (
        <div className="border-t border-border px-3 py-2">
          <ProvenanceBadge provenance={history.provenance} />
        </div>
      )}
    </section>
  );
}
