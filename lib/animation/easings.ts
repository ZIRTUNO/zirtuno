// Easings — build-spec S1.4. Mirror of the CSS vars in globals.css.

/** CSS-string easings (for inline style / CSS transitions). */
export const EASINGS = {
  calm: "cubic-bezier(0.65, 0, 0.35, 1)",
  arrive: "cubic-bezier(0.22, 1, 0.36, 1)",
  depart: "cubic-bezier(0.64, 0, 0.78, 0)",
  breath: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
} as const;

/** Cubic-bezier control points (for Motion's `ease` and GSAP CustomEase).
 *  The values live in easings.mjs so the field's melt kernel — which runs in
 *  plain node for the offline simulator — shares this exact `arrive` curve. */
export { EASE_POINTS } from "./easings.mjs";
export type { BezierPoints } from "./easings.mjs";

export type EasingName = keyof typeof EASINGS;
