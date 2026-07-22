/**
 * Field driver KERNEL (R5-A): the shared vocabulary of the one liquid.
 *
 * Every chapter visual is the SAME unified liquid field (sdf-glass-shader) —
 * since R5, ONE conductor-driven canvas for the whole page (lib/webgl/
 * conductor.mjs + lib/webgl/scenes/* + components/field/PageStage). What
 * lives here is the kernel every scene and harness shares:
 *
 *   - the §3.3 melt implementation (packBridge + matchClouds/permFor +
 *     bridgeRadiusEnvelope + formPresence/formPhase) — the hero QA stills
 *     (FieldMorphHero) and the scenes import it, so the melt has exactly ONE
 *     implementation;
 *   - the FieldFrame/FieldDriver contract consumed by FieldStage;
 *   - makeLoneDropDriver — the 404's lone dispersed droplet (the one visual
 *     that is genuinely its own page, not a scene of the homepage conductor).
 *
 * The pure physics/droplet tables (CLOUDS, PHYS, TAUP, scatter/orbital
 * vocabulary) live in phys.mjs (node-runnable) and are re-exported here so
 * browser-side imports stay stable.
 */

import { SDF_WARP_REST, SDF_MELT_ERODE } from "./sdf-glass-shader.mjs";
import { EASE_POINTS } from "../animation/easings";

// ── the pure kernel (R5-A): the canonical clouds, the ONE physics table, the
// per-droplet identity tables and the scatter/orbital target vocabulary live
// in phys.mjs (node-runnable — the conductor and the sim harnesses import it
// without a TS toolchain). Re-exported here so every existing browser-side
// import keeps working unchanged. ─────────────────────────────────────────────
import { CLOUDS, N, STAG, clamp01, smooth01, PHYS } from "./phys.mjs";
import type { Ball } from "./phys.mjs";

export { CLOUDS, N, STAG, clamp01, smooth01, PHYS };
export type { Ball };

// ── §3.3 melt constants (single source — hero + services scrub) ───────────────
export const STAGGER = 0.25; // fraction of the timeline sweeping left → right
export const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position
export const BRIDGE = 0.38; // p-window where a form hands off to / from droplets

/** Standard cubic-bezier easing evaluator (Newton + bisection fallback). */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x,
    bx = 3 * (p2x - p1x) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * p1y,
    by = 3 * (p2y - p1y) - cy,
    ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const DX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) return Y(t);
      const d = DX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0,
      hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      t = (lo + hi) / 2;
      if (X(t) < x) lo = t;
      else hi = t;
    }
    return Y(t);
  };
}
export const arrive = cubicBezier(
  ...(EASE_POINTS.arrive as readonly number[] as [
    number,
    number,
    number,
    number,
  ]),
);

export function bridgeRadiusEnvelope(p: number): number {
  const rPad = BRIDGE * 0.35;
  const rWin = BRIDGE * 0.55;
  return (
    smooth01((p - rPad) / rWin) * (1 - smooth01((p - (1 - rPad - rWin)) / rWin))
  );
}

/** Min-travel droplet matching (§3.2): greedy nearest-neighbour, O(N² log N). */
export function matchClouds(A: Ball[], B: Ball[]): number[] {
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const dx = A[i][0] - B[j][0],
        dy = A[i][1] - B[j][1];
      pairs.push([dx * dx + dy * dy, i, j]);
    }
  pairs.sort((a, b) => a[0] - b[0]);
  const perm = new Array<number>(N).fill(-1);
  const used = new Uint8Array(N);
  let done = 0;
  for (const [, i, j] of pairs) {
    if (perm[i] >= 0 || used[j]) continue;
    perm[i] = j;
    used[j] = 1;
    if (++done === N) break;
  }
  return perm;
}

// rest→rest droplet correspondences are stable → cached for the session (§3.2)
const permCache = new Map<string, number[]>();
export function permFor(a: number, b: number): number[] {
  const key = `${a}->${b}`;
  let p = permCache.get(key);
  if (!p) {
    p = matchClouds(CLOUDS[a], CLOUDS[b]);
    permCache.set(key, p);
  }
  return p;
}

/** §3.3 bridge frame: write the melt droplets at progress p into `buf` from
 *  `offset` (positions stagger-eased, radius leads, envelope grows/shrinks the
 *  droplets inside the BRIDGE handoff windows). Returns the new ball count. */
export function packBridge(
  buf: Float32Array,
  offset: number,
  A: Ball[],
  B: Ball[],
  perm: number[],
  stag: number[],
  p: number,
): number {
  // Keep droplets out of fully solid forms: they take over after the source
  // has started dissolving and drain before the target is already solid.
  const rEnv = bridgeRadiusEnvelope(p);
  for (let i = 0; i < N; i++) {
    const lt = clamp01(p * (1 + STAGGER) - STAGGER * stag[i]);
    const tp = arrive(lt);
    const tr = arrive(clamp01(lt * RADIUS_LEAD));
    const a = A[i],
      b = B[perm[i]];
    const j = (offset + i) * 3;
    buf[j] = a[0] + (b[0] - a[0]) * tp;
    buf[j + 1] = a[1] + (b[1] - a[1]) * tp;
    buf[j + 2] = (a[2] + (b[2] - a[2]) * tr) * rEnv;
  }
  return offset + N;
}

/**
 * Form PRESENCE q ∈ [0,1] → [field weight, erosion offset]. The transformation
 * must feel organic, never a pop: EROSION does the visible work — it moves the
 * form's boundary continuously (thin features dissolve first on the way out;
 * the skeleton emerges first and grows to the exact silhouette on the way in).
 * The weight only drains the residual field tail near q = 0, where the form is
 * already visually gone.
 */
export const formPresence = (q: number): [number, number] => [
  smooth01(Math.min(q * 2.5, 1)),
  (1 - q) * SDF_MELT_ERODE,
];

/** Both forms' [weight, erosion] across a melt (A hands off, B lands). */
export function formPhase(p: number): {
  wA: number;
  eA: number;
  wB: number;
  eB: number;
} {
  const [wA, eA] = formPresence(1 - smooth01(p / BRIDGE));
  const [wB, eB] = formPresence(smooth01((p - (1 - BRIDGE)) / BRIDGE));
  return { wA, eA, wB, eB };
}

// ── the driver contract (consumed by components/field/FieldStage) ─────────────
export type FieldFrame = {
  a: number; // form A state index (must be loaded before drawing)
  b: number; // form B state index
  fa: number; // form A field weight
  fb: number; // form B field weight
  ea: number; // form A erosion offset (0 = exact)
  eb: number; // form B erosion offset
  warp: number;
  mute: number; // 0 = brand cyan … 1 = desaturated (S3)
  count: number; // balls the driver packed into the buffer
  ox?: number; // form-domain offset (uv units; full-bleed staging)
  oy?: number;
  scale?: number; // form-domain scale (default 1)
  expo?: number; // R5-C score-driven exposure DELTA (0 = neutral)
  key?: number; // R5-C score-driven key-light boost (0 = neutral)
  energy?: number; // R5-C cadence-governor energy (absent = always active)
};
export type FieldDriver = {
  /** SDF state indices to prefetch; forms[0] gates the first paint. */
  forms: readonly number[];
  /** Called by the stage as each form's SDF texture becomes drawable — drivers
   *  that retarget between forms (the hero autocycle) gate on this. */
  formReady?: (s: number) => void;
  /** aspect = buffer width/height; the uv domain spans x ∈ [½−a/2, ½+a/2].
   *  zBuf (R5-C, optional): parallel per-ball depth (0 near … 1 far) the stage
   *  uploads as iBallZ — drivers that stage depth write every packed slot. */
  frame: (
    tMs: number,
    buf: Float32Array,
    aspect: number,
    zBuf?: Float32Array,
    /** Optional packed identity channel for velocity-aware review renderers.
     *  Canonical droplets use stable non-negative ids; transient families use
     *  -1 and therefore stay circular. */
    idBuf?: Int16Array,
  ) => FieldFrame;
};

/** Callbacks the site scene surfaces to the shell. */
export type SiteCallbacks = {
  /** Hero active state for the pillar indicator / aria: -1 = mark, 0-6. */
  onHeroActive?: (i: number) => void;
};

/**
 * 404 — the lone, dispersed droplet: one droplet that stayed, wandering
 * slowly, and two fragments drifting at the edge of its reach — almost gone.
 * "This page has dispersed." Pure droplets (no form), the same liquid.
 */
export function makeLoneDropDriver(): FieldDriver {
  return {
    forms: [0],
    frame: (tMs, buf) => {
      const t = tMs / 1000;
      // the one that stayed
      buf[0] = 0.5 + 0.045 * Math.sin(t * 0.21) + 0.018 * Math.sin(t * 0.53);
      buf[1] = 0.48 + 0.045 * Math.cos(t * 0.17) + 0.018 * Math.sin(t * 0.61);
      buf[2] = 0.16 + 0.008 * Math.sin(t * 0.6);
      // the two that dispersed — drifting away, barely holding on
      buf[3] = 0.2 + 0.05 * Math.sin(t * 0.13 + 2);
      buf[4] = 0.74 + 0.04 * Math.cos(t * 0.19 + 1);
      buf[5] = 0.042 + 0.005 * Math.sin(t * 0.7 + 3);
      buf[6] = 0.8 + 0.05 * Math.sin(t * 0.11 + 4);
      buf[7] = 0.3 + 0.045 * Math.cos(t * 0.23 + 5);
      buf[8] = 0.055 + 0.006 * Math.cos(t * 0.9);
      return {
        a: 0,
        b: 0,
        fa: 0,
        fb: 0,
        ea: 0,
        eb: 0,
        warp: SDF_WARP_REST,
        mute: 0,
        count: 3,
      };
    },
  };
}
