// MÉTODO runway probe: per stop on the phase-centre clock `u`, dump every
// scene's grip channel (so the conductor's blend weights can be reconstructed),
// método's own envelopes, and the ball buffer's area/centroid — the question
// being "what is actually on the stage while each phase is the subject?".
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3081";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const STOPS = (process.env.STOPS ?? "2,2.5,3,3.25,3.5,3.75,4,4.3,4.6")
  .split(",")
  .map(Number);

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(() => {
  const names = new WeakMap();
  const tap = { balls: null, count: 0 };
  window.__tap = tap;
  const gul = WebGL2RenderingContext.prototype.getUniformLocation;
  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const l = gul.call(this, p, n);
    if (l) names.set(l, n);
    return l;
  };
  const u3fv = WebGL2RenderingContext.prototype.uniform3fv;
  WebGL2RenderingContext.prototype.uniform3fv = function (l, v) {
    if (l && names.get(l) === "iBalls") tap.balls = Array.from(v);
    return u3fv.call(this, l, v);
  };
  const u1i = WebGL2RenderingContext.prototype.uniform1i;
  WebGL2RenderingContext.prototype.uniform1i = function (l, v) {
    if (l && names.get(l) === "iBallCount") tap.count = v;
    return u1i.call(this, l, v);
  };
});
const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 90000 });
await page.waitForTimeout(2500);

const centers = await page.evaluate(() => {
  const y = window.scrollY;
  return [...document.querySelectorAll("#method .method-phase")].map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 + y;
  });
});

const rows = [];
for (const u of STOPS) {
  const k = Math.max(0, Math.min(Math.floor(u), centers.length - 2));
  const cy = centers[k] + (centers[k + 1] - centers[k]) * (u - k);
  const y = Math.round(cy - VH / 2);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 50; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(1200);
  const row = await page.evaluate(() => {
    const s = window.__scenes;
    const grips = {};
    for (const [id, ch] of Object.entries(s))
      if (typeof ch.on === "number") grips[id] = +ch.on.toFixed(3);
    const sum = Object.values(grips).reduce((a, b) => a + b, 0);
    const w = {};
    for (const [id, p] of Object.entries(grips))
      if (p > 0.001) w[id] = +(p / (sum || 1)).toFixed(3);
    const b = window.__tap.balls;
    const n = window.__tap.count;
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      const r = b[i * 3 + 2];
      const a = r * r;
      area += a;
      cx += b[i * 3] * a;
      cy += b[i * 3 + 1] * a;
    }
    const j = document.querySelector("#method .method-journey").getBoundingClientRect();
    const wk = document.querySelector("#work").getBoundingClientRect();
    return {
      w,
      m: {
        u: +s.method.u.toFixed(3),
        rIn: +s.method.rIn.toFixed(3),
        ex: +s.method.ex.toFixed(3),
      },
      balls: n,
      area: +(area * 1e3).toFixed(2),
      cx: area ? +(cx / area).toFixed(3) : 0,
      cy: area ? +(cy / area).toFixed(3) : 0,
      jBottomVh: +(j.bottom / window.innerHeight).toFixed(3),
      workTopVh: +(wk.top / window.innerHeight).toFixed(3),
    };
  });
  rows.push({ u, ...row });
  console.log(
    `u=${u.toFixed(2)}  ex=${row.m.ex.toFixed(2)}  balls=${row.balls}  area=${row.area}  c=(${row.cx},${row.cy})  jB=${row.jBottomVh}vh workT=${row.workTopVh}vh  W=${JSON.stringify(row.w)}`,
  );
}
fs.writeFileSync(
  process.env.JSON ?? "captures/method-probe.json",
  JSON.stringify(rows, null, 2),
);
await browser.close();
