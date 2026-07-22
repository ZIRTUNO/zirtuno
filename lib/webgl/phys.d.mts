/** Types for the pure physics/droplet kernel (phys.mjs). Keep in sync. */

export type Ball = readonly [number, number, number];

/** A dispersed/cluster target with stagger key + drift frequencies. */
export type ScatterTarget = {
  tx: number;
  ty: number;
  key: number;
  f1: number;
  f2: number;
};

export declare const CLOUDS: Ball[][];
export declare const N: number;
export declare const STATE_COUNT: number;
export declare const STAG: number[][];

export declare const clamp01: (x: number) => number;
export declare const smooth01: (x: number) => number;
export declare const hash: (i: number, k: number) => number;

export declare const PHYS: {
  readonly TAU_CHANNEL: number;
  readonly TAU_DROP_MIN: number;
  readonly TAU_DROP_MAX: number;
  readonly TAU_RADIUS: number;
  readonly TAU_VEL: number;
  readonly DRIFT: number;
  readonly STIR: number;
  readonly AMBIENT_N: number;
  readonly AMBIENT_R: number;
  readonly AMBIENT_R_VAR: number;
  readonly AMBIENT_Z: number;
};

export declare const VARY: number[];
export declare const TAUP: number[];

export type AmbientDroplet = {
  fx: number;
  ay: number;
  r: number;
  f1: number;
  f2: number;
  f3: number;
  f4: number;
  p1: number;
  p2: number;
  p3: number;
  stir: number;
};
export declare const AMB: AmbientDroplet[];

export declare function scatterFor(state: number): ScatterTarget[];
export declare function wideScatter(
  aspect: number,
  cx: number,
  cy: number,
  spread: number,
): ScatterTarget[];
export declare function clusterTargets(
  aspect: number,
  cx: number,
): ScatterTarget[];
export declare function convergeEnvelopes(p: number): {
  q: number;
  rEnv: number;
  shed: number;
};

export declare const ORGANISM_SCALE: number;
