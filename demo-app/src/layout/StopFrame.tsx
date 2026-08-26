import type { ReactNode } from "react";
import { Surface } from "@/components/Surface";
import { PanelBody } from "@/components/PanelBody";
import { cn } from "@/lib/cn";

/**
 * The reading measure every stop shares.
 *
 * A stop owns the whole stage, and at 1920 that is roughly 1550px of usable
 * width inside the card — about 200 characters on a line of body text, which is
 * unreadable and, worse, looks like a stretched web page rather than a product.
 * Capping the content and centring it gives a comfortable measure at 1920 and
 * is a no-op at 1366, where the stage is already narrower than the cap.
 *
 * Applied to the heading, the body and the footer alike so all three share one
 * left edge — the single change that makes the four screens read as one
 * composition rather than four layouts.
 */
const MEASURE = "mx-auto w-full max-w-[1200px]";

/**
 * The frame every screen is rendered in.
 *
 * It exists to make one rule structural rather than aspirational: a screen
 * states the single question it answers, in the largest type on the screen,
 * because `title`/`question` are required props with no fallback to fall
 * back to — a surface that needs a second question is a second screen, and
 * there is no way to express it here.
 *
 * The heading answers "where am I and why am I looking at this"; `action` is
 * for the one control the screen offers, if it offers any; `provenance` sits
 * at the bottom right of every screen, because where a figure came from
 * qualifies what was shown rather than announcing it — and because a badge
 * that moves between screens is a badge the user has to hunt for.
 *
 * No position marker (①..⑤) any more. Numbering four independent console
 * sections implied a five-step story to walk through in order, which
 * `SectionNav` no longer tells — a user reaches Gateway directly as often as
 * they reach it from Agents.
 */
export function StopFrame({
  title,
  question,
  action,
  footer,
  provenance,
  children,
  bodyClassName,
}: {
  title: ReactNode;
  question: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  provenance?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Surface className="flex min-h-0 flex-1 animate-fade-slide-in flex-col gap-4 p-6">
      <header className={cn("flex shrink-0 items-center justify-between gap-6", MEASURE)}>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {title}
          </p>
          {/*
            The question, given the weight a page title would normally get.
            Read from the back of the room without anyone having to say it.
          */}
          <h2 className="mt-0.5 text-body-lg font-semibold leading-snug text-ink">{question}</h2>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>

      <PanelBody className={cn("pr-1", bodyClassName)}>
        <div className={MEASURE}>{children}</div>
      </PanelBody>

      {(footer || provenance) && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-6 border-t border-border pt-2.5",
            MEASURE,
          )}
        >
          <p className="min-w-0 text-caption leading-snug text-ink-muted">{footer}</p>
          {provenance && <div className="shrink-0">{provenance}</div>}
        </div>
      )}
    </Surface>
  );
}
