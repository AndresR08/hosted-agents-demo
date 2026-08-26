import { useEffect, useState } from "react";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AgentDetail, AgentSummary, AgentVersionHistory } from "@/services/contracts";
import { cn } from "@/lib/cn";
import { AgentsList } from "./AgentsList";
import { AgentOverview } from "./AgentOverview";
import { AgentRun } from "./AgentRun";
import { AgentVersions } from "./AgentVersions";
import { CreateAgentDialog } from "./CreateAgentDialog";
import { DeleteAgentDialog } from "./DeleteAgentDialog";

type DetailView = "overview" | "versions" | "run";

/**
 * AGENTS — ARCHITECTURE.md The console's home: the
 * registry as a list, a selection, and — for the selected agent — its
 * overview or a real invocation.
 *
 * Reuses broker surfaces that already exist, none of them new:
 *  - `GET /api/agents` (`listAgents()`) — the registry, `foundryAgents.ts`
 *    on the broker. Feeds the list only.
 *  - `GET /api/agents/:name` (`getAgentDetail()`) — the selected agent's
 *    full public definition. Fetched independently of the list, on every
 *    change to `targetAgent` — the Summary panel never reads its fields
 *    from a list row.
 *  - `GET /api/agents/:name/versions` (`getAgentVersions()`) — the selected
 *    agent's full version history. Fetched independently of both the list
 *    and Summary, only while the Versions tab is open.
 *  - `POST /api/maintenance/{warm-agent,test-hosted-agent,
 *    refresh-agent-registry}` (`runMaintenanceAction()`) — the same
 *    diagnostics the presenter menu already exposes, called here per agent.
 *  - `POST /api/ask` (`ask()`, in `AgentRun`) — the same call the copilot
 *    makes.
 *
 * Selection is the store's existing `targetAgent` — the same value the
 * header badge, the keyboard shortcuts and the copilot already target, so
 * picking an agent here is picking it everywhere.
 *
 * Overview, Versions and Run are a small local tab set scoped to the detail
 * pane — not a change to the section-level navigation (`SectionNav` is
 * untouched). Access and Definition (ARCHITECTURE.md) are
 * not built yet; this is where they will join.
 *
 * Create Agent (`CreateAgentDialog`, `POST /api/agents`) is a modal
 * triggered from the list's own header, not a fourth tab — it is not "about"
 * the current selection the way Overview/Versions/Run are. On success it
 * calls only `setTargetAgent(name)` (and switches to the Overview tab); that
 * one store update is what makes the list, Summary and Versions refetch
 * through the exact effects above — this component never patches their
 * state directly for a freshly created agent.
 *
 * Delete Agent (`DeleteAgentDialog`, `DELETE /api/agents/:name`) is the same
 * kind of modal, triggered from the same header, always targeting the
 * current `targetAgent`. On success it does not pick a replacement
 * selection itself — it only bumps `refreshToken`, and the list effect's
 * existing fallback (a `targetAgent` no longer present in the refetched
 * registry resolves to the new `list[0]`) is what moves the selection on.
 */
export function AgentsView() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const setTargetAgent = useDemoStore((s) => s.setTargetAgent);

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(mode === "live");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailView, setDetailView] = useState<DetailView>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(mode === "live");
  const [detailError, setDetailError] = useState<string | null>(null);

  const [versionHistory, setVersionHistory] = useState<AgentVersionHistory | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "live") {
      setAgents([]);
      setListError(null);
      setListLoading(false);
      return;
    }

    let cancelled = false;
    setListLoading(true);
    setListError(null);

    service
      .listAgents()
      .then((list) => {
        if (cancelled) return;
        setAgents(list);
        setListError(null);
        setListLoading(false);

        // Selection must always name a real, registered agent — never one
        // of exactly two hard-coded names. If the current target is not (or
        // is no longer) in the registry, fall back to the first row.
        const resolvedTarget = list.some((a) => a.name === targetAgent)
          ? targetAgent
          : list[0]?.name;
        if (resolvedTarget && resolvedTarget !== targetAgent) {
          setTargetAgent(resolvedTarget);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAgents([]);
        setListError(err instanceof Error ? err.message : String(err));
        setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, targetAgent, service, setTargetAgent, refreshToken]);

  // The Summary panel's own data source — one call per selection, never the
  // list's rows. Deliberately its own effect, keyed only on `targetAgent`:
  // every change to the selection fires exactly one fresh
  // `GET /api/agents/:name`, whether or not the list has finished loading.
  useEffect(() => {
    if (mode !== "live") {
      setAgentDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    service
      .getAgentDetail(targetAgent)
      .then((detail) => {
        if (cancelled) return;
        setAgentDetail(detail);
        setDetailLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setAgentDetail(null);
        setDetailError(err instanceof Error ? err.message : String(err));
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, targetAgent, service]);

  // The Versions panel's own data source — `GET /api/agents/:name/versions`,
  // never derived from `agentDetail` or `agents`. Gated on the tab being
  // open (unlike Summary's effect above): a presenter who never opens
  // Versions for a given agent should not pay for that call. Keying on
  // `detailView` too means every time this tab becomes active — whether
  // because the agent changed or because the presenter switched back to it —
  // the history is re-fetched rather than shown stale.
  useEffect(() => {
    if (mode !== "live" || detailView !== "versions") {
      setVersionHistory(null);
      setVersionsError(null);
      setVersionsLoading(false);
      return;
    }

    let cancelled = false;
    setVersionsLoading(true);
    setVersionsError(null);

    service
      .getAgentVersions(targetAgent)
      .then((history) => {
        if (cancelled) return;
        setVersionHistory(history);
        setVersionsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setVersionHistory(null);
        setVersionsError(err instanceof Error ? err.message : String(err));
        setVersionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, targetAgent, detailView, service]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await service.runMaintenanceAction("refresh-agent-registry");
    } catch {
      // Best-effort — the refetch below still runs and surfaces any real failure.
    }
    setRefreshToken((n) => n + 1);
    setRefreshing(false);
  }

  const selectedAgent = agents.find((a) => a.name === targetAgent) ?? null;
  const band = mode === "live" ? "live" : "illustrative";

  return (
    <StopFrame
      title={t("agents.heading")}
      question={t("agents.question")}
      provenance={<ProvenanceBadge provenance={{ band }} />}
    >
      <div className="flex min-w-0 gap-4">
        <div className="w-[300px] shrink-0">
          <AgentsList
            agents={agents}
            selected={targetAgent}
            onSelect={setTargetAgent}
            loading={listLoading}
            error={listError}
            emptyMessage={mode !== "live" ? t("ha.simulation") : undefined}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onCreate={() => setCreateOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 gap-1" role="tablist">
            <DetailTab
              active={detailView === "overview"}
              onClick={() => setDetailView("overview")}
              label={t("agents.overview.title")}
            />
            <DetailTab
              active={detailView === "versions"}
              onClick={() => setDetailView("versions")}
              label={t("agents.versions.title")}
            />
            <DetailTab
              active={detailView === "run"}
              onClick={() => setDetailView("run")}
              label={t("agents.run.title")}
            />
          </div>

          {detailView === "overview" ? (
            <AgentOverview
              agentName={targetAgent}
              agent={agentDetail}
              loading={detailLoading}
              error={detailError}
            />
          ) : detailView === "versions" ? (
            <AgentVersions
              agentName={targetAgent}
              history={versionHistory}
              loading={versionsLoading}
              error={versionsError}
            />
          ) : (
            <AgentRun agent={selectedAgent} />
          )}
        </div>
      </div>

      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          setTargetAgent(name);
          setDetailView("overview");
        }}
      />

      <DeleteAgentDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        agentName={targetAgent}
        onDeleted={() => {
          setDetailView("overview");
          setRefreshToken((n) => n + 1);
        }}
      />
    </StopFrame>
  );
}

/** The Overview / Run pair — local to the detail pane, not section-level navigation. */
function DetailTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-caption",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        active
          ? "bg-accent/[0.08] font-semibold text-ink"
          : "text-ink-muted hover:bg-illustrative-bg/70 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
