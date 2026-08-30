/** Shared read()-side geometry helpers (pure math over measured rects). */

/** Vertical centers of a rect list. */
export const centersMid = (rects: DOMRect[]): number[] =>
  rects.map((r) => r.top + r.height / 2);

/** Continuous coordinate of viewport line `cy` along an ordered center list:
 *  0 at the first center, n-1 at the last, linear between neighbours. */
export function coordAt(cy: number, centers: number[]): number {
  if (centers.length < 2) return 0;
  if (cy <= centers[0]) return 0;
  if (cy >= centers[centers.length - 1]) return centers.length - 1;
  let k = 0;
  while (k < centers.length - 2 && centers[k + 1] <= cy) k++;
  return k + (cy - centers[k]) / Math.max(centers[k + 1] - centers[k], 1);
}

/**
 * THE SERVICES → MÉTODO HANDOFF — one journey, read from two scenes.
 *
 * site.ts drives the departure off MÉTODO's journey top and method.ts drives
 * the arrival off the same rect, so the two windows have to agree exactly or
 * the shared droplets are pulled between two places. They used to agree by
 * comment ("0.92vh → 0.36vh, which is the site's exit clock from the end of
 * its release to the end of its crossing") and, measured, they did not: the
 * site's grip was actually being released by the #services box leaving the
 * viewport, half a clock before the authored curve said so. Stating the window
 * once and deriving both sides from it makes the invariant structural.
 *
 * All figures are jTop in viewport heights — the journey's top edge measured
 * down from the fold, counting down as the reader descends.
 */
// Landing at 0.20vh is the one fixed end: MÉTODO's first phase reaches the
// middle of the screen at 0.07vh, so the crossing has to be finished — not
// finishing — by the time Diagnóstico is the subject. Everything else was then
// sized backwards from the beats that have to fit inside it (see THE BEATS in
// site.ts), and checked against the two constraints that bound them: the
// seventh form is solid from 1.80vh, so opening at 1.58vh still leaves 0.35vh
// of dead-still silhouette before the first droplet beads out of it; and the
// crossing is a real 0.59uv journey, so its 0.55vh never carries the liquid
// faster than 1.34x scroll even at the crossfade's steepest.
const HANDOFF_OPEN = 1.58; // the exit clock starts here…
const HANDOFF_SPAN = 1.38; // …and takes this much scroll to finish
const HANDOFF_CROSS = 0.6; // the fraction of it the CROSSING owns (rest: the release)

export const HANDOFF = {
  open: HANDOFF_OPEN,
  span: HANDOFF_SPAN,
  cross: HANDOFF_CROSS,
  /** jTop/vh where the crossing opens — the arrival side's own zero. */
  crossHi: HANDOFF_OPEN - HANDOFF_CROSS * HANDOFF_SPAN,
  /** …and its length, in vh of scroll. */
  crossSpan: (1 - HANDOFF_CROSS) * HANDOFF_SPAN,
} as const;

/**
 * The crossfade both sides of the crossing run on, so their weights are exact
 * complements at every scroll position and the normalised blend IS this curve.
 *
 * Half linear, half smoothstep. A pure smoothstep peaks at 1.5x the clock,
 * which over this window would carry the liquid across the stage at 1.6x
 * scroll speed through the middle — the same "passage the reader outruns" the
 * old fall was. Pure linear holds 1.06x throughout but starts and stops with a
 * velocity step at each end. The mix peaks at 1.25x and eases both ends.
 */
export const handoffMix = (u: number): number => {
  const c = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return 0.5 * c + 0.5 * (c * c * (3 - 2 * c));
};
