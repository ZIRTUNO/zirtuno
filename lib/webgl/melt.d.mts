/** Types for the §3.3 melt kernel (melt.mjs). Keep in sync. */
import type { Ball } from "./phys.d.mts";

export declare const STAGGER: number;
export declare const RADIUS_LEAD: number;
export declare const BRIDGE: number;
export declare const BRIDGE_RAMP: number;
/** Per-form cloud/form solidity shortfall, indexed like METABALL_STATES. */
export declare const FORM_SOLIDITY: number[];

export declare const arrive: (x: number) => number;
export declare const bridgeRadiusEnvelope: (p: number) => number;
export declare const bridgePresence: (p: number) => number;
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
) => number[] | Float32Array;

export declare const formPresence: (q: number) => [number, number];
export declare const formPhase: (p: number) => {
  wA: number;
  eA: number;
  wB: number;
  eB: number;
};
