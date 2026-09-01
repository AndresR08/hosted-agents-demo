import { useEffect, useRef, useState } from "react";
import { Button } from "@fluentui/react-components";
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  PauseRegular,
  PlayRegular,
} from "@fluentui/react-icons";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/cn";
import { LANES, STEPS, type StepKind } from "./identitySequence";

/**
 * The double-token identity flow, played as a sequence diagram.
 *
 * It lives on the Reference tab because it is conceptual: it explains a
 * mechanism rather than reporting an invocation. That distinction is the
 * reason it is NOT on the Live tab, where the same flow is shown as four
 * measured segments — the gateway logs cannot time a token acquisition
 * separately from the hop that contains it, so drawing it as its own step
 * beside real numbers would invent granularity the telemetry does not have.
 * Here, with nothing claiming to be measured, the detail is free.
 *
 * COLOUR
 *
 * Four kinds of event, two hues - accent and muted ink. It does not use the
 * affirmative green: DESIGN_DECISIONS 4.4 reserves that for the 401
 * inversion, and this component was one of the two that overloaded it (see
 * UX_AUDIT.md F4). Request, response and identity share the accent; internal
 * processing is muted. Every step also names its kind in words, so the colour
 * reinforces rather than carries — which is what makes four categories legible
 * on two hues, and what keeps it working for a viewer who cannot separate them.
 *
 * Steps that describe a capability this deployment does not configure carry
 * the same "not in this lab" pill the capability cards use. Three of the
 * seventeen do; see identitySequence.ts for what the check against the
 * deployed policies changed.
 */

const AUTOPLAY_MS = 4200;

/**
 * Four kinds on two hues, separated by stroke pattern rather than by a third
 * colour.
 *
 * Dropping the affirmative green left request, identity and response all on
 * the accent, which made the identity steps - the entire subject of this
 * sequence - indistinguishable from the requests around them. Rather than
 * reintroduce a hue, each kind takes its own dash rhythm: solid for a request,
 * a tight dot pattern for the identity round trip, a long dash for the
 * response, and muted ink for internal work.
 *
 * That also happens to be the more robust encoding. A dash pattern survives a
 * projector's contrast curve and a colour-blind viewer, neither of which a
 * fourth hue would have.
 */
function kindStyle(kind: StepKind): { stroke: string; text: string; dash?: string } {
  switch (kind) {
    case "token":
      return { stroke: "var(--color-accent)", text: "text-accent", dash: "2 5" };
    case "self":
      return { stroke: "var(--color-ink-muted)", text: "text-ink-muted" };
    case "resp":
      return { stroke: "var(--color-accent)", text: "text-ink", dash: "9 5" };
    case "req":
    default:
      return { stroke: "var(--color-accent)", text: "text-ink" };
  }
}

const LANE_W = 132;
const SVG_H = 150;

export function IdentityFlowSequence() {
  const t = useTranslation();
  const language = useDemoStore((s) => s.language);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => setIndex((i) => (i + 1) % STEPS.length), AUTOPLAY_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing]);

  const step = STEPS[index];
  const colour = kindStyle(step.kind);
  const laneX = (i: number) => i * LANE_W + LANE_W / 2;

  // A self-call loops back into its own lane; everything else is a shallow arc
  // between two lanes, dipping further the longer the jump.
  const x1 = laneX(step.from);
  const x2 = laneX(step.to);
  const path =
    step.from === step.to
      ? `M ${x1 - 10} 92 C ${x1 - 58} 148, ${x1 + 58} 148, ${x1 + 10} 94`
      : `M ${x1} 92 Q ${Math.round((x1 + x2) / 2)} ${Math.round(104 + Math.abs(x2 - x1) * 0.1)}, ${x2} 94`;

  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{t("seq.title")}</h3>
        <span className="text-caption text-ink-muted">
          {t("seq.counter").replace("{n}", String(index + 1)).replace("{total}", String(STEPS.length))}
        </span>
      </div>
      <p className="mt-1 text-caption text-ink-muted">{t("seq.subtitle")}</p>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${LANES.length * LANE_W} ${SVG_H}`}
          className="w-full min-w-[780px]"
          role="img"
          aria-label={t("seq.title")}
        >
          {LANES.map((lane, i) => {
            const active = i === step.from || i === step.to;
            return (
              <g key={i}>
                <rect
                  x={i * LANE_W + 10}
                  y={16}
                  width={LANE_W - 20}
                  height={56}
                  rx={10}
                  fill={active ? `color-mix(in srgb, ${colour.stroke} 14%, transparent)` : "transparent"}
                  stroke={active ? colour.stroke : "var(--color-border)"}
                  strokeWidth={active ? 2 : 1}
                  style={{ transition: "all 260ms ease-out" }}
                />
                <text
                  x={laneX(i)} y={40} textAnchor="middle"
                  fontSize={12} fontWeight={500} fill="var(--color-ink)"
                >
                  {lane.title[language]}
                </text>
                <text
                  x={laneX(i)} y={58} textAnchor="middle"
                  fontSize={10.5} fill="var(--color-ink-muted)"
                >
                  {lane.subtitle[language]}
                </text>
                <line
                  x1={laneX(i)} y1={72} x2={laneX(i)} y2={SVG_H - 8}
                  stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 4"
                />
              </g>
            );
          })}

          {/*
            Two strokes: a wide faint one for the glow and a thin bright one on
            top. `key` restarts the dash animation on every step change - a CSS
            transition will not replay towards a value the element already has.
          */}
          <g key={index}>
            <path
              d={path} fill="none" stroke={colour.stroke} strokeWidth={7}
              strokeLinecap="round" opacity={0.2}
              style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "seq-draw 900ms ease-out forwards" }}
            />
            <path
              d={path} fill="none" stroke={colour.stroke} strokeWidth={2}
              strokeLinecap="round"
              style={{
                // The draw-on animation owns strokeDasharray, so a per-kind
                // pattern cannot also live there. The pattern is painted by a
                // second stroke layered on top once the beam has arrived.
                strokeDasharray: 400,
                strokeDashoffset: 400,
                animation: "seq-draw 900ms ease-out forwards",
              }}
            />
            {colour.dash && (
              <path
                d={path} fill="none" stroke={colour.stroke} strokeWidth={2.5}
                strokeLinecap="round" strokeDasharray={colour.dash}
                style={{ opacity: 0, animation: "seq-pattern 300ms ease-out 700ms forwards" }}
              />
            )}
          </g>
        </svg>
      </div>

      {/* Step detail. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-caption font-medium"
          style={{
            color: colour.stroke,
            background: `color-mix(in srgb, ${colour.stroke} 12%, transparent)`,
          }}
        >
          {t(`seq.kind.${step.kind}`)}
        </span>
        {!step.inLab && (
          <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-caption font-medium text-ink-muted">
            {t("apim.pillNotUsed")}
          </span>
        )}
        <h4 className="min-w-0 flex-1 text-body font-semibold text-ink">{step.title[language]}</h4>
      </div>
      <p className="mt-1 text-body text-ink-muted">{step.detail[language]}</p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-illustrative-bg/60 px-3 py-2 text-caption leading-relaxed text-ink-muted">
        {step.code}
      </pre>

      {/* Transport. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="small"
          icon={playing ? <PauseRegular /> : <PlayRegular />}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? t("seq.pause") : t("seq.play")}
        </Button>
        <Button
          size="small"
          icon={<ChevronLeftRegular />}
          aria-label={t("seq.prev")}
          onClick={() => {
            setPlaying(false);
            setIndex((i) => (i - 1 + STEPS.length) % STEPS.length);
          }}
        />
        <Button
          size="small"
          icon={<ChevronRightRegular />}
          aria-label={t("seq.next")}
          onClick={() => {
            setPlaying(false);
            setIndex((i) => (i + 1) % STEPS.length);
          }}
        />
        <div className="ml-1 flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}. ${s.title[language]}`}
              aria-current={i === index}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                i <= index ? "bg-accent" : "bg-border hover:bg-ink-muted",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
