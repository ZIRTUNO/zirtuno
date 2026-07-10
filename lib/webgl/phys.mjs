/**
 * The PURE physics / droplet-vocabulary kernel (R5-A). Everything the liquid
 * shares across scenes lives here: the canonical droplet clouds, the ONE
 * physics table (PHYS), the per-droplet identity tables (VARY, TAUP), the
 * ambient lava-lamp family (AMB), the scatter/cluster target generators and
 * the ecosystem orbital layout. Extracted from field-drivers.ts so the
 * conductor core and the node sim harnesses (scripts/verify-conductor.mjs)
 * can import it without a TS toolchain — the same .mjs convention as
 * sdf-core.mjs / sdf-glass-shader.mjs. field-drivers.ts re-exports the
 * public pieces, so browser-side imports are unchanged.
 *
 * PURITY CONTRACT: no DOM, no timers, no side effects beyond module-load
 * derivation from symbols.data.mjs. Deterministic (hash-seeded) everywhere.
 */

import { ALL_RAW, ISO_LEVEL } from "./symbols.data.mjs";

// ── the canonical droplet clouds (morph endpoints), in shader uv space ────────
// symbols.data.mjs is symbol space [-0.5,0.5] (+y up), radius = field units at
// ISO_LEVEL → uv = sym + 0.5, visible radius = r/√iso.
const VR = 1 / Math.sqrt(ISO_LEVEL);
export const CLOUDS = ALL_RAW.map((s) =>
  s.balls.map(([x, y, r]) => [x + 0.5, y + 0.5, r * VR]),
);
export const N = CLOUDS[0].length; // canonical droplet budget (48)
export const STATE_COUNT = CLOUDS.length; // 0 = mark, 1-7 = the pillar forms
// §3.3 stagger key: the droplet's x in the source form (left → right sweep)
export const STAG = CLOUDS.map((c) => c.map((b) => b[0]));

// ── small math helpers ─────────────────────────────────────────────────────────
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth01 = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// deterministic per-droplet hash (stable across mounts and sessions)
export const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── the ONE physics table — every regime reads these, so the liquid keeps a
// single physical identity across the whole site ──────────────────────────────
export const PHYS = {
  TAU_CHANNEL: 110, // scroll-channel smoothing (ms)
  TAU_DROP_MIN: 90, // per-droplet positional inertia (ms) — the light droplets
  TAU_DROP_MAX: 260, // … the heavy ones lag behind (the field stretches)
  TAU_RADIUS: 120, // per-droplet radius smoothing (ms) — no radius pops
  TAU_VEL: 240, // scroll-velocity smoothing (ms)
  DRIFT: 0.016, // loose-droplet wander amplitude (uv)
  STIR: 0.035, // scroll velocity (vh/s) → vertical drag on loose liquid (uv)
  AMBIENT_N: 12, // lava-lamp droplets across the full bleed
  AMBIENT_R: 0.014, // ambient radius floor (uv) — the same droplet family
  AMBIENT_R_VAR: 0.024,
  AMBIENT_Z: 0.62, // ambient depth band (R5-C) — the atmosphere sits behind
};

// per-ball organic radius variety — loose fragments must not read as equal dots
export const VARY = CLOUDS[0].map((_, i) => 0.7 + 0.8 * hash(i, 9));

// per-droplet positional inertia: heavier (bigger) droplets lag more, plus a
// per-droplet spread so the field never moves as one rigid piece
export const TAUP = (() => {
  let rMin = 1,
    rMax = 0;
  for (const b of CLOUDS[0]) {
    rMin = Math.min(rMin, b[2]);
    rMax = Math.max(rMax, b[2]);
  }
  return CLOUDS[0].map((b, i) => {
    const mass = (b[2] - rMin) / Math.max(rMax - rMin, 1e-4);
    return (
      PHYS.TAU_DROP_MIN +
      (PHYS.TAU_DROP_MAX - PHYS.TAU_DROP_MIN) *
        (0.65 * mass + 0.35 * hash(i, 21))
    );
  });
})();

// ambient lava-lamp droplets: normalised anchors (fx spans the bleed at frame
// time — continuous in aspect, so resizes never jump), slow buoyant loops
export const AMB = Array.from({ length: PHYS.AMBIENT_N }, (_, k) => ({
  fx: 0.06 + 0.88 * hash(k, 31),
  ay: 0.1 + 0.8 * hash(k, 32),
  r: PHYS.AMBIENT_R + PHYS.AMBIENT_R_VAR * hash(k, 33),
  f1: 0.05 + 0.08 * hash(k, 34), // x wander (rad/s) — minutes-slow
  f2: 0.06 + 0.1 * hash(k, 35), // y buoyant loop
  f3: 0.11 + 0.13 * hash(k, 36), // y second octave
  f4: 0.14 + 0.2 * hash(k, 37), // radius breath
  p1: hash(k, 38) * Math.PI * 2,
  p2: hash(k, 39) * Math.PI * 2,
  p3: hash(k, 40) * Math.PI * 2,
  stir: 0.5 + 0.8 * hash(k, 41),
}));

// ── dispersed / cluster target generators (the scatter vocabulary) ────────────
// per-droplet scatter assignment: a dispersed TARGET position, a stagger key
// (irregular departure/arrival order) and two drift frequencies — precomputed
// per form. The dispersed layout must read as FRAGMENTED topology, never as an
// accidental ring/logo silhouette, so: bimodal spread distances (an inner and
// an outer shell), wide angular jitter, and a SOFT radial compression for
// overshooters (a hard clamp would project them all onto one circle — the ring).
const SCATTER_SOFT_R = 0.4; // soft-compression starts here (distance from centre)
const SCATTER_HARD_R = 0.47; // absolute cap (keeps every droplet in frame)
const scatterCache = new Map();
export function scatterFor(state) {
  let s = scatterCache.get(state);
  if (!s) {
    s = CLOUDS[state].map((b, i) => {
      const ang = Math.atan2(b[1] - 0.5, b[0] - 0.5) + (hash(i, 1) - 0.5) * 1.6;
      const d =
        hash(i, 2) < 0.45
          ? 0.13 + 0.13 * hash(i, 5) // inner shell — keeps the interior populated
          : 0.28 + 0.17 * hash(i, 6); // outer shell — the far-flung fragments
      let tx = b[0] + Math.cos(ang) * d;
      let ty = b[1] + Math.sin(ang) * d;
      const cx = tx - 0.5,
        cy = ty - 0.5;
      const cd = Math.hypot(cx, cy);
      if (cd > SCATTER_SOFT_R) {
        const nd = Math.min(
          SCATTER_SOFT_R + (cd - SCATTER_SOFT_R) * 0.3,
          SCATTER_HARD_R,
        );
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

/** Dispersed targets spread across a full-bleed field around (cx, cy) —
 *  bimodal shells, wide jitter, soft edge compression (never a ring, never
 *  off-frame). Recomputed when the stage aspect actually changes. */
export function wideScatter(aspect, cx, cy, spread) {
  const halfW = Math.max(aspect, 0.6) / 2;
  const stretch = Math.min(1 + (aspect - 1) * 0.7, 1.8);
  return CLOUDS[0].map((b, i) => {
    const hx = cx + (b[0] - 0.5) * 0.5;
    const hy = cy + (b[1] - 0.5) * 0.5;
    const ang = Math.atan2(hy - cy, hx - cx) + (hash(i, 1) - 0.5) * 1.6;
    const d =
      (hash(i, 2) < 0.45
        ? 0.13 + 0.13 * hash(i, 5)
        : 0.28 + 0.17 * hash(i, 6)) * spread;
    let tx = cx + Math.cos(ang) * d * stretch;
    let ty = cy + Math.sin(ang) * d;
    const ex = tx - 0.5;
    const lim = halfW - 0.05;
    if (Math.abs(ex) > lim * 0.82)
      tx =
        0.5 +
        Math.sign(ex) *
          Math.min(lim * 0.82 + (Math.abs(ex) - lim * 0.82) * 0.35, lim);
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

/** Loose unstable CLUSTERS — the broken state's entry composition. Chunks of
 *  liquid with irregular spacing, deliberately unrelated to the logo
 *  silhouette (the whole mark belongs to the hero, never to The Problem). */
export function clusterTargets(aspect, cx) {
  const anchors = [
    { x: cx + 0.1, y: 0.6 },
    { x: cx - 0.13, y: 0.42 },
    { x: cx + 0.19, y: 0.3 },
    { x: cx - 0.03, y: 0.74 },
  ];
  const halfW = Math.max(aspect, 0.6) / 2;
  return CLOUDS[0].map((_, i) => {
    const a =
      anchors[Math.min((hash(i, 11) * anchors.length) | 0, anchors.length - 1)];
    const ang = hash(i, 12) * Math.PI * 2;
    const d = 0.02 + 0.1 * hash(i, 13);
    let tx = a.x + Math.cos(ang) * d;
    const ty = Math.min(Math.max(a.y + Math.sin(ang) * d, 0.1), 0.9);
    tx = Math.min(Math.max(tx, 0.5 - halfW + 0.06), 0.5 + halfW - 0.06);
    return {
      tx,
      ty,
      key: hash(i, 7),
      f1: 0.45 + 0.8 * hash(i, 3),
      f2: 0.4 + 0.7 * hash(i, 4),
    };
  });
}

/** The shared converge envelopes (form presence / droplet drain / mass shed). */
export function convergeEnvelopes(p) {
  const q = 1 - smooth01((p - 0.02) / 0.26); // form presence
  const rEnv = smooth01((p - 0.075) / 0.24); // droplets drain before the form is solid
  const shed = 1 - 0.45 * q; // complementary mass handoff
  return { q, rEnv, shed };
}

// ── the ecosystem's orbital layout (canvas beads + DOM labels share this) ─────
// Irregular by design — never a perfect circle. Order = the i18n nodes array.
export const ECO_NODES = [
  { ang: -12, r: 0.42 },
  { ang: 34, r: 0.46 },
  { ang: 68, r: 0.5 },
  { ang: 107, r: 0.44 },
  { ang: 141, r: 0.49 },
  { ang: 194, r: 0.44 },
  { ang: 218, r: 0.5 },
  { ang: 252, r: 0.43 },
  { ang: 289, r: 0.49 },
  { ang: 325, r: 0.45 },
];
export const ORGANISM_SCALE = 0.5; // the resolved mark's half-extent ≈ 0.2 uv
export const TENDRIL_START = 0.26; // beads emerge clear of the organism's edge

/** Horizontal orbit stretch for a given stage aspect (shared with the DOM). */
export const ecoSpreadX = (aspect) =>
  Math.min(Math.max(aspect * 0.72, 1), 1.5);

/** Node position in uv space (y up) — edge-clamped so labels never collide
 *  with the viewport edges or the right-side chapter index. */
export function ecoNodePos(i, aspect) {
  const n = ECO_NODES[i % ECO_NODES.length];
  const a = ((n.ang - 90) * Math.PI) / 180;
  const halfW = Math.max(aspect, 0.6) / 2;
  const x = 0.5 + Math.cos(a) * n.r * ecoSpreadX(aspect);
  const y = 0.5 - Math.sin(a) * n.r;
  return {
    x: Math.min(Math.max(x, 0.5 - halfW + 0.1), 0.5 + halfW - 0.1),
    y: Math.min(Math.max(y, 0.12), 0.88),
  };
}

/** Per-node growth envelope at tendril progress g (staggered arrivals). */
export const ecoNodeEnv = (g, i) => smooth01((g - i * 0.055) / 0.32);
