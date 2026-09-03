/** Types for the bezier control points (easings.mjs). Keep in sync. */

export type BezierPoints = readonly [number, number, number, number];

export declare const EASE_POINTS: {
  readonly calm: BezierPoints;
  readonly arrive: BezierPoints;
  readonly depart: BezierPoints;
  readonly breath: BezierPoints;
};

/** Evaluate a cubic-bezier at u ∈ [0, 1] (node-runnable). */
export declare function cubicBezierAt(points: BezierPoints, u: number): number;
/** The house eases by name. */
export declare function easeAt(
  name: keyof typeof EASE_POINTS,
  u: number,
): number;
