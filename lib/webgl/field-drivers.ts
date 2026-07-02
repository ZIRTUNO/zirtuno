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
  ox?: number; // form-domain offset (uv units; full-bleed staging)
  oy?: number;
  scale?: number; // form-domain scale (default 1)
};
export type FieldDriver = {
  /** SDF state indices to prefetch; forms[0] gates the first paint. */
  forms: readonly number[];
  /** aspect = buffer width/height; the uv domain spans x ∈ [½−a/2, ½+a/2]. */
  frame: (tMs: number, buf: Float32Array, aspect: number) => FieldFrame;
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

// per-droplet scatter assignment: a dispersed TARGET position, a stagger key
// (irregular departure/arrival order) and two drift frequencies — precomputed
// per form. The dispersed layout must read as FRAGMENTED topology, never as an
// accidental ring/logo silhouette, so: bimodal spread distances (an inner and
// an outer shell), wide angular jitter, and a SOFT radial compression for
// overshooters (a hard clamp would project them all onto one circle — the ring).
type Scatter = { tx: number; ty: number; key: number; f1: number; f2: number };
const SCATTER_SOFT_R = 0.4; // soft-compression starts here (distance from centre)
const SCATTER_HARD_R = 0.47; // absolute cap (keeps every droplet in frame)
const scatterCache = new Map<number, Scatter[]>();
function scatterFor(state: number): Scatter[] {
  let s = scatterCache.get(state);
  if (!s) {
    s = CLOUDS[state].map((b, i) => {
      const ang =
        Math.atan2(b[1] - 0.5, b[0] - 0.5) + (hash(i, 1) - 0.5) * 1.6;
      const d =
        hash(i, 2) < 0.45
          ? 0.13 + 0.13 * hash(i, 5) // inner shell — keeps the interior populated
          : 0.28 + 0.17 * hash(i, 6); // outer shell — the far-flung fragments
      let tx = b[0] + Math.cos(ang) * d;
      let ty = b[1] + Math.sin(ang) * d;
      const cx = tx - 0.5, cy = ty - 0.5;
      const cd = Math.hypot(cx, cy);
      if (cd > SCATTER_SOFT_R) {
        const nd = Math.min(SCATTER_SOFT_R + (cd - SCATTER_SOFT_R) * 0.3, SCATTER_HARD_R);
        tx = 0.5 + (cx / cd) * nd;
        ty = 0.5 + (cy / cd) * nd;
      }
      return {
        tx,
        ty,
        key: hash(i, 7),
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
 * story it tells. progress p: 0 = the exact resting form · 1 = fully dispersed,
 * desaturated, drifting. Drive it 0→1 (fracture), hold it, or run it 1→0 (the
 * converge payoff).
 *
 * The transformation is TEMPORALLY COHERENT — overlapping eased phases on
 * independent channels, so nothing ever swaps (reading p downward = converge):
 *
 *   p 1.00→0.46  droplets loosen and FLOW home, each on its own staggered
 *                schedule (irregular arrivals — the constellation never moves
 *                as one rigid piece); drift stills per droplet as it lands.
 *   p 0.58→0.08  colour blooms back from the muted grey.
 *   p 0.46→0.16  the last droplets land; every droplet swells to its full
 *                cloud radius as it arrives, fusing with its neighbours — the
 *                48-droplet cloud IS the form's footprint, so the merged mass
 *                gradually IMPLIES the unified symbol (the intermediate phase).
 *   p 0.28→0.02  the exact form grows from its skeleton (erosion → 0)
 *                underneath the fused mass, swallowing it.
 *   p 0.16→0.01  droplet radii drain into the now-present form.
 *
 * All channels read a DAMPED progress (≈110 ms exponential), so hard external
 * sets (pin exits, fast scrolls, tween ends) can never render as a snap.
 */
export function makeScatterDriver(
  progress: { current: number },
  state = 0,
): FieldDriver {
  const T = scatterFor(state);
  const base = CLOUDS[state];
  let lastT = -1;
  let dp = -1; // damped progress (initialised to the first raw read)
  return {
    forms: [state],
    frame: (tMs, buf) => {
      const raw = clamp01(progress.current);
      if (dp < 0) dp = raw;
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      dp += (raw - dp) * (1 - Math.exp(-dt / 110));
      const p = clamp01(dp);
      if (p < 0.002) return restFrame(state);

      const t = tMs / 1000;
      // the exact form emerges from its skeleton across p 0.28 → 0.02, i.e.
      // UNDER the fused droplet mass — growth, never a reveal
      const q = 1 - smooth01((p - 0.02) / 0.26); // form presence
      const rEnv = smooth01((p - 0.01) / 0.15); // droplets drain at the very end
      // complementary handoff: droplets shed radius as the form takes over, so
      // the merged mass never over-fills (over-fill floods the mark's channels)
      const shed = 1 - 0.45 * q;
      for (let i = 0; i < N; i++) {
        const b = base[i], s = T[i];
        // staggered travel: droplet i is home below p = 0.16 + 0.30·key and
        // fully dispersed above that +0.5 — irregular, flowing arrivals
        const lt = smooth01((p - (0.16 + 0.3 * s.key)) / 0.5);
        const drift = 0.014 * lt; // drift stills as each droplet lands
        buf[i * 3] =
          b[0] + (s.tx - b[0]) * lt + drift * Math.sin(t * s.f1 + i * 1.7);
        buf[i * 3 + 1] =
          b[1] + (s.ty - b[1]) * lt + drift * Math.cos(t * s.f2 + i * 2.3);
        // fusion swell: full cloud radius at home (neighbours neck together —
        // the blobby ghost of the symbol), leaner while dispersed
        buf[i * 3 + 2] = b[2] * (1 - 0.28 * lt) * rEnv * shed;
      }
      const [fa, ea] = formPresence(q);
      return {
        a: state,
        b: state,
        fa,
        fb: 0,
        ea,
        eb: 0,
        warp: SDF_WARP_REST,
        mute: 0.85 * smooth01((p - 0.08) / 0.5),
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

// ═══════════════════════════════════════════════════════════════════════════════
// FULL-BLEED STAGING (the S3/S4 remake): the liquid is the page, not a box.
// The stage may be any aspect; uv x spans [0.5 − a/2, 0.5 + a/2]. The form can
// sit off-centre (ox) and scaled (scale); droplets roam the whole field.
// ═══════════════════════════════════════════════════════════════════════════════

type WideScatter = { tx: number; ty: number; key: number; f1: number; f2: number };

/** Dispersed targets spread across a full-bleed field around a form placed at
 *  (cx, cy) with the given scale — bimodal shells, wide jitter, soft edge
 *  compression (never a ring, never off-frame). Recomputed when the stage
 *  aspect actually changes. */
function wideScatter(
  state: number,
  aspect: number,
  cx: number,
  cy: number,
  scale: number,
): WideScatter[] {
  const halfW = Math.max(aspect, 0.6) / 2;
  const stretch = Math.min(1 + (aspect - 1) * 0.7, 1.8); // spread wide on wide stages
  return CLOUDS[state].map((b, i) => {
    const hx = cx + (b[0] - 0.5) * scale;
    const hy = cy + (b[1] - 0.5) * scale;
    const ang = Math.atan2(hy - cy, hx - cx) + (hash(i, 1) - 0.5) * 1.6;
    const d =
      (hash(i, 2) < 0.45
        ? 0.13 + 0.13 * hash(i, 5)
        : 0.28 + 0.17 * hash(i, 6)) * Math.max(scale, 0.75);
    let tx = cx + Math.cos(ang) * d * stretch;
    let ty = cy + Math.sin(ang) * d;
    // soft horizontal compression toward the stage edges
    const ex = tx - 0.5;
    const lim = halfW - 0.05;
    if (Math.abs(ex) > lim * 0.82)
      tx = 0.5 + Math.sign(ex) * Math.min(lim * 0.82 + (Math.abs(ex) - lim * 0.82) * 0.35, lim);
    ty = Math.min(Math.max(ty, 0.09), 0.91);
    return {
      tx,
      ty,
      key: hash(i, 7),
      f1: 0.45 + 0.8 * hash(i, 3),
      f2: 0.4 + 0.7 * hash(i, 4),
    };
  });
}

/** The shared converge envelopes (see makeScatterDriver for the phase map). */
function convergeEnvelopes(p: number) {
  const q = 1 - smooth01((p - 0.02) / 0.26); // form presence
  const rEnv = smooth01((p - 0.01) / 0.15); // droplets drain at the very end
  const shed = 1 - 0.45 * q; // complementary mass handoff
  return { q, rEnv, shed };
}

/**
 * S3 remake — the FRACTURE FIELD: a full-viewport liquid layer behind the whole
 * chapter. The mark sits large, right of centre; as the symptoms are read
 * (progress 0 → 1) it breaks apart and its desaturated fragments drift across
 * the entire field, around the copy. Same phase math as the converge — S4
 * begins from exactly this dispersed vocabulary.
 */
export function makeFractureFieldDriver(progress: { current: number }): FieldDriver {
  const state = 0;
  const base = CLOUDS[state];
  const scale = 0.62;
  let lastT = -1;
  let dp = -1;
  let cachedAspect = -1;
  let T: WideScatter[] = [];
  let ox = 0;
  return {
    forms: [state],
    frame: (tMs, buf, aspect) => {
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // form centre ≈ 66% of the stage width (centred on narrow stages)
        ox = Math.min(0.16 * aspect, Math.max(aspect / 2 - 0.28, 0));
        T = wideScatter(state, aspect, 0.5 + ox, 0.5, scale);
      }
      const raw = clamp01(progress.current);
      if (dp < 0) dp = raw;
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      dp += (raw - dp) * (1 - Math.exp(-dt / 110));
      const p = clamp01(dp);
      if (p < 0.002) return { ...restFrame(state), ox, scale };

      const t = tMs / 1000;
      const { q, rEnv, shed } = convergeEnvelopes(p);
      const cx = 0.5 + ox;
      for (let i = 0; i < N; i++) {
        const b = base[i], s = T[i];
        const hx = cx + (b[0] - 0.5) * scale;
        const hy = 0.5 + (b[1] - 0.5) * scale;
        const lt = smooth01((p - (0.16 + 0.3 * s.key)) / 0.5);
        const drift = 0.016 * lt;
        buf[i * 3] = hx + (s.tx - hx) * lt + drift * Math.sin(t * s.f1 + i * 1.7);
        buf[i * 3 + 1] = hy + (s.ty - hy) * lt + drift * Math.cos(t * s.f2 + i * 2.3);
        buf[i * 3 + 2] = b[2] * scale * (1 - 0.28 * lt) * rEnv * shed;
      }
      const [fa, ea] = formPresence(q);
      return {
        a: state,
        b: state,
        fa,
        fb: 0,
        ea,
        eb: 0,
        ox,
        scale,
        warp: SDF_WARP_REST,
        mute: 0.85 * smooth01((p - 0.08) / 0.5),
        count: N,
      };
    },
  };
}

// ── S4 remake — the ORGANISM ──────────────────────────────────────────────────
// The ecosystem diagram is liquid all the way down: fragments converge into a
// breathing organism at the stage centre, then the SAME 48 droplets become
// TENDRILS — bead chains that grow outward toward ten capability labels and
// pulse continuously (droplets travelling outward: the organism feeding its
// capabilities). No SVG spokes, no orbit ring.

/** Irregular orbital layout for the ten capability nodes (order = the i18n
 *  ecosystem.nodes array). ang: degrees, 0 = up, clockwise; r: uv units from
 *  the stage centre. Deliberately NOT a perfect circle. */
export const ECO_NODES: { ang: number; r: number }[] = [
  { ang: -10, r: 0.34 }, // stays clear of the topbar zone
  { ang: 33, r: 0.36 },
  { ang: 69, r: 0.42 },
  { ang: 108, r: 0.37 },
  { ang: 143, r: 0.41 },
  { ang: 193, r: 0.37 }, // off the vertical, clearing the centre label
  { ang: 216, r: 0.42 },
  { ang: 251, r: 0.36 },
  { ang: 288, r: 0.41 },
  { ang: 324, r: 0.38 },
];
const ORGANISM_SCALE = 0.5; // the resolved mark's half-extent ≈ 0.2 uv
const TENDRIL_START = 0.21; // beads emerge just outside the organism's edge
export const ECO_SPREAD_MAX = 1.5; // horizontal orbit stretch cap on wide stages

/** Horizontal orbit stretch for a given stage aspect (shared with the DOM). */
export const ecoSpreadX = (aspect: number) =>
  Math.min(Math.max(aspect * 0.72, 1), ECO_SPREAD_MAX);

/** Node position in uv space (y up), for the given stage aspect. */
export function ecoNodePos(i: number, aspect: number): { x: number; y: number } {
  const n = ECO_NODES[i % ECO_NODES.length];
  const a = ((n.ang - 90) * Math.PI) / 180;
  return {
    x: 0.5 + Math.cos(a) * n.r * ecoSpreadX(aspect),
    y: 0.5 - Math.sin(a) * n.r,
  };
}

/** Per-node growth envelope at tendril progress g (staggered arrivals). */
export const ecoNodeEnv = (g: number, i: number) =>
  smooth01((g - i * 0.055) / 0.32);

/**
 * The organism driver. conv: 1 = dispersed … 0 = resolved (same semantics as
 * the fracture field, damped). grow: 0 → 1 grows the tendrils (damped). The
 * SAME 48 droplets that converge become the tendril beads — 10 chains × (3
 * marching beads + 1 node anchor); the pulse phase is time-driven so the
 * organism keeps feeding its capabilities while the page rests.
 */
export function makeOrganismDriver(
  conv: { current: number },
  grow: { current: number },
): FieldDriver {
  const state = 0;
  const base = CLOUDS[state];
  const scale = ORGANISM_SCALE;
  let lastT = -1;
  let dpC = -1;
  let dpG = -1;
  let cachedAspect = -1;
  let T: WideScatter[] = [];
  return {
    forms: [state],
    frame: (tMs, buf, aspect) => {
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        T = wideScatter(state, aspect, 0.5, 0.5, 1);
      }
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      const rawC = clamp01(conv.current);
      const rawG = clamp01(grow.current);
      if (dpC < 0) dpC = rawC;
      if (dpG < 0) dpG = rawG;
      dpC += (rawC - dpC) * (1 - Math.exp(-dt / 110));
      dpG += (rawG - dpG) * (1 - Math.exp(-dt / 140));
      const p = clamp01(dpC);
      const g = clamp01(dpG);

      const t = tMs / 1000;
      const { q, rEnv, shed } = convergeEnvelopes(p);
      const sx = ecoSpreadX(aspect);
      for (let i = 0; i < N; i++) {
        const b = base[i], s = T[i];
        // converge leg (identical vocabulary to the fracture field)
        const hx = 0.5 + (b[0] - 0.5) * scale;
        const hy = 0.5 + (b[1] - 0.5) * scale;
        const lt = smooth01((p - (0.16 + 0.3 * s.key)) / 0.5);
        const drift = 0.016 * lt;
        let x = hx + (s.tx - hx) * lt + drift * Math.sin(t * s.f1 + i * 1.7);
        let y = hy + (s.ty - hy) * lt + drift * Math.cos(t * s.f2 + i * 2.3);
        let r = b[2] * scale * (1 - 0.28 * lt) * rEnv * shed;
        // tendril leg: droplet i belongs to tendril i%10, bead i/10 (0-3)
        if (i < 40) {
          const nIdx = i % 10;
          const bead = (i / 10) | 0;
          const e = ecoNodeEnv(g, nIdx);
          if (e > 0.001) {
            const node = ECO_NODES[nIdx];
            const a = ((node.ang - 90) * Math.PI) / 180;
            const dirX = Math.cos(a) * sx;
            const dirY = -Math.sin(a);
            let txp: number, typ: number, trp: number;
            if (bead === 3) {
              // the node anchor droplet
              txp = 0.5 + dirX * node.r;
              typ = 0.5 + dirY * node.r;
              trp = 0.012;
            } else {
              // marching beads: emerge at the organism's edge, travel to just
              // short of the node, absorbed — a continuous outward pulse
              const f =
                (bead + (t * 0.3 + nIdx * 0.618) % 1) / 3;
              const fr = Math.min(f, 1);
              const rr = TENDRIL_START + (node.r * 0.9 - TENDRIL_START) * fr;
              txp = 0.5 + dirX * rr;
              typ = 0.5 + dirY * rr;
              trp = 0.0155 * (0.55 + 0.45 * Math.sin(Math.PI * fr));
            }
            x += (txp - x) * e;
            y += (typ - y) * e;
            r = r * (1 - e) + trp * e;
          }
        }
        buf[i * 3] = x;
        buf[i * 3 + 1] = y;
        buf[i * 3 + 2] = r;
      }
      const [fa, ea] = formPresence(q);
      return {
        a: state,
        b: state,
        fa,
        fb: 0,
        ea,
        eb: 0,
        scale,
        warp: SDF_WARP_REST,
        mute: 0.85 * smooth01((p - 0.08) / 0.5),
        count: N,
      };
    },
  };
}
