/** Dump THE CONFLUENCE (and any melt frame of it) as a PNG, so the shape can be
 *  judged by eye without a browser. node scripts/_confluence-png.mjs [p ...] */
import fs from "node:fs";
import { PNG } from "pngjs";
import { CONFLUENCE } from "../../lib/webgl/confluence.mjs";
import { CLOUDS } from "../../lib/webgl/phys.mjs";
import { matchClouds, meltDroplet } from "../../lib/webgl/melt.mjs";
import { prepareForms, addBalls } from "../support/melt-sim.mjs";

const RES = 512;
const E = prepareForms({ forms: [], fa: 0, fb: 0, res: RES });
const OUT = process.env.OUT ?? "captures/confluence";
fs.mkdirSync(OUT, { recursive: true });

const WEB = CLOUDS[1];
const perm = matchClouds(CONFLUENCE, WEB);
const stag = CONFLUENCE.map((b) => b[0]);
const d = new Float32Array(4);
const cloudAt = (p) =>
  CONFLUENCE.map((_, i) => {
    meltDroplet(d, i, CONFLUENCE, WEB, perm, stag, p, 0, 0.073);
    return [d[0], d[1], d[2], 1];
  });

const dump = (balls, name) => {
  const { T } = addBalls(E.T, E.shield, RES, balls);
  const png = new PNG({ width: RES, height: RES });
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      const v = T[(RES - 1 - y) * RES + x];
      const i = (y * RES + x) * 4;
      const lit = v >= 1;
      const g = lit ? Math.min(1, 0.55 + 0.45 * Math.min((v - 1) / 3, 1)) : 0;
      png.data[i] = lit ? 0 : 6;
      png.data[i + 1] = lit ? Math.round(200 * g) : 10;
      png.data[i + 2] = lit ? Math.round(255 * g) : 14;
      png.data[i + 3] = 255;
    }
  fs.writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(png));
  console.log(`${OUT}/${name}.png`);
};

dump(CONFLUENCE.map((b) => [b[0], b[1], b[2], 1]), "rest");
for (const a of process.argv.slice(2)) dump(cloudAt(Number(a)), `melt-${a}`);
