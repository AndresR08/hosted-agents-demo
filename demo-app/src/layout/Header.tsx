import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@fluentui/react-components";
import {
  BotFilled,
  ChatRegular,
  CubeRegular,
  HomeRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { env } from "@/config/env";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import { cn } from "@/lib/cn";

/**
 * DESIGN_DECISIONS.md "HEADER — Environment Strip". 72px, full width.
 * Establishes real Azure infrastructure in one passively-absorbed line —
 * see DESIGN_DECISIONS.md for why this replaces a full resource-status
 * screen.
 *
 * Live mode reads region/resource-group/resource-count from
 * `getEnvironmentContext()` (routes/environment.ts on the broker) — a real
 * ARM resource count, which differs from ARCHITECTURE.md §5's manual count
 * of 21 (that inventory includes sub-resources a simple resource list
 * doesn't enumerate). Simulation mode falls back to build-time config
 * (src/config/env.ts) with the documented 21 as a static placeholder.
 *
 * Per this milestone's brief, Demo Mode is never a dashboard-visible
 * switch — the coloured dot + label here is informational only (green =
 * Azure Live, blue = Simulation) and matches the accent/affirm tokens
 * already used elsewhere for the same meanings. The only way to change it
 * is the gear icon, which opens SettingsDrawer.
 *
 * The Home button is the obvious, discoverable path back to the landing
 * page — `Esc` still works too (useKeyboardShortcuts), but a presenter
 * mid-demo shouldn't have to remember a shortcut to find the exit. Unlike
 * `Esc`, this one confirms before discarding an active conversation rather
 * than silently doing nothing.
 */
export function Header({ className }: { className?: string }) {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const openSettings = useDemoStore((s) => s.openSettings);
  const copilotOpen = useDemoStore((s) => s.copilotOpen);
  const toggleCopilot = useDemoStore((s) => s.toggleCopilot);
  const hasActiveConversation = useDemoStore((s) => s.hasActiveConversation);
  const goToLanding = useDemoStore((s) => s.goToLanding);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [liveEnv, setLiveEnv] = useState<{ region: string; resourceGroupName: string; resourceCount: number } | null>(
    null,
  );
  const [agentVersions, setAgentVersions] = useState<Record<string, string>>({});

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
    // Versions for the badge come from the same live registry the Agents panel
    // reads, so the header can never show a version that isn't deployed.
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

  function handleHomeClick() {
    if (hasActiveConversation) {
      setConfirmOpen(true);
    } else {
      goToLanding();
    }
  }

  return (
    <header
      className={cn(
        "flex h-[72px] w-full flex-none items-center justify-between border-b border-border",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white shadow-sm"
          aria-hidden="true"
        >
          <CubeRegular fontSize={20} />
        </div>
        {/*
          Foundry first, gateway second (ARCHITECTURE.md). The application was called "Enterprise AI Gateway", which set
          the positioning before the first click and named the one component
          this lab marks optional. What the lab is about is custom frameworks
          running as Foundry Hosted Agents; API Management is how they are
          governed, which is what the tagline now says in that order.
        */}
        <div>
          <p className="text-body font-semibold leading-tight text-ink">
            Microsoft {t("header.productName")}
          </p>
          <p className="text-caption leading-tight text-ink-muted">{t("header.tagline")}</p>
        </div>
      </div>

      {/*
        Two clusters, not four. The environment line, the mode indicator and
        the agent badge were three separate objects saying three kinds of
        "where you are"; the first two are one sentence and now read as one.
      */}
      <div className="flex min-w-0 items-center gap-3">
        <p className="flex min-w-0 items-center gap-2 truncate text-caption text-ink-muted">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full transition-colors duration-300",
              mode === "live" ? "bg-affirm" : "bg-accent",
            )}
            aria-hidden="true"
          />
          <span className="font-medium text-ink">
            {mode === "live" ? t("header.statusLive") : t("header.statusSimulation")}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span className="truncate">
            {liveEnv?.region ?? env.region} &middot; {liveEnv?.resourceCount ?? 21} resources
          </span>
        </p>

        {/*
          Current agent badge. The room should always be able to see which
          agent is answering, and switching with 1/2 is otherwise invisible
          until the next answer lands. Version comes from the live registry, so
          it is never a hard-coded string.
        */}
        <Tooltip content={t("header.targetAgentLabel")} relationship="label">
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1">
            <BotFilled fontSize={14} className="text-accent" aria-hidden="true" />
            <span className="text-caption font-medium text-ink">{targetAgent}</span>
            {targetAgentVersion && (
              <span className="text-caption text-ink-muted">{targetAgentVersion}</span>
            )}
          </span>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        {/*
          The copilot lives here rather than in a floating button over the
          stage: it is chrome, it belongs with the other chrome, and it stops
          competing with the walkthrough for attention.
        */}
        <Tooltip content={copilotOpen ? t("copilot.close") : t("copilot.open")} relationship="label">
          <Button
            appearance={copilotOpen ? "primary" : "subtle"}
            icon={<ChatRegular />}
            aria-label={copilotOpen ? t("copilot.close") : t("copilot.open")}
            aria-pressed={copilotOpen}
            onClick={toggleCopilot}
          />
        </Tooltip>
        <Tooltip content={t("header.homeLabel")} relationship="label">
          <Button
            appearance="subtle"
            icon={<HomeRegular />}
            aria-label={t("header.homeLabel")}
            onClick={handleHomeClick}
          />
        </Tooltip>
        <Button
          appearance="subtle"
          icon={<SettingsRegular />}
          aria-label={t("header.settingsLabel")}
          onClick={openSettings}
        />
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
    </header>
  );
}
