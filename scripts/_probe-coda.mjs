/**
 * The FOOTER CODA under the new colophon panel.
 *
 * The panel made `.footer` roughly six times taller. `lib/webgl/scenes/footer.ts`
 * reads only the footer's BOTTOM edge, so in principle the release is untouched
 * — this proves it in the browser rather than by reading the scene:
 *
 *   · the scene's two windows (`on`, `p`) still reach 1 at the page bottom
 *   · the released droplet is still rendered, and still ends BELOW the panel
 *     (that is what the panel's bottom gutter exists for)
 *
 *   BASE_URL=http://localhost:3048 node scripts/_probe-coda.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3048";
const OUT = process.env.OUT || "captures/footer";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${BASE}/pt?fshot=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const total = await page.evaluate(() => document.body.scrollHeight);

/** The scene's own read(), recomputed from the live rects. */
const readScene = () =>
  page.evaluate(() => {
    const wr = document.querySelector(".footer")?.getBoundingClientRect();
    const panel = document.querySelector(".footer-panel")?.getBoundingClientRect();
    const vh = window.innerHeight;
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    return {
      scrollY: Math.round(window.scrollY),
      on: wr ? +clamp01((vh * 1.7 - wr.bottom) / (vh * 0.22)).toFixed(3) : null,
      p: wr ? +clamp01(1 - (wr.bottom - vh) / (vh * 0.7)).toFixed(3) : null,
      footerBottom: wr ? Math.round(wr.bottom) : null,
      // the gutter the released droplet falls through
      gutter: wr && panel ? Math.round(wr.bottom - panel.bottom) : null,
    };
  });

console.log("document height:", total);
for (const frac of [0.75, 0.88, 0.95, 1]) {
  await page.evaluate(
    ({ total, frac }) =>
      window.scrollTo({ top: total * frac, behavior: "instant" }),
    { total, frac },
  );
  await page.waitForTimeout(2200);
  console.log(`scroll ${(frac * 100).toFixed(0)}%`, JSON.stringify(await readScene()));
  await page.screenshot({ path: `${OUT}/coda-${Math.round(frac * 100)}.png` });
}

await browser.close();
console.log("done ->", OUT);
