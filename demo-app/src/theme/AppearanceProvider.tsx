import { useEffect, useState, type ReactNode } from "react";
import { FluentProvider } from "@fluentui/react-components";
import { gatewayDarkTheme, gatewayLightTheme } from "./fluentTheme";
import type { ColorScheme } from "./tokens";
import { useDemoStore } from "@/state/store";

/**
 * Applies the two appearance settings from Settings → Theme / Reduced
 * Motion to the document: the `.dark` and `.reduce-motion` classes on
 * `<html>` (so Tailwind's `dark:` variant and the reduced-motion CSS
 * override in theme/index.css both work), and the Fluent `FluentProvider`
 * theme.
 *
 * Theme is `dark` by default (state/store.ts) and only follows the OS
 * preference when the presenter explicitly picks "System".
 * Neither setting is exposed on the dashboard — only inside the Settings
 * drawer (layout/SettingsDrawer.tsx); this component just reacts to the
 * store either way.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const themePreference = useDemoStore((s) => s.themePreference);
  const reducedMotion = useDemoStore((s) => s.reducedMotion);

  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemScheme(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const scheme: ColorScheme = themePreference === "system" ? systemScheme : themePreference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  return (
    <FluentProvider
      theme={scheme === "dark" ? gatewayDarkTheme : gatewayLightTheme}
      style={{ height: "100%", backgroundColor: "transparent" }}
    >
      {children}
    </FluentProvider>
  );
}
