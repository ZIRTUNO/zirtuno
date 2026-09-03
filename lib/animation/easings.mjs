/**
 * Cubic-bezier control points — the ONE copy, node-runnable.
 *
 * Split out of easings.ts so the field's melt kernel (lib/webgl/melt.mjs) can
 * share the `arrive` curve with the DOM without a TS toolchain: the offline melt
 * simulator (scripts/_melt-sim.mjs) runs in plain node, and a second hand-copied
 * bezier there would let the simulated melt drift from the shipped one.
 */
export const EASE_POINTS = {
  calm: [0.65, 0, 0.35, 1],
  arrive: [0.22, 1, 0.36, 1],
  depart: [0.64, 0, 0.78, 0],
  breath: [0.45, 0.05, 0.55, 0.95],
};

/**
 * Evaluate a cubic-bezier easing at u ∈ [0, 1], node-runnable.
 *
 * The DOM gets these curves through CSS `cubic-bezier()` and GSAP's
 * CustomEase; the Origin's SCORE (lib/webgl/origin-score.mjs) needs the same
 * curves as plain arithmetic so the liquid's envelopes and the copy's tweens
 * can be shaped by ONE ease table without a DOM. Newton on x(t) with a
 * bisection fallback — the standard construction, exact to ~1e-6.
 */
export function cubicBezierAt(points, u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const [x1, y1, x2, y2] = points;
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  let t = u;
  for (let k = 0; k < 8; k++) {
    const x = sampleX(t) - u;
    if (Math.abs(x) < 1e-6) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  let lo = 0;
  let hi = 1;
  t = u;
  while (hi - lo > 1e-6) {
    const x = sampleX(t);
    if (Math.abs(x - u) < 1e-6) break;
    if (x < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** The house eases by name — `easeAt("arrive", u)`. */
export function easeAt(name, u) {
  return cubicBezierAt(EASE_POINTS[name] ?? EASE_POINTS.calm, u);
}
