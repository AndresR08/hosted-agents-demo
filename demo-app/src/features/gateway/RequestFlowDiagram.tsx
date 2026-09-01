import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  BotRegular,
  BrainCircuitRegular,
  PersonRegular,
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
 * Not a repeated label on a linear path — two different APIs with two
 * different policies, which is the strongest thing this screen has to say.
 * Read out of the deployed configuration, not assumed:
 *
 *   hosted-agent-responses  hosted-agent-policy.xml, managed identity for
 *                           https://ai.azure.com — the console's call
 *                           reaching the agent.
 *   inference               policy.xml, managed identity for
 *                           https://cognitiveservices.azure.com plus
 *                           set-backend-service — the agent's OWN call
 *                           reaching the model, because deploy.ps1 points
 *                           AZURE_OPENAI_ENDPOINT at the gateway.
 *
 * One APIM service, two APIs. Not two gateways.
 *
 * WHY THE BROKER IS NOT A NODE
 *
 * It was one, briefly, on the argument that omitting this demo's own BFF
 * misstates the path. The five-node set is the owner's call and it is the
 * better one for this screen: the broker is a proxy that adds no policy and
 * no identity, the console→APIM connector carries hop 1's gateway cost either
 * way, and a sixth node spent the width that the two APIM captions need to
 * stay legible. The trade-off is named here rather than quietly dropped: a
 * viewer who knows the console is a browser may wonder what terminates TLS,
 * and the answer is the broker, described on the Platform screen.
 *
 * WHAT THE NUMBERS ARE, AND ARE NOT
 *
 * Every millisecond comes from ApiManagementGatewayLogs via /api/journey —
 * TotalTime and BackendTime per hop. Nothing is estimated. Agent processing
 * is DERIVED (hop1.backend − hop2.total) and marked so. Timings arrive on
 * Log Analytics ingestion lag, measured at ~150 s against this deployment;
 * until they land the diagram animates on the real total and shows no per-hop
 * figure at all.
 *
 * TWO COLOURS, BECAUSE THERE ARE TWO KINDS OF MEASUREMENT
 *
 * Accent for the gateway, muted ink for the backend. Not the affirmative
 * green, which DESIGN_DECISIONS 4.4 reserves for the 401 inversion and which
 * this component previously helped overload - see UX_AUDIT.md F4.
 *
 * The sequence on the Reference tab colours four kinds of event. Here there
 * are exactly two real categories — the gateway's own processing
 * (gatewayOverheadMs) and the backend's (backendMs, or arithmetic on it) —
 * and inventing more would be colouring a distinction the data does not make.
 * Single-digit milliseconds beside a multi-second model call is the argument;
 * the colour is what makes it visible without reading.
 *
 * ANIMATION TIMING
 *
 * Segment durations are proportional to the measurements, scaled so the path
 * plays in ~2.6 s. A 13-second request animated over 13 seconds would be
 * accurate and useless: the ratios are real, the wall-clock duration is not,
 * and the caption says which is which. Without measurements every segment
 * gets an equal slice, which reads as "we do not know".
 */

const PLAYBACK_MS = 2600;
/** Below this a segment is invisible; the 2 ms gateway hops need a floor. */
const MIN_SEGMENT_MS = 160;

interface FlowNode {
  id: string;
  icon: ComponentType<{ fontSize?: number }>;
  labelKey?: string;
  label?: string;
  factKey: string;
  shape: "round" | "diamond";
  isAgent?: boolean;
}

const NODES: FlowNode[] = [
  { id: "client", icon: PersonRegular, labelKey: "flow.node.client", factKey: "flow.fact.client", shape: "round" },
  { id: "apim1", icon: ShieldKeyholeRegular, label: "API Management", factKey: "flow.fact.apim1", shape: "diamond" },
  { id: "agent", icon: BotRegular, labelKey: "flow.node.agent", factKey: "flow.fact.agent", shape: "diamond", isAgent: true },
  { id: "apim2", icon: ShieldKeyholeRegular, label: "API Management", factKey: "flow.fact.apim2", shape: "diamond" },
  { id: "model", icon: BrainCircuitRegular, label: "gpt-5-mini", factKey: "flow.fact.model", shape: "round" },
];

type SegmentKind = "gateway" | "backend";

interface Segment {
  ms: number | null;
  labelKey: string;
  kind: SegmentKind;
  isDerived: boolean;
}

/**
 * One entry per connector, in path order:
 *   0 console → APIM    hop 1's gateway processing
 *   1 APIM    → agent   agent processing (derived)
 *   2 agent   → APIM    hop 2's gateway processing
 *   3 APIM    → model   the model call itself
 */
function buildSegments(timings: JourneyTimings | null): Segment[] {
  const shape: Segment[] = [
    { ms: null, labelKey: "flow.seg.gateway", kind: "gateway", isDerived: false },
    { ms: null, labelKey: "flow.seg.agent", kind: "backend", isDerived: true },
    { ms: null, labelKey: "flow.seg.gateway", kind: "gateway", isDerived: false },
    { ms: null, labelKey: "flow.seg.model", kind: "backend", isDerived: false },
  ];
  if (!timings?.available) return shape;

  const { hop1, hop2 } = timings;
  if (hop1) shape[0] = { ...shape[0], ms: hop1.gatewayOverheadMs };
  if (hop1 && hop2) {
    const agentMs = hop1.backendMs - hop2.totalMs;
    if (agentMs > 0) shape[1] = { ...shape[1], ms: agentMs };
    shape[2] = { ...shape[2], ms: hop2.gatewayOverheadMs };
    shape[3] = { ...shape[3], ms: hop2.backendMs };
  }
  return shape;
}

/** Playback slice per connector: real ratios when measured, equal when not. */
function playbackDurations(segments: Segment[]): number[] {
  const measured = segments.map((s) => s.ms).filter((m): m is number => m != null && m > 0);
  if (measured.length === 0) return segments.map(() => PLAYBACK_MS / segments.length);
  const total = measured.reduce((a, b) => a + b, 0);
  return segments.map((s) =>
    s.ms != null && s.ms > 0 ? Math.max(MIN_SEGMENT_MS, (s.ms / total) * PLAYBACK_MS) : MIN_SEGMENT_MS,
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/**
 * The travelling beam: a stroke drawn on, plus a wider, faint copy behind it.
 *
 * stroke-dasharray/dashoffset rather than a moving dot, because the trail it
 * leaves is what shows which segment has already been crossed once the
 * animation has moved on. `key` on the group restarts the transition from
 * zero when a replay begins — CSS will not re-run a transition to a value it
 * already holds.
 */
function Beam({ active, done, durationMs, kind }: { active: boolean; done: boolean; durationMs: number; kind: SegmentKind }) {
  // The gateway is the subject of this screen, so it takes the accent; the
  // backend is context and recedes to the muted ink. Two categories, still
  // plainly distinguishable, and the affirmative green stays with the 401.
  const stroke = kind === "gateway" ? "var(--color-accent)" : "var(--color-ink-muted)";
  const drawn = active || done;
  return (
    <svg className="h-4 w-full" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="8" x2="100" y2="8" stroke="var(--color-border)" strokeWidth="1" />
      <line
        x1="0" y1="8" x2="100" y2="8"
        stroke={stroke} strokeWidth="6" strokeLinecap="round" opacity={drawn ? 0.18 : 0}
        style={{
          strokeDasharray: 100,
          strokeDashoffset: drawn ? 0 : 100,
          transition: `stroke-dashoffset ${durationMs}ms linear, opacity 200ms ease-out`,
        }}
      />
      <line
        x1="0" y1="8" x2="100" y2="8"
        stroke={stroke} strokeWidth="1.75" strokeLinecap="round"
        style={{
          strokeDasharray: 100,
          strokeDashoffset: drawn ? 0 : 100,
          transition: `stroke-dashoffset ${durationMs}ms linear`,
        }}
      />
    </svg>
  );
}

export function RequestFlowDiagram({
  timings,
  agentLabel,
  runToken,
  idle,
}: {
  timings: JourneyTimings | null;
  agentLabel: string;
  /** Bumped by the parent on every completed invocation; replays the path. */
  runToken: number;
  /** No invocation yet: the path is stated, but nothing is claimed to flow. */
  idle: boolean;
}) {
  const t = useTranslation();
  const segments = useMemo(() => buildSegments(timings), [timings]);
  const durations = useMemo(() => playbackDurations(segments), [segments]);

  // -1 = nothing lit. `progress` is the index of the connector currently being
  // crossed; everything before it is already drawn.
  const [progress, setProgress] = useState(-1);
  const [playId, setPlayId] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];

    if (idle) {
      setProgress(-1);
      return;
    }

    setPlayId((n) => n + 1);
    setProgress(0);
    let elapsed = 0;
    durations.forEach((ms, i) => {
      elapsed += ms;
      timers.current.push(window.setTimeout(() => setProgress(i + 1), elapsed));
    });

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // runToken is the replay trigger: the same timings replayed after a new
    // invocation must restart, which a timings-only dependency would not do.
  }, [runToken, idle, durations]);

  const measured = timings?.available === true;

  return (
    <div>
      {/*
        Six nodes with two-line captions did not fit beside an open copilot -
        the normal presenting state - and the row silently lost every label.
        It scrolls in its own container instead: an unlabelled "API Management"
        twice over says nothing, and the policy printed under it is the point.
      */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[760px] items-start justify-between">
          {NODES.map((node, i) => {
            const Icon = node.icon;
            const label = node.isAgent ? agentLabel : node.labelKey ? t(node.labelKey) : node.label;
            const fact = t(node.factKey);
            const segment = segments[i];

            // A node is lit while the beam is arriving at it or has passed it.
            const lit = !idle && progress >= i;
            // Its ring takes the colour of the segment currently in flight, so
            // the two categories are legible on the nodes as well as the lines.
            const activeKind = !idle && progress >= 0 && progress < segments.length
              ? segments[progress].kind
              : null;
            const ringVar = activeKind === "gateway" ? "var(--color-accent)" : "var(--color-ink-muted)";
            const isTravelling = !idle && (progress === i || progress === i - 1);

            return (
              <div key={node.id} className="flex flex-1 items-start">
                <div className="flex w-32 shrink-0 flex-col items-center gap-1 text-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center border-2 transition-all duration-300",
                      node.shape === "diamond" ? "rotate-45 rounded-lg" : "rounded-full",
                      lit ? "text-ink" : "text-accent/60",
                    )}
                    style={{
                      borderColor: lit ? ringVar : "color-mix(in srgb, var(--color-accent) 40%, transparent)",
                      background: lit
                        ? `color-mix(in srgb, ${ringVar} 22%, transparent)`
                        : "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                      boxShadow: isTravelling ? `0 0 0 5px color-mix(in srgb, ${ringVar} 14%, transparent)` : "none",
                    }}
                    aria-hidden="true"
                  >
                    <span className={cn(node.shape === "diamond" && "-rotate-45")}>
                      <Icon fontSize={18} />
                    </span>
                  </div>
                  <span className="max-w-full truncate text-caption font-medium text-ink" title={label}>
                    {label}
                  </span>
                  {/*
                    Two lines maximum, full string on hover: the APIM captions
                    carry the API name and the managed-identity audience, which
                    is what makes the two gateway steps distinguishable, and
                    truncating to one line would drop exactly the audience.
                  */}
                  <span className="line-clamp-2 max-w-full text-caption leading-tight text-ink-muted" title={fact}>
                    {fact}
                  </span>
                </div>

                {i < NODES.length - 1 && (
                  <div className="relative mx-1 flex flex-1 flex-col items-center justify-start pt-4">
                    {segment.ms != null && (
                      <span
                        className={cn(
                          "mb-0.5 whitespace-nowrap text-caption font-medium tabular-nums",
                          segment.kind === "gateway" ? "text-accent" : "text-ink",
                        )}
                      >
                        {formatMs(segment.ms)}
                        {segment.isDerived && (
                          <span className="ml-1 font-normal text-ink-muted">{t("flow.derivedMark")}</span>
                        )}
                      </span>
                    )}
                    <Beam
                      key={`${playId}-${i}`}
                      active={progress === i}
                      done={progress > i}
                      durationMs={durations[i]}
                      kind={segment.kind}
                    />
                    <span className="mt-0.5 whitespace-nowrap text-caption text-ink-muted">
                      {t(segment.labelKey)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
          <span className="h-0.5 w-4 rounded bg-accent" aria-hidden="true" />
          {t("flow.legend.gateway")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
          <span className="h-0.5 w-4 rounded bg-ink-muted" aria-hidden="true" />
          {t("flow.legend.backend")}
        </span>
      </div>

      <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">
        {idle ? t("flow.note.idle") : measured ? t("flow.note.measured") : t("flow.note.pending")}
      </p>
    </div>
  );
}
