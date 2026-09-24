import { HOSTED_AGENT_API_NAME, INFERENCE_API_NAME } from "./config.js";

/**
 * KQL that reads only this lab's rows out of tables other labs write to.
 *
 * The API Management gateway is shared, and its diagnostic setting cannot be
 * routed per API (shared-apim-registration.bicep), so this deployment's Log
 * Analytics workspace receives every lab's gateway traffic. Verified
 * 2026-09-24: ApiManagementGatewayLlmLog held gpt-5.4, gpt-5.4-mini,
 * gemini-3-flash-preview and DeepSeek-V3.2 rows from other teams - and 34
 * gpt-5-mini rows that were not ours either, so filtering by model name would
 * not have been enough.
 *
 * The rule is that another team's row never reaches the broker: every query
 * filters in KQL, in the workspace, rather than fetching a time window and
 * discarding rows afterwards. That is what stopped /api/audit-record from
 * showing another team's prompt and completion when none of the 25 newest
 * rows was ours (PROJECT_STATUS.md 4j).
 */

/** A KQL string literal. Values here come from config and the agent registry, but are escaped regardless. */
export function kqlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const HOSTED = kqlString(HOSTED_AGENT_API_NAME);
const INFERENCE = kqlString(INFERENCE_API_NAME);

/**
 * `| where` clause for ApiManagementGatewayLogs: our two APIs only. With an
 * agent name, hop 1 rows are also narrowed to that agent - it is in the URL
 * there. Hop 2 (inference) rows carry no agent, so they are kept whole and
 * tied to hop 1 by the caller.
 */
export function ourGatewayRows(agentName?: string): string {
  if (!agentName) return `| where ApiId in (${HOSTED}, ${INFERENCE}) `;
  const agentPath = kqlString(`/agents/${agentName}/`);
  return `| where ApiId == ${INFERENCE} or (ApiId == ${HOSTED} and Url contains_cs ${agentPath}) `;
}

/**
 * ApiManagementGatewayLlmLog restricted to model calls that crossed our
 * inference API. The table has no ApiId column (checked with getschema), so it
 * is joined to ApiManagementGatewayLogs on CorrelationId - the same key
 * observability.ts already uses to tie a model call to its gateway row. The
 * gateway side carries ApimSubscriptionId, which the caller may project: it is
 * the real subscription of that row, not a constant.
 *
 * The gateway side's window is padded because the two rows of one call are
 * stamped moments apart.
 */
export function ourLlmLogRows(fromIso: string, toIso: string): string {
  const pad = 10 * 60 * 1000;
  const gwFrom = new Date(new Date(fromIso).getTime() - pad).toISOString();
  const gwTo = new Date(new Date(toIso).getTime() + pad).toISOString();
  return (
    `ApiManagementGatewayLlmLog ` +
    `| where TimeGenerated between (datetime(${fromIso}) .. datetime(${toIso})) ` +
    `| join kind=inner (ApiManagementGatewayLogs ` +
    `| where TimeGenerated between (datetime(${gwFrom}) .. datetime(${gwTo})) ` +
    `| where ApiId == ${INFERENCE} ` +
    `| distinct CorrelationId, ApimSubscriptionId) on CorrelationId `
  );
}
