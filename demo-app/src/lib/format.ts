/**
 * Formats an ISO datetime string for display, or `undefined` if the value is
 * absent or unparsable — callers render their own "unavailable" fallback for
 * that case (see `FactList`) rather than this returning a placeholder string.
 */
export function formatTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString();
}
