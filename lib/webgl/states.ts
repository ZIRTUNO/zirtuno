// Metaball state registry (S2.3). State 0 is the resting Zirtuno mark, baked into
// an SDF texture from public/brand/zirtuno-logo-mark.svg at runtime (see
// trace-logo.ts). States 1–7 are the seven service pillars. Shared by the hero
// (S2.3), the Services morph (S5), the Ecosystem core (S4), and S8 Beat 2.

import { traceLogoSDF, type SdfResult } from "./trace-logo";

/** Shared tunables. `breath` = breathing scale amplitude (fraction, ~8s period). */
export const FIELD = {
  breath: 0.02,
} as const;

/**
 * The ordered state set the metaball morphs through. The GEOMETRY of each state
 * is GLSL (it lives in MetaballScene's `sdfForState`, indexed by position here),
 * but the order, indices, count, and identity are defined ONCE here so every
 * surface (hero auto-cycle, Services per-pillar morph, keyboard nav, indicator)
 * agrees on what state N is. Index 0 = the mark; 1–7 = the pillars, in the same
 * order as the Services chapter (lib/content/services).
 */
export const METABALL_STATES = [
  { key: "mark", label: "Mark" },
  { key: "web", label: "Web Design" },
  { key: "software", label: "Software" },
  { key: "ai", label: "AI" },
  { key: "automation", label: "Automation" },
  { key: "data", label: "Data" },
  { key: "branding", label: "Branding" },
  { key: "marketing", label: "Marketing" },
] as const;

export type MetaballStateKey = (typeof METABALL_STATES)[number]["key"];

/** Total states (0 = mark, 1–7 = the service pillars). */
export const STATE_COUNT = METABALL_STATES.length;

/** Index of the AI pillar — the hero's default second form (stateB). */
export const AI_STATE = METABALL_STATES.findIndex((s) => s.key === "ai");

let restingPromise: Promise<SdfResult> | null = null;

/** The mark's SDF, computed once and reused everywhere. */
export function getRestingState(): Promise<SdfResult> {
  if (!restingPromise) {
    restingPromise = traceLogoSDF({ size: 512, fit: 0.82 });
  }
  return restingPromise;
}
