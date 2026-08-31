import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  BotRegular,
  BrainCircuitRegular,
  PersonRegular,
  ServerRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import type { JourneyTimings } from "@/services/contracts";
import { cn } from "@/lib/cn";

/**
 * The request path, animated, with API Management as the subject.
 *
 * WHY APIM APPEARS TWICE
 *
 * It is not a repeated label on a linear path — it is two different APIs with
 * two different policies, and that is the strongest thing this screen has to
 * say about what a gateway does. Verified against the deployed configuration,
 * not assumed:
 *
 *   hosted-agent-responses  hosted-agent-policy.xml
 *                           authentication-managed-identity → ai.azure.com
 *                           the console's call reaching the agent
 *
 *   inference               policy.xml
 *                           authentication-managed-identity →
 *                           cognitiveservices.azure.com, plus
 *                           set-backend-service
 *                           the agent's own call reaching the model, because
 *                           deploy.ps1 sets AZURE_OPENAI_ENDPOINT to the
 *                           gateway rather than to Foundry
 *
 * The second hop is the one that surprises people: the agent does not talk to
 * the model directly, so the same control point governs traffic the customer's
 * own container originates.
 *
 * WHY THE BROKER IS DIMMED
 *
 * It is this demo's own BFF, not something the lab demonstrates. It appears
 * because pretending the console calls APIM directly would be a lie about the
 * path, and it is dimmed because giving it equal weight would make a private
 * implementation detail look like part of the architecture on offer.
 *
 * WHAT THE NUMBERS ARE, AND ARE NOT
 *
 * Every millisecond shown comes from ApiManagementGatewayLogs via
 * /api/journey — TotalTime and BackendTime per hop. Nothing here is
 * estimated. Two honesty details the numbers themselves do not carry:
 *
 *   - Agent processing is DERIVED (hop1.backend − hop2.total), not measured,
 *     and is marked so.
 *   - The console → broker segment is not measured at all, so it shows no
 *     number rather than a plausible one.
 *
 * Timings arrive on Log Analytics ingestion lag — measured at ~150 s against
 * this deployment. Until they do, the diagram animates on the real total and
 * shows no per-hop figure. It never fills the gap with an estimate.
 *
 * ANIMATION TIMING
 *
 * Segment durations are proportional to the real measurements, scaled so the
 * whole path plays in ~2.4 s: a 13-second request animating for 13 seconds
 * would be accurate and useless. The ratios are real; the absolute duration
 * is not, and the caption says so. Without measurements every segment gets
 * the same slice, which reads as "we do not know" rather than as a claim.
 */

const PLAYBACK_MS = 2400;
/** Below this a segment is invisible; the 2 ms gateway hops need a floor. */
const MIN_SEGMENT_MS = 140;

interface FlowNode {
  id: string;
  icon: ComponentType<{ fontSize?: number }>;
  /** Translated (generic roles). */
  labelKey?: string;
  /** Untranslated (Azure product names, model names). */
  label?: string;
  factKey?: string;
  fact?: string;
  shape: "round" | "diamond";
  /** The broker: present for truthfulness, dimmed for proportion. */
  muted?: boolean;
  isAgent?: boolean;
}

const NODES: FlowNode[] = [
  { id: "client", icon: PersonRegular, labelKey: "flow.node.client", factKey: "flow.fact.client", shape: "round" },
  { id: "broker", icon: ServerRegular, labelKey: "flow.node.broker", factKey: "flow.fact.broker", shape: "round", muted: true },
  { id: "apim1", icon: ShieldKeyholeRegular, label: "API Management", factKey: "flow.fact.apim1", shape: "diamond" },
  { id: "agent", icon: BotRegular, labelKey: "flow.node.agent", factKey: "flow.fact.agent", shape: "diamond", isAgent: true },
  { id: "apim2", icon: ShieldKeyholeRegular, label: "API Management", factKey: "flow.fact.apim2", shape: "diamond" },
  { id: "model", icon: BrainCircuitRegular, label: "gpt-5-mini", factKey: "flow.fact.model", shape: "round" },
];

interface Segment {
  ms: number | null;
  labelKey: string | null;
  /** Gateway processing cost — coloured to make single-digit ms the point. */
  isGatewayCost: boolean;
  /** Arithmetic on two measurements rather than a measurement. */
  isDerived: boolean;
}

/**
 * One entry per connector, in path order:
 *   0 console → broker    not measured, deliberately blank
 *   1 broker  → APIM      hop 1's gateway processing
 *   2 APIM    → agent     agent processing (derived)
 *   3 agent   → APIM      hop 2's gateway processing
 *   4 APIM    → model     the model call itself
 */
function buildSegments(timings: JourneyTimings | null): Segment[] {
  const blank: Segment = { ms: null, labelKey: null, isGatewayCost: false, isDerived: false };
  const segments: Segment[] = [blank, blank, blank, blank, blank];
  if (!timings?.available) return segments;

  const { hop1, hop2 } = timings;

  if (hop1) {
    segments[1] = {
      ms: hop1.gatewayOverheadMs,
      labelKey: "flow.seg.gateway",
      isGatewayCost: true,
      isDerived: false,
    };
  }
  if (hop1 && hop2) {
    const agentMs = hop1.backendMs - hop2.totalMs;
    if (agentMs > 0) {
      segments[2] = {
        ms: agentMs,
        labelKey: "flow.seg.agent",
        isGatewayCost: false,
        isDerived: true,
      };
    }
    segments[3] = {
      ms: hop2.gatewayOverheadMs,
      labelKey: "flow.seg.gateway",
      isGatewayCost: true,
      isDerived: false,
    };
    segments[4] = {
      ms: hop2.backendMs,
      labelKey: "flow.seg.model",
      isGatewayCost: false,
      isDerived: false,
    };
  }
  return segments;
}

/** Playback slice per connector: real ratios when measured, equal when not. */
function playbackDurations(segments: Segment[]): number[] {
  const measured = segments.map((s) => s.ms).filter((m): m is number => m != null && m > 0);
  if (measured.length === 0) return segments.map(() => PLAYBACK_MS / segments.length);

  const total = measured.reduce((a, b) => a + b, 0);
  return segments.map((s) =>
    s.ms != null && s.ms > 0
      ? Math.max(MIN_SEGMENT_MS, (s.ms / total) * PLAYBACK_MS)
      : MIN_SEGMENT_MS,
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

export function RequestFlowDiagram({
  timings,
  agentLabel,
  /** Bumped by the parent on every completed invocation; replays the path. */
  runToken,
  /** No invocation yet: the path is stated, but nothing is claimed to flow. */
  idle,
}: {
  timings: JourneyTimings | null;
  agentLabel: string;
  runToken: number;
  idle: boolean;
}) {
  const t = useTranslation();
  const segments = useMemo(() => buildSegments(timings), [timings]);
  const durations = useMemo(() => playbackDurations(segments), [segments]);

  // -1 = nothing lit. Advances one connector at a time; the node ahead of the
  // active connector lights with it, so the pulse reads as travel.
  const [progress, setProgress] = useState(-1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];

    if (idle) {
      setProgress(-1);
      return;
    }

    setProgress(0);
    let elapsed = 0;
    durations.forEach((ms, i) => {
      elapsed += ms;
      const id = window.setTimeout(() => setProgress(i + 1), elapsed);
      timers.current.push(id);
    });

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // runToken is the replay trigger: the same timings replayed on a new
    // invocation must restart the animation, which a timings-only dependency
    // would not do.
  }, [runToken, idle, durations]);

  const measured = timings?.available === true;

  return (
    <div>
      {/*
        Six nodes with two-line captions do not fit beside an open copilot,
        and the copilot being open is the normal presenting state - the row
        silently lost every label there. It scrolls inside its own container
        instead, which keeps the labels rather than the fit: an unlabelled
        "API Management" twice over says nothing, and the whole point of the
        second one is the policy printed under it.
      */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-[880px] items-start justify-between">
        {NODES.map((node, i) => {
          const Icon = node.icon;
          const label = node.isAgent ? agentLabel : node.labelKey ? t(node.labelKey) : node.label;
          const fact = node.factKey ? t(node.factKey) : node.fact;
          const lit = !idle && progress >= i;
          const segment = segments[i];
          const connectorLit = !idle && progress > i;

          return (
            <div key={node.id} className="flex flex-1 items-start">
              <div className="flex w-32 shrink-0 flex-col items-center gap-1 text-center">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center border-2",
                    "transition-all duration-300",
                    node.shape === "diamond" ? "rotate-45 rounded-lg" : "rounded-full",
                    node.muted
                      ? "border-border bg-transparent text-ink-muted"
                      : lit
                        ? "border-accent bg-accent/25 text-accent shadow-[0_0_0_4px_rgba(62,155,224,0.14)]"
                        : "border-accent/40 bg-accent/5 text-accent/60",
                  )}
                  aria-hidden="true"
                >
                  <span className={cn(node.shape === "diamond" && "-rotate-45")}>
                    <Icon fontSize={18} />
                  </span>
                </div>
                <span
                  className={cn(
                    "max-w-full truncate text-caption font-medium",
                    node.muted ? "text-ink-muted" : "text-ink",
                  )}
                  title={label}
                >
                  {label}
                </span>
                {/*
                  Two lines maximum, with the full string on hover: the APIM
                  captions carry both the API name and the managed-identity
                  audience, which is the content that makes the two gateway
                  steps distinguishable, and truncating to one line would drop
                  exactly the audience.
                */}
                <span
                  className="line-clamp-2 max-w-full text-caption leading-tight text-ink-muted"
                  title={fact}
                >
                  {fact}
                </span>
              </div>

              {i < NODES.length - 1 && (
                <div className="relative mx-1 flex flex-1 flex-col items-center justify-start pt-5">
                  {segment.ms != null && segment.labelKey && (
                    <span
                      className={cn(
                        "mb-1 whitespace-nowrap text-caption font-medium tabular-nums",
                        segment.isGatewayCost ? "text-affirm" : "text-ink",
                      )}
                    >
                      {formatMs(segment.ms)}
                      {segment.isDerived && (
                        <span className="ml-1 font-normal text-ink-muted">
                          {t("flow.derivedMark")}
                        </span>
                      )}
                    </span>
                  )}
                  <div className="relative h-px w-full bg-accent/25" aria-hidden="true">
                    <div
                      className="absolute inset-y-0 left-0 bg-accent transition-[width] ease-linear"
                      style={{
                        width: connectorLit ? "100%" : "0%",
                        transitionDuration: `${durations[i]}ms`,
                      }}
                    />
                  </div>
                  {segment.labelKey && (
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
      </div>

      <p className="mt-2 text-caption leading-relaxed text-ink-muted">
        {idle
          ? t("flow.note.idle")
          : measured
            ? t("flow.note.measured")
            : t("flow.note.pending")}
      </p>
    </div>
  );
}
