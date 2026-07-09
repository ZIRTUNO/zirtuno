/** Types for the fluid physics core (fluid-core.mjs). Keep in sync. */

export declare const FLUID: {
  readonly H_MS: number;
  readonly OMEGA_K: number;
  readonly REP_RANGE: number;
  readonly REP_A: number;
  readonly COH_A: number;
  readonly CURL_V: number;
  readonly CURSOR_RADIUS: number;
  readonly CURSOR_PUSH: number;
  readonly CURSOR_SWIRL: number;
  readonly CURSOR_DRAG: number;
  readonly V_MAX: number;
  readonly SAT_POOL: number;
  readonly SAT_STRAIN: number;
  readonly SAT_BIND_MAX: number;
  readonly SAT_COOLDOWN: number;
  readonly SAT_TTL_MIN: number;
  readonly SAT_TTL_VAR: number;
  readonly SAT_R: number;
};

export type FluidEnv = {
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  pon: boolean;
  vel: number;
};

export type FluidCore = {
  /** Advance the fluid; writes OUTPUT positions into P (n*2). */
  step(
    P: Float32Array,
    T: Float32Array,
    BIND: Float32Array,
    CLUS: Int16Array,
    R: Float32Array,
    dtMs: number,
    tMs: number,
    env: FluidEnv,
  ): void;
  /** Pack live satellites into the ball buffer; returns the new count. */
  packSatellites(
    buf: Float32Array,
    count: number,
    ballMax: number,
    tMs: number,
  ): number;
};

export declare function makeFluidCore(): FluidCore;
