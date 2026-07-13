// verify-context-loss (R5-E) — the §12.5 drill: a GPU context loss must never
// crash the page, strand navigation, or come back at the wrong scene state.
//
// The drill runs MID-PAGE (the método band) on purpose: scene state lives in
// the conductor (JS), not in GL, so a restore must resume the current
// measured choreography — not the top of the page, not a ramp-in.
//
//   1. scroll to método, confirm the liquid is drawing
//   2. WEBGL_lose_context.loseContext() → no page errors, copy still
//      readable, draws stop (the loop parks — no zombie GL calls)
//   3. restoreContext() → the stage rebuilds (fresh context, textures,
//      post chain), draws advance again, still exactly ONE liquid canvas,
//      same scroll position, same scene grip, liquid visibly moving
//
// Dev server must be running:  node scripts/verify-context-loss.mjs

import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(`${BASE}/en?ftier=full&fgov=0`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector(".journey-canvas canvas"), {
  timeout: 40000,
});
await page.waitForTimeout(4500);

// park mid-page: the método rehearsal owns the liquid here
const y = await page.evaluate(() => {
  const el = document.querySelector("#method .method-journey");
  const r = el.getBoundingClientRect();
  return Math.round(r.top + window.scrollY + r.height * 0.4 - innerHeight * 0.5);
});
await page.evaluate((yy) => window.scrollTo(0, yy), y);
await page.waitForTimeout(1500);

const framesAt = () => page.evaluate(() => window.__optics?.frames ?? -1);
const stateAt = () =>
  page.evaluate(() => ({
    y: window.scrollY,
    methodOn: window.__scenes?.method?.on ?? -1,
    canvases: document.querySelectorAll(".journey-canvas canvas").length,
    h1: !!document.querySelector("h1"),
  }));

const f0 = await framesAt();
await page.waitForTimeout(800);
const f1 = await framesAt();
check(f1 > f0, "liquid drawing before the drill", `frames ${f0} → ${f1}`);
const before = await stateAt();
check(before.methodOn > 0.5, "método grips the liquid before the drill", `on=${before.methodOn.toFixed(2)}`);

// ── the loss ──────────────────────────────────────────────────────────────────
await page.evaluate(() => {
  const canvas = document.querySelector(".journey-canvas canvas");
  const gl = canvas.getContext("webgl2");
  window.__ext = gl.getExtension("WEBGL_lose_context");
  window.__ext.loseContext();
});
await page.waitForTimeout(900);
const lost = await stateAt();
check(errors.length === 0, "no page/console errors on loss", errors[0]);
check(lost.h1, "copy remains readable during the loss");
check(lost.canvases >= 1, "canvas element survives (no unmount thrash)");
const fl0 = await framesAt();
await page.waitForTimeout(800);
const fl1 = await framesAt();
check(fl1 === fl0, "draw loop parks during the loss (no zombie GL)", `frames ${fl0} → ${fl1}`);

// ── the restore ───────────────────────────────────────────────────────────────
await page.evaluate(() => window.__ext.restoreContext());
await page.waitForTimeout(3500); // rebuild: context, program, SDF textures, post

const after = await stateAt();
check(after.canvases === 1, "exactly ONE liquid canvas after restore", `${after.canvases}`);
check(after.y === before.y, "scroll position resumed, not reset", `${before.y} → ${after.y}`);
check(
  Math.abs(after.methodOn - before.methodOn) < 0.05,
  "the same scene grips after restore (state resumed mid-page)",
  `on ${before.methodOn.toFixed(2)} → ${after.methodOn.toFixed(2)}`,
);
const fr0 = await framesAt();
await page.waitForTimeout(1000);
const fr1 = await framesAt();
check(fr1 > fr0, "draws advance again after restore", `frames ${fr0} → ${fr1}`);
const optics = await page.evaluate(() => ({
  post: window.__optics?.post,
  fmt: window.__optics?.fmt,
}));
check(optics.post === 1, "post chain rebuilt on the fresh context", JSON.stringify(optics));

// visible motion: two lossless captures — the liquid is truly back on screen
const s1 = await page.screenshot({ type: "png" });
await page.waitForTimeout(1200);
const s2 = await page.screenshot({ type: "png" });
const p1 = PNG.sync.read(s1);
const p2 = PNG.sync.read(s2);
let delta = 0;
for (let i = 0; i < p1.data.length; i += 16) delta += Math.abs(p1.data[i] - p2.data[i]);
check(delta > 500, "liquid visibly moving after restore", `delta=${delta}`);
check(errors.length === 0, "zero errors across the whole drill", errors[0]);

await browser.close();
console.log(failures === 0 ? "CONTEXT LOSS: drill green" : `CONTEXT LOSS FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
