// S4 → S5 departure filmstrip: real composited frames every FSTEP viewport
// heights of the exit clock, tiled into one contact grid. The frames are the
// only honest read of "does this passage have steps in it".
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = Number(process.env.VW ?? 1120);
const VH = Number(process.env.VH ?? 700);
const HI = Number(process.env.HI ?? 1.45);
const LO = Number(process.env.LO ?? 0.25);
const FSTEP = Number(process.env.FSTEP ?? 0.08);
const COLS = Number(process.env.COLS ?? 5);
const SC = Number(process.env.SC ?? 4);
const OUT = process.env.OUT ?? "captures/s4s5-before";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 60000 });
await page.waitForTimeout(2500);

const g = await page.evaluate(() => {
  const y = window.scrollY;
  const j = document.querySelector("#method .method-journey").getBoundingClientRect();
  return { jTop: Math.round(j.top + y), vh: window.innerHeight };
});

const files = [];
for (let f = HI; f >= LO - 1e-6; f -= FSTEP) {
  const ff = +f.toFixed(2);
  const y = Math.round(g.jTop - ff * g.vh);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 40; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(650);
  const st = await page.evaluate(() => {
    const s = window.__scenes ?? {};
    return { exit: +(s.site?.exit ?? 0).toFixed(3), on: +(s.site?.on ?? 0).toFixed(3), mOn: +(s.method?.on ?? 0).toFixed(3) };
  });
  const p = path.join(OUT, `j${ff.toFixed(2).replace(".", "_")}.png`);
  await page.screenshot({ path: p });
  files.push(p);
  console.log(`j=${ff.toFixed(2)}vh y=${y} exit=${st.exit} on=${st.on} mOn=${st.mOn}`);
}
await browser.close();

// ── tile ──────────────────────────────────────────────────────────────────
const GAP = 6;
const load = (p) => PNG.sync.read(fs.readFileSync(p));
const first = load(files[0]);
const cw = Math.floor(first.width / SC), chh = Math.floor(first.height / SC);
const rows = Math.ceil(files.length / COLS);
const W = cw * COLS + GAP * (COLS - 1);
const H = chh * rows + GAP * (rows - 1);
const out = new PNG({ width: W, height: H });
out.data.fill(0);
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
files.forEach((f, n) => {
  const src = load(f);
  const ox = (n % COLS) * (cw + GAP), oy = Math.floor(n / COLS) * (chh + GAP);
  for (let y = 0; y < chh; y++)
    for (let x = 0; x < cw; x++) {
      let r = 0, gg = 0, b = 0;
      for (let dy = 0; dy < SC; dy++)
        for (let dx = 0; dx < SC; dx++) {
          const j = ((y * SC + dy) * src.width + (x * SC + dx)) * 4;
          r += src.data[j]; gg += src.data[j + 1]; b += src.data[j + 2];
        }
      const nn = SC * SC, k = ((oy + y) * W + ox + x) * 4;
      out.data[k] = r / nn; out.data[k + 1] = gg / nn; out.data[k + 2] = b / nn; out.data[k + 3] = 255;
    }
});
const dest = `${OUT}-sheet.png`;
fs.writeFileSync(dest, PNG.sync.write(out));
console.log(`${dest}  ${W}x${H}  ${files.length} frames`);
