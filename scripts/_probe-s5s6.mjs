// S5 → S6 boundary probe. Scrubs from the last Services pillar through
// Método's first phase and records, per stop: both scenes' raw channels, the
// GL form uniforms (offset, scale, weights, erosion) and the ball buffer's
// centroid/area. The question it answers: does the material LEAVE the frame
// downward, and is there a band where the stage is carrying nothing?
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const STEP = Number(process.env.STEP ?? 80);

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(() => {
  const names = new WeakMap();
  const tap = { u: {}, balls: null, count: 0, dens: null };
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
await page.waitForFunction(() => !!window.__scenes, { timeout: 60000 });
await page.waitForTimeout(2500);

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
  const abs = (r) => (r ? { top: Math.round(r.top + y), bottom: Math.round(r.bottom + y), h: Math.round(r.height) } : null);
  return {
    services: abs(q("#services")),
    lastPillar: (() => {
      const ps = document.querySelectorAll("#services .pillar");
      return ps.length ? abs(ps[ps.length - 1].getBoundingClientRect()) : null;
    })(),
    method: abs(q("#method")),
    journey: abs(q("#method .method-journey")),
    phase0: (() => {
      const p = document.querySelector("#method .method-phase");
      return p ? abs(p.getBoundingClientRect()) : null;
    })(),
    vh: window.innerHeight,
  };
});
console.log("GEOM", JSON.stringify(geom));

// exit opens where journey.top = 1.45vh, method rIn completes at 0.80vh.
// Walk a full viewport either side of that window.
const from = Math.round(geom.journey.top - geom.vh * 2.1);
const to = Math.round(geom.journey.top - geom.vh * 0.2);
const rows = [];
for (let y = from; y <= to; y += STEP) {
  await scrollTo(y);
  await page.waitForTimeout(380);
  const r = await page.evaluate(() => {
    const t = window.__tap;
    const s = window.__scenes ?? {};
    const st = window.__cine?.stats ?? {};
    let cx = 0, cy = 0, area = 0, ymin = 9, ymax = -9;
    if (t.balls) {
      for (let i = 0; i < t.count; i++) {
        const rr = t.balls[i * 3 + 2];
        const d = t.dens ? t.dens[i] : 1;
        const w = rr * rr * d;
        const by = t.balls[i * 3 + 1];
        cx += t.balls[i * 3] * w; cy += by * w; area += w;
        if (w > 1e-6) { if (by < ymin) ymin = by; if (by > ymax) ymax = by; }
      }
      if (area > 0) { cx /= area; cy /= area; }
    }
    const site = s.site ?? {}, me = s.method ?? {};
    return {
      y: Math.round(window.scrollY),
      jTop: Math.round(document.querySelector("#method .method-journey")?.getBoundingClientRect().top ?? 0),
      exit: +(site.exit ?? 0).toFixed(4),
      svcOn: +(site.on ?? 0).toFixed(4),
      pair: `${site.pairA}-${site.pairB}@${(site.pairM ?? 0).toFixed(2)}`,
      mOn: +(me.on ?? 0).toFixed(4), rIn: +(me.rIn ?? 0).toFixed(4), mu: +(me.u ?? 0).toFixed(3),
      holder: st.holderId ?? null,
      fA: +(t.u.iFormA ?? 0).toFixed(3), fB: +(t.u.iFormB ?? 0).toFixed(3),
      eA: +(t.u.iEroA ?? 0).toFixed(3),
      ox: t.u.iFormOff ? +t.u.iFormOff[1].toFixed(4) : null,
      oxx: t.u.iFormOff ? +t.u.iFormOff[0].toFixed(4) : null,
      sc: +(t.u.iFormScale ?? 0).toFixed(4),
      balls: t.count, area: +area.toFixed(5),
      bcx: +cx.toFixed(4), bcy: +cy.toFixed(4),
      bymax: +ymax.toFixed(3),
    };
  });
  rows.push(r);
  console.log(
    `y=${String(r.y).padStart(6)} jTop=${String(r.jTop).padStart(6)} exit=${r.exit} rIn=${r.rIn} mu=${r.mu}` +
    ` holder=${String(r.holder).padStart(6)} fA=${r.fA} eA=${r.eA} foff=(${r.oxx},${r.ox}) sc=${r.sc}` +
    ` balls=${String(r.balls).padStart(3)} area=${r.area} bc=(${r.bcx},${r.bcy}) ymax=${r.bymax}`,
  );
}
fs.writeFileSync(process.env.OUT ?? "probe-s5s6.json", JSON.stringify({ geom, rows }, null, 1));
await browser.close();
