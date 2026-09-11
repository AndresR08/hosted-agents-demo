import { AppearanceProvider } from "@/theme/AppearanceProvider";
import { AppShell } from "@/layout/AppShell";
import { SettingsDrawer } from "@/layout/SettingsDrawer";

/**
 * The console, and nothing in front of it.
 *
 * There used to be a landing page here, chosen against the dashboard off
 * `store.view`. It is gone: the demo now loads straight into its first
 * section (FIGMA_ADOPTION.md §1.4). What that screen actually did beyond
 * welcoming — reset the demonstration, and unmount the console so the
 * copilot history and journey timings went with it — moved into
 * `resetDemoState`, which Home and `Esc` now call. Nothing was dropped;
 * it was made explicit.
 *
 * SettingsDrawer stays mounted here rather than inside AppShell: it is the
 * one surface that must survive the stage remounting on reset.
 */
export function App() {
  return (
    <AppearanceProvider>
      <AppShell />
      <SettingsDrawer />
    </AppearanceProvider>
  );
}
