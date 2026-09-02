import { useState } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowExpandRegular, CheckmarkRegular, CopyRegular } from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useTranslation } from "@/i18n/useTranslation";
import type { RequestObservability } from "@/services/contracts";
import { ObservableValue } from "./ObservableValue";
import { ObservabilityDetailDialog } from "./ObservabilityDetailDialog";
import { ObservabilitySubNav } from "./ObservabilitySubNav";
import { AuditRecordSection } from "./AuditRecordSection";
import { TelemetryEmptyState, useRequestObservability } from "./useRequestObservability";

/**
 * Two lines of prompt and two of completion, expandable.
 *
 * A line clamp rather than a character budget: see the comment at the point of
 * use. `-webkit-line-clamp` is the only cross-browser way to do this today and
 * works in every Chromium and WebKit browser this console is presented from.
 */
const CLAMP_2_LINES: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/**
 * OBSERVABILITY / RECORD — "what was asked, and what was answered?"
 *
 * The first half of what used to be one Observability screen. It split because
 * with real data loaded the screen held 936px of content in a 508px budget —
 * 428px below the fold, invisible to the room — and could not be reflowed,
 * because it was not one argument rendered loosely but two arguments sharing a
 * surface. The measurements are now `MeasurementsStop`, one tab away.
 *
 * The boundary is one the content already had: a compliance function wants the
 * record of what was asked and answered, an architect wants what it cost. They
 * come from different queries and neither is a detail of the other.
 *
 * A NOTE ON HOW THIS WAS MISSED FOR SO LONG. Every earlier measurement of this
 * screen was taken before the live data arrived, and an empty screen measures
 * small — 383px against a 412px budget, which was reported as resolved. Log
 * Analytics ingests the gateway logs one to three minutes after an answer, so
 * the state a presenter actually shows is never the state a fresh page load
 * shows. Measure with real data loaded, on every screen that has an empty
 * state.
 *
 * Two evidence groups, deliberately independent of each other:
 *
 *  - `AuditRecordSection` — the platform's own durable log
 *    (`ApiManagementGatewayLlmLog`, via `getAuditRecord()`), for whichever
 *    agent is selected. Needs no `lastAskId`, so it has something real to
 *    show on a cold page load, not only after this browser session has
 *    asked something.
 *  - Everything below it — one request, read three ways: what was asked and
 *    answered, what it measured, and the technical detail behind both,
 *    scoped to `lastAskId` (the most recent ask *this session* made) via
 *    `getRequestObservability()`. `ApiManagementGatewayLlmLog` for the
 *    conversation and token counts, `ApiManagementGatewayLogs` for per-hop
 *    timing (`HopWaterfall`), Application Insights for the distributed
 *    trace. That scoping is a real constraint of per-request correlation —
 *    there is no broker-side history to browse — not a demo artifact, which
 *    is why it stays as-is rather than being merged into the section above.
 *
 * The governance catalogue used to share this surface as a third tab. It moved
 * to Platform, because "what evidence exists for this request" and "what
 * does my team administer" are different questions with different audiences,
 * and a tab strip was hiding the fact that this panel was answering two.
 *
 * The honesty contract is structural: fields arrive wrapped as
 * `{ value, source, available }` and render through `ObservableValue`, which
 * prints "Unavailable in this deployment" rather than a zero. There is no code
 * path here that can display a fabricated number.
 */
export function ObservabilityStop() {
  const t = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { obs, checked, obsError, hasData, mode, lastAskId } = useRequestObservability();


  function copyRecord() {
    if (!obs) return;
    const lines = [
      `${t("obs.field.timestamp")}: ${obs.audit.timestamp.value ?? "-"}`,
      `${t("obs.field.agent")}: ${obs.audit.agentName.value}${obs.audit.agentVersion.value ?? ""}`,
      `${t("obs.field.model")}: ${obs.audit.model.value ?? "-"}`,
      `${t("obs.field.status")}: ${obs.audit.httpStatus.value ?? "-"}`,
      `${t("obs.field.latency")}: ${obs.audit.latencyMs.value ?? "-"} ms`,
      "",
      `${t("obs.prompt")}: ${obs.audit.prompt.value ?? "-"}`,
      `${t("obs.completion")}: ${obs.audit.completion.value ?? "-"}`,
    ];
    navigator.clipboard?.writeText(lines.join("\n")).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <StopFrame
      title={t("obs.heading")}
      question={t("obsRecord.question")}
      action={
        <>
          <ObservabilitySubNav />
          {hasData && (
            <Tooltip content={t("obs.copy")} relationship="label">
              <Button
                appearance="subtle"
                icon={copied ? <CheckmarkRegular className="text-accent" /> : <CopyRegular />}
                onClick={copyRecord}
                aria-label={t("obs.copy")}
              />
            </Tooltip>
          )}
          <Button
            appearance="secondary"
            icon={<ArrowExpandRegular />}
            disabled={!hasData}
            onClick={() => setDetailOpen(true)}
          >
            {t("obs.expand")}
          </Button>
        </>
      }
      provenance={
        <ProvenanceBadge
          provenance={obs?.provenance ?? { band: mode === "live" ? "live-delayed" : "illustrative" }}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <AuditRecordSection />

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("obs.session.title")}
          </p>
          {!hasData ? (
            <TelemetryEmptyState
              mode={mode}
              checked={checked}
              hasAsk={Boolean(lastAskId)}
              error={obsError}
            />
          ) : (
            <AuditSection obs={obs!} />
          )}
        </div>
      </div>

      <ObservabilityDetailDialog open={detailOpen} onClose={() => setDetailOpen(false)} obs={obs} />
    </StopFrame>
  );
}

/** The conversation record, made readable — the artefact a compliance function asks for. */
function AuditSection({ obs }: { obs: RequestObservability }) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const a = obs.audit;
  const prompt = String(a.prompt.value ?? "");
  const completion = String(a.completion.value ?? "");
  // Short enough that the record, the timeline and the tiles all fit above the
  // fold at 1366×768. "Show full messages" is one click away for the architect
  // who wants the whole artefact.

  /*
   * gap-1.5, not gap-2.5. The Record tab now carries two record cards - the
   * durable log and this session's request - where it used to carry one beside
   * the measurements, and it landed at 466px against a 473px budget. That is
   * the zero-margin trap Platform already taught us. Pure spacing: nothing
   * removed, no statement softened, and both context notes kept because each
   * one qualifies a different prompt.
   */
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
        <span className="font-medium text-ink">
          {a.agentName.value}
          <span className="text-ink-muted">{a.agentVersion.value}</span>
        </span>
        <Chip><ObservableValue field={a.framework} /></Chip>
        <Chip><ObservableValue field={a.model} /></Chip>
        <Chip>
          <ObservableValue
            field={a.httpStatus}
            className={
              a.httpStatus.available && Number(a.httpStatus.value) < 400 ? "text-accent" : undefined
            }
          />
        </Chip>
        <Chip><ObservableValue field={a.timestamp} mono /></Chip>
      </div>

      {/*
        The record itself, at body size and held to a reading measure. It is
        the artefact a compliance function asks for, so it is the one thing on
        this stop that is meant to be read rather than scanned.
      */}
      {/*
        Clamped by LINES, not by characters.

        This was `s.slice(0, 280)`, and a character count cannot know how many
        lines it becomes: the same 280 characters were three lines on the old
        full-width stage and six once the navigation rail took 250px off it.
        That is most of why this screen was 149px over budget at 1366x768 while
        the arithmetic said it should fit. Two lines is two lines at every
        width, so the block has a height the layout can rely on.

        Nothing is hidden that was not already hidden - "show full messages" is
        the same control it always was, and it now toggles the clamp rather
        than a substring, so expanding shows the whole artefact instead of the
        first 280 characters of it.
      */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="mb-0.5 text-caption font-medium uppercase tracking-[0.04em] text-ink-muted">
            {t("obs.prompt")}
          </p>
          <p
            className="max-w-[70ch] whitespace-pre-wrap break-words text-body leading-relaxed text-ink"
            style={expanded ? undefined : CLAMP_2_LINES}
          >
            {prompt}
          </p>
        </div>

        <div className="min-w-0">
          <p className="mb-0.5 text-caption font-medium uppercase tracking-[0.04em] text-ink-muted">
            {t("obs.completion")}
          </p>
          <p
            className="max-w-[70ch] whitespace-pre-wrap break-words text-body leading-relaxed text-ink"
            style={expanded ? undefined : CLAMP_2_LINES}
          >
            {completion}
          </p>
        </div>
      </div>

              <Button
          appearance="subtle"
          size="small"
          className="self-start"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("obs.showLess") : t("obs.showMore")}
        </Button>

      {obs.audit.contextInjected && (
        <p className="text-caption italic text-ink-muted">{t("obs.contextInjected")}</p>
      )}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 leading-none">{children}</span>
  );
}
