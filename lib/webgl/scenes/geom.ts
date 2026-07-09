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
