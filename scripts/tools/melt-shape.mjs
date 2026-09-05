/**
 * THE SHAPE GATE — the measurement tools/melt-mass.mjs is blind to.
 *
 * melt-mass gates dip/bump/step: how much LIQUID there is at each frame of a
 * melt. Every one of those numbers is invariant to shape, so a melt can hold
 * 102% of its endpoints' area, close every hole, round every concavity and
 * score perfectly. That is exactly what the shipped melt does, and it is why
 * the inflation survived every previous tuning pass — the objective did not
 * contain it. Nothing downstream can converge on a defect its gate cannot see,
 * so this is the gate.
 *
 * WHAT IT MEASURES
 *
 *   circ   4πA/P². 1.0 is a disc. The eight rest forms sit at 0.035-0.080
 *          (mean 0.051), so a melt that drifts toward 0.1+ is the "why does it
 *          inflate into a blob" report, quantified.
 *
 *   pop    mean uv distance from a pixel that has just LIT UP to the nearest
 *          pixel already lit one frame earlier. A body that deforms grows its
 *          boundary outward, so new liquid appears against the mass and this
 *          stays near a pixel; liquid that materialises somewhere else makes it
 *          jump. This is what separates a transformation you can follow from a
 *          cross-dissolve.
 *
 *   holes  the forms have them; a blob does not.
 *
 *   neck   THE GOO, priced. Two droplets at a spread of gaps: how wide is the
 *          bridge of liquid between them, and at what gap do they part? The
 *          combination exponent is exactly the knob that decides this, so any
 *          reduction in circ has to be read against what it costs here — the
 *          merge is the site's material language, not a defect to optimise out.
 *
 * Run:
 *   node scripts/tools/melt-shape.mjs                 the gate, at the shipped n
 *   node scripts/tools/melt-shape.mjs --sweep 1,2,3,6 compare combination exponents
 *   node scripts/tools/melt-shape.mjs --melts 0,3     a subset, for a quick loop
 *
 * Exits non-zero if any budget below is breached.
 */
import { loadForms, prepareForms, addBalls } from "../support/melt-sim.mjs";
import { CLOUDS, STAG, N } from "../../lib/webgl/phys.mjs";
import { permFor, formPhase, meltDroplet, FORM_SOLIDITY, meltSat } from "../../lib/webgl/melt.mjs";
import { MELT_SAT } from "../../lib/webgl/sdf-glass-shader.mjs";
import { edt2d } from "../../lib/webgl/sdf-core.mjs";

// ── budgets ───────────────────────────────────────────────────────────────────
// A REGRESSION GUARD, set just above what the melts currently measure — the
// same rule tools/melt-mass.mjs states — not an aspiration. Measured on the eight
// melts at 16 steps, against the plain sum this replaced:
//
//                        sum (was)   C = 2.5 (now)
//   circ (mean worst)      0.135         0.111
//   circ (worst melt)      0.203         0.179
//   area± (worst)           21%           23%
//   pop (worst frame)      0.0340        0.0326
//   neck at 2.6 radii       0.55          0.46
//
// The forms' own circularity is 0.051, so a melt is still twice as round as
// the shapes it connects. That is the floor of this representation, not a
// tuning shortfall: 48 discs cannot hold a thin vector feature, and the two
// ways of closing the gap — overlap fill, or fatter discs — are both round.
// Going further is a taste call about how much merge to spend, and it is one
// reload away on ?fsat=. Anything past these budgets is a NEW defect.
const BUDGET = {
  circ: 0.14,
  pop: 0.035,
  area: 0.26,
  // Connectivity, against what the shipped melt measures: worst 12 bodies with
  // the largest holding 31% of the mass. Anything past this is the cloud
  // coming apart, which reads as a broken transition rather than a morph —
  // and it is the term that was missing while two bad passes scored as wins.
  bodies: 14,
  whole: 0.28,
};

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const RES = +arg("--res", 384);
const STEPS = +arg("--steps", 16);
const SWEEP = arg("--sweep", "") ? arg("--sweep", "").split(",").map(Number) : null;
const MELTS = arg("--melts", "")
  ? arg("--melts", "").split(",").map(Number)
  : [0, 1, 2, 3, 4, 5, 6, 7];
const NAMES = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];

const forms = await loadForms();

function stats(on) {
  let area = 0;
  for (let i = 0; i < on.length; i++) if (on[i]) area++;
  let per = 0;
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      if (!on[y * RES + x]) continue;
      if (x === 0 || !on[y * RES + x - 1]) per++;
      if (x === RES - 1 || !on[y * RES + x + 1]) per++;
      if (y === 0 || !on[(y - 1) * RES + x]) per++;
      if (y === RES - 1 || !on[(y + 1) * RES + x]) per++;
    }
  const lab = new Uint8Array(RES * RES);
  let bg = 0;
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      const i = y * RES + x;
      if (on[i] || lab[i]) continue;
      bg++;
      const st = [i];
      lab[i] = 1;
      while (st.length) {
        const p = st.pop();
        const px = p % RES;
        const py = (p / RES) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= RES || ny >= RES) continue;
          const q = ny * RES + nx;
          if (lab[q] || on[q]) continue;
          lab[q] = 1;
          st.push(q);
        }
      }
    }
  // CONNECTIVITY — the term this gate was missing, and the reason two bad
  // passes scored as wins. A shattered cloud has an enormous perimeter, so
  // fragmenting the body LOWERS circularity: without this, "less round" and
  // "come apart into beads" are indistinguishable, and the gate rewards the
  // second while you are trying to buy the first.
  const lab2 = new Uint8Array(RES * RES);
  let bodies = 0;
  let largest = 0;
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      const i = y * RES + x;
      if (!on[i] || lab2[i]) continue;
      bodies++;
      let sz = 0;
      const st = [i];
      lab2[i] = 1;
      while (st.length) {
        const p = st.pop();
        sz++;
        const px = p % RES;
        const py = (p / RES) | 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= RES || ny >= RES) continue;
          const q = ny * RES + nx;
          if (lab2[q] || !on[q]) continue;
          lab2[q] = 1;
          st.push(q);
        }
      }
      if (sz > largest) largest = sz;
    }
  return {
    area,
    circ: per > 0 ? (4 * Math.PI * area) / (per * per) : 0,
    holes: Math.max(0, bg - 1),
    bodies,
    whole: area ? largest / area : 1,
  };
}

function popDistance(prev, next) {
  let fresh = 0;
  for (let i = 0; i < next.length; i++) if (next[i] && !prev[i]) fresh++;
  if (fresh === 0) return 0;
  const d2 = edt2d(prev, RES, RES);
  let sum = 0;
  for (let i = 0; i < next.length; i++) if (next[i] && !prev[i]) sum += Math.sqrt(d2[i]);
  return sum / fresh / RES;
}

/** One frame of the SHIPPED melt: formPhase drains A / lands B, the §3.3
 *  droplet cloud carries the middle. */
function meltMask(a, b, p, n) {
  // n is the ceiling AT THE PEAK; the frame's own ceiling rides the envelope
  // exactly as the driver uploads it (melt.mjs meltSat).
  const c = meltSat(p) * (n / MELT_SAT);
  const ph = formPhase(p);
  const { T, shield, res } = prepareForms({
    forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES, n: c,
  });
  const perm = permFor(a, b);
  const balls = [];
  const dr = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    meltDroplet(dr, i, CLOUDS[a], CLOUDS[b], perm, STAG[a], p, FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
    balls.push([dr[0], dr[1], dr[2], dr[3]]);
  }
  const out = addBalls(T, shield, res, balls, c);
  const on = new Uint8Array(RES * RES);
  for (let i = 0; i < on.length; i++) on[i] = out.T[i] >= 1 ? 1 : 0;
  return on;
}

const PS = [...Array(STEPS + 1)].map((_, i) => i / STEPS);

function runMelts(n, verbose) {
  const acc = { circ: 0, pop: 0, popMax: 0, area: 0, holes: 0, worst: [] };
  for (const a of MELTS) {
    const b = (a + 1) % 8;
    const masks = PS.map((p) => meltMask(a, b, p, n));
    const st = masks.map(stats);
    const A0 = st[0].area;
    const A1 = st[st.length - 1].area;
    let pop = 0;
    let popMax = 0;
    for (let i = 1; i < masks.length; i++) {
      const d = popDistance(masks[i - 1], masks[i]);
      if (process.env.DETAIL && d > 0.025) {
        const dist = edt2d(masks[i - 1], RES, RES);
        let fresh = 0, far = 0, sx = 0, sy = 0;
        for (let k = 0; k < dist.length; k++) if (masks[i][k] && !masks[i - 1][k]) {
          fresh++;
          if (Math.sqrt(dist[k]) / RES > 0.025) {
            far++; sx += k % RES; sy += Math.floor(k / RES);
          }
        }
        console.log(`  pop ${a}->${b} p=${PS[i]}: ${d.toFixed(5)}, fresh=${fresh}, far=${far}, centre=${sx/far/RES},${sy/far/RES}`);
      }
      pop += d;
      if (d > popMax) popMax = d;
    }
    pop /= masks.length - 1;
    const mid = st[(STEPS / 2) | 0];
    const worstBodies = Math.max(...st.map((x) => x.bodies));
    const worstWhole = Math.min(...st.map((x) => x.whole));
    const worstCirc = Math.max(...st.map((s) => s.circ));
    let worstArea = 0;
    st.forEach((s, i) => {
      const ref = A0 + (A1 - A0) * PS[i];
      worstArea = Math.max(worstArea, Math.abs(1 - s.area / Math.max(ref, 1)));
    });
    if (verbose)
      console.log(
        `  ${(NAMES[a] + "→" + NAMES[b]).padEnd(22)} circ ${mid.circ.toFixed(3)} (worst ${worstCirc.toFixed(3)})` +
          `  area±${(worstArea * 100).toFixed(0).padStart(3)}%  holes ${mid.holes}` +
          `  bodies ${String(worstBodies).padStart(2)} whole ${(worstWhole * 100).toFixed(0).padStart(3)}%` +
          `  pop ${pop.toFixed(4)} (worst ${popMax.toFixed(4)})`,
      );
    acc.circ += worstCirc;
    acc.pop += pop;
    acc.popMax = Math.max(acc.popMax, popMax);
    acc.area = Math.max(acc.area, worstArea);
    acc.holes += mid.holes;
    acc.bodies = Math.max(acc.bodies ?? 0, worstBodies);
    acc.whole = Math.min(acc.whole ?? 1, worstWhole);
    acc.worst.push({ melt: `${NAMES[a]}→${NAMES[b]}`, circ: worstCirc, pop: popMax, area: worstArea });
  }
  const k = MELTS.length;
  return {
    circ: acc.circ / k, pop: acc.pop / k, popMax: acc.popMax, area: acc.area,
    holes: acc.holes / k, bodies: acc.bodies ?? 0, whole: acc.whole ?? 1,
    worst: acc.worst,
  };
}

/**
 * THE GOO, priced. Two equal droplets at a spread of centre gaps (in radii):
 * the width of the liquid bridge at the midline, as a fraction of a droplet's
 * diameter, and whether they read as one body at all.
 */
function neckProfile(n) {
  const R = 0.09;
  const rows = [];
  for (const gapR of [1.4, 1.7, 2.0, 2.3, 2.6]) {
    const g = R * gapR;
    const e = prepareForms({ forms, res: RES, n });
    const out = addBalls(
      e.T, e.shield, RES,
      [[0.5 - g / 2, 0.5, R, 1], [0.5 + g / 2, 0.5, R, 1]],
      n,
    );
    const on = new Uint8Array(RES * RES);
    for (let i = 0; i < on.length; i++) on[i] = out.T[i] >= 1 ? 1 : 0;
    // vertical extent of liquid on the midline = the neck
    const midX = Math.round(0.5 * RES);
    let neck = 0;
    for (let y = 0; y < RES; y++) if (on[y * RES + midX]) neck++;
    rows.push({ gapR, neck: neck / (2 * R * RES) });
  }
  return rows;
}

// ── run ───────────────────────────────────────────────────────────────────────
if (SWEEP) {
  console.log(`COMBINATION EXPONENT SWEEP — ${MELTS.length} melts, ${STEPS} steps`);
  console.log("  n     circ(worst)  area±   holes   pop(mean)  pop(worst)");
  const necks = {};
  for (const n of SWEEP) {
    const r = runMelts(n, false);
    necks[n] = neckProfile(n);
    console.log(
      `  ${String(n).padStart(2)}      ${r.circ.toFixed(3)}     ${(r.area * 100).toFixed(0).padStart(3)}%    ${r.holes.toFixed(1)}     ${r.pop.toFixed(4)}     ${r.popMax.toFixed(4)}`,
    );
  }
  console.log("\nTHE GOO — neck width at the midline, as a fraction of one droplet's diameter");
  console.log("  gap (radii)   " + SWEEP.map((n) => `n=${n}`.padStart(7)).join(""));
  for (let i = 0; i < necks[SWEEP[0]].length; i++)
    console.log(
      `  ${necks[SWEEP[0]][i].gapR.toFixed(1).padStart(8)}      ` +
        SWEEP.map((n) => necks[n][i].neck.toFixed(2).padStart(7)).join(""),
    );
  process.exit(0);
}

console.log(`THE SHAPE GATE — morph ceiling MELT_SAT = ${MELT_SAT}, ${MELTS.length} melts`);
const r = runMelts(MELT_SAT, true);
console.log(
  `\n  MEAN   circ ${r.circ.toFixed(3)} (budget ${BUDGET.circ.toFixed(3)})` +
    `   area ±${(r.area * 100).toFixed(0)}% (budget ${(BUDGET.area * 100).toFixed(0)}%)` +
    `   pop worst ${r.popMax.toFixed(4)} (budget ${BUDGET.pop.toFixed(4)})` +
    `   holes ${r.holes.toFixed(1)}` +
    `
         bodies worst ${r.bodies} (budget ${BUDGET.bodies})   largest body ${(r.whole * 100).toFixed(0)}% (budget ${(BUDGET.whole * 100).toFixed(0)}%)`,
);
console.log("\nTHE GOO — neck width at the midline, as a fraction of one droplet's diameter");
for (const row of neckProfile(MELT_SAT))
  console.log(`  gap ${row.gapR.toFixed(1)} radii   ${row.neck.toFixed(2)}`);

const fails = [];
if (r.circ > BUDGET.circ) fails.push(`circ ${r.circ.toFixed(3)} > ${BUDGET.circ.toFixed(3)}`);
if (r.popMax > BUDGET.pop) fails.push(`pop ${r.popMax.toFixed(4)} > ${BUDGET.pop.toFixed(4)}`);
if (r.area > BUDGET.area) fails.push(`area ±${(r.area * 100).toFixed(0)}% > ${(BUDGET.area * 100).toFixed(0)}%`);
if (r.bodies > BUDGET.bodies) fails.push(`fragmented into ${r.bodies} bodies > ${BUDGET.bodies}`);
if (r.whole < BUDGET.whole) fails.push(`largest body only ${(r.whole * 100).toFixed(0)}% < ${(BUDGET.whole * 100).toFixed(0)}%`);
if (fails.length) {
  console.log(`\nFAIL: ${fails.join("  ·  ")}`);
  for (const w of r.worst.sort((x, y) => y.circ - x.circ).slice(0, 3))
    console.log(`  worst: ${w.melt} circ ${w.circ.toFixed(3)} pop ${w.pop.toFixed(4)} area ±${(w.area * 100).toFixed(0)}%`);
  process.exit(1);
}
console.log("\nPASS");
