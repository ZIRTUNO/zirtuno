/** Types for the mist kernel (mist.mjs). Keep in sync. */

export declare const MIST: {
  readonly SIZE_FULL: number;
  readonly SIZE_LITE: number;
  readonly H_MS: number;
  readonly MAX_STEPS: number;
  readonly WARMUP: number;
  readonly DRAG: number;
  readonly V_MAX: number;
  readonly CURL_V: number;
  readonly DRIFT: number;
  readonly PULL_A: number;
  readonly PULL_CORE: number;
  readonly PULL_FAR: number;
  readonly POLE_A: number;
  readonly POLE_CORE: number;
  readonly POLE_FAR: number;
  readonly HOST_REACH: number;
  readonly HOST_A: number;
  readonly CAPTURE_R: number;
  readonly SKIN_R: number;
  readonly SKIN_VAR: number;
  readonly SKIN_OMEGA: number;
  readonly SKIN_BREATH: number;
  readonly RELEASE_V: number;
  readonly EVAP_V: number;
  readonly LIFE_RATE: number;
  readonly SPELL_OMEGA: number;
  readonly SPELL_ZETA: number;
  readonly FLOOR_A: number;
  readonly FLOOR_MARGIN: number;
  readonly FLOOR_DAMP: number;
  readonly EDGE_MARGIN: number;
  readonly EDGE_A: number;
  readonly HAND: number;
  readonly SHOCK: number;
  readonly SCROLL_LEAN: number;
  readonly SIZE_PX: number;
  readonly SIZE_VAR: number;
  readonly STREAK_T: number;
  readonly STREAK_MAX: number;
  readonly ALPHA: number;
  readonly ALPHA_SKIN: number;
  readonly DEPTH_DIM: number;
  readonly SPEED_GLOW: number;
  readonly GLOW_MIX: number;
};

export declare function mistSize(tier: "full" | "lite" | string): number;
export declare function mistSizeUv(
  sizePx: number,
  bufferScale: number,
  minDim: number,
): number;
export declare function pullProfile(r: number, core: number, far: number): number;

/** The dial block the origin scene hands the renderer each frame. */
export type MistDials = {
  /** 0..1 master — 0 skips the simulation entirely. */
  on: number;
  evap: number;
  pull: number;
  poles: number;
  condense: number;
  release: number;
  spell: number;
  fade: number;
  curl: number;
  floorOn: number;
  /** field-uv y of the type band's top (the wall) */
  floor: number;
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** the wordmark's box in field uv: centre + half extents */
  wx: number;
  wy: number;
  ww: number;
  wh: number;
  /** 1 while the wordmark has been measured and may be spelled into */
  spellOn: number;
  /** per authored droplet: the radius the vapour treats it as having */
  hostR: Float32Array;
};

export declare function makeMistDials(): MistDials;

export type MistReference = {
  n: number;
  P: Float32Array;
  V: Float32Array;
  LIFE: Float32Array;
  STATE: Uint8Array;
  HOST: Int16Array;
  THETA: Float32Array;
  seedAt(hosts: Float32Array): void;
  step(
    dtMs: number,
    tMs: number,
    hosts: Float32Array,
    dials: MistDials,
    env: unknown,
    spellT: Float32Array | null,
    aspect?: number,
  ): number;
};

export declare function makeMistReference(
  n: number,
  opts?: { probe?: unknown },
): MistReference;
