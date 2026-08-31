import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * "reference" marks a card that is NOT a reading of the deployment: a
   * dashed, lighter border and a raised ground, unmistakable at a glance and
   * from across a room. Exactly one screen uses it (the APIM reference
   * screen); every screen showing real data uses "default" and they all look
   * identical, which is what makes the exception legible as one.
   *
   * A tone rather than a className override, because `cn` is a plain join
   * with no conflict resolution - passing "bg-illustrative-bg" alongside the
   * built-in "bg-surface" would leave which one wins to stylesheet order.
   */
  tone?: "default" | "reference";
}

/**
 * The one card primitive in the app. DESIGN_DECISIONS.md: two elevation
 * levels only (canvas and surface), 8px radius, defined by a 1px hairline
 * border rather than shadow — shadow-heavy cards read as web template.
 *
 * There is no `elevated` variant any more. It existed for the old dashboard's
 * "interrogated" state, where one panel among five rose above the others;
 * with one stop on stage there is nothing to rise above, and detail views are
 * portaled dialogs with their own elevation.
 *
 * `min-h-0` + `overflow-hidden` are load-bearing, not cosmetic: as a flex
 * child, a panel would otherwise refuse to shrink below its content's
 * intrinsic height and spill outside the frame. Together with PanelBody's own
 * `min-h-0` they are what guarantee "panels never clip, the page never
 * scrolls".
 */
export function Surface({ children, className, tone = "default", ...rest }: SurfaceProps) {
  return (
    <div
      className={cn(
        "min-h-0 overflow-hidden rounded-lg shadow-none",
        tone === "reference"
          ? "border-2 border-dashed border-ink-muted/40 bg-illustrative-bg"
          : "border border-border bg-surface",
        "transition-[border-color] duration-200",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
