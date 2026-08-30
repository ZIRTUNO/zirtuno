// Measures MY footer row the same way _ref-social.mjs measured the reference,
// so the two sets of numbers are directly comparable.
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const OUT = "captures/footer-icons"; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:3052";
const browser = await chromium.launch({ ...LAUNCH, args: ["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/pt?fshot=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
await page.waitForTimeout(3000);

const links = page.locator(".footer-social");
console.log("icons:", await links.count());
const geo = await page.evaluate(() => {
  const els = [...document.querySelectorAll(".footer-social")];
  const r = els.map(e => e.getBoundingClientRect());
  const svgs = els.map(e => e.querySelector("svg").getBoundingClientRect());
  const glyphGaps = [];
  for (let i = 1; i < svgs.length; i++) glyphGaps.push(+(svgs[i].left - svgs[i-1].right).toFixed(2));
  const c = getComputedStyle(els[0]);
  return {
    box: `${r[0].width.toFixed(2)}x${r[0].height.toFixed(2)}`,
    glyph: `${svgs[0].width.toFixed(2)}x${svgs[0].height.toFixed(2)}`,
    glyphGaps, color: c.color, transform: c.transform, transition: c.transition,
    langToggleInFooter: !!document.querySelector(".footer .lang-toggle"),
  };
});
console.log("MINE  ", JSON.stringify(geo));
console.log("REF   ", JSON.stringify({ box:"33.75x33.75", glyph:"27x27", glyphGaps:[10.64], color:"rgba(0,0,0,0.55)", transform:"none", transition:"color 0.2s, transform 0.2s" }));

const row = page.locator(".footer-socials");
const b = await row.boundingBox();
const clip = { x: b.x-14, y: b.y-14, width: b.width+28, height: b.height+28 };
await page.screenshot({ path: `${OUT}/mine-rest.png`, clip });
const lb = await links.nth(0).boundingBox();
await page.mouse.move(lb.x+lb.width/2, lb.y+lb.height/2);
for (const w of [70,80,260]) { await page.waitForTimeout(w); }
console.log("HOVER ", JSON.stringify(await links.nth(0).evaluate(e=>{const c=getComputedStyle(e);return{color:c.color,transform:c.transform};})));
await page.screenshot({ path: `${OUT}/mine-hover.png`, clip });
await browser.close();
