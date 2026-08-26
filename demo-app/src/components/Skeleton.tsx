import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * A pending value, while Azure is being read.
 *
 * One primitive so every loading state in the app breathes at the same rate
 * and sits at the same weight. A spinner reads as failure on a projector
 * (DESIGN_DECISIONS.md), so nothing here spins — the shape of the content
 * that is coming is drawn, quietly, and then filled.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn("block h-3 animate-pulse-soft rounded bg-illustrative-bg", className)}
    />
  );
}
