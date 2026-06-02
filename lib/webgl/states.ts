// Metaball state registry (S2.3). The RESTING / "unified" state is the real
// Zirtuno mark, baked into an SDF texture from public/brand/zirtuno-logo-mark.svg
// at runtime (see trace-logo.ts). Shared by the hero (S2.3), the Services morph
// base (S5), the Ecosystem core (S4), and S8 Beat 2 (the mark forming).

import { traceLogoSDF, type SdfResult } from "./trace-logo";

/** Shared tunables. `breath` = breathing scale amplitude (fraction, ~8s period). */
export const FIELD = {
  breath: 0.02,
} as const;

let restingPromise: Promise<SdfResult> | null = null;

/** The mark's SDF, computed once and reused everywhere. */
export function getRestingState(): Promise<SdfResult> {
  if (!restingPromise) {
    restingPromise = traceLogoSDF({ size: 512, fit: 0.82 });
  }
  return restingPromise;
}

// TODO(phase2): the 7 service-pillar states + morph land here AFTER the resting
// screenshot is approved — as SDF blends / procedural fields the resting mark
// can interpolate toward, plus hover physics + keyboard nav. Not before sign-off.
