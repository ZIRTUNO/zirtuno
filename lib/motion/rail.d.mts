/** Types for the pure waterline kernel (rail.mjs). Keep in sync. */

export type Rail = {
  /** Re-span the rail. Marks survive — they are document fractions. */
  layout(hPx: number, x0Px?: number): void;
  /** Chapter positions, as 0..1 of the document. */
  setMarks(list: ArrayLike<number>): void;
  /** The page's own answer to which chapter is current; -1 to derive one. */
  setLive(i: number): void;
  /**
   * Where the reader is: scroll position, viewport height, document height,
   * and the page's own speed in px/s (which raises the bow wave).
   */
  travel(y: number, vh: number, docH: number, vel?: number): void;
  /** The bow wave on its own — the harness drives this directly. */
  wake(pxPerSec: number): void;
  /** Pointer in LOCAL px (origin = the rail's top-left). `null` lifts it. */
  hand(x: number | null, y?: number): void;
  /** Advance to `tMs`. Returns true if the rail must be redrawn. */
  step(tMs: number): boolean;
  /** SVG path data for one class of dot. */
  path(kind: "ink" | "taut" | "mark" | "flow" | "live"): string;
  /** Local y of chapter `i` — where its dot actually sits. */
  markY(i: number): number;
  /** First and last dot of the lit run — the part of the document on screen. */
  readonly headIndex: number;
  readonly tailIndex: number;
  /** The chapter the reading head is inside, or -1. */
  readonly liveMark: number;
  /** 0..1 proximity wake. */
  readonly aware: number;
  readonly count: number;
  readonly span: number;
  /** Read-only extensions (px) — harness and debug only. */
  readonly ext: Float32Array;
  readonly asleep: boolean;
};

export declare const RAIL: {
  readonly H_MS: number;
  readonly MAX_SUB: number;
  readonly PITCH: number;
  readonly MAX_EXT: number;
  readonly R_EXT: number;
  readonly K_RET: number;
  readonly AWARE_X: number;
  readonly AWARE_TAU: number;
  readonly AWARE_TAU_OUT: number;
  readonly TARGET_TAU: number;
  readonly WAKE_V: number;
  readonly WAKE_EXT: number;
  readonly WAKE_R: number;
  readonly WAKE_TAU: number;
  readonly MIN_RUN: number;
  readonly DRAIN_AT: number;
  readonly DRAIN_S: number;
  readonly EPS: number;
};

export declare function makeRail(h?: number, x0?: number): Rail;
