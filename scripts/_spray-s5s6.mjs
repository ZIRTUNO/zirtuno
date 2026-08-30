// S5 → S6 SPRAY census. Wheel-scrolls the boundary at a realistic cadence and
// counts, per frame, the balls that are pinch-off satellites rather than the
// 48 droplets. Discriminator: packSatellites drives DENSITY on a lifetime
// envelope that peaks below 0.85, while every droplet in this passage is at
// density 1 once the release has finished — so past the release, any ball
// under 0.9 density is spray. Satellites are also radius-clamped to <= 0.011.
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3091";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(() => {
  const names = new WeakMap();
  const tap = { on: false, frames: [], pending: null };
  window.__spray = tap;
  const gul = WebGL2RenderingContext.prototype.getUniformLocation;
  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const l = gul.call(this, p, n);
    if (l) names.set(l, n);
    return l;
  };
  const u3fv = WebGL2RenderingContext.prototype.uniform3fv;
  WebGL2RenderingContext.prototype.uniform3fv = function (l, v, ...r) {
    if (tap.on && names.get(l) === "iBalls") {
      tap.pending = { balls: Array.from(v), dens: tap.lastDens ?? null, count: -1,
        exit: window.__scenes?.site?.exit ?? 0,
        jTop: (document.querySelector("#method .method-journey")?.getBoundingClientRect().top ?? 1e6) / window.innerHeight };
      tap.frames.push(tap.pending);
    }
    return u3fv.call(this, l, v, ...r);
  };
  const u1fv = WebGL2RenderingContext.prototype.uniform1fv;
  WebGL2RenderingContext.prototype.uniform1fv = function (l, v, ...r) {
    if (names.get(l) === "iBallDensity") {
      tap.lastDens = Array.from(v);
      if (tap.pending) tap.pending.dens = tap.lastDens;
    }
    return u1fv.call(this, l, v, ...r);
  };
  const u1i = WebGL2RenderingContext.prototype.uniform1i;
  WebGL2RenderingContext.prototype.uniform1i = function (l, v, ...r) {
    if (tap.on && names.get(l) === "iBallCount" && tap.pending) {
      tap.pending.count = v;
      tap.pending = null;
    }
    return u1i.call(this, l, v, ...r);
  };
});

const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 60000 });
await page.waitForTimeout(2500);

const g = await page.evaluate(() => ({
  jTop: Math.round(document.querySelector("#method .method-journey").getBoundingClientRect().top + window.scrollY),
  vh: window.innerHeight,
}));
// park a viewport before the exit opens, then WHEEL through the whole handoff
const start = g.jTop - Math.round(1.75 * g.vh);
await page.evaluate(async (t) => {
  for (let i = 0; i < 60; i++) {
    window.scrollTo(0, t);
    await new Promise((r) => setTimeout(r, 50));
    if (Math.abs(window.scrollY - t) < 3) break;
  }
}, start);
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__spray.on = true; });

// ~1.5vh of handoff at a normal reading flick: 110px per tick, 16 ticks/s
for (let i = 0; i < 130; i++) {
  await page.mouse.wheel(0, 110);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(600);

const frames = await page.evaluate(() => { window.__spray.on = false; return window.__spray.frames; });
await browser.close();

let spraySum = 0, sprayMax = 0, framesWithSpray = 0, scored = 0;
let worst = null;
for (const f of frames) {
  if (f.count < 0 || !f.dens) continue;
  // past the release, every real droplet sits at density 1
  if (!(f.exit > 0.5 && f.exit < 1.0)) continue;
  scored++;
  let n = 0;
  for (let i = 0; i < f.count; i++) {
    const r = f.balls[i * 3 + 2];
    if (f.dens[i] < 0.9 && r <= 0.0115) n++;
  }
  spraySum += n;
  if (n > sprayMax) { sprayMax = n; worst = f; }
  if (n > 0) framesWithSpray++;
}
console.log(`frames captured        ${frames.length}`);
console.log(`frames in the crossing ${scored}   (site exit 0.5 -> 1.0)`);
console.log(`frames carrying spray  ${framesWithSpray}  (${scored ? ((100 * framesWithSpray) / scored).toFixed(1) : 0}%)`);
console.log(`satellites: mean ${scored ? (spraySum / scored).toFixed(2) : 0} · peak ${sprayMax}`);
if (worst) console.log(`peak at exit=${worst.exit.toFixed(3)} jTop=${worst.jTop.toFixed(2)}vh balls=${worst.count}`);
