/**
 * Field DRIVERS (improvement-plan R1 / morph-spec §6): every chapter visual is
 * the SAME unified liquid field (sdf-glass-shader) — only the driver differs.
 * A driver is pure data: per rAF it packs droplets into the shared ball buffer
 * and returns the frame's form weights / warp / mute. The canvas component
 * (components/field/FieldStage) owns GL; the hero (FieldMorphHero) shares the
 * §3.3 bridge math below so the melt has exactly ONE implementation.
 *
 *   - site fluid (Hero → S3 → S4 → S5): ONE driver — the hero machine, the
 *     pour, the journey, the tendrils and the service melts (see the banner
 *     further down). One physics table (PHYS), brand cyan everywhere.
 *   - origin   (S8): the five scrubbed beats — two brothers → the exact mark
 *     (+ founding pillars) → the hold → the ecosystem echo → the drain under
 *     the particle wordmark. Same droplets, same PHYS.
 *   - impulse  (S10): the exhale — droplets burst off the resting mark and
 *     sink back (additive; the labeled submit stays canonical).
 */

import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
  CURSOR_R,
  CURSOR_TRAIL_N,
  CURSOR_SMOOTH,
  CURSOR_INFLUENCE_MARK,
} from "./sdf-glass-shader.mjs";
import { EASE_POINTS } from "../animation/easings";
import { DURATIONS } from "../animation/durations";

// ── the pure kernel (R5-A): the canonical clouds, the ONE physics table, the
// per-droplet identity tables and the scatter/orbital target vocabulary live
// in phys.mjs (node-runnable — the conductor and the sim harnesses import it
// without a TS toolchain). Re-exported here so every existing browser-side
// import keeps working unchanged. ─────────────────────────────────────────────
import {
  CLOUDS,
  N,
  STATE_COUNT,
  STAG,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  TAUP,
  AMB,
  scatterFor,
  wideScatter,
  clusterTargets,
  convergeEnvelopes,
  ECO_NODES,
  ORGANISM_SCALE,
  TENDRIL_START,
  ecoSpreadX,
  ecoNodePos,
  ecoNodeEnv,
} from "./phys.mjs";
import type { Ball, ScatterTarget } from "./phys.mjs";

export {
  CLOUDS,
  N,
  STAG,
  clamp01,
  smooth01,
  PHYS,
  ECO_NODES,
  ecoSpreadX,
  ecoNodePos,
  ecoNodeEnv,
};
export type { Ball };

// ── §3.3 melt constants (single source — hero + services scrub) ───────────────
export const STAGGER = 0.25; // fraction of the timeline sweeping left → right
export const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position
export const BRIDGE = 0.38; // p-window where a form hands off to / from droplets

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

export function bridgeRadiusEnvelope(p: number): number {
  const rPad = BRIDGE * 0.35;
  const rWin = BRIDGE * 0.55;
  return (
    smooth01((p - rPad) / rWin) *
    (1 - smooth01((p - (1 - rPad - rWin)) / rWin))
  );
}

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
  // Keep droplets out of fully solid forms: they take over after the source
  // has started dissolving and drain before the target is already solid.
  const rEnv = bridgeRadiusEnvelope(p);
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
  /** Called by the stage as each form's SDF texture becomes drawable — drivers
   *  that retarget between forms (the hero autocycle) gate on this. */
  formReady?: (s: number) => void;
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
// THE SITE FLUID (Hero → Problem → Ecosystem → Services): ONE canvas, ONE
// driver, ONE physics. The hero's living machine (autocycle melts, gooey
// cursor) is a SEGMENT of this driver; scrolling out of the hero granulates
// the resting form into its 48 droplets, which pour into The Problem's
// unstable clusters, travel to the ecosystem, resolve the mark, feed the
// tendrils and melt through the services — one unbroken droplet identity.
// Twelve ambient lava-lamp droplets share the field the whole way. Every
// droplet carries its own positional inertia (heavier lags more), so scroll
// STRETCHES the liquid instead of translating it; scroll velocity stirs it.
// Colour is brand cyan EVERYWHERE — no desaturation states, no dimming.
// ═══════════════════════════════════════════════════════════════════════════════

// the physics table, target generators and per-droplet identities live in
// phys.mjs (imported above); WideScatter survives as a local alias
type WideScatter = ScatterTarget;

/** The site fluid's control channels — written RAW by one scroll source
 *  (components/field/LiquidSite); the driver damps every one of them (and each
 *  droplet damps its own position), so external jumps can never render as
 *  snaps. */
export type SiteInput = {
  heroPhase: number; // 0 = the hero owns the liquid … 1 = poured into The Problem
  vel: number; // scroll velocity (viewport-heights/s, + = down) — the stir
  fracture: number; // S3: 0 = unstable broken chunks … 1 = fully dispersed
  travel: number; // S3 → S4: the dispersed field drifts to centre
  converge: number; // S4: 0 = dispersed … 1 = the organism resolved
  grow: number; // S4: tendrils reach the capability labels
  svcPos: number; // S4 → S5: the organism clears the services headline
  pair: [number, number, number]; // S5 melt [a, b, m]; [0,0,0] outside services
  exit: number; // S5 → S6: the liquid settles away before the layer unsticks
  hero: {
    play: boolean; // autocycle allowed (in view, motion OK)
    hover: boolean; // pointer over the hero → pause the autocycle
    manual: number | null; // keyboard-selected state (0-7), null = auto
    dwellMs: number; // rest dwell (QA ?fcycle shortens it)
    px: number; // pointer in FIELD uv (y up)
    py: number;
    cursorOn: boolean;
    ox: number; // form staging: the hero stage box, measured by the shell
    oy: number;
    scale: number;
  };
};

export type SiteCallbacks = {
  /** Hero active state for the pillar indicator / aria: -1 = mark, 0-6. */
  onHeroActive?: (i: number) => void;
};

// the ecosystem orbital layout (ECO_NODES, ecoSpreadX, ecoNodePos, ecoNodeEnv)
// lives in phys.mjs (imported + re-exported above)

const HERO_DROPS = 1 + CURSOR_TRAIL_N; // gooey cursor chain length

/**
 * The site driver — the single fluid renderer's brain.
 *
 * Regimes (all continuously blended, never switched):
 *  - hero: the living exact-form machine (rest wobble → §3.3 melt autocycle,
 *    hover pause, keyboard retargets, the gooey cursor) staged over the hero
 *    column via the form-domain uniforms.
 *  - pour (heroPhase): the resting form erodes thin-edges-first while its 48
 *    droplets emerge on its footprint and stream — each on its own staggered
 *    schedule and inertia — into The Problem's clusters.
 *  - journey (S3 → S4): clusters → dispersed → the eco field (identity-
 *    preserving travel), then the converge resolves the exact mark; the form
 *    NEVER appears while dispersed.
 *  - tendrils: the same droplets feed the ten capabilities once resolved.
 *  - services: §3.3 bridge melts between the exact pillar forms, scaled and
 *    offset clear of the copy — the same liquid, reconfigured.
 *  - exit: the last form erodes away before the sticky layer unsticks, so the
 *    unstick never drags visible liquid.
 *  - always: twelve ambient lava-lamp droplets drift the full bleed, stirred
 *    by scroll velocity; every visible thing is brand-cyan glass.
 */
export function makeSiteDriver(
  input: SiteInput,
  cbs: SiteCallbacks = {},
): FieldDriver {
  const base = CLOUDS[0];
  let lastT = -1;
  const dmp = { hp: -1, f: -1, tr: -1, c: -1, g: -1, sp: -1, m: -1, ex: -1, v: 0 };
  let lastPair = "0-0";
  let cachedAspect = -1;
  let Tclu: WideScatter[] = [];
  let Tdis: WideScatter[] = [];
  let Teco: WideScatter[] = [];
  let svcOx = 0;
  let svcOy = 0;
  let svcScale = ORGANISM_SCALE;

  // ── hero machine (autocycle / melt / queue) ─────────────────────────────────
  const texReady = new Array(STATE_COUNT).fill(false) as boolean[];
  let hState = 0;
  let hTarget = 0;
  let hPhase: "rest" | "melt" = "rest";
  let hMorphT = 0;
  let hDwell = 0;
  let hQueued = -1;
  let perm: number[] = [];
  let stag: number[] = [];
  const scratch = new Float32Array(N * 3); // hero bridge cloud (form-local)
  const startMelt = (s: number) => {
    perm = permFor(hState, s);
    stag = STAG[hState];
    hTarget = s;
    hMorphT = 0;
    hPhase = "melt";
    cbs.onHeroActive?.(s - 1);
  };

  // ── gooey cursor chain (same spring family as the old hero) ─────────────────
  const drops = Array.from({ length: HERO_DROPS }, () => ({ x: 0.5, y: 0.5 }));
  let cursorOn = 0;
  let markMul = 1;

  // ── per-droplet inertia state (position + radius live HERE, not per frame) ──
  const P = new Float32Array(N * 2).fill(-1);
  const R = new Float32Array(N).fill(-1);

  return {
    forms: [0, 1, 2, 3, 4, 5, 6, 7],
    formReady: (s) => {
      texReady[s] = true;
    },
    frame: (tMs, buf, aspect) => {
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // S3's liquid lives right of the copy column on wide stages
        const sCx = 0.5 + Math.min(0.14 * aspect, Math.max(aspect / 2 - 0.34, 0));
        // services placement: beside the copy on wide stages; BELOW it (smaller,
        // lower half) on narrow ones — legibility is first-class everywhere
        const wide = aspect >= 1.4;
        svcOx = wide ? Math.min(0.15 * aspect, aspect / 2 - 0.32) : 0;
        svcOy = wide ? 0 : -0.22;
        svcScale = wide ? ORGANISM_SCALE : 0.38;
        Tclu = clusterTargets(aspect, sCx);
        Tdis = wideScatter(aspect, sCx, 0.5, 0.85);
        Teco = wideScatter(aspect, 0.5, 0.5, 1);
      }
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      const k = 1 - Math.exp(-dt / PHYS.TAU_CHANNEL);
      const damp = (cur: number, raw: number) =>
        cur < 0 ? raw : cur + (raw - cur) * k;
      dmp.hp = damp(dmp.hp, clamp01(input.heroPhase));
      dmp.f = damp(dmp.f, clamp01(input.fracture));
      dmp.tr = damp(dmp.tr, clamp01(input.travel));
      dmp.c = damp(dmp.c, clamp01(input.converge));
      dmp.g = damp(dmp.g, clamp01(input.grow));
      dmp.sp = damp(dmp.sp, clamp01(input.svcPos));
      dmp.ex = damp(dmp.ex, clamp01(input.exit));
      dmp.v += (input.vel - dmp.v) * (1 - Math.exp(-dt / PHYS.TAU_VEL));
      const [pa, pb] = input.pair;
      const pairKey = pa + "-" + pb;
      if (pairKey !== lastPair) {
        // pair switches happen at rest boundaries where both readings render
        // the same exact form — snapping m there is visually seamless
        lastPair = pairKey;
        dmp.m = clamp01(input.pair[2]);
      } else {
        dmp.m = damp(dmp.m, clamp01(input.pair[2]));
      }

      const t = tMs / 1000;
      const H = input.hero;
      const SP = smooth01(dmp.sp);
      const EXW = 1 - smooth01(dmp.ex); // exit drain (radii; forms get erosion)
      const jScale = ORGANISM_SCALE + (svcScale - ORGANISM_SCALE) * SP;
      const jOx = svcOx * SP;
      const jOy = svcOy * SP;
      const inServices = pa !== pb || pa > 0;
      const inSvcMelt = pa !== pb && dmp.m > 0.0005 && dmp.m < 0.9995;

      // ── hero machine tick ──────────────────────────────────────────────────
      const atHero = dmp.hp < 0.04;
      if (hPhase === "melt") {
        hMorphT += dt;
        if (hMorphT >= DURATIONS.morph) {
          hState = hTarget;
          hPhase = "rest";
          hDwell = 0;
          cbs.onHeroActive?.(hState - 1);
        }
      }
      if (hPhase === "rest") {
        const man = H.manual;
        if (man != null && man !== hState && texReady[man]) {
          startMelt(man);
        } else if (hQueued >= 0 && hQueued !== hState && texReady[hQueued]) {
          const q = hQueued;
          hQueued = -1;
          startMelt(q);
        } else if (man == null && H.play && !H.hover && atHero) {
          hDwell += dt;
          const next = (hState + 1) % STATE_COUNT;
          if (hDwell >= H.dwellMs && texReady[next]) startMelt(next);
        }
      } else if (H.manual != null && H.manual !== hTarget) {
        hQueued = H.manual; // retarget applies on arrival (no snap)
      }

      // ── gooey cursor (hero only; presence drains as the hero pours out) ────
      const cGoal = H.cursorOn && atHero ? 1 : 0;
      if (cursorOn > 0.003 || cGoal > 0) {
        const goalMul =
          hPhase === "rest" && hState === 0 ? CURSOR_INFLUENCE_MARK : 1;
        markMul += (goalMul - markMul) * (1 - Math.exp(-dt / 160));
        cursorOn += (cGoal - cursorOn) * (1 - Math.exp(-dt / (cGoal ? 110 : 60)));
        if (cursorOn < 0.01 && cGoal > 0) {
          for (const d of drops) {
            d.x = H.px;
            d.y = H.py;
          } // materialise AT the pointer (no fly-in)
        }
        const ck = 1 - Math.pow(1 - CURSOR_SMOOTH, dt / 16.7);
        const ckt = 1 - Math.pow(1 - CURSOR_SMOOTH * 0.7, dt / 16.7);
        drops[0].x += (H.px - drops[0].x) * ck;
        drops[0].y += (H.py - drops[0].y) * ck;
        for (let i = 1; i < HERO_DROPS; i++) {
          drops[i].x += (drops[i - 1].x - drops[i].x) * ckt;
          drops[i].y += (drops[i - 1].y - drops[i].y) * ckt;
        }
      } else cursorOn = 0;

      // ── hero presence (the pour) + form-slot ownership ─────────────────────
      // The resting form erodes thin-edges-first across heroPhase 0.04 → 0.62;
      // its droplets emerge on the footprint and stream to the journey.
      const heroQ = 1 - smooth01((dmp.hp - 0.04) / 0.58);
      const [heroW, heroE] = formPresence(heroQ);
      const meltP = clamp01(hMorphT / DURATIONS.morph);
      const meltEnv = hPhase === "melt" ? Math.sin(Math.PI * meltP) : 0;

      let a: number;
      let b: number;
      let fa: number;
      let fb: number;
      let ea: number;
      let eb: number;
      let ox: number;
      let oy: number;
      let scale: number;
      let warp =
        SDF_WARP_REST +
        Math.min(Math.abs(dmp.v) * 0.003, 0.004); // scroll agitates the liquid

      if (heroW > 0.002) {
        // hero owns the form slots (journey form weight is 0 out here)
        ox = H.ox;
        oy = H.oy;
        scale = H.scale;
        if (hPhase === "melt") {
          const ph = formPhase(meltP);
          a = hState;
          b = hTarget;
          fa = ph.wA * heroW;
          fb = ph.wB * heroW;
          ea = ph.eA + heroE;
          eb = ph.eB + heroE;
          warp += (SDF_WARP_MORPH - SDF_WARP_REST) * meltEnv;
        } else {
          a = hState;
          b = hState;
          fa = heroW;
          fb = 0;
          ea = heroE;
          eb = 0;
        }
      } else {
        ox = jOx;
        oy = jOy;
        scale = jScale;
        if (inServices) {
          a = pa;
          b = pb;
          if (pa === pb) {
            // degenerate pair (last pillar) — a solid rest, never a weight dip
            fa = 1;
            fb = 0;
            ea = 0;
            eb = 0;
          } else {
            const ph = formPhase(dmp.m);
            fa = ph.wA;
            fb = ph.wB;
            ea = ph.eA;
            eb = ph.eB;
            warp +=
              (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * dmp.m);
          }
        } else {
          // the mark emerges only at full convergence — never while dispersed
          const [w, e] = formPresence(convergeEnvelopes(1 - dmp.c).q);
          a = 0;
          b = 0;
          fa = w;
          fb = 0;
          ea = e;
          eb = 0;
        }
        // exit: the form erodes away before the sticky layer unsticks
        const exE = smooth01(dmp.ex);
        fa *= 1 - exE;
        fb *= 1 - exE;
        ea += exE * SDF_MELT_ERODE;
        eb += exE * SDF_MELT_ERODE;
      }

      // ── the 48 droplets: hero side ⟶ journey side, per-droplet inertia ─────
      // hero-side (form-local → staged): melt bridge while melting, else the
      // footprint (radii emerge with the pour)
      let heroBridge = false;
      if (hPhase === "melt" && heroW > 0.002) {
        packBridge(scratch, 0, CLOUDS[hState], CLOUDS[hTarget], perm, stag, meltP);
        heroBridge = true;
      }
      const pourR = smooth01((dmp.hp - 0.05) / 0.3); // droplets emerge as the form erodes
      // loose liquid drags with the scroll (bounded — a flick stirs, never flings)
      const stirY = Math.max(-2.2, Math.min(2.2, dmp.v)) * PHYS.STIR;

      // journey-side shared factors
      const p = 1 - dmp.c;
      const { rEnv, shed } = convergeEnvelopes(p);
      const F = smooth01(dmp.f);
      const TR = smooth01(dmp.tr);
      const sx = ecoSpreadX(aspect);

      for (let i = 0; i < N; i++) {
        const bb = base[i];
        // hero-side target
        let hx: number;
        let hy: number;
        let hr: number;
        if (heroBridge) {
          hx = scratch[i * 3];
          hy = scratch[i * 3 + 1];
          hr = scratch[i * 3 + 2];
        } else {
          hx = bb[0];
          hy = bb[1];
          hr = bb[2] * pourR * (0.55 + 0.45 * VARY[i]);
        }
        // stage into field space
        hx = 0.5 + H.ox + (hx - 0.5) * H.scale;
        hy = 0.5 + H.oy + (hy - 0.5) * H.scale;
        hr *= H.scale;

        // journey-side target: clusters → dispersed (S3) → the eco field
        const clu = Tclu[i], dis = Tdis[i], eco = Teco[i];
        let tx = clu.tx + (dis.tx - clu.tx) * F;
        let ty = clu.ty + (dis.ty - clu.ty) * F;
        tx += (eco.tx - tx) * TR;
        ty += (eco.ty - ty) * TR;
        // converge home: the organism's cloud (centred, scaled, services drift)
        const hx2 = 0.5 + jOx + (bb[0] - 0.5) * jScale;
        const hy2 = 0.5 + jOy + (bb[1] - 0.5) * jScale;
        const lt = smooth01((p - (0.16 + 0.3 * dis.key)) / 0.5);
        const drift = PHYS.DRIFT * lt;
        let jx = hx2 + (tx - hx2) * lt + drift * Math.sin(t * dis.f1 + i * 1.7);
        let jy =
          hy2 +
          (ty - hy2) * lt +
          drift * Math.cos(t * dis.f2 + i * 2.3) +
          stirY * lt; // loose liquid drags with the scroll; landed liquid holds
        const vary = 1 + (VARY[i] - 1) * lt; // size spread while loose
        let jr = bb[2] * jScale * (1 - 0.28 * lt) * rEnv * shed * vary;
        if (inSvcMelt) {
          // the §3.3 services bridge is the journey target while melting
          const A = CLOUDS[pa], B = CLOUDS[pb];
          const pm = permFor(pa, pb), st = STAG[pa];
          const lm = clamp01(dmp.m * (1 + STAGGER) - STAGGER * st[i]);
          const tp = arrive(lm);
          const trr = arrive(clamp01(lm * RADIUS_LEAD));
          const aa = A[i], bb2 = B[pm[i]];
          const rEnvM = bridgeRadiusEnvelope(dmp.m);
          jx = 0.5 + jOx + (aa[0] + (bb2[0] - aa[0]) * tp - 0.5) * jScale;
          jy = 0.5 + jOy + (aa[1] + (bb2[1] - aa[1]) * tp - 0.5) * jScale;
          jr = (aa[2] + (bb2[2] - aa[2]) * trr) * rEnvM * jScale;
        } else if (i < 40) {
          // tendrils: the same droplets feed the capabilities once resolved
          const nIdx = i % 10;
          const e = ecoNodeEnv(dmp.g, nIdx) * (1 - SP);
          if (e > 0.001) {
            const node = ECO_NODES[nIdx];
            const na = ((node.ang - 90) * Math.PI) / 180;
            const np = ecoNodePos(nIdx, aspect);
            const sxp = 0.5 + Math.cos(na) * sx * TENDRIL_START;
            const syp = 0.5 - Math.sin(na) * TENDRIL_START;
            const bead = (i / 10) | 0;
            let txp: number;
            let typ: number;
            let trp: number;
            if (bead === 3) {
              txp = np.x;
              typ = np.y;
              trp = 0.012;
            } else {
              // marching beads: born at the organism's edge, absorbed just
              // short of the node — a continuous outward pulse
              const fr = (bead + ((t * 0.3 + nIdx * 0.618) % 1)) / 3;
              txp = sxp + (np.x - sxp) * fr * 0.9;
              typ = syp + (np.y - syp) * fr * 0.9;
              trp = 0.015 * (0.45 + 0.55 * Math.sin(Math.PI * fr));
            }
            jx += (txp - jx) * e;
            jy += (typ - jy) * e;
            jr = jr * (1 - e) + trp * e;
          }
        }

        // the pour: hero side ⟶ journey side, each droplet on its own schedule
        const li = smooth01((dmp.hp - 0.08 - 0.42 * hash(i, 15)) / 0.44);
        const txF = hx + (jx - hx) * li;
        const tyF = hy + (jy - hy) * li;
        const trF = (hr + (jr - hr) * li) * EXW;

        // per-droplet inertia — the physics that makes scroll STRETCH the field
        const kp = 1 - Math.exp(-dt / TAUP[i]);
        const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
        if (P[i * 2] < 0) {
          P[i * 2] = txF;
          P[i * 2 + 1] = tyF;
          R[i] = trF;
        } else {
          P[i * 2] += (txF - P[i * 2]) * kp;
          P[i * 2 + 1] += (tyF - P[i * 2 + 1]) * kp;
          R[i] += (trF - R[i]) * kr;
        }
      }

      // ── pack: droplets (visible only) + ambient + cursor — one shared field ─
      let count = 0;
      for (let i = 0; i < N; i++) {
        if (R[i] < 0.0012) continue;
        buf[count * 3] = P[i * 2];
        buf[count * 3 + 1] = P[i * 2 + 1];
        buf[count * 3 + 2] = R[i];
        count++;
      }

      // ambient lava lamp — always alive, calmer where a composition must read
      const ambW =
        (1 - 0.5 * smooth01(dmp.c) * (1 - SP)) * (1 - 0.35 * SP) * EXW;
      if (ambW > 0.02) {
        const spanX = Math.max(aspect - 0.1, 0.5);
        for (let j = 0; j < PHYS.AMBIENT_N; j++) {
          const m = AMB[j];
          const x =
            0.5 + (m.fx - 0.5) * spanX + 0.05 * Math.sin(t * m.f1 + m.p1);
          const y =
            m.ay +
            0.09 * Math.sin(t * m.f2 + m.p2) +
            0.045 * Math.sin(t * m.f3 + m.p3) +
            stirY * m.stir;
          const r = m.r * ambW * (0.86 + 0.14 * Math.sin(t * m.f4 + m.p1));
          if (r < 0.0012) continue;
          buf[count * 3] = x;
          buf[count * 3 + 1] = Math.min(Math.max(y, 0.04), 0.96);
          buf[count * 3 + 2] = r;
          count++;
        }
      }

      // cursor chain (hero only)
      if (cursorOn > 0.003) {
        const cw = cursorOn * markMul * (1 - smooth01(dmp.hp * 3));
        for (let j = 0; j < HERO_DROPS; j++) {
          const r = CURSOR_R * Math.pow(0.58, j) * cw;
          if (r < 0.002) continue;
          buf[count * 3] = drops[j].x;
          buf[count * 3 + 1] = drops[j].y;
          buf[count * 3 + 2] = r;
          count++;
        }
      }

      // brand cyan EVERYWHERE — the desaturated "broken" state is expressed by
      // motion and separation, never by draining the colour (owner directive)
      return { a, b, fa, fb, ea, eb, ox, oy, scale, warp, mute: 0, count };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE ORIGIN (S8) — the five scrubbed beats (build-spec S8.3) on the SAME
// unified liquid and the SAME physics as the site fluid. One driver, one
// scroll-progress channel, damped + per-droplet inertia:
//
//   Beat 1  p 0.00–0.18  two brothers: two fluid masses enter from opposite
//                        sides and DRIFT toward each other — drawn, not
//                        colliding.
//   Beat 2  p 0.18–0.42  three pillars, one mark: the masses fuse onto the
//                        mark's droplet footprint and the EXACT SVG-traced
//                        mark grows from its skeleton underneath (the same
//                        converge language as the ecosystem).
//   Beat 3  p 0.42–0.62  the purpose: the mark holds, breathing (rest warp);
//                        the copy takes the foreground.
//   Beat 4  p 0.62–0.82  the evolution: satellite droplets are REBORN off the
//                        mark and fan out to loose orbits — the ecosystem echo.
//   Beat 5  p 0.82–1.00  resolution: the satellites sink back and drain; the
//                        mark erodes away under the assembling particle
//                        wordmark (DOM), closing line + grace note.
// ═══════════════════════════════════════════════════════════════════════════════

export type OriginInput = { p: number }; // raw runway progress, 0..1

const ORIGIN_SCALE = 0.5; // the mark's half-extent ≈ 0.2 uv (same as the eco)
const ORIGIN_OY = 0.06; // slightly above centre — the beat copy reads below

type OriginTarget = {
  ex: number; // off-stage entry
  ey: number;
  mx: number; // the meeting (two loose masses, about to touch)
  my: number;
  ox: number; // beat-4 echo orbit
  oy: number;
};

export function makeOriginDriver(input: OriginInput): FieldDriver {
  const base = CLOUDS[0];
  let lastT = -1;
  let dp = -1;
  let cachedAspect = -1;
  let T: OriginTarget[] = [];
  const P = new Float32Array(N * 2).fill(-1);
  const R = new Float32Array(N).fill(-1);
  return {
    forms: [0],
    frame: (tMs, buf, aspect) => {
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        const halfW = Math.max(aspect, 0.6) / 2;
        const sx = Math.min(Math.max(aspect * 0.8, 1), 1.45);
        T = base.map((_, i) => {
          const side = i % 2 === 0 ? -1 : 1; // brother A / brother B, interleaved
          const ma = hash(i, 54) * Math.PI * 2;
          const md = 0.03 + 0.09 * hash(i, 55);
          const oa = hash(i, 56) * Math.PI * 2;
          const orr = 0.26 + 0.16 * hash(i, 57);
          return {
            ex: 0.5 + side * (halfW + 0.12 + 0.1 * hash(i, 52)),
            ey: 0.36 + 0.38 * hash(i, 53),
            mx: 0.5 + side * 0.105 + Math.cos(ma) * md * 0.9,
            my: 0.5 + ORIGIN_OY + side * 0.02 + Math.sin(ma) * md,
            ox: 0.5 + Math.cos(oa) * orr * sx,
            oy: 0.5 + ORIGIN_OY + Math.sin(oa) * orr,
          };
        });
      }
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      if (dp < 0) dp = clamp01(input.p);
      dp += (clamp01(input.p) - dp) * (1 - Math.exp(-dt / PHYS.TAU_CHANNEL));
      const p = clamp01(dp);
      const t = tMs / 1000;

      // beat envelopes (windows overlap on purpose — nothing ever swaps)
      const q1 = smooth01(p / 0.17); // enter → the meeting
      const q2 = smooth01((p - 0.19) / 0.22); // fuse → the mark
      const q4 = smooth01((p - 0.62) / 0.19); // multiply outward
      const q5 = smooth01((p - 0.84) / 0.12); // resolve under the wordmark

      // the mark: grows from its skeleton under the fused mass (late beat 2),
      // holds through beats 3–4, erodes away at the resolution
      const [wIn, eIn] = formPresence(smooth01((q2 - 0.5) / 0.45));
      const out = smooth01((p - 0.86) / 0.11);
      const fa = wIn * (1 - out);
      const ea = eIn + out * SDF_MELT_ERODE;
      const warp =
        SDF_WARP_REST +
        (SDF_WARP_MORPH - SDF_WARP_REST) * 0.6 * Math.sin(Math.PI * q2);

      for (let i = 0; i < N; i++) {
        const b = base[i];
        const s = T[i];
        // entry → the meeting
        let x = s.ex + (s.mx - s.ex) * q1;
        let y = s.ey + (s.my - s.ey) * q1;
        // the meeting → the mark's footprint (staggered — the fusion flows)
        const lt2 = smooth01((q2 - 0.45 * hash(i, 58)) / 0.55);
        const fx = 0.5 + (b[0] - 0.5) * ORIGIN_SCALE;
        const fy = 0.5 + ORIGIN_OY + (b[1] - 0.5) * ORIGIN_SCALE;
        x += (fx - x) * lt2;
        y += (fy - y) * lt2;
        // radius: travelling mass → footprint swell → drained as the form lands
        const drain = 1 - smooth01((q2 - 0.68) / 0.28);
        let r = b[2] * ORIGIN_SCALE * (0.6 + 0.4 * VARY[i]) * drain;
        // beat 4 — half the droplets are REBORN off the mark as the echo
        let loose = 1 - lt2;
        if (i % 2 === 0 && q4 > 0.001) {
          const q4i = smooth01((q4 - 0.5 * hash(i, 59)) / 0.5);
          if (q4i > 0.001) {
            x += (s.ox - x) * q4i;
            y += (s.oy - y) * q4i;
            r = Math.max(r, 0.016 * VARY[i] * q4i);
            loose = Math.max(loose, q4i);
          }
        }
        // resolution: everything sinks and drains
        r *= 1 - q5;
        // wander while loose; stills as it lands (the same drift family)
        const wob = PHYS.DRIFT * loose * (1 - q5);
        x += wob * Math.sin(t * (0.5 + hash(i, 62)) + i * 1.7);
        y += wob * Math.cos(t * (0.45 + hash(i, 63)) + i * 2.3);

        // per-droplet inertia — identical physics to the site fluid
        const kp = 1 - Math.exp(-dt / TAUP[i]);
        const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
        if (P[i * 2] < 0) {
          P[i * 2] = x;
          P[i * 2 + 1] = y;
          R[i] = r;
        } else {
          P[i * 2] += (x - P[i * 2]) * kp;
          P[i * 2 + 1] += (y - P[i * 2 + 1]) * kp;
          R[i] += (r - R[i]) * kr;
        }
      }

      let count = 0;
      for (let i = 0; i < N; i++) {
        if (R[i] < 0.0012) continue;
        buf[count * 3] = P[i * 2];
        buf[count * 3 + 1] = P[i * 2 + 1];
        buf[count * 3 + 2] = R[i];
        count++;
      }

      return {
        a: 0,
        b: 0,
        fa,
        fb: 0,
        ea,
        eb: 0,
        ox: 0,
        oy: ORIGIN_OY,
        scale: ORIGIN_SCALE,
        warp,
        mute: 0,
        count,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTODO (S6) — the liquid REHEARSES the client's transformation. Five phase
// states of the same 48 droplets, one per method phase, flowed through with
// per-droplet stagger + inertia (PHYS) as the copy scrolls:
//
//   0 Diagnóstico   the fragmented cloud — uneasy, size-varied — examined by
//                   a slow sweeping PROBE droplet (droplets swell as it passes)
//   1 Estrutura     the same droplets snap into a jittered liquid LATTICE —
//                   the architecture, drawn in liquid, almost calm
//   2 Construção    they accrete into three growing MASSES — the pieces being
//                   built, each fusing solid
//   3 Integração    the masses flow together and the EXACT mark resolves —
//                   "systems operating as one organism", literally
//   4 Evolução      the mark holds, breathes, GROWS slightly; satellites shed
//                   into slow orbits — the ecosystem expanding
//
// Rest plateaus on each phase, melts between them (the services rhythm); the
// whole thing is brand-cyan glass on the unified field.
// ═══════════════════════════════════════════════════════════════════════════════

export type MethodInput = {
  u: number; // continuous phase coord, 0..4
  ex: number; // end-of-runway drain — the unstick never drags visible liquid
};

const M_STATES = 5;

export function makeMethodDriver(input: MethodInput): FieldDriver {
  const base = CLOUDS[0];
  let lastT = -1;
  let du = -1;
  let dex = -1;
  let cachedAspect = -1;
  let ST = new Float32Array(M_STATES * N * 3); // per-state droplet targets
  let stageCx = 0.5;
  let stageCy = 0.5;
  let mOx = 0;
  let mOy = 0;
  let mScale = ORGANISM_SCALE;
  const P = new Float32Array(N * 2).fill(-1);
  const R = new Float32Array(N).fill(-1);
  // per-state wander activity (fragmented = restless … integrated = still)
  const ACT = [1, 0.3, 0.5, 0.12, 0.35];

  const put = (s: number, i: number, x: number, y: number, r: number) => {
    const j = (s * N + i) * 3;
    ST[j] = x;
    ST[j + 1] = y;
    ST[j + 2] = r;
  };

  return {
    forms: [0],
    frame: (tMs, buf, aspect) => {
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // stage left of the copy column on wide stages; below it on narrow
        const wide = aspect >= 1.4;
        mOx = wide ? -Math.min(0.15 * aspect, aspect / 2 - 0.32) : 0;
        mOy = wide ? 0 : -0.22;
        mScale = wide ? ORGANISM_SCALE : 0.38;
        stageCx = 0.5 + mOx;
        stageCy = 0.5 + mOy;
        const sz = mScale / ORGANISM_SCALE; // local size factor
        ST = new Float32Array(M_STATES * N * 3);
        // 0 — the fragmented cloud (Diagnosis): SEPARATED droplets — small
        // enough that their falloff tails never fuse into a dark film — and
        // compressed into the stage column so the copy stays clear
        const dis = wideScatter(aspect, stageCx, stageCy, 0.62);
        const clampD = (v: number, c: number, lim: number) =>
          c + Math.max(-lim, Math.min(lim, (v - c) * 0.9));
        // 1 — the lattice (Structure): 8 × 6 = exactly the 48 droplets
        const COLS = 8;
        const ROWS = 6;
        const spanX = 0.54 * sz;
        const spanY = 0.42 * sz;
        // 2 — three accreting masses (Construction)
        const CORE_R = 0.155 * sz;
        for (let i = 0; i < N; i++) {
          const b = base[i];
          put(
            0,
            i,
            clampD(dis[i].tx, stageCx, 0.33),
            clampD(dis[i].ty, stageCy, 0.33),
            b[2] * mScale * (0.24 + 0.24 * VARY[i]),
          );
          const col = i % COLS;
          const row = (i / COLS) | 0;
          put(
            1,
            i,
            stageCx - spanX / 2 + (spanX / (COLS - 1)) * col +
              (row % 2 ? spanX / (COLS - 1) / 2 : 0) +
              (hash(i, 72) - 0.5) * 0.014,
            stageCy - spanY / 2 + (spanY / (ROWS - 1)) * row +
              (hash(i, 73) - 0.5) * 0.014,
            0.012 * sz * (0.92 + 0.16 * hash(i, 74)),
          );
          const core = i % 3;
          const ca = ((core * 120 + 90) * Math.PI) / 180;
          const cx = stageCx + Math.cos(ca) * CORE_R;
          const cy = stageCy + Math.sin(ca) * CORE_R;
          const od = (0.012 + 0.062 * Math.pow(hash(i, 75), 1.4)) * sz;
          const oa = hash(i, 76) * Math.PI * 2;
          put(
            2,
            i,
            cx + Math.cos(oa) * od,
            cy + Math.sin(oa) * od,
            (0.036 - 0.26 * od) * sz,
          );
          // 3 — the mark's footprint (the form swallows the fused mass)
          const fx = 0.5 + mOx + (b[0] - 0.5) * mScale;
          const fy = 0.5 + mOy + (b[1] - 0.5) * mScale;
          put(3, i, fx, fy, b[2] * mScale * 0.5);
          // 4 — evolution: a third of the droplets shed into slow orbits
          if (i % 3 === 0) {
            const sa = hash(i, 77) * Math.PI * 2;
            const so = (0.29 + 0.15 * hash(i, 78)) * sz;
            put(
              4,
              i,
              stageCx + Math.cos(sa) * so * Math.min(Math.max(aspect * 0.8, 1), 1.4),
              stageCy + Math.sin(sa) * so,
              0.014 * sz,
            );
          } else {
            put(4, i, fx, fy, 0.002);
          }
        }
      }
      const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
      lastT = tMs;
      const uRaw = Math.min(Math.max(input.u, 0), 4);
      if (du < 0) du = uRaw;
      du += (uRaw - du) * (1 - Math.exp(-dt / PHYS.TAU_CHANNEL));
      const exRaw = clamp01(input.ex);
      if (dex < 0) dex = exRaw;
      dex += (exRaw - dex) * (1 - Math.exp(-dt / PHYS.TAU_CHANNEL));
      const t = tMs / 1000;

      // rest plateau on each phase, melt across the middle of each gap
      const k0 = Math.min(Math.floor(du), 3);
      const f = du - k0;
      const fw = f <= 0.35 ? 0 : f >= 0.65 ? 1 : (f - 0.35) / 0.3;
      const sEff = k0 + fw;

      // exit: the liquid settles away BEFORE the sticky layer unsticks
      const exE = smooth01(dex);
      const EXW = 1 - exE;

      // the mark: converges across the 2 → 3 melt, holds, erodes back below
      const formT = clamp01((sEff - 2.45) / 0.5);
      const [fa0, ea0] = formPresence(formT);
      const fa = fa0 * EXW;
      const ea = ea0 + exE * SDF_MELT_ERODE;
      const grow = smooth01((sEff - 3.35) / 0.55); // Evolution: it grows
      const scale = mScale * (1 + 0.06 * grow);

      // the probe (Diagnosis only): a slow horizontal sweep, examining
      const probeW = 1 - smooth01((sEff - 0.45) / 0.35);
      let probeX = 0;
      let probeY = 0;
      if (probeW > 0.01) {
        const tri = (t * 0.07) % 1;
        const sw = tri < 0.5 ? tri * 2 : 2 - tri * 2;
        probeX = stageCx - 0.26 + 0.52 * smooth01(sw);
        probeY = stageCy + 0.1 * Math.sin(t * 0.31);
      }

      const k1 = Math.min(k0 + 1, M_STATES - 1);
      for (let i = 0; i < N; i++) {
        const ja = (k0 * N + i) * 3;
        const jb = (k1 * N + i) * 3;
        // staggered flow: each droplet crosses the melt on its own window
        const fi = smooth01((fw - 0.4 * hash(i, 71)) / 0.6);
        let x = ST[ja] + (ST[jb] - ST[ja]) * fi;
        let y = ST[ja + 1] + (ST[jb + 1] - ST[ja + 1]) * fi;
        let r = ST[ja + 2] + (ST[jb + 2] - ST[ja + 2]) * fi;
        // orbiting satellites actually ORBIT (Evolution)
        if (i % 3 === 0 && sEff > 3.05) {
          const rot = t * (0.03 + 0.03 * hash(i, 79)) * smooth01(sEff - 3.05);
          const dx = x - stageCx;
          const dy = y - stageCy;
          const cs = Math.cos(rot);
          const sn = Math.sin(rot);
          x = stageCx + dx * cs - dy * sn;
          y = stageCy + dx * sn + dy * cs;
        }
        // the probe's examination: droplets swell as it passes over them
        if (probeW > 0.01) {
          const d = x - probeX;
          r *= 1 + 0.34 * probeW * Math.exp(-(d * d) / 0.006);
        }
        // life: restless while fragmented, stiller as order takes hold
        const act = ACT[k0] + (ACT[k1] - ACT[k0]) * fi;
        const wob = PHYS.DRIFT * act;
        x += wob * Math.sin(t * (0.5 + hash(i, 80)) + i * 1.7);
        y += wob * Math.cos(t * (0.44 + hash(i, 81)) + i * 2.3);
        r *= EXW; // exit: everything settles away before the unstick

        // per-droplet inertia — the same physics as everywhere else
        const kp = 1 - Math.exp(-dt / TAUP[i]);
        const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
        if (P[i * 2] < 0) {
          P[i * 2] = x;
          P[i * 2 + 1] = y;
          R[i] = r;
        } else {
          P[i * 2] += (x - P[i * 2]) * kp;
          P[i * 2 + 1] += (y - P[i * 2 + 1]) * kp;
          R[i] += (r - R[i]) * kr;
        }
      }

      let count = 0;
      for (let i = 0; i < N; i++) {
        if (R[i] < 0.0012) continue;
        buf[count * 3] = P[i * 2];
        buf[count * 3 + 1] = P[i * 2 + 1];
        buf[count * 3 + 2] = R[i];
        count++;
      }
      if (probeW > 0.01 && EXW > 0.02) {
        buf[count * 3] = probeX;
        buf[count * 3 + 1] = probeY;
        buf[count * 3 + 2] = 0.02 * probeW * EXW;
        count++;
      }

      return {
        a: 0,
        b: 0,
        fa,
        fb: 0,
        ea,
        eb: 0,
        ox: mOx,
        oy: mOy,
        scale,
        warp:
          SDF_WARP_REST +
          (SDF_WARP_MORPH - SDF_WARP_REST) * 0.5 * Math.sin(Math.PI * fw),
        mute: 0,
        count,
      };
    },
  };
}
