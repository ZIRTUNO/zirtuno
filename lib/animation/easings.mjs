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
