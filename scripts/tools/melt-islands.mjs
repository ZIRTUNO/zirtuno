/**
 * S4 bridge fragmentation probe.
 *
 * The mass gate catches a melt that loses or gains too much liquid, but the
 * same total area can still be distributed as one useful body plus several
 * unattractive pinprick islands. This renders the shipped bridge and counts
 * connected components small enough to read as accidental micro-balls.
 *
 *   node scripts/tools/melt-islands.mjs
 */
import { loadForms, renderFrame } from "../support/melt-sim.mjs";
import { CLOUDS, N, STAG } from "../../lib/webgl/phys.mjs";
import { CONFLUENCE, CONFLUENCE_STAG } from "../../lib/webgl/confluence.mjs";
import {
  meltDroplet,
  matchClouds,
  permFor,
  formPhase,
  FORM_SOLIDITY,
} from "../../lib/webgl/melt.mjs";

const RES = Number(process.env.RES ?? 256);
const STEPS = Number(process.env.STEPS ?? 41);
const MICRO_MAX = Number(process.env.MICRO_MAX ?? Math.round(RES * RES * 0.0012));
const MICRO_FRAME_BUDGET = Number(process.env.MICRO_FRAME_BUDGET ?? 24);
const MICRO_COUNT_BUDGET = Number(process.env.MICRO_COUNT_BUDGET ?? 2);
const MICRO_AREA_BUDGET = Number(process.env.MICRO_AREA_BUDGET ?? 90);
const forms = await loadForms();
const droplet = [0, 0, 0, 0];

function components(field) {
  const seen = new Uint8Array(field.length);
  const stack = new Int32Array(field.length);
  const areas = [];
  for (let seed = 0; seed < field.length; seed++) {
    if (seen[seed] || field[seed] < 1) continue;
    let top = 0;
    let area = 0;
    stack[top++] = seed;
    seen[seed] = 1;
    while (top) {
      const at = stack[--top];
      area++;
      const x = at % RES;
      const y = (at / RES) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = y + oy;
        if (ny < 0 || ny >= RES) continue;
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = x + ox;
          if (nx < 0 || nx >= RES) continue;
          const next = ny * RES + nx;
          if (seen[next] || field[next] < 1) continue;
          seen[next] = 1;
          stack[top++] = next;
        }
      }
    }
    areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

let totalMicroFrames = 0;
let totalMicroArea = 0;
let worstCount = 0;
let worstArea = 0;

console.log(`  melt    total frames   form-only   cloud-only   worst count / area   at p`);
// THE FIRST MELT WAS NEVER UNDER THIS GATE. `a = 0` used to mean
// CLOUDS[0] → CLOUDS[1] — the mark melting into the web form, with a form on
// BOTH sides — and the page has not run that melt since THE CONFLUENCE replaced
// the mark. What it actually runs is CONFLUENCE → CLOUDS[1] with NO form A, so
// the one melt whose droplets carry the frame unshielded was the one melt this
// probe was not looking at. It is the shipped staging that gets gated now.
for (let a = 0; a < CLOUDS.length - 1; a++) {
  const b = a + 1;
  const crossing = a === 0;
  const A = crossing ? CONFLUENCE : CLOUDS[a];
  const B = CLOUDS[b];
  const perm = crossing ? matchClouds(CONFLUENCE, CLOUDS[1]) : permFor(a, b);
  const stag = crossing ? CONFLUENCE_STAG : STAG[a];
  const swA = crossing ? 0 : FORM_SOLIDITY[a];
  let microFrames = 0;
  let pairWorstCount = 0;
  let pairWorstArea = 0;
  let pairWorstP = 0;
  let formMicroFrames = 0;
  let cloudMicroFrames = 0;

  for (let step = 1; step < STEPS - 1; step++) {
    const p = step / (STEPS - 1);
    const balls = [];
    for (let i = 0; i < N; i++) {
      meltDroplet(droplet, i, A, B, perm, stag, p, swA, FORM_SOLIDITY[b]);
      balls.push([...droplet]);
    }
    // The crossing stages form B alone — S3 has no vector behind it — so its
    // droplets run unshielded until the pillar's silhouette erodes in.
    const raw = formPhase(p);
    const phase = crossing
      ? { wA: 0, eA: 0, wB: raw.wB, eB: raw.eB }
      : raw;
    const frame = renderFrame({
      forms,
      a: crossing ? 0 : a,
      b,
      fa: phase.wA,
      fb: phase.wB,
      ea: phase.eA,
      eb: phase.eB,
      res: RES,
      balls,
    });
    const micro = components(frame.T).filter((area) => area <= MICRO_MAX);
    const formFrame = renderFrame({
      forms,
      a: crossing ? 0 : a,
      b,
      fa: phase.wA,
      fb: phase.wB,
      ea: phase.eA,
      eb: phase.eB,
      res: RES,
      balls: [],
    });
    const cloudFrame = renderFrame({
      forms,
      a: crossing ? 0 : a,
      b,
      res: RES,
      balls,
    });
    if (components(formFrame.T).some((area) => area <= MICRO_MAX)) {
      formMicroFrames++;
    }
    if (components(cloudFrame.T).some((area) => area <= MICRO_MAX)) {
      cloudMicroFrames++;
    }
    if (!micro.length) continue;
    microFrames++;
    const area = micro.reduce((sum, value) => sum + value, 0);
    if (
      micro.length > pairWorstCount ||
      (micro.length === pairWorstCount && area > pairWorstArea)
    ) {
      pairWorstCount = micro.length;
      pairWorstArea = area;
      pairWorstP = p;
    }
  }

  totalMicroFrames += microFrames;
  totalMicroArea += pairWorstArea;
  worstCount = Math.max(worstCount, pairWorstCount);
  worstArea = Math.max(worstArea, pairWorstArea);
  console.log(
    `  ${crossing ? "cross" : a}->${b}    ${String(microFrames).padStart(3)}/${STEPS - 2}` +
      `         ${String(formMicroFrames).padStart(3)}` +
      `          ${String(cloudMicroFrames).padStart(3)}` +
      `             ${String(pairWorstCount).padStart(2)} / ${String(pairWorstArea).padStart(3)}` +
      `     ${pairWorstP.toFixed(2)}`,
  );
}

console.log(
  `\n  TOTAL micro frames ${totalMicroFrames}; worst ${worstCount} islands / ${worstArea}px;` +
    ` pair-worst area sum ${totalMicroArea}px (threshold <= ${MICRO_MAX}px at ${RES}²)`,
);
console.log(
  `  BUDGET <= ${MICRO_FRAME_BUDGET} frames; <= ${MICRO_COUNT_BUDGET} islands; <= ${MICRO_AREA_BUDGET}px worst area`,
);
if (
  totalMicroFrames > MICRO_FRAME_BUDGET ||
  worstCount > MICRO_COUNT_BUDGET ||
  worstArea > MICRO_AREA_BUDGET
) {
  process.exitCode = 1;
}
