import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Button,
  RadioGroup,
  Radio,
  Divider,
} from "@fluentui/react-components";
import {
  DismissRegular,
  TranslateRegular,
  WeatherSunnyRegular,
  PulseRegular,
  SlideTransitionRegular,
  KeyboardRegular,
  ArrowResetRegular,
  CheckmarkRegular,
  DocumentBulletListRegular,
  FlashRegular,
  GlobeRegular,
  WrenchRegular,
  PlugConnectedRegular,
  ArrowClockwiseRegular,
} from "@fluentui/react-icons";
import { MaintenanceActionButton } from "@/components/MaintenanceActionButton";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import type { DemoMode } from "@/config/env";
import type { Locale, ThemePreference } from "@/state/types";

/**
 * The single place every configurable preference lives — Language, Theme,
 * Demo Mode, Reduced Motion. None of these are ever exposed as a
 * dashboard-visible switch; the gear icon in the header (layout/Header.tsx)
 * and the "Open Settings" link on the landing page (landing/LandingPage.tsx)
 * are the only entry points.
 *
 * Deliberately flat: four independent controls, no search, no nesting, no
 * "advanced" section.
 */
export function SettingsDrawer() {
  const t = useTranslation();
  const open = useDemoStore((s) => s.settingsOpen);
  const resetDemoState = useDemoStore((s) => s.resetDemoState);
  const targetAgent = useDemoStore((s) => s.targetAgent);
  const [justReset, setJustReset] = useState(false);
  const closeSettings = useDemoStore((s) => s.closeSettings);
  const language = useDemoStore((s) => s.language);
  const setLanguage = useDemoStore((s) => s.setLanguage);
  const themePreference = useDemoStore((s) => s.themePreference);
  const setThemePreference = useDemoStore((s) => s.setThemePreference);
  const mode = useDemoStore((s) => s.mode);
  const setMode = useDemoStore((s) => s.setMode);
  const reducedMotion = useDemoStore((s) => s.reducedMotion);
  const setReducedMotion = useDemoStore((s) => s.setReducedMotion);

  return (
    <OverlayDrawer
      position="end"
      size="small"
      open={open}
      onOpenChange={(_, data) => (data.open ? undefined : closeSettings())}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              aria-label={t("settings.close")}
              onClick={closeSettings}
            />
          }
        >
          {t("settings.title")}
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody className="flex flex-col gap-5">
        {/*
          The four maintenance actions, moved off the Platform screen.

          4.4 puts presenter instruments in the presenter menu, "nearly
          invisible" — these were on the stage, which contradicted that, and
          they were also the 69px that kept Platform's controls catalogue from
          fitting. Both reasons point the same way.

          First section in the drawer, above language and theme. It landed
          fifth on the first attempt, which contradicted this very comment -
          a presenter reaching for "check the broker" mid-session should meet
          it on opening, while language, theme and motion are set once and
          then never touched again.
        */}
        <SettingSection icon={WrenchRegular} label={t("settings.maintenance")}>
          <div className="flex flex-wrap gap-2">
            <MaintenanceActionButton action="ping" icon={<PulseRegular />} label={t("maintenance.action.ping")} />
            <MaintenanceActionButton
              action="refresh-azure-status"
              icon={<GlobeRegular />}
              label={t("maintenance.action.refresh-azure-status")}
            />
            <MaintenanceActionButton
              action="reload-audit-logs"
              icon={<DocumentBulletListRegular />}
              label={t("maintenance.action.reload-audit-logs")}
            />
            <MaintenanceActionButton
              action="test-apim"
              icon={<PlugConnectedRegular />}
              label={t("maintenance.action.test-apim")}
            />
            <MaintenanceActionButton
              action="reload-policies"
              icon={<ArrowClockwiseRegular />}
              label={t("maintenance.action.reload-policies")}
            />
            <MaintenanceActionButton
              action="refresh-deployment-info"
              icon={<FlashRegular />}
              label={t("maintenance.action.refresh-deployment-info")}
            />
            {/*
              These two are agent-scoped and came off the Agent Summary panel
              for the same reason as the rest. They follow the console's current
              target agent rather than a panel selection, which is the same
              value the header badge and the keyboard shortcuts already act on -
              so "warm the agent" here warms the agent the room is looking at.
            */}
            <MaintenanceActionButton
              action="warm-agent"
              agentName={targetAgent}
              icon={<FlashRegular />}
              label={t("maintenance.action.warm-agent")}
            />
            <MaintenanceActionButton
              action="test-hosted-agent"
              agentName={targetAgent}
              icon={<PlugConnectedRegular />}
              label={t("maintenance.action.test-hosted-agent")}
            />
          </div>
        </SettingSection>

        <Divider />

        <SettingSection icon={TranslateRegular} label={t("settings.language")}>
          <RadioGroup
            value={language}
            onChange={(_, data) => setLanguage(data.value as Locale)}
          >
            <Radio value="en" label={t("settings.languageEnglish")} />
            <Radio value="es" label={t("settings.languageSpanish")} />
          </RadioGroup>
        </SettingSection>

        <Divider />

        <SettingSection icon={WeatherSunnyRegular} label={t("settings.theme")}>
          <RadioGroup
            value={themePreference}
            onChange={(_, data) => setThemePreference(data.value as ThemePreference)}
          >
            <Radio value="light" label={t("settings.themeLight")} />
            <Radio value="dark" label={t("settings.themeDark")} />
            <Radio value="system" label={t("settings.themeSystem")} />
          </RadioGroup>
        </SettingSection>

        <Divider />

        <SettingSection icon={PulseRegular} label={t("settings.demoMode")}>
          <RadioGroup
            value={mode}
            onChange={(_, data) => setMode(data.value as DemoMode)}
          >
            <Radio value="live" label={t("settings.demoModeLive")} />
            <Radio value="replay" label={t("settings.demoModeSimulation")} />
          </RadioGroup>
        </SettingSection>

        <Divider />

        <SettingSection icon={SlideTransitionRegular} label={t("settings.reducedMotion")}>
          <RadioGroup
            value={reducedMotion ? "on" : "off"}
            onChange={(_, data) => setReducedMotion(data.value === "on")}
          >
            <Radio value="on" label={t("settings.reducedMotionOn")} />
            <Radio value="off" label={t("settings.reducedMotionOff")} />
          </RadioGroup>
        </SettingSection>

        <Divider />

        {/*
          The shortcuts were real and undiscoverable - bound in
          useKeyboardShortcuts.ts, written down only in the presentation guide,
          which is read before a session rather than during one. A presenter
          who blanks on the credential-test key had nowhere on screen to look.

          This drawer is the right home: it is already the presenter's private
          surface, already out of the audience's attention, and putting a
          shortcut legend on the stage itself would tell the room it is
          watching a demo. See UX_AUDIT.md F3.
        */}
        {/*
          An explicit button, deliberately not an inactivity timer.

          The risks are asymmetric. A forgotten reset shows the previous
          session's agent selection - visible, real, correctable in one click.
          A timer that fires while the presenter is fielding ten minutes of
          architecture questions would wipe the screen the room is looking at,
          with nobody having touched anything, and the recovery is a fresh
          invocation and ten seconds of silence. Idle here is not idle; it is
          the demonstration working.

          It lives in this drawer rather than on the stage because a visible
          control labelled "reset the demo" tells the room it is watching a
          demo (DESIGN_DECISIONS.md 4.2).
        */}
        <SettingSection icon={ArrowResetRegular} label={t("settings.reset")}>
          <div className="flex flex-col items-start gap-1.5">
            <Button
              size="small"
              icon={justReset ? <CheckmarkRegular /> : <ArrowResetRegular />}
              onClick={() => {
                resetDemoState();
                setJustReset(true);
                window.setTimeout(() => setJustReset(false), 2000);
              }}
            >
              {justReset ? t("settings.resetDone") : t("settings.resetAction")}
            </Button>
            <p className="text-caption leading-snug text-ink-muted">{t("settings.resetNote")}</p>
          </div>
        </SettingSection>

        <Divider />

        <SettingSection icon={KeyboardRegular} label={t("settings.shortcuts")}>
          <dl className="flex flex-col gap-1.5">
            {[
              { keys: ["C"], label: t("settings.shortcutCopilot") },
              { keys: ["S"], label: t("settings.shortcutCredentials") },
              { keys: ["L"], label: t("settings.shortcutMode") },
              { keys: ["←", "→"], label: t("settings.shortcutMove") },
              { keys: ["Esc"], label: t("settings.shortcutBack") },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline gap-2">
                <dt className="flex shrink-0 gap-1">
                  {row.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded border border-border bg-illustrative-bg/60 px-1.5 py-0.5 text-caption font-medium text-ink"
                    >
                      {k}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-caption text-ink-muted">{row.label}</dd>
              </div>
            ))}
          </dl>
        </SettingSection>
      </DrawerBody>
    </OverlayDrawer>
  );
}

function SettingSection({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ fontSize?: number; className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.02em] text-ink-muted">
        <Icon fontSize={14} />
        {label}
      </h3>
      {children}
    </div>
  );
}
