// Two-row comparison strip for the S5 → S6 boundary: before on top, after
// below, at four stops of the same scroll clock (jTop in viewport heights).
import fs from "node:fs";
import { PNG } from "pngjs";

const STOPS = ["1_20", "1_10", "1_00", "0_70"];
const ROWS = [
  ["captures/s5s6-before", "before"],
  ["captures/s5s6-after2", "after"],
];
const SC = 3; // 1440x900 -> 480x300
const GAP = 8;

const load = (p) => PNG.sync.read(fs.readFileSync(p));
const first = load(`${ROWS[0][0]}/j${STOPS[0]}.png`);
const cw = Math.floor(first.width / SC);
const chh = Math.floor(first.height / SC);
const W = cw * STOPS.length + GAP * (STOPS.length - 1);
const H = chh * ROWS.length + GAP;
const out = new PNG({ width: W, height: H });
out.data.fill(0);
// gutters read as the page's own ink, not white
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;

for (let r = 0; r < ROWS.length; r++) {
  for (let s = 0; s < STOPS.length; s++) {
    const src = load(`${ROWS[r][0]}/j${STOPS[s]}.png`);
    const ox = s * (cw + GAP);
    const oy = r * (chh + GAP);
    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        // box-average the SC x SC block so the downscale keeps the liquid's edges
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
  }
}
const dest = "captures/s5s6-compare.png";
fs.writeFileSync(dest, PNG.sync.write(out));
console.log(`${dest}  ${W}x${H}  stops: ${STOPS.join(" ")}`);
