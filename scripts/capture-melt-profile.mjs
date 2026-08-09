// THE CLOUD/FORM EQUIVALENCE CHECK.
//
// field-drivers.ts asserts that the §3.3 bridge cloud and the SDF form are
// interchangeable — "the bridge cloud carries 40861 px against the form's
// ~40000" — and warns that this "is worth re-checking with scripts/ if the
// services scale or the iso level is ever retuned". This is that script.
//
// It walks one pillar-to-pillar melt, screenshots the liquid column at each
// step, and reports the lit AREA and the bbox FILL per frame. Two numbers
// matter:
//   • mid-melt area vs the endpoints — the melt is supposed to be one body of
//     constant mass, so this should stay near 100%.
//   • cloud fill vs form fill — the equivalence itself. They must match; when
//     the S4 revamp moved svcScale 0.5 -> 0.62 they were 18% vs 32%, and that
//     shortfall is what read as "midway it jumps to the last morph".
//
// The form weights are a pure function of mState, which converges at rest, so
// stepped-and-settled capture is faithful here (the DROPLET channel is not —
// use diagnose-s4.mjs, which drives real wheel events, for that).
//
//   node scripts/capture-melt-profile.mjs           # melt 1 -> 2
//   PAIR=4 node scripts/capture-melt-profile.mjs    # melt 4 -> 5
import fs from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const STEPS = Number(process.env.STEPS ?? 24);
const PAIR = Number(process.env.PAIR ?? 1); // melt from pillar PAIR -> PAIR+1
const OUT = process.env.OUT ?? "s4-diag";
const TAG = process.env.TAG ?? "melt";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 20000 });
await page.waitForTimeout(1500);

const c = await page.evaluate((k) => {
  const ps = [...document.querySelectorAll("#services .pillar")];
  const mid = (el) => {
    const b = el.getBoundingClientRect();
    return b.top + window.scrollY + b.height / 2;
  };
  return { from: mid(ps[k - 1]), to: mid(ps[k]), vh: window.innerHeight };
}, PAIR);

const CLIP = { x: 700, y: 90, width: 740, height: 720 };
const SCALE = 4;
const TW = Math.floor(CLIP.width / SCALE);
const TH = Math.floor(CLIP.height / SCALE);
const strip = new PNG({ width: TW * STEPS, height: TH });
strip.data.fill(0);

console.log(`melt ${PAIR}->${PAIR + 1}: scrollY ${Math.round(c.from - c.vh / 2)} .. ${Math.round(c.to - c.vh / 2)}`);
for (let s = 0; s < STEPS; s++) {
  const y = Math.round(c.from - c.vh / 2 + ((c.to - c.from) * s) / (STEPS - 1));
  await page.evaluate(async (t) => {
    for (let i = 0; i < 12; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 120));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(750); // damped channels settle
  const st = await page.evaluate(() => ({
    m: window.__scenes.site.pairM,
    a: window.__scenes.site.pairA,
    b: window.__scenes.site.pairB,
    f: window.__s4form ? { fa: window.__s4form.fa, fb: window.__s4form.fb } : null,
  }));
  const buf = await page.screenshot({ clip: CLIP });
  const png = PNG.sync.read(buf);
  for (let ty = 0; ty < TH; ty++)
    for (let tx = 0; tx < TW; tx++) {
      const so = ((ty * SCALE) * png.width + tx * SCALE) << 2;
      const dof = (ty * strip.width + s * TW + tx) << 2;
      strip.data[dof] = png.data[so];
      strip.data[dof + 1] = png.data[so + 1];
      strip.data[dof + 2] = png.data[so + 2];
      strip.data[dof + 3] = 255;
    }
  console.log(
    `  ${String(s).padStart(2)} y=${String(y).padStart(6)} m=${st.m.toFixed(3)} pair ${st.a}->${st.b}` +
      (st.f ? `  fa=${st.f.fa.toFixed(3)} fb=${st.f.fb.toFixed(3)}` : ""),
  );
}
fs.writeFileSync(`${OUT}/${TAG}-strip.png`, PNG.sync.write(strip));

// ── the profile: lit area per frame, and the bbox fill that measures the
// cloud/form equivalence directly.
const area = [];
const fill = [];
for (let t = 0; t < STEPS; t++) {
  let c = 0,
    x0 = 1e9,
    x1 = -1,
    y0 = 1e9,
    y1 = -1;
  for (let y = 0; y < strip.height; y++)
    for (let x = 0; x < TW; x++) {
      const o = (y * strip.width + t * TW + x) << 2;
      if (strip.data[o] + strip.data[o + 1] + strip.data[o + 2] > 110) {
        c++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  area.push(c);
  fill.push(c ? (c / ((x1 - x0) * (y1 - y0))) * 100 : 0);
}
const ends = (area[3] + area[STEPS - 4]) / 2;
const mid = area.slice(Math.floor(STEPS * 0.34), Math.ceil(STEPS * 0.71));
const midMin = (Math.min(...mid) / ends) * 100;
const midAvg = (mid.reduce((a, b) => a + b, 0) / mid.length / ends) * 100;
let worst = 0;
for (let i = 1; i < STEPS - 1; i++)
  worst = Math.max(worst, (Math.abs(area[i] - area[i - 1]) / ends) * 100);
const formFill = (fill[3] + fill[STEPS - 5]) / 2;
const cloudFill = fill[STEPS >> 1];

console.log("\nMELT PROFILE (area as % of the endpoint forms)");
console.log(`  mid-melt minimum      ${midMin.toFixed(0)}%   (a hole here is the "it vanishes" report)`);
console.log(`  mid-melt average      ${midAvg.toFixed(0)}%   (100% = one body of constant mass)`);
console.log(`  worst single step     ${worst.toFixed(0)}%   (a cliff here is the "it jumps" report)`);
console.log(`  form fill  ${formFill.toFixed(0)}%  vs  cloud fill ${cloudFill.toFixed(0)}%   <- THE EQUIVALENCE`);
if (Math.abs(formFill - cloudFill) > 6)
  console.log(`  ** cloud/form equivalence has drifted — see BRIDGE_SWELL in field-drivers.ts`);
console.log(`\n-> ${OUT}/${TAG}-strip.png`);
await browser.close();
