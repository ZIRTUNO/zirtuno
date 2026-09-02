/** Types for THE CONFLUENCE — S3's resolved symbol (confluence.mjs). Keep in
 *  sync with the module; the same convention as phys.d.mts / melt.d.mts. */

import type { Ball } from "./phys.d.mts";

export declare const CONFLUENCE_N: number;
export declare const CORE_DROPS: number;

/** Bearing of each system's arm, in GATHER_SYSTEMS order (radians). */
export declare const BEARINGS: number[];

/** The 48 stations, in the same [x, y, r] cloud space as CLOUDS. */
export declare const CONFLUENCE: Ball[];

/** Stagger key for the melt schedule: each station's x. */
export declare const CONFLUENCE_STAG: number[];

/** Which arm droplet `i` runs along, or -1 if it is core. */
export declare const armOf: (i: number) => number;

/** Each arm's droplets in seating order, core → tip. */
export declare const ARM_SEQ: number[][];

/** Centroid of the core — the point every arm runs into. */
export declare const CORE_CENTRE: { x: number; y: number };

/** The tip of system `si`'s arm. */
export declare function armTip(si: number): { x: number; y: number };

/**
 * THE CIRCULATION for droplet `i` at `t` seconds, written into `out` as
 * [dx, dy, radius multiplier]. `amp` 0 leaves the exact station table.
 */
export declare function circulate(
  out: Float32Array | number[],
  i: number,
  t: number,
  amp?: number,
): Float32Array | number[];
