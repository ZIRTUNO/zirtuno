// Does the circuit have a HOLE, and how big? Flood-fills the background from
// the frame edge; any unreachable dark region inside the stage column is an
// enclosed hole. The one thing a fused puddle cannot show, measured.
import fs from "node:fs";
import { PNG } from "pngjs";
for (const file of process.argv.slice(2)) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png;
  const XM = Math.floor(W * 0.58);
  const dark = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < XM; x++) {
      const j = (y * W + x) * 4;
      if (!(data[j + 2] > 90 && data[j + 1] > 70 && data[j + 2] > data[j] + 60))
        dark[y * W + x] = 1;
    }
  const seen = new Uint8Array(W * H);
  const st = new Int32Array(W * H);
  let sp = 0;
  for (let y = 0; y < H; y++) { const p = y * W; if (dark[p] && !seen[p]) { seen[p] = 1; st[sp++] = p; } }
  for (let x = 0; x < XM; x++) {
    for (const p of [x, (H - 1) * W + x]) if (dark[p] && !seen[p]) { seen[p] = 1; st[sp++] = p; }
  }
  for (let y = 0; y < H; y++) { const p = y * W + XM - 1; if (dark[p] && !seen[p]) { seen[p] = 1; st[sp++] = p; } }
  while (sp) {
    const p = st[--sp];
    const x = p % W;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || seen[q] || !dark[q]) continue;
      if (Math.abs((q % W) - x) > 1) continue;
      if (q % W >= XM) continue;
      seen[q] = 1; st[sp++] = q;
    }
  }
  let best = 0;
  for (let p = 0; p < W * H; p++) {
    if (!dark[p] || seen[p]) continue;
    let n = 0; sp = 0; st[sp++] = p; seen[p] = 1;
    while (sp) {
      const q0 = st[--sp]; n++;
      const x = q0 % W;
      for (const q of [q0 - 1, q0 + 1, q0 - W, q0 + W]) {
        if (q < 0 || q >= W * H || seen[q] || !dark[q]) continue;
        if (Math.abs((q % W) - x) > 1) continue;
        seen[q] = 1; st[sp++] = q;
      }
    }
    if (n > best) best = n;
  }
  console.log(`${file.split(/[\/]/).pop()}  largest enclosed hole ${best}px  (~${(2 * Math.sqrt(best / Math.PI) / H).toFixed(3)} uv across)`);
}
