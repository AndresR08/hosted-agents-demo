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
import { AddRegular, DismissRegular } from "@fluentui/react-icons";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import type { AgentName } from "@/state/types";

interface FormState {
  name: string;
  image: string;
  cpu: string;
  memory: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: "", image: "", cpu: "1", memory: "2Gi", description: "" };

/**
 * AGENT › CREATE — `POST /api/agents` (`DemoDataService.createAgent`), the
 * one write this dialog performs. `cpu`/`memory` default to "1"/"2Gi" as a
 * convenience (what both existing demo agents use); every other field
 * starts empty and must be typed.
 *
 * Client-side validation is limited to "is a required field non-empty" —
 * anything about *whether a name is available* (409) or *whether an
 * environment variable key is platform-managed* (400) is the broker's own
 * check (broker/src/routes/agents.ts), not duplicated here. Whatever the
 * broker rejects with is shown through the same `assistant.liveError`
 * pattern every other write in this section uses — no per-status-code
 * branching, because the message already carries the reason.
 *
 * On success this dialog does not touch any panel's state directly. It
 * calls `onCreated(name)`, and the caller (`AgentsView`) responds with
 * exactly one thing: `setTargetAgent(name)`. That single store update is
 * what cascades through the list, Summary and Versions effects that already
 * exist — the list refetches (the broker already invalidated its registry
 * cache on creation) and resolves the new name, Summary and Versions fetch
 * it fresh. Nothing here reaches into their state.
 */
export function CreateAgentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (agentName: AgentName) => void;
}) {
  const t = useTranslation();
  const service = useDemoDataService();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A dialog reused across opens must not remember the previous attempt.
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.image.trim().length > 0 &&
    form.cpu.trim().length > 0 &&
    form.memory.trim().length > 0 &&
    !submitting;

  function field(key: keyof FormState) {
    return (_: unknown, data: { value: string }) => setForm((f) => ({ ...f, [key]: data.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await service.createAgent({
        name: form.name.trim(),
        image: form.image.trim(),
        cpu: form.cpu.trim(),
        memory: form.memory.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      });
      onCreated(created.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="!w-[480px]">
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
            {t("agents.create.title")}
          </DialogTitle>
          <DialogContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 pb-2 pt-1">
              <LabeledInput
                label={t("agents.detail.name")}
                value={form.name}
                onChange={field("name")}
                placeholder={t("agents.create.namePlaceholder")}
                disabled={submitting}
                autoFocus
              />
              <LabeledInput
                label={t("ha.fact.image")}
                value={form.image}
                onChange={field("image")}
                placeholder={t("agents.create.imagePlaceholder")}
                disabled={submitting}
              />
              <div className="flex gap-3">
                <LabeledInput
                  label={t("ha.fact.cpu")}
                  value={form.cpu}
                  onChange={field("cpu")}
                  disabled={submitting}
                  className="flex-1"
                />
                <LabeledInput
                  label={t("ha.fact.memory")}
                  value={form.memory}
                  onChange={field("memory")}
                  disabled={submitting}
                  className="flex-1"
                />
              </div>
              <LabeledInput
                label={t("agents.detail.description")}
                value={form.description}
                onChange={field("description")}
                disabled={submitting}
              />

              <p className="text-caption text-ink-muted">{t("agents.create.requiredNote")}</p>

              {error && (
                <p className="text-caption text-ink">
                  {t("assistant.liveError")} ({error})
                </p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <Button appearance="secondary" onClick={onClose} disabled={submitting}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" appearance="primary" icon={<AddRegular />} disabled={!canSubmit}>
                  {submitting ? t("agents.create.creating") : t("agents.create.submit")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  className,
}: {
  label: string;
  value: string;
  onChange: (_: unknown, data: { value: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full"
      />
    </label>
  );
}
