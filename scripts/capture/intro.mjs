// S1.10 entry-intro CONTACT SHEET — deterministic stills of the opening
// sequence, for owner review (AGENTS.md §10).
//
//   BASE_URL=http://localhost:3051 node scripts/capture/intro.mjs [locale]
//
// Uses the `?zintro=hold` clock: the timeline is built paused and the liquid
// runs off the PLAYHEAD instead of the wall, so every frame here is a pure
// function of its timestamp. Reruns are byte-comparable; a wall-clock capture
// of the same beats is not.
//
// Writes captures/intro/frame-*.png and captures/intro/sheet.png.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const BASE = process.env.BASE_URL || "http://localhost:3051";
const LOCALE = process.argv[2] || "en";
const OUT = "captures/intro";
const W = Number(process.env.VW) || 1440;
const H = Number(process.env.VH) || 900;

/** The beats worth looking at, and what each one is supposed to prove. */
const BEATS = [
  [0.0, "00-black", "black — one droplet, off stage"],
  [0.42, "01-approach", "the droplet crosses"],
  [0.6, "02-impact", "it strikes the contour; the ring opens"],
  [0.95, "03-heads", "two heads, opposite directions"],
  [1.35, "04-trace", "the line is finding the form"],
  [1.78, "05-closing", "the heads close on the far terminal"],
  [1.92, "06-meet", "they meet — the flood starts"],
  [2.16, "07-flood", "the silhouette fills from the meeting point"],
  [2.42, "08-dot", "the mark's own dot lands and rings the surface"],
  [2.62, "09-alive", "droplets, and the surface breathing"],
  [2.95, "10-drain", "the sheet starts to leave"],
  [3.25, "11-handoff", "the hero is already running underneath"],
];

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("  page error:", m.text());
});

await page.goto(`${BASE}/${LOCALE}?zintro=hold`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__zintro, { timeout: 60000 });
// let the hero underneath reach a steady state, so the handoff frames show the
// page the visitor actually lands on rather than a half-compiled one
await page.waitForTimeout(Number(process.env.SETTLE) || 4000);

const shots = [];
for (const [t, name, note] of BEATS) {
  await page.evaluate((tt) => window.__zintro.seek(tt), t);
  await page.waitForTimeout(60); // let the browser paint the seeked state
  const file = path.join(OUT, `frame-${name}.png`);
  await page.screenshot({ path: file });
  shots.push({ file, name, note, t });
  console.log(`  ${String(t).padEnd(5)}s  ${name.padEnd(12)} ${note}`);
}

await browser.close();

// ── contact sheet: 4 x 3, downscaled ────────────────────────────────────────
const COLS = 4;
const ROWS = Math.ceil(shots.length / COLS);
const TW = Math.round(W / 3);
const TH = Math.round(H / 3);
const sheet = new PNG({ width: TW * COLS, height: TH * ROWS });
sheet.data.fill(0);

shots.forEach((shot, i) => {
  const src = PNG.sync.read(fs.readFileSync(shot.file));
  const ox = (i % COLS) * TW;
  const oy = Math.floor(i / COLS) * TH;
  // BOX AVERAGE, not point sampling. A 2 px cyan hairline on black survives a
  // 3x reduction as a dim line; nearest-neighbour deletes it outright, and the
  // whole sequence is hairlines — the first sheet came back looking blank.
  const kx = src.width / TW;
  const ky = src.height / TH;
  for (let y = 0; y < TH; y++) {
    const y0 = Math.floor(y * ky);
    const y1 = Math.min(src.height, Math.ceil((y + 1) * ky));
    for (let x = 0; x < TW; x++) {
      const x0 = Math.floor(x * kx);
      const x1 = Math.min(src.width, Math.ceil((x + 1) * kx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * src.width + sx) * 4;
          r += src.data[s];
          g += src.data[s + 1];
          b += src.data[s + 2];
          n++;
        }
      const d = ((oy + y) * sheet.width + ox + x) * 4;
      sheet.data[d] = r / n;
      sheet.data[d + 1] = g / n;
      sheet.data[d + 2] = b / n;
      sheet.data[d + 3] = 255;
    }
  }
  // a cyan tick in the corner of each cell — reading order at a glance
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4 + i * 3; x++) {
      const d = ((oy + y) * sheet.width + ox + x) * 4;
      sheet.data[d] = 0;
      sheet.data[d + 1] = 227;
      sheet.data[d + 2] = 254;
    }
});

fs.writeFileSync(path.join(OUT, "sheet.png"), PNG.sync.write(sheet));
console.log(`\nsheet → ${OUT}/sheet.png  (${sheet.width}x${sheet.height})`);
