// Transition diagnostics — replicates the owner's evidence format (the
// artifacts/transition-diagnostics-* capture): a small in-app-browser-class
// viewport (798×698 @ dpr 1.25), dense scroll-stepped frames across the three
// critical ranges, plus filmstrip sheets and an all-frames overview per range.
// Ranges are anchored to the live sections (the page's scroll length changes
// as the design evolves; absolute offsets would drift). Dev server must run:
//   node scripts/capture-transition-diagnostics.mjs
// Writes captures/diagnostics-after/<range>/{frames,filmstrips,overview}.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures", "diagnostics-after");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
fs.mkdirSync(OUT, { recursive: true });

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
const ctx = await browser.newContext({
  viewport: { width: 798, height: 698 },
  deviceScaleFactor: 1.25,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

await page.goto(`${BASE}/${LOCALE}?ftier=full`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 30000 });
await page.waitForTimeout(1500);

// section-anchored scroll ranges (measured live)
const anchors = await page.evaluate(() => {
  const top = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return el.getBoundingClientRect().top + window.scrollY;
  };
  const runway = document.querySelector("[data-organism]");
  const runwayTop = runway
    ? runway.getBoundingClientRect().top + window.scrollY
    : null;
  const runwayH = runway ? runway.getBoundingClientRect().height : 0;
  const pillars = [...document.querySelectorAll("#services .pillar")].map(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );
  const origin = document.querySelector("#name .origin-journey");
  const originTop = origin
    ? origin.getBoundingClientRect().top + window.scrollY
    : null;
  const originH = origin ? origin.getBoundingClientRect().height : 0;
  const method = document.querySelector("#method .method-journey");
  const methodTop = method
    ? method.getBoundingClientRect().top + window.scrollY
    : null;
  const methodH = method ? method.getBoundingClientRect().height : 0;
  return {
    problem: top("#problem"),
    ecosystem: top("#ecosystem"),
    services: top("#services"),
    runwayTop,
    runwayH,
    pillars,
    originTop,
    originH,
    methodTop,
    methodH,
    vh: window.innerHeight,
  };
});

const RANGES = [
  {
    // the POUR: hero rest → the mark granulates → droplets stream into the
    // Problem's clusters (one droplet identity — the site-fluid seam)
    id: "hero-to-problem",
    start: 0,
    end: anchors.problem + anchors.vh * 1.2,
    frames: 29,
  },
  {
    id: "problem-to-ecosystem",
    start: anchors.problem - 60,
    end: anchors.runwayTop + anchors.runwayH * 0.35,
    frames: 31,
  },
  {
    id: "ecosystem-convergence",
    start: anchors.runwayTop - anchors.vh * 0.8,
    end: anchors.runwayTop + anchors.runwayH + anchors.vh * 0.4,
    frames: 29,
  },
  {
    id: "services-fluidity",
    start: anchors.services - anchors.vh * 0.5,
    end: (anchors.pillars[3] ?? anchors.services + 3000) + anchors.vh * 0.4,
    frames: 36,
  },
  {
    // S6's five phase states: fragmented cloud + probe → lattice → three
    // masses → the mark ("one organism") → growth + satellites
    id: "method-phases",
    start: (anchors.methodTop ?? 0) - anchors.vh * 0.3,
    end: (anchors.methodTop ?? 0) + (anchors.methodH ?? 0),
    frames: 30,
  },
  {
    // S8's five scrubbed beats: two brothers → the mark (+ pillar labels) →
    // the hold → the ecosystem echo → the drain under the particle wordmark
    id: "origin-beats",
    start: (anchors.originTop ?? 0) - anchors.vh * 0.3,
    end: (anchors.originTop ?? 0) + (anchors.originH ?? 0),
    frames: 32,
  },
];

for (const range of RANGES) {
  const dir = path.join(OUT, range.id);
  const framesDir = path.join(dir, "frames");
  const stripsDir = path.join(dir, "filmstrips");
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(stripsDir, { recursive: true });

  const step = (range.end - range.start) / (range.frames - 1);
  const shots = [];
  for (let i = 0; i < range.frames; i++) {
    const y = Math.max(0, Math.round(range.start + step * i));
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    // settle: damped channels + lenis smoothing need a beat per step
    await page.waitForTimeout(650);
    const shot = await page.screenshot({ type: "jpeg", quality: 80 });
    const name = `frame-${String(i).padStart(3, "0")}.jpg`;
    fs.writeFileSync(path.join(framesDir, name), shot);
    shots.push(shot.toString("base64"));
  }
  console.log(`${range.id}: ${range.frames} frames (${Math.round(range.start)} → ${Math.round(range.end)})`);

  // filmstrips (8 frames per sheet, 2-up) + a dense overview grid
  const sheetPage = await ctx.newPage();
  for (let s = 0; s * 8 < shots.length; s++) {
    const cells = shots.slice(s * 8, s * 8 + 8);
    await sheetPage.setContent(
      `<!doctype html><body style="margin:0;background:#0b0d10;padding:8px;width:max-content">
       <div style="display:grid;grid-template-columns:repeat(2,560px);gap:8px">
       ${cells.map((c) => `<img src="data:image/jpeg;base64,${c}" style="width:560px;border:1px solid #16323a"/>`).join("")}
       </div></body>`,
    );
    await sheetPage.waitForTimeout(150);
    await sheetPage
      .locator("body")
      .screenshot({ path: path.join(stripsDir, `sheet-${String(s).padStart(2, "0")}.jpg`), type: "jpeg", quality: 82 });
  }
  await sheetPage.setContent(
    `<!doctype html><body style="margin:0;background:#0b0d10;padding:8px;width:max-content">
     <div style="display:grid;grid-template-columns:repeat(6,220px);gap:6px">
     ${shots.map((c, i) => `<div><img src="data:image/jpeg;base64,${c}" style="width:220px;border:1px solid #16323a"/><div style="font:10px monospace;color:#00e3fe">${i}</div></div>`).join("")}
     </div></body>`,
  );
  await sheetPage.waitForTimeout(200);
  await sheetPage
    .locator("body")
    .screenshot({ path: path.join(dir, "overview-all-frames.jpg"), type: "jpeg", quality: 80 });
  await sheetPage.close();
  console.log(`→ captures/diagnostics-after/${range.id}/`);
}

await browser.close();
console.log("done");
