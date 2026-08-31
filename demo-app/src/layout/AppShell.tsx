import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDemoStore } from "@/state/store";
import { STOP_TO_SECTION } from "@/state/types";
import { cn } from "@/lib/cn";
import { Header } from "./Header";
import { SectionNav } from "./SectionNav";
import { CopilotPanel } from "@/features/copilot/CopilotPanel";
import { AgentsView } from "@/features/agents/AgentsView";
import { GatewayStop } from "@/features/gateway/GatewayStop";
import { GatewaySubNav } from "@/features/gateway/GatewaySubNav";
import { ApimCapabilitiesStop } from "@/features/gateway/ApimCapabilitiesStop";
import { ObservabilityStop } from "@/features/observability/ObservabilityStop";
import { OperationsStop } from "@/features/operations/OperationsStop";

/**
 * The console shell — ARCHITECTURE.md
 *
 * Navigation is object-oriented, not narrative: `SectionNav` exposes the four
 * top-level sections (Agents · Gateway · Observability · Platform), each a
 * thin layer over the pre-existing `stop` state (`STOP_TO_SECTION`).
 *
 * Agents (§3.1/§3.2, `AgentsView`) replaced the two legacy stops it used to
 * carry — Frameworks and Hosted Agents — with the list/selection/overview
 * console, so `section === "agents"` now renders one component regardless of
 * which of those two `stop` values is current. Gateway, Observability and
 * Platform (still `stop === "operations"` internally) are untouched: same
 * components, same conditions as before this reorganization.
 *
 * `FrameworksStop`, `HostedAgentsStop` and `AgentsSubNav` are not deleted —
 * they are simply no longer mounted here, superseded by `AgentsView`.
 *
 * Unchanged: no page-level scrolling. The outer container is fixed to the
 * viewport and `overflow-hidden`; each stop's PanelBody and the copilot's
 * history scroll internally (DESIGN_DECISIONS.md).
 */
export function AppShell() {
  useKeyboardShortcuts();

  const stop = useDemoStore((s) => s.stop);
  const copilotOpen = useDemoStore((s) => s.copilotOpen);
  const transitioning = useDemoStore((s) => s.transitioning);
  const section = STOP_TO_SECTION[stop];

  return (
    <div
      className={cn(
        // Capped and centred rather than edge-to-edge. At 1920 an application
        // that fills every pixel reads as a web page; a composition with canvas
        // around it reads as a product. At 1366 the cap never engages.
        "mx-auto flex h-screen w-full max-w-[1600px] flex-col overflow-hidden px-grid-margin",
        transitioning && "animate-fade-out",
      )}
    >
      <Header className="animate-fade-in-up" />
      <SectionNav className="animate-fade-in-up" />

      <main className="flex min-h-0 flex-1 gap-grid-gutter overflow-hidden pb-grid-gutter">
        {/*
          `key` on the stage is deliberate: moving between stops remounts, so
          each stop plays its entry animation and none of them inherit scroll
          position from the last one.
        */}
        <div key={stop} className="flex min-w-0 flex-1 flex-col">
          {section === "agents" && <AgentsView />}
          {/*
            Outside the keyed stage would be tidier, but the stage is what the
            `key` remounts on stop change - and the sub-nav must not remount,
            or switching tabs would replay its own entry animation. It is
            rendered per stop instead, which keeps it visually fixed.
          */}
          {section === "gateway" && <GatewaySubNav />}
          {stop === "gateway" && <GatewayStop />}
          {stop === "apimCapabilities" && <ApimCapabilitiesStop />}
          {stop === "observability" && <ObservabilityStop />}
          {stop === "operations" && <OperationsStop />}
        </div>

        {/*
          Always mounted, hidden when closed. `hidden` is display:none, so it
          occupies no space at all — but the conversation survives being closed
          and reopened, which it would not if this unmounted. A presenter who
          collapses the panel to show a stop in full is not asking to lose the
          exchange they just had.
        */}
        <CopilotPanel className={cn(!copilotOpen && "hidden")} />
      </main>
    </div>
  );
}
