/** Types for the GENERATED intro geometry (intro-trace.data.mjs). Keep in sync
 *  with scripts/generate-intro-trace.mjs — that script is the source. */

/** The intro's square design box (viewBox units). */
export declare const INTRO_VIEW: number;

/** The mark's contour, exact, transformed into INTRO_VIEW. Provenance and QA:
 *  the runtime renders the kernel's ring path, not this. */
export declare const MARK_D: string;

/** The mark's counter-dot, exact. */
export declare const DOT_D: string;

/** The same dot as a circle — the intro drops it as a droplet. */
export declare const DOT: { cx: number; cy: number; r: number };

/** The contour at uniform arc length with true outward normals, rotated so
 *  vertex 0 is the MEETING point. Shape matches membrane.mjs `ringRest` input. */
export declare const RING: {
  n: number;
  x: number[];
  y: number[];
  nx: number[];
  ny: number[];
};

export declare const TRACE: {
  /** ring index of the seed — exactly n/2, so DrawSVG's two heads arrive together */
  seed: number;
  seedT: number;
  seedX: number;
  seedY: number;
  /** the seam, vertex 0 — where the heads meet and the flood starts */
  meet: number;
  meetT: number;
  meetX: number;
  meetY: number;
  /** contour length in INTRO_VIEW units */
  len: number;
  /** distance between the two terminals */
  span: number;
  /** CustomEase path strings — each head's curvature-derived pace */
  easeA: string;
  easeB: string;
  paceK: number;
};

/** The sharpest outward turns — the only places a droplet may leave. */
export declare const TIPS: {
  i: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
}[];
