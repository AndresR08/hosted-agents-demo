import { useEffect, useState } from "react";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { JourneyTimings } from "@/services/contracts";
import { GatewaySubNav } from "./GatewaySubNav";
import { RequestFlowDiagram } from "./RequestFlowDiagram";

/*
 * The node list, the per-connector timing map and the ms formatter moved to
 * RequestFlowDiagram.tsx with the animated path. They were only ever used by
 * the block this screen now delegates, and leaving a second copy here is how
 * the diagram and the numbers beside it drift apart.
 *
 * REVEAL_STAGGER_MS went with the credential test to CredentialTestStop.tsx;
 * it paced that reveal and nothing on this screen.
 */

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
 * The third part — **the terms**, i.e. which credentials the gateway accepts
 * — is no longer here. It is CredentialTestStop, on its own tab, because
 * three arguments do not fit one screen at the 16px projector floor: this stop
 * was hiding 220px of itself below the fold. That split was provisional until
 * CP3 re-measured it under the sidebar's chrome; DESIGN_DECISIONS.md §4.8 is
 * now resolved and records both the measurement and what it costs.
 *
 * The address and the path now share one heading rather than carrying one
 * each. They were always one argument stated twice — the URL says the agent
 * name is a path segment, the diagram shows the request travelling that path
 * — and two headings asked the room to hold them apart for no reason.
 *
 * `test-apim` and `reload-policies` moved to Settings → Maintenance. §4.4
 * puts presenter instruments in the presenter menu; they were on the stage,
 * which contradicted it.
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

  const [routeTemplate, setRouteTemplate] = useState<string | null>(null);
  const [totalLatencyMs, setTotalLatencyMs] = useState<number | null>(null);
  const [servedByAgent, setServedByAgent] = useState<string | null>(null);
  const [timings, setTimings] = useState<JourneyTimings | null>(null);

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

  const agentNodeLabel = servedByAgent ?? targetAgent;

  return (
    <StopFrame
      title={t("gw.heading")}
      question={t("gw.question")}
      action={<GatewaySubNav />}
      footer={t("journey.caption")}
      provenance={
        <ProvenanceBadge
          provenance={{ band: mode === "live" && totalLatencyMs != null ? "live" : "illustrative" }}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {/*
          The address and the path, under one heading. Always shown at full
          presence — a console states what the route is, it does not stage a
          reveal of it.

          `gw.route.title` is retired rather than deleted: the string still
          names the argument accurately, and the next reader deserves to find
          it in translations.ts rather than wonder whether the address stopped
          being addressed at all.
        */}
        <section>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("gw.path.title")}
          </p>
          <RouteLine template={routeTemplate} agentName={targetAgent} />
          <p className="mb-2 mt-1.5 text-caption leading-relaxed text-ink-muted">
            {t("gw.route.note")}
          </p>
          <RequestFlowDiagram
            timings={timings}
            agentLabel={agentNodeLabel}
            runToken={runToken}
            idle={totalLatencyMs == null}
          />

          {(timings?.available || totalLatencyMs != null) && (
            <div className="mt-2 flex items-center justify-end gap-4">
              {timings?.available && timings.totalGatewayOverheadMs != null && (
                <p className="whitespace-nowrap text-caption text-ink-muted">
                  {t("journey.gatewayOverhead")}:{" "}
                  <span className="font-medium tabular-nums text-accent">
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

      </div>
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
      <p className="text-caption italic text-ink-muted">{t("gw.route.unavailable")}</p>
    );
  }

  const [before, after] = template.split("{agentName}");

  return (
    <p className="break-all rounded-md border border-border bg-illustrative-bg/50 px-3 py-2 font-mono text-caption text-ink">
      <span className="text-ink-muted">POST </span>
      {before}
      <span className="rounded bg-accent/15 px-1 font-semibold text-accent" title={t("gw.route.segmentLabel")}>
        {agentName}
      </span>
      {after}
    </p>
  );
}
