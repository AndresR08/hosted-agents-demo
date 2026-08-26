import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Button,
} from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import { PanelBody } from "@/components/PanelBody";
import { useTranslation } from "@/i18n/useTranslation";
import type { RequestObservability, TraceSpan } from "@/services/contracts";
import { FieldRow, fmt } from "./ObservableValue";
import { cn } from "@/lib/cn";

/**
 * The technical depth an enterprise architect asks for, kept out of the
 * executive view until requested.
 *
 * The centrepiece is the execution timeline: real parent/child spans from
 * Application Insights, correlated by the trace id the agent returned. It spans
 * three roles — the Foundry runtime, the agent container, and API Management —
 * and it is a genuine distributed trace, not a reconstruction from timestamps.
 * The managed-identity token acquisition appears in it as its own span, which
 * is the most concrete governance evidence in the whole application.
 */
export function ObservabilityDetailDialog({
  open,
  onClose,
  obs,
}: {
  open: boolean;
  onClose: () => void;
  obs: RequestObservability | null;
}) {
  const t = useTranslation();
  if (!obs) return null;

  const i = obs.inference;
  const spans = obs.trace.spans;
  const rootStart = spans.length > 0 ? new Date(spans[0].startedAt).getTime() : 0;
  const rootDuration = spans.length > 0 ? Math.max(...spans.map((s) => s.durationMs)) : 1;

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="!w-[940px] !max-w-[94vw]">
        <DialogBody className="!h-[82vh]">
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
            {t("obs.detail.title")}
          </DialogTitle>
          <DialogContent className="flex h-full min-h-0 flex-col">
            <PanelBody className="pr-2">
              {/* Execution timeline */}
              <Section title={t("obs.detail.timeline")}>
                {spans.length === 0 ? (
                  <p className="text-caption italic text-ink-muted">{obs.trace.note}</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      {spans.map((span) => (
                        <SpanRow
                          key={span.id}
                          span={span}
                          rootStart={rootStart}
                          rootDuration={rootDuration}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-caption leading-relaxed text-ink-muted">
                      {obs.trace.note}
                    </p>
                  </>
                )}
              </Section>

              {/* Correlation */}
              <Section title={t("obs.detail.correlation")}>
                <FieldRow label={t("obs.field.traceId")} field={obs.correlation.traceId} mono />
                <FieldRow
                  label={t("obs.detail.hop1Correlation")}
                  field={obs.correlation.hop1CorrelationId}
                  mono
                />
                <FieldRow
                  label={t("obs.detail.hop2Correlation")}
                  field={obs.correlation.hop2CorrelationId}
                  mono
                />
                <FieldRow label={t("obs.field.requestId")} field={i.requestId} mono />
                <FieldRow label={t("obs.field.conversationId")} field={i.conversationId} mono />
                <FieldRow label={t("obs.detail.apimRequestId")} field={i.apimRequestId} mono />
                <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">
                  {obs.correlation.method}
                </p>
              </Section>

              {/* Gateway route */}
              <Section title={t("obs.detail.route")}>
                <FieldRow label={t("obs.field.gatewayApi")} field={i.gatewayApi} mono />
                <FieldRow label={t("obs.detail.operation")} field={i.gatewayOperation} mono />
                <FieldRow label={t("obs.detail.apiRevision")} field={i.apiRevision} />
                <FieldRow label={t("obs.detail.url")} field={i.gatewayRoute} mono />
                <FieldRow label={t("obs.field.status")} field={i.httpStatus} />
                <FieldRow label={t("obs.detail.backendStatus")} field={i.backendStatus} />
                <FieldRow label={t("obs.detail.callerIp")} field={i.callerIp} mono />
                <FieldRow label={t("obs.detail.requestBytes")} field={i.requestBytes} format={fmt.bytes} />
                <FieldRow label={t("obs.detail.responseBytes")} field={i.responseBytes} format={fmt.bytes} />
              </Section>

              {/* Runtime */}
              <Section title={t("obs.detail.runtime")}>
                <FieldRow label={t("obs.detail.cluster")} field={i.servedByCluster} mono />
                <FieldRow label={t("obs.detail.platform")} field={i.runtime} mono />
                <FieldRow label={t("obs.field.region")} field={i.region} />
              </Section>

              {/* Raw GenAI attributes */}
              {Object.keys(obs.trace.genAiAttributes).length > 0 && (
                <Section title={t("obs.detail.genai")}>
                  <div className="rounded-md border border-border bg-illustrative-bg p-2">
                    {Object.entries(obs.trace.genAiAttributes)
                      .sort()
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-2 py-0.5 font-mono text-caption">
                          <span className="shrink-0 text-ink-muted">{k}</span>
                          <span className="min-w-0 break-all text-ink">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                  <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">
                    {t("obs.detail.genaiNote")}
                  </p>
                </Section>
              )}

              {/* Explicitly unavailable */}
              <Section title={t("obs.detail.unavailable")}>
                <FieldRow label={t("obs.detail.cost")} field={i.cost} />
                <FieldRow label={t("obs.detail.queueTime")} field={i.queueTimeMs} />
                <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">
                  {t("obs.detail.unavailableNote")}
                </p>
              </Section>
            </PanelBody>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * One span as a proportional bar. Indentation follows the parent/child
 * relationship Application Insights reports, so the nesting on screen is the
 * real call hierarchy rather than a visual convention.
 */
function SpanRow({
  span,
  rootStart,
  rootDuration,
}: {
  span: TraceSpan;
  rootStart: number;
  rootDuration: number;
}) {
  const offset = Math.max(0, new Date(span.startedAt).getTime() - rootStart);
  const leftPct = rootDuration > 0 ? Math.min(96, (offset / rootDuration) * 100) : 0;
  const widthPct = rootDuration > 0 ? Math.max(1.5, (span.durationMs / rootDuration) * 100) : 100;
  const isGateway = span.role.startsWith("apim");

  return (
    <div className="flex items-center gap-2">
      <span className="w-[132px] shrink-0 truncate text-caption text-ink-muted" title={span.role}>
        {span.role}
      </span>
      <span className="w-[188px] shrink-0 truncate text-caption text-ink" title={span.name}>
        {span.name}
      </span>
      <span className="relative h-3 min-w-0 flex-1 rounded-sm bg-illustrative-bg">
        <span
          className={cn(
            "absolute top-0 h-full rounded-sm",
            isGateway ? "bg-accent" : "bg-affirm",
            !span.success && "bg-ink-muted",
          )}
          style={{ left: `${leftPct}%`, width: `${Math.min(100 - leftPct, widthPct)}%` }}
        />
      </span>
      <span className="w-[68px] shrink-0 text-right font-mono text-caption text-ink-muted">
        {span.durationMs >= 1000
          ? `${(span.durationMs / 1000).toFixed(2)}s`
          : `${Math.round(span.durationMs)}ms`}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
