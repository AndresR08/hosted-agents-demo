import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDemoStore } from "@/state/store";
import { STOP_TO_SECTION } from "@/state/types";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";
import { CopilotPanel } from "@/features/copilot/CopilotPanel";
import { AgentsView } from "@/features/agents/AgentsView";
import { CredentialTestStop } from "@/features/gateway/CredentialTestStop";
import { GatewayStop } from "@/features/gateway/GatewayStop";
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
 * CP3 replaced the two horizontal chrome bands with `Sidebar`. The 72px
 * environment header and the 48px section row were a permanent 120px tax on
 * every screen's vertical budget at 1366×768 — measured, the budget goes from
 * 411px to 531px — which is why the rail is a layout decision rather than a
 * restyle. `Header` and `SectionNav` are no longer mounted; nothing either of
 * them displayed was dropped, it all lives in the rail now. Neither file is
 * deleted, the same way `FrameworksStop` was not.
 *
 * The rail sits OUTSIDE the max-w-[1600px] cap and the page padding, so it
 * meets the viewport edge the way chrome should, while the stage keeps the
 * measure that makes it read as a product rather than a web page.
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
    <div className={cn("flex h-screen w-full overflow-hidden", transitioning && "animate-fade-out")}>
      <Sidebar className="animate-fade-in-up" />

      {/*
        Capped and centred rather than edge-to-edge. At 1920 an application
        that fills every pixel reads as a web page; a composition with canvas
        around it reads as a product. At 1366 the cap never engages.
      */}
      <main className="mx-auto flex min-h-0 min-w-0 max-w-[1600px] flex-1 gap-grid-gutter overflow-hidden px-grid-margin py-grid-gutter">
        {/*
          `key` on the stage is deliberate: moving between stops remounts, so
          each stop plays its entry animation and none of them inherit scroll
          position from the last one.
        */}
        <div key={stop} className="flex min-w-0 flex-1 flex-col">
          {section === "agents" && <AgentsView />}
          {/*
            The Gateway sub-nav is no longer a row here: each Gateway screen
            passes it to its own StopFrame `action` slot. That reclaimed the
            36px these three screens were paying and no other section paid.
            It still does not remount on tab change, because StopFrame's header
            is outside the animated body.
          */}
          {stop === "gateway" && <GatewayStop />}
          {stop === "gatewayCredentials" && <CredentialTestStop />}
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
