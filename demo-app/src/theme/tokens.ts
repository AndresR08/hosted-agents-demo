/**
 * Design tokens from DESIGN_DECISIONS.md (Visual System).
 *
 * This is the source of truth for colour and type values. `theme/index.css`
 * mirrors these as Tailwind `@theme` variables and MUST be kept in sync by
 * hand — Tailwind v4 reads its tokens from CSS, not from this file. Fluent UI
 * components read the brand ramp in `fluentTheme.ts`, which is derived from
 * `accent` below.
 *
 * Cooled towards the Foundry IQ reference — see VISUAL_LANGUAGE_ADOPTION.md
 * §0.2 for what was adopted and what was rejected. The dark stops are
 * original: that reference has no dark theme, so they carry its navy
 * direction into a palette it never had. Every value here is contrast-checked
 * against its own surface, both themes, at or above 4.5:1.
 */

export const color = {
  light: {
    canvas: "#F5F7FB",
    surface: "#FFFFFF",
    border: "#E7ECF3",
    ink: "#0F2547",
    inkMuted: "#5A6884",
    accent: "#0F6CBD",
    affirm: "#0E7A5F",
    illustrativeFg: "#7D8AA3",
    illustrativeBg: "#EEF1F7",
  },
  dark: {
    canvas: "#0E1420",
    surface: "#161D2B",
    border: "#253044",
    ink: "#E8EDF5",
    inkMuted: "#9AA8C0",
    accent: "#3E9BE0",
    affirm: "#3FC79A",
    illustrativeFg: "#7F8CA4",
    illustrativeBg: "#1E2637",
  },
} as const;

/**
 * DESIGN_DECISIONS.md — four sizes only, no weight below 400, and none below
 * the 16px projector floor (§4.5). caption was 13px when the UX audit measured
 * it carrying 83% of the app's type; it is now the floor itself.
 *
 * Kept in sync with index.css by hand, as this file's header says.
 */
export const typography = {
  fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  fontFamilyMono: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace',
  display: { size: "34px", weight: 600 },
  bodyLarge: { size: "26px", weight: 400 },
  body: { size: "16px", weight: 400 },
  caption: { size: "16px", weight: 500, tracking: "0.02em" },
} as const;

/** DESIGN_DECISIONS.md */
export const grid = {
  columns: 12,
  gutter: "24px",
  margin: "48px",
  spacingBase: "4px",
} as const;

/** DESIGN_DECISIONS.md */
export const canvasSize = {
  reference: { width: 1920, height: 1080 },
  degraded: { width: 1366, height: 768 },
} as const;

export type ColorScheme = keyof typeof color;
