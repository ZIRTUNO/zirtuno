/**
 * The footer social row, against the reference contract (upsunday.co
 * `.foot__social-link`):
 *
 *   transition: color .2s, transform .2s
 *   :hover     { color: <full strength>; transform: translateY(-1px) }
 *   svg        { 27.6px }
 *
 * Uses a REAL pointer hover (page.hover), not a synthetic mouseover — CSS
 * :hover does not respond to dispatched events, which is what made the same
 * check on the reference site report "transform: none".
 *
 *   BASE_URL=http://localhost:3051 node scripts/_probe-social-hover.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3051";
const OUT = process.env.OUT || "captures/footer-icons";
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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/pt?fshot=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() =>
  window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
);
await page.waitForTimeout(3000);

const row = page.locator(".footer-socials");
const links = page.locator(".footer-social");
const n = await links.count();
console.log("icons rendered:", n);

const read = (i) =>
  links.nth(i).evaluate((el) => {
    const c = getComputedStyle(el);
    const s = el.querySelector("svg");
    const sc = getComputedStyle(s);
    return {
      label: el.getAttribute("aria-label"),
      color: c.color,
      transform: c.transform,
      transition: c.transition,
      box: `${c.width}x${c.height}`,
      svg: `${sc.width}x${sc.height}`,
      viewBox: s.getAttribute("viewBox"),
      fill: s.getAttribute("fill"),
    };
  });

for (let i = 0; i < n; i++) console.log("  rest  ", JSON.stringify(await read(i)));

// crop the row at rest
const box = await row.boundingBox();
const pad = 14;
const clip = {
  x: box.x - pad,
  y: box.y - pad,
  width: box.width + pad * 2,
  height: box.height + pad * 2,
};
await page.screenshot({ path: `${OUT}/row-rest.png`, clip });

// REAL hover on the first icon
await links.nth(0).hover();
await page.waitForTimeout(450);
console.log("  HOVER ", JSON.stringify(await read(0)));
await page.screenshot({ path: `${OUT}/row-hover.png`, clip });

await browser.close();
console.log("done ->", OUT);
