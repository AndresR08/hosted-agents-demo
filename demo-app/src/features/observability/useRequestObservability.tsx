import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { LiveCallError } from "@/components/LiveCallError";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import type { DemoMode } from "@/config/env";
import type { RequestObservability } from "@/services/contracts";

/** Log Analytics runs 1–3 min behind, so a just-asked request needs re-checking. */
const POLL_INTERVAL_MS = 20_000;

/**
 * The one request's telemetry, shared by both Observability tabs.
 *
 * It was inline in `ObservabilityStop` until that screen split into Record and
 * Measurements. Both halves read the same `getRequestObservability(lastAskId)`
 * result, and two copies of a polling effect would mean two poll timers, two
 * error states, and two chances for the tabs to disagree about whether the
 * data has landed — so the fetch is a hook and the tabs are views of it.
 *
 * Nothing about the honesty contract changed in the move: fields still arrive
 * wrapped as `{ value, source, available }` and still render through
 * `ObservableValue`, which prints "Unavailable in this deployment" rather than
 * a zero.
 */
export function useRequestObservability() {
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

  return { obs, checked, obsError, hasData: Boolean(obs), mode, lastAskId };
}

/**
 * Four different reasons there is nothing to show, told apart rather than
 * collapsed into one message. Simulation cannot query Azure; no request has
 * been made; the request is too old to correlate; the broker could not be
 * reached. Each is true of a different situation and only one is a fault.
 */
export function TelemetryEmptyState({
  mode,
  checked,
  hasAsk,
  error,
}: {
  mode: DemoMode;
  checked: boolean;
  hasAsk: boolean;
  error: string | null;
}) {
  const t = useTranslation();

  // A real failure to reach the broker is not "telemetry is still landing" —
  // reuse the same error pattern every other write/read in this app shows,
  // rather than folding it into the same copy as the honest 404 case below.
  if (mode === "live" && error) {
    return <LiveCallError detail={error} className="py-10 text-center" />;
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
