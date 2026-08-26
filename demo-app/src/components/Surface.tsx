import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
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
export function Surface({ children, className, ...rest }: SurfaceProps) {
  return (
    <div
      className={cn(
        "min-h-0 overflow-hidden rounded-lg border border-border bg-surface shadow-none",
        "transition-[border-color] duration-200",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
