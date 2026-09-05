/** Types for the §3.3 melt kernel (melt.mjs). Keep in sync. */
import type { Ball } from "./phys.d.mts";

/** Legacy left→right stagger key. Retained as the degenerate-axis fallback
 *  only — the schedule is owned by the WIN/WAVE constants below. */
export declare const STAGGER: number;
export declare const RADIUS_LEAD: number;
export declare const BRIDGE: number;
export declare const BRIDGE_RAMP: number;
/** Per-form cloud/form solidity shortfall, indexed like METABALL_STATES. */
export declare const FORM_SOLIDITY: number[];

/** The per-droplet transport schedule (§5.2). */
export declare const WIN_SPAN: number;
export declare const WIN_MIN: number;
export declare const WIN_POW: number;
export declare const WAVE: number;
export declare const MASS_LAG: number;
export declare const WAVE_JITTER: number;

export declare const arrive: (x: number) => number;
/** The melt's transport curve — symmetric in-out, in phase with the cloud. */
export declare const flow: (x: number) => number;
export declare const bridgeRadiusEnvelope: (p: number) => number;
export declare const bridgePresence: (p: number) => number;
export declare const bridgeDensity: (presence: number) => number;
export declare const meltVolumePresence: (A: Ball[], B: Ball[], p: number) => number;
export declare const bridgeSwell: (
  swA: number,
  swB: number,
  tr: number,
  pres: number,
) => number;

export declare const matchClouds: (A: Ball[], B: Ball[]) => number[];
export declare const permFor: (a: number, b: number) => number[];

export declare const packBridge: (
  buf: Float32Array,
  offset: number,
  A: Ball[],
  B: Ball[],
  perm: number[],
  stag: number[],
  p: number,
  dBuf?: Float32Array,
  swA?: number,
  swB?: number,
) => number;

export declare const meltDroplet: (
  out: number[] | Float32Array,
  i: number,
  A: Ball[],
  B: Ball[],
  perm: number[],
  stag: number[],
  p: number,
  swA?: number,
  swB?: number,
  /** Harness-only: evaluate a candidate handoff schedule without mutating the
   *  module. Undefined is the shipped path. */
  presOverride?: number,
) => number[] | Float32Array;

export declare const formPresence: (q: number) => [number, number];
export declare const formPhase: (p: number) => {
  wA: number;
  eA: number;
  wB: number;
  eB: number;
};
export declare const dampFormPhase: (
  out: ReturnType<typeof formPhase>, p: number, dt: number,
) => ReturnType<typeof formPhase>;

/** The melt's EASED progress, for anything that must stay in step with the
 *  transformation visually rather than by mass. Exact at 0 and 1. */
export declare const morphPhase: (p: number) => number;

/** The morph's saturation ceiling at progress p; 0 = the exact plain sum. */
export declare const SAT_OFF: number;
export declare function meltSat(p: number): number;
