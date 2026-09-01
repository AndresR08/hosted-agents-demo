import { create } from "zustand";
import { env } from "@/config/env";
import { STOP_ORDER } from "./types";
import type { AgentName, DemoMode, Locale, StopId, ThemePreference, View } from "./types";

/** How long one screen fades out before the other takes over (both directions). */
const TRANSITION_MS = 320;

/**
 * Single store for cross-cutting UI state — navigation, settings, and the
 * handful of values two unrelated screens both need (`targetAgent`,
 * `lastAskId`). Deliberately holds no fetched data: screens own their own
 * data via the service layer (see src/services).
 */
export interface DemoStore {
  view: View;
  /** True during the brief landing→dashboard fade — see startDemonstration(). */
  transitioning: boolean;
  /**
   * Which stop is on stage. Four sections (Agents · Gateway · Observability ·
   * Platform) map onto five stops — Agents alone carries two, Frameworks and
   * Hosted Agents — see `SECTION_STOPS`/`STOP_TO_SECTION` in state/types.ts.
   */
  stop: StopId;
  /**
   * Whether the copilot occupies the right-hand side of the stage. Closed by
   * default and occupies no layout when closed (`display:none`).
   */
  copilotOpen: boolean;
  mode: DemoMode;
  /** Set when mode is "replay"; drives the "Replay · captured {date}" badge. */
  capturedAt: string | null;
  targetAgent: AgentName;
  /** Incremented each time Access Control's three-attempt sequence should replay — see GatewayStop. */
  accessControlRunToken: number;
  /** Mirrors whether the AI Assistant has any messages — lets ESC decide whether it's safe to leave the dashboard. */
  hasActiveConversation: boolean;
  /** The most recent real `askId` (Live mode only) — lets Gateway, Observability and Platform fetch the matching request without knowing about each other. */
  lastAskId: string | null;

  // Settings — configured exclusively via the Settings drawer, never a
  // dashboard-visible switch.
  language: Locale;
  themePreference: ThemePreference;
  reducedMotion: boolean;
  settingsOpen: boolean;

  /** Move to a specific stop — click on the section nav or a detail tab. */
  goToStop: (stop: StopId) => void;
  /** `→` — advance along STOP_ORDER; stops at the last one rather than wrapping. */
  nextStop: () => void;
  /** `←` — step back; stops at the first one. */
  previousStop: () => void;
  /** `C` / the copilot handle — show or hide the conversation. */
  toggleCopilot: () => void;
  setCopilotOpen: (open: boolean) => void;

  /**
   * Clears everything that belongs to one demonstration, keeping everything
   * that belongs to the operator.
   *
   * Most of a reset already happens for free: App.tsx swaps LandingPage for
   * AppShell rather than hiding it, so returning to the landing page unmounts
   * the console and takes the copilot history and the journey timings with it,
   * and `startDemonstration` already cleared `lastAskId`. What survived that
   * round trip were the flags below.
   *
   * `hasActiveConversation` is the one that misbehaved: it is set when the
   * copilot is first used and was never set back, so the session after a
   * copilot demo opened with a stale `true` and asked the presenter to confirm
   * losing a conversation that had already been unmounted.
   *
   * Language, theme, reduced motion and Live/Simulation are deliberately NOT
   * touched — they are the operator's settings, not demo state, and silently
   * flipping a rehearsing presenter back to Live would be the more dangerous
   * bug of the two.
   */
  resetDemoState: () => void;

  /** Landing page primary button / `Enter` — begins the fade into the console. */
  startDemonstration: () => void;
  /** Header Home button / `Esc` — fades back to the landing page. Callers are responsible for confirming data loss first (see Header.tsx). */
  goToLanding: () => void;

  /** `L` — toggle Live / Simulation. */
  toggleMode: () => void;
  /** Settings → Demo Mode radio group. */
  setMode: (mode: DemoMode) => void;
  /** Agent selection — Agents' list, and the header badge that mirrors it. */
  setTargetAgent: (agent: AgentName) => void;
  /** `S` — (re)run the Access Control three-attempt sequence. */
  runAccessControlTest: () => void;
  setHasActiveConversation: (value: boolean) => void;
  setLastAskId: (askId: string) => void;

  setLanguage: (language: Locale) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setReducedMotion: (on: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useDemoStore = create<DemoStore>((set, get) => ({
  view: "landing",
  transitioning: false,
  stop: "frameworks",
  copilotOpen: false,
  mode: env.defaultMode,
  capturedAt: null,
  targetAgent: "pydantic-agent",
  accessControlRunToken: 0,
  hasActiveConversation: false,
  lastAskId: null,

  language: "es",
  themePreference: "dark",
  reducedMotion: true,
  settingsOpen: false,

  goToStop: (stop) => set({ stop }),

  nextStop: () =>
    set((state) => {
      const i = STOP_ORDER.indexOf(state.stop);
      return { stop: STOP_ORDER[Math.min(i + 1, STOP_ORDER.length - 1)] };
    }),

  previousStop: () =>
    set((state) => {
      const i = STOP_ORDER.indexOf(state.stop);
      return { stop: STOP_ORDER[Math.max(i - 1, 0)] };
    }),

  toggleCopilot: () => set((state) => ({ copilotOpen: !state.copilotOpen })),
  setCopilotOpen: (copilotOpen) => set({ copilotOpen }),

  resetDemoState: () =>
    set({
      lastAskId: null,
      hasActiveConversation: false,
      targetAgent: "pydantic-agent",
      accessControlRunToken: 0,
      capturedAt: null,
    }),

  startDemonstration: () => {
    set({ transitioning: true });
    const delay = get().reducedMotion ? 0 : TRANSITION_MS;
    window.setTimeout(() => {
      set({
        view: "dashboard",
        transitioning: false,
        stop: "frameworks",
        copilotOpen: false,
        // The same clearing the Settings button performs, so the two routes
        // into a fresh demonstration cannot drift apart.
        lastAskId: null,
        hasActiveConversation: false,
        targetAgent: "pydantic-agent",
        accessControlRunToken: 0,
      });
    }, delay);
  },

  goToLanding: () => {
    set({ transitioning: true });
    const delay = get().reducedMotion ? 0 : TRANSITION_MS;
    window.setTimeout(() => {
      set({ view: "landing", transitioning: false });
    }, delay);
  },

  toggleMode: () =>
    set((state) => ({
      mode: state.mode === "live" ? "replay" : "live",
      capturedAt: state.mode === "live" ? new Date().toISOString() : null,
    })),

  setMode: (mode) =>
    set((state) => ({
      mode,
      capturedAt: mode === "replay" ? (state.capturedAt ?? new Date().toISOString()) : null,
    })),

  setTargetAgent: (agent) => set({ targetAgent: agent }),

  // The outcomes render on the Gateway stop, so running the test from a
  // keyboard shortcut has to bring that stop on stage with it.
  runAccessControlTest: () =>
    set((state) => ({
      accessControlRunToken: state.accessControlRunToken + 1,
      stop: "gateway",
    })),

  setHasActiveConversation: (hasActiveConversation) => set({ hasActiveConversation }),
  setLastAskId: (lastAskId) => set({ lastAskId }),

  setLanguage: (language) => set({ language }),
  setThemePreference: (themePreference) => set({ themePreference }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
