import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Button } from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  BotRegular,
  BrainCircuitRegular,
  CodeRegular,
  PersonRegular,
  PlayCircleRegular,
  PlugConnectedRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { StatusPill } from "@/components/StatusPill";
import { MaintenanceActionButton } from "@/components/MaintenanceActionButton";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AccessControlAttempt, JourneyTimings } from "@/services/contracts";
import { cn } from "@/lib/cn";
import { PolicyViewerDialog } from "./PolicyViewerDialog";

interface JourneyNode {
  /** Translated (generic role names: Client, Agent). */
  labelKey?: string;
  /** Untranslated (Azure product / model names). */
  label?: string;
  fact: string;
  icon: ComponentType<{ fontSize?: number }>;
  isGateway?: boolean;
  /** Label is replaced at render time with the agent actually in play. */
  isAgent?: boolean;
}

const NODES: JourneyNode[] = [
  { labelKey: "journey.nodeClient", fact: "api-key", icon: PersonRegular },
  { label: "API Management", fact: "token · ai.azure.com", icon: ShieldKeyholeRegular, isGateway: true },
  { labelKey: "journey.nodeAgent", fact: "container", icon: BotRegular, isAgent: true },
  { label: "API Management", fact: "token · cognitiveservices.azure.com", icon: ShieldKeyholeRegular, isGateway: true },
  { label: "gpt-5-mini", fact: "model", icon: BrainCircuitRegular },
];

const REVEAL_STAGGER_MS = 400;

/** ms under a second read better as integers; above it, seconds with one decimal. */
function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/**
 * Maps a connector index to the measurement that belongs on it.
 *
 * The five nodes are Client → APIM → Agent → APIM → Model, so the four
 * connectors are, in order: the gateway's own cost on the inbound hop, the
 * agent's processing, the gateway's cost on the model hop, and the model call
 * itself. Agent processing is the one derived figure — hop 1's backend time
 * minus the whole of hop 2 — so it is shown only when both are measured, and
 * it is arithmetic on two real numbers rather than an estimate.
 */
function segmentTiming(
  index: number,
  timings: JourneyTimings | null,
): { ms: number; labelKey: string; isGatewayCost: boolean } | null {
  if (!timings?.available) return null;
  const { hop1, hop2 } = timings;

  if (index === 0 && hop1) {
    return { ms: hop1.gatewayOverheadMs, labelKey: "journey.segment.gateway", isGatewayCost: true };
  }
  if (index === 1 && hop1 && hop2) {
    const agentMs = hop1.backendMs - hop2.totalMs;
    if (agentMs <= 0) return null;
    return { ms: agentMs, labelKey: "journey.segment.agent", isGatewayCost: false };
  }
  if (index === 2 && hop2) {
    return { ms: hop2.gatewayOverheadMs, labelKey: "journey.segment.gateway", isGatewayCost: true };
  }
  if (index === 3 && hop2) {
    return { ms: hop2.backendMs, labelKey: "journey.segment.model", isGatewayCost: false };
  }
  return null;
}

/**
 * GATEWAY — "how do clients reach the agent?"
 *
 * One question with one three-part answer, which is why the old Request Path
 * and Enterprise Boundary panels are a single screen now. Split across two
 * panels they read as two topics; together they read as the answer to the
 * question a customer actually asks, which is not "what is the latency" and
 * not "is it secure" but *how does a request get from my client to my
 * container, and on what terms*:
 *
 *   1. **The address.** The routed URL, with the agent name as a path
 *      segment — the mechanism behind "one API serves N agents" that the lab
 *      states twice (README.md §Get Started, src/frameworks/README.md).
 *      Fetched from the broker (Environment), which builds it with the same
 *      function it uses to *call* an agent, so the URL on screen is the URL
 *      actually requested.
 *   2. **The path.** The five stages, always shown, with API Management's own
 *      measured cost on each gateway connector once a matching request has
 *      been made — no reveal animation gating this on a presenter's beat.
 *   3. **The terms.** Three real credential attempts (Credential Test) and
 *      the policy document running in the gateway (Policy Viewer), fetched
 *      from ARM at the moment it is shown.
 *
 * Actions below the terms run the same broker diagnostics Presenter Tools →
 * Maintenance exposes (`test-apim`, `reload-policies`) — first-class here
 * rather than hidden in a presenter-only dialog.
 *
 * Nothing here is staged: the attempts are genuine HTTPS requests through the
 * broker (routes/accessControl.ts) and the timings come from
 * ApiManagementGatewayLogs. Simulation shows an honest empty state instead
 * of the three outcomes — it cannot make the calls that produce them.
 */
export function GatewayStop() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const lastAskId = useDemoStore((s) => s.lastAskId);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const runToken = useDemoStore((s) => s.accessControlRunToken);
  const runAccessControlTest = useDemoStore((s) => s.runAccessControlTest);

  const [routeTemplate, setRouteTemplate] = useState<string | null>(null);
  const [totalLatencyMs, setTotalLatencyMs] = useState<number | null>(null);
  const [servedByAgent, setServedByAgent] = useState<string | null>(null);
  const [timings, setTimings] = useState<JourneyTimings | null>(null);
  const [attempts, setAttempts] = useState<AccessControlAttempt[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [policyOpen, setPolicyOpen] = useState(false);

  // The route. Read once per mode — it is deployment configuration, not
  // per-request data.
  useEffect(() => {
    if (mode !== "live") {
      setRouteTemplate(null);
      return;
    }
    let cancelled = false;
    service
      .getEnvironmentContext()
      .then((ctx) => {
        if (!cancelled) setRouteTemplate(ctx.agentRouteTemplate ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  // Real total latency and per-hop timing, once the matching ask completed.
  useEffect(() => {
    if (mode !== "live" || !lastAskId) return;
    let cancelled = false;
    function load() {
      service
        .getRequestJourney(lastAskId!)
        .then((journey) => {
          if (cancelled) return;
          setTotalLatencyMs(journey.totalLatencyMs);
          setServedByAgent(
            journey.agentName ? `${journey.agentName}${journey.agentVersion ?? ""}` : null,
          );
          setTimings(journey.timings ?? null);
        })
        .catch(() => undefined);
    }
    load();
    // Per-hop timing comes from Log Analytics and lands 1–3 minutes after the
    // answer, so re-check rather than showing the flow without it forever.
    const interval = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, lastAskId, service]);

  // The three credential attempts, on demand. Simulation cannot make these
  // calls, so it shows no attempts rather than three invented outcomes.
  useEffect(() => {
    if (runToken === 0 || mode !== "live") return;
    setRevealedCount(0);
    setAttempts([]);
    service
      .runAccessControlTests()
      .then((result) => {
        setAttempts(result.attempts);
        result.attempts.forEach((_, i) =>
          window.setTimeout(() => setRevealedCount(i + 1), (i + 1) * REVEAL_STAGGER_MS),
        );
      })
      .catch(() => setAttempts([]));
  }, [runToken, mode, service]);

  const agentNodeLabel = servedByAgent ?? targetAgent;

  return (
    <StopFrame
      title={t("gw.heading")}
      question={t("gw.question")}
      footer={t("journey.caption")}
      provenance={
        <ProvenanceBadge
          provenance={{ band: mode === "live" && totalLatencyMs != null ? "live" : "illustrative" }}
        />
      }
    >
      <div className="flex flex-col gap-5">
        {/* 1 — the address. */}
        <section>
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("gw.route.title")}
          </p>
          <RouteLine template={routeTemplate} agentName={targetAgent} />
          <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">{t("gw.route.note")}</p>
        </section>

        {/* 2 — the path. Always shown at full presence — a console states
            what the route is, it does not stage a reveal of it. */}
        <section>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("gw.path.title")}
          </p>
          <div className="flex items-center justify-between">
            {NODES.map((node, i) => {
              const Icon = node.icon;
              const label = node.isAgent
                ? agentNodeLabel
                : node.labelKey
                  ? t(node.labelKey)
                  : node.label;
              const segment = segmentTiming(i, timings);

              return (
                <div key={i} className="flex flex-1 items-center">
                  <div className="flex w-28 flex-col items-center gap-1.5 text-center">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center border-2",
                        node.isGateway ? "rotate-45 rounded-lg" : "rounded-full",
                        "border-accent bg-accent/10 text-accent",
                      )}
                      aria-hidden="true"
                    >
                      <span className={cn(node.isGateway && "-rotate-45")}>
                        <Icon fontSize={18} />
                      </span>
                    </div>
                    <span
                      className="max-w-full truncate text-caption font-medium text-ink"
                      title={label}
                    >
                      {label}
                    </span>
                    <span className="max-w-full truncate text-caption text-ink-muted" title={node.fact}>
                      {node.fact}
                    </span>
                  </div>

                  {i < NODES.length - 1 && (
                    <div className="relative mx-2 flex flex-1 flex-col items-center justify-center">
                      {/*
                        Two of the four segments are the gateway's own
                        processing, shown in the affirmative colour because
                        single-digit milliseconds beside a multi-second model
                        call is the point being made. All four come from
                        ApiManagementGatewayLogs; a segment with no measurement
                        simply renders no label.
                      */}
                      {segment && (
                        <span
                          className={cn(
                            "mb-1 whitespace-nowrap text-caption font-medium tabular-nums",
                            segment.isGatewayCost ? "text-affirm" : "text-ink",
                          )}
                        >
                          {formatMs(segment.ms)}
                        </span>
                      )}
                      <div className="h-px w-full bg-accent" aria-hidden="true" />
                      {segment && (
                        <span className="mt-1 whitespace-nowrap text-caption text-ink-muted">
                          {t(segment.labelKey)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(timings?.available || totalLatencyMs != null) && (
            <div className="mt-2 flex items-center justify-end gap-4">
              {timings?.available && timings.totalGatewayOverheadMs != null && (
                <p className="whitespace-nowrap text-caption text-ink-muted">
                  {t("journey.gatewayOverhead")}:{" "}
                  <span className="font-medium tabular-nums text-affirm">
                    {timings.totalGatewayOverheadMs} ms
                  </span>
                </p>
              )}
              {totalLatencyMs != null && (
                <p className="text-caption font-medium text-ink">
                  {t("journey.totalLatency")}: {(totalLatencyMs / 1000).toFixed(1)} s
                </p>
              )}
            </div>
          )}
        </section>

        {/* 3 — the terms. */}
        <section>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("gw.boundary.title")}
          </p>
          <p className="mb-2 text-body font-medium text-ink">{t("accessControl.statement")}</p>

          {/*
            Three outcomes side by side rather than stacked. They are one
            comparison — the same request with three credentials — and reading
            them across is both what the argument wants and ~96px of height
            back, which is what keeps this stop off a scrollbar at 1366×768.
          */}
          {revealedCount === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-3 text-caption text-ink-muted">
              {mode === "live" ? t("accessControl.emptyState") : t("accessControl.simulationNote")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {attempts.slice(0, revealedCount).map((attempt, i) => (
                <div
                  key={attempt.id}
                  className="animate-fade-slide-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <StatusPill attempt={attempt} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button
              appearance="primary"
              icon={<PlayCircleRegular />}
              disabled={mode !== "live"}
              onClick={runAccessControlTest}
            >
              {t("accessControl.runAll")}
            </Button>
            <Button
              appearance="secondary"
              icon={<CodeRegular />}
              onClick={() => setPolicyOpen(true)}
            >
              {t("accessControl.showPolicy")}
            </Button>
          </div>
        </section>

        {/* 4 — the same broker diagnostics Presenter Tools → Maintenance
            exposes, scoped to what this screen is actually about. */}
        <section className="border-t border-border pt-4">
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("agents.overview.actionsTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <MaintenanceActionButton
              action="test-apim"
              icon={<PlugConnectedRegular />}
              label={t("maintenance.action.test-apim")}
            />
            <MaintenanceActionButton
              action="reload-policies"
              icon={<ArrowClockwiseRegular />}
              label={t("maintenance.action.reload-policies")}
            />
          </div>
        </section>
      </div>

      <PolicyViewerDialog open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </StopFrame>
  );
}

/**
 * The routed URL, with the agent name picked out.
 *
 * The highlight is the whole point of rendering it: everything around
 * `{agentName}` is fixed configuration, and that one segment is what makes a
 * second, tenth or fiftieth agent reachable without touching the gateway.
 */
function RouteLine({ template, agentName }: { template: string | null; agentName: string }) {
  const t = useTranslation();

  if (!template) {
    return (
      <p className="mt-1.5 text-caption italic text-ink-muted">{t("gw.route.unavailable")}</p>
    );
  }

  const [before, after] = template.split("{agentName}");

  return (
    <p className="mt-1.5 break-all rounded-md border border-border bg-illustrative-bg/50 px-3 py-2 font-mono text-caption text-ink">
      <span className="text-ink-muted">POST </span>
      {before}
      <span className="rounded bg-accent/15 px-1 font-semibold text-accent" title={t("gw.route.segmentLabel")}>
        {agentName}
      </span>
      {after}
    </p>
  );
}
