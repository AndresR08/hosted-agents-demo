import { CheckmarkCircleRegular, ShieldCheckmarkRegular } from "@fluentui/react-icons";
import type { AccessControlAttempt } from "@/services/contracts";
import { useTranslation } from "@/i18n/useTranslation";

/**
 * Renders the outcome of one credential attempt on ③ API Management
 * (features/gateway/GatewayStop.tsx).
 *
 * DESIGN_DECISIONS.md — the colour inversion, the single most important
 * rule in the visual system: a 401 here is the *desired* outcome, not an
 * error. Both "success" and "rejected" render in the same affirmative
 * treatment (accent/affirm colours, a shield or checkmark glyph). Red and
 * warning triangles must never appear on this component — getting this
 * wrong inverts the meaning of the strongest proof point on the page.
 */
export function StatusPill({ attempt }: { attempt: AccessControlAttempt }) {
  const t = useTranslation();
  const isRejection = attempt.outcome === "rejected";
  const Icon = isRejection ? ShieldCheckmarkRegular : CheckmarkCircleRegular;

  return (
    <div className="flex items-center gap-2 rounded-md bg-illustrative-bg px-3 py-2">
      <Icon className="text-affirm" fontSize={20} aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-body font-medium text-ink">
          {attempt.httpStatus} {isRejection ? `— ${t("accessControl.rejected")}` : "OK"}
        </span>
        <span className="text-caption text-ink-muted">{attempt.credentialPresented}</span>
      </div>
    </div>
  );
}
