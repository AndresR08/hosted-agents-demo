import { BookInformationRegular, FlashRegular } from "@fluentui/react-icons";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import type { StopId } from "@/state/types";
import { cn } from "@/lib/cn";

const TABS: { stop: StopId; labelKey: string; icon: typeof FlashRegular }[] = [
  { stop: "gateway", labelKey: "gatewayNav.live", icon: FlashRegular },
  { stop: "apimCapabilities", labelKey: "gatewayNav.reference", icon: BookInformationRegular },
];

/**
 * The Gateway section's two screens: the live request journey, and the
 * reference material about API Management as a product.
 *
 * This exists to make the boundary a navigational fact rather than a caption.
 * The reference screen could have been a panel appended to the bottom of the
 * live one — that is precisely what must not happen, because a presenter
 * scrolling past a divider will read curated capability text in the same
 * breath as measured latencies, and the room has no way to tell which was
 * which. Two tabs cannot be scrolled into one another.
 *
 * The labels carry that meaning too: "Live" and "Reference", not "Overview"
 * and "More". Modelled on the tab set inside `AgentsView`, and like it, this
 * changes navigation only — neither screen's content or ids change.
 */
export function GatewaySubNav({ className }: { className?: string }) {
  const t = useTranslation();
  const stop = useDemoStore((s) => s.stop);
  const goToStop = useDemoStore((s) => s.goToStop);

  return (
    <div
      role="tablist"
      aria-label={t("gatewayNav.label")}
      className={cn("mx-auto flex w-full max-w-[1200px] shrink-0 items-center gap-1 pb-2", className)}
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
