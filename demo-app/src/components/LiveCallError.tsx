import { useState } from "react";
import { ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/cn";

/**
 * What a failed live call looks like on a projected screen.
 *
 * Nine components used to render `{t("assistant.liveError")} ({error})`,
 * which put the raw broker string in front of the room:
 *
 *   Falló la llamada en vivo — verifique que el broker esté en ejecución
 *   (Broker request failed (502) for /api/agents/pydantic-agent:
 *   {"error":"Foundry agents list failed: 404"})
 *
 * DESIGN_DECISIONS.md §4.5 is explicit that no failure state is meant to be
 * communicated visually - a real outage is supposed to fall back to
 * Simulation, not render an error. An HTTP status code and a JSON fragment on
 * screen read as broken software rather than as a slow dependency, at the one
 * moment in a session where the presenter most needs to look unbothered.
 *
 * THE DETAIL IS NOT REMOVED - that would be the prettification this console
 * does not do. The presenter needs the 502 to decide between retrying and
 * switching to Simulation, so it is one click away and rendered verbatim. What
 * changes is only what the room reads first: one calm sentence instead of a
 * stack of transport vocabulary.
 *
 * No red, no warning triangle, per §4.5 - this is a surface waiting on a
 * dependency, not an alarm.
 */
export function LiveCallError({ detail, className }: { detail?: string | null; className?: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const trimmed = detail?.trim();

  return (
    <div className={cn("text-body leading-relaxed text-ink-muted", className)}>
      <p>{t("error.liveCall")}</p>
      {trimmed && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded text-caption text-ink-muted",
              "hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            )}
          >
            {open ? <ChevronDownRegular fontSize={14} /> : <ChevronRightRegular fontSize={14} />}
            {t("error.details")}
          </button>
          {open && (
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-illustrative-bg/60 px-3 py-2 text-caption leading-relaxed text-ink-muted">
              {trimmed}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
