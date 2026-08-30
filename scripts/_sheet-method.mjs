// Método before/after strip: the same five stops on the phase-centre clock,
// old schedule on top, new below.
import fs from "node:fs";
import { PNG } from "pngjs";

const STOPS = (process.env.STOPS ?? "2_00,2_50,3_00,3_50,4_00").split(",");
const ROWS = [
  [process.env.A ?? "captures/method-before", "before"],
  [process.env.B ?? "captures/method-final", "after"],
];
const SC = 3;
const GAP = 10;

const load = (p) => PNG.sync.read(fs.readFileSync(p));
const first = load(`${ROWS[0][0]}/u${STOPS[0]}.png`);
const cw = Math.floor(first.width / SC);
const chh = Math.floor(first.height / SC);
const W = cw * STOPS.length + GAP * (STOPS.length - 1);
const H = chh * ROWS.length + GAP;
const out = new PNG({ width: W, height: H });
out.data.fill(0);
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;

for (let r = 0; r < ROWS.length; r++)
  for (let s = 0; s < STOPS.length; s++) {
    const src = load(`${ROWS[r][0]}/u${STOPS[s]}.png`);
    const ox = s * (cw + GAP);
    const oy = r * (chh + GAP);
    for (let y = 0; y < chh; y++)
      for (let x = 0; x < cw; x++) {
        let rr = 0, gg = 0, bb = 0;
        for (let dy = 0; dy < SC; dy++)
          for (let dx = 0; dx < SC; dx++) {
            const j = ((y * SC + dy) * src.width + (x * SC + dx)) * 4;
            rr += src.data[j]; gg += src.data[j + 1]; bb += src.data[j + 2];
          }
        const n = SC * SC;
        const k = ((oy + y) * W + ox + x) * 4;
        out.data[k] = rr / n; out.data[k + 1] = gg / n; out.data[k + 2] = bb / n;
        out.data[k + 3] = 255;
      }
  }
const dest = process.env.OUT ?? "captures/method-before-after.png";
fs.writeFileSync(dest, PNG.sync.write(out));
console.log(`${dest}  ${W}x${H}  top=${ROWS[0][1]} bottom=${ROWS[1][1]}  stops ${STOPS.join(" ")}`);
