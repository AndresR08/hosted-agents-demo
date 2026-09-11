import { useEffect, useState } from "react";
import { Tooltip } from "@fluentui/react-components";
import controlesEmpresarialesMark from "@/assets/controles-empresariales-mark.png";
import { env } from "@/config/env";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import { cn } from "@/lib/cn";

/**
 * The topbar — FIGMA_ADOPTION.md §0.4, §0.7.
 *
 * A full-width 56px band above the rail, carrying the presenter's company
 * identity on the left and what this console is pointed at on the right.
 *
 * WHY 56px IS EXACTLY 56px
 *
 * It is the one dimension in this file that may not drift. Every one of the
 * nine stage screens pays for it out of a vertical budget that took three
 * sessions to get to 0px of hidden content (§4.8/§4.9/§4.11), so the height
 * is fixed and the content is chosen to fit it rather than the other way
 * round: a 40px mark plus 8px of padding, and a single 16px line of text
 * that fits inside the mark's own height.
 *
 * WHAT THE SPEC ASKED FOR AND DID NOT GET, AND WHY
 *
 * The supplied Figma spec put a second line under the company name —
 * "Azure AI Gateway · Demo Platform", 10px, #D4003B. It is not here, and
 * dropping it resolved three problems at once rather than one:
 *
 *  - #d4003b on this ground measures 3.13:1. As *text* that is under AA,
 *    and no amount of weight fixes it.
 *  - 10px is far under the 16px projector floor §4.5 sets and F7 spent a
 *    whole pass reaching. Exempting the topbar would have been a silent
 *    reversal of a rule stated absolutely.
 *  - The spec's own numbers do not close: a 40px logo with 12px padding is
 *    64px, not 56px, and a two-line brand block at the 16px floor is worse.
 *    Without the subtitle, 56px is exact.
 *
 * The spec's own responsive rule already named the subtitle as the first
 * thing to hide, which is close to admitting it is the least load-bearing
 * element in the bar.
 *
 * Inter is not loaded either. §0.3 of VISUAL_LANGUAGE_ADOPTION.md rejected
 * it once already: it buys nothing over Segoe UI Variable and costs a web
 * font on a machine that may be presenting without reliable connectivity.
 *
 * WHY THE RIGHT SIDE IS THE DEPLOYMENT AND NOT A VERSION BADGE
 *
 * §0.7. The reference is a multi-solution shell whose topbar says which
 * solution is active; this console is one solution, so that slot would have
 * been a label that always reads the same — the shape §1.6 exists to
 * prevent. The version badge had a worse problem: `package.json` is
 * `0.0.0`, so a `v2.4.0` badge would have been a rendered invention.
 *
 * The slot carries the Live / Simulation indicator and the deployment's
 * identity instead. That is real, it changes, and it is the honesty
 * system's most important persistent signal — it moved here FROM the rail
 * footer rather than being duplicated, so there is still exactly one of it
 * on screen and still exactly one component fetching it.
 */
export function Topbar() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);

  const [liveEnv, setLiveEnv] = useState<{
    region: string;
    resourceGroupName: string;
    resourceCount: number;
  } | null>(null);

  useEffect(() => {
    if (mode !== "live") {
      setLiveEnv(null);
      return;
    }
    let cancelled = false;
    service
      .getEnvironmentContext()
      .then((ctx) => {
        if (!cancelled) setLiveEnv(ctx);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  const region = liveEnv?.region ?? env.region;
  const resourceGroup = liveEnv?.resourceGroupName ?? env.resourceGroupName;
  const resourceCount = liveEnv?.resourceCount ?? 21;
  const modeLabel = mode === "live" ? t("header.statusLive") : t("header.statusSimulation");

  return (
    <header
      className="flex h-14 shrink-0 items-center bg-rail text-rail-ink"
      aria-label={t("topbar.label")}
    >
      {/*
        The 6px brand bar, full height. Decorative — it carries no
        information, which is the only reason a 3.13:1 crimson is allowed
        to be here at all: that clears the 3:1 asked of a non-text graphic
        and nothing about the bar needs to be read.
      */}
      <span className="h-14 w-1.5 shrink-0 bg-brand" aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-3.5 px-5">
        <img
          src={controlesEmpresarialesMark}
          alt=""
          aria-hidden="true"
          className="h-10 w-auto shrink-0"
        />
        {/*
          `truncate` here and nowhere else in this bar: the company name is
          the one string that may be clipped rather than dropped, because
          the bar must never grow and something has to give at 1024.
        */}
        <span className="truncate text-body font-semibold tracking-[0.3px] text-white">
          Controles Empresariales
        </span>
      </div>

      {/*
        The deployment. `ml-auto` rather than `justify-between` so the brand
        block keeps its natural width and only this side absorbs the slack.
      */}
      <Tooltip
        content={`${modeLabel} · ${region} · ${resourceGroup} · ${resourceCount}`}
        relationship="label"
        positioning="below"
      >
        <div className="ml-auto flex min-w-0 shrink items-center gap-3 pr-6">
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors duration-300 motion-reduce:transition-none",
                mode === "live" ? "bg-rail-live-mark" : "bg-illustrative-fg",
              )}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap text-caption font-medium">{modeLabel}</span>
          </span>
          {/*
            Hidden below `lg`, which is the spec's responsive rule applied to
            the element we actually have: the bar keeps its height, the mode
            label always survives, and the detail is what goes first.
          */}
          <span className="hidden min-w-0 truncate text-caption text-rail-ink-muted lg:block">
            {region} · <span className="font-mono">{resourceGroup}</span> · {resourceCount}
          </span>
        </div>
      </Tooltip>
    </header>
  );
}
