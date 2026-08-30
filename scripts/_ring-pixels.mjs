// Evolution's ring, measured off the RENDERED FRAME. The GL uniform tap is
// useless at rest here — method's activity() is 0, the cadence governor parks
// the canvas, and the last-uploaded ball buffer is a frame from during the
// scroll. Pixels are what the reader gets, so pixels are what is measured:
// connected cyan blobs, the mark identified as the largest, everything else
// checked for count, radial spread, angular spacing and clearance.
import fs from "node:fs";
import { PNG } from "pngjs";

const file = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;
// the stage column only — the copy sits right of the thread
const XMAX = Math.floor(W * 0.58);
const lit = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < XMAX; x++) {
    const j = (y * W + x) * 4;
    // brand cyan is #00E3FE: strong blue+green, almost no red
    if (data[j + 2] > 90 && data[j + 1] > 70 && data[j + 2] > data[j] + 60)
      lit[y * W + x] = 1;
  }
// flood fill
const seen = new Uint8Array(W * H);
const blobs = [];
const stack = new Int32Array(W * H);
for (let p0 = 0; p0 < W * H; p0++) {
  if (!lit[p0] || seen[p0]) continue;
  let sp = 0;
  stack[sp++] = p0;
  seen[p0] = 1;
  let n = 0, sx = 0, sy = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  while (sp) {
    const p = stack[--sp];
    const x = p % W, y = (p / W) | 0;
    n++; sx += x; sy += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || seen[q] || !lit[q]) continue;
      const qx = q % W;
      if (Math.abs(qx - x) > 1) continue; // no row wrap
      seen[q] = 1; stack[sp++] = q;
    }
  }
  if (n > 40) blobs.push({ n, cx: sx / n, cy: sy / n, minX, maxX, minY, maxY });
}
blobs.sort((a, b) => b.n - a.n);
const mark = blobs[0];
// Page chrome paints in the same cyan: the progress thread (1px x ~600),
// the side index ticks, the CTA's border, the cursor ring. A CELL is a
// roughly round blob of droplet size, so reject anything long, thin, huge or
// hollow before counting.
const cells = blobs.slice(1).filter((b) => {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const round = Math.max(w, h) / Math.min(w, h) < 2.2;
  const fill = b.n / (w * h); // the cursor ring and the CTA border are hollow
  return round && fill > 0.55 && w >= 10 && w <= 70 && h >= 10 && h <= 70;
});
const mx = (mark.minX + mark.maxX) / 2;
const my = (mark.minY + mark.maxY) / 2;
const markR = Math.max(mark.maxX - mark.minX, mark.maxY - mark.minY) / 2;
console.log(`${file}`);
console.log(`  mark  ${mark.n}px  box ${mark.maxX - mark.minX}x${mark.maxY - mark.minY}  centre (${mx.toFixed(0)},${my.toFixed(0)})`);
console.log(`  cells ${cells.length}  (a clean ring is 16; fewer means neighbours have fused)`);
// the mark carries a detached counter dot inside its own silhouette — it is
// part of the logo, not part of the ring
const ring = cells.filter(
  (c) => Math.hypot(c.cx - mx, c.cy - my) > markR * 0.85,
);
console.log(`  of those, outside the mark: ${ring.length}`);
const polar = ring
  .map((c) => ({
    r: Math.hypot(c.cx - mx, c.cy - my),
    a: (Math.atan2(c.cy - my, c.cx - mx) * 180) / Math.PI,
    px: c.n,
    w: c.maxX - c.minX,
  }))
  .sort((p, q) => p.a - q.a);
const rs = polar.map((p) => p.r);
console.log(`  radius  min ${Math.min(...rs).toFixed(0)}px  max ${Math.max(...rs).toFixed(0)}px  (mark half-extent ${markR.toFixed(0)}px)`);
console.log(`  clearance of the nearest cell from the mark's box: ${(Math.min(...rs) - markR).toFixed(0)}px`);
// Angular spacing alone is misleading — the ring alternates two radii, so two
// cells can share a bearing and still be far apart. What decides whether they
// FUSE is the centre-to-centre distance against their own widths.
const wide = (b) => ({ ...b, w: b.maxX - b.minX + 1 });
let worst = { d: 1e9 };
for (let i = 0; i < ring.length; i++)
  for (let j = i + 1; j < ring.length; j++) {
    const d = Math.hypot(ring[i].cx - ring[j].cx, ring[i].cy - ring[j].cy);
    if (d < worst.d) worst = { d, a: wide(ring[i]), b: wide(ring[j]) };
  }
if (worst.a) {
  const need = (worst.a.w + worst.b.w) / 2; // touching when centres close to this
  console.log(
    `  closest pair ${worst.d.toFixed(0)}px apart, widths ${worst.a.w}/${worst.b.w} — they touch under ~${need.toFixed(0)}px${worst.d < need ? "   FUSED" : ""}`,
  );
}
console.log(`  widest cell ${Math.max(...polar.map((p) => p.w))}px, narrowest ${Math.min(...polar.map((p) => p.w))}px`);
