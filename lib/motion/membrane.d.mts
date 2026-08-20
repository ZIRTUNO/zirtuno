/** Types for the pure vector-liquid kernel (membrane.mjs). Keep in sync. */

export type RestRing = {
  readonly n: number;
  readonly w: number;
  readonly h: number;
  /** Perimeter length (px). */
  readonly L: number;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  /** 1 where the ring must cusp (the four corners). */
  readonly sharp: Uint8Array;
};

export type MembraneOptions = {
  /** Pressurised bow on the longest edge (px). 0 for a dead-straight edge. */
  bow?: number;
  /** Target arc length per vertex (px). */
  segPx?: number;
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
  /** SVG path data. `offset` pushes every vertex out along its normal (px). */
  path(offset?: number): string;
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
