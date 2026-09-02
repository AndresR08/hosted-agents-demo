import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import { CodeRegular, PlayCircleRegular } from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { StatusPill } from "@/components/StatusPill";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AccessControlAttempt } from "@/services/contracts";
import { GatewaySubNav } from "./GatewaySubNav";
import { PolicyViewerDialog } from "./PolicyViewerDialog";

const REVEAL_STAGGER_MS = 400;

/**
 * GATEWAY — "which credentials are accepted?"
 *
 * This was the third section of `GatewayStop` until the live screen was
 * measured against the 1366x768 floor: 595px of content in a 375px budget,
 * 220px of it below the fold and therefore invisible to the room. Route, path
 * and terms are three arguments, and three arguments do not fit on one screen
 * at the 16px projector floor.
 *
 * PROVISIONAL, and recorded as such in DESIGN_DECISIONS.md 4.8. The cost is
 * real and named there: until this split, the 401 rejection - the single most
 * important beat in the whole gateway story, and the only green in the console
 * - was on screen without the presenter navigating anywhere. Now it is one
 * click away. That was traded for space, not because a separate screen is a
 * better argument, and the trade must be re-examined when CP3's sidebar
 * changes how much vertical budget a screen actually has.
 *
 * Nothing about the test itself changed in the move: the same three genuine
 * HTTPS requests through the broker (routes/accessControl.ts), the same
 * staggered reveal, the same honest empty state in Simulation, which cannot
 * make the calls that produce the outcomes and so shows none rather than three
 * invented ones.
 */
export function CredentialTestStop() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const runToken = useDemoStore((s) => s.accessControlRunToken);
  const runAccessControlTest = useDemoStore((s) => s.runAccessControlTest);

  const [attempts, setAttempts] = useState<AccessControlAttempt[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    if (runToken === 0 || mode !== "live") return;
    setRevealedCount(0);
    setAttempts([]);
    service
      .runAccessControlTests()
      .then((result) => {
        setAttempts(result.attempts);
        result.attempts.forEach((_, i) =>
          window.setTimeout(() => setRevealedCount(i + 1), (i + 1) * REVEAL_STAGGER_MS),
        );
      })
      .catch(() => setAttempts([]));
  }, [runToken, mode, service]);

  return (
    <StopFrame
      title={t("gwCred.heading")}
      question={t("gwCred.question")}
      action={<GatewaySubNav />}
      footer={t("gwCred.caption")}
      provenance={
        <ProvenanceBadge
          provenance={{ band: mode === "live" && attempts.length > 0 ? "live" : "illustrative" }}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body font-medium text-ink">{t("accessControl.statement")}</p>

        {/*
          Three outcomes side by side rather than stacked. They are one
          comparison - the same request with three credentials - and reading
          them across is what the argument wants.
        */}
        {revealedCount === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-caption text-ink-muted">
            {mode === "live" ? t("accessControl.emptyState") : t("accessControl.simulationNote")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {attempts.slice(0, revealedCount).map((attempt, i) => (
              <div
                key={attempt.id}
                className="animate-fade-slide-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <StatusPill attempt={attempt} />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            appearance="primary"
            icon={<PlayCircleRegular />}
            disabled={mode !== "live"}
            onClick={runAccessControlTest}
          >
            {t("accessControl.runAll")}
          </Button>
          <Button appearance="secondary" icon={<CodeRegular />} onClick={() => setPolicyOpen(true)}>
            {t("accessControl.showPolicy")}
          </Button>
        </div>
      </div>

      <PolicyViewerDialog open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </StopFrame>
  );
}
