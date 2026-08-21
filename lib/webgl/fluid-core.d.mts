/** Types for the fluid physics core (fluid-core.mjs). Keep in sync. */

export declare const FLUID: {
  readonly H_MS: number;
  readonly OMEGA_K: number;
  readonly DAMP_Z: number;
  readonly REP_RANGE: number;
  readonly REP_A: number;
  readonly REP_D_MIN: number;
  readonly COH_A: number;
  readonly CURL_V: number;
  readonly CURSOR_RADIUS: number;
  readonly CURSOR_PUSH: number;
  readonly CURSOR_RIM: number;
  readonly CURSOR_SWIRL: number;
  readonly CURSOR_WAKE: number;
  readonly CURSOR_DRAG: number;
  readonly CURSOR_PRESS: number;
  readonly PRESS_TAU: number;
  readonly V_MAX: number;
  readonly SAT_POOL: number;
  readonly SAT_STRAIN: number;
  readonly SAT_BIND_MAX: number;
  readonly SAT_COOLDOWN: number;
  readonly SAT_TTL_MIN: number;
  readonly SAT_TTL_VAR: number;
  readonly SAT_R: number;
  readonly V3_VISC_RANGE: number;
  readonly V3_VISC_A: number;
  readonly V3_ATTR_START: number;
  readonly V3_ATTR_RANGE: number;
  readonly V3_ATTR_A: number;
  readonly V3_SPREAD_A: number;
  readonly V3_SPREAD_MAX: number;
  readonly OBSTACLE_MARGIN: number;
  readonly OBSTACLE_A: number;
  readonly SCROLL_CLAMP: number;
  readonly SCROLL_LEAN: number;
  readonly SCROLL_SHEAR: number;
  readonly SCROLL_STIR: number;
  readonly SHOCK_SLOTS: number;
  readonly SHOCK_A: number;
  readonly SHOCK_SPEED: number;
  readonly SHOCK_WIDTH: number;
  readonly SHOCK_REACH: number;
  readonly SHOCK_LIFE: number;
  readonly SHOCK_RECOIL: number;
  readonly SHOCK_LAG: number;
  readonly SHOCK_SWIRL: number;
  readonly SHOCK_IRREG: number;
  readonly SHOCK_FRONT_JIT: number;
  readonly SHOCK_SATURATE: number;
  readonly SHOCK_LOAD_TAU: number;
  readonly SHOCK_MERGE_MS: number;
  readonly SHOCK_MERGE_R: number;
  readonly SHOCK_SPRAY: number;
  readonly SHOCK_CROWN_R: number;
  readonly SHOCK_CROWN_V: number;
  readonly MASS_REF: number;
  readonly MASS_RESP_MIN: number;
  readonly MASS_RESP_MAX: number;
  readonly SAT_RESPONSE: number;
  readonly AMB_RESPONSE: number;
  readonly AMB_OMEGA: number;
  readonly AMB_ZETA: number;
  readonly AMB_MAX: number;
};

export declare const FLUID_OBSTACLE_MAX: number;
export declare const FLUID_OBSTACLE_STRIDE: number;

export type FluidEnv = {
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  pon: boolean;
  /** Damped 0..1 — the pointer pressed INTO the liquid (mouse or finger). */
  press?: number;
  vel: number;
  /** cx, cy, half-width, half-height, weight; fixed-stride field-space data. */
  obstacles?: Float32Array;
  obstacleCount?: number;
};

export type FluidCoreOptions = {
  /** Enable the opt-in area/viscosity/footprint physics review path. */
  v3?: boolean;
  /** Enable cached typography/card obstacle flow; requires v3. */
  obstacles?: boolean;
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
  /** Register a click/tap strike at (x, y) in field uv on the caller's clock. */
  strike(x: number, y: number, tMs: number, strength?: number): void;
  /** Sample the interaction field (hand + strikes) at a point, for families
   *  the core does not integrate itself. Writes [ax, ay] into `out`. */
  probe(
    x: number,
    y: number,
    tMs: number,
    env: FluidEnv,
    out: Float32Array,
    jitA?: number,
    jitB?: number,
  ): Float32Array;
  /** 0..1 — strike energy still live in the field (the cadence governor). */
  shockEnergy(tMs: number): number;
};

export declare function makeFluidCore(opts?: FluidCoreOptions): FluidCore;
