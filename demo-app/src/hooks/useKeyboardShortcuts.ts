import { useEffect } from "react";
import { useDemoStore } from "@/state/store";

/**
 * Console-wide keyboard shortcuts. Each one drives navigation or triggers a
 * real, working capability — nothing here plays back a script or depends on
 * a staged reveal.
 *
 * `S` increments a token in the store; the Gateway stop owns the actual
 * credential-test request, so the same trigger works whether the user uses
 * the keyboard or clicks the button.
 *
 * Suppressed entirely while Settings is open — Fluent's own Drawer already
 * owns Escape there, and letting this hook's Escape case also fire would
 * either double-handle it or navigate to the landing page out from under an
 * open overlay.
 */
export function useKeyboardShortcuts() {
  const runAccessControlTest = useDemoStore((s) => s.runAccessControlTest);
  const goToLanding = useDemoStore((s) => s.goToLanding);
  const nextStop = useDemoStore((s) => s.nextStop);
  const previousStop = useDemoStore((s) => s.previousStop);
  const toggleMode = useDemoStore((s) => s.toggleMode);
  const toggleCopilot = useDemoStore((s) => s.toggleCopilot);
  const copilotOpen = useDemoStore((s) => s.copilotOpen);
  const setCopilotOpen = useDemoStore((s) => s.setCopilotOpen);
  const hasActiveConversation = useDemoStore((s) => s.hasActiveConversation);
  const settingsOpen = useDemoStore((s) => s.settingsOpen);

  useEffect(() => {
    if (settingsOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (isTypingTarget && event.key !== "Escape") return;

      switch (event.key) {
        // Section/stop navigation.
        case "ArrowRight":
          event.preventDefault();
          nextStop();
          break;
        case "ArrowLeft":
          event.preventDefault();
          previousStop();
          break;
        case "c":
        case "C":
          toggleCopilot();
          break;
        case "s":
        case "S":
          // Brings the Gateway stop on stage with it — see store.
          runAccessControlTest();
          break;
        case "l":
        case "L":
          toggleMode();
          break;
        case "Escape":
          // Innermost thing first: the copilot, then the console itself —
          // and never leave while a conversation would be lost (see
          // store.goToLanding). Dialogs (Policy Viewer, request detail, …)
          // own Escape themselves and are not this hook's concern.
          if (copilotOpen) {
            setCopilotOpen(false);
          } else if (!hasActiveConversation) {
            goToLanding();
          }
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    settingsOpen,
    hasActiveConversation,
    copilotOpen,
    toggleMode,
    runAccessControlTest,
    goToLanding,
    nextStop,
    previousStop,
    toggleCopilot,
    setCopilotOpen,
  ]);
}
