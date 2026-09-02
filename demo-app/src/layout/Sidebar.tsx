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
  CubeRegular,
  HomeRegular,
  PulseRegular,
  ServerRegular,
  SettingsRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import { env } from "@/config/env";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import { SECTION_ORDER, SECTION_STOPS, STOP_TO_SECTION, type SectionId } from "@/state/types";
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
 * reason and are never redefined under `.dark`.
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
  const goToLanding = useDemoStore((s) => s.goToLanding);

  const [liveEnv, setLiveEnv] = useState<{
    region: string;
    resourceGroupName: string;
    resourceCount: number;
  } | null>(null);
  const [agentVersions, setAgentVersions] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const collapsed = useRailCollapsed();
  const activeSection = STOP_TO_SECTION[stop];

  useEffect(() => {
    if (mode !== "live") {
      setLiveEnv(null);
      setAgentVersions({});
      return;
    }
    let cancelled = false;
    service
      .getEnvironmentContext()
      .then((ctx) => {
        if (!cancelled) setLiveEnv(ctx);
      })
      .catch(() => undefined);
    // Versions come from the same live registry the Agents panel reads, so the
    // rail can never show a version that is not deployed.
    service
      .listAgents()
      .then((agents) => {
        if (cancelled) return;
        setAgentVersions(Object.fromEntries(agents.map((a) => [a.name, a.version])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  const targetAgentVersion = agentVersions[targetAgent] ?? "";
  const region = liveEnv?.region ?? env.region;
  const resourceGroup = liveEnv?.resourceGroupName ?? env.resourceGroupName;
  const resourceCount = liveEnv?.resourceCount ?? 21;

  /*
   * Home confirms before discarding an active conversation. `Esc` still works
   * and, as before, silently does nothing in that state - this button is the
   * discoverable exit, and it came across from the header unchanged.
   */
  function handleHome() {
    if (hasActiveConversation) setConfirmOpen(true);
    else goToLanding();
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
      {/* Brand. The icon is the constant; the words are what folds away. */}
      {/*
        items-start, not items-center: the tagline wraps to several lines in a
        250px column and a centred mark ends up floating in the middle of the
        text block instead of sitting at the top of the lockup. The tagline
        stays despite the height - it is the positioning sentence (2), the one
        that says custom frameworks first and governance second, and the rail
        has empty space between the nav and the footer to spend on it.
      */}
      <div
        className={cn(
          "flex gap-2.5 pb-5",
          collapsed ? "justify-center" : "items-start px-1",
        )}
      >
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-accent text-white"
          aria-hidden="true"
        >
          <CubeRegular fontSize={20} />
        </span>
        {/*
          Wrapping, not truncating. 250px minus the 38px mark leaves ~185px,
          and both of these strings are longer than that in both locales - with
          `truncate` the console introduced itself as "Microsoft Foundry H..."
          above a tagline reading "Frameworks personali...". A brand lockup that
          cannot say the product's name is worse than a taller one, and this
          block is rendered once at the top of a column with room to spare.
        */}
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-body font-semibold leading-tight">
              Microsoft {t("header.productName")}
            </span>
            <span className="mt-0.5 block text-caption leading-tight text-rail-ink-muted">
              {t("header.tagline")}
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                isActive
                  ? "bg-accent text-white"
                  : "text-rail-ink-muted hover:bg-rail-hover hover:text-rail-ink",
              )}
            >
              <Icon fontSize={18} />
              {!collapsed && <span className="truncate">{label}</span>}
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
                <Tooltip content={label} relationship="label" positioning="after">
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 border-t border-rail-border pt-3">
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
            <BotFilled fontSize={14} className="shrink-0 text-accent" aria-hidden="true" />
            {!collapsed && (
              <>
                <span className="truncate text-caption font-medium">{targetAgent}</span>
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
          The live / simulation indicator, now permanent. accent for Live per
          §4.5 and illustrative-fg for Simulation; affirm is the 401 and
          nothing else. This is the indicator only — the toggle is in the
          drawer and on `L`, per §1.2.
        */}
        <Tooltip
          content={`${mode === "live" ? t("header.statusLive") : t("header.statusSimulation")} · ${region} · ${resourceGroup} · ${resourceCount}`}
          relationship="label"
          positioning="after"
        >
          <div className={cn("flex flex-col gap-0.5 px-1", collapsed && "items-center px-0")}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-colors duration-300 motion-reduce:transition-none",
                  mode === "live" ? "bg-accent" : "bg-illustrative-fg",
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="truncate text-caption font-medium">
                  {mode === "live" ? t("header.statusLive") : t("header.statusSimulation")}
                </span>
              )}
            </span>
            {/*
              Also wrapping. The resource group name is the fact this line
              exists to carry - it is what identifies WHICH deployment the room
              is looking at - and truncating it to "lab-hoste..." made the line
              decorative. Two short lines beat one useless one.
            */}
            {!collapsed && (
              <span className="text-caption leading-snug text-rail-ink-muted">
                {region} · <span className="break-all font-mono">{resourceGroup}</span> ·{" "}
                {resourceCount}
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
      </div>

      <Dialog open={confirmOpen} onOpenChange={(_, data) => setConfirmOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("header.confirmReturnTitle")}</DialogTitle>
            <DialogContent>{t("header.confirmReturnBody")}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setConfirmOpen(false);
                  goToLanding();
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
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          pressed
            ? "bg-accent text-white"
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
