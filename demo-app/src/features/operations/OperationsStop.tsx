import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  CheckmarkCircleFilled,
  ChevronRightRegular,
  CircleRegular,
  DismissCircleRegular,
} from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Skeleton } from "@/components/Skeleton";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import type {
  ControlsCatalogue,
  GovernanceControl,
  RequestObservability,
} from "@/services/contracts";
import { cn } from "@/lib/cn";

/** Two lines, the height the evidence slot reserves. See its comment. */
const CLAMP_2_LINES: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** Log Analytics runs 1–3 min behind, so a just-asked request needs re-checking. */
const POLL_INTERVAL_MS = 20_000;

/**
 * The approved, translated catalogue Simulation falls back to when the
 * broker's live ARM read is unavailable.
 */
const SIMULATION_ACTIVE_KEYS = [
  "controls.item.subscriptionKey",
  "controls.item.managedIdentity",
  "controls.item.headerEnforcement",
  "controls.item.auditLogging",
  "controls.item.diagnostics",
  "controls.item.contentFiltering",
  "controls.item.registryRbac",
];

const SIMULATION_AVAILABLE_KEYS = [
  "controls.item.rateLimiting",
  "controls.item.semanticCaching",
  "controls.item.loadBalancing",
  "controls.item.privateNetworking",
  "controls.item.entraOnly",
  "controls.item.keyVault",
];

/**
 * PLATFORM — "what is deployed, and what does the operations team administer?"
 *
 * Three things a platform team asks for, none of them about one request:
 *
 *  - **Environment** — the deployed resource group, region and live ARM
 *    resource count (`getEnvironmentContext()`), the same read the header
 *    strip uses. Never the manual 21-item inventory `ARCHITECTURE.md` §5
 *    documents — that counts sub-resources a simple ARM resource list does
 *    not enumerate; this shows only what a live read actually returns.
 *  - **Controls** — an inventory of what this deployment enforces, what the
 *    same control point offers that is not switched on here, and what the
 *    lab does not include at all. Two states, one shape: before any request
 *    it renders the live catalogue from `/api/controls`; once a request
 *    exists it upgrades in place, each active control citing the
 *    observation from *that* request which proves it. The three-state split
 *    is deliberate and is the panel's whole credibility — "not enabled" is a
 *    fact about configuration, not a gap in the architecture, and stating it
 *    plainly cannot be contradicted by anyone who later reads the
 *    deployment, which a fabricated throttling event certainly could
 *    (DESIGN_DECISIONS.md).
 *  - **Actions** — the four broker diagnostics that are platform-wide rather
 *    than scoped to one agent or the gateway (`ping`, `refresh-azure-status`,
 *    `reload-audit-logs`, `refresh-deployment-info`) — the remaining
 *    Presenter Tools → Maintenance actions not already promoted onto Agents
 *    or Gateway, completing all nine as first-class console capability.
 */
export function OperationsStop() {
  /*
   * ONE control open at a time, across all three groups.
   *
   * The catalogue grew an evidence string per control - the observation from
   * this request that proves it - and with them all expanded the screen held
   * 891px of content in a 485px budget. Collapsing all but one is what
   * guarantees the height cannot creep back: adding an eighteenth control adds
   * one collapsed row, not one row and its evidence.
   *
   * Chosen over splitting the catalogue across tabs. Gateway already carries a
   * tab split and Observability just gained one, and a third in the same pass
   * would trade a height problem for a navigation problem. This is also the
   * list-plus-detail shape Agents already uses, so it is a pattern the console
   * has rather than a new one.
   *
   * The collapsed row still states the control's name and its status pill, so
   * the room can read what it is looking at before anything is opened; the
   * evidence is what waits for a question. Every row is a real button with a
   * chevron - visible rather than hover-only, because a projector has no hover
   * and the presenter has to know a row opens before a customer asks.
   */
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const lastAskId = useDemoStore((s) => s.lastAskId);

  const [obs, setObs] = useState<RequestObservability | null>(null);
  const [catalogue, setCatalogue] = useState<ControlsCatalogue | null>(null);

  // The catalogue — deployment configuration, read once per mode.
  useEffect(() => {
    if (mode !== "live") {
      setCatalogue(null);
      return;
    }
    let cancelled = false;
    service
      .getControlsCatalogue()
      .then((result) => {
        if (!cancelled) setCatalogue(result);
      })
      .catch(() => {
        if (!cancelled) setCatalogue({ active: [], available: [], provenance: { band: "live" } });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  // The evidenced view, when there is a request to evidence.
  useEffect(() => {
    if (mode !== "live" || !lastAskId) {
      setObs(null);
      return;
    }
    let cancelled = false;
    function poll() {
      service
        .getRequestObservability(lastAskId!)
        .then((result) => {
          if (!cancelled) setObs(result);
        })
        .catch(() => undefined);
    }
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, lastAskId, service]);

  const loading = mode === "live" && !obs && catalogue === null;

  const active: GovernanceControl[] = obs
    ? obs.governance.active
    : mode === "live" && catalogue
      ? catalogue.active.map((c) => ({ id: c.id, name: c.name }))
      : SIMULATION_ACTIVE_KEYS.map((key) => ({ id: key, name: t(key) }));

  const available: GovernanceControl[] = obs
    ? obs.governance.available
    : mode === "live" && catalogue
      ? catalogue.available.map((c) => ({ id: c.id, name: c.name }))
      : SIMULATION_AVAILABLE_KEYS.map((key) => ({ id: key, name: t(key) }));

  const absent: GovernanceControl[] = obs ? obs.governance.absent : [];

  /*
   * Resolved once, here, rather than in each group: the slot below the list
   * shows whichever control is selected regardless of which group it came
   * from, and only one may be selected at a time. That is what keeps this
   * screen's height constant - see the slot's own comment.
   */
  const selectedDetail =
    [...active, ...available, ...absent].find((c) => c.id === selectedControl) ?? null;
  const evidenced = Boolean(obs);

  return (
    <StopFrame
      title={t("platform.heading")}
      question={t("platform.question")}
      footer={t("ops.caption")}
      provenance={
        <ProvenanceBadge
          provenance={
            obs?.provenance ?? catalogue?.provenance ?? { band: mode === "live" ? "live" : "illustrative" }
          }
        />
      }
    >
      <div className="flex flex-col gap-3">

        {/*
          No section heading. "Control catalogue - this deployment" labelled the
          only section on the screen, under a frame that already states
          PLATFORM and asks "what is deployed and what does the operations team
          administer?" - and above three group headers that each name their own
          group. A label for the only thing present is a label that says
          nothing, and it cost 24px on a screen with no room for it.
          `obs.gov.catalogue` is kept in translations.ts; the dialog still uses
          it, where it does distinguish one section from another.
        */}
        <section>
          {loading ? (
            <ul className="flex flex-col gap-2.5" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                  <Skeleton style={{ width: `${72 - i * 8}%` }} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-1">
              {!obs && (
                <p className="text-caption leading-relaxed text-ink-muted">{t("obs.gov.catalogueNote")}</p>
              )}

              <ControlGroup
                tone="active"
                selectedId={selectedControl}
                onSelect={setSelectedControl}
                title={t("obs.gov.active")}
                controls={active}
                icon={CheckmarkCircleFilled}
              />
              <ControlGroup
                tone="available"
                selectedId={selectedControl}
                onSelect={setSelectedControl}
                title={t("obs.gov.available")}
                controls={available}
                icon={CircleRegular}
              />
              <ControlGroup
                tone="absent"
                selectedId={selectedControl}
                onSelect={setSelectedControl}
                title={t("obs.gov.absent")}
                controls={absent}
                icon={DismissCircleRegular}
              />

              {/*
                The selected control's evidence, in one slot of constant
                height rather than inline in its row.

                Inline, the height of this screen depended on WHICH control was
                open: at half the grid width an evidence string wrapped to two
                lines, and expanding a left-column row also stretched its
                right-column neighbour. That is a layout whose fit cannot be
                verified once - it has seventeen different heights.

                Here the slot is always rendered, always the same height, and
                full width, which is also enough width for the evidence to read
                as one line instead of two. Collapsed and expanded measure the
                same, so adding an eighteenth control can only add one
                collapsed row.

                When nothing is selected it says so rather than sitting empty:
                a blank strip below a list reads as a rendering fault, and the
                sentence doubles as the instruction for how to use the list.
              */}
              {/*
                50px reserved, and the text clamped to the two lines that fit
                in it. Sixteen of the seventeen evidence strings are one line
                at this width; one - the RAI note, whose "configuration, not a
                per-request signal" qualifier must not be cut - is two. Sizing
                the slot for the worst case rather than letting it grow is what
                makes the screen one height instead of seventeen, and the whole
                point of moving the evidence out of the rows.
              */}
              <div className="min-h-[50px] border-t border-border pt-1.5">
                {selectedDetail ? (
                  <p
                    className="animate-fade-slide-in break-words text-caption leading-snug text-ink-muted"
                    style={CLAMP_2_LINES}
                  >
                    <span className="font-medium text-ink">{selectedDetail.name}</span>
                    <span aria-hidden="true"> · </span>
                    {evidenced && selectedDetail.evidence && (
                      <span className="mr-1 font-medium text-accent">{t("obs.gov.evidenced")}</span>
                    )}
                    {selectedDetail.evidence ?? selectedDetail.note}
                  </p>
                ) : (
                  <p className="text-caption italic leading-snug text-ink-muted">
                    {t("obs.gov.selectHint")}
                  </p>
                )}
              </div>

              {mode !== "live" && (
                <p className="text-caption text-ink-muted">{t("controls.availableCaption")}</p>
              )}
            </div>
          )}
        </section>

      </div>
    </StopFrame>
  );
}

/**
 * One state group: a bordered section with a count, containing one card per
 * control.
 *
 * Each card carries what a risk function asks for — what the control is,
 * whether it is on, and what proves it. Only the Active group has proof,
 * because only active controls were observed firing on this specific request;
 * the other two carry the technical reason instead. That asymmetry is the
 * substance of the stop, so it is rendered rather than described.
 */
function ControlGroup({
  tone,
  title,
  controls,
  icon: Icon,
  selectedId,
  onSelect,
}: {
  tone: "active" | "available" | "absent";
  title: string;
  controls: GovernanceControl[];
  icon: ComponentType<{ fontSize?: number; className?: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslation();
  if (controls.length === 0) return null;

  const statusLabel =
    tone === "active"
      ? t("obs.gov.statusActive")
      : tone === "available"
        ? t("obs.gov.statusAvailable")
        : t("obs.gov.statusAbsent");

  return (
    // accent for "enforced here" - the same "this is on" family as a Running
    // agent and the Live badge. affirm belongs to the 401 alone.
    <section className={cn("rounded-lg border", tone === "active" ? "border-accent/40" : "border-border")}>
      <header
        className={cn(
          "flex items-baseline justify-between gap-2 rounded-t-lg border-b px-3 py-0.5",
          tone === "active"
            ? "border-accent/30 bg-accent/[0.06]"
            : "border-border bg-illustrative-bg/50",
        )}
      >
        <p
          className={cn(
            "text-caption font-semibold uppercase tracking-[0.06em]",
            tone === "active" ? "text-accent" : "text-ink-muted",
          )}
        >
          {title}
        </p>
        <span className="shrink-0 text-caption font-medium tabular-nums text-ink-muted">
          {controls.length}
        </span>
      </header>

      {/*
        `divide-y` cannot be used on a grid: it draws a rule on every child
        after the first, including the two that sit side by side, which reads
        as a broken ladder. Row separators are applied explicitly and
        suppressed on the first row instead.
      */}
      <ul className="grid grid-cols-2 [&>li]:border-t [&>li]:border-border/60 [&>li:nth-child(-n+2)]:border-t-0">
        {/*
          Rows are py-1, not py-1.5. Platform landed at exactly 411px of
          content in a 411px budget - technically compliant and practically
          not: a zero margin means the next control added to the catalogue, or
          one label wrapping to a second line on a narrower projector, silently
          pushes content below the fold again. 4px of padding on a 22px row
          buys 28px of real slack across the thirteen rows and costs nothing
          that can be seen; the rows are separated by borders, not whitespace.
        */}
        {controls.map((c) => {
          const isOpen = selectedId === c.id;
          return (
          <li key={c.id}>
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => onSelect(isOpen ? null : c.id)}
            className={cn(
              "flex w-full items-start gap-2 px-3 py-0.5 text-left",
              "transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60",
              isOpen ? "bg-accent/[0.05]" : "hover:bg-illustrative-bg/60",
            )}
          >
            <Icon
              fontSize={15}
              className={cn(
                "mt-0.5 shrink-0",
                tone === "active" ? "text-accent" : "text-ink-muted",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "min-w-0 text-body font-medium leading-snug",
                    tone === "absent" ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {c.name}
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-px text-caption uppercase tracking-[0.04em]",
                    tone === "active"
                      ? "bg-accent/10 text-accent"
                      // Dashed outline, full-contrast text: the same vocabulary
                      // the Reference tab uses for "not in this lab", and it
                      // survives a projector where a dimmer fill does not.
                      : "border border-dashed border-border bg-transparent text-ink-muted",
                  )}
                >
                  {statusLabel}
                </span>
                {/*
                  A chevron, not a hover-only affordance. The presenter has to
                  see that a row opens BEFORE a customer asks about it, and a
                  projector has no hover.
                */}
                <ChevronRightRegular
                  fontSize={12}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-ink-muted transition-transform duration-150 motion-reduce:transition-none",
                    isOpen && "rotate-90",
                  )}
                />
              </div>

            </div>
          </button>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
