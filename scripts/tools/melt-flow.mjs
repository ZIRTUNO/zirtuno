/**
 * THE MELT FLOW PROBE — the motion's CHARACTER, in numbers.
 *
 * tools/melt-mass.mjs measures how much liquid is on screen and tools/melt-islands.mjs
 * measures whether it is one body. Both can pass while the morph still reads
 * mechanical, because neither looks at HOW the cloud travels. Every complaint
 * that a melt "slides" rather than flows is about these five numbers:
 *
 *   ARC     mean path deviation from the straight line, as a fraction of the
 *           droplet's own travel. Zero is a rigid slide; liquid takes curved
 *           routes because it is pushed around its own body.
 *   SPREAD  p-range between the first and last droplet reaching half its
 *           journey. Zero is a rank of soldiers stepping off together.
 *   COH     how far each droplet's velocity sits from the mean velocity of its
 *           own neighbours, as a fraction of the frame's mean speed. THE
 *           fluidity number: a deforming body has a velocity field that is
 *           smooth in SPACE, so neighbours travel together even when one is
 *           crossing the form and the other barely moves. High COH is shear —
 *           48 independent tweens sharing a clock. Lower is better.
 *   DISP    95th percentile peak speed / median, each normalised by the
 *           droplet's own travel. Secondary: it reads how unequal the WINDOWS
 *           are, not how unequal the speeds are.
 *   STRAIN  worst local stretch each droplet's neighbourhood sees, against the
 *           same neighbourhood interpolated at rest. This is the necking
 *           budget — 0 means the cloud moves rigidly and can never form a
 *           filament; very high means it tears.
 *   JERK    mean |d²x/dp²| per droplet, normalised by travel. Spikes here are
 *           the frames a viewer reads as a snap.
 *
 * Runs off the SHIPPED kernel, so it cannot describe a melt the site does not
 * actually play.
 *
 *   node scripts/tools/melt-flow.mjs
 *   STEPS=241 node scripts/tools/melt-flow.mjs
 */
import { CLOUDS, N, STAG } from "../../lib/webgl/phys.mjs";
import { meltDroplet, permFor, FORM_SOLIDITY } from "../../lib/webgl/melt.mjs";

const STEPS = Number(process.env.STEPS ?? 161);
const K = 4; // neighbours defining a droplet's local patch
const MIN_TRAVEL = 0.006; // below this a droplet barely moves; excluded from ratios
const PAIRS = process.env.PAIRS
  ? process.env.PAIRS.split(",").map(Number)
  : [0, 1, 2, 3, 4, 5, 6];

const neighbourCache = new Map();
function neighbours(k) {
  let nb = neighbourCache.get(k);
  if (nb) return nb;
  const cloud = CLOUDS[k];
  nb = cloud.map((b, i) => {
    const d = cloud
      .map((c, j) => [(c[0] - b[0]) ** 2 + (c[1] - b[1]) ** 2, j])
      .filter(([, j]) => j !== i)
      .sort((p, q) => p[0] - q[0]);
    return d.slice(0, K).map(([, j]) => j);
  });
  neighbourCache.set(k, nb);
  return nb;
}

const pct = (arr, p) => {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * p)))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Every droplet's full path through one melt, from the shipped kernel. */
function track(a, b) {
  const A = CLOUDS[a],
    B = CLOUDS[b],
    pm = permFor(a, b),
    st = STAG[a];
  const d = [0, 0, 0, 0];
  const path = Array.from({ length: N }, () => []);
  for (let s = 0; s < STEPS; s++) {
    const p = s / (STEPS - 1);
    for (let i = 0; i < N; i++) {
      meltDroplet(d, i, A, B, pm, st, p, FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
      path[i].push([d[0], d[1], d[2], d[3]]);
    }
  }
  return path;
}

function measure(a, b) {
  const path = track(a, b);
  const nb = neighbours(a);
  const pm = permFor(a, b);
  const A = CLOUDS[a],
    B = CLOUDS[b];

  const arcs = [];
  const halves = [];
  const peaks = [];
  const jerks = [];
  for (let i = 0; i < N; i++) {
    const pt = path[i];
    const s0 = pt[0],
      s1 = pt[STEPS - 1];
    const chord = dist(s0, s1);
    // ARC — greatest perpendicular excursion off the straight route
    if (chord > MIN_TRAVEL) {
      const ux = (s1[0] - s0[0]) / chord,
        uy = (s1[1] - s0[1]) / chord;
      let worst = 0;
      for (const q of pt) {
        const off = Math.abs((q[0] - s0[0]) * uy - (q[1] - s0[1]) * ux);
        if (off > worst) worst = off;
      }
      arcs.push(worst / chord);
      // SPREAD — when this droplet passes the halfway mark of its own journey
      for (let s = 0; s < STEPS; s++) {
        if (dist(pt[s], s0) >= chord * 0.5) {
          halves.push(s / (STEPS - 1));
          break;
        }
      }
      // DISP — peak per-step speed, normalised so shape scale cancels
      let vmax = 0;
      for (let s = 1; s < STEPS; s++) {
        const v = dist(pt[s], pt[s - 1]);
        if (v > vmax) vmax = v;
      }
      peaks.push((vmax * (STEPS - 1)) / chord);
      // JERK — second difference of position, normalised by travel
      let j = 0;
      for (let s = 1; s < STEPS - 1; s++) {
        const ax = pt[s + 1][0] - 2 * pt[s][0] + pt[s - 1][0];
        const ay = pt[s + 1][1] - 2 * pt[s][1] + pt[s - 1][1];
        j += Math.hypot(ax, ay);
      }
      jerks.push((j * (STEPS - 1) ** 2) / (chord * STEPS));
    }
  }

  // STRAIN — the local patch against itself, interpolated at rest. A pair that
  // sits 0.1 apart in A and 0.14 apart in B is SUPPOSED to be 0.12 apart at
  // mid-melt; strain is what the melt actually does beyond that.
  const strains = [];
  for (let i = 0; i < N; i++) {
    let worst = 0;
    for (const j of nb[i]) {
      const dA = dist(A[i], A[j]);
      const dB = dist(B[pm[i]], B[pm[j]]);
      if (dA < 1e-4) continue;
      for (let s = 0; s < STEPS; s++) {
        const t = s / (STEPS - 1);
        const rest = dA + (dB - dA) * t;
        if (rest < 1e-4) continue;
        const now = dist(path[i][s], path[j][s]);
        worst = Math.max(worst, Math.abs(now / rest - 1));
      }
    }
    strains.push(worst);
  }

  // COH — is the velocity field smooth in space? Compare every droplet to the
  // mean of its own neighbourhood, scaled by the frame's mean speed so a slow
  // frame and a fast frame are weighed the same.
  const cohErr = [];
  for (let s = 1; s < STEPS; s++) {
    const v = [];
    let gm = 0;
    for (let i = 0; i < N; i++) {
      const vx = path[i][s][0] - path[i][s - 1][0];
      const vy = path[i][s][1] - path[i][s - 1][1];
      v.push([vx, vy]);
      gm += Math.hypot(vx, vy);
    }
    gm /= N;
    if (gm < 1e-7) continue;
    let e = 0;
    for (let i = 0; i < N; i++) {
      let nx = 0,
        ny = 0;
      for (const j of nb[i]) {
        nx += v[j][0];
        ny += v[j][1];
      }
      e += Math.hypot(v[i][0] - nx / K, v[i][1] - ny / K);
    }
    cohErr.push(e / N / gm);
  }

  return {
    coh: mean(cohErr),
    arc: mean(arcs) * 100,
    spread: pct(halves, 0.95) - pct(halves, 0.05),
    disp: pct(peaks, 0.95) / Math.max(pct(peaks, 0.5), 1e-6),
    strain: mean(strains) * 100,
    jerk: mean(jerks),
  };
}

const row = (label, m) =>
  `  ${label.padEnd(7)}${m.coh.toFixed(2).padStart(5)}   ` +
  `${m.arc.toFixed(1).padStart(5)}   ${m.spread.toFixed(2).padStart(5)}   ` +
  `${m.disp.toFixed(2).padStart(5)}   ${m.strain.toFixed(1).padStart(6)}   ` +
  `${m.jerk.toFixed(1).padStart(6)}`;

console.log(`  melt     coh    arc%   spread   disp    strain%   jerk`);
const all = [];
for (const a of PAIRS) {
  const m = measure(a, a + 1);
  all.push(m);
  console.log(row(`${a}->${a + 1}`, m));
}
const avg = (k) => mean(all.map((m) => m[k]));
console.log(
  "\n" +
    row(
      "MEAN",
      Object.fromEntries(
        ["coh", "arc", "spread", "disp", "strain", "jerk"].map((k) => [k, avg(k)]),
      ),
    ),
);
