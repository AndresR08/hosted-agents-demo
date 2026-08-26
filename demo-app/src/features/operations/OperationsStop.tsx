import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  CheckmarkCircleFilled,
  CircleRegular,
  DismissCircleRegular,
  DocumentBulletListRegular,
  FlashRegular,
  FolderRegular,
  GlobeRegular,
  LayerRegular,
  PulseRegular,
} from "@fluentui/react-icons";
import { StopFrame } from "@/layout/StopFrame";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Skeleton } from "@/components/Skeleton";
import { MaintenanceActionButton } from "@/components/MaintenanceActionButton";
import { useTranslation } from "@/i18n/useTranslation";
import { useDemoStore } from "@/state/store";
import { useDemoDataService } from "@/services/provider";
import type {
  ControlsCatalogue,
  EnvironmentContext,
  GovernanceControl,
  RequestObservability,
} from "@/services/contracts";
import { cn } from "@/lib/cn";

/** Log Analytics runs 1–3 min behind, so a just-asked request needs re-checking. */
const POLL_INTERVAL_MS = 20_000;

/**
 * The approved, translated catalogue Simulation falls back to when the
 * broker's live ARM read is unavailable.
 */
const SIMULATION_ACTIVE_KEYS = [
  "controls.item.subscriptionKey",
  "controls.item.managedIdentity",
  "controls.item.headerEnforcement",
  "controls.item.auditLogging",
  "controls.item.diagnostics",
  "controls.item.contentFiltering",
  "controls.item.registryRbac",
];

const SIMULATION_AVAILABLE_KEYS = [
  "controls.item.rateLimiting",
  "controls.item.semanticCaching",
  "controls.item.loadBalancing",
  "controls.item.privateNetworking",
  "controls.item.entraOnly",
  "controls.item.keyVault",
];

/**
 * PLATFORM — "what is deployed, and what does the operations team administer?"
 *
 * Three things a platform team asks for, none of them about one request:
 *
 *  - **Environment** — the deployed resource group, region and live ARM
 *    resource count (`getEnvironmentContext()`), the same read the header
 *    strip uses. Never the manual 21-item inventory `ARCHITECTURE.md` §5
 *    documents — that counts sub-resources a simple ARM resource list does
 *    not enumerate; this shows only what a live read actually returns.
 *  - **Controls** — an inventory of what this deployment enforces, what the
 *    same control point offers that is not switched on here, and what the
 *    lab does not include at all. Two states, one shape: before any request
 *    it renders the live catalogue from `/api/controls`; once a request
 *    exists it upgrades in place, each active control citing the
 *    observation from *that* request which proves it. The three-state split
 *    is deliberate and is the panel's whole credibility — "not enabled" is a
 *    fact about configuration, not a gap in the architecture, and stating it
 *    plainly cannot be contradicted by anyone who later reads the
 *    deployment, which a fabricated throttling event certainly could
 *    (DESIGN_DECISIONS.md).
 *  - **Actions** — the four broker diagnostics that are platform-wide rather
 *    than scoped to one agent or the gateway (`ping`, `refresh-azure-status`,
 *    `reload-audit-logs`, `refresh-deployment-info`) — the remaining
 *    Presenter Tools → Maintenance actions not already promoted onto Agents
 *    or Gateway, completing all nine as first-class console capability.
 */
export function OperationsStop() {
  const t = useTranslation();
  const service = useDemoDataService();
  const mode = useDemoStore((s) => s.mode);
  const lastAskId = useDemoStore((s) => s.lastAskId);

  const [obs, setObs] = useState<RequestObservability | null>(null);
  const [catalogue, setCatalogue] = useState<ControlsCatalogue | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentContext | null>(null);

  // The environment — deployment configuration, read once per mode. Same
  // call the header strip already makes; nothing here is a second source.
  useEffect(() => {
    if (mode !== "live") {
      setEnvironment(null);
      return;
    }
    let cancelled = false;
    service
      .getEnvironmentContext()
      .then((ctx) => {
        if (!cancelled) setEnvironment(ctx);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  // The catalogue — deployment configuration, read once per mode.
  useEffect(() => {
    if (mode !== "live") {
      setCatalogue(null);
      return;
    }
    let cancelled = false;
    service
      .getControlsCatalogue()
      .then((result) => {
        if (!cancelled) setCatalogue(result);
      })
      .catch(() => {
        if (!cancelled) setCatalogue({ active: [], available: [], provenance: { band: "live" } });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, service]);

  // The evidenced view, when there is a request to evidence.
  useEffect(() => {
    if (mode !== "live" || !lastAskId) {
      setObs(null);
      return;
    }
    let cancelled = false;
    function poll() {
      service
        .getRequestObservability(lastAskId!)
        .then((result) => {
          if (!cancelled) setObs(result);
        })
        .catch(() => undefined);
    }
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, lastAskId, service]);

  const loading = mode === "live" && !obs && catalogue === null;

  const active: GovernanceControl[] = obs
    ? obs.governance.active
    : mode === "live" && catalogue
      ? catalogue.active.map((c) => ({ id: c.id, name: c.name }))
      : SIMULATION_ACTIVE_KEYS.map((key) => ({ id: key, name: t(key) }));

  const available: GovernanceControl[] = obs
    ? obs.governance.available
    : mode === "live" && catalogue
      ? catalogue.available.map((c) => ({ id: c.id, name: c.name }))
      : SIMULATION_AVAILABLE_KEYS.map((key) => ({ id: key, name: t(key) }));

  const absent: GovernanceControl[] = obs ? obs.governance.absent : [];

  return (
    <StopFrame
      title={t("platform.heading")}
      question={t("platform.question")}
      footer={t("ops.caption")}
      provenance={
        <ProvenanceBadge
          provenance={
            obs?.provenance ?? catalogue?.provenance ?? { band: mode === "live" ? "live" : "illustrative" }
          }
        />
      }
    >
      <div className="flex flex-col gap-5">
        <EnvironmentSection environment={environment} mode={mode} />

        <section>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("obs.gov.catalogue")}
          </p>
          {loading ? (
            <ul className="flex flex-col gap-2.5" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                  <Skeleton style={{ width: `${72 - i * 8}%` }} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-3">
              {!obs && (
                <p className="text-caption leading-relaxed text-ink-muted">{t("obs.gov.catalogueNote")}</p>
              )}

              <ControlGroup
                tone="active"
                title={t("obs.gov.active")}
                controls={active}
                icon={CheckmarkCircleFilled}
                evidenced={Boolean(obs)}
              />
              <ControlGroup
                tone="available"
                title={t("obs.gov.available")}
                controls={available}
                icon={CircleRegular}
              />
              <ControlGroup
                tone="absent"
                title={t("obs.gov.absent")}
                controls={absent}
                icon={DismissCircleRegular}
              />

              {mode !== "live" && (
                <p className="text-caption text-ink-muted">{t("controls.availableCaption")}</p>
              )}
            </div>
          )}
        </section>

        <section className="border-t border-border pt-4">
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {t("agents.overview.actionsTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <MaintenanceActionButton action="ping" icon={<PulseRegular />} label={t("maintenance.action.ping")} />
            <MaintenanceActionButton
              action="refresh-azure-status"
              icon={<GlobeRegular />}
              label={t("maintenance.action.refresh-azure-status")}
            />
            <MaintenanceActionButton
              action="reload-audit-logs"
              icon={<DocumentBulletListRegular />}
              label={t("maintenance.action.reload-audit-logs")}
            />
            <MaintenanceActionButton
              action="refresh-deployment-info"
              icon={<FlashRegular />}
              label={t("maintenance.action.refresh-deployment-info")}
            />
          </div>
        </section>
      </div>
    </StopFrame>
  );
}

/** Region, resource group and live ARM resource count — the same read the header strip uses. */
function EnvironmentSection({
  environment,
  mode,
}: {
  environment: EnvironmentContext | null;
  mode: string;
}) {
  const t = useTranslation();

  return (
    <section>
      <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {t("platform.environment.title")}
      </p>
      {mode !== "live" ? (
        <p className="text-caption italic text-ink-muted">{t("platform.environment.unavailable")}</p>
      ) : !environment ? (
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
      ) : (
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <EnvironmentFact icon={GlobeRegular} label={t("obs.field.region")} value={environment.region} />
          <EnvironmentFact
            icon={FolderRegular}
            label={t("platform.environment.resourceGroup")}
            value={environment.resourceGroupName}
            mono
          />
          <EnvironmentFact
            icon={LayerRegular}
            label={t("platform.environment.resourceCount")}
            value={String(environment.resourceCount)}
          />
        </dl>
      )}
    </section>
  );
}

function EnvironmentFact({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: ComponentType<{ fontSize?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon fontSize={14} className="shrink-0 text-ink-muted" />
      <dt className="text-caption text-ink-muted">{label}:</dt>
      <dd className={cn("text-caption font-medium text-ink", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

/**
 * One state group: a bordered section with a count, containing one card per
 * control.
 *
 * Each card carries what a risk function asks for — what the control is,
 * whether it is on, and what proves it. Only the Active group has proof,
 * because only active controls were observed firing on this specific request;
 * the other two carry the technical reason instead. That asymmetry is the
 * substance of the stop, so it is rendered rather than described.
 */
function ControlGroup({
  tone,
  title,
  controls,
  icon: Icon,
  evidenced,
}: {
  tone: "active" | "available" | "absent";
  title: string;
  controls: GovernanceControl[];
  icon: ComponentType<{ fontSize?: number; className?: string }>;
  evidenced?: boolean;
}) {
  const t = useTranslation();
  if (controls.length === 0) return null;

  const statusLabel =
    tone === "active"
      ? t("obs.gov.statusActive")
      : tone === "available"
        ? t("obs.gov.statusAvailable")
        : t("obs.gov.statusAbsent");

  return (
    <section className={cn("rounded-lg border", tone === "active" ? "border-affirm/40" : "border-border")}>
      <header
        className={cn(
          "flex items-baseline justify-between gap-2 rounded-t-lg border-b px-3 py-2",
          tone === "active"
            ? "border-affirm/30 bg-affirm/[0.06]"
            : "border-border bg-illustrative-bg/50",
        )}
      >
        <p
          className={cn(
            "text-caption font-semibold uppercase tracking-[0.06em]",
            tone === "active" ? "text-affirm" : "text-ink-muted",
          )}
        >
          {title}
        </p>
        <span className="shrink-0 text-caption font-medium tabular-nums text-ink-muted">
          {controls.length}
        </span>
      </header>

      {/*
        `divide-y` cannot be used on a grid: it draws a rule on every child
        after the first, including the two that sit side by side, which reads
        as a broken ladder. Row separators are applied explicitly and
        suppressed on the first row instead.
      */}
      <ul className="grid grid-cols-2 [&>li]:border-t [&>li]:border-border/60 [&>li:nth-child(-n+2)]:border-t-0">
        {controls.map((c) => (
          <li key={c.id} className="flex items-start gap-2 px-3 py-2">
            <Icon
              fontSize={15}
              className={cn(
                "mt-0.5 shrink-0",
                tone === "active" ? "text-affirm" : "text-ink-muted",
                tone === "absent" && "opacity-60",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "min-w-0 text-body font-medium leading-snug",
                    tone === "absent" ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {c.name}
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-px text-caption uppercase tracking-[0.04em]",
                    tone === "active" ? "bg-affirm/10 text-affirm" : "bg-illustrative-bg text-ink-muted",
                  )}
                >
                  {statusLabel}
                </span>
              </div>

              {(c.evidence ?? c.note) && (
                <p
                  className={cn(
                    "mt-0.5 break-words text-caption leading-snug text-ink-muted",
                    tone === "absent" && "opacity-80",
                  )}
                >
                  {evidenced && c.evidence && (
                    <span className="mr-1 font-medium text-affirm">{t("obs.gov.evidenced")}</span>
                  )}
                  {c.evidence ?? c.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
