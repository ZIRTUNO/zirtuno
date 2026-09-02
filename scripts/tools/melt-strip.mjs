/**
 * MELT FILMSTRIP — the morph as a contact sheet, rendered off-GPU.
 *
 * melt-mass, melt-islands and melt-flow each reduce a melt to a number, and a
 * number cannot tell you whether the thing looks alive. This renders the
 * shipped kernel through the same field the site uses and lays the frames out
 * left to right, so a change of law can be LOOKED at in seconds instead of
 * waiting on a browser capture.
 *
 *   node scripts/tools/melt-strip.mjs                  # all seven, 9 frames each
 *   PAIRS=5 COLS=13 node scripts/tools/melt-strip.mjs
 *   OUT=captures/melt/after.png node scripts/tools/melt-strip.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadForms, prepareForms, addBalls } from "../support/melt-sim.mjs";
import { CLOUDS, N, STAG } from "../../lib/webgl/phys.mjs";
import { meltDroplet, permFor, formPhase, FORM_SOLIDITY } from "../../lib/webgl/melt.mjs";

const RES = Number(process.env.RES ?? 200);
const COLS = Number(process.env.COLS ?? 9);
const PAD = 3;
const OUT = process.env.OUT ?? "captures/melt/strip.png";
const PAIRS = process.env.PAIRS
  ? process.env.PAIRS.split(",").map(Number)
  : [0, 1, 2, 3, 4, 5, 6];

const forms = await loadForms();
const d = [0, 0, 0, 0];

/** One melt frame as a 0/1 coverage grid, straight from the shipped kernel. */
function frame(a, b, p) {
  const A = CLOUDS[a],
    B = CLOUDS[b],
    pm = permFor(a, b),
    st = STAG[a];
  const balls = [];
  for (let i = 0; i < N; i++) {
    meltDroplet(d, i, A, B, pm, st, p, FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
    balls.push([d[0], d[1], d[2], d[3]]);
  }
  const ph = formPhase(p);
  const { T, shield } = prepareForms({
    forms, a, b, fa: ph.wA, fb: ph.wB, ea: ph.eA, eb: ph.eB, res: RES,
  });
  return addBalls(T, shield, RES, balls).T;
}

const cw = RES + PAD;
const W = COLS * cw + PAD;
const H = PAIRS.length * cw + PAD;
const png = new PNG({ width: W, height: H });
png.data.fill(0);
for (let i = 0; i < png.data.length; i += 4) png.data[i + 3] = 255;

PAIRS.forEach((a, r) => {
  for (let c = 0; c < COLS; c++) {
    const field = frame(a, a + 1, c / (COLS - 1));
    const ox = PAD + c * cw,
      oy = PAD + r * cw;
    for (let y = 0; y < RES; y++)
      for (let x = 0; x < RES; x++) {
        // the sim's row 0 is the bottom of the form; flip so the sheet reads
        // the way the page does
        const on = field[(RES - 1 - y) * RES + x] >= 1;
        const k = ((oy + y) * W + ox + x) << 2;
        png.data[k] = on ? 0x00 : 0x0a;
        png.data[k + 1] = on ? 0xe3 : 0x0a;
        png.data[k + 2] = on ? 0xfe : 0x0c;
      }
  }
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log(`  ${PAIRS.length} melts x ${COLS} frames -> ${OUT}`);
