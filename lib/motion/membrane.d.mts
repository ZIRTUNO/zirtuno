/** Types for the pure vector-liquid kernel (membrane.mjs). Keep in sync. */

export type RestRing = {
  readonly n: number;
  readonly w: number;
  readonly h: number;
  /** Box origin. Absent on rect rings (they start at 0,0); set by `ringRest`. */
  readonly x0?: number;
  readonly y0?: number;
  /** Perimeter length (px). */
  readonly L: number;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  /** 1 where the ring must cusp (the four corners). Empty on a rounded ring. */
  readonly sharp: Uint8Array;
  /** Corner radius, when built rounded. */
  readonly radius?: number;
};

export type MembraneOptions = {
  /** Pressurised bow on the longest edge (px). 0 for a dead-straight edge. */
  bow?: number;
  /** Target arc length per vertex (px). */
  segPx?: number;
  /**
   * Run on an ARBITRARY closed contour instead of on a rectangle — see
   * `ringRest` for the two requirements the points must satisfy. With this set
   * the membrane owns fixed geometry: `resize` is a no-op and the caller scales
   * the result (an SVG viewBox, typically). Everything else behaves identically.
   */
  ring?: RingPoints;
  /** Normal-displacement ceiling (px). Defaults to MEM.MAX_N. */
  maxN?: number;
  /** Hand influence radius (px). Defaults to MEM's button-scaled clamp, or to
   *  0.22 x the ring's short side when `ring` is supplied. */
  handR?: number;
  /**
   * Corner radius (px). Above zero the ring is built with arcs instead of
   * cusps, which changes the SURFACE and not only the silhouette: with no
   * cusps the tension operator is continuous the whole way round, so a wave
   * carries between edges instead of dying in a corner. 0 keeps the authored
   * rectangle, byte for byte.
   */
  radius?: number;
};

/** A ring's displaced points, ready for `splinePath`. */
export type RingPointList = {
  px: number[];
  py: number[];
  sharp: ArrayLike<number> | null;
};

/**
 * Closed uniform Catmull-Rom → cubic Bézier over a point list. `sharp[i]`
 * zeroes vertex i's tangent, which cusps the contour there.
 */
export declare function splinePath(
  px: ArrayLike<number>,
  py: ArrayLike<number>,
  sharp: ArrayLike<number> | null,
): string;

/** Uniform-arc-length ring with true outward normals. */
export type RingPoints = {
  n?: number;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  nx: ArrayLike<number>;
  ny: ArrayLike<number>;
};

export type Membrane = {
  resize(w: number, h: number): void;
  /** Pointer in LOCAL px (origin = the element's top-left). `null` lifts it. */
  hand(x: number | null, y?: number, vx?: number, vy?: number): void;
  press(down: boolean): void;
  strike(
    x: number,
    y: number,
    tMs: number,
    strength?: number,
    /** Fired by the page, not the reader: exempt from the saturation ledger. */
    ambient?: boolean,
  ): void;
  /** One wave as the surface enters view (touch devices). */
  arrive(fromBelow: boolean, tMs: number): void;
  /** Autonomous tide, 0..1 target — faded, never snapped. */
  setTide(on: number): void;
  /** Page scroll speed in px/s — the tide's driver. */
  scroll(pxPerSec: number): void;
  /** Advance to `tMs`. Returns true if the surface moved this call. */
  step(tMs: number): boolean;
  /**
   * The displaced ring as a point list — for callers that need to SPLICE the
   * contour rather than emit it. See `coalesce.mjs`.
   */
  points(offset?: number, push?: ArrayLike<number> | null): RingPointList;
  /**
   * SVG path data. `offset` pushes every vertex out along its normal (px);
   * `push` adds a per-vertex extra outward displacement that is applied at
   * emission and never integrated. Omit both and the output is byte-identical
   * to what it has always emitted.
   */
  path(offset?: number, push?: ArrayLike<number> | null): string;
  /** Enclosed area (px²) — the volume contract's measurement. */
  area(): number;
  /** 0..1 — how much strike energy is still in the surface. */
  charge(): number;
  readonly asleep: boolean;
  /** 0..1 proximity wake. */
  readonly aware: number;
  /** 0..1 smoothed press. */
  readonly pressure: number;
  /** 0..1 — how much of the autonomous tide is faded in. */
  readonly tide: number;
  readonly count: number;
  readonly rest: RestRing;
  /** Read-only normal displacements (px) — harness and debug only. */
  readonly dn: Float32Array;
};

export declare const MEM: {
  readonly H_MS: number;
  readonly MAX_SUB: number;
  readonly OMEGA: number;
  readonly ZETA: number;
  readonly K_TEN: number;
  readonly K_VIS: number;
  readonly OMEGA_T: number;
  readonly ZETA_T: number;
  readonly MAX_T: number;
  readonly MAX_N: number;
  readonly RIM: number;
  readonly HAND_PUSH: number;
  readonly HAND_SWIRL: number;
  readonly HAND_WAKE: number;
  readonly HAND_DRAG: number;
  readonly WAKE_CLAMP: number;
  readonly PRESS_GAIN: number;
  readonly PRESS_TAU: number;
  readonly HAND_R_K: number;
  readonly HAND_R_MIN: number;
  readonly HAND_R_MAX: number;
  readonly SHOCK_SLOTS: number;
  readonly SHOCK_RECOIL: number;
  readonly SHOCK_LAG: number;
  readonly SHOCK_IRREG: number;
  readonly SHOCK_FRONT_JIT: number;
  readonly SHOCK_SATURATE: number;
  readonly SHOCK_LOAD_TAU: number;
  readonly SHOCK_MERGE_MS: number;
  readonly SHOCK_SPEED: number;
  readonly SHOCK_WIDTH: number;
  readonly SHOCK_REACH: number;
  readonly SHOCK_LIFE: number;
  readonly SHOCK_A: number;
  readonly AWARE_R: number;
  readonly AWARE_TAU: number;
  readonly AWARE_TAU_OUT: number;
  readonly BREATH_MS: number;
  readonly BREATH_A: number;
  readonly BREATH_WAVES: number;
  readonly TIDE_A: number;
  readonly TIDE_MS: number;
  readonly TIDE_WAVES: number;
  readonly TIDE_RISE: number;
  readonly TIDE_FALL: number;
  readonly TIDE_SCROLL_A: number;
  readonly TIDE_SCROLL_RATE: number;
  readonly TIDE_SCROLL_CLAMP: number;
  readonly TIDE_SCROLL_TAU: number;
  readonly BOW: number;
  readonly SEG_PX: number;
  readonly N_MIN: number;
  readonly N_MAX: number;
  readonly EPS_D: number;
  readonly EPS_V: number;
};

export declare const hash: (i: number, k: number) => number;

export declare function buildRest(
  w: number,
  h: number,
  opts?: MembraneOptions,
): RestRing;

/**
 * The rest contract built from an arbitrary closed ring, so the kernel can run
 * on the brand mark and not only on buttons. Requires UNIFORM ARC SPACING (the
 * tension term is an index-space Laplacian) and TRUE OUTWARD NORMALS (on a
 * self-intersecting contour these are not recoverable from winding order).
 */
export declare function ringRest(pts: RingPoints): RestRing;

/** The 1-D half of the same material — a secondary CTA's rule. */
export type Thread = {
  resize(w: number, h: number): void;
  hand(x: number | null, y?: number, vx?: number, vy?: number): void;
  press(down: boolean): void;
  strike(x: number, tMs: number): void;
  arrive(fromBelow: boolean, tMs: number): void;
  setTide(on: number): void;
  scroll(pxPerSec: number): void;
  step(tMs: number): boolean;
  /** SVG path data for the ribbon at baseline `y`. */
  path(tMs: number, y?: number): string;
  readonly asleep: boolean;
  /** 0..1 — how far the liquid has run from the pour point. */
  readonly spread: number;
  /** 0..1 — how much of it has arrived. */
  readonly thick: number;
};

export declare const THREAD: {
  readonly THICK: number;
  readonly OMEGA_OUT: number;
  readonly ZETA_OUT: number;
  readonly OMEGA_IN: number;
  readonly ZETA_IN: number;
  readonly PULSE_MS: number;
  readonly PULSE_GAIN: number;
  readonly RECOIL: number;
  readonly AUTO_BODY: number;
  readonly EPS: number;
};

export declare function makeThread(w?: number, h?: number): Thread;

/** The meniscus ribbon: a CLOSED path, so its thickness can taper. */
export declare function threadPath(
  w: number,
  y: number,
  x0: number,
  spread: number,
  thick: number,
  seed?: number,
): string;

/** A lobed closed contour — the commit flood's front. */
export declare function lobedCirclePath(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  n?: number,
): string;

export declare function makeMembrane(
  w?: number,
  h?: number,
  opts?: MembraneOptions,
): Membrane;
