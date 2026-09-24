import { useEffect, useState } from "react";
import { ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { EmptyState } from "@/components/EmptyState";
import { LiveCallError } from "@/components/LiveCallError";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import type { DemoMode } from "@/config/env";
import type { Provenance, RequestObservability } from "@/services/contracts";

/** Log Analytics runs 1–3 min behind, so a just-asked request needs re-checking. */
const POLL_INTERVAL_MS = 20_000;

/**
 * The last good reading per request, outside any component.
 *
 * Record and Measurements each mount their own instance of this hook. Kept in
 * component state alone, the last good reading died with the tab: switching
 * tabs during an outage mounted a fresh instance whose first poll failed, and
 * the screen went empty anyway - the exact failure the stale-reading mark
 * exists to prevent. A new mount seeds from here, for the same askId only.
 */
const lastGoodByAsk = new Map<string, { obs: RequestObservability; at: number }>();

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
 *
 * A FAILED POLL KEEPS THE LAST GOOD READING
 *
 * It used to clear it: one poll failing - a broker restart, a slow Log
 * Analytics query answering 502 - emptied both tabs in front of the room and
 * replaced a full record with an error, although nothing about the request
 * had changed. Now a failure leaves `obs` as it was and the hook reports when
 * it was last read successfully (`staleSince`); the screens mark it with
 * `StaleReadingNotice`. The next good poll clears the mark.
 *
 * Two things still clear it, because they are true answers rather than
 * failures: a successful response saying the request is unknown (`null`), and
 * a different request. The second matters more than it looks - without it, a
 * failure right after a new question would leave the PREVIOUS request's record
 * on screen under the new one.
 */
export function useRequestObservability() {
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const lastAskId = useDemoStore((s) => s.lastAskId);

  const [obs, setObs] = useState<RequestObservability | null>(null);
  /** When `obs` was last read successfully (epoch ms); null until the first good read. */
  const [lastGoodAt, setLastGoodAt] = useState<number | null>(null);
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
    // A new request, or leaving Live, never inherits the previous one's record;
    // the same request picks up where another mount of this hook left off.
    const seed = mode === "live" && lastAskId ? lastGoodByAsk.get(lastAskId) : undefined;
    setObs(seed?.obs ?? null);
    setLastGoodAt(seed?.at ?? null);
    setObsError(null);
    if (mode !== "live" || !lastAskId) {
      setChecked(mode !== "live");
      return;
    }
    setChecked(false);
    let cancelled = false;

    function poll() {
      service
        .getRequestObservability(lastAskId!)
        .then((result) => {
          if (cancelled) return;
          setObs(result);
          const at = Date.now();
          setLastGoodAt(result ? at : null);
          if (result) lastGoodByAsk.set(lastAskId!, { obs: result, at });
          else lastGoodByAsk.delete(lastAskId!);
          setObsError(null);
          setChecked(true);
        })
        .catch((err) => {
          if (cancelled) return;
          // `obs` is deliberately left as it was - see the note above.
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

  const staleSince = obs && obsError ? lastGoodAt : null;

  // While stale, the provenance badge has to age with the notice. The broker
  // stamped `obs.provenance` at the last good read; left alone it keeps saying
  // "just now" beside a notice that says the reading is minutes old.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (staleSince == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, [staleSince]);

  const provenance: Provenance = !obs
    ? { band: mode === "live" ? "live-delayed" : "illustrative" }
    : staleSince == null
      ? obs.provenance
      : {
          band: "live-delayed",
          ageSeconds: (obs.provenance.ageSeconds ?? 0) + Math.max(0, (now - staleSince) / 1000),
        };

  return {
    obs,
    checked,
    obsError,
    hasData: Boolean(obs),
    mode,
    lastAskId,
    /** Set only while data is on screen AND the latest poll failed: when that data was read. */
    staleSince,
    /** What the screen's ProvenanceBadge shows - aged while the reading is stale. */
    provenance,
  };
}

/**
 * The mark on a reading the latest poll could not refresh.
 *
 * Same register as `LiveCallError` (DESIGN_DECISIONS.md §4.5): one calm
 * sentence, no red, the transport detail one click away rather than on the
 * projector. What it must say is when the numbers on screen were read, and
 * that they are not current - the age keeps counting, so a long outage cannot
 * pass for a fresh reading.
 */
export function StaleReadingNotice({ since, detail }: { since: number; detail: string | null }) {
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.round((now - since) / 1000));
  const age = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  const time = new Date(since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const trimmed = detail?.trim();

  return (
    <div
      role="status"
      className="rounded-md border border-border bg-illustrative-bg/40 px-3 py-2 text-caption leading-relaxed text-ink-muted"
    >
      <p>
        <span aria-hidden="true">◐ </span>
        {t("obs.stale.notice").replace("{time}", time).replace("{age}", age)}
      </p>
      {trimmed && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-caption text-ink-muted underline-offset-2 hover:underline"
          >
            {open ? <ChevronDownRegular /> : <ChevronRightRegular />}
            {t("obs.stale.detail")}
          </button>
          {open && <p className="mt-1 break-words font-mono text-caption">{trimmed}</p>}
        </>
      )}
    </div>
  );
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
