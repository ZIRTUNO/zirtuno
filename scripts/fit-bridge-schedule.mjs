/**
 * RE-FIT THE HANDOFF SCHEDULE — BRIDGE_KNOTS, for whatever combination law is
 * in force.
 *
 * bridgePresence is a MEASURED table, not a curve: it is the density which,
 * added to what the departing form still has, keeps the rendered body on a
 * smooth ramp between the two silhouettes. Its own note says to re-derive it if
 * formPresence, SDF_MELT_ERODE or the forms move. The COMBINATION LAW moves it
 * harder than any of those, because under a plain sum a large part of what the
 * cloud contributed came from superaddition between its own droplets, and the
 * p-norm removes exactly that. The knots fitted for n = 1 are therefore wrong
 * for any other n, and leave the ramps hollow.
 *
 * The objective is the one melt-mass.mjs gates: the rendered area should track
 * the straight line between the melt's two endpoints. Not constant mass — the
 * forms differ in area by up to 38%, so a melt must ramp — only the excursions
 * off that ramp count.
 *
 * Coordinate descent, deterministic, monotonicity enforced. Affordable because
 * prepareForms depends only on (a, b, p) and is cached once per frame, so a
 * candidate schedule costs one addBalls pass per frame and nothing else — which
 * is the reuse that function was written for.
 *
 *   node scripts/fit-bridge-schedule.mjs [--res 256] [--steps 13] [--passes 4]
 *
 * Prints the fitted table to paste into melt.mjs, with before/after excursions.
 */
import { loadForms, prepareForms, addBalls } from "./_melt-sim.mjs";
import { CLOUDS, STAG, N, clamp01 } from "../lib/webgl/phys.mjs";
import { permFor, formPhase, FORM_SOLIDITY, meltDroplet } from "../lib/webgl/melt.mjs";
import { MELT_SAT } from "../lib/webgl/sdf-glass-shader.mjs";
import { edt2d } from "../lib/webgl/sdf-core.mjs";

// The forms' own circularity, and the ceiling the gate holds a melt to.
const REST_CIRC = 0.051;
const CIRC_OK = REST_CIRC * 1.5;

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? +process.argv[i + 1] : d;
};
const RES = arg("--res", 256);
const STEPS = arg("--steps", 13);
const PASSES = arg("--passes", 4);
const NF = arg("--n", MELT_SAT);
// a single global scale on the derived FORM_SOLIDITY, fitted alongside the
// knots: thicker droplets buy area and cost roundness, so the two levers only
// mean anything together.
let solScale = 1;
const MELTS = [0, 1, 2, 3, 4, 5, 6, 7];

const forms = await loadForms();
const PS = [...Array(STEPS + 1)].map((_, i) => i / STEPS);

// ── the shipped schedule, and the knobs the fit is allowed to move ────────────
// The last four knots are pinned at 1: past q = 0.35 the departing form has
// vanished entirely (formPresence measures 1% of its area left by q = 0.3), so
// the cloud must be fully present there under any law.
const SHIPPED = [0, 0.075, 0.15, 0.23, 0.27, 0.52, 0.9, 1, 1, 1, 1];
const FREE = 7; // knots 0..6; knot 0 is pinned at 0 (exact endpoints)

const smoothstep01 = (t) => t * t * (3 - 2 * t);
function presenceFrom(knots, p) {
  const q = p > 0.5 ? 1 - p : p;
  const x = clamp01(q * 2) * (knots.length - 1);
  const i = Math.min(knots.length - 2, Math.floor(x));
  const f = x - i;
  return knots[i] + (knots[i + 1] - knots[i]) * smoothstep01(f);
}
// bridgeDensity's fragile-tail compression, mirrored (melt.mjs)
const LO = 0.055;
const HI = 0.14;
const densityFrom = (pres) => pres * smoothstep01(clamp01((pres - LO) / (HI - LO)));

// ── cache the form half of every frame ────────────────────────────────────────
console.log(`preparing ${MELTS.length * PS.length} frames at ${RES}² …`);
const frames = [];
for (const a of MELTS) {
  const b = (a + 1) % 8;
  const perm = permFor(a, b);
  const endpoints = [];
  for (const end of [0, 1]) {
    const ph = formPhase(end);
    const f = prepareForms({
      forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES, n: NF,
    });
    let lit = 0;
    for (let i = 0; i < f.T.length; i++) if (f.T[i] >= 1) lit++;
    endpoints.push(lit);
  }
  for (const p of PS) {
    const ph = formPhase(p);
    const f = prepareForms({
      forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES, n: NF,
    });
    frames.push({
      a, b, p, perm, T: f.T, shield: f.shield,
      ref: endpoints[0] + (endpoints[1] - endpoints[0]) * p,
    });
  }
}

/**
 * Score one schedule. The droplet geometry is baked, but its density is not:
 * meltDroplet already multiplied radius by its own presence, so the candidate
 * is applied as a RATIO against the shipped presence that produced the bake.
 */
function shapeOf(T) {
  const on = new Uint8Array(T.length);
  let area = 0;
  for (let i = 0; i < T.length; i++)
    if (T[i] >= 1) { on[i] = 1; area++; }
  let per = 0;
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      if (!on[y * RES + x]) continue;
      if (x === 0 || !on[y * RES + x - 1]) per++;
      if (x === RES - 1 || !on[y * RES + x + 1]) per++;
      if (y === 0 || !on[(y - 1) * RES + x]) per++;
      if (y === RES - 1 || !on[(y + 1) * RES + x]) per++;
    }
  return { area, circ: per > 0 ? (4 * Math.PI * area) / (per * per) : 0, on };
}

/** Liquid that appears away from the body it should have grown out of. The
 *  schedule drives this directly: a cloud switched on faster than the form
 *  gives way materialises rather than emerges. */
function popBetween(prev, next) {
  let fresh = 0;
  for (let i = 0; i < next.length; i++) if (next[i] && !prev[i]) fresh++;
  if (!fresh) return 0;
  const d2 = edt2d(prev, RES, RES);
  let sum = 0;
  for (let i = 0; i < next.length; i++) if (next[i] && !prev[i]) sum += Math.sqrt(d2[i]);
  return sum / fresh / RES;
}

function score(knots, scale) {
  let worst = 0;
  let sum = 0;
  let circSum = 0;
  let circWorst = 0;
  let popWorst = 0;
  let prevOn = null;
  let prevKey = "";
  const dr = [0, 0, 0, 0];
  for (const f of frames) {
    // Presence is handed to the KERNEL, not applied to its output: it scales
    // the radius swell, the swirl and the micro-tether as well as the density,
    // so correcting only out[3] fits a droplet the renderer never draws.
    const want = densityFrom(presenceFrom(knots, f.p));
    const balls = [];
    for (let i = 0; i < N; i++) {
      meltDroplet(dr, i, CLOUDS[f.a], CLOUDS[f.b], f.perm, STAG[f.a], f.p,
        FORM_SOLIDITY[f.a] * scale, FORM_SOLIDITY[f.b] * scale, want);
      balls.push([dr[0], dr[1], dr[2], dr[3]]);
    }
    const s = shapeOf(addBalls(f.T, f.shield, RES, balls, NF).T);
    const e = Math.abs(1 - s.area / Math.max(f.ref, 1));
    sum += e;
    if (e > worst) worst = e;
    circSum += Math.max(0, s.circ - CIRC_OK);
    circWorst = Math.max(circWorst, s.circ);
    const key = `${f.a}-${f.b}`;
    if (prevOn && key === prevKey) popWorst = Math.max(popWorst, popBetween(prevOn, s.on));
    prevOn = s.on;
    prevKey = key;
  }
  return {
    worst, mean: sum / frames.length,
    circMean: circSum / frames.length, circWorst, popWorst,
  };
}

/** Area AND shape. Fitting either alone is how the melt got here: an area-only
 *  objective is satisfied perfectly by a body that inflates into a disc. */
const POP_OK = 0.034; // what the shipped n = 1 melt achieves — do not regress it
const cost = (s) =>
  s.worst +
  s.mean * 0.5 +
  s.circMean * 6 +
  Math.max(0, s.circWorst - 0.15) * 3 +
  Math.max(0, s.popWorst - POP_OK) * 20;

let best = SHIPPED.slice();
let bestS = score(best, solScale);
const show = (tag, s) =>
  console.log(
    `${tag.padEnd(22)} area worst ${(s.worst * 100).toFixed(0).padStart(3)}%  mean ${(s.mean * 100).toFixed(0).padStart(3)}%` +
      `   circ worst ${s.circWorst.toFixed(3)}  over-budget mean ${s.circMean.toFixed(4)}`,
  );
show("shipped schedule", bestS);

const STEPS_TRY = [0.32, 0.16, 0.08, 0.04, 0.02];
for (let pass = 0; pass < PASSES; pass++) {
  const delta = STEPS_TRY[Math.min(pass, STEPS_TRY.length - 1)];
  let improved = false;
  for (let i = 1; i < FREE; i++) {
    for (const d of [delta, -delta]) {
      const cand = best.slice();
      cand[i] = clamp01(cand[i] + d);
      // monotone non-decreasing — the cloud never un-arrives mid-ramp
      for (let j = 1; j < cand.length; j++) cand[j] = Math.max(cand[j], cand[j - 1]);
      const s = score(cand, solScale);
      if (cost(s) < cost(bestS) - 1e-6) {
        best = cand; bestS = s; improved = true;
      }
    }
  }
  // …and the solidity scale, on the same descent
  for (const d of [delta * 0.6, -delta * 0.6]) {
    const cand = Math.max(0.2, Math.min(1.6, solScale + d));
    const s = score(best, cand);
    if (cost(s) < cost(bestS) - 1e-6) {
      solScale = cand; bestS = s; improved = true;
    }
  }
  show(`pass ${pass + 1} (±${delta})`, bestS);
  console.log(`  knots [${best.map((v) => v.toFixed(3)).join(", ")}]  solidity ×${solScale.toFixed(2)}`);
  if (!improved && pass > 0) break;
}

console.log(
  `\nconst BRIDGE_KNOTS = [${best.map((v) => +v.toFixed(3)).join(", ")}];`,
);
console.log(
  `// fitted at C = ${MELT_SAT}: worst excursion ${(bestS.worst * 100).toFixed(0)}%, mean ${(bestS.mean * 100).toFixed(0)}%`,
);
