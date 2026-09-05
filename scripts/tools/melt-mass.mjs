/**
 * THE MELT MASS GATE — every morph on the site, measured off-GPU in seconds.
 *
 * A melt is one body becoming another. Three ways that can visibly fail, and
 * this measures all three against the melt's own endpoints:
 *
 *   DIP   the liquid falls below the SMALLER of the two forms — it thinned out,
 *         which is the "it vanishes mid-morph" report.
 *   BUMP  it swells above the LARGER — the two fields superadd and the body
 *         inflates before settling.
 *   STEP  the worst single-frame change — a cliff here is the "it JUMPS to the
 *         last morph" report, and it is the one a viewer notices first.
 *
 * Note what is NOT measured: constant mass. The seven service forms differ in
 * area by up to 38% (web 41550 px against marketing 27747 at the sim's scale),
 * so a melt MUST ramp between them; demanding a flat area was the mistake that
 * made earlier passes chase the wrong number. Only the excursions count.
 *
 * The cloud comes from the SHIPPED meltDroplet and the forms from the shipped
 * SDF pipeline, so this is a regression gate on the real kernel rather than a
 * paraphrase of it (scripts/support/melt-sim.mjs explains the port and its limits).
 *
 *   node scripts/tools/melt-mass.mjs            # report every melt
 *   node scripts/tools/melt-mass.mjs --gate     # exit 1 on regression
 *   node scripts/tools/melt-mass.mjs --pairs 1,4 --steps 41
 */
import { loadForms, prepareForms, addBalls } from "../support/melt-sim.mjs";
import { CLOUDS, N, STAG } from "../../lib/webgl/phys.mjs";
import {
  meltDroplet, permFor, formPhase, FORM_SOLIDITY, meltSat,
} from "../../lib/webgl/melt.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const STEPS = Number(flag("steps", 33));
const RES = Number(flag("res", 320));
const GATE = argv.includes("--gate");
const PAIRS = flag("pairs", null)
  ? flag("pairs").split(",").map(Number)
  : [0, 1, 2, 3, 4, 5, 6]; // 0->1 is the organism's entry melt; 6->7 the last

// Budgets — a REGRESSION guard, set just above what the melts currently measure
// (worst: dip 8% on 3->4, bump 20% on 0->1 and 1->2, step 33% on 1->2), not an
// aspiration. Anything past these is a new visible defect.
// For reference, the q^0.55 handoff these replaced measured, on the same
// harness: mean dip 15.1%, bump 23.5%, step 33.6% — worst dip 30%, step 45%.
const MAX_DIP = 12;
const MAX_BUMP = 24;
const MAX_STEP = 36;

const forms = await loadForms();
const d = [0, 0, 0, 0];

function profile(a, b) {
  const out = [];
  const A = CLOUDS[a], B = CLOUDS[b], pm = permFor(a, b), st = STAG[a];
  for (let s = 0; s < STEPS; s++) {
    const p = s / (STEPS - 1);
    // the SERVICES law: the handoff is carried by density, radius is not scaled
    // (packBridge additionally shrinks radius — that is the hero, see melt.mjs)
    const balls = [];
    for (let i = 0; i < N; i++) {
      meltDroplet(d, i, A, B, pm, st, p, FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
      balls.push([d[0], d[1], d[2], d[3]]);
    }
    const ph = formPhase(p);
    // The frame's own saturation ceiling, exactly as the driver uploads it —
    // without this the sim renders the historical plain sum and the gate
    // measures a field the site no longer draws.
    const c = meltSat(p);
    const { T, shield } = prepareForms({
      forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES, n: c,
    });
    out.push(addBalls(T, shield, RES, balls, c).lit);
  }
  return out;
}
let failed = 0;
console.log(`  melt      dip    bump    step     profile p=0 … p=1`);
const rows = [];
for (const a of PAIRS) {
  const b = a + 1;
  const v = profile(a, b);
  const lo = Math.min(v[0], v[STEPS - 1]), hi = Math.max(v[0], v[STEPS - 1]);
  const dip = Math.max(0, (1 - Math.min(...v) / lo) * 100);
  const bump = Math.max(0, (Math.max(...v) / hi - 1) * 100);
  let step = 0;
  for (let i = 1; i < STEPS; i++) step = Math.max(step, (Math.abs(v[i] - v[i - 1]) / lo) * 100);
  rows.push({ dip, bump, step });
  // The six calibrated Services pairs now stay inside 1% of their endpoint
  // area bounds. Retain the old limits only for the separate entry vocabulary.
  const bad = a > 0
    ? dip > 1 || bump > 1 || step > 10
    : dip > MAX_DIP || bump > MAX_BUMP || step > MAX_STEP;
  if (bad) failed++;
  const top = Math.max(...v);
  const spark = v
    .filter((_, i) => i % 3 === 0)
    .map((x) => "▁▂▃▄▅▆▇█"[Math.min(7, Math.round((x / top) * 7))])
    .join("");
  console.log(
    `  ${a}->${b}   ${dip.toFixed(0).padStart(4)}%  ${bump.toFixed(0).padStart(4)}%  ${step.toFixed(0).padStart(4)}%     ${spark}${bad ? "  ←" : ""}`,
  );
}
const mean = (k) => rows.reduce((x, r) => x + r[k], 0) / rows.length;
console.log(
  `\n  MEAN   ${mean("dip").toFixed(1)}%  ${mean("bump").toFixed(1)}%  ${mean("step").toFixed(1)}%` +
    `      Services budget 1/1/10; entry ${MAX_DIP}/${MAX_BUMP}/${MAX_STEP}`,
);
if (GATE) {
  if (failed) {
    console.log(`\n✗ ${failed} melt(s) over budget`);
    process.exit(1);
  }
  console.log("\n✓ every melt within budget");
}
