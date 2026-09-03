/** Mean / p99 / blown-out share of a capture's luminance. Rec.709 on sRGB bytes. */
import sharp from "sharp";
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const n = info.width * info.height;
  const lum = new Float64Array(n);
  let sum = 0;
  for (let i = 0, o = 0; i < n; i++, o += ch) {
    const l = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
    lum[i] = l;
    sum += l;
  }
  const sorted = Float64Array.from(lum).sort();
  const at = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  let hot = 0, lit = 0;
  for (let i = 0; i < n; i++) {
    if (lum[i] > 200) hot++;
    if (lum[i] > 24) lit++;
  }
  console.log(
    f.split(/[\/]/).pop().padEnd(22),
    "mean", (sum / n).toFixed(2).padStart(7),
    "p99", at(0.99).toFixed(1).padStart(6),
    "max", sorted[n - 1].toFixed(0).padStart(4),
    "blown>200", ((hot / n) * 100).toFixed(2).padStart(6) + "%",
    "lit>24", ((lit / n) * 100).toFixed(1).padStart(6) + "%",
  );
}
