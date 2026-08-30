// Contact strip across the S3 → S4 gap. Absolute scroll stops so the same y
// can be compared before/after a change.
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const OUT = process.env.OUT ?? "captures/s3s4";
const TAG = process.env.TAG ?? "before";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: VW, height: VH } })).newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(2000);

// anchor everything to the runway so the strip survives layout changes
const rw = await page.evaluate(() => {
  const e = document.querySelector("[data-organism]");
  const r = e.getBoundingClientRect();
  return { top: r.top + scrollY, h: r.height, vh: innerHeight };
});
const fuseEnd = Math.round(rw.top + rw.h - rw.vh); // gather === 1
const stops = (process.env.STOPS ?? "-300,0,150,300,450,600,750,900,1050,1200,1350,1500,1750")
  .split(",").map((d) => fuseEnd + Number(d));

for (const y of stops) {
  await page.evaluate(async (t) => {
    for (let i = 0; i < 40; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(1400);
  const d = y - fuseEnd;
  const name = `${TAG}-${d >= 0 ? "+" : "-"}${String(Math.abs(d)).padStart(4, "0")}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
}
await browser.close();
