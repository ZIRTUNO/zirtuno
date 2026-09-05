/**
 * THE MORPH, as it actually ships — captured off the Services scrub.
 *
 * The retired homepage form harness is quarantined in `Dead Code`; the ONE
 * morph on the live page is the Services scrub, which is scroll-driven and
 * therefore deterministic and still: scroll to a position, let it settle, shoot.
 *
 * Targeting starts from the measured pillar centres and closes the loop on
 * window.__optics (meltP, formA, formB). A binary search corrects each scroll
 * position until the uploaded progress matches the requested still.
 *
 * Run with the dev server up:
 *   BASE=http://localhost:3411 node scripts/capture/morph-scrub.mjs
 * Writes captures/morph-scrub/<pair>-m<p>.png and a contact sheet.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(HERE, "..", "..", "captures", "morph-scrub");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const TARGETS = (process.env.MIDS || "0,0.25,0.5,0.75,1").split(",").map(Number);
const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
// Review the actual desktop layout by default; WIDTH/HEIGHT cover narrow
// stages. The explicit full tier below keeps the glass material under test.
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.WIDTH || 1440), height: Number(process.env.HEIGHT || 900) },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`CONSOLE: ${m.text()}`));

await page.goto(`${BASE}/${LOCALE}?ftier=full`, { waitUntil: "networkidle" });
await page.waitForSelector("canvas", { timeout: 25000 });
await page.waitForTimeout(3000); // SDFs, then the flow solves
await page.mouse.move(2, 2);

/** Scroll there and let the damped scrub settle, then read what was uploaded. */
async function probe(y) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await page.evaluate(() => window.scrollY);
    if (Math.abs(y - current) < 1) break;
    await page.mouse.wheel(0, (y - current) / 0.9);
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(400); // settle the droplets as well as the progress
  return page.evaluate(() => {
    const o = window.__optics || {};
    return { morph: o.meltP ?? -1, a: o.formA ?? 0, b: o.formB ?? 0, flow: 1 };
  });
}

// Measure the seven actual reading stops; unrelated chapters need no scan.
const centers = await page.locator("#services .pillar").evaluateAll((els) =>
  els.map((el) => { const r = el.getBoundingClientRect(); return r.top + scrollY + r.height / 2 - innerHeight / 2; }));
if (centers.length !== 7) throw new Error(`Expected seven Services forms, found ${centers.length}`);
const bands = centers.slice(0, -1).map((lo, i) => ({a: i + 1, b: i + 2, lo, hi: centers[i + 1]}));
console.log(bands.map((b) => `${KEYS[b.a]}→${KEYS[b.b]} [${b.lo}..${b.hi}]`).join("\n"));

/** Binary-search scrollY for the p we want inside one band. */
async function seek(band, want) {
  let lo = band.lo;
  let hi = band.hi;
  let best = null;
  let mid = Math.round(lo + (hi - lo) * (0.12 + 0.76 * want));
  for (let it = 0; it < 16; it++) {
    const r = await probe(mid);
    const m = r.a === band.a && r.b === band.b ? r.morph : r.a > band.a ? 1 : -1;
    if (!best || Math.abs(m - want) < Math.abs(best.m - want)) best = { y: mid, m, ...r };
    if (m < want) lo = mid;
    else hi = mid;
    if (Math.abs(m - want) < 0.01) break;
    mid = Math.round((lo + hi) / 2);
  }
  if (!best || Math.abs(best.m - want) >= 0.012) throw new Error(`Missed ${band.a}->${band.b} at ${want}`);
  await probe(best.y);
  return best;
}

// ── 2. shoot each band at the requested progresses ────────────────────────────
const rows = [];
for (const band of bands) {
  const cells = [];
  for (const want of TARGETS) {
    const hit = await seek(band, want);
    await page.waitForTimeout(260); // shoot at REST, never mid-settle
    const buf = await page.screenshot();
    const name = `${KEYS[band.a]}-${KEYS[band.b]}-m${want}.png`;
    fs.writeFileSync(path.join(OUT, name), buf);
    cells.push({ want, got: hit.m, flow: hit.flow, b64: buf.toString("base64") });
    console.log(
      `${KEYS[band.a]}→${KEYS[band.b]}  want ${want}  got ${hit.m.toFixed(3)}  flow=${hit.flow}`,
    );
  }
  rows.push({ band, cells });
}

// ── 3. contact sheet ──────────────────────────────────────────────────────────
const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:14px;width:max-content">
   <div style="display:grid;grid-template-columns:150px repeat(${TARGETS.length},190px);gap:8px;align-items:center">
     <div></div>${TARGETS.map((m) => `<div style="font:12px ui-monospace,monospace;color:#00e3fe;text-align:center">m=${m}</div>`).join("")}
     ${rows
       .map(
         ({ band, cells }) => `
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${KEYS[band.a]}→${KEYS[band.b]}</div>
       ${cells
         .map(
           (c) =>
             `<div><img src="data:image/png;base64,${c.b64}" style="width:190px;border:1px solid #13313a;border-radius:4px"/>
              <div style="font:10px ui-monospace,monospace;color:#5a8f9b;text-align:center">m=${c.got.toFixed(3)} flow=${c.flow}</div></div>`,
         )
         .join("")}`,
       )
       .join("")}
   </div></body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "sheet.png") });
await sheet.close();

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
console.log(`sheet → ${path.join(OUT, "sheet.png")}`);
await browser.close();
