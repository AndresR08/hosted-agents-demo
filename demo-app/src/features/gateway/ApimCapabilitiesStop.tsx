import { useEffect, useState } from "react";
import { BookInformationRegular, BrainCircuitRegular, ArrowRoutingRegular } from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useDemoStore } from "@/state/store";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoDataService } from "@/services/provider";
import { cn } from "@/lib/cn";
import { CAPABILITIES, ROUTING_STEPS, TIER_ROWS } from "./apimCapabilities";

/**
 * REFERENCE — "what else does API Management offer?"
 *
 * The one screen in this console that is not reading this deployment. It
 * exists so a solutions architect can move from "here is what we built" to
 * "here is what the platform allows", without either half contaminating the
 * other.
 *
 * THE SEPARATION, AND WHY IT IS BUILT RATHER THAN REMEMBERED
 *
 * Every other screen carries a `live` provenance badge over figures read from
 * Azure. This one carries `illustrative`, the band this application already
 * reserves for "not measured from this deployment" — the same badge the
 * Simulation mode uses. Three further things keep the boundary visible while
 * someone is presenting at speed:
 *
 *   - It is a separate stop. It never renders beside the live journey diagram;
 *     reaching it is a deliberate click on "Reference" in the Gateway sub-nav.
 *   - A banner states the rule in words, at the top, permanently.
 *   - Every capability carries a pill saying whether this lab configures it.
 *     Three of the eight do; the pill is what stops the list from being read
 *     aloud as a list of things that are switched on.
 *
 * The single live value on the screen is the APIM tier, from
 * `/api/environment`. It is marked as live where it appears, and when the
 * broker does not report it, the tier table simply highlights nothing rather
 * than assuming Basicv2 — a wrong "you are here" is worse than none.
 */
export function ApimCapabilitiesStop() {
  const t = useTranslation();
  const language = useDemoStore((s) => s.language);
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);

  const [apimSku, setApimSku] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Only in live mode: in Simulation the environment is PLACEHOLDER, and a
    // highlighted tier row sourced from a placeholder is exactly the kind of
    // fabricated fact this screen is arguing against.
    if (mode !== "live") {
      setApimSku(null);
      return;
    }
    service
      .getEnvironmentContext()
      .then((env) => {
        if (!cancelled) setApimSku(env.apimSku ?? null);
      })
      .catch(() => {
        if (!cancelled) setApimSku(null);
      });
    return () => {
      cancelled = true;
    };
  }, [service, mode]);

  return (
    <StopFrame
      title={t("apim.title")}
      question={t("apim.question")}
      provenance={<ProvenanceBadge provenance={{ band: "illustrative" }} />}
    >
      <div className="flex flex-col gap-5">
        {/* The rule, in words, permanently on screen. */}
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-illustrative-bg/60 px-4 py-3">
          <BookInformationRegular fontSize={20} className="mt-0.5 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {t("apim.bannerTitle")}
            </p>
            <p className="mt-1 text-body text-ink-muted">{t("apim.bannerBody")}</p>
          </div>
        </div>

        {/* ── The capability catalogue ─────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            const isUsed = cap.usedHere === "yes";
            return (
              <div
                key={cap.id}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Icon fontSize={18} />
                  <h3 className="min-w-0 flex-1 text-body font-semibold text-ink">
                    {cap.title[language]}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-caption font-medium",
                      isUsed
                        ? "bg-accent/[0.10] text-ink"
                        : "border border-dashed border-border text-ink-muted",
                    )}
                  >
                    {isUsed ? t("apim.pillUsed") : t("apim.pillNotUsed")}
                  </span>
                </div>
                <p className="text-body text-ink-muted">{cap.body[language]}</p>
                <p className="text-caption text-ink-muted">{cap.note[language]}</p>
              </div>
            );
          })}
        </div>

        {/* ── Tier comparison — our own measurement ─────────────────────── */}
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-body font-semibold text-ink">{t("apim.tiersTitle")}</h3>
            {apimSku ? (
              <span className="text-caption text-ink-muted">
                <ProvenanceBadge provenance={{ band: "live" }} className="mr-1.5" />
                {t("apim.tiersLive").replace("{sku}", apimSku)}
              </span>
            ) : (
              <span className="text-caption text-ink-muted">{t("apim.tiersUnknown")}</span>
            )}
          </div>
          <p className="mt-1 text-caption text-ink-muted">{t("apim.tiersSubtitle")}</p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-body">
              <thead>
                <tr className="text-left text-caption uppercase tracking-[0.04em] text-ink-muted">
                  <th className="py-1.5 pr-4 font-medium">{t("apim.colTier")}</th>
                  <th className="py-1.5 pr-4 font-medium">{t("apim.colCost")}</th>
                  <th className="py-1.5 pr-4 font-medium">{t("apim.colColdStart")}</th>
                  <th className="py-1.5 font-medium">{t("apim.colFit")}</th>
                </tr>
              </thead>
              <tbody>
                {TIER_ROWS.map((row) => {
                  const isCurrent = apimSku?.toLowerCase() === row.sku.toLowerCase();
                  return (
                    <tr
                      key={row.sku}
                      className={cn("border-t border-border", isCurrent && "bg-accent/[0.06]")}
                    >
                      <td className="py-2 pr-4 font-medium text-ink">
                        {row.sku}
                        {isCurrent && (
                          <span className="ml-2 text-caption font-normal text-ink-muted">
                            {t("apim.tierCurrent")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-muted">{row.cost[language]}</td>
                      <td className="py-2 pr-4 text-ink-muted">{row.coldStart[language]}</td>
                      <td className="py-2 text-ink-muted">{row.fit[language]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-ink-muted">{t("apim.tiersFootnote")}</p>
        </section>

        {/* ── How the model is chosen ───────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <BrainCircuitRegular fontSize={18} />
            <h3 className="text-body font-semibold text-ink">{t("apim.routingTitle")}</h3>
          </div>
          <p className="mt-1 text-body text-ink-muted">{t("apim.routingLead")}</p>

          <ol className="mt-3 flex flex-col gap-2 md:flex-row md:items-stretch">
            {ROUTING_STEPS.map((step, i) => (
              <li key={step.actor} className="flex min-w-0 flex-1 items-stretch gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-border px-3 py-2">
                  <p className="text-caption font-semibold text-ink">{step.actor}</p>
                  <p className="mt-1 text-caption text-ink-muted">{step.detail[language]}</p>
                </div>
                {i < ROUTING_STEPS.length - 1 && (
                  <ArrowRoutingRegular
                    fontSize={16}
                    className="mt-3 hidden shrink-0 self-start text-ink-muted md:block"
                  />
                )}
              </li>
            ))}
          </ol>

          <p className="mt-3 rounded-md bg-illustrative-bg/60 px-3 py-2 text-caption text-ink-muted">
            {t("apim.routingPunchline")}
          </p>
        </section>
      </div>
    </StopFrame>
  );
}
