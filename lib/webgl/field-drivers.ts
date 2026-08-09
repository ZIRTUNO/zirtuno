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
// p-window where a form hands off to / from droplets.
//
// Form A's weight support is p ∈ [0, BRIDGE] and form B's is p ∈ [1 - BRIDGE, 1],
// so at 0.38 the two are DISJOINT: across p ∈ [0.38, 0.62] — a quarter of every
// melt — neither form has any weight and the droplet cloud carries the picture
// alone. That is the DESIGN, not a bug: the cloud interpolates POSITIONS, which
// is the only real morph available here, and the note on bridgePresence below
// says the two are interchangeable.
//
// They stopped being interchangeable, which is what produced the "midway it
// jumps to the last morph" report. Measured through one melt at 1440x900, lit
// liquid area per frame against the endpoints:
//   m=0.19  100%   (form A solid)
//   m=0.30   49%   <- half the liquid gone in a single scroll step
//   m=0.41…0.70  ~52%   <- the void; droplets only, at half a form's solidity
//   m=0.82   94%   <- destination form slams back
// Widening the morph window (MELT_LO/HI 0.35/0.65 → 0.12/0.88) stretched that
// hole from ~65px of scroll to ~164px, which is why a long-standing shortfall
// only became visible now. The fix is BRIDGE_SWELL below — restore the cloud's
// solidity — NOT a wider BRIDGE.
//
// Widening it was tried and measured, and is wrong. The field is THRESHOLDED,
// so summing two different shapes at partial weight is a cross-dissolve, not a
// morph: at 0.70 both forms sit at ~0.57 and neither clears the iso level (85%
// avg with a 46% dip); at 0.82 both sit at ~0.93 and their UNION clears it
// everywhere (125% avg — the liquid visibly swells). 0.50 + BRIDGE_SWELL scored
// the same as 0.38 + BRIDGE_SWELL (mid-avg 102% vs 101%), so the original value
// stands and the shared hero melt keeps its signed-off timing.
export const BRIDGE = 0.38;
/**
 * How much the bridge cloud THICKENS while it is standing in for a form.
 *
 * The §3.3 design assumes cloud and form are interchangeable. Measured on the
 * page they are not — not in SIZE, but in SOLIDITY. Their bounding boxes match
 * exactly (179x105 in the capture), yet the fraction of that box actually lit
 * differs: the droplets sit far enough apart that they never neck into one
 * body, so the same silhouette comes out substantially less solid. That is the
 * "the liquid halves mid-morph, then the last shape snaps back" report.
 *
 * Radius is the safe lever, and only in this direction. Two droplets neck while
 * their gap is under 0.83 x radius, so GROWING them merges the cloud — the
 * hazard the rest of this file warns about is SHRINKING, which pulls droplets
 * out of contact and sheds beads. The swell rides bridgePresence, so it is at
 * full strength exactly when the cloud is carrying the frame alone, and is
 * identically 0 at both ends where the form has taken back over and the cloud
 * must hand off at its canonical size.
 *
 * THE DEFICIT IS PER-FORM, AND THIS CONSTANT IS A COMPROMISE. Measured with
 * scripts/capture-melt-profile.mjs (mid-melt area as % of the endpoint forms,
 * where 100% = one body of constant mass):
 *
 *   swell   melt 1->2                 melt 4->5
 *   0.00    62%  (fill 18 vs 32)      90%  (fill 21 vs 24)
 *   0.15    84%  (fill 25 vs 31)     115%  (fill 29 vs 24)
 *   0.30   101%  (fill 32 vs 32)     144%  (fill 37 vs 24)
 *
 * Melt 1->2 was the broken one; melt 4->5 was already close, because form 5's
 * own decomposition packs tighter. A single global value therefore cannot zero
 * both — 0.30 fixes 1->2 and visibly swells 4->5; 0.15 minimises the mean error
 * across the pair (24% -> 15.5%) and leaves no melt with a hole. The complete
 * fix is a per-form calibration table; capture-melt-profile.mjs is the tool
 * that would build it, one PAIR= run per melt.
 */
export const BRIDGE_SWELL = 0.15;

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

/**
 * The handoff FLOOR. The bridge envelope must never drive a droplet's presence
 * all the way down, because a cloud whose presence is scaled toward zero comes
 * apart: two droplets only neck while their gap is under 0.83 x radius, so the
 * ramps used to shatter the melt into loose beads at both ends. Rendering the
 * real bridge cloud and counting connected bodies across the ramp:
 *
 *   p      radius envelope (was)   density envelope + this floor
 *   0.16   34 bodies, largest 8%    5 bodies, largest 62%
 *   0.80   48 bodies, largest 4%   12 bodies, largest 19%
 *   0.30    3 bodies, largest 73%   3 bodies, largest 73%   (identical mid-melt)
 *
 * The remaining presence is taken away by the FORM, not by the envelope:
 * formShield already suppresses droplets once they are under a solid surface,
 * which is what the envelope was reaching for in the first place.
 */
/**
 * …but it cannot be an actual floor. Presence must still reach 0 at both ends,
 * because the melt hands back to a state where these droplets are fully
 * absorbed; a floor left a 0.6 step at the release and moved the centre of mass
 * 113x the journey's median step. So the ramp keeps its endpoints and is made
 * STEEP instead: the cloud crosses the fragile band (where it would come apart
 * into beads) in a fraction of the timeline it used to spend there.
 */
export const BRIDGE_RAMP = 0.25;
/** Exponent turning a form's presence q into its share of visible AREA. */
export const BRIDGE_AREA = 0.55;
/**
 * THE MELT IS ONE BODY OF CONSTANT MASS.
 *
 * Droplet presence is the EXACT COMPLEMENT of the form weight, so the liquid on
 * screen is the same amount at every p — the cloud takes over precisely as much
 * as the form gives up. Its own envelope closed at p≈0.87 while formPhase does
 * not bring the incoming form to full until p=1, and in that gap the droplets
 * were already gone and the form was only ~46% there: total mass fell from 40k
 * to 18.6k and snapped back, which is the "it just appears and vanishes" hole.
 *
 * This is safe because the two really are interchangeable: measured on the page
 * mid-melt, the bridge cloud carries 40861 px against the form's ~40000. That
 * equivalence is what the whole §3.3 design rests on — CLOUDS[n] IS form n's
 * metaball decomposition — and it is worth re-checking with scripts/ if the
 * services scale or the iso level is ever retuned.
 */
export function bridgePresence(p: number): number {
  // Against the forms' PRESENCE, not their field weight. formPresence keeps the
  // weight near 1 for most of a fade and lets EROSION do the visible work, so
  // complementing the weights held the cloud suppressed through most of the
  // melt and the liquid all but disappeared (total mass 3.7k against a resting
  // 40k). These are the same q values formPhase feeds formPresence.
  const qA = 1 - smooth01(p / BRIDGE);
  const qB = smooth01((p - (1 - BRIDGE)) / BRIDGE);
  // A form's visible AREA is not linear in q — erosion pulls the boundary in
  // slowly, so a form at q = 0.5 still covers well over half its footprint.
  // Complementing q directly therefore left both present at the crossovers and
  // the liquid swelled ~70% (38k → 66k). This exponent is the area estimate.
  const area = (q: number) => Math.pow(clamp01(q), BRIDGE_AREA);
  return clamp01(1 - area(qA) - area(qB));
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
  dBuf?: Float32Array,
): number {
  // Keep droplets out of fully solid forms: they take over after the source
  // has started dissolving and drain before the target is already solid.
  //
  // This envelope used to multiply the RADIUS, which is what made every melt
  // shed micro-balls at both ends. Two droplets only neck while their gap is
  // under 0.83 x radius, so scaling all 48 radii toward zero closes every
  // merge in the cloud proportionally — the mass necessarily breaks into
  // separate beads on the way in and again on the way out, and each bead stays
  // fully solid until it is culled, because a metaball's peak field does not
  // depend on its size. Driving DENSITY leaves the geometry (and therefore
  // every neck) intact while the liquid thins into and out of existence.
  const pres = bridgePresence(p);
  for (let i = 0; i < N; i++) {
    const lt = clamp01(p * (1 + STAGGER) - STAGGER * stag[i]);
    const tp = arrive(lt);
    const tr = arrive(clamp01(lt * RADIUS_LEAD));
    const a = A[i],
      b = B[perm[i]];
    const j = (offset + i) * 3;
    buf[j] = a[0] + (b[0] - a[0]) * tp;
    buf[j + 1] = a[1] + (b[1] - a[1]) * tp;
    // Radius rides the SAME steep ramp. It still has to reach 0 at both ends —
    // the melt hands back to a state with no droplets, and leaving radius full
    // there stepped the field's mass and moved the centre of mass ~107x the
    // median. What changed is how long it lingers on the way: the old envelope
    // spent most of each ramp below the merge threshold, which is where the
    // cloud broke into beads.
    buf[j + 2] = (a[2] + (b[2] - a[2]) * tr) * pres;
    if (dBuf) dBuf[offset + i] = pres;
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
    /** Optional packed field DENSITY (1 = solid) the stage uploads as
     *  iBallDensity. The stage refills it with 1 each frame, so a driver only
     *  writes the slots it actually thins. */
    dBuf?: Float32Array,
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
