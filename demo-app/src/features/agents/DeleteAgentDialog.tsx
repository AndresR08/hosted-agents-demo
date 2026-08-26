import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
} from "@fluentui/react-components";
import { DeleteRegular, DismissRegular } from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AgentName } from "@/state/types";

/**
 * AGENT › DELETE — `DELETE /api/agents/:name` (`DemoDataService.deleteAgent`),
 * the one write this dialog performs. Mirrors `CreateAgentDialog`'s shape:
 * local form state reset on every open, the broker's own error surfaced
 * verbatim through `assistant.liveError`, no client-side re-validation of
 * what only the broker can know (e.g. whether the agent has active
 * sessions — that reaches the caller as whatever Foundry said).
 *
 * The delete button only enables once the typed text exactly matches
 * `agentName` — an irreversible, cascading action (every version of the
 * agent goes with it) gets the same "type the name to confirm" friction
 * this class of action gets everywhere else, enforced client-side because
 * it is about presenter intent, not something the broker needs to check.
 */
export function DeleteAgentDialog({
  open,
  onClose,
  agentName,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** The agent this dialog targets — set by the caller before opening. */
  agentName: AgentName | null;
  onDeleted: (deletedName: string) => void;
}) {
  const t = useTranslation();
  const service = useDemoDataService();

  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A dialog reused across opens must not remember the previous attempt.
  useEffect(() => {
    if (open) {
      setConfirmText("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit = Boolean(agentName) && confirmText === agentName && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !agentName) return;

    setSubmitting(true);
    setError(null);
    try {
      await service.deleteAgent(agentName);
      onDeleted(agentName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="!w-[440px]">
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label={t("settings.close")}
                onClick={onClose}
              />
            }
          >
            {t("agents.delete.title")}
          </DialogTitle>
          <DialogContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 pb-2 pt-1">
              <p className="text-caption leading-relaxed text-ink-muted">{t("agents.delete.warning")}</p>
              <p className="rounded-md border border-border bg-illustrative-bg px-2 py-1.5 font-mono text-caption text-ink">
                {agentName}
              </p>

              <label>
                <span className="mb-1 block text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {t("agents.delete.confirmLabel")}
                </span>
                <Input
                  value={confirmText}
                  onChange={(_, data) => setConfirmText(data.value)}
                  placeholder={agentName ?? ""}
                  disabled={submitting}
                  autoFocus
                  className="w-full"
                />
              </label>

              {error && (
                <p className="text-caption text-ink">
                  {t("assistant.liveError")} ({error})
                </p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <Button appearance="secondary" onClick={onClose} disabled={submitting}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" appearance="primary" icon={<DeleteRegular />} disabled={!canSubmit}>
                  {submitting ? t("agents.delete.deleting") : t("agents.delete.submit")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
