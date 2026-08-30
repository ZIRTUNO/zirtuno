// S3 → S4 pacing probe. Scrubs scroll from the end of the eco runway to the
// second services pillar and records, per stop: the site scene's raw channels,
// the GL form uniforms (offset, scale, weights, warp, erosion) and the ball
// buffer's centroid/area. The question it answers: across how many px of
// scroll does NOTHING change except the mark's screen position?
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const STEP = Number(process.env.STEP ?? 60);

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(() => {
  const names = new WeakMap();
  const tap = { u: {}, balls: null, count: 0 };
  window.__tap = tap;
  const gul = WebGL2RenderingContext.prototype.getUniformLocation;
  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const l = gul.call(this, p, n);
    if (l) names.set(l, n);
    return l;
  };
  const u1f = WebGL2RenderingContext.prototype.uniform1f;
  WebGL2RenderingContext.prototype.uniform1f = function (l, v) {
    const n = l && names.get(l);
    if (n) tap.u[n] = v;
    return u1f.call(this, l, v);
  };
  const u2f = WebGL2RenderingContext.prototype.uniform2f;
  WebGL2RenderingContext.prototype.uniform2f = function (l, a, b) {
    const n = l && names.get(l);
    if (n) tap.u[n] = [a, b];
    return u2f.call(this, l, a, b);
  };
  const u2fv = WebGL2RenderingContext.prototype.uniform2fv;
  WebGL2RenderingContext.prototype.uniform2fv = function (l, v) {
    const n = l && names.get(l);
    if (n) tap.u[n] = [v[0], v[1]];
    return u2fv.call(this, l, v);
  };
  const u3fv = WebGL2RenderingContext.prototype.uniform3fv;
  WebGL2RenderingContext.prototype.uniform3fv = function (l, v) {
    const n = l && names.get(l);
    if (n === "iBalls") tap.balls = Array.from(v);
    return u3fv.call(this, l, v);
  };
  const u1i = WebGL2RenderingContext.prototype.uniform1i;
  WebGL2RenderingContext.prototype.uniform1i = function (l, v) {
    const n = l && names.get(l);
    if (n === "iBallCount") tap.count = v;
    return u1i.call(this, l, v);
  };
  const u1fv = WebGL2RenderingContext.prototype.uniform1fv;
  WebGL2RenderingContext.prototype.uniform1fv = function (l, v) {
    const n = l && names.get(l);
    if (n === "iBallDensity") tap.dens = Array.from(v);
    return u1fv.call(this, l, v);
  };
});

const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(2000);

const scrollTo = async (target) => {
  await page.evaluate(async (t) => {
    for (let i = 0; i < 40; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, target);
};

const geom = await page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.getBoundingClientRect();
  const y = window.scrollY;
  const abs = (r) => (r ? { top: r.top + y, bottom: r.bottom + y, h: r.height } : null);
  return {
    runway: abs(q("[data-organism]")),
    services: abs(q("#services")),
    pillars: Array.from(document.querySelectorAll("#services .pillar")).map((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top + y, bottom: r.bottom + y, h: r.height };
    }),
    outro: abs(q(".gather-outro")),
    svcIntro: abs(q(".svc-intro")),
    docH: document.documentElement.scrollHeight,
    vh: window.innerHeight,
  };
});
console.log("GEOM", JSON.stringify(geom, null, 1));

const from = Math.round(geom.runway.bottom - geom.vh - geom.vh * 0.6);
const to = Math.round(geom.pillars[1].top);
const rows = [];
for (let y = from; y <= to; y += STEP) {
  await scrollTo(y);
  await page.waitForTimeout(420);
  const r = await page.evaluate(() => {
    const t = window.__tap;
    const l = window.__liquid ?? {};
    let cx = 0, cy = 0, area = 0;
    if (t.balls) {
      for (let i = 0; i < t.count; i++) {
        const rr = t.balls[i * 3 + 2];
        const d = t.dens ? t.dens[i] : 1;
        const w = rr * rr * d;
        cx += t.balls[i * 3] * w; cy += t.balls[i * 3 + 1] * w; area += w;
      }
      if (area > 0) { cx /= area; cy /= area; }
    }
    return {
      y: Math.round(window.scrollY),
      gather: +(l.gather ?? 0).toFixed(4),
      travel: +(l.travel ?? 0).toFixed(4),
      svcPos: +(l.svcPos ?? 0).toFixed(4), cross: +(l.cross ?? 0).toFixed(4),
      pairA: l.pairA, pairB: l.pairB, pairM: +(l.pairM ?? 0).toFixed(4),
      exit: +(l.exit ?? 0).toFixed(4),
      fA: +(t.u.iFormA ?? 0).toFixed(3), fB: +(t.u.iFormB ?? 0).toFixed(3),
      eA: +(t.u.iEroA ?? 0).toFixed(3), eB: +(t.u.iEroB ?? 0).toFixed(3),
      warp: +(t.u.iWarp ?? 0).toFixed(4),
      ox: t.u.iFormOff ? +t.u.iFormOff[0].toFixed(4) : null,
      oy: t.u.iFormOff ? +t.u.iFormOff[1].toFixed(4) : null,
      sc: +(t.u.iFormScale ?? 0).toFixed(4),
      balls: t.count, area: +area.toFixed(5),
      bcx: +cx.toFixed(4), bcy: +cy.toFixed(4),
    };
  });
  rows.push(r);
  console.log(
    `y=${String(r.y).padStart(6)} g=${r.gather} sp=${r.svcPos} cx=${r.cross} pair=${r.pairA}-${r.pairB}@${r.pairM}` +
    ` fA=${r.fA} fB=${r.fB} eA=${r.eA} eB=${r.eB} warp=${r.warp} off=(${r.ox},${r.oy}) sc=${r.sc}` +
    ` balls=${r.balls} area=${r.area}`,
  );
}
fs.writeFileSync(process.env.OUT ?? "probe-s3s4.json", JSON.stringify({ geom, rows }, null, 1));
await browser.close();
