/**
 * probe/contact.mjs — the contact page, photographed at rest.
 *
 * Shoots the three states that actually differ: a desktop arrival WITH an
 * `?intent=` tag (the chip must come back pre-selected), a desktop arrival
 * without one, and the phone stack. Reduced motion is forced, so the wetting
 * front is settled and the membranes are off — what lands is the resting
 * composition, not a frame from the middle of an entrance.
 *
 * Dev server must be running.  Run: node scripts/probe/contact.mjs [outDir]
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || "captures/contact";
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ["desk-intent", 1440, 900, `${BASE}/pt/contact?intent=analysis`],
  ["desk-plain", 1440, 900, `${BASE}/en/contact`],
  ["laptop-short", 1440, 760, `${BASE}/pt/contact`],
  ["mobile", 390, 844, `${BASE}/pt/contact`],
];

const browser = await chromium.launch(LAUNCH);
let problems = 0;

for (const [name, width, height, url] of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => {
    problems++;
    console.log(`  ! pageerror ${name}: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    problems++;
    console.log(`  ! console ${name}: ${message.text().slice(0, 200)}`);
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  console.log(`  shot ${name} ${width}x${height}`);
  await ctx.close();
}

await browser.close();
console.log(problems === 0 ? "\nCONTACT PROBE: clean" : `\n${problems} console/page errors`);
