/**
 * S4 SIDE-BY-SIDE — the live page, one kernel against another.
 *
 * capture-melt-profile.mjs answers "is the mass continuous". This answers the
 * question the mass profile cannot: WHERE IN THE SCROLL DOES THE SHAPE ACTUALLY
 * CHANGE. A melt can hold its area perfectly and still play as a still frame
 * that snaps at the end, which is exactly what the old transport curve did.
 *
 * Per step it reports CHANGE — pixels lit in this frame but not the last, over
 * the mean lit area — and from that one number:
 *
 *   MID     change at the MIDDLE step over the melt's mean change. This is the
 *           one that decides it. Mid-melt is where BRIDGE leaves neither form
 *           any weight and the droplet cloud is the only thing on screen, so it
 *           is where the deformation most needs to be visible. Under the old
 *           ease-out transport every melt's change profile had its MINIMUM
 *           there — measured 0.18x / 0.34x / 0.30x of mean, against 0.60x /
 *           1.85x / 0.92x after. The liquid was at its most present and its
 *           most still at the same time.
 *   BURST   worst step / mean step. 1.0 is a perfectly even deformation; a
 *           high burst is a melt that does its work in one or two frames and
 *           idles through the rest.
 *
 * Two passes, then stack them:
 *   TAG=after  node scripts/melt-compare.mjs
 *   TAG=before node scripts/melt-compare.mjs      # after swapping the kernel
 *   MODE=compose node scripts/melt-compare.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/melt";
const TAG = process.env.TAG ?? "after";
const STEPS = Number(process.env.STEPS ?? 9);
const PAIRS = (process.env.PAIRS ?? "1,4,6").split(",").map(Number);
const MODE = process.env.MODE ?? "capture";
const CLIP = { x: 700, y: 90, width: 740, height: 720 };
const SCALE = 4;
const TW = Math.floor(CLIP.width / SCALE);
const TH = Math.floor(CLIP.height / SCALE);
const LIT = (d, o) => d[o] + d[o + 1] + d[o + 2] > 110;

fs.mkdirSync(OUT, { recursive: true });

if (MODE === "compose") {
  const a = PNG.sync.read(fs.readFileSync(`${OUT}/cmp-before.png`));
  const b = PNG.sync.read(fs.readFileSync(`${OUT}/cmp-after.png`));
  const GAP = 4;
  const rowH = TH + GAP;
  const out = new PNG({ width: a.width, height: PAIRS.length * (2 * rowH + GAP) });
  out.data.fill(0);
  for (let i = 0; i < out.data.length; i += 4) out.data[i + 3] = 255;
  const blit = (src, srcRow, dstY) => {
    for (let y = 0; y < TH; y++)
      for (let x = 0; x < src.width; x++) {
        const s = ((srcRow * TH + y) * src.width + x) << 2;
        const d = ((dstY + y) * out.width + x) << 2;
        out.data[d] = src.data[s];
        out.data[d + 1] = src.data[s + 1];
        out.data[d + 2] = src.data[s + 2];
      }
  };
  PAIRS.forEach((_, r) => {
    const top = r * (2 * rowH + GAP);
    blit(a, r, top); // BEFORE on top
    blit(b, r, top + rowH); // AFTER beneath it
    // a dim rule between the two kernels, and a brighter one between melts
    for (let x = 0; x < out.width; x++) {
      for (let y = 0; y < GAP; y++) {
        const d = ((top + TH + y) * out.width + x) << 2;
        out.data[d] = 40; out.data[d + 1] = 40; out.data[d + 2] = 46;
      }
    }
  });
  fs.writeFileSync(`${OUT}/cmp-stacked.png`, PNG.sync.write(out));
  console.log(`  before over after, ${PAIRS.length} melts -> ${OUT}/cmp-stacked.png`);
  process.exit(0);
}

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

const strip = new PNG({ width: TW * STEPS, height: TH * PAIRS.length });
strip.data.fill(0);
for (let i = 0; i < strip.data.length; i += 4) strip.data[i + 3] = 255;

console.log(`  ${TAG}:  melt       mid    burst   change per step`);
const bursts = [];
const deads = [];

for (let r = 0; r < PAIRS.length; r++) {
  const PAIR = PAIRS[r];
  const c = await page.evaluate((k) => {
    const ps = [...document.querySelectorAll("#services .pillar")];
    const mid = (el) => {
      const b = el.getBoundingClientRect();
      return b.top + window.scrollY + b.height / 2;
    };
    return { from: mid(ps[k - 1]), to: mid(ps[k]), vh: window.innerHeight };
  }, PAIR);

  const masks = [];
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
    const png = PNG.sync.read(await page.screenshot({ clip: CLIP }));
    const mask = new Uint8Array(TW * TH);
    for (let ty = 0; ty < TH; ty++)
      for (let tx = 0; tx < TW; tx++) {
        const so = (ty * SCALE * png.width + tx * SCALE) << 2;
        const dof = ((r * TH + ty) * strip.width + s * TW + tx) << 2;
        strip.data[dof] = png.data[so];
        strip.data[dof + 1] = png.data[so + 1];
        strip.data[dof + 2] = png.data[so + 2];
        mask[ty * TW + tx] = LIT(png.data, so) ? 1 : 0;
      }
    masks.push(mask);
  }

  // CHANGE — symmetric difference against the previous frame, over mean area
  const areas = masks.map((m) => m.reduce((a, v) => a + v, 0));
  const meanArea = Math.max(areas.reduce((a, b) => a + b, 0) / areas.length, 1);
  const change = [];
  for (let s = 1; s < STEPS; s++) {
    let x = 0;
    for (let i = 0; i < masks[s].length; i++) if (masks[s][i] !== masks[s - 1][i]) x++;
    change.push((x / meanArea) * 100);
  }
  const mean = change.reduce((a, b) => a + b, 0) / change.length;
  const burst = Math.max(...change) / Math.max(mean, 1e-6);
  const mid = change[Math.floor(change.length / 2)] / Math.max(mean, 1e-6);
  bursts.push(burst);
  deads.push(mid);
  console.log(
    `        ${PAIR}->${PAIR + 1}    ${mid.toFixed(2).padStart(5)}x  ${burst.toFixed(2).padStart(5)}x   ` +
      change.map((v) => String(Math.round(v)).padStart(3)).join(" "),
  );
}

fs.writeFileSync(`${OUT}/cmp-${TAG}.png`, PNG.sync.write(strip));
console.log(
  `\n  ${TAG}  MEAN burst ${(bursts.reduce((a, b) => a + b, 0) / bursts.length).toFixed(2)}x  ` +
    `dead steps ${deads.reduce((a, b) => a + b, 0)}/${(STEPS - 1) * PAIRS.length}` +
    `   -> ${OUT}/cmp-${TAG}.png`,
);
await browser.close();
