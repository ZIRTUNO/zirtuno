/**
 * THE SITE'S NOISE, PORTED TO GLSL — generated from `noise.mjs`'s own tables.
 *
 * This is not a lookalike field. The integer lattice hash is the same bits as
 * noise.mjs's `lhash` (`Math.imul` wraps at 2^32 exactly as uint multiplication
 * does) and the octave ladder is interpolated straight out of `OCT`, so
 * anything drawn with this rides THE SAME EDDIES the droplets ride. A retune of
 * the ladder moves the CPU field and the GPU field together, or it moves
 * neither — there is no second definition of the current to drift out of sync.
 *
 * Lifted verbatim from the vapour Fable wrote for the S7 convergence
 * (`lib/webgl/mist-shaders.mjs` on `feat/s7-convergence`, reverted from main at
 * a22a0df). It was private to that file; it is here because it is not really a
 * property of the mist — it is the current, and the aura needs it too. If that
 * branch is ever landed, its shaders should import this rather than re-declare
 * it.
 *
 * WHY IT MATTERS FOR ATMOSPHERE. `OCT`'s per-octave drift directions are
 * mutually irrational, which is noise.mjs's own stated reason for choosing
 * them: the composite field never repeats and never visibly slides. That is
 * exactly the difference between a background that is ALIVE and one that is a
 * texture being translated — the second reads as a loop the moment a viewer
 * stops scrolling and watches it.
 *
 * Provides: `lhashf`, `fadeC`, `vnoise2`, `potential(x, y, t)`,
 * `curlAt(vec2 p, float t)` and `fbm1(float x, int seed)`. GLSL ES 3.00.
 */

import { OCT, EPS } from "./noise.mjs";

// GLSL literal for a JS number — GLSL has no implicit int → float.
const g = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};

export const NOISE_GLSL = `
uint lhash(int ix, int iy) {
  uint h = uint(ix) * 374761393u + uint(iy) * 668265263u;
  h = (h ^ (h >> 13)) * 1274126177u;
  h ^= h >> 16;
  return h;
}
float lhashf(int ix, int iy) { return float(lhash(ix, iy)) * (1.0 / 4294967296.0); }
float fadeC(float t) { return t * t * (3.0 - 2.0 * t); }
float vnoise2(float x, float y) {
  float xf = floor(x), yf = floor(y);
  int xi = int(xf), yi = int(yf);
  float u = fadeC(x - xf), v = fadeC(y - yf);
  float a = lhashf(xi, yi), b = lhashf(xi + 1, yi);
  float c = lhashf(xi, yi + 1), d = lhashf(xi + 1, yi + 1);
  float ab = a + (b - a) * u;
  return ab + (c + (d - c) * u - ab) * v;
}
float potential(float x, float y, float t) {
  float p = 0.0;
${OCT.map(
  (o, k) =>
    `  p += ${g(o.a)} * vnoise2(x * ${g(o.f)} + t * ${g(o.vx * o.f)} + ${g(k * 37.1)}, y * ${g(o.f)} + t * ${g(o.vy * o.f)} + ${g(k * 61.7)});`,
).join("\n")}
  return p;
}
vec2 curlAt(vec2 p, float t) {
  float px = potential(p.x + ${g(EPS)}, p.y, t) - potential(p.x - ${g(EPS)}, p.y, t);
  float py = potential(p.x, p.y + ${g(EPS)}, t) - potential(p.x, p.y - ${g(EPS)}, t);
  return vec2(py, -px) * ${g(1 / (2 * EPS))};
}
// an aperiodic clock (noise.mjs fbm1)
float fbm1(float x, int seed) {
  float v = 0.0, a = 1.0, f = 1.0, norm = 0.0;
  for (int k = 0; k < 3; k++) {
    float s = x * f + float(seed) * 19.7 + float(k) * 113.3;
    float i0f = floor(s);
    int i0 = int(i0f);
    float t = fadeC(s - i0f);
    float n0 = lhashf(i0, seed + k * 977);
    float n1 = lhashf(i0 + 1, seed + k * 977);
    v += a * (n0 + (n1 - n0) * t);
    norm += a;
    a *= 0.5;
    f *= 2.17;
  }
  return (v / norm) * 2.0 - 1.0;
}
`;

/** Sum of the ladder's amplitudes — what `potential` can reach, for normalising. */
export const POTENTIAL_MAX = OCT.reduce((s, o) => s + o.a, 0);
