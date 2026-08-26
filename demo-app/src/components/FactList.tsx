import { Skeleton } from "./Skeleton";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/cn";

/**
 * One labeled value in a `FactList` — the dt/dd row used everywhere this
 * application shows "the public fields of one fetched record" (Agent
 * Summary, Versions, Run). A field with no `value` renders the same
 * "ha.unavailable" pattern everywhere, rather than each panel inventing its
 * own blank, dash, or omission for missing data.
 */
export interface Fact {
  label: string;
  value?: string;
  mono?: boolean;
  note?: string;
}

/**
 * Renders a list of `Fact`s as a `<dl>`.
 *
 * `loading`, when true, replaces every value with a `Skeleton` instead of
 * the "unavailable" fallback — for panels that keep row labels on screen
 * while their data is still in flight (Agent Summary). Panels that show one
 * loading indicator for the whole block instead (Versions, Run) simply omit
 * `loading` and never render a `FactList` until data has arrived.
 */
export function FactList({
  facts,
  loading,
  className,
}: {
  facts: Fact[];
  loading?: boolean;
  className?: string;
}) {
  const t = useTranslation();

  return (
    <dl className={cn("flex flex-col gap-0.5", className)}>
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline gap-2">
          <dt className="w-[160px] shrink-0 text-caption text-ink-muted">{fact.label}</dt>
          <dd className="min-w-0 flex-1 text-caption">
            {loading ? (
              <Skeleton className="w-1/2" />
            ) : fact.value ? (
              <span className={cn("break-all text-ink", fact.mono && "font-mono")}>{fact.value}</span>
            ) : (
              <span className="italic text-ink-muted">{t("ha.unavailable")}</span>
            )}
            {fact.note && !loading && fact.value && (
              <span className="ml-1.5 text-ink-muted">{fact.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
