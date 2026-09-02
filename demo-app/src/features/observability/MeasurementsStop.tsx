import { useState } from "react";
import { ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useTranslation } from "@/i18n/useTranslation";
import type { ObservableField, RequestObservability } from "@/services/contracts";
import { cn } from "@/lib/cn";
import { FieldRow, ObservableValue, fmt } from "./ObservableValue";
import { ObservabilitySubNav } from "./ObservabilitySubNav";
import { TelemetryEmptyState, useRequestObservability } from "./useRequestObservability";

/**
 * OBSERVABILITY / MEASUREMENTS — "what did this request cost?"
 *
 * The second half of what used to be one Observability screen. The split was
 * forced by measurement, not preference: with real data loaded, that screen
 * held 936px of content in a 508px budget — 428px of it below the fold, and
 * therefore never seen by the room. It could not be reflowed, because it was
 * not one argument rendered loosely; it was two arguments sharing a surface.
 *
 * The boundary is the one the content already had. "What evidence does the
 * platform generate?" has two different answers: there is a durable RECORD of
 * what was asked and answered, which a compliance function cares about, and
 * there are MEASUREMENTS of what it cost, which an architect cares about. They
 * come from different queries, they are read by different people, and neither
 * is a detail of the other.
 *
 * This tab is the measurements: the six tiles, the per-hop waterfall, and the
 * technical detail behind both.
 *
 * WHY THE EARLIER MEASUREMENT SAID THIS SCREEN WAS FINE
 *
 * It was taken before the live data arrived. Both Observability tabs fill in
 * one to three minutes after an answer, because Log Analytics ingests the
 * gateway logs on its own schedule, and an empty screen measures small. The
 * rule that came out of it: measure with real data loaded, never in the empty
 * state, on every screen that has one.
 */
export function MeasurementsStop() {
  const t = useTranslation();
  const { obs, checked, obsError, hasData, mode, lastAskId } = useRequestObservability();

  return (
    <StopFrame
      title={t("obs.heading")}
      question={t("obsMeasurements.question")}
      action={<ObservabilitySubNav />}
      footer={t("obsMeasurements.caption")}
      provenance={
        <ProvenanceBadge
          provenance={obs?.provenance ?? { band: mode === "live" ? "live-delayed" : "illustrative" }}
        />
      }
    >
      {!hasData ? (
        <TelemetryEmptyState
          mode={mode}
          checked={checked}
          hasAsk={Boolean(lastAskId)}
          error={obsError}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <KpiBand obs={obs!} />
          <HopWaterfall obs={obs!} />
          <TechnicalDetails obs={obs!} />
        </div>
      )}
    </StopFrame>
  );
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
          {/*
            Wrapping, not truncating. The rail took 250px off the stage and six
            tiles across 1020px left "Latencia del modelo" rendering as
            "LATENCIA DEL ...", which the room cannot read and a tooltip does
            not help with from the back of a room. The tile grows by one line
            instead; this screen has 243px of margin and a label that does not
            say what it labels is not a saving.
          */}
          <p className="text-caption uppercase leading-tight tracking-[0.04em] text-ink-muted">
            {tile.label}
          </p>
          <p className="mt-0.5 truncate">
            <ObservableValue
              field={tile.field}
              format={tile.format}
              className={cn(
                "text-body font-semibold tabular-nums",
                tile.accent && tile.field?.available && "text-accent",
              )}
            />
          </p>
        </div>
      ))}
    </div>
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
    { key: "apim-in", label: t("obs.hop.apimInbound"), sub: t("obs.hop.apimInboundSub"), ms: gateway1, tone: "gateway" as const },
    { key: "agent", label: t("obs.hop.agent"), sub: t("obs.hop.agentSub"), ms: agent, tone: "backend" as const },
    { key: "apim-model", label: t("obs.hop.apimModel"), sub: t("obs.hop.apimModelSub"), ms: gateway2, tone: "gateway" as const },
    { key: "model", label: t("obs.hop.model"), sub: t("obs.hop.modelSub"), ms: modelCall, tone: "backend" as const },
  ].filter((s) => s.ms !== null) as { key: string; label: string; sub: string; ms: number; tone: "gateway" | "backend" }[];

  return (
    <section>
      <SubHeading>{t("obs.timeline.title")}</SubHeading>
      <ul className="flex flex-col gap-1">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            {/*
              Widened and wrapping, for the same reason as the tiles above: at
              120px "API Management (entrada)" rendered as "API Manageme..."
              and its own qualifier as "procesamie...", so the waterfall named
              none of its stages. The rows are the argument - which stage cost
              what - and a stage nobody can name makes the bars decorative.
            */}
            <span className="w-[170px] shrink-0 text-caption leading-tight text-ink">{s.label}</span>
            <span className="hidden w-[130px] shrink-0 text-caption leading-tight text-ink-muted sm:block">
              {s.sub}
            </span>
            <span className="h-2 min-w-0 flex-1 rounded-full bg-illustrative-bg">
              <span
                className={cn(
                  "block h-full rounded-full",
                  // Matches the Live request path exactly: the gateway is the
                  // subject and takes the accent, the backend recedes. Green
                  // belongs to the 401 (UX_AUDIT.md F4).
                  s.tone === "gateway" ? "bg-accent" : "bg-ink-muted/40",
                )}
                style={{ width: `${Math.max(1.5, (s.ms / total) * 100)}%` }}
              />
            </span>
            <span
              className={cn(
                "w-[70px] shrink-0 text-right text-caption font-medium tabular-nums",
                s.tone === "gateway" ? "text-accent" : "text-ink",
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
