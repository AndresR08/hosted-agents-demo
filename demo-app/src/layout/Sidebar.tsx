import { useEffect, useState, type ComponentType } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Tooltip,
} from "@fluentui/react-components";
import {
  BotFilled,
  BotRegular,
  ChatRegular,
  HomeRegular,
  PulseRegular,
  ServerRegular,
  SettingsRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import controlesEmpresarialesMark from "@/assets/controles-empresariales-mark.png";
import { env } from "@/config/env";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import {
  SECTION_ORDER,
  SECTION_STOPS,
  STOP_TO_SECTION,
  type SectionId,
} from "@/state/types";
import { cn } from "@/lib/cn";

const ICONS: Record<SectionId, ComponentType<{ fontSize?: number }>> = {
  agents: BotRegular,
  gateway: ShieldKeyholeRegular,
  observability: PulseRegular,
  platform: ServerRegular,
};

/**
 * The navigation rail — VISUAL_LANGUAGE_ADOPTION.md §0.8 and §1.1.
 *
 * WHY THIS EXISTS AT ALL, AND WHAT IT BOUGHT
 *
 * It replaces two horizontal bands: the 72px environment header and the 48px
 * section row. Those bands were a permanent 120px tax on every screen's
 * vertical budget, paid at the one resolution that matters (1366×768), to show
 * things that do not change while a presenter talks. Measured, with the same
 * probe used throughout CP2:
 *
 *   budget today                        411px
 *   section row moved into the rail     459px
 *   both bands moved into the rail      531px
 *
 * That is the argument for the rail. It is not a restyle — §4.7 forbids page
 * scroll at 1366×768, four screens had to be reflowed to obey it, and this
 * returns 120px of the budget that made the reflow necessary.
 *
 * WHAT MOVED HERE
 *
 * Everything that was permanent chrome: the brand lockup, the four sections,
 * the live/simulation indicator with its environment line, the current-agent
 * badge, and the copilot / home / settings controls. `Header.tsx` is no longer
 * mounted; nothing it displayed was dropped.
 *
 * WHY IT IS DARK IN BOTH THEMES
 *
 * §0.8. It reads as deliberate rather than as a theme bug, and it gives the
 * console a fixed anchor that does not move when a presenter switches theme
 * mid-session. The `--color-rail-*` tokens are absolute for exactly that
 * reason and are never redefined under `.dark`. This did not change when the
 * palette did — the rail is still fixed-dark in light and dark theme alike.
 *
 * WHY THE RAIL HAS TWO ACCENTS AND THE REST OF THE CONSOLE HAS ONE
 *
 * The rail marks three things — the active section, a pressed control, the
 * Live indicator — and used to borrow `--color-accent` for all of them. The
 * supplied palette splits them: `--color-brand` (crimson) is *where you
 * are*, `rail-live` (indigo) is *what is on*. The rail no longer owns a
 * near-duplicate red of its own — there is one canonical brand red now and
 * this uses it (FIGMA_ADOPTION.md §1.6).
 *
 * `rail-live` is indigo and not green on purpose: the palette came from a
 * dashboard that paints "healthy" green, `--color-affirm` here is the 401
 * rejection and nothing else (§4.4/§4.5), and a second green undoes the F4
 * audit in one step.
 *
 * The active item spent one commit on the indigo instead, because the pink
 * and the crimson mark above it are the same hue. They are — and they do not
 * collide at these proportions. §4.13 has the whole exchange; the short
 * version is that the deployed app this palette comes from runs the same two
 * colours the same distance apart and reads fine, and what was actually
 * wrong here was the size of the lockup, not its hue.
 *
 * The focus ring is `rail-ink`, not either accent, and it stayed that way
 * through the revert: it has to read against the rail ground *and* against
 * the fill it surrounds, and a pink ring on the pink fill is 1:1.
 *
 * WHY THE FOUR SECTIONS STAY FLAT
 *
 * §1.1. They are objects, not steps. The UX audit's finding was that "a lost
 * presenter is one click from anywhere", and nesting would trade that away for
 * nothing. Gateway's own tabs deliberately do not appear here either: they are
 * views of one object, and promoting Reference to a rail peer would make
 * curated capability text look like a fifth section that reads real Azure data
 * — the exact confusion the dashed frame and banner exist to prevent.
 *
 * WHY THE MODE INDICATOR MOVED BUT THE MODE TOGGLE DID NOT
 *
 * §1.2. The indicator is persistent here, so the room can always see whether
 * it is looking at live Azure or Simulation — that strengthens the honesty
 * system rather than merely relocating it. The *control* stays in the settings
 * drawer and on `L`, because §4.2's rule still holds: a visible "demo
 * controls" panel tells the audience they are watching a demo.
 */
export function Sidebar({ className }: { className?: string }) {
  const t = useTranslation();
  const service = useDemoDataService();
  const stop = useDemoStore((s) => s.stop);
  const goToStop = useDemoStore((s) => s.goToStop);
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const openSettings = useDemoStore((s) => s.openSettings);
  const copilotOpen = useDemoStore((s) => s.copilotOpen);
  const toggleCopilot = useDemoStore((s) => s.toggleCopilot);
  const hasActiveConversation = useDemoStore((s) => s.hasActiveConversation);
  const resetDemoState = useDemoStore((s) => s.resetDemoState);

  const [agentVersions, setAgentVersions] = useState<Record<string, string>>(
    {},
  );
  const [liveEnv, setLiveEnv] = useState<{
    region: string;
    resourceGroupName: string;
    resourceCount: number | null;
  } | null>(null);
  const [envFailed, setEnvFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const collapsed = useRailCollapsed();
  const activeSection = STOP_TO_SECTION[stop];

  useEffect(() => {
    if (mode !== "live") {
      setAgentVersions({});
      return;
    }
    let cancelled = false;
    // Versions come from the same live registry the Agents panel reads, so the
    // rail can never show a version that is not deployed.
    service
      .listAgents()
      .then((agents) => {
        if (cancelled) return;
        setAgentVersions(
          Object.fromEntries(agents.map((a) => [a.name, a.version])),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  useEffect(() => {
    setLiveEnv(null);
    setEnvFailed(false);
    if (mode !== "live") return;
    let cancelled = false;
    service
      .getEnvironmentContext()
      .then((ctx) => {
        if (!cancelled) setLiveEnv(ctx);
      })
      .catch(() => {
        if (!cancelled) setEnvFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  const targetAgentVersion = agentVersions[targetAgent] ?? "";

  // Region and group fall back to this build's configuration, which names the
  // deployment the console is pointed at - configured, not invented.
  const region = liveEnv?.region ?? env.region;
  const resourceGroup = liveEnv?.resourceGroupName ?? env.resourceGroupName;
  /*
   * The count has no such fallback, because there is nothing true to fall back
   * to. This line used to read `?? 21` - ARCHITECTURE.md §5's manual inventory,
   * which OperationsStop already refuses to show - and that 21 appeared under
   * "Azure en vivo" while the read was loading, when it failed, and permanently
   * in Simulation. That was fixed while this indicator lived in the topbar and
   * the fix comes back here with it; do not reintroduce the literal.
   *
   *   Live, answered with a number   the number
   *   Live, failed or answered null  "recuento no disponible", said out loud
   *   Live, still loading            nothing - no claim yet
   *   Simulation                     nothing - there is no live count to show
   */
  const resourceCount: string | null =
    mode !== "live"
      ? null
      : typeof liveEnv?.resourceCount === "number"
        ? String(liveEnv.resourceCount)
        : envFailed || liveEnv
          ? t("rail.resourceCountUnavailable")
          : null;
  const modeLabel =
    mode === "live" ? t("header.statusLive") : t("header.statusSimulation");

  /*
   * Home restarts the demonstration in place. It used to navigate back to
   * the landing page; with that screen gone it calls resetDemoState, which
   * does everything the trip to the landing page used to do - including
   * remounting the stage and the copilot, via sessionKey.
   *
   * The confirmation survives unchanged, because the reason for it did: a
   * reset still discards a live conversation. `Esc` still silently does
   * nothing in that state; this button is the discoverable exit.
   */
  function handleHome() {
    if (hasActiveConversation) setConfirmOpen(true);
    else resetDemoState();
  }

  return (
    <nav
      aria-label={t("rail.label")}
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-full shrink-0 flex-col bg-rail text-rail-ink",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-[64px] px-2 py-4" : "w-[250px] px-3.5 py-5",
        className,
      )}
    >
      {/*
        The brand lockup: the presenter's mark and the product's name.

        The mark was moved out to the topbar when that band existed, on the
        argument that rendering the same crimson glyph twice on one screen
        looked indecisive. With the band gone there is only one place left for
        it, so the argument is spent and the mark comes home — which is also
        what the reference shell does, and the shape below is measured off it
        rather than eyeballed:

          rail width          239px          (ours: 250)
          symbol              34 x 34px
          symbol -> text gap  11px           (ours: 10, gap-2.5)
          text                two short lines, white, bold, TO THE RIGHT
          brand block height  34px total - the symbol governs it
          air before nav      ~30px          (ours: pb-8)

        It is NOT tinted, boxed or given a coloured plate: it carries its own
        crimson, which measures 3.37:1 on `--color-rail` — above the 3:1 bar a
        non-text graphic has to clear, and it clears it in both themes because
        the rail does not change between them.

        `alt=""` and `aria-hidden`: the words beside it already name the
        console, and the attribution the mark stands for is spelled out in the
        rail footer. A screen reader that announced the mark here would read
        the presenter's name before the product's.

        Collapsed, both sets of words are gone and the mark is all that is
        left, so that is the one state where it is labelled rather than hidden.
      */}
      <div
        className={cn(
          "flex gap-2.5 pb-8",
          collapsed ? "justify-center" : "items-center px-1",
        )}
      >
        {collapsed ? (
          <Tooltip
            content={`Microsoft ${t("header.productName")} · ${t("footer.presentedBy")}`}
            relationship="label"
            positioning="after"
          >
            <img
              src={controlesEmpresarialesMark}
              alt=""
              className="h-[34px] w-auto shrink-0"
            />
          </Tooltip>
        ) : (
          <img
            src={controlesEmpresarialesMark}
            alt=""
            aria-hidden="true"
            className="h-[34px] w-auto shrink-0"
          />
        )}
        {/*
          Wrapping, not truncating. 250px minus the 34px mark and its gap
          leaves ~188px, and the name is longer than that in both locales —
          with `truncate` the console introduced itself as "Microsoft Foundry
          H...". A brand lockup that cannot say the product's name is worse
          than a two-line one, and two lines is exactly what the reference
          sets its own name in.
        */}
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-body font-semibold leading-tight">
              Microsoft {t("header.productName")}
            </span>
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-0.5">
        {SECTION_ORDER.map((section) => {
          const isActive = section === activeSection;
          const Icon = ICONS[section];
          const label = t(`nav.${section}`);

          const button = (
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              onClick={() => {
                if (isActive) return;
                goToStop(SECTION_STOPS[section][0]);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[10px] text-caption font-semibold",
                "transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-ink",
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                /*
                  `text-white`, not `text-rail-ink`: the label sits on a
                  coloured plate and pure white is the brighter of the two
                  passing values (5.44:1 against the brand fill).

                  The fill clears the 3:1 that 1.4.11 asks of a state carried
                  by colour — 3.13:1 on the rail ground — and it is not the
                  only signal: the label goes from muted to white and the
                  icon with it, so "where you are" survives even for someone
                  who cannot separate the two reds.
                */
                isActive
                  ? "bg-brand text-white hover:bg-brand-hover"
                  : "text-rail-ink-muted hover:bg-rail-hover hover:text-rail-ink",
              )}
            >
              <Icon fontSize={18} />
              {!collapsed && (
                /*
                  The per-item subtitle is the reference's real contribution
                  to this rail (FIGMA_ADOPTION.md 0.5) — its crimson edge bar
                  failed contrast and was dropped, this did not. It says what
                  the section answers, which is the difference between a menu
                  and a map.

                  Only the ACTIVE item shows it. Showing four subtitles at
                  once turns the rail into a paragraph and costs vertical
                  space the rail does have but the eye does not; showing one
                  keeps the list scannable and explains the thing the
                  presenter is actually on.

                  white/90 on the brand fill measures 4.56:1 — AA, and the
                  reason it is not plain white is that a subtitle at the same
                  weight as its label stops reading as a subtitle.
                */
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{label}</span>
                  {isActive && (
                    <span className="truncate text-caption font-normal text-white/90">
                      {t(`nav.${section}.subtitle`)}
                    </span>
                  )}
                </span>
              )}
            </button>
          );

          return (
            <li key={section}>
              {/*
                Collapsed, the icon is the only affordance, so it needs a name
                a pointer and a screen reader can both reach. Expanded, a
                tooltip repeating the visible label is noise.
              */}
              {collapsed ? (
                <Tooltip
                  content={label}
                  relationship="label"
                  positioning="after"
                >
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ul>

      {/*
        The positioning sentence, moved out of the brand lockup.

        It is the one that says custom frameworks first and governance second,
        so deleting it to make the lockup compact was not an option. It sits
        here instead: `mt-auto` pushes it to the bottom of the rail's empty
        middle, above the status group's hairline rather than inside it, so it
        reads as a standalone line about the product and not as another piece
        of deployment status. The reference this layout came from puts its own
        positioning line in exactly this position.

        Collapsed there is no column to set it in, and it is the least urgent
        thing in the rail, so it goes rather than truncating.
      */}
      {!collapsed && (
        <p className="mt-auto px-1 pb-3 text-caption leading-snug text-rail-ink-muted">
          {t("header.tagline")}
        </p>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 border-t border-rail-border pt-3",
          // Collapsed, the tagline above is not rendered, so the footer group
          // has to be the thing that claims the leftover space.
          collapsed && "mt-auto",
        )}
      >
        {/*
          Which agent is answering. The room should always be able to see this
          — switching with 1/2 is otherwise invisible until the next answer
          lands — and a rail is the one place on screen that never scrolls
          away. Version comes from the live registry, never a literal.
        */}
        <Tooltip
          content={`${t("header.targetAgentLabel")}: ${targetAgent}${targetAgentVersion}`}
          relationship="label"
          positioning="after"
        >
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-rail-border px-2 py-1",
              collapsed && "justify-center px-0",
            )}
          >
            <BotFilled
              fontSize={14}
              className="shrink-0 text-rail-live-mark"
              aria-hidden="true"
            />
            {!collapsed && (
              <>
                <span className="truncate text-caption font-medium">
                  {targetAgent}
                </span>
                {targetAgentVersion && (
                  <span className="shrink-0 text-caption text-rail-ink-muted">
                    {targetAgentVersion}
                  </span>
                )}
              </>
            )}
          </span>
        </Tooltip>

        {/*
          The live / simulation indicator and the deployment identity. This is
          the honesty system's most important persistent signal, and it is back
          here after a spell in the topbar — a move each way, never a
          duplication: it appears exactly once on screen and exactly one
          component fetches it.

          `rail-live-mark` for Live and `illustrative-fg` for Simulation.
          `affirm` is the 401 and nothing else (§4.4/§4.5) — which is exactly
          the dot the reference palette wanted painted green, and the reason it
          is not. This is the indicator only; the toggle stays in the drawer
          and on `L`, per §1.2.
        */}
        <Tooltip
          content={[modeLabel, region, resourceGroup, resourceCount]
            .filter(Boolean)
            .join(" · ")}
          relationship="label"
          positioning="after"
        >
          <div
            className={cn(
              "flex flex-col gap-0.5 px-1",
              collapsed && "items-center px-0",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-colors duration-300 motion-reduce:transition-none",
                  mode === "live" ? "bg-rail-live-mark" : "bg-illustrative-fg",
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="truncate text-caption font-medium">
                  {modeLabel}
                </span>
              )}
            </span>
            {/*
              Also wrapping. The resource group name is the fact this line
              exists to carry — it is what identifies WHICH deployment the room
              is looking at — and truncating it to "lab-hoste..." made the line
              decorative. Two short lines beat one useless one.
            */}
            {!collapsed && (
              <span className="text-caption leading-snug text-rail-ink-muted">
                {region} ·{" "}
                <span className="break-all font-mono">{resourceGroup}</span>
                {resourceCount !== null && <> · {resourceCount}</>}
              </span>
            )}
          </div>
        </Tooltip>

        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <RailIconButton
            icon={<ChatRegular fontSize={18} />}
            label={copilotOpen ? t("copilot.close") : t("copilot.open")}
            pressed={copilotOpen}
            onClick={toggleCopilot}
          />
          <RailIconButton
            icon={<HomeRegular fontSize={18} />}
            label={t("header.homeLabel")}
            onClick={handleHome}
          />
          <RailIconButton
            icon={<SettingsRegular fontSize={18} />}
            label={t("header.settingsLabel")}
            onClick={openSettings}
          />
        </div>

        {/*
          The presenter attribution, now words only — the mark it used to sit
          beside was promoted to the brand block at the top of the rail.

          It stays behind rather than moving with the mark, and that is the
          point of keeping it: a crimson mark alone, at the top, next to
          "Microsoft Foundry Hosted Agents", is a lockup that reads as *this
          company made this product*. This line is what says what the mark
          actually means. Presenter attribution, not a demo fact — still
          deliberately outside the honesty-band vocabulary of §1.6.

          Wrapping, not truncating, for the same reason as the brand lockup
          above: "Presentado por Controles Empresariales" does not fit one
          line in a 250px column and this rail has the spare vertical space
          to let it wrap rather than clip. Collapsed there is no room for
          words at all, so the tooltip on the rail's own mark carries it.
        */}
        {!collapsed && (
          <Tooltip
            content={t("footer.presentedBy")}
            relationship="label"
            positioning="after"
          >
            {/*
              Muted by the token alone. It used to carry opacity-70 on top of
              text-rail-ink-muted as well, which composites to 3.94:1 on the
              rail - under AA, and nobody measured it when it was added.
              rail-ink-muted by itself is 6.65:1 and still reads as secondary
              next to rail-ink.
            */}
            <div className="px-1 pt-1">
              <span className="block text-caption leading-snug text-rail-ink-muted">
                {t("footer.presentedBy")}
              </span>
            </div>
          </Tooltip>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(_, data) => setConfirmOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("header.confirmReturnTitle")}</DialogTitle>
            <DialogContent>{t("header.confirmReturnBody")}</DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setConfirmOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setConfirmOpen(false);
                  resetDemoState();
                }}
              >
                {t("header.homeLabel")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </nav>
  );
}

/**
 * Fluent's `Button` carries its own light-theme surface tokens, which fight
 * the rail's fixed dark ground in ways that only show up in light mode. These
 * three are plain buttons against `--color-rail-*` instead.
 */
function RailIconButton({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} relationship="label" positioning="after">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          "transition-colors duration-150 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-ink",
          pressed
            ? "bg-rail-live text-white hover:bg-rail-live-hover"
            : "text-rail-ink-muted hover:bg-rail-hover hover:text-rail-ink",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

/**
 * When the rail folds to icons — VISUAL_LANGUAGE_ADOPTION.md §1.3.
 *
 * The proposal offered a rail that collapses at ≤1440px and an overlay that
 * never takes width at all; the rail was chosen, because a sidebar that slides
 * away is not the persistent anchor that justifies having one.
 *
 * But "≤1440px" would collapse at 1366 unconditionally, which spends the
 * labels at the presenting resolution to solve a problem that only exists when
 * the copilot is also open. §1.3's fit table is precise about this: everything
 * we render fits the 1064px a 250px rail leaves at 1366 — the single failing
 * row is the request path *with the copilot open*, which is the one state that
 * takes another ~380px.
 *
 * So the condition is both, not either. At 1366 presenting without the
 * copilot, the labels stay. Open the copilot and the rail folds to 64px,
 * returning 186px to the stage exactly when it is needed. Above 1440 nothing
 * folds, because nothing is tight.
 */
function useRailCollapsed() {
  const copilotOpen = useDemoStore((s) => s.copilotOpen);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1440,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1439px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return narrow && copilotOpen;
}
