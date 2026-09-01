import { useEffect } from "react";
import { Button } from "@fluentui/react-components";
import { CubeRegular } from "@fluentui/react-icons";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { env } from "@/config/env";
import { cn } from "@/lib/cn";

/**
 * The executive demonstration's opening experience. Not a login, not a
 * splash screen — a deliberate professional beginning that keeps the
 * dashboard hidden until the presenter is ready to introduce it.
 *
 * The "Suggested Executive Scenario" picker that used to sit below the start
 * button was removed: the selection was never read anywhere, and offering four
 * vertical presets framed the session as a set of canned demos before it had
 * begun. The assistant now answers real questions, so nothing needs presetting.
 *
 * Independent by design: this file imports shared primitives (Surface,
 * i18n, the store) but nothing here reaches into dashboard internals, and
 * nothing in the dashboard imports from here. App.tsx is the only place
 * that knows both exist — it renders one or the other off `store.view`.
 * Removing this file removes exactly one screen, not a dependency chain.
 */
export function LandingPage() {
  const t = useTranslation();
  const transitioning = useDemoStore((s) => s.transitioning);
  const startDemonstration = useDemoStore((s) => s.startDemonstration);
  const openSettings = useDemoStore((s) => s.openSettings);
  const settingsOpen = useDemoStore((s) => s.settingsOpen);
  const mode = useDemoStore((s) => s.mode);

  // `Enter` starts the demonstration — unless focus is already on a button
  // (Open Settings) or Settings is open on top of this page, either of which
  // should handle its own Enter instead.
  useEffect(() => {
    if (settingsOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || transitioning) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "BUTTON") return;
      startDemonstration();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, transitioning, startDemonstration]);

  return (
    <div
      className={cn(
        "relative flex h-screen w-screen animate-fade-in-up flex-col items-center overflow-y-auto bg-canvas px-6 py-10",
        transitioning && "animate-fade-out",
      )}
    >
      <div className="m-auto flex max-w-xl flex-col items-center gap-7 text-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-white"
            aria-hidden="true"
          >
            <CubeRegular fontSize={28} />
          </div>
          <h1 className="text-display font-semibold tracking-[-0.01em] text-ink">
            Microsoft {t("header.productName")}
          </h1>
          {/*
            The sentence the room has to leave with, given the first and
            largest slot on the first screen they see
            (ARCHITECTURE.md).
          */}
          <p className="text-body-lg font-medium leading-snug text-accent">
            {t("landing.headline")}
          </p>
          <p className="max-w-lg text-body leading-relaxed text-ink-muted">
            {t("landing.description")}
          </p>
        </div>

        {/*
          Deployment context as one quiet line rather than three cards. It is
          reassurance — a real subscription, a real EU region — absorbed in
          passing, and it should not compete with the primary action.
        */}
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption text-ink-muted">
          <span>{env.region === "swedencentral" ? "Sweden Central" : env.region}</span>
          <Separator />
          <span>{env.resourceGroupName}</span>
          <Separator />
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", mode === "live" ? "bg-accent" : "bg-illustrative-fg")}
              aria-hidden="true"
            />
            {mode === "live" ? t("header.statusLive") : t("header.statusSimulation")}
          </span>
        </p>

        <div className="flex flex-col items-center gap-2">
          <Button appearance="primary" size="large" onClick={startDemonstration}>
            {t("landing.startButton")}
          </Button>
          <Button appearance="transparent" size="small" onClick={openSettings}>
            {t("landing.openSettings")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Separator() {
  return (
    <span className="text-ink-muted/50" aria-hidden="true">
      ·
    </span>
  );
}
