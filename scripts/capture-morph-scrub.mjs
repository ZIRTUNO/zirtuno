/**
 * THE MORPH, as it actually ships — captured off the Services scrub.
 *
 * The retired homepage form harness is quarantined in `Dead Code`; the ONE
 * morph on the live page is the Services scrub, which is scroll-driven and
 * therefore deterministic and still: scroll to a position, let it settle, shoot.
 *
 * Targeting is closed-loop rather than computed. window.__optics now reports
 * the morph exactly as uploaded (morph = the shader's p, morphA/morphB = the
 * pair, flow = 1 once the solved correspondence is in play rather than the zero
 * fallback), so this binary-searches scrollY for each requested p instead of
 * guessing at viewport offsets that change with every layout edit.
 *
 * Run with the dev server up:
 *   BASE=http://localhost:3411 node scripts/capture-morph-scrub.mjs
 * Writes captures/morph-scrub/<pair>-m<p>.png and a contact sheet.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "captures", "morph-scrub");
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
// Deliberately small: headless Chrome rasterises this shader in software, and
// the FPS watchdog demotes the tier when it starves — a demoted tier is not the
// code under test.
const ctx = await browser.newContext({
  viewport: { width: 760, height: 640 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`CONSOLE: ${m.text()}`));

await page.goto(`${BASE}/${LOCALE}?ftier=full`, { waitUntil: "networkidle" });
await page.waitForSelector("canvas", { timeout: 25000 });
await page.waitForTimeout(3000); // SDFs, then the flow solves

/** Scroll there and let the damped scrub settle, then read what was uploaded. */
async function probe(y) {
  await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
  await page.waitForTimeout(420); // mState is damped; let it land
  return page.evaluate(() => {
    const o = window.__optics || {};
    return { morph: o.meltP ?? -1, a: o.formA ?? 0, b: o.formB ?? 0, flow: 1 };
  });
}

const docH = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

// ── 1. find every scroll band where a morph is running ────────────────────────
const STEP = 120;
const scan = [];
for (let y = 0; y <= docH; y += STEP) {
  const r = await probe(y);
  scan.push({ y, ...r });
}
const live = scan.filter((s) => s.morph >= 0 && s.a !== s.b);
console.log(`scanned ${scan.length} positions; ${live.length} in a morph`);
if (!live.length) {
  console.log("no morph found — is the Services chapter reachable?");
  console.log(scan.map((s) => `${s.y}:${s.morph.toFixed(2)} ${s.a}->${s.b}`).join("  "));
  await browser.close();
  process.exit(1);
}

// group the scan into contiguous pairs
const bands = [];
for (const s of live) {
  const last = bands[bands.length - 1];
  if (last && last.a === s.a && last.b === s.b && s.y - last.hi <= STEP * 2) last.hi = s.y;
  else bands.push({ a: s.a, b: s.b, lo: s.y, hi: s.y });
}
console.log(bands.map((b) => `${KEYS[b.a]}→${KEYS[b.b]} [${b.lo}..${b.hi}]`).join("\n"));

/** Binary-search scrollY for the p we want inside one band. */
async function seek(band, want) {
  let lo = Math.max(0, band.lo - STEP);
  let hi = Math.min(docH, band.hi + STEP);
  let best = null;
  for (let it = 0; it < 16; it++) {
    const mid = Math.round((lo + hi) / 2);
    const r = await probe(mid);
    const m = r.a === band.a && r.b === band.b ? r.morph : r.y > mid ? 1 : -1;
    if (!best || Math.abs(m - want) < Math.abs(best.m - want)) best = { y: mid, m, ...r };
    if (m < want) lo = mid;
    else hi = mid;
    if (Math.abs(m - want) < 0.01) break;
  }
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
