/**
 * Field DRIVERS (improvement-plan R1 / morph-spec §6): every chapter visual is
 * the SAME unified liquid field (sdf-glass-shader) — only the driver differs.
 * A driver is pure data: per rAF it packs droplets into the shared ball buffer
 * and returns the frame's form weights / warp / mute. The canvas component
 * (components/field/FieldStage) owns GL; the hero (FieldMorphHero) shares the
 * §3.3 bridge math below so the melt has exactly ONE implementation.
 *
 *   - scatter  (S3): the exact mark granulates into desaturated drifting
 *     droplets — progress 0 = the resting form, 1 = fully dispersed.
 *   - converge (S4 pin-scrub · S8 timed): the SAME driver run backwards —
 *     droplets fly home, colour blooms back, the exact mark re-forms.
 *   - scrub-morph (S5): a §3.3 bridge frame at scroll-locked progress —
 *     pillar→pillar melts in lockstep with the copy.
 *   - impulse  (S10): the exhale — droplets burst off the resting mark and
 *     sink back (additive; the labeled submit stays canonical).
 */

import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
} from "./sdf-glass-shader.mjs";
import { ALL_RAW, ISO_LEVEL } from "./symbols.data.mjs";
import { EASE_POINTS } from "../animation/easings";

// ── the canonical droplet clouds (morph endpoints), in shader uv space ────────
// symbols.data.mjs is symbol space [-0.5,0.5] (+y up), radius = field units at
// ISO_LEVEL → uv = sym + 0.5, visible radius = r/√iso.
export type Ball = readonly [number, number, number];
const VR = 1 / Math.sqrt(ISO_LEVEL);
export const CLOUDS: Ball[][] = ALL_RAW.map((s: { balls: number[][] }) =>
  s.balls.map(([x, y, r]) => [x + 0.5, y + 0.5, r * VR] as const),
);
export const N = CLOUDS[0].length; // canonical droplet budget (48)
// §3.3 stagger key: the droplet's x in the source form (left → right sweep)
export const STAG: number[][] = CLOUDS.map((c) => c.map((b) => b[0]));

// ── §3.3 melt constants (single source — hero + services scrub) ───────────────
export const STAGGER = 0.25; // fraction of the timeline sweeping left → right
export const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position
export const BRIDGE = 0.38; // p-window where a form hands off to / from droplets

// ── small math helpers ─────────────────────────────────────────────────────────
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Standard cubic-bezier easing evaluator (Newton + bisection fallback). */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
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
    let lo = 0, hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      t = (lo + hi) / 2;
      if (X(t) < x) lo = t; else hi = t;
    }
    return Y(t);
  };
}
export const arrive = cubicBezier(
  ...(EASE_POINTS.arrive as readonly number[] as [number, number, number, number]),
);

/** Min-travel droplet matching (§3.2): greedy nearest-neighbour, O(N² log N). */
export function matchClouds(A: Ball[], B: Ball[]): number[] {
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const dx = A[i][0] - B[j][0], dy = A[i][1] - B[j][1];
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
  // droplets grow ahead of the form's erosion (and shrink after the landing
  // form has begun re-growing), so the liquid never loses body at a handoff
  const R_WIN = BRIDGE * 0.65;
  const rEnv =
    smooth01(p / R_WIN) * (1 - smooth01((p - (1 - R_WIN)) / R_WIN));
  for (let i = 0; i < N; i++) {
    const lt = clamp01(p * (1 + STAGGER) - STAGGER * stag[i]);
    const tp = arrive(lt);
    const tr = arrive(clamp01(lt * RADIUS_LEAD));
    const a = A[i], b = B[perm[i]];
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
export function formPhase(
  p: number,
): { wA: number; eA: number; wB: number; eB: number } {
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
};
export type FieldDriver = {
  /** SDF state indices to prefetch; forms[0] gates the first paint. */
  forms: readonly number[];
  frame: (tMs: number, buf: Float32Array) => FieldFrame;
};

const restFrame = (s: number): FieldFrame => ({
  a: s,
  b: s,
  fa: 1,
  fb: 0,
  ea: 0,
  eb: 0,
  warp: SDF_WARP_REST,
  mute: 0,
  count: 0,
});

// deterministic per-droplet hash (stable across mounts and sessions)
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// per-droplet scatter assignment: a dispersed TARGET position (outward from the
// form with tangential jitter, capped inside the stage so the broken field
// stays composed) and two drift frequencies — precomputed per form.
type Scatter = { tx: number; ty: number; f1: number; f2: number };
const SCATTER_MAX_R = 0.42; // max distance from stage centre (keeps ~all in frame)
const scatterCache = new Map<number, Scatter[]>();
function scatterFor(state: number): Scatter[] {
  let s = scatterCache.get(state);
  if (!s) {
    s = CLOUDS[state].map((b, i) => {
      const ang =
        Math.atan2(b[1] - 0.5, b[0] - 0.5) + (hash(i, 1) - 0.5) * 1.1;
      const d = 0.16 + 0.3 * hash(i, 2);
      let tx = b[0] + Math.cos(ang) * d;
      let ty = b[1] + Math.sin(ang) * d;
      const cx = tx - 0.5, cy = ty - 0.5;
      const cd = Math.hypot(cx, cy);
      if (cd > SCATTER_MAX_R) {
        tx = 0.5 + (cx / cd) * SCATTER_MAX_R;
        ty = 0.5 + (cy / cd) * SCATTER_MAX_R;
      }
      return {
        tx,
        ty,
        f1: 0.45 + 0.8 * hash(i, 3),
        f2: 0.4 + 0.7 * hash(i, 4),
      };
    });
    scatterCache.set(state, s);
  }
  return s;
}

/**
 * S3 scatter / S4·S8 converge — ONE driver; the progress ref decides which
 * story it tells. progress 0 = the exact resting form · 1 = fully dispersed,
 * desaturated, slowly drifting. Drive it 0→1 (fracture), hold it (S3's broken
 * state), or run it 1→0 (the converge payoff — colour blooms back and the
 * droplets fuse into the exact mark).
 */
export function makeScatterDriver(
  progress: { current: number },
  state = 0,
): FieldDriver {
  const T = scatterFor(state);
  const base = CLOUDS[state];
  return {
    forms: [state],
    frame: (tMs, buf) => {
      const p = clamp01(progress.current);
      const env = smooth01(p / BRIDGE); // droplets condense as the form dissolves
      if (env <= 0) return restFrame(state);
      const t = tMs / 1000;
      for (let i = 0; i < N; i++) {
        const b = base[i], s = T[i];
        buf[i * 3] = b[0] + (s.tx - b[0]) * p + 0.012 * Math.sin(t * s.f1 + i * 1.7) * p;
        buf[i * 3 + 1] = b[1] + (s.ty - b[1]) * p + 0.012 * Math.cos(t * s.f2 + i * 2.3) * p;
        buf[i * 3 + 2] = b[2] * (1 - 0.25 * p) * env;
      }
      // organic dissolve/emerge: the form ERODES from its thin edges as the
      // droplets condense (and re-grows from its skeleton on the converge)
      const [fa, ea] = formPresence(1 - env);
      return {
        a: state,
        b: state,
        fa,
        fb: 0,
        ea,
        eb: 0,
        warp: SDF_WARP_REST,
        mute: 0.85 * smooth01(p),
        count: N,
      };
    },
  };
}

/**
 * S5 scrub-morph: a deterministic §3.3 bridge frame at scroll-locked progress.
 * pair = [fromState, toState, m] — melts pillar→pillar in lockstep with the
 * copy (m 0 = rest on `from`, 1 = rest on `to`).
 */
export function makeScrubMorphDriver(pair: {
  current: readonly [number, number, number];
}): FieldDriver {
  return {
    forms: [1, 2, 3, 4, 5, 6, 7],
    frame: (tMs, buf) => {
      const [a, b, mRaw] = pair.current;
      const m = clamp01(mRaw);
      if (a === b || m <= 0) return restFrame(a);
      if (m >= 1) return restFrame(b);
      const count = packBridge(buf, 0, CLOUDS[a], CLOUDS[b], permFor(a, b), STAG[a], m);
      const { wA, eA, wB, eB } = formPhase(m);
      const env = Math.sin(Math.PI * m);
      return {
        a,
        b,
        fa: wA,
        fb: wB,
        ea: eA,
        eb: eB,
        warp: SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env,
        mute: 0,
        count,
      };
    },
  };
}

/**
 * S10 impulse — the exhale: a one-shot pulse where droplets burst off the
 * resting form and sink back in (~durMs). Additive decoration only; the form
 * itself never breaks (the labeled submit is the canonical action).
 */
export function makeImpulseDriver(
  state = 0,
  durMs = 1500,
): { driver: FieldDriver; trigger: () => void } {
  const T = scatterFor(state);
  const base = CLOUDS[state];
  let t0 = -1;
  return {
    trigger: () => {
      t0 = performance.now();
    },
    driver: {
      forms: [state],
      frame: (tMs, buf) => {
        if (t0 < 0) return restFrame(state);
        const p = (tMs - t0) / durMs;
        if (p >= 1) {
          t0 = -1;
          return restFrame(state);
        }
        const e = Math.sin(Math.PI * clamp01(p));
        for (let i = 0; i < N; i++) {
          const b = base[i], s = T[i];
          buf[i * 3] = b[0] + (s.tx - b[0]) * 0.6 * e;
          buf[i * 3 + 1] = b[1] + (s.ty - b[1]) * 0.6 * e;
          buf[i * 3 + 2] = b[2] * 0.7 * e;
        }
        return {
          a: state,
          b: state,
          fa: 1,
          fb: 0,
          ea: 0,
          eb: 0,
          warp: SDF_WARP_REST + 0.004 * e,
          mute: 0,
          count: N,
        };
      },
    },
  };
}
