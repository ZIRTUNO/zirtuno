// THE GATHERING (S3 remake) — the ecosystem as a convergence in DEPTH.
//
// The Problem leaves the liquid fractured and dispersed: the client's tools,
// each working alone. This chapter is the answer, and the answer is not a
// diagram of boxes joined by lines — it is those same fragments being drawn
// forward out of the dark until they are one body.
//
// Depth carries the argument. Every capability starts FAR (z → 1: dim, small,
// absorbed toward the sub-surface grade the shader already applies) and
// scattered across the full bleed. Scroll pulls each one FORWARD (z → 0) and
// INWARD at the same time, so a scattered, distant, half-lit field resolves
// into a near, bright, single mass. Nothing is drawn between them; they simply
// stop being separate — which is the claim the chapter makes in words.
//
// The ten capabilities arrive in the three authored systems, so the reader gets
// three beats rather than ten. Each system is a LOBE around the mark, not a
// slot on a circle: a compass ring reads as a diagram, and three organic
// clusters read as anatomy.
//
// Single source of truth for the geometry: the
// canvas masses (site scene) and the DOM labels evaluate the SAME functions, so
// the liquid and the type can never drift apart. uv space throughout (y up, x
// centred on 0.5 spanning the aspect).

import { smooth01, hash } from "./phys.mjs";

export const GATHER_N = 10;

/**
 * The three organ systems, as indices into the authored `ecosystem.nodes`.
 * This grouping is the business truth and is carried over unchanged from the
 * circuit: identity = brand/content/site, growth = traffic/service/CRM,
 * operation = AI/automation/internal systems/dashboards.
 */
export const GATHER_SYSTEMS = [
  { id: "identity", nodes: [0, 9, 1] },
  { id: "growth", nodes: [2, 8, 3] },
  { id: "operation", nodes: [4, 5, 7, 6] },
];

/** node index → { system index, position within the system } */
export const SYS_OF_NODE = [];
GATHER_SYSTEMS.forEach((sys, si) =>
  sys.nodes.forEach((n, wi) => (SYS_OF_NODE[n] = { si, wi })),
);

// ── the three lobes ──────────────────────────────────────────────────────────
// Direction and reach of each system's cluster from the mark. Deliberately
// uneven: equal thirds would rebuild the compass this design exists to avoid.
// x is scaled by aspect at evaluation so the lobes open out on wide stages and
// tuck in on narrow ones without ever leaving the frame.
const LOBES = [
  { dx: -0.62, dy: 0.46, spread: 0.115 }, // identity — upper left, where the copy ends
  { dx: 0.78, dy: 0.1, spread: 0.125 }, // growth — right, the widest reach
  { dx: -0.12, dy: -0.62, spread: 0.135 }, // operation — below, the broadest base
];

// Per-capability offset inside its lobe. Authored rather than hashed: these are
// read with type beside them, so the clusters need to be legible, not random.
const IN_LOBE = [
  [-0.42, 0.5],
  [0.55, 0.16],
  [-0.2, -0.55],
  [0.5, -0.42],
];

const CX = 0.5;
const CY = 0.5;

/** Horizontal half-extent available to the lobes at a given stage aspect. */
function reach(aspect) {
  return Math.min(Math.max(aspect, 0.62) * 0.34, 0.62);
}

/**
 * Where capability `n` rests once it has been gathered (uv, y up).
 * This is the NEAR anchor — the position the mass holds while the system is
 * assembled and the label is readable.
 */
export function gatherAnchor(n, aspect) {
  const { si, wi } = SYS_OF_NODE[n];
  const lobe = LOBES[si];
  const off = IN_LOBE[wi % IN_LOBE.length];
  const rx = reach(aspect);
  return {
    x: CX + (lobe.dx + off[0] * lobe.spread * 3.1) * rx,
    y: CY + (lobe.dy + off[1] * lobe.spread * 2.0) * 0.34,
  };
}

/**
 * Ignition timing for capability `n` on the gather clock. The systems arrive in
 * order and overlap slightly — a hard sequence would read as a playlist, and
 * the overlap is what makes it look like one process with three phases.
 */
export function gatherTiming(n) {
  const { si, wi } = SYS_OF_NODE[n];
  return { d: 0.06 + si * 0.235 + wi * 0.045, w: 0.2 };
}

/** System `si`'s own envelope — drives the reach markers in the DOM. */
export function systemTiming(si) {
  return { d: 0.06 + si * 0.235, w: 0.26 };
}

export const env = (p, t) => smooth01((p - t.d) / t.w);

/**
 * Depth for capability `n` at gather progress `p`.
 *
 * 1 = far (the shader's depth grade dims it toward sub-surface), 0 = near. The
 * curve leads the positional arrival slightly: a mass brightens as it commits
 * to coming forward, before it has finished travelling. That lead is what makes
 * the convergence feel like it is being pulled rather than played back.
 */
export function gatherDepth(n, p) {
  const t = gatherTiming(n);
  return 1 - env(p, { d: t.d, w: t.w * 0.78 });
}

/**
 * The closing fuse: once every system has landed, the three lobes are drawn
 * into the single body. Pure function of p (scrub-safe, reversible), and 0
 * until the last capability has arrived so nothing collapses early.
 */
export function fuse(p) {
  return smooth01((p - 0.82) / 0.18);
}

/**
 * A capability's own arrival pulse — a short swell as its mass lands, used to
 * brighten both the bead and its label at the same instant. Peaks at the
 * moment of arrival and decays; never a step.
 */
export function arrivalPulse(n, p) {
  const t = gatherTiming(n);
  const u = (p - t.d) / t.w;
  if (u <= 0 || u >= 1.6) return 0;
  return Math.sin(Math.PI * Math.min(u / 1.6, 1)) ** 2;
}

// ── droplet allocation (the site scene, i < 40) ──────────────────────────────
// Each capability owns a small FAMILY of droplets rather than one bead: a lone
// disc per capability is a bullet point, while three or four that hold together
// under cohesion and merge on arrival read as a body of liquid. The families
// share a cluster id so fluid-core's cohesion keeps them together in flight.
export const GATHER_FAMILY = 3; // droplets per capability (10 × 3 = 30)
export const GATHER_DROPS = GATHER_N * GATHER_FAMILY;

/** droplet i → capability index, or -1 if it is not part of the gathering. */
export const NODE_OF = (i) => (i < GATHER_DROPS ? Math.floor(i / GATHER_FAMILY) : -1);

/**
 * Offset of droplet `i` inside its capability's family (uv). Hash-seeded so the
 * families are irregular, scaled so they read as one mass rather than a row.
 */
export function familyOffset(i) {
  const k = i % GATHER_FAMILY;
  const a = hash(i, 61) * Math.PI * 2;
  const d = 0.006 + 0.013 * hash(i, 62);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, lead: k / GATHER_FAMILY };
}

/** Visible radius of a gathered droplet: far liquid is small, near liquid full. */
export function gatherRadius(i, depth, pulse) {
  const base = 0.0125 + 0.0075 * hash(i, 63);
  // perspective, not just dimming — the shader's depth grade handles light, and
  // this handles size, so a far mass is genuinely a smaller thing further away
  return base * (0.42 + 0.58 * (1 - depth)) * (1 + 0.34 * pulse);
}
