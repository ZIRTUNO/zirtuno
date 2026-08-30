// Bounding box of the largest cyan component, in raw pixels — used to derive
// the stage's actual uv → pixel mapping empirically rather than assuming it.
import fs from "node:fs";
import { PNG } from "pngjs";
for (const file of process.argv.slice(2)) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png;
  const XM = Math.floor(W * 0.995);
  const lit = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < XM; x++) {
      const j = (y * W + x) * 4;
      if (data[j + 2] > 90 && data[j + 1] > 70 && data[j + 2] > data[j] + 60) lit[y * W + x] = 1;
    }
  const seen = new Uint8Array(W * H); const st = new Int32Array(W * H);
  let best = null;
  for (let p0 = 0; p0 < W * H; p0++) {
    if (!lit[p0] || seen[p0]) continue;
    let sp = 0; st[sp++] = p0; seen[p0] = 1;
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (sp) {
      const p = st[--sp]; const x = p % W; const y = (p / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q] || !lit[q]) continue;
        if (Math.abs((q % W) - x) > 1) continue;
        seen[q] = 1; st[sp++] = q;
      }
    }
    if (!best || n > best.n) best = { n, x0, x1, y0, y1 };
  }
  console.log(`${file.split(/[\/]/).pop()}  ${W}x${H}  bbox x ${best.x0}–${best.x1} y ${best.y0}–${best.y1}  centre (${((best.x0+best.x1)/2).toFixed(0)},${((best.y0+best.y1)/2).toFixed(0)})  size ${best.x1-best.x0}x${best.y1-best.y0}`);
}
