import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import { EmptyState } from "@/components/EmptyState";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Skeleton } from "@/components/Skeleton";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AuditRecord } from "@/services/contracts";

/** Freshness only — this section is supplementary evidence, not something being awaited. */
const POLL_INTERVAL_MS = 30_000;
const LONG = 280;

/**
 * The durable audit record — `GET /api/audit-record` (`getAuditRecord()`),
 * queried directly against `ApiManagementGatewayLlmLog`.
 *
 * Deliberately independent of `lastAskId`: the rest of this stop shows
 * evidence for *the request this browser session just made*, which is empty
 * on a fresh page load or after a broker restart. This block needs neither —
 * it reads the platform's own log for whichever agent is selected, so there
 * is real evidence to show even before anything has been asked here. That
 * independence is the whole point: the "ask a question first" pattern below
 * is a legitimate constraint of per-request correlation, not a screen this
 * capability should also inherit.
 *
 * Not a new endpoint and not new logic — `getAuditRecord` already existed on
 * the broker and in the service contract; it simply had no caller.
 */
export function AuditRecordSection() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);

  const [record, setRecord] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(mode === "live");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (mode !== "live") {
      setRecord(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    function load() {
      service
        .getAuditRecord(targetAgent)
        .then((result) => {
          if (!cancelled) setRecord(result);
        })
        .catch(() => {
          if (!cancelled) setRecord(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    load();
    const interval = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, targetAgent, service]);

  const prompt = record?.prompt ?? "";
  const completion = record?.completion ?? "";
  const clip = (s: string) => (expanded || s.length <= LONG ? s : `${s.slice(0, LONG)}…`);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("obs.auditRecord.title")}
          </p>
          <p className="mt-0.5 text-caption leading-snug text-ink-muted">
            {t("obs.auditRecord.sourceNote")}
          </p>
        </div>
        {record && <ProvenanceBadge provenance={record.provenance} />}
      </div>

      {loading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="w-1/3" />
          <Skeleton className="w-full" />
          <Skeleton className="w-2/3" />
        </div>
      ) : mode !== "live" ? (
        <EmptyState>{t("obs.auditRecord.simulation")}</EmptyState>
      ) : !record ? (
        <EmptyState>{t("obs.auditRecord.empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-illustrative-bg/40 p-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
            {record.attributionAvailable ? (
              <span className="font-medium text-ink">
                {record.agentName}
                <span className="text-ink-muted">{record.agentVersion}</span>
              </span>
            ) : (
              <span className="italic text-ink-muted">{t("obs.auditRecord.notAttributed")}</span>
            )}
            <Chip>{record.modelName}</Chip>
            <Chip>{record.subscriptionName}</Chip>
            <Chip mono>{new Date(record.timestamp).toLocaleString()}</Chip>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="mb-0.5 text-caption font-medium uppercase tracking-[0.04em] text-ink-muted">
                {t("obs.prompt")}
              </p>
              <p className="max-w-[70ch] whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
                {clip(prompt)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-caption font-medium uppercase tracking-[0.04em] text-ink-muted">
                {t("obs.completion")}
              </p>
              <p className="max-w-[70ch] whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
                {clip(completion)}
              </p>
            </div>
          </div>

          {(prompt.length > LONG || completion.length > LONG) && (
            <Button
              appearance="subtle"
              size="small"
              className="self-start"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t("obs.showLess") : t("obs.showMore")}
            </Button>
          )}

          {record.contextInjected && (
            <p className="text-caption italic text-ink-muted">{t("obs.contextInjected")}</p>
          )}
        </div>
      )}
    </section>
  );
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={mono ? "rounded border border-border px-1.5 py-0.5 font-mono leading-none" : "rounded border border-border px-1.5 py-0.5 leading-none"}>
      {children}
    </span>
  );
}
