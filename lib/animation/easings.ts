// Easings — build-spec S1.4. Mirror of the CSS vars in globals.css.

/** CSS-string easings (for inline style / CSS transitions). */
export const EASINGS = {
  calm: "cubic-bezier(0.65, 0, 0.35, 1)",
  arrive: "cubic-bezier(0.22, 1, 0.36, 1)",
  depart: "cubic-bezier(0.64, 0, 0.78, 0)",
  breath: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
} as const;

/** Cubic-bezier control points (for Motion's `ease` and GSAP CustomEase). */
export const EASE_POINTS = {
  calm: [0.65, 0, 0.35, 1],
  arrive: [0.22, 1, 0.36, 1],
  depart: [0.64, 0, 0.78, 0],
  breath: [0.45, 0.05, 0.55, 0.95],
} as const;

export type EasingName = keyof typeof EASINGS;
