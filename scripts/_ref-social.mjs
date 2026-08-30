/**
 * Ground truth for the reference footer's social row (upsunday.co).
 *
 * Two earlier attempts to read this were wrong: dispatched mouse events do not
 * fire CSS :hover, and the row measures 0x0 until the footer is actually
 * scrolled into view. This drives a REAL pointer at the REAL bottom of the
 * page and records the transition frame by frame.
 *
 *   node scripts/_ref-social.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const OUT = "captures/reference-social";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://www.upsunday.co/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// the footer only has size once it is genuinely at the bottom
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
}
await page.evaluate(() =>
  window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
);
await page.waitForTimeout(2500);

const row = page.locator(".foot__social").first();
const links = page.locator(".foot__social-link");
console.log("visible rows:", await row.count(), "links:", await links.count());

const snap = (i) =>
  links.nth(i).evaluate((el) => {
    const c = getComputedStyle(el);
    const s = el.querySelector("svg");
    const sc = getComputedStyle(s);
    const r = el.getBoundingClientRect();
    return {
      label: el.getAttribute("aria-label"),
      color: c.color,
      transform: c.transform,
      transition: c.transition,
      opacity: c.opacity,
      filter: c.filter,
      background: c.backgroundColor,
      borderRadius: c.borderRadius,
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      svg: `${sc.width} ${sc.height}`,
      strokeWidth: s.getAttribute("stroke-width"),
      gapOfParent: getComputedStyle(el.parentElement).gap,
    };
  });

console.log("REST  ", JSON.stringify(await snap(0)));

const box = await row.boundingBox();
console.log("row box:", JSON.stringify(box));
const pad = 16;
const clip = {
  x: box.x - pad,
  y: box.y - pad,
  width: box.width + pad * 2,
  height: box.height + pad * 2,
};
await page.screenshot({ path: `${OUT}/ref-row-rest.png`, clip });

// real pointer hover, sampled across the 200ms transition
const lb = await links.nth(0).boundingBox();
await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
for (const t of [60, 140, 400]) {
  await page.waitForTimeout(t === 60 ? 60 : t === 140 ? 80 : 260);
  console.log(`HOVER@${t}ms`, JSON.stringify(await snap(0)));
}
await page.screenshot({ path: `${OUT}/ref-row-hover.png`, clip });

// a big crop of the icons alone, for shape comparison
await page.screenshot({
  path: `${OUT}/ref-row-zoom.png`,
  clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
  scale: "css",
});

await browser.close();
console.log("done ->", OUT);
