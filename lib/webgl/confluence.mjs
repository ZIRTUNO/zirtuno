/**
 * THE CONFLUENCE (S3) — the symbol the gathering RESOLVES INTO, made of the
 * liquid itself.
 *
 * What this replaces: the fuse used to hand the stage to form 0, the Zirtuno
 * mark, rasterised from an SVG into a signed-distance texture. That was the one
 * thing on the page arguing against the chapter's own claim. The gathering says
 * "nothing is drawn between them — they stop being separate", and then a vector
 * logo faded up on top of the liquid that had just done the work; the droplets
 * were deleted underneath it (`densJ = 1 - fused`) so they could not inflate
 * the silhouette. The last frame of a two-and-a-half-viewport convergence was a
 * picture of a brand mark, not the result of anything.
 *
 * So the resolution is a SYMBOL WITH NO VECTOR BEHIND IT — a shape that exists
 * only as the 48 droplets standing in the right places:
 *
 *     THREE ARMS running in from the three systems,
 *     merged into ONE CORE.
 *
 * Every part of it is already in the chapter, which is the entire point:
 *   · the masses are the three AUTHORED SYSTEMS (gathering.mjs's LOBES), on the
 *     same three uneven bearings the capabilities have been arriving along for
 *     the whole runway — so the fuse TIGHTENS a composition the reader has been
 *     watching build, instead of cutting to a new one;
 *   · each mass is sized by its own node count (identity 3, growth 3,
 *     operation 4), so operation is visibly the broadest base — which is what
 *     LOBES already says in `spread`;
 *   · the core is the CONNECTIVE LIQUID (droplets 30-47, the ones with no
 *     capability of their own, which the site scene has always described as
 *     "the body the capabilities arrive into"). It is what the three systems
 *     become — the chapter's own sentence, "brand, presence, acquisition and
 *     operations need to share context", as geometry;
 *   · and it is one substance, not three joined. "What the client sees and
 *     what the team operates become part of the same structure" is the closing
 *     line of the chapter; this is that line with nothing drawn between.
 *
 * WHY THIS SHAPE AND NOT A FINER ONE. The field is Sum r^2/d^2 thresholded at
 * T = 1, each ball windowed to SDF_BALL_REACH x its own radius. Two
 * consequences decide everything below. Two droplets neck only while their gap
 * is under 0.83 x radius, so any STROKE is a chain and its spacing is a hard
 * constraint rather than a preference. And an enclosed void survives only where
 * every ball around it falls outside its own window, so a hole has to be
 * genuinely large against the stroke enclosing it. Fine linear structure — a
 * spiral, a knot, a monogram, a logo — is not renderable in this material at
 * 0.4 uv, which is exactly why the mark needed an SDF in the first place. What
 * IS renderable, with no spacing constraint at all, is a solid body: see the
 * note on ARMS below for the two shapes that were built, measured and rejected
 * before this one.
 *
 * PURITY: pure math, deterministic, node-runnable (the phys.mjs / gathering.mjs
 * convention). CLOUD SPACE throughout — [0,1]^2, centre 0.5, +y up, radii in the
 * same units as CLOUDS — so a station reaches the stage through the scene's
 * existing `0.5 + jOx + (x - 0.5) * jScale` like every other cloud, the melt
 * kernel can morph it into a pillar form with no special case, and
 * scripts/_melt-sim.mjs can render it off-GPU.
 *
 * Gated by scripts/verify-confluence.mjs, which renders the real field and
 * asserts the properties this file claims: one body, one hole, no loose beads.
 */

import { hash } from "./phys.mjs";
import {
  GATHER_SYSTEMS,
  GATHER_FAMILY,
  GATHER_DROPS,
  lobeBearing,
} from "./gathering.mjs";

/** Total droplets the symbol stations — the canonical budget. */
export const CONFLUENCE_N = 48;
/** Droplets with no capability of their own: the connective liquid, which is
 *  the CORE the three arms merge into. */
export const CORE_DROPS = CONFLUENCE_N - GATHER_DROPS; // 18

// ── the three bearings ───────────────────────────────────────────────────────
// Read off gathering.mjs's LOBES rather than re-authored, so the symbol cannot
// drift away from the constellation the runway spends three viewports
// assembling. gatherAnchor scales dx by the field's half-width (aspect) and dy
// by a fixed 0.32, so a lobe's RENDERED bearing moves a few degrees with the
// viewport — identity swings 142 deg to 152 deg between aspect 1.33 and 2.0.
// The symbol is a cloud, one shape at every aspect, so it is fixed at the
// middle of that range rather than tracking it: 5 deg at the extremes is
// invisible, and a symbol whose proportions changed with the window would not
// be a symbol.
const REF_ASPECT = 1.6;

/** Bearing of each system's mass, in the order GATHER_SYSTEMS lists them. */
export const BEARINGS = GATHER_SYSTEMS.map((_, si) =>
  lobeBearing(si, REF_ASPECT),
);

// ── WHY ARMS AND A CORE, AND NOT A RING ──────────────────────────────────────
// Two shapes were built and measured before this one, and both failed on the
// same budget. Three masses joined by thin necks: eighteen connective droplets
// cannot cover half a loop's arc at a spacing that reads as liquid, so every
// neck rendered as a visible string of beads (scripts/_confluence-sweep.mjs
// scores that as `ripple`). One closed loop with all 48 droplets on it: smooth,
// but a closed chain of n droplets at a smooth spacing has a FIXED stroke-to-
// diameter ratio — swept across 720 candidates, the best lobe-to-neck thickness
// the loop could hold without beading was 1.3 : 1, which is a doughnut, not
// three systems.
//
// What 48 metaballs render beautifully is a SOLID body: droplets piled two
// dimensionally have no spacing constraint at all, which is exactly why the
// seven pillar clouds (CLOUDS[1..7], each a 48-ball decomposition of a real
// vector form) hold their silhouettes. So the symbol is solid — and the solid
// form the chapter is actually asking for is the convergence itself:
//
//     THREE ARMS running in from the three systems' own bearings,
//     merging into ONE CORE.
//
// Each arm carries its system's capabilities in the order the column lists
// them, seated from the core outward, tapering to a rounded tip; the core is
// the connective liquid the site scene has always called "the body the
// capabilities arrive into". Nothing is added and nothing is decorative: the
// ten masses that have been travelling for three viewports arrive along three
// channels and become one substance, which is the chapter's sentence exactly.
//
// The arms sweep slightly rather than radiating straight, because a straight
// three-pointed star is a diagram and a swept one is a flow — and the direction
// of the sweep is the direction the liquid has been travelling all chapter.
const ARM_TIP = 0.36; // core centre → the tip of a three-node arm
const ARM_ROOT = 0.07; // …and where inside the core it begins
// The sweep runs COUNTER to the arms' own order around the body. Swept the
// other way the arms trail into each other and the two upper ones merge into a
// single wing — measured, the notch between them sits at 57% of the arms'
// reach, which is a dart, not three systems. Against the order they separate:
// the same notch drops to 34% and all three read.
const ARM_SWEEP = -0.3; // radians of curl from root to tip
const ARM_EASE = 1.3; // >1 = stations bunch toward the tip, which rounds it
const ARM_WIDE = 0.05; // extra reach and girth per node above three
const ARM_BALL_ROOT = 0.038; // droplet radius where the arm leaves the core…
const ARM_BALL_TIP = 0.028; // …and at its tip
const ARM_BALL_VAR = 0.06; // per-droplet variety (never a row of equal dots)
const CORE_R = 0.085; // radius the connective droplets pack into
const CORE_BALL = 0.033;
const CORE_BALL_VAR = 0.08;

const TAU = Math.PI * 2;
/** Golden angle — the packing that fills a disc without rings or seams. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// ── the station table ────────────────────────────────────────────────────────
// Built once at module load. Index = DROPLET index, so a station is addressable
// by the same `i` the scene already carries: droplets 0-29 are the ten
// capabilities (three each — NODE_OF(i) = i/3, the site scene's own
// allocation), droplets 30-47 are the connective liquid.
const STATIONS = new Array(CONFLUENCE_N);
/** Which arm a droplet belongs to, or -1 for the core. Lets the fuse send each
 *  capability home along its OWN channel rather than as one collapse. */
const ARM_OF_DROP = new Int8Array(CONFLUENCE_N).fill(-1);

{
  GATHER_SYSTEMS.forEach((sys, si) => {
    const n = sys.nodes.length * GATHER_FAMILY;
    // A system with four capabilities reaches further and runs thicker than one
    // with three — the same thing LOBES already says with `spread`, and the
    // reason operation reads as the broadest of the three.
    const gain = 1 + ARM_WIDE * (sys.nodes.length - 3);
    let j = 0;
    sys.nodes.forEach((node) => {
      for (let k = 0; k < GATHER_FAMILY; k++, j++) {
        const u = n > 1 ? j / (n - 1) : 0; // 0 = at the core, 1 = the tip
        // Stations bunch toward the tip, so the taper ends in a ROUNDED cap
        // rather than a needle: a lone small droplet at the end of a chain is
        // the one place this material always shows its beads.
        const e = 1 - Math.pow(1 - u, ARM_EASE);
        const rad = ARM_ROOT + (ARM_TIP * gain - ARM_ROOT) * e;
        const th = BEARINGS[si] + ARM_SWEEP * e * e;
        const rr = (ARM_BALL_ROOT + (ARM_BALL_TIP - ARM_BALL_ROOT) * e) * gain;
        const i = node * GATHER_FAMILY + k;
        STATIONS[i] = [
          0.5 + rad * Math.cos(th),
          0.5 + rad * Math.sin(th),
          rr * (1 + ARM_BALL_VAR * (hash(i, 84) - 0.5) * 2),
        ];
        ARM_OF_DROP[i] = si;
      }
    });
  });

  // the core — a golden-angle disc, so eighteen droplets fill it evenly with no
  // rings, no seams and no preferred direction for the arms to argue with
  for (let m = 0; m < CORE_DROPS; m++) {
    const i = GATHER_DROPS + m;
    const rad = CORE_R * Math.sqrt((m + 0.5) / CORE_DROPS);
    const th = m * GOLDEN;
    STATIONS[i] = [
      0.5 + rad * Math.cos(th),
      0.5 + rad * Math.sin(th),
      CORE_BALL * (1 + CORE_BALL_VAR * (hash(i, 84) - 0.5) * 2),
    ];
  }

  // RECENTRE on the silhouette's own bounding box. The three bearings are
  // deliberately uneven (gathering.mjs: "equal thirds would rebuild the compass
  // this design exists to avoid"), so the body's centre of area is not the
  // origin the arms were built around — and every downstream consumer, from
  // jOx/jOy to the crossing melt to the static fallback, assumes a cloud is
  // centred on 0.5. Half a station's radius of drift is enough to read as the
  // symbol sitting off its own mark.
  let x0 = 1;
  let x1 = 0;
  let y0 = 1;
  let y1 = 0;
  for (const [x, y, r] of STATIONS) {
    if (x - r < x0) x0 = x - r;
    if (x + r > x1) x1 = x + r;
    if (y - r < y0) y0 = y - r;
    if (y + r > y1) y1 = y + r;
  }
  const dx = 0.5 - (x0 + x1) / 2;
  const dy = 0.5 - (y0 + y1) / 2;
  for (const b of STATIONS) {
    b[0] += dx;
    b[1] += dy;
  }
}

/** Which arm droplet `i` runs along, or -1 if it is core. */
export const armOf = (i) => ARM_OF_DROP[i];

/**
 * Each arm's droplets IN SEATING ORDER, core → tip.
 *
 * Not the same as index order, and the difference matters to anything walking
 * an arm: a system's nodes are authored in reading order (identity is
 * [0, 9, 1]), so droplet indices jump — 0,1,2 then 27,28,29 then 3,4,5. Walking
 * the index order instead zig-zags up and down the arm, which silently doubled
 * the measured arm length in the first version of the gate.
 */
export const ARM_SEQ = GATHER_SYSTEMS.map((sys) =>
  sys.nodes.flatMap((node) =>
    Array.from({ length: GATHER_FAMILY }, (_, k) => node * GATHER_FAMILY + k),
  ),
);

/** Centroid of the core — the point every arm runs into. */
export const CORE_CENTRE = (() => {
  let x = 0;
  let y = 0;
  for (let i = GATHER_DROPS; i < CONFLUENCE_N; i++) {
    x += STATIONS[i][0];
    y += STATIONS[i][1];
  }
  return { x: x / CORE_DROPS, y: y / CORE_DROPS };
})();

/**
 * THE CONFLUENCE as a canonical 48-ball cloud, in the same [x, y, r] cloud
 * space as CLOUDS — so melt.mjs's matchClouds/meltDroplet morph it into a
 * pillar form with no special case at all, and the crossing out of S3 is the
 * site's own melt vocabulary rather than a bespoke transition.
 */
export const CONFLUENCE = STATIONS;

/** Stagger key for the melt schedule: the droplet's x in the source form. */
export const CONFLUENCE_STAG = STATIONS.map((b) => b[0]);

/** The tip of system `si`'s arm — where its capabilities arrive from. */
export function armTip(si) {
  const sys = GATHER_SYSTEMS[si];
  const last = sys.nodes[sys.nodes.length - 1] * GATHER_FAMILY + GATHER_FAMILY - 1;
  return { x: STATIONS[last][0], y: STATIONS[last][1] };
}

// ── THE CIRCULATION ──────────────────────────────────────────────────────────
// A resolved form that holds still reads as an image being scrolled past — the
// exact defect SVC_CHURN exists to answer for the pillar silhouettes. That
// device is a warp on the FORM sample, and this symbol has no form, so it needs
// the droplet-side equivalent.
//
// It is not new ornament, and it is not a pulse. The one thing this body claims
// is that the three systems now feed one business, so what moves is the FEED
// ITSELF: a slow wave running down each arm toward the core and swelling it as
// it lands, over and over. Phase comes from the station's own distance from the
// centre, so the wave is continuous along every arm by construction and needs
// no per-droplet bookkeeping — and the core, where every arm ends, breathes on
// the sum of all three.
const CIRC_RATE = 0.11; // waves per second down an arm — one every ~9 s
const CIRC_WAVE = 5.6; // spatial frequency (radians per cloud unit of radius)
const CIRC_SWELL = 0.09; // radius, as a fraction of the droplet's own
const CIRC_DRIFT = 0.009; // radial excursion in cloud units

/** Each station's distance and direction from the body's centre. */
const RAD = STATIONS.map((b) => Math.hypot(b[0] - 0.5, b[1] - 0.5));
const DIR = STATIONS.map((b, i) => {
  const d = Math.max(RAD[i], 1e-6);
  return [(b[0] - 0.5) / d, (b[1] - 0.5) / d];
});

/**
 * The circulation's contribution for droplet `i` at time `t` (seconds), written
 * into `out` as [dx, dy, radius multiplier]. Amplitude is the caller's: the
 * scene fades it in with the fuse and out again as the crossing melt takes the
 * body, so both endpoints are the exact station table.
 */
export function circulate(out, i, t, amp = 1) {
  const w = RAD[i] * CIRC_WAVE - t * CIRC_RATE * TAU;
  const s = Math.sin(w);
  // a second, slower octave keeps three arms from ever pulsing in lockstep
  const s2 = Math.sin(0.5 * w + 1.7 + hash(i, 86) * 2.2);
  const drift = CIRC_DRIFT * amp * (s + 0.35 * s2);
  out[0] = DIR[i][0] * drift;
  out[1] = DIR[i][1] * drift;
  out[2] = 1 + CIRC_SWELL * amp * (s * 0.75 + 0.25 * s2);
  return out;
}
