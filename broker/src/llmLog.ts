/**
 * Shared parsing for `ApiManagementGatewayLlmLog` rows, used by both
 * routes/auditRecord.ts and routes/observability.ts.
 *
 * Two shapes have to be handled, both observed in this deployment:
 *
 *  - `RequestMessages` is a JSON **array** of messages; `ResponseMessages` is a
 *    single JSON **object**.
 *  - A message's `content` is sometimes a plain string and sometimes an array
 *    of typed parts (`[{text, type}]`). `pydantic-agent` produces the former,
 *    `strands-agent` the latter — the Responses protocol permits both.
 */

export const NOT_CAPTURED_PROMPT = "(not captured)";
export const NOT_CAPTURED_COMPLETION = "(not captured at the gateway for this request)";

interface LoggedMessage {
  role?: string;
  content?: unknown;
}

/** Flattens a message's `content` to text, whatever shape it arrived in. */
export function contentToText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const text = (part as { text?: unknown }).text;
          if (typeof text === "string") return text;
        }
        return "";
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

function parseMessages(raw: string | null): LoggedMessage[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as LoggedMessage[];
    if (parsed && typeof parsed === "object") return [parsed as LoggedMessage];
    return null;
  } catch {
    return null;
  }
}

export function extractLastUserMessage(raw: string | null): string {
  const messages = parseMessages(raw);
  if (!messages) return NOT_CAPTURED_PROMPT;
  // The array also carries the agent's own system prompt; the user turn is the
  // one the audit story is about.
  const last = [...messages].reverse().find((m) => m.role === "user");
  return contentToText(last?.content) ?? NOT_CAPTURED_PROMPT;
}

export function extractCompletion(raw: string | null): string {
  const messages = parseMessages(raw);
  if (!messages) return NOT_CAPTURED_COMPLETION;
  const last = messages[messages.length - 1];
  return contentToText(last?.content) ?? NOT_CAPTURED_COMPLETION;
}

/** True when a field holds real logged content rather than a placeholder. */
export function isCaptured(value: string | undefined): boolean {
  return (
    value !== undefined && value !== NOT_CAPTURED_PROMPT && value !== NOT_CAPTURED_COMPLETION
  );
}

/**
 * Recovers the presenter's actual question from a prompt the broker augmented
 * with demo knowledge (demoKnowledge.ts). Returns null when there is no
 * injected preamble, in which case the logged prompt already *is* the question.
 */
export function extractQuestion(loggedPrompt: string): string | null {
  const marker = "\n\nQuestion: ";
  const index = loggedPrompt.lastIndexOf(marker);
  if (index === -1) return null;
  return loggedPrompt.slice(index + marker.length).trim();
}
