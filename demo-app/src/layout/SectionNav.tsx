import type { ComponentType } from "react";
import { BotRegular, PulseRegular, ServerRegular, ShieldKeyholeRegular } from "@fluentui/react-icons";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { SECTION_ORDER, SECTION_STOPS, STOP_TO_SECTION, type SectionId } from "@/state/types";
import { cn } from "@/lib/cn";

const ICONS: Record<SectionId, ComponentType<{ fontSize?: number }>> = {
  agents: BotRegular,
  gateway: ShieldKeyholeRegular,
  observability: PulseRegular,
  platform: ServerRegular,
};

/**
 * The console shell's top-level navigation — ARCHITECTURE.md
 *
 * Four sections, object-oriented rather than sequential: Agents, Gateway,
 * Observability, Platform. This replaces the walkthrough rail
 * (`JourneyRail`) as the primary navigation, but does not delete it or
 * change what any stop does — each section is a thin layer over the
 * existing `stop` state (`STOP_TO_SECTION`, `SECTION_STOPS`), so the same
 * five stops render exactly as they did before.
 *
 * Clicking a section that is not already active jumps to that section's
 * first stop. Clicking the section that is already active is a no-op — it
 * does not reset which of its stops (e.g. Frameworks vs. Hosted Agents
 * under Agents) is currently showing, so `AgentsSubNav` state survives a
 * re-click.
 */
export function SectionNav({ className }: { className?: string }) {
  const t = useTranslation();
  const stop = useDemoStore((s) => s.stop);
  const goToStop = useDemoStore((s) => s.goToStop);

  const activeSection = STOP_TO_SECTION[stop];

  return (
    <nav
      aria-label={t("rail.label")}
      className={cn("flex shrink-0 items-center gap-1 py-2", className)}
    >
      {SECTION_ORDER.map((section) => {
        const isActive = section === activeSection;
        const Icon = ICONS[section];

        return (
          <button
            key={section}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              if (isActive) return;
              goToStop(SECTION_STOPS[section][0]);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              isActive
                ? "bg-accent/[0.08] text-ink"
                : "text-ink-muted hover:bg-illustrative-bg/70 hover:text-ink",
            )}
          >
            <Icon fontSize={16} />
            {t(`nav.${section}`)}
          </button>
        );
      })}
    </nav>
  );
}
