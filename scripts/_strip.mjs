// One-row contact strip from named captures: node scripts/_strip.mjs out.png a.png b.png …
import fs from "node:fs";
import { PNG } from "pngjs";
const [dest, ...files] = process.argv.slice(2);
const SC = 3, GAP = 10;
const load = (p) => PNG.sync.read(fs.readFileSync(p));
const first = load(files[0]);
const cw = Math.floor(first.width / SC), ch = Math.floor(first.height / SC);
const W = cw * files.length + GAP * (files.length - 1);
const out = new PNG({ width: W, height: ch });
out.data.fill(0);
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
files.forEach((f, s) => {
  const src = load(f), ox = s * (cw + GAP);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SC; dy++)
        for (let dx = 0; dx < SC; dx++) {
          const j = ((y * SC + dy) * src.width + (x * SC + dx)) * 4;
          r += src.data[j]; g += src.data[j + 1]; b += src.data[j + 2];
        }
      const n = SC * SC, k = (y * W + ox + x) * 4;
      out.data[k] = r / n; out.data[k + 1] = g / n; out.data[k + 2] = b / n; out.data[k + 3] = 255;
    }
});
fs.writeFileSync(dest, PNG.sync.write(out));
console.log(`${dest}  ${W}x${ch}  ${files.length} frames`);
