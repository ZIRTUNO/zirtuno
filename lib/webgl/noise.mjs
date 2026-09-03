/**
 * NOISE (R6-C) — the aperiodic, multi-scale field under the liquid's motion.
 *
 * ── why a sum of sines was not enough ────────────────────────────────────────
 *
 * The curl field was four sinusoid octaves. That gives a flow which is smooth,
 * divergence-free and cheap — and which has two properties the eye reads as
 * CHOREOGRAPHY however loose the droplets on it are:
 *
 *   IT IS TOO COARSE. The finest octave had a wavelength of 0.36 uv, and
 *   neighbouring droplets sit about 0.07 uv apart. Every droplet in a body was
 *   therefore inside the same eddy and got the same push, so bodies translated
 *   as rigid pieces. Measured, the velocity direction of two droplets within
 *   three radii of each other correlated at 0.51 — half a rigid formation. A
 *   fluid does the opposite: adjacent parcels disagree, which is what makes a
 *   body churn through itself rather than glide.
 *
 *   IT IS TOO CLEAN. A handful of sinusoids is quasi-periodic and visibly
 *   regular; real flow is broadband and rough at every scale.
 *
 * So the potential becomes value-noise fBm and the flow is its curl — the
 * standard construction for procedural fluid motion, and the reason it works is
 * that the curl of ANY scalar potential is divergence-free by identity. The
 * liquid keeps the incompressible feel it had, and gains structure at the scale
 * of its own droplets.
 *
 * PURITY CONTRACT (the sdf-core convention): no DOM, no timers, deterministic.
 * The lattice hash is integer arithmetic rather than the sin-based hash the
 * rest of the engine uses for identity, because this one runs a few tens of
 * thousands of times per frame instead of once per droplet at module load.
 */

/** Integer lattice hash → [0,1). Deterministic, no Math.sin in the hot path. */
export function lhash(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smoothstep, so the lattice reads as flow rather than as a grid. Quintic
// would give continuous curvature; the cubic is enough here because the curl
// is taken by finite difference at a step much larger than the discontinuity.
const fade = (t) => t * t * (3 - 2 * t);

/** 2D value noise on the unit lattice, in [0,1). */
export function vnoise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const a = lhash(xi, yi);
  const b = lhash(xi + 1, yi);
  const c = lhash(xi, yi + 1);
  const d = lhash(xi + 1, yi + 1);
  const ab = a + (b - a) * u;
  return ab + (c + (d - c) * u - ab) * v;
}

/**
 * THE OCTAVE LADDER.
 *
 * Wavelengths, in uv, and what each is for:
 *
 *   2.0   the page-wide current — where the body drifts as a whole
 *   0.70  chapter-scale eddies — the circulation inside a composition
 *   0.24  body-scale swirl — one blob turning over
 *   0.085 DROPLET SCALE — the octave that makes neighbours disagree, and the
 *         one the sinusoid field never had
 *
 * Amplitudes follow a turbulent cascade rather than being chosen: the velocity
 * a curl octave contributes goes as amplitude × frequency, and in a Kolmogorov
 * spectrum velocity at scale ℓ goes as ℓ^(1/3). So amp ∝ ℓ^(4/3), which is what
 * these are — the fine scales are present and audible without drowning the
 * coarse ones in hash.
 *
 * Each octave also DRIFTS, at its own speed and in its own direction. Fine
 * structure turns over faster than coarse (the eddy-turnover rate rises as the
 * scale falls), and the directions are mutually irrational, so the composite
 * field never repeats and never visibly slides.
 */
const OCT = [
  { f: 3.1, a: 1.0, vx: 0.021, vy: 0.013 },
  { f: 9.0, a: 0.24, vx: -0.037, vy: 0.052 },
  { f: 26.0, a: 0.056, vx: 0.086, vy: -0.061 },
  { f: 74.0, a: 0.013, vx: -0.13, vy: -0.097 },
];

/** The stream function ψ at (x, y) and time t (seconds). */
export function potential(x, y, t) {
  let p = 0;
  for (let k = 0; k < OCT.length; k++) {
    const o = OCT[k];
    p +=
      o.a *
      vnoise2(x * o.f + t * o.vx * o.f + k * 37.1, y * o.f + t * o.vy * o.f + k * 61.7);
  }
  return p;
}

/**
 * Divergence-free flow: v = (∂ψ/∂y, −∂ψ/∂x), by central difference.
 *
 * EPS is a compromise the finest octave sets. Too small and the difference is
 * dominated by the lattice's own cubic seams; too large and the fine octave is
 * smoothed straight back out, which would undo the one thing this exists for.
 * A third of the finest wavelength keeps that octave's gradient intact.
 */
const EPS = 0.0045;

export function curl(x, y, t, out) {
  const px = potential(x + EPS, y, t) - potential(x - EPS, y, t);
  const py = potential(x, y + EPS, t) - potential(x, y - EPS, t);
  const inv = 1 / (2 * EPS);
  out[0] = py * inv;
  out[1] = -px * inv;
  return out;
}

/**
 * 1D value-noise fBm in time — a droplet's own aperiodic clock.
 *
 * Replaces a sine. A sinusoid retraces its path exactly, which is the most
 * literal form of choreography available; three octaves of value noise do not
 * repeat over any duration a visitor will watch, and still read as smooth
 * drift rather than as jitter. Returns roughly [-1, 1].
 */
export function fbm1(x, seed) {
  let v = 0;
  let a = 1;
  let f = 1;
  let norm = 0;
  for (let k = 0; k < 3; k++) {
    const s = x * f + seed * 19.7 + k * 113.3;
    const i0 = Math.floor(s);
    const t = fade(s - i0);
    const n0 = lhash(i0, seed + k * 977);
    const n1 = lhash(i0 + 1, seed + k * 977);
    v += a * (n0 + (n1 - n0) * t);
    norm += a;
    a *= 0.5;
    f *= 2.17; // not 2: an integer ratio makes the octaves re-align periodically
  }
  return (v / norm) * 2 - 1;
}
