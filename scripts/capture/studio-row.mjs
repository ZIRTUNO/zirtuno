// S8's three-card row, shot for review. Dev server must be running:
//   node scripts/capture/studio-row.mjs            (LOCALE=en for the EN pass)
// Writes captures/studio-row-*.png
//
// The row's centre frame rotates on a 3.6 s interval, so this takes the row
// twice — once at rest and once after one advance — which is the only way to
// see that the travel lands on a slot instead of drifting.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH } from "../support/launch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "pt";
// one tile per surface on the web stage, so the sheet walks the whole rotation
const STEPS = Number(process.env.STEPS ?? 12);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const shots = [
  ["desktop", 1440, 900],
  ["wide", 1920, 1080],
  ["mobile", 390, 844],
];

for (const [name, width, height] of shots) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
  page.on(
    "console",
    (m) => m.type() === "error" && console.error("CONSOLE:", m.text()),
  );

  // any ?f* param suppresses the entry intro (see the locale layout's
  // pre-paint script), so the row is shot on a page that has already arrived
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-cards", { timeout: 30000 });
  await page.locator(".studio-cards").evaluate((n) =>
    n.scrollIntoView({ block: "center" }),
  );
  // the Reveal is scroll-bound; give it the full arrival plus a beat
  await page.waitForTimeout(2200);

  // CLIP, not an element screenshot. `locator.screenshot()` waits for the
  // element to be stable, and the row never is: the brand marquees run
  // forever, so the wait times out on a card that is working correctly.
  const row = page.locator(".studio-cards");
  const shootRow = async (file) => {
    const box = await row.boundingBox();
    if (!box) throw new Error(".studio-cards has no box");
    await page.screenshot({ path: path.join(OUT, file), clip: box });
  };

  await shootRow(`studio-row-${name}.png`);
  await page.screenshot({
    path: path.join(OUT, `studio-row-${name}-page.png`),
  });

  // The centre frame cycles six surfaces, so one extra shot proves nothing.
  // Walk the whole rotation — a contact sheet of the stage, one advance apart.
  for (let step = 2; step <= STEPS; step += 1) {
    await page.waitForTimeout(3000);
    await shootRow(`studio-row-${name}-t${step}.png`);
  }

  // and the fan under a hand
  if (name !== "mobile") {
    const tile = await page.locator(".ftile--c").boundingBox();
    if (tile) {
      await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
      await page.waitForTimeout(900);
      await shootRow(`studio-row-${name}-hover.png`);
      await page.mouse.move(0, 0);
    }
  }

  console.log(`${name}: ${width}x${height}`);
  await ctx.close();
}

await browser.close();
