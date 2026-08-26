import { useEffect, useState } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import {
  ArrowExpandRegular,
  CheckmarkRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  CopyRegular,
} from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import type { ObservableField, RequestObservability } from "@/services/contracts";
import { cn } from "@/lib/cn";
import { FieldRow, ObservableValue, fmt } from "./ObservableValue";
import { ObservabilityDetailDialog } from "./ObservabilityDetailDialog";
import { AuditRecordSection } from "./AuditRecordSection";

/** Log Analytics runs 1–3 min behind, so a just-asked request needs re-checking. */
const POLL_INTERVAL_MS = 20_000;

/**
 * OBSERVABILITY — "what evidence does the platform generate?"
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
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const lastAskId = useDemoStore((s) => s.lastAskId);

  const [obs, setObs] = useState<RequestObservability | null>(null);
  const [checked, setChecked] = useState(false);
  /**
   * Set only for a genuine fetch failure (network error, 5xx) — never for the
   * honest "this askId is unknown" `null` (see `azureService.ts`). Kept
   * separate from `obs`/`checked` so the empty state can tell "the broker
   * could not be reached" apart from "this request has no correlation left",
   * instead of both collapsing into one message that fits neither.
   */
  const [obsError, setObsError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode !== "live" || !lastAskId) {
      setObs(null);
      setObsError(null);
      setChecked(mode !== "live");
      return;
    }
    let cancelled = false;

    function poll() {
      service
        .getRequestObservability(lastAskId!)
        .then((result) => {
          if (cancelled) return;
          setObs(result);
          setObsError(null);
          setChecked(true);
        })
        .catch((err) => {
          if (cancelled) return;
          setObs(null);
          setObsError(err instanceof Error ? err.message : String(err));
          setChecked(true);
        });
    }
    poll();
    // Tokens and per-hop timing land a minute or two after the answer does, so
    // the panel fills in rather than staying empty.
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, lastAskId, service]);

  const hasData = Boolean(obs);

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
      question={t("obs.question")}
      action={
        <>
          {hasData && (
            <Tooltip content={t("obs.copy")} relationship="label">
              <Button
                appearance="subtle"
                icon={copied ? <CheckmarkRegular className="text-affirm" /> : <CopyRegular />}
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
      <div className="flex flex-col gap-5">
        <AuditRecordSection />

        <div className="border-t border-border pt-4">
          <p className="mb-2.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
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
            <div className="flex flex-col gap-5">
              <KpiBand obs={obs!} />
              <AuditSection obs={obs!} />
              <HopWaterfall obs={obs!} />
              <TechnicalDetails obs={obs!} />
            </div>
          )}
        </div>
      </div>

      <ObservabilityDetailDialog open={detailOpen} onClose={() => setDetailOpen(false)} obs={obs} />
    </StopFrame>
  );
}

function TelemetryEmptyState({
  mode,
  checked,
  hasAsk,
  error,
}: {
  mode: string;
  checked: boolean;
  hasAsk: boolean;
  /** A genuine fetch failure (network, 5xx) — takes priority over every other message once set. */
  error: string | null;
}) {
  const t = useTranslation();

  // A real failure to reach the broker is not "telemetry is still landing" —
  // reuse the same error pattern every other write/read in this app shows,
  // rather than folding it into the same copy as the honest 404 case below.
  if (mode === "live" && error) {
    return <EmptyState>{`${t("assistant.liveError")} (${error})`}</EmptyState>;
  }

  const message =
    mode !== "live"
      ? t("obs.empty.simulation")
      : !hasAsk
        ? t("obs.empty.noRequest")
        : checked
          ? t("obs.empty.unknownAsk")
          : t("obs.empty.loading");
  return <EmptyState>{message}</EmptyState>;
}

/**
 * The figures worth reading at a glance.
 *
 * Six tiles, all measurements. The model and agent tiles that used to sit here
 * were removed: both are already stated on the audit record two rows below,
 * and a KPI tile whose value is a name is not a measurement — it is a label
 * dressed as one.
 */
function KpiBand({ obs }: { obs: RequestObservability }) {
  const t = useTranslation();
  const i = obs.inference;

  const tiles: { label: string; field?: ObservableField<string | number>; format?: (v: string | number) => string; accent?: boolean }[] = [
    { label: t("obs.kpi.totalLatency"), field: i.latencyMs, format: fmt.ms },
    { label: t("obs.kpi.gatewayOverhead"), field: gatewayTotal(obs), format: fmt.ms, accent: true },
    { label: t("obs.kpi.modelLatency"), field: i.modelCallMs, format: fmt.ms },
    { label: t("obs.kpi.totalTokens"), field: i.totalTokens, format: fmt.int },
    { label: t("obs.kpi.promptTokens"), field: i.inputTokens, format: fmt.int },
    { label: t("obs.kpi.completionTokens"), field: i.outputTokens, format: fmt.int },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="min-w-0 rounded-md border border-border bg-illustrative-bg/40 px-2.5 py-2"
        >
          <p className="truncate text-caption uppercase tracking-[0.04em] text-ink-muted" title={tile.label}>
            {tile.label}
          </p>
          <p className="mt-0.5 truncate">
            <ObservableValue
              field={tile.field}
              format={tile.format}
              className={cn(
                "text-body font-semibold tabular-nums",
                tile.accent && tile.field?.available && "text-affirm",
              )}
            />
          </p>
        </div>
      ))}
    </div>
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
  const LONG = 280;
  const clip = (s: string) => (expanded || s.length <= LONG ? s : `${s.slice(0, LONG)}…`);

  return (
    <section className="flex flex-col gap-2.5">
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
              a.httpStatus.available && Number(a.httpStatus.value) < 400 ? "text-affirm" : undefined
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

      {obs.audit.contextInjected && (
        <p className="text-caption italic text-ink-muted">{t("obs.contextInjected")}</p>
      )}
    </section>
  );
}

/**
 * The request as a waterfall, one row per stage, each with its measured
 * duration and a proportional bar.
 *
 * Only stages API Management actually measured get a number. The gateway
 * records `TotalTime` and `BackendTime` per hop, which yields its own cost and
 * the backend's — it does not time the inbound and return legs separately, so
 * no row here claims a figure for "the response travelling back".
 *
 * The gateway rows carry a minimum bar width because at true scale they would
 * be sub-pixel — which is precisely the finding, so the number stays exact and
 * the bar is only a reading aid.
 */
function HopWaterfall({ obs }: { obs: RequestObservability }) {
  const t = useTranslation();
  const i = obs.inference;

  const total = i.latencyMs?.available ? Number(i.latencyMs.value) : null;
  const gateway1 = i.gatewayOverheadMs?.available ? Number(i.gatewayOverheadMs.value) : null;
  const modelCall = i.modelCallMs?.available ? Number(i.modelCallMs.value) : null;
  const gateway2 = i.modelGatewayOverheadMs?.available ? Number(i.modelGatewayOverheadMs.value) : null;

  if (total === null || modelCall === null) {
    return (
      <section>
        <SubHeading>{t("obs.timeline.title")}</SubHeading>
        <p className="text-caption italic text-ink-muted">{t("obs.timeline.pending")}</p>
      </section>
    );
  }

  const agent = Math.max(0, total - modelCall - (gateway1 ?? 0));
  const stages = [
    { key: "apim-in", label: t("obs.hop.apimInbound"), sub: t("obs.hop.apimInboundSub"), ms: gateway1, tone: "affirm" as const },
    { key: "agent", label: t("obs.hop.agent"), sub: t("obs.hop.agentSub"), ms: agent, tone: "muted" as const },
    { key: "apim-model", label: t("obs.hop.apimModel"), sub: t("obs.hop.apimModelSub"), ms: gateway2, tone: "affirm" as const },
    { key: "model", label: t("obs.hop.model"), sub: t("obs.hop.modelSub"), ms: modelCall, tone: "accent" as const },
  ].filter((s) => s.ms !== null) as { key: string; label: string; sub: string; ms: number; tone: "affirm" | "muted" | "accent" }[];

  return (
    <section>
      <SubHeading>{t("obs.timeline.title")}</SubHeading>
      <ul className="flex flex-col gap-1">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="w-[120px] shrink-0 truncate text-caption text-ink" title={s.label}>
              {s.label}
            </span>
            <span className="hidden w-[96px] shrink-0 truncate text-caption text-ink-muted sm:block" title={s.sub}>
              {s.sub}
            </span>
            <span className="h-2 min-w-0 flex-1 rounded-full bg-illustrative-bg">
              <span
                className={cn(
                  "block h-full rounded-full",
                  s.tone === "affirm" && "bg-affirm",
                  s.tone === "accent" && "bg-accent",
                  s.tone === "muted" && "bg-ink-muted/40",
                )}
                style={{ width: `${Math.max(1.5, (s.ms / total) * 100)}%` }}
              />
            </span>
            <span
              className={cn(
                "w-[70px] shrink-0 text-right text-caption font-medium tabular-nums",
                s.tone === "affirm" ? "text-affirm" : "text-ink",
              )}
            >
              {fmt.ms(s.ms)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-border pt-1.5">
        <span className="text-caption font-medium text-ink">{t("obs.hop.total")}</span>
        <span className="text-caption font-semibold tabular-nums text-ink">{fmt.ms(total)}</span>
      </p>
    </section>
  );
}

/**
 * Technical depth, collapsed by default. An executive reads the tiles and the
 * waterfall; an architect opens this. Putting identifiers first was the old
 * panel's mistake — correct data in the wrong order still reads as a dump.
 */
function TechnicalDetails({ obs }: { obs: RequestObservability }) {
  const t = useTranslation();
  const i = obs.inference;
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded py-1 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-expanded={open}
      >
        {open ? <ChevronDownRegular fontSize={12} /> : <ChevronRightRegular fontSize={12} />}
        {t("obs.group.technical")}
      </button>

      {open && (
        <div className="grid animate-fade-slide-in grid-cols-3 gap-x-6 pl-4">
          <Group title={t("obs.group.execution")}>
            <FieldRow label={t("obs.field.framework")} field={i.framework} />
            <FieldRow label={t("obs.field.deployment")} field={i.deployment} mono />
            <FieldRow label={t("obs.field.gatewayApi")} field={i.gatewayApi} mono />
            <FieldRow label={t("obs.field.subscription")} field={i.subscription} mono />
            <FieldRow label={t("obs.field.agentServer")} field={i.agentServerMs} format={fmt.ms} />
          </Group>

          <Group title={t("obs.group.tokens")}>
            <FieldRow label={t("obs.field.corroborated")} field={i.tokensCorroboratedBy} />
            <FieldRow label={t("obs.field.promptChars")} field={i.promptChars} format={fmt.int} />
            <FieldRow label={t("obs.field.completionChars")} field={i.completionChars} format={fmt.int} />
          </Group>

          <Group title={t("obs.group.identity")}>
            <FieldRow label={t("obs.field.requestId")} field={i.requestId} format={fmt.id} mono />
            <FieldRow label={t("obs.field.correlationId")} field={i.correlationId} format={fmt.id} mono />
            <FieldRow label={t("obs.field.traceId")} field={i.traceId} format={fmt.id} mono />
            <FieldRow label={t("obs.field.conversationId")} field={i.conversationId} format={fmt.id} mono />
          </Group>
        </div>
      )}
    </section>
  );
}

/**
 * API Management's total processing cost across both hops.
 *
 * Derived in the browser rather than added to the broker contract: it is the
 * sum of two figures the gateway already measured and already returns, so
 * combining them is presentation, not new telemetry. Reports unavailable
 * unless at least one hop has been measured — never a zero.
 */
function gatewayTotal(obs: RequestObservability): ObservableField<number> {
  const hop1 = obs.inference.gatewayOverheadMs;
  const hop2 = obs.inference.modelGatewayOverheadMs;
  const source = "ApiManagementGatewayLogs — TotalTime − BackendTime, both hops";

  if (!hop1?.available && !hop2?.available) {
    return {
      value: null,
      source,
      available: false,
      reason: hop1?.reason ?? "Gateway timing not yet ingested",
    };
  }
  return {
    value: (hop1?.available ? Number(hop1.value) : 0) + (hop2?.available ? Number(hop2.value) : 0),
    source,
    available: true,
  };
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
      {children}
    </p>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 leading-none">{children}</span>
  );
}
