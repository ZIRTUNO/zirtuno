// Real-browser gates for the hero's resize/context lifecycle and for invisible
// atmospheric work. Captures use the compositor: WebGL drawing buffers may be
// discarded, so reading them later is not evidence of what was painted.
import fs from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "../support/launch.mjs";

const base = process.env.BASE_URL || "http://localhost:3000";
const out = process.env.OUT || "captures/runtime-lifecycle";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const checks = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, label, detail) => {
  checks.push({ ok, label, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${label} ${JSON.stringify(detail ?? "")}`);
};
await page.addInitScript(() => {
  window.__ribbonDraws = 0;
  window.__ribbonReads = 0;
  window.__surfaceReads = 0;
  const draw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) {
    if (this.canvas.classList.contains("lab-ribbon-canvas")) window.__ribbonDraws++;
    return draw.apply(this, args);
  };
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (this.classList.contains("lab-ribbon")) window.__ribbonReads++;
    if (this.matches(".cp-carrier, .contact-control, .contact-card, .cta-primary")) window.__surfaceReads++;
    return rect.apply(this, args);
  };
});
try {
  await page.goto(`${base}/pt?ftier=lite`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ribbonDraws > 3 && window.__aura);
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => ({ draws: window.__ribbonDraws, reads: window.__ribbonReads, aura: window.__aura.frames }));
  await page.waitForTimeout(1200);
  const next = await page.evaluate(() => ({ draws: window.__ribbonDraws, reads: window.__ribbonReads, aura: window.__aura.frames }));
  check(next.draws > first.draws, "visible ribbon remains animated", { first, next });
  check(next.reads - first.reads <= 1, "settled ribbon performs no per-frame layout reads", next.reads - first.reads);
  check(next.aura === first.aura, "black hero parks invisible atmosphere", next.aura - first.aura);

  await page.evaluate(() => {
    const gl = document.querySelector(".lab-ribbon-canvas").getContext("webgl2");
    window.__ribbonContext = gl.getExtension("WEBGL_lose_context");
    window.__ribbonContext.loseContext();
  });
  await page.waitForFunction(() => document.querySelector(".lab-ribbon").dataset.ribbon === "fallback");
  const lost = await page.evaluate(() => window.__ribbonDraws);
  await page.waitForTimeout(250);
  check(await page.evaluate(() => window.__ribbonDraws) === lost, "lost ribbon stops drawing and exposes fallback");
  await page.evaluate(() => window.__ribbonContext.restoreContext());
  await page.waitForFunction((count) => window.__ribbonDraws > count + 2, lost);
  check(await page.locator(".lab-ribbon").getAttribute("data-ribbon") === "live", "restored ribbon rebuilds and resumes");

  await page.emulateMedia({ reducedMotion: "reduce" });
  // The preference rebuilds several GPU layers and removes the live page
  // stage. Wait for that layout transaction, not a fixed 300ms assumption.
  await page.waitForFunction(() => document.querySelector(".liquid-journey").dataset.liquid === "static");
  await page.waitForTimeout(1200);
  const still = await page.evaluate(() => window.__ribbonDraws);
  await page.waitForTimeout(500);
  const stillNext = await page.evaluate(() => window.__ribbonDraws);
  check(stillNext === still, "reduced motion has no ribbon loop", { still, stillNext });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const resized = await page.evaluate(() => window.__ribbonDraws);
  check(resized > still, "resizing reduced-motion ribbon repaints its cleared canvas");
  const shot = await page.locator(".lab-ribbon").screenshot({ path: `${out}/ribbon-static-resized.png` });
  const png = PNG.sync.read(shot);
  let cyan = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 1] > 30 && png.data[i + 2] > png.data[i] + 20) cyan++;
  check(cyan > 100, "resized static ribbon actually paints cyan", cyan);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1600);
  const below = await page.evaluate(() => ({ bottom: document.querySelector(".lab-ribbon").getBoundingClientRect().bottom, ribbon: window.__ribbonDraws, aura: window.__aura.frames }));
  await page.waitForTimeout(900);
  const belowNext = await page.evaluate(() => ({ ribbon: window.__ribbonDraws, aura: window.__aura.frames }));
  check(below.bottom < -100 && below.ribbon === belowNext.ribbon, "offscreen ribbon stays parked", { below, belowNext });
  check(belowNext.aura > below.aura, "atmosphere animates below the hero", { below, belowNext });

  await page.goto(`${base}/en/contact?ftier=lite`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1800);
  const idleReads = await page.evaluate(() => window.__surfaceReads);
  await page.waitForTimeout(700);
  check(await page.evaluate(() => window.__surfaceReads) === idleReads, "idle form surfaces do not measure pointer geometry");
  await page.locator(".cp-carrier").hover();
  const pointerReads = await page.evaluate(() => window.__surfaceReads);
  await page.mouse.move(600, 400, { steps: 5 });
  await page.waitForTimeout(250);
  check(await page.evaluate(() => window.__surfaceReads) > pointerReads, "moving pointer resumes current surface measurements");
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerleave")));
  await page.waitForTimeout(250);
  const leftReads = await page.evaluate(() => window.__surfaceReads);
  await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__surfaceReads) === leftReads, "pointer leave parks surface measurements again");
  check(errors.length === 0, "no page errors", errors);
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((c) => !c.ok) ? 1 : 0;
