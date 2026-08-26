import { Tooltip } from "@fluentui/react-components";
import type { ObservableField } from "@/services/contracts";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/cn";

/**
 * Renders one observable field, and is the single place the honesty rule is
 * enforced: a field Azure did not return says so in words. It never falls back
 * to a dash, a blank, or a zero — on a projector all three read as a
 * measurement, which is precisely the misreading DESIGN_DECISIONS.md forbids.
 *
 * The `source` travels with every value and surfaces on hover, so any figure on
 * screen can be traced to the Azure resource that produced it without the
 * presenter having to remember.
 */
export function ObservableValue({
  field,
  format,
  className,
  mono,
}: {
  field: ObservableField<string | number> | undefined;
  format?: (value: string | number) => string;
  className?: string;
  mono?: boolean;
}) {
  const t = useTranslation();

  if (!field || !field.available || field.value === null) {
    return (
      <Tooltip content={field?.reason ?? t("obs.unavailableReason")} relationship="description">
        <span className={cn("text-caption italic text-ink-muted", className)}>
          {t("obs.unavailable")}
        </span>
      </Tooltip>
    );
  }

  const text = format ? format(field.value) : String(field.value);

  return (
    <Tooltip content={`${t("obs.sourceLabel")} ${field.source}`} relationship="description">
      <span className={cn("text-caption text-ink", mono && "font-mono", className)}>{text}</span>
    </Tooltip>
  );
}

/** Label + value on one row, the layout the Inference Summary is built from. */
export function FieldRow({
  label,
  field,
  format,
  mono,
}: {
  label: string;
  field: ObservableField<string | number> | undefined;
  format?: (value: string | number) => string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1 last:border-b-0">
      <span className="shrink-0 text-caption text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right">
        <ObservableValue field={field} format={format} mono={mono} />
      </span>
    </div>
  );
}

export const fmt = {
  ms: (v: string | number) => {
    const n = Number(v);
    return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`;
  },
  int: (v: string | number) => Number(v).toLocaleString(),
  bytes: (v: string | number) => `${(Number(v) / 1024).toFixed(1)} KB`,
  /** IDs are long and the panel is narrow — head and tail carry the recognisable part. */
  id: (v: string | number) => {
    const s = String(v);
    return s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s;
  },
};
