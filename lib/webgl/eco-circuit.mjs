// THE CIRCULATION (S4 remake) — the ecosystem as a circulatory system, not a
// scatter diagram. One closed vein loop carries ten capability organs around
// the mark (the client's business — the heart); three arteries feed the
// loop's three systems. The chapter's lead copy IS this drawing: "the brand
// feeds the site, the site feeds traffic, traffic feeds the CRM…" — every
// ring edge is one of those sentences.
//
// This module is the single source of truth for the geometry: the canvas
// beads (site scene), the SVG veins and the DOM labels all evaluate the SAME
// functions, so the liquid, the lines and the type can never drift apart.
// uv space throughout (y up, x centered on 0.5 spanning the aspect).

import { smooth01, hash } from "./phys.mjs";

/** Ring slots (clockwise from top) → i18n `ecosystem.nodes` index. The order
 *  tells the lead's story: Brand → Content → Website → Traffic → Service →
 *  CRM → AI → Automation → Internal systems → Dashboards → back to Brand
 *  (what you see feeds what you say — the loop closes on purpose). */
export const ECO_ORDER = [0, 9, 1, 2, 8, 3, 4, 5, 7, 6];
export const ECO_N = 10;

/** The three organ systems (contiguous ring arcs). */
export const ECO_SYSTEMS = [
  { id: "identity", slots: [0, 1, 2] },
  { id: "growth", slots: [3, 4, 5] },
  { id: "operation", slots: [6, 7, 8, 9] },
];

/** Arteries: the mark pumps into each system's first organ. */
export const ARTERY_SLOTS = [0, 3, 6];

// Ring slot angles (degrees clockwise from top). Three deliberate gaps
// separate the systems; the widest gap sits top-left, giving the composition
// air where the wordmark and chapter copy live.
const ANG = [24, 50, 76, 128, 154, 180, 232, 258, 284, 310];
// authored radial variance — organic, never a compass circle
const RADV = [1.0, 0.955, 1.03, 0.975, 1.045, 0.965, 1.02, 0.96, 1.005, 1.04];

const CX = 0.5;
const CY = 0.5;
const RY = 0.355;

/** Ring radii for a stage aspect: wide stages breathe, narrow stages tuck. */
export function ringRadii(aspect) {
  const halfW = Math.max(aspect, 0.6) / 2;
  const rx = Math.max(Math.min(aspect * 0.37, halfW - 0.115), 0.2);
  return { rx, ry: RY };
}

/** Socket position for ring slot s (uv, y up). */
export function socketPos(s, aspect) {
  const { rx, ry } = ringRadii(aspect);
  const a = (ANG[s] * Math.PI) / 180;
  return {
    x: CX + Math.sin(a) * rx * RADV[s],
    y: CY + Math.cos(a) * ry * RADV[s],
  };
}

/** Outward unit normal at slot s (uv, y up) — labels sit along this. */
export function socketNormal(s) {
  const a = (ANG[s] * Math.PI) / 180;
  return { x: Math.sin(a), y: Math.cos(a) };
}

/** Point on the closed vein loop at u ∈ [0,1) (uv, y up). Slot s sits at
 *  u = s/10; between sockets the loop follows the ellipse (angle + radius
 *  interpolated) — convex by construction, no spline sag, and equal u-time
 *  per segment gives the flow a breathing rhythm across the system gaps. */
export function ringPoint(u, aspect) {
  const uu = ((u % 1) + 1) % 1;
  const s = Math.floor(uu * ECO_N);
  const t = uu * ECO_N - s;
  const a0 = ANG[s];
  const a1 = s + 1 < ECO_N ? ANG[s + 1] : ANG[0] + 360;
  const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
  const rv = RADV[s] + (RADV[(s + 1) % ECO_N] - RADV[s]) * t;
  const { rx, ry } = ringRadii(aspect);
  return { x: CX + Math.sin(a) * rx * rv, y: CY + Math.cos(a) * ry * rv };
}

/** Point along artery a (0..2) at f ∈ [0,1]: mark edge → head socket. A slight
 *  authored bow keeps the supply lines organic. */
export function arteryPoint(a, f, aspect) {
  const s = ARTERY_SLOTS[a];
  const end = socketPos(s, aspect);
  const n = socketNormal(s);
  const start = { x: CX + n.x * 0.205 * Math.min(aspect, 1.2), y: CY + n.y * 0.2 };
  const mx = (start.x + end.x) / 2 - n.y * 0.03 * (a === 1 ? -1 : 1);
  const my = (start.y + end.y) / 2 + n.x * 0.03 * (a === 1 ? -1 : 1);
  const g = 1 - f;
  return {
    x: g * g * start.x + 2 * g * f * mx + f * f * end.x,
    y: g * g * start.y + 2 * g * f * my + f * f * end.y,
  };
}

// ── the assembly score (grow ∈ [0,1] is the master clock) ────────────────────
// arteries extend → each system's organs ignite in sequence → the three
// bridge segments close the loop → one circulation pulse seals it.
const ART_T = [
  { d: 0.02, w: 0.14 },
  { d: 0.1, w: 0.14 },
  { d: 0.18, w: 0.14 },
];
const SYS_OF_SLOT = [];
ECO_SYSTEMS.forEach((sys, si) =>
  sys.slots.forEach((s, wi) => (SYS_OF_SLOT[s] = { si, wi })),
);

/** Ignition timing for organ slot s → {d, w} (delay, window) on the clock. */
export function nodeTiming(s) {
  const { si, wi } = SYS_OF_SLOT[s];
  return { d: ART_T[si].d + 0.12 + wi * 0.075, w: 0.12 };
}

/** Artery a extension timing. */
export function arteryTiming(a) {
  return ART_T[a];
}

/** Ring segment s (socket s → s+1) draw timing. Segments inside a system
 *  draw with their later organ; the three system bridges close last. */
export function edgeTiming(s) {
  const to = (s + 1) % ECO_N;
  const a = SYS_OF_SLOT[s];
  const b = SYS_OF_SLOT[to];
  if (a.si === b.si) {
    const t = nodeTiming(to);
    return { d: t.d + 0.02, w: 0.12 };
  }
  // bridges: growth←identity, operation←growth, identity←operation (closure)
  return { d: 0.68 + a.si * 0.055, w: 0.11 };
}

export const env = (grow, t) => smooth01((grow - t.d) / t.w);

/** The loop-closure pulse: a bright band travelling the whole ring across
 *  grow ∈ [0.84, 1]. Pure function of grow — scrub-safe, reversible. */
export function closurePulse(grow, u) {
  const p = (grow - 0.84) / 0.16;
  if (p <= 0 || p >= 1) return 0;
  let d = Math.abs(((u % 1) + 1) % 1 - p);
  d = Math.min(d, 1 - d);
  return smooth01((0.07 - d) / 0.07) * Math.sin(Math.PI * p);
}

// ── circulation beads (the site scene's droplet allocation, i < 40) ──────────
// i 0..9   dock droplets (one per organ socket)
// i 10..21 artery supply beads (4 per artery)
// i 22..39 ring circulation beads (18 on the closed loop)
export const DOCK_OF = (i) => (i < ECO_N ? i : -1);
export const ARTERY_OF = (i) =>
  i >= 10 && i < 22 ? Math.floor((i - 10) / 4) : -1;
export const RING_BEADS = 18;
export const RING_PHASE = (i) => {
  const k = i - 22;
  return k / RING_BEADS + 0.35 * hash(i, 21) / RING_BEADS;
};
export const RING_SPEED = 0.0135; // loops/s — a slow, deliberate metabolism
export const ARTERY_PERIOD = 6.5; // s per supply pulse

// ── the response graph (hover/focus propagation) ─────────────────────────────
// organs 0..9 + the mark (10). Edges: ring neighbours + artery heads ↔ mark.
const ADJ = [];
for (let s = 0; s < ECO_N; s++) ADJ.push([]);
ADJ.push([]); // the mark
for (let s = 0; s < ECO_N; s++) {
  const to = (s + 1) % ECO_N;
  ADJ[s].push(to);
  ADJ[to].push(s);
}
for (const s of ARTERY_SLOTS) {
  ADJ[s].push(ECO_N);
  ADJ[ECO_N].push(s);
}

/** BFS hop distance from organ `origin` to every graph node (incl. mark). */
export function pulseDistances(origin) {
  const dist = new Array(ECO_N + 1).fill(Infinity);
  dist[origin] = 0;
  const q = [origin];
  while (q.length) {
    const n = q.shift();
    for (const m of ADJ[n])
      if (dist[m] === Infinity) {
        dist[m] = dist[n] + 1;
        q.push(m);
      }
  }
  return dist;
}
