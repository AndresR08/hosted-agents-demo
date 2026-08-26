import { cn } from "@/lib/cn";

/**
 * The one empty state in the application.
 *
 * Three stops can legitimately have nothing to show yet, and before this they
 * each said so differently — one as a caption under a heading, one as a
 * left-aligned paragraph, one as a muted line. Different treatments for the
 * same condition read as three unfinished panels rather than one product
 * waiting for a question.
 *
 * Centred and at body size on purpose: an empty stop is not an error and not a
 * footnote, it is the surface telling the room what to do next, and it should
 * be readable from the back.
 */
export function EmptyState({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        "mx-auto max-w-[54ch] py-10 text-center text-body leading-relaxed text-ink-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
