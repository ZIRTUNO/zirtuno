/** Types for the pure route-veil kernel (veil.mjs). Keep in sync. */

/** Which edge the paint hangs from. `idle` is the state before the first run. */
export type VeilMode = "idle" | "cover" | "reveal";

export type Veil = {
  readonly mode: VeilMode;
  /** How many layers the armed run drives, from the back of the stack. */
  readonly layers: number;
  /** Run length in seconds; 0 before the first `arm()`. */
  readonly total: number;
  /** Where the run is, seconds; -1 before the first `seek()`. */
  readonly at: number;
  /** True while a completed `cover` is standing over the page. */
  readonly covered: boolean;
  /** Schedule a run and return its length in seconds. */
  arm(mode: Exclude<VeilMode, "idle">, seed: number, layerCount?: number): number;
  /** Move to `t` seconds in. True if any column moved. */
  seek(t: number): boolean;
  /** One column's height, 100 (bottom) → 0 (top). */
  columnY(layer: number, column: number): number;
  /** `d` for one layer, in the `0 0 100 100` viewBox. `""` past `layers`. */
  path(layer: number): string;
};

export declare const VEIL: {
  readonly N: number;
  readonly LAYERS: number;
  readonly DUR: number;
  readonly JITTER: number;
  readonly STAGGER: number;
  readonly DP: number;
};

/** Worst-case run length in seconds. */
export declare const VEIL_CEILING: number;

export declare function makeVeil(): Veil;
