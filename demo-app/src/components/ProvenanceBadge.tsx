import type { Provenance } from "@/services/contracts";
import { cn } from "@/lib/cn";

const GLYPH: Record<Provenance["band"], string> = {
  live: "●",
  "live-delayed": "◐",
  replay: "◑",
  illustrative: "○",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAge(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes <= 0 ? "just now" : `delayed ${minutes}m`;
}

function label(provenance: Provenance): string {
  switch (provenance.band) {
    case "live":
      return provenance.asOf ? `Live · ${formatTime(provenance.asOf)}` : "Live";
    case "live-delayed":
      return `Live · ${provenance.ageSeconds != null ? formatAge(provenance.ageSeconds) : "delayed"}`;
    case "replay":
      return provenance.capturedAt
        ? `Replay · ${provenance.capturedAt}`
        : "Replay";
    case "illustrative":
      return "Illustrative";
  }
}

/**
 * DESIGN_DECISIONS.md — every data-bearing component carries exactly one of
 * these. No unlabelled number is permitted anywhere in this application;
 * this component exists so that rule cannot be silently skipped.
 */
export function ProvenanceBadge({ provenance, className }: { provenance: Provenance; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-caption font-medium tracking-[0.02em] text-ink-muted",
        className,
      )}
    >
      <span aria-hidden="true">{GLYPH[provenance.band]}</span>
      {label(provenance)}
    </span>
  );
}
