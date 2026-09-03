/** Types for the bezier control points (easings.mjs). Keep in sync. */

export type BezierPoints = readonly [number, number, number, number];

export declare const EASE_POINTS: {
  readonly calm: BezierPoints;
  readonly arrive: BezierPoints;
  readonly depart: BezierPoints;
  readonly breath: BezierPoints;
};
