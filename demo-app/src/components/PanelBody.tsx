import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * The scrollable region inside a panel. Every panel whose content can exceed
 * its slot must put that content in one of these.
 *
 * `min-h-0` is the load-bearing part and the reason this exists as a component
 * rather than a class string people remember to copy. A flex child defaults to
 * `min-height: auto`, which means it refuses to shrink below its content's
 * intrinsic height — so `overflow-y-auto` alone does nothing and the content
 * pushes the panel past the bottom of the dashboard instead of scrolling. The
 * pair is what actually delivers "no panel ever loses information, and the page
 * never scrolls" (DESIGN_DECISIONS.md).
 *
 * `overscroll-contain` stops a scroll gesture that reaches the end of this
 * region from chaining to the page behind it — on a trackpad mid-demo that
 * would otherwise nudge the whole dashboard.
 */
export function PanelBody({ children, className, ...rest }: PanelBodyProps) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-subtle",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
