import type { DemoMode } from "@/config/env";

/**
 * The five stops of the guided walkthrough, in the order the lab itself
 * builds: choose a framework, deploy it as a Hosted Agent, put a gateway in
 * front of it, observe it, operate it.
 *
 *   frameworks    → ① Which frameworks does the platform support?
 *   hostedAgents  → ② What happens when I deploy one?
 *   gateway       → ③ How do clients reach the agent?
 *   observability → ④ What evidence does the platform generate?
 *   operations    → ⑤ What does the operations team administer?
 *
 * This replaces the five simultaneous dashboard panels. Each stop answers
 * exactly one of those questions and owns the whole stage while it does, which
 * is what makes the walkthrough a route rather than a wall of surfaces.
 *
 * Two structural changes are encoded here. The conversation is no longer a
 * stop: it became the copilot, available at every stop and occupying no space
 * when closed. And the old Operations panel's three tabs split — audit and
 * measurements answer "what evidence", the governance catalogue answers "what
 * does the team administer", and those are different questions.
 *
 * The ids stay short and internal; they name state, not headings.
 */
export type StopId =
  | "frameworks"
  | "hostedAgents"
  | "gateway"
  /**
   * Reference material about API Management as a product - not a reading of
   * this deployment. A stop of its own precisely so it can never share a
   * screen with the live gateway journey; see ApimCapabilitiesStop.
   */
  | "apimCapabilities"
  /**
   * The three-credential test, split off the live Gateway screen.
   *
   * It earns its own stop for a space reason rather than an argument one,
   * which is why 4.8 held it open as provisional until CP3. Re-measured under
   * the sidebar's chrome it still does not fit back on the live screen - 561px
   * merged against a 507px budget, 64px once the three attempts have run - so
   * 4.8 is now resolved and the stop is permanent.
   */
  | "gatewayCredentials"
  | "observability"
  /**
   * The measurements half of Observability. Split off the record when the
   * screen was measured with real data loaded: 936px of content in a 508px
   * budget. Unlike gatewayCredentials this is not provisional - "what was
   * asked and answered" and "what did it cost" are two questions with two
   * audiences and two queries behind them.
   */
  | "observabilityMeasurements"
  | "operations";

/** Stage order. The rail, the arrow keys and `R` all read this. */
export const STOP_ORDER: StopId[] = [
  "frameworks",
  "hostedAgents",
  "gateway",
  "gatewayCredentials",
  "apimCapabilities",
  "observability",
  "observabilityMeasurements",
  "operations",
];

/**
 * The four top-level sections of the console shell, per `ARCHITECTURE.md`
 * §3 — object-oriented navigation (Agents · Gateway · Observability · Platform)
 * layered on top of the existing five stops. This is navigation grouping only:
 * no stop's content, id, or translation keys change because of it.
 */
export type SectionId = "agents" | "gateway" | "observability" | "platform";

export const SECTION_ORDER: SectionId[] = ["agents", "gateway", "observability", "platform"];

/**
 * Which stops live under each section, in display order. "agents" carries two
 * stops (Frameworks, Hosted Agents) — both concern the agent object today, and
 * neither is dropped or merged here; that reclassification is later work.
 * Gateway, Observability and "operations" (labelled Platform in the new nav —
 * unrenamed internally to avoid touching every caller of
 * `goToStop("operations")`) each carry exactly one.
 */
export const SECTION_STOPS: Record<SectionId, StopId[]> = {
  agents: ["frameworks", "hostedAgents"],
  gateway: ["gateway", "gatewayCredentials", "apimCapabilities"],
  observability: ["observability", "observabilityMeasurements"],
  platform: ["operations"],
};

/** Reverse lookup — which section a given stop belongs to. */
export const STOP_TO_SECTION: Record<StopId, SectionId> = Object.fromEntries(
  (Object.entries(SECTION_STOPS) as [SectionId, StopId[]][]).flatMap(([section, stops]) =>
    stops.map((stop) => [stop, section]),
  ),
) as Record<StopId, SectionId>;

/**
 * The name of a registered Hosted Agent. Was a closed union of exactly the
 * two agents pre-registered for the demo (DESIGN_DECISIONS.md,
 * PRESENTATION_FLOW.md Beat 5); widened to `string` once Create Agent made
 * it possible to register a third, arbitrarily-named one at runtime — a
 * literal union can't represent a name that doesn't exist until a form
 * submits. Every existing caller that passed one of the two original
 * literals still type-checks unchanged; nothing in the frontend branches
 * exhaustively on a specific agent name (verified before this change), so
 * widening introduces no silent behavior gap.
 */
export type AgentName = string;

/** Settings → Language. */
export type Locale = "en" | "es";

/**
 * Settings → Theme. "system" follows the OS's `prefers-color-scheme`;
 * "light" and "dark" are explicit overrides. Light is the default for a new
 * session — see the store's initial state in state/store.ts.
 */
export type ThemePreference = "light" | "dark" | "system";

/** Which top-level page is showing. See layout/LandingPage.tsx and App.tsx. */
export type View = "landing" | "dashboard";

export type { DemoMode };
