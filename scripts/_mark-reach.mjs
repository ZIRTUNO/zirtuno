// The RENDERED mark's maximum reach from the stage centre, in uv. The droplet
// cloud's support function underestimates this badly: metaball fields SUM
// where discs overlap, and the glass pass adds goo and blur on top, so the
// iso-surface stands well outside the union of the individual discs. Anything
// that has to clear the silhouette (Evolution's ring) must be sized off this
// number, measured, not off the cloud geometry.
import fs from "node:fs";
import { PNG } from "pngjs";

const file = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;
const aspect = W / H;
const cxUv = 0.5 - Math.min(0.15 * aspect, aspect / 2 - 0.32);
const cxPx = ((cxUv - 0.5 + aspect / 2) / aspect) * W;
const cyPx = H / 2;
// A single stray droplet sets the max, so measure the LARGEST CONNECTED
// COMPONENT — the mark itself — and nothing else.
const XM = Math.floor(W * 0.58);
const lit = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < XM; x++) {
    const j = (y * W + x) * 4;
    if (data[j + 2] > 90 && data[j + 1] > 70 && data[j + 2] > data[j] + 60)
      lit[y * W + x] = 1;
  }
const seen = new Uint8Array(W * H);
const stack = new Int32Array(W * H);
let max = 0;
let area = 0;
for (let p0 = 0; p0 < W * H; p0++) {
  if (!lit[p0] || seen[p0]) continue;
  let sp = 0;
  stack[sp++] = p0;
  seen[p0] = 1;
  let n = 0;
  let far = 0;
  while (sp) {
    const p = stack[--sp];
    const x = p % W;
    const y = (p / W) | 0;
    n++;
    const d = Math.hypot(x - cxPx, y - cyPx) / H; // one uv unit = viewport height
    if (d > far) far = d;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || seen[q] || !lit[q]) continue;
      if (Math.abs((q % W) - x) > 1) continue;
      seen[q] = 1;
      stack[sp++] = q;
    }
  }
  if (n > area) {
    area = n;
    max = far;
  }
}
console.log(
  `${file}  ${W}x${H}  stage centre (${cxPx.toFixed(0)},${cyPx.toFixed(0)})  mark ${area}px  max reach ${max.toFixed(4)} uv  (= ${(max / 0.5).toFixed(3)} x mScale at 0.5)`,
);
