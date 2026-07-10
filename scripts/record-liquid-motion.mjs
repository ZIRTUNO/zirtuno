// Continuous liquid-motion recorder.
//
// Records the real rendered page while wheel input drives Lenis, and captures
// the exact iBalls buffer uploaded to WebGL on every draw. The paired video +
// trace makes cadence defects distinguishable from per-droplet trajectory
// defects. Dev server must be running:
//   node scripts/record-liquid-motion.mjs
//
// Outputs captures/motion-recordings/{full,full-nogov,legacy-nogov}.{webm,json}

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures", "motion-recordings");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const WIDTH = Number(process.env.WIDTH || 1280);
const HEIGHT = Number(process.env.HEIGHT || 720);
const WHEEL_DELTA = Number(process.env.WHEEL_DELTA || 60);
const WHEEL_MS = Number(process.env.WHEEL_MS || 80);

const REQUESTED = new Set(
  (process.env.RUNS || "full,full-nogov,legacy-nogov").split(",").filter(Boolean),
);
const CASES = [
  { id: "full", query: "ftier=full" },
  { id: "full-nogov", query: "ftier=full&fgov=0" },
  { id: "legacy-nogov", query: "ftier=full&fgov=0&fphys=0" },
].filter((run) => REQUESTED.has(run.id));

fs.mkdirSync(OUT, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});

for (const run of CASES) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
  });

  await context.addInitScript(() => {
    const motion = {
      active: false,
      frames: [],
      pending: null,
      startT: 0,
      endT: 0,
    };
    window.__liquidMotion = motion;

    const names = new WeakMap();
    const getUniformLocation = WebGL2RenderingContext.prototype.getUniformLocation;
    const uniform3fv = WebGL2RenderingContext.prototype.uniform3fv;
    const uniform1i = WebGL2RenderingContext.prototype.uniform1i;

    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };

    WebGL2RenderingContext.prototype.uniform3fv = function (location, value, ...rest) {
      if (
        motion.active &&
        names.get(location) === "iBalls" &&
        value &&
        value.length >= 48 * 3 &&
        motion.frames.length < 12_000
      ) {
        const scenes = window.__scenes;
        const frame = {
          t: performance.now(),
          y: window.scrollY,
          count: -1,
          balls: Array.from(value.slice(0, 48 * 3)),
          site: scenes?.site
            ? [
                scenes.site.heroPhase,
                scenes.site.fracture,
                scenes.site.travel,
                scenes.site.converge,
                scenes.site.grow,
                scenes.site.svcPos,
                scenes.site.pairA,
                scenes.site.pairB,
                scenes.site.pairM,
                scenes.site.exit,
                scenes.site.on,
              ]
            : null,
          method: scenes?.method
            ? [scenes.method.u, scenes.method.ex, scenes.method.on, scenes.method.rIn]
            : null,
          origin: scenes?.origin ? [scenes.origin.p, scenes.origin.on] : null,
        };
        motion.frames.push(frame);
        motion.pending = frame;
      }
      return uniform3fv.call(this, location, value, ...rest);
    };

    WebGL2RenderingContext.prototype.uniform1i = function (location, value) {
      if (motion.active && names.get(location) === "iBallCount" && motion.pending) {
        motion.pending.count = value;
        motion.pending = null;
      }
      return uniform1i.call(this, location, value);
    };
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${BASE}/${LOCALE}?${run.query}`, { waitUntil: "load" });
  await page.waitForSelector(".journey-canvas canvas", { timeout: 30_000 });
  await page.waitForTimeout(1_200);

  const bounds = await page.evaluate(() => {
    const boundsOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        height: rect.height,
      };
    };
    return {
      problem: boundsOf("#problem"),
      ecosystem: boundsOf("#ecosystem"),
      services: boundsOf("#services"),
      method: boundsOf("#method"),
      work: boundsOf("#work"),
      origin: boundsOf("#name"),
      studio: boundsOf("#studio"),
      contact: boundsOf("#contact"),
      scrollHeight: document.documentElement.scrollHeight,
      viewport: [window.innerWidth, window.innerHeight],
    };
  });

  const startY = Math.max(0, Math.round((bounds.problem?.top ?? 0) - HEIGHT * 0.15));
  const endY = Math.min(
    bounds.scrollHeight - HEIGHT,
    Math.round((bounds.studio?.bottom ?? bounds.scrollHeight) + HEIGHT * 0.15),
  );

  await page.evaluate((y) => window.scrollTo(0, y), startY);
  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    window.__liquidMotion.frames.length = 0;
    window.__liquidMotion.startT = performance.now();
    window.__liquidMotion.active = true;
  });

  let y = startY;
  let steps = 0;
  while (y < endY - 2 && steps < 1_000) {
    await page.mouse.wheel(0, WHEEL_DELTA);
    await page.waitForTimeout(WHEEL_MS);
    steps++;
    if (steps % 5 === 0) y = await page.evaluate(() => window.scrollY);
  }
  await page.waitForTimeout(1_400);

  const trace = await page.evaluate(() => {
    window.__liquidMotion.active = false;
    window.__liquidMotion.endT = performance.now();
    return {
      startT: window.__liquidMotion.startT,
      endT: window.__liquidMotion.endT,
      frames: window.__liquidMotion.frames,
    };
  });

  const video = page.video();
  await page.close();
  if (video) {
    const source = await video.path();
    const target = path.join(OUT, `${run.id}.webm`);
    fs.rmSync(target, { force: true });
    fs.renameSync(source, target);
  }
  await context.close();

  fs.writeFileSync(
    path.join(OUT, `${run.id}.json`),
    JSON.stringify({ run, bounds, startY, endY, steps, errors, ...trace }),
  );
  console.log(
    `${run.id}: ${trace.frames.length} draws, ${steps} wheel steps, ` +
      `${Math.round(trace.endT - trace.startT)} ms, ${errors.length} errors`,
  );
}

await browser.close();
console.log(`motion recordings → ${path.relative(ROOT, OUT)}`);
