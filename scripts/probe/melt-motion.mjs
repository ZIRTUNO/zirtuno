// Measure the live conductor's two low-passes against the form handoff.
// This exercises motion, including reversal, rather than only settled targets.
import { loadForms, prepareForms, addBalls } from "../support/melt-sim.mjs";
import { CLOUDS, STAG, N, TAUP, PHYS } from "../../lib/webgl/phys.mjs";
import { meltDroplet, permFor, FORM_SOLIDITY, formPhase, dampFormPhase, bridgePresence, bridgeDensity } from "../../lib/webgl/melt.mjs";
const forms = await loadForms();
const RES = 144;
const dt = 1000 / 60;
const TRAVERSE_FRAMES = 120;
const SETTLE_FRAMES = 90;
const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
const km = 1 - Math.exp(-dt / PHYS.TAU_CHANNEL);
const d = [0, 0, 0, 0];
let failures = 0;
for (const legacy of [true, false]) for (const mode of ["direct", "progress", "channels"]) {
  let worst = 0;
  let worstDip = 0;
  for (let a = 1; a < 7; a++) for (const reverse of [false, true]) {
    const b = a + 1;
    const pm = permFor(a, b);
    const p0 = reverse ? 1 : 0;
    const balls = Array.from({ length: N }, (_, i) => {
      meltDroplet(d, i, CLOUDS[a], CLOUDS[b], pm, STAG[a], p0, FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
      return [...d];
    });
    const endpoints = [0, 1].map((p) => {
      const ph = formPhase(p);
      const f = prepareForms({ forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES });
      return addBalls(f.T, f.shield, RES, []).lit;
    });
    const lo = Math.min(...endpoints), hi = Math.max(...endpoints);
    let m = p0, mf = p0, ph = formPhase(m);
    for (let frame = 0; frame < TRAVERSE_FRAMES + SETTLE_FRAMES; frame++) {
      const p = Math.min(1, frame / TRAVERSE_FRAMES);
      m += ((reverse ? 1 - p : p) - m) * km;
      mf += (m - mf) * kr;
      const target = formPhase(m);
      if (mode === "direct") ph = target;
      else if (mode === "progress") ph = formPhase(mf);
      else dampFormPhase(ph, m, dt);
      for (let i = 0; i < N; i++) {
        meltDroplet(d, i, CLOUDS[a], CLOUDS[b], pm, STAG[a], m, FORM_SOLIDITY[a], FORM_SOLIDITY[b],
          legacy ? bridgeDensity(bridgePresence(m)) : undefined);
        const kp = 1 - Math.exp(-dt / TAUP[i]);
        balls[i][0] += (d[0] - balls[i][0]) * kp;
        balls[i][1] += (d[1] - balls[i][1]) * kp;
        balls[i][2] += (d[2] - balls[i][2]) * kr;
        balls[i][3] += (d[3] - balls[i][3]) * kr;
      }
      if (frame % 3) continue;
      const f = prepareForms({ forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES });
      const got = addBalls(f.T, f.shield, RES, balls).lit;
      worst = Math.max(worst, got / hi - 1);
      worstDip = Math.max(worstDip, 1 - got / lo);
    }
  }
  console.log(`${legacy?"legacy":"fitted"} ${mode}: max swell ${(worst*100).toFixed(1)}%, dip ${(worstDip*100).toFixed(1)}% (six pairs, both directions, 2 s traversal)`);
  if (!legacy && mode === "channels" && (worst > 0.02 || worstDip > 0.12)) failures++;
}
if (process.argv.includes("--gate")) {
  if (failures) throw new Error("Moving melt exceeded 2% swell / 12% dip budget");
  console.log("PASS: moving volume remains within budget in both directions");
}
