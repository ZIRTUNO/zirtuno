// Verify the S5 services metaball morphs to each pillar on scroll-in and the
// indicator tracks. Scrolls through the services section and captures the sticky
// metaball + active dot at several pillar positions.
//   BASE_URL=http://localhost:PORT node scripts/verify-services.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/verify";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
// let the app hydrate
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 30000 });
await page.waitForTimeout(2000);

// jump to services
await page.evaluate(() => document.getElementById("services")?.scrollIntoView());
await page.waitForTimeout(3000);

const metaSel = ".services-metaball-stage";
// wait for the services canvas to mount
let mounted = false;
for (let i = 0; i < 30; i++) {
  mounted = await page.evaluate(
    (s) => !!document.querySelector(`${s} canvas`),
    metaSel,
  );
  if (mounted) break;
  await page.waitForTimeout(700);
}

const readActive = () =>
  page.evaluate(() => {
    const dots = [...document.querySelectorAll(".services-metaball .pillar-dot")];
    return dots.findIndex((d) => d.classList.contains("is-active"));
  });

const meta = page.locator(metaSel).first();
const log = [{ mounted, active: await readActive() }];
await meta.screenshot({ path: path.join(OUT, "svc-0.png") });

// scroll through pillars; capture the morphing metaball + active dot
for (let k = 1; k <= 5; k++) {
  for (let w = 0; w < 4; w++) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1800); // let the melt settle
  log.push({ active: await readActive() });
  await meta.screenshot({ path: path.join(OUT, `svc-${k}.png`) });
}

console.log("SERVICES_REPORT " + JSON.stringify({ log, errs }, null, 2));
await browser.close();
