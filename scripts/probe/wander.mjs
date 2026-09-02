// probe-wander — IS THE LIQUID ACTUALLY FREE?
//
// "More alive" is the one property this engine had no number for, so it was
// argued about instead of measured — and the first R6 pass shipped per-droplet
// character that was invisible, because every force in fluid-core was competing
// with a stiff spring to a POINT. At om = OMEGA_K / TAUP the goal-seek runs
// om^2 = 77…343, and equilibrium displacement under a steady force is F/om^2:
// the entire ambient current was worth 0.4-4 px on a droplet 20 px across.
//
// This runs the real conductor off-GPU against a STATIC scene at bind 0 — no
// scroll, no pointer, targets that never move — so everything it reports is the
// liquid's own motion and nothing else. Four numbers:
//
//   offset   how far a droplet sits from its station, in its OWN RADII.
//            0 = pinned. The eye reads roughly half a radius as "loose".
//   travel   path length per 10 s, in radii. Distinguishes a droplet that has
//            settled at an offset (offset high, travel ~0) from one that is
//            genuinely circulating (both high) — the difference between a body
//            that inflated once and a body that is moving.
//   spread   how much the offset varies ACROSS the population. A body where
//            every droplet sits at the same distance is a body that scaled up,
//            not a body that came alive.
//   shape    RMS change in the body's own radius of gyration. Near 0 means the
//            composition is preserved while its parts move, which is the whole
//            "deterministic macro, free micro" claim.
//   repeat   THE CHOREOGRAPHY NUMBER. Velocity-direction autocorrelation at
//            long lag, and how often a droplet returns to somewhere it has
//            already been. Smooth periodic forcing — a sum of sinusoids, which
//            is what the curl field used to be — produces REVIVALS: the
//            correlation decays and then climbs back as the cycle comes round,
//            and the droplet retraces its own path. That is exactly what reads
//            as choreographed however loose the droplet is, and it is invisible
//            in every other number here. Aperiodic forcing decays and stays
//            decayed.
//
//   node scripts/probe/wander.mjs
//   LEASH_R=3 DRAG=0.15 node scripts/probe/wander.mjs   (sweep a candidate)

import { makeConductor } from "../../lib/webgl/conductor.mjs";
import { N } from "../../lib/webgl/phys.mjs";
import { FLUID } from "../../lib/webgl/fluid-core.mjs";
import { SDF_BALL_CAP_TILED } from "../../lib/webgl/sdf-glass-shader.mjs";

// Overrides land on the shared table BEFORE any core is constructed, which is
// what makes a sweep a sweep rather than five separate opinions.
for (const [env, key] of [
  ["LEASH_R", "LEASH_R"],
  ["LEASH_FREE", "LEASH_FREE"],
  ["DRAG", "LEASH_DRAG"],
  ["CURL_V", "CURL_V"],
]) {
  const v = Number(process.env[env]);
  if (Number.isFinite(v)) FLUID[key] = v;
}

const R0 = 0.022;
/** A still composition: a ring of stations that never move, fully free. */
const still = {
  id: "S",
  forms: [0],
  channels: { p: 1 },
  presence: () => 1,
  target: (i, ctx, out) => {
    const a = (i / N) * Math.PI * 2;
    out.x = 0.5 + 0.2 * Math.cos(a);
    out.y = 0.5 + 0.2 * Math.sin(a);
    out.r = R0;
    out.bind = 0; // free liquid — the state this probe exists to measure
    out.cluster = -1;
    out.z = 0;
    out.d = 1;
  },
  form: () => null,
};

const POP = Number(process.env.POP || N);
const c = makeConductor([still], { pop: POP, ballMax: SDF_BALL_CAP_TILED });
const buf = new Float32Array(SDF_BALL_CAP_TILED * 3);
const ids = new Int16Array(SDF_BALL_CAP_TILED);

const station = (i) => {
  const a = ((i % N) / N) * Math.PI * 2;
  return [0.5 + 0.2 * Math.cos(a), 0.5 + 0.2 * Math.sin(a)];
};

let t = 0;
for (let f = 0; f < 400; f++) {
  t += 16.7;
  c.driver.frame(t, buf, 1.5, undefined, ids, undefined);
} // settle

const SECONDS = 10;
const FRAMES = Math.round((SECONDS * 1000) / 16.7);
const prev = new Map();
const path = new Map();
const offs = new Map();
const gyr = [];
// full trajectories for the periodicity analysis
const trail = new Map();

for (let f = 0; f < FRAMES; f++) {
  t += 16.7;
  ids.fill(-1);
  const fr = c.driver.frame(t, buf, 1.5, undefined, ids, undefined);
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (let k = 0; k < fr.count; k++) {
    const id = ids[k];
    if (id < 0) continue;
    const x = buf[k * 3];
    const y = buf[k * 3 + 1];
    cx += x;
    cy += y;
    n++;
    const [sx, sy] = station(id);
    const d = Math.hypot(x - sx, y - sy);
    if (!offs.has(id)) offs.set(id, []);
    offs.get(id).push(d);
    const p = prev.get(id);
    if (p) path.set(id, (path.get(id) ?? 0) + Math.hypot(x - p[0], y - p[1]));
    prev.set(id, [x, y]);
    if (!trail.has(id)) trail.set(id, []);
    trail.get(id).push([x, y]);
  }
  if (!n) continue;
  cx /= n;
  cy /= n;
  let g = 0;
  for (let k = 0; k < fr.count; k++) {
    if (ids[k] < 0) continue;
    g += (buf[k * 3] - cx) ** 2 + (buf[k * 3 + 1] - cy) ** 2;
  }
  gyr.push(Math.sqrt(g / n));
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const perDropOffset = [...offs.values()].map(mean);
const perDropTravel = [...path.values()];
perDropOffset.sort((a, b) => a - b);
perDropTravel.sort((a, b) => a - b);
const gMean = mean(gyr);
const gRms = Math.sqrt(mean(gyr.map((v) => (v - gMean) ** 2)));

const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(
  `LEASH_R ${FLUID.LEASH_R}  LEASH_FREE ${FLUID.LEASH_FREE}  DRAG ${FLUID.LEASH_DRAG}  CURL_V ${FLUID.CURL_V}  pop ${POP}`,
);
console.log(`  offset (radii)   median ${(q(perDropOffset, 0.5) / R0).toFixed(2)}   p90 ${(q(perDropOffset, 0.9) / R0).toFixed(2)}   min ${(perDropOffset[0] / R0).toFixed(2)}`);
console.log(`  travel /10s      median ${(q(perDropTravel, 0.5) / R0).toFixed(1)}   p90 ${(q(perDropTravel, 0.9) / R0).toFixed(1)}   min ${(perDropTravel[0] / R0).toFixed(1)}`);
console.log(`  spread           ${((q(perDropOffset, 0.9) - q(perDropOffset, 0.1)) / R0).toFixed(2)} radii between the p10 and p90 droplet`);
console.log(`  body shape       gyration ${gMean.toFixed(4)} uv, RMS wobble ${(100 * gRms / gMean).toFixed(2)}%`);

// ── the choreography number ─────────────────────────────────────────────────
// Direction autocorrelation: for each lag, the mean cosine between a droplet's
// step direction now and its step direction `lag` frames later. A quasi-
// periodic flow REVIVES — correlation drops, then rises again as the cycle
// returns. The peak of that revival, taken well past the first decay, is the
// number: near 0 is aperiodic, toward 1 is a loop being retraced.
const dirs = new Map();
for (const [id, pts] of trail) {
  const d = [];
  for (let k = 1; k < pts.length; k++) {
    const vx = pts[k][0] - pts[k - 1][0];
    const vy = pts[k][1] - pts[k - 1][1];
    const m = Math.hypot(vx, vy);
    d.push(m > 1e-9 ? [vx / m, vy / m] : null);
  }
  dirs.set(id, d);
}
const acAt = (lag) => {
  let sum = 0;
  let n = 0;
  for (const d of dirs.values())
    for (let k = 0; k + lag < d.length; k++) {
      const a2 = d[k];
      const b2 = d[k + lag];
      if (!a2 || !b2) continue;
      sum += a2[0] * b2[0] + a2[1] * b2[1];
      n++;
    }
  return n ? sum / n : 0;
};
const LAGS = [];
for (let l = 6; l < Math.round(FRAMES * 0.75); l += 6) LAGS.push(l);
const ac = LAGS.map(acAt);
// the first crossing below 0.2 is "decorrelated"; anything after that which
// climbs back is a revival, i.e. the cycle coming round again
let decorr = ac.findIndex((v) => v < 0.2);
if (decorr < 0) decorr = ac.length - 1;
const tail = ac.slice(decorr);
const revival = tail.length ? Math.max(...tail) : 1;

// path revisit: how often a droplet is within a quarter-radius of a place it
// occupied at least 2 s ago — a loop retraced, rather than territory explored
const GAP = Math.round(2000 / 16.7);
let revisits = 0;
let samples = 0;
for (const pts of trail.values())
  for (let k = GAP; k < pts.length; k += 3) {
    samples++;
    for (let j = 0; j < k - GAP; j += 3)
      if (Math.hypot(pts[k][0] - pts[j][0], pts[k][1] - pts[j][1]) < R0 * 0.25) {
        revisits++;
        break;
      }
  }
// ── the OTHER choreography number: SPATIAL COHERENCE ────────────────────────
// How alike are two NEIGHBOURING droplets' velocities? A flow whose smallest
// feature is bigger than the bodies it carries gives every droplet in a blob
// the same push, so the blob translates as a rigid piece and the body reads as
// a dance — coordinated, and coordinated is exactly what choreographed means.
// A fluid shears: adjacent parcels disagree, which is what makes a body churn
// through itself instead of gliding. 1 = a rigid formation, 0 = uncorrelated.
const NEAR = R0 * 3;
let cohSum = 0;
let cohN = 0;
for (const [idA, dA] of dirs) {
  const pA = trail.get(idA);
  for (const [idB, dB] of dirs) {
    if (idB <= idA) continue;
    const pB = trail.get(idB);
    for (let k = 0; k < Math.min(dA.length, dB.length); k += 7) {
      if (Math.hypot(pA[k][0] - pB[k][0], pA[k][1] - pB[k][1]) > NEAR) continue;
      const a2 = dA[k];
      const b2 = dB[k];
      if (!a2 || !b2) continue;
      cohSum += a2[0] * b2[0] + a2[1] * b2[1];
      cohN++;
    }
  }
}
console.log(
  `  coherence        ${cohN ? (cohSum / cohN).toFixed(2) : "n/a"} between droplets within 3 radii` +
    ` (1 = a rigid formation, 0 = shearing like a fluid)`,
);

console.log(
  `  repeat           revival ${revival.toFixed(2)} (0 = aperiodic, 1 = a retraced loop)` +
    `   revisit ${(100 * revisits / Math.max(samples, 1)).toFixed(0)}% of samples`,
);
console.log(`                   autocorr ${ac.slice(0, 12).map((v) => v.toFixed(2)).join(" ")}`);
