import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@fluentui/react-components";
import { SendRegular } from "@fluentui/react-icons";
import { EmptyState } from "@/components/EmptyState";
import { type Fact, FactList } from "@/components/FactList";
import { PanelBody } from "@/components/PanelBody";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Skeleton } from "@/components/Skeleton";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import { formatTime } from "@/lib/format";
import type { AgentSummary, RunDetail, RunSummary } from "@/services/contracts";
import { cn } from "@/lib/cn";

/**
 * AGENT › RUN — a real invocation through the agent's own endpoint:
 * `POST /api/agents/:name/invoke` (`DemoDataService.invokeAgent`) — a
 * different call from the copilot's `POST /api/ask`, and not the one this
 * tab used before this rewrite.
 *
 * The flow is exactly three calls, none of them reused from Summary or
 * Versions:
 *  1. `invokeAgent()` — the invocation itself. Its response is used only to
 *     read back `runId` on success; a non-2xx response carries no `runId`
 *     (broker/src/routes/agents.ts), so this component never trusts it for
 *     the record shown on screen.
 *  2. `listRuns()` — refreshed after every invocation attempt, success or
 *     failure, because the broker records a run even when the invocation
 *     itself failed or timed out. This is also how a failed/timed-out run
 *     is *found*, since its id never reaches the client any other way.
 *  3. `getRun(runId)` — the actual detail shown below: `runId, agentName,
 *     status, startedAt, finishedAt, duration, model, prompt, response,
 *     usage, provenance`. Nothing here is derived from `invokeAgent()`'s own
 *     response body, even on the success path.
 *
 * `status` is rendered exactly as the broker returns it — Foundry's own
 * value on success (observed live: "completed"), or the broker's own
 * "failed"/"timeout" — never translated, never invented.
 *
 * Does not stamp the store's `lastAskId`: that value is Gateway's,
 * Observability's and Platform's key into `askStore` (traceId, sessionId,
 * Log Analytics attribution), and a run created here has no entry there —
 * setting it would point those panels at an id that 404s.
 */
export function AgentRun({ agent }: { agent: AgentSummary | null }) {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);

  const [draft, setDraft] = useState("");
  const [isInvoking, setIsInvoking] = useState(false);
  const [invokeError, setInvokeError] = useState<string | null>(null);

  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);

  // A result shown for a different agent than the one now on screen would be
  // misread as this agent's answer — switching agents clears the exchange
  // rather than leaving a stale one attributed to the wrong container.
  useEffect(() => {
    setDraft("");
    setInvokeError(null);
    setRunDetail(null);
    setDetailError(null);
    setRecentRuns([]);
    setRunsError(null);
  }, [targetAgent]);

  const canInvoke = mode === "live" && Boolean(agent) && !isInvoking;

  async function refreshRecentRuns(): Promise<RunSummary[]> {
    try {
      const all = await service.listRuns();
      const forAgent = all.filter((r) => r.agentName === targetAgent);
      setRecentRuns(forAgent);
      setRunsError(null);
      return forAgent;
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  async function loadRunDetail(runId: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await service.getRun(runId);
      setRunDetail(detail);
    } catch (err) {
      setRunDetail(null);
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || !canInvoke) return;

    setInvokeError(null);
    setRunDetail(null);
    setDetailError(null);
    setIsInvoking(true);

    let newRunId: string | null = null;
    try {
      const result = await service.invokeAgent(targetAgent, prompt);
      newRunId = result.runId;
    } catch (err) {
      setInvokeError(err instanceof Error ? err.message : String(err));
    }
    setIsInvoking(false);
    setDraft("");

    const forAgent = await refreshRecentRuns();
    const targetId = newRunId ?? forAgent[0]?.runId ?? null;
    if (targetId) {
      await loadRunDetail(targetId);
    }
  }

  const metaFacts: Fact[] = runDetail
    ? [
        { label: t("agents.run.runId"), value: runDetail.runId, mono: true },
        { label: t("agents.run.agentName"), value: runDetail.agentName },
        { label: t("ha.fact.status"), value: runDetail.status },
        { label: t("agents.run.startedAt"), value: formatTime(runDetail.startedAt) },
        { label: t("agents.run.finishedAt"), value: formatTime(runDetail.finishedAt) },
        { label: t("agents.run.duration"), value: `${(runDetail.duration / 1000).toFixed(1)} s` },
        { label: t("agents.run.model"), value: runDetail.model || undefined },
        {
          label: t("agents.run.usage"),
          value: runDetail.usage ? JSON.stringify(runDetail.usage) : undefined,
          mono: true,
        },
      ]
    : [];

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border">
      <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-border bg-illustrative-bg/50 px-3 py-2">
        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {t("agents.run.title")}
        </p>
        <span className="shrink-0 truncate font-mono text-caption text-ink-muted">{agent?.name}</span>
      </header>

      <PanelBody className="flex flex-col gap-3 p-3">
        {mode !== "live" ? (
          <EmptyState>{t("agents.run.simulationNote")}</EmptyState>
        ) : !runDetail && !invokeError && !detailError && !isInvoking && !detailLoading ? (
          <EmptyState>{t("agents.run.empty")}</EmptyState>
        ) : null}

        {isInvoking && <p className="text-caption text-ink-muted">{t("agents.run.invoking")}</p>}

        {invokeError && !isInvoking && (
          <p className="text-caption text-ink">
            {t("assistant.liveError")} ({invokeError})
          </p>
        )}

        {detailLoading && !isInvoking && <Skeleton className="h-40 w-full" />}

        {detailError && !detailLoading && !isInvoking && (
          <p className="text-caption text-ink">
            {t("assistant.liveError")} ({detailError})
          </p>
        )}

        {runDetail && !isInvoking && !detailLoading && (
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-illustrative-bg/40 p-3">
            <FactList facts={metaFacts} />

            <p className="mt-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t("agents.run.promptLabel")}
            </p>
            <p className="whitespace-pre-wrap break-words text-caption text-ink">{runDetail.prompt}</p>

            <p className="mt-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t("agents.run.answerLabel")}
            </p>
            {runDetail.response ? (
              <p className="whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
                {runDetail.response}
              </p>
            ) : (
              <p className="text-caption italic text-ink-muted">{t("ha.unavailable")}</p>
            )}
          </div>
        )}

        {runsError && <p className="text-caption text-ink-muted">{runsError}</p>}

        {recentRuns.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t("agents.run.recentTitle")}
            </p>
            <ul className="flex flex-col gap-1">
              {recentRuns.map((r) => (
                <li
                  key={r.runId}
                  className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1 text-caption"
                >
                  <span className="min-w-0 truncate font-mono text-ink-muted">{r.runId}</span>
                  <span className="shrink-0 text-ink-muted">{r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PanelBody>

      <form
        onSubmit={handleSubmit}
        className={cn("flex shrink-0 items-center gap-2 border-t border-border p-3")}
      >
        <Input
          value={draft}
          onChange={(_, data) => setDraft(data.value)}
          disabled={!canInvoke}
          className="flex-1"
          placeholder={t("assistant.placeholder")}
        />
        <Button
          type="submit"
          appearance="primary"
          icon={<SendRegular />}
          disabled={!canInvoke || !draft.trim()}
        >
          {isInvoking ? t("assistant.sending") : t("assistant.send")}
        </Button>
      </form>

      <div className="border-t border-border px-3 py-2">
        <ProvenanceBadge
          provenance={runDetail ? runDetail.provenance : { band: mode === "live" ? "live" : "illustrative" }}
        />
      </div>
    </section>
  );
}
