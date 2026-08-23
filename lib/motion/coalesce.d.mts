/** Types for the merge kernel (coalesce.mjs). Keep in sync by hand. */

import type { Membrane, RingPoints } from "./membrane.d.mts";

/** A signed distance field in some shared 2-D space. */
export type Sdf = (x: number, y: number) => number;

/**
 * The minimum a merging body has to expose. `makeBead` satisfies it, and so
 * does a plain literal — which is what lets `verify-coalesce.mjs` drive the
 * geometry directly, without a clock.
 */
export type Body = {
  /** Centre, in the same space as `sdf`. */
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** 0..n — velocity elongation, area-preserving. */
  readonly stretch: number;
  /** Unit velocity: the stretch axis. */
  readonly ux: number;
  readonly uy: number;
  /** False once it has drained below `COAL.EPS_R`; nothing is drawn. */
  readonly alive: boolean;
  readonly sdf: Sdf;
};

export type Bead = Body & {
  /** Aim at a point on an edge whose outward normal is (nx, ny). */
  target(
    x: number,
    y: number,
    edgeNx: number,
    edgeNy: number,
    radius: number,
  ): void;
  /** Lose mass in place and stop being drawn. */
  drain(): void;
  /** Advance to `tMs`. Returns true if anything moved this call. */
  step(tMs: number): boolean;
  readonly seed: number;
  readonly speed: number;
};

/** The contiguous run of ridable vertices on one vertical side. */
export type SideRun = {
  /** Ring index of the run's first interior vertex. */
  start: number;
  len: number;
  /** The cusps bounding it — interpolation anchors, never replaced. */
  pre: number;
  post: number;
};

export type UnionOptions = {
  /** −1 for the left side (the default), +1 for the right. */
  sideX?: number;
  /** Blend radius override. Defaults to `COAL.K`. */
  k?: number;
};

export type UnionResult = {
  /** SVG path data for the whole contour, merge spliced in. */
  d: string;
  /** True once the contour has wrapped the body — do not draw it twice. */
  merged: boolean;
};

export declare const COAL: {
  readonly R: number;
  readonly K: number;
  readonly RING_N: number;
  readonly LOBE: number;
  readonly OMEGA: number;
  readonly ZETA: number;
  readonly OMEGA_R: number;
  readonly ZETA_R: number;
  readonly LIFT_MAX: number;
  readonly LIFT_V: number;
  readonly LIFT_TAU: number;
  readonly STRETCH_K: number;
  readonly STRETCH_V: number;
  readonly STRETCH_TAU: number;
  readonly WIN_N: number;
  readonly CORNER_KEEP: number;
  readonly SCAN: number;
  readonly BISECT: number;
  readonly EPS_R: number;
};

/** Polynomial smooth-minimum. Returns `a` EXACTLY when `b >= k`. */
export declare function smin(a: number, b: number, k: number): number;

/** Signed distance to an axis-aligned box. */
export declare function sdBox(
  qx: number,
  qy: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): number;

/**
 * How far the union surface sits beyond a point ON one surface, along that
 * surface's outward normal. Exactly 0 when the other body is `k` or further.
 */
export declare function unionReach(
  px: number,
  py: number,
  nx: number,
  ny: number,
  other: Sdf,
  k: number,
  limit: number,
): number;

/** A lobed near-circular ring centred on the origin, for `makeMembrane`. */
export declare function dropRing(
  r?: number,
  n?: number,
  seed?: number,
): RingPoints;

export declare function makeBead(seed?: number): Bead;

/** The ridable run on one vertical side, or null if there is none. */
export declare function sideRun(
  rest: Membrane["rest"],
  sideX?: number,
): SideRun | null;

/**
 * One membrane and one body, emitted as one path. Byte-identical to
 * `mem.path()` whenever the body is out of reach or drained.
 */
export declare function unionContour(
  mem: Membrane,
  bead: Body,
  opts?: UnionOptions,
): UnionResult;

/**
 * The body drawn as its own contour — only valid while `unionContour` reports
 * it unmerged. It reaches toward nothing: see the implementation for why the
 * approaching surface owns the meniscus alone.
 */
export declare function beadContour(mem: Membrane, bead: Body): string;
