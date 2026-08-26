/**
 * Design tokens from DESIGN_DECISIONS.md (Visual System).
 *
 * This is the source of truth for colour and type values. `theme/index.css`
 * mirrors these as Tailwind `@theme` variables and MUST be kept in sync by
 * hand — Tailwind v4 reads its tokens from CSS, not from this file. Fluent UI
 * components read the brand ramp in `fluentTheme.ts`, which is derived from
 * `accent` below.
 *
 * Dark-mode values are provisional. DESIGN_DECISIONS.md states a dark
 * variant is "required" but does not specify exact stops — these are a
 * reasonable first pass, not a signed-off palette.
 */

export const color = {
  light: {
    canvas: "#FAFAFA",
    surface: "#FFFFFF",
    border: "#E5E5E5",
    ink: "#1A1A1A",
    inkMuted: "#6B6B6B",
    accent: "#0F6CBD",
    affirm: "#0E7A5F",
    illustrativeFg: "#8A8A8A",
    illustrativeBg: "#F2F2F2",
  },
  dark: {
    canvas: "#121212",
    surface: "#1C1C1C",
    border: "#333333",
    ink: "#F2F2F2",
    inkMuted: "#A3A3A3",
    accent: "#3E9BE0",
    affirm: "#3FC79A",
    illustrativeFg: "#8A8A8A",
    illustrativeBg: "#262626",
  },
} as const;

/** DESIGN_DECISIONS.md — four sizes only, no weight below 400. */
export const typography = {
  fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  display: { size: "32px", weight: 600 },
  bodyLarge: { size: "24px", weight: 400 },
  body: { size: "16px", weight: 400 },
  caption: { size: "13px", weight: 500, tracking: "0.02em" },
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
