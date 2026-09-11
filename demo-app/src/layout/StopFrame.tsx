import type { ReactNode } from "react";
import { InfoRegular } from "@fluentui/react-icons";
import { Surface } from "@/components/Surface";
import { PanelBody } from "@/components/PanelBody";
import { useTranslation } from "@/i18n/useTranslation";
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
  tone,
}: {
  title: ReactNode;
  question: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  provenance?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /**
   * "reference" re-skins the frame for the one screen that is not a reading
   * of this deployment - see Surface. Everything else leaves it alone.
   */
  tone?: "default" | "reference";
}) {
  const t = useTranslation();

  return (
    <Surface tone={tone} className="flex min-h-0 flex-1 animate-fade-slide-in flex-col gap-3 p-5">
      <header className={cn("flex shrink-0 items-center justify-between gap-6", MEASURE)}>
        <div className="min-w-0">
          {/*
            The breadcrumb. This is a RESHAPE of the uppercase line that was
            already here, not a new band - same slot, same height, one more
            segment of information (FIGMA_ADOPTION.md 0.1). That is why the
            breadcrumb costs nothing in a budget where 56px of topbar had to
            be argued for.

            Two segments, like the reference. A third for the sub-tab is
            deliberately not built: StopFrame is handed a `title` and does
            not know which tab rendered it, and threading that through to
            gain "/ CREDENCIALES" would buy a word at the cost of a prop on
            every screen.
          */}
          <nav aria-label={t("breadcrumb.label")}>
            <ol className="flex min-w-0 items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              <li className="truncate">{t("breadcrumb.root")}</li>
              <li aria-hidden="true" className="shrink-0 text-border">
                /
              </li>
              {/* The current segment carries the brand, as the reference does. */}
              <li className="truncate text-brand-ink" aria-current="page">
                {title}
              </li>
            </ol>
          </nav>
          {/*
            The question, given the weight a page title would normally get.
            Read from the back of the room without anyone having to say it.
          */}
          <h2 className="mt-0.5 text-body-lg font-semibold leading-snug text-ink">{question}</h2>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>

      {/*
        The context line. The reference puts a banner here; this is that
        banner reduced to ONE line, which is the single most important
        decision in the whole adoption: measured, a banner as a paragraph
        costs 52px and takes four of the nine screens below zero, where one
        line costs about 30 and none of them break (FIGMA_ADOPTION.md 1.2).

        It carries the screen's own explanatory sentence - the text that used
        to sit in the footer. That is a move, not a copy: the sentence
        qualifies the question, so it reads better under it than under the
        content it was explaining. The provenance badge did NOT come with it;
        it stays bottom-right where 1.6 fixed it deliberately.
      */}
      {footer && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border border-border bg-canvas px-3 py-1.5",
            MEASURE,
          )}
        >
          <InfoRegular fontSize={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="min-w-0 truncate text-caption leading-snug text-ink-muted">{footer}</p>
        </div>
      )}

      <PanelBody className={cn("pr-1", bodyClassName)}>
        <div className={MEASURE}>{children}</div>
      </PanelBody>

      {/*
        Provenance, and only provenance. The caption that shared this row
        moved up into the context line; the badge stays exactly where it has
        always been, because "where a figure came from" belongs at the end of
        the reading and a badge that moves between screens is a badge the
        room has to hunt for (1.6).
      */}
      {provenance && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-end border-t border-border pt-2.5",
            MEASURE,
          )}
        >
          <div className="shrink-0">{provenance}</div>
        </div>
      )}
    </Surface>
  );
}
