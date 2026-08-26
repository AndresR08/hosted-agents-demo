import { AppearanceProvider } from "@/theme/AppearanceProvider";
import { AppShell } from "@/layout/AppShell";
import { SettingsDrawer } from "@/layout/SettingsDrawer";
import { LandingPage } from "@/landing/LandingPage";
import { useDemoStore } from "@/state/store";

/**
 * The one place that knows both the landing page and the dashboard exist.
 * `store.view` is the single source of truth for which one is on screen —
 * see state/store.ts `startDemonstration` / `goToLanding`. SettingsDrawer
 * is mounted here, once, so it's reachable from either screen.
 */
export function App() {
  const view = useDemoStore((s) => s.view);

  return (
    <AppearanceProvider>
      {view === "landing" ? <LandingPage /> : <AppShell />}
      <SettingsDrawer />
    </AppearanceProvider>
  );
}
