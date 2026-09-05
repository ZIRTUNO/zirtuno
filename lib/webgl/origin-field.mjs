/**
 * S7 — force acquires direction. Composition and a bounded pressure field;
 * integration stays in fluid-core. No particle has a tween, lifetime or reset.
 * A host and its ranks occupy one irregular catchment, then the catchments
 * gather into the owner-traced footprint. There is no orbiting singularity.
 */
import { CLOUDS, N, hash, clamp01, smooth01 } from "./phys.mjs";
import { fbm1 } from "./noise.mjs";

export const ORIGIN_SCALE = 0.54;
export const ORIGIN_OY = 0.12;
const ramp = (p, a, b) => smooth01((p - a) / (b - a));

export function makeOriginField() {
  const ids = Array.from({ length: 512 }, (_, i) => {
    const h = i % N;
    // Stratified, jittered cells: an expanse of liquid, without concentric rings.
    const col = h % 8;
    const row = Math.floor(h / 8);
    const rank = Math.floor(i / N);
    return {
      x: (col + 0.12 + hash(h, 172) * 0.76) / 8 - 0.5,
      y: (row + 0.12 + hash(h, 173) * 0.76) / 6 - 0.5,
      dx: rank ? (hash(i, 174) - 0.5) * 0.18 : 0,
      dy: rank ? (hash(i, 175) - 0.5) * 0.13 : 0,
      r: rank ? 0.0036 + hash(i, 176) ** 2 * 0.0048 : 0.008 + hash(i, 176) ** 2 * 0.015,
      z: 0.12 + hash(i, 177) * 0.72,
      lag: hash(h, 178) * 0.055,
      exit: hash(h, 179),
    };
  });
  const state = {
    p: 0, gather: 0, seal: 0, release: 0, shift: 0,
    cx: 0.5, cy: 0.5 + ORIGIN_OY, width: 1, height: 0.5,
    gain: 0, capture: 0, aspect: 1, viewW: 1, viewH: 1, scale: ORIGIN_SCALE,
  };
  return {
    state,
    /** @param {number} p
     * @param {number} aspect
     * @param {number} t
     * @param {Record<string, number> | null} score */
    tick(p, aspect, t, score = null) {
      state.p = clamp01(p);
      state.aspect = aspect;
      // The shared shader measures both axes in MIN(viewport width, height).
      // A phone therefore spans 1 unit across and >2 units vertically.
      state.viewW = Math.max(1, aspect);
      state.viewH = Math.max(1, 1 / aspect);
      state.gather = score ? score.gather : ramp(p, 0.18, 0.55);
      state.seal = score ? score.seal : ramp(p, 0.49, 0.62);
      state.release = score ? score.release : ramp(p, 0.78, 0.99);
      state.shift = -0.27 * ramp(aspect, 1.05, 1.4) * (score ? score.focus : ramp(p, 0.71, 0.81));
      state.cx = 0.5 + state.shift;
      state.cy = 0.5 + ORIGIN_OY * state.viewH;
      state.width = state.viewW * 0.94;
      state.height = state.viewH * (aspect < 0.85 ? 0.50 : 0.53);
      state.gain = (1 - state.seal) * (0.35 + 0.65 * (score ? score.ignite : ramp(p, 0.08, 0.31)));
      state.capture = score ? score.capture : ramp(p, 0.15, 0.49);
      // The basin breathes aperiodically; its centre never circles the mark.
      state.cy += 0.009 * fbm1(t * 0.23, 734) * (1 - state.seal);
    },
    target(i, t, out) {
      const s = state;
      const id = ids[i];
      const h = i % N;
      const b = CLOUDS[0][h];
      const rank = Math.floor(i / N);
      const g = ramp(s.p - id.lag, 0.18, 0.54);
      const seal = s.seal;
      const spread = 1 - 0.82 * g;
      const x0 = s.cx + (id.x * s.width + id.dx) * spread;
      const y0 = s.cy + (id.y * s.height + id.dy) * spread;
      const fx = 0.5 + s.shift + (b[0] - 0.5) * s.scale;
      const fy = 0.5 + ORIGIN_OY * s.viewH + (b[1] - 0.5) * s.scale;
      // Three differently inclined tributaries emerge only as force is given
      // direction. They are basins of the field, not drawn paths or orbit lanes.
      const branch = h % 3;
      const tongue = Math.sin(Math.PI * g) * 0.075;
      let x = x0 + (fx - x0) * seal + tongue * (branch === 0 ? -1 : branch === 1 ? 0.7 : 0.25);
      let y = y0 + (fy - y0) * seal + tongue * (branch === 1 ? 0.6 : -0.25);
      // Three seed bodies give the field a readable centre from its entrance.
      // Their asymmetry anticipates the mark; they never form a black disk.
      if (h % 16 === 0) {
        const angle = h / 16 * 2.1 + 0.4;
        x = s.cx + Math.cos(angle) * 0.023 + id.dx * 0.15;
        y = s.cy + Math.sin(angle) * 0.025 + id.dy * 0.15;
        x += (fx - x) * seal;
        y += (fy - y) * seal;
      }
      // The mark gives liquid back to the page. The same bodies peel into
      // Studio's reading margins; no drain-to-black or new population.
      const rel = s.release * (0.5 + id.exit * 0.5);
      const side = h % 2 ? 1 : -1;
      const ex = s.aspect > 1.05
        ? s.cx - 0.10 + (id.exit - 0.5) * s.aspect * 0.47
        : 0.5 + side * (0.22 + id.exit * 0.17);
      const ey = 0.5 + ORIGIN_OY * s.viewH + (hash(h, 181) - 0.5) * 0.29 * s.viewH;
      x += (ex - x) * rel;
      y += (ey - y) * rel;
      // A sparse outer catchment stays alive while the exact mark holds.
      // It lives beyond the silhouette, so the identity remains clean.
      const witness = h % 4 === 1 ? seal * (1 - s.release) : 0;
      const witnessSide = Math.floor(h / 4) % 2 ? 1 : -1;
      let wx = 0.5 + witnessSide * s.viewW * (0.31 + hash(h, 183) * 0.10);
      const focus = -s.shift / 0.27;
      wx += (s.cx - 0.10 + id.x * 0.3 - wx) * focus;
      const wy = 0.5 + ORIGIN_OY * s.viewH + (hash(h, 184) - 0.5) * 0.23 * s.viewH;
      x += (wx + id.dx * 0.35 - x) * witness;
      y += (wy + id.dy * 0.35 - y) * witness;
      const free = Math.max(1 - seal, rel, witness);
      // Legacy rollback has its own small drift; normal motion comes entirely
      // from fluid-core's velocity, pressure, curl and pair forces.
      out.x = x;
      out.y = y;
      out.r = id.r * (1 - 0.32 * g) * (1 - seal) + (rank ? 0.004 : 0.015) * rel + id.r * 0.54 * witness;
      if (h % 16 === 0) out.r += (rank ? 0.003 : 0.009) * (1 - seal);
      out.bind = 1 - free;
      out.cluster = -1;
      out.z = id.z * (1 - seal * 0.7);
      out.d = rank ? 0.74 * free : 1;
    },
  };
}

/** Acceleration from a SOFT pressure basin. Finite at r=0; the compressive
 * front broadens into three lobes, with opposing shear instead of a vortex.
 * `out` is shared force scratch. Caller applies (1-bind) exactly once. */
export function originAcceleration(x, y, t, field, out) {
  const dx = field.cx - x;
  const dy = field.cy - y;
  const d2 = dx * dx + dy * dy;
  const soft = Math.sqrt(d2 + 0.025);
  const pull = field.capture * 0.62 / soft;
  const pressure = 0.22 * Math.exp(-d2 / 0.009);
  const strain = Math.tanh(dx * 7) * Math.tanh(dy * 9);
  const shear = 0.13 * field.capture * strain;
  out[0] += field.gain * (dx * (pull - pressure) + dy * shear);
  out[1] += field.gain * (dy * (pull - pressure) + dx * shear * 0.45);
}
