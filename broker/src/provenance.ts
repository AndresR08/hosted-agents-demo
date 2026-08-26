/** Mirrors the frontend's Provenance shape (demo-app/src/services/contracts.ts) — kept as a small duplicate rather than a shared package for two services this size. */
export type ProvenanceBand = "live" | "live-delayed" | "replay" | "illustrative";

export interface Provenance {
  band: ProvenanceBand;
  asOf?: string;
  ageSeconds?: number;
  capturedAt?: string;
}

export function liveNow(): Provenance {
  return { band: "live", asOf: new Date().toISOString() };
}

export function delayed(ageSeconds: number): Provenance {
  return { band: "live-delayed", ageSeconds };
}
