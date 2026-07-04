// Entry-veil (S1.10) regression guard. Asserts the three behaviors that make
// the loading moment safe to ship:
//   1. FIRST visit: the veil is up at load, plays the wordmark assembly, and
//      releases the page in ≤ 4 s (the hard cap can never strand it).
//   2. RETURN visit (same session): the veil never paints — the pre-paint
//      script hides it via html[data-zveil="seen"] before first paint.
//   3. REDUCED MOTION: the veil never paints.
// Dev server must be running:  node scripts/verify-entry-veil.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "OK " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

// ── 1 + 2: first visit plays, same-session reload skips ───────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "commit" });
  await page.waitForSelector(".entry-veil", { state: "attached", timeout: 8000 });
  const playing = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !!v && getComputedStyle(v).display !== "none";
  });
  check(playing, "first visit: the veil is up at load");
  await page
    .waitForFunction(() => !document.querySelector(".entry-veil"), {
      timeout: 5000,
    })
    .then(
      () => check(true, "first visit: the veil releases the page (≤ ~4 s)"),
      () => check(false, "first visit: the veil releases the page (≤ ~4 s)"),
    );

  await page.reload({ waitUntil: "domcontentloaded" });
  const skipped = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !v || getComputedStyle(v).display === "none";
  });
  check(skipped, "return visit (same session): the veil never paints");
  await ctx.close();
}

// ── 3: reduced motion never sees it ──────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "domcontentloaded" });
  const hidden = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !v || getComputedStyle(v).display === "none";
  });
  check(hidden, "reduced motion: the veil never paints");
  await ctx.close();
}

await browser.close();
if (failures) {
  console.error(`${failures} entry-veil check(s) FAILED`);
  process.exit(1);
}
console.log("entry veil: all checks passed");
