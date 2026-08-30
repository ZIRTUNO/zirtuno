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
  /** Arithmetically finished — the sleep signal. */
  readonly settled: boolean;
  /** Visually finished — what an autonomous tour should pace off. */
  readonly arrived: boolean;
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
  /**
   * Whether this field HOLDS the drop (default true) or merely leans toward
   * one going past. Exactly one field may own it, or two would each draw the
   * bulb.
   */
  own?: boolean;
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
  readonly FIELD_R: number;
  readonly NECK: {
    readonly BREAK: number;
    readonly BASE: number;
    readonly BASE_TAPER: number;
    readonly WAIST: number;
    readonly WAIST_TAPER: number;
    readonly WAIST_MIN: number;
    readonly HORN_P: number;
    readonly FILLET: number;
    readonly SHOULDER: number;
    readonly N: number;
    readonly SMOOTH: number;
  };
  readonly LEAN_A: number;
  readonly LEAN_R: number;
  readonly LEAN_W: number;
  readonly RING_N: number;
  readonly LOBE: number;
  readonly OMEGA: number;
  readonly ZETA: number;
  readonly TARGET_TAU: number;
  readonly OMEGA_R: number;
  readonly ZETA_R: number;
  readonly LIFT_MAX: number;
  readonly LIFT_V: number;
  readonly LIFT_TAU_OUT: number;
  readonly LIFT_TAU_IN: number;
  readonly STRETCH_K: number;
  readonly STRETCH_V: number;
  readonly STRETCH_TAU_OUT: number;
  readonly STRETCH_TAU_IN: number;
  readonly EPS_R: number;
  readonly ARRIVE_LIFT: number;
  readonly PINCH_KICK: number;
};

/** Where sample i sits along the neck's axis. Cosine-spaced: dense at both ends. */
export declare function neckA(i: number, n: number, aTip: number): number;

/** Half-width of the filament at each sample. Fills `out`; returns its shape. */
export declare function neckProfile(
  L: number,
  r: number,
  out: Float64Array,
): { base: number; waist: number; connected: boolean };

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
