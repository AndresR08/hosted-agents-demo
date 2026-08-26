import { useState, type ReactElement } from "react";
import { Button } from "@fluentui/react-components";
import { CheckmarkCircleFilled, ErrorCircleFilled } from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { MaintenanceActionId } from "@/services/contracts";
import type { AgentName } from "@/state/types";

type ActionStatus = "idle" | "running" | "completed" | "failed";

/**
 * One maintenance action, run in place. Mirrors `MaintenanceDialog`'s
 * run/status pattern at a smaller footprint — same service call
 * (`runMaintenanceAction`), same result shape, no dialog.
 *
 * Presenter Tools → Maintenance still exists unchanged; this is the same
 * eight actions promoted to first-class console capability, one at a time,
 * wherever a screen has a real use for a specific one — `AgentOverview`
 * (warm-agent, test-hosted-agent) and `GatewayStop` (test-apim,
 * reload-policies) both use this component rather than duplicating it.
 */
export function MaintenanceActionButton({
  action,
  agentName,
  icon,
  label,
}: {
  action: MaintenanceActionId;
  agentName?: AgentName;
  icon: ReactElement;
  label: string;
}) {
  const t = useTranslation();
  const service = useDemoDataService();
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  async function run() {
    setStatus("running");
    setDetail(null);
    const started = Date.now();
    try {
      const result = await service.runMaintenanceAction(action, agentName);
      setStatus(result.ok ? "completed" : "failed");
      setDetail(result.detail);
      setElapsedMs(result.elapsedMs || Date.now() - started);
    } catch (error) {
      setStatus("failed");
      setDetail(error instanceof Error ? error.message : String(error));
      setElapsedMs(Date.now() - started);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        appearance="secondary"
        size="small"
        icon={icon}
        disabled={status === "running"}
        onClick={run}
      >
        {label}
      </Button>
      {status !== "idle" && (
        <p className="flex min-w-0 items-center gap-1 text-caption">
          {status === "running" && <span className="text-accent">{t("maintenance.status.running")}</span>}
          {status === "completed" && (
            <span className="flex items-center gap-1 text-affirm">
              <CheckmarkCircleFilled fontSize={12} />
              {t("maintenance.status.completed")}
            </span>
          )}
          {status === "failed" && (
            <span className="flex items-center gap-1 text-ink-muted">
              <ErrorCircleFilled fontSize={12} />
              {t("maintenance.status.failed")}
            </span>
          )}
          {elapsedMs !== null && status !== "running" && (
            <span className="font-mono text-ink-muted">{(elapsedMs / 1000).toFixed(1)}s</span>
          )}
          {detail && <span className="truncate text-ink-muted">· {detail}</span>}
        </p>
      )}
    </div>
  );
}
