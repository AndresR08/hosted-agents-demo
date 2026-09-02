import { DocumentBulletListRegular, TopSpeedRegular } from "@fluentui/react-icons";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import type { StopId } from "@/state/types";
import { cn } from "@/lib/cn";

const TABS: { stop: StopId; labelKey: string; icon: typeof TopSpeedRegular }[] = [
  { stop: "observability", labelKey: "obsNav.record", icon: DocumentBulletListRegular },
  { stop: "observabilityMeasurements", labelKey: "obsNav.measurements", icon: TopSpeedRegular },
];

/**
 * Observability's two screens: the durable record, and the measurements.
 *
 * The split was forced by measurement — 936px of content in a 508px budget
 * once real data had loaded — but the boundary was not invented for it. "What
 * evidence does the platform generate?" has two answers that come from
 * different queries and are read by different people: a compliance function
 * wants the record of what was asked and answered, an architect wants what it
 * cost. Neither is a detail of the other, which is why this reads as two views
 * of one question rather than one view cut in half.
 *
 * Deliberately duplicated markup rather than a shared abstraction with
 * `GatewaySubNav`. Two instances is not a pattern: the two carry different tab
 * sets for different reasons, and the reasoning in each file is most of its
 * value. If a third section ever needs tabs, extract then — with all three in
 * front of you.
 */
export function ObservabilitySubNav({ className }: { className?: string }) {
  const t = useTranslation();
  const stop = useDemoStore((s) => s.stop);
  const goToStop = useDemoStore((s) => s.goToStop);

  return (
    <div
      role="tablist"
      aria-label={t("obsNav.label")}
      className={cn("flex shrink-0 items-center gap-1", className)}
    >
      {TABS.map((tab) => {
        const isActive = stop === tab.stop;
        const Icon = tab.icon;
        return (
          <button
            key={tab.stop}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) goToStop(tab.stop);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-caption font-medium",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              isActive
                ? "bg-accent/[0.08] text-ink"
                : "text-ink-muted hover:bg-illustrative-bg/70 hover:text-ink",
            )}
          >
            <Icon fontSize={14} />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
