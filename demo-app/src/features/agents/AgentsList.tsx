import { Badge, Button, Tooltip } from "@fluentui/react-components";
import { AddRegular, ArrowClockwiseRegular, BotFilled, DeleteRegular } from "@fluentui/react-icons";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { LiveCallError } from "@/components/LiveCallError";
import { useTranslation } from "@/i18n/useTranslation";
import type { AgentName } from "@/state/types";
import type { AgentSummary } from "@/services/contracts";
import { cn } from "@/lib/cn";

/**
 * The registry, as a list — ARCHITECTURE.md "Agents".
 *
 * One row per agent `GET /api/agents` (broker `routes/agents.ts`,
 * `foundryAgents.ts`) actually returns. No row is invented, and the list
 * is exactly as long as the live registry, not fixed at two — the
 * component itself makes no assumption about how many agents exist.
 */
export function AgentsList({
  agents,
  selected,
  onSelect,
  loading,
  error,
  emptyMessage,
  onRefresh,
  refreshing,
  onCreate,
  onDelete,
}: {
  agents: AgentSummary[];
  selected: AgentName | null;
  onSelect: (name: AgentName) => void;
  loading: boolean;
  /** Set when the last `listAgents()` call failed — mutually exclusive with `agents`. */
  error?: string | null;
  emptyMessage?: string;
  onRefresh: () => void;
  refreshing: boolean;
  /** Opens the Create Agent dialog (`CreateAgentDialog`, rendered by `AgentsView`). */
  onCreate: () => void;
  /** Opens the Delete Agent dialog (`DeleteAgentDialog`, rendered by `AgentsView`) for `selected`. */
  onDelete: () => void;
}) {
  const t = useTranslation();

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-illustrative-bg/50 px-3 py-2">
        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {t("agents.list.title")}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content={t("agents.create.trigger")} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<AddRegular />}
              aria-label={t("agents.create.trigger")}
              onClick={onCreate}
            />
          </Tooltip>
          <Tooltip content={t("maintenance.action.refresh-agent-registry")} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowClockwiseRegular className={cn(refreshing && "animate-spin")} />}
              aria-label={t("maintenance.action.refresh-agent-registry")}
              disabled={refreshing}
              onClick={onRefresh}
            />
          </Tooltip>
          <Tooltip content={t("agents.delete.trigger")} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular />}
              aria-label={t("agents.delete.trigger")}
              disabled={!selected || agents.length === 0}
              onClick={onDelete}
            />
          </Tooltip>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <LiveCallError detail={error} className="px-3 py-2.5" />
      ) : agents.length === 0 ? (
        <EmptyState className="px-3">{emptyMessage ?? t("agents.list.empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {agents.map((agent) => {
            const isSelected = agent.name === selected;
            return (
              <li key={agent.name} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelect(agent.name)}
                  className={cn(
                    "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                    /*
                      The reference's selected card: a brand-tinted fill with
                      a brand edge. --color-brand-tint is #fff5f5 in light and
                      #2a1520 in dark, and --color-ink measures 14.27:1 and
                      14.56:1 on them respectively, so the card's own text is
                      unaffected by being selected.
                    */
                    isSelected
                      ? "bg-brand-tint shadow-[inset_2px_0_0_0_var(--color-brand)]"
                      : "hover:bg-illustrative-bg/60",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <BotFilled
                      fontSize={16}
                      className={cn("shrink-0", isSelected ? "text-brand-ink" : "text-ink-muted")}
                    />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                      {agent.name}
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        /*
                          The reference paints this dot GREEN. It is brand
                          crimson here, and that is the third time a supplied
                          mockup has asked for a "healthy" green and not got
                          it: --color-affirm is the 401 rejection in the
                          Credentials panel and nothing else (4.4/4.5, F4).
                          The colour changed from accent to brand with the
                          Figma adoption; what it must never be is green.
                        */
                        agent.status === "Running" ? "bg-brand" : "bg-ink-muted",
                      )}
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-caption text-ink-muted">{agent.status}</span>
                  </span>

                  {agent.description && (
                    <span className="truncate text-caption text-ink-muted">{agent.description}</span>
                  )}

                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-ink-muted">
                    <Badge appearance="tint" size="small" color="informative">
                      {agent.framework}
                    </Badge>
                    <span className="truncate font-mono">{agent.version}</span>
                    {agent.cpu && (
                      <span className="shrink-0">
                        &middot; {t("ha.fact.cpu")} {agent.cpu}
                      </span>
                    )}
                    {agent.memory && (
                      <span className="shrink-0">
                        &middot; {t("ha.fact.memory")} {agent.memory}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
