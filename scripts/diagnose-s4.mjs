// S4 MORPH CONTINUITY PROBE
//
// The reported fault — "midway through the morph it jumps to the last form" —
// is DYNAMIC. Scrubbing to a scroll position and letting the page settle hides
// it completely, because every damped channel converges at rest. So this drives
// a continuous scroll and records what the GPU actually received each frame.
//
// TWO THINGS THIS GOT WRONG BEFORE, both worth keeping written down:
//
//  1. Lenis owns scroll (AGENTS.md:220). A per-frame window.scrollTo loop fights
//     it and lands nowhere — the first run moved 62px in 550 frames. The
//     measured pass therefore drives REAL WHEEL EVENTS.
//  2. Droplet POSITION alone is not what you see. Outside a melt the services
//     droplets sit at density 0 (the SDF form carries the picture), so they can
//     teleport freely while invisible. Comparing raw positions reported a 300x
//     "jump" that nothing on screen could show. The metric below reconstructs
//     the density-weighted metaball FIELD and compares that.
//
//   node scripts/diagnose-s4.mjs            # default 90 px/wheel
//   STEP=30 node scripts/diagnose-s4.mjs    # a slow, careful read
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = 1440;
const VH = 900;
const ASPECT = VW / VH;
const STEP = Number(process.env.STEP ?? 90);
const OUT = process.env.OUT ?? "s4-diag";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({
  viewport: { width: VW, height: VH },
  recordVideo: { dir: path.join(OUT, "video"), size: { width: VW, height: VH } },
});

await context.addInitScript(() => {
  const rec = { active: false, frames: [], pending: null, count: 0 };
  window.__s4 = rec;
  const names = new WeakMap();
  const gul = WebGL2RenderingContext.prototype.getUniformLocation;
  const u3 = WebGL2RenderingContext.prototype.uniform3fv;
  const u1v = WebGL2RenderingContext.prototype.uniform1fv;
  const u1i = WebGL2RenderingContext.prototype.uniform1i;
  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const l = gul.call(this, p, n);
    if (l) names.set(l, n);
    return l;
  };
  // THE LIVE BALL COUNT. The conductor CULLS dead droplets and simply does not
  // write them, so every slot past iBallCount holds stale data from an earlier
  // frame. Reading a fixed 48 reported droplets at density 1 sitting on the
  // form during every rest plateau — none of which were ever drawn.
  WebGL2RenderingContext.prototype.uniform1i = function (loc, val, ...rest) {
    if (names.get(loc) === "iBallCount") rec.count = val;
    return u1i.call(this, loc, val, ...rest);
  };
  WebGL2RenderingContext.prototype.uniform3fv = function (loc, val, ...rest) {
    if (rec.active && names.get(loc) === "iBalls" && val) rec.balls = Array.from(val);
    return u3.call(this, loc, val, ...rest);
  };
  // What the FORM channel actually receives. Comparing this against the scene's
  // intended fb (window.__s4form) exposes the texture-readiness gate at
  // FieldStage:391, which pins iFormB to 0 until form B's SDF has streamed in.
  const u1f = WebGL2RenderingContext.prototype.uniform1f;
  WebGL2RenderingContext.prototype.uniform1f = function (loc, val, ...rest) {
    if (rec.active) {
      const n = names.get(loc);
      if (n === "iFormA" || n === "iFormB" || n === "iEroA" || n === "iEroB")
        rec[n] = val;
    }
    return u1f.call(this, loc, val, ...rest);
  };
  // iBallZ and iBallDensity are BOTH uniform1fv — discriminate by name.
  WebGL2RenderingContext.prototype.uniform1fv = function (loc, val, ...rest) {
    if (rec.active && names.get(loc) === "iBallDensity" && val) rec.dens = Array.from(val);
    return u1v.call(this, loc, val, ...rest);
  };
  // COMMIT ON THE DRAW. iBalls uploads at FieldStage:427 but iBallCount at :428,
  // so latching the count when iBalls arrives reads the PREVIOUS frame's count.
  // Everything for a frame is set by the time drawArrays runs; snapshot there.
  const da = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) {
    // R6 tiled path: the population rides in a texture, so neither iBalls nor
    // iBallDensity reaches a uniform setter and the two latches above stay
    // null. FieldStage publishes both packed buffers on __optics; snapshot them
    // here, at the same commit point the uniform path uses.
    if (rec.active) {
      const o = window.__optics;
      if (o && o.tiled && o.balls) {
        rec.balls = Array.from(o.balls);
        rec.dens = Array.from(o.dens);
        if (typeof o.count === "number") rec.count = o.count;
      }
    }
    if (rec.active && rec.balls && rec.dens && rec.frames.length < 8000) {
      const s = window.__scenes?.site;
      rec.frames.push({
        y: window.scrollY,
        count: rec.count,
        balls: rec.balls,
        dens: rec.dens,
        pa: s?.pairA ?? -1,
        pb: s?.pairB ?? -1,
        pm: s?.pairM ?? -1,
        hero: s?.heroPhase ?? -1,
        gather: s?.gather ?? -1,
        exit: s?.exit ?? -1,
        on: s?.on ?? -1,
        sp: s?.svcPos ?? -1,
        dbg: window.__s4dbg ? { ...window.__s4dbg } : null,
        d0: window.__s4d0 ? { ...window.__s4d0 } : null,
        form: window.__s4form ? { ...window.__s4form } : null,
        gpu: {
          fa: rec.iFormA,
          fb: rec.iFormB,
          ea: rec.iEroA,
          eb: rec.iEroB,
        },
      });
      rec.balls = null;
      rec.dens = null;
    }
    return da.call(this, ...args);
  };
});

const page = await context.newPage();
await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 20000 });
await page.waitForTimeout(1500);

const geo = await page.evaluate(() => {
  const ps = [...document.querySelectorAll("#services .pillar")];
  const svc = document.querySelector("#services").getBoundingClientRect();
  const Y = window.scrollY;
  return {
    n: ps.length,
    vh: window.innerHeight,
    centers: ps.map((el) => {
      const b = el.getBoundingClientRect();
      return Math.round(b.top + Y + b.height / 2);
    }),
    start: Math.round(svc.top + Y - window.innerHeight * 1.1),
    end: Math.round(svc.bottom + Y + window.innerHeight * 0.2),
  };
});
console.log(`pillars=${geo.n}  vh=${geo.vh}  scroll ${geo.start}..${geo.end} @ ${STEP}px/wheel`);
console.log(`pillar centres: ${geo.centers.join(", ")}`);
console.log(`(pillar k reaches viewport centre at scrollY = centre - ${geo.vh / 2})`);

await page.evaluate(async (start) => {
  for (let tries = 0; tries < 12; tries++) {
    window.scrollTo(0, start);
    await new Promise((r) => setTimeout(r, 150));
    if (Math.abs(window.scrollY - start) < 3) break;
  }
}, geo.start);
await page.waitForTimeout(900);

await page.mouse.move(VW / 2, VH / 2);
await page.evaluate(() => {
  window.__s4.active = true;
});
const wheels = Math.ceil((geo.end - geo.start) / STEP) + 10;
for (let i = 0; i < wheels; i++) {
  await page.mouse.wheel(0, STEP);
  if (await page.evaluate((e) => window.scrollY >= e, geo.end)) break;
}
await page.waitForTimeout(500);
await page.evaluate(() => {
  window.__s4.active = false;
});

const frames = (await page.evaluate(() => window.__s4.frames)).filter((f) => f.dens);
console.log(`captured ${frames.length} frames\n`);

// ── the metric: reconstruct the density-weighted metaball field on a coarse
// grid and compare consecutive frames. This is what the eye sees; droplets at
// density 0 contribute nothing no matter where they are.
const GW = 72;
const GH = 45;
const field = (f) => {
  const g = new Float32Array(GW * GH);
  for (let i = 0; i < f.count; i++) {
    const j = i * 3;
    const d = f.dens[i];
    const r = f.balls[j + 2];
    if (d < 0.01 || r < 0.002) continue;
    // uv x = 0.5 + (pageFraction - 0.5) * aspect  →  invert to page fraction
    const fx = (f.balls[j] - 0.5) / ASPECT + 0.5;
    const fy = 1 - f.balls[j + 1];
    const rr = r; // in uv-y units, which map 1:1 to page height fraction
    for (let gy = 0; gy < GH; gy++) {
      const py = (gy + 0.5) / GH;
      const dy = py - fy;
      if (Math.abs(dy) > rr * 4) continue;
      for (let gx = 0; gx < GW; gx++) {
        const px = (gx + 0.5) / GW;
        const dx = px - fx;
        const q = dx * dx + dy * dy;
        if (q > rr * rr * 16) continue;
        g[gy * GW + gx] += (d * rr * rr) / (q + rr * rr * 0.25);
      }
    }
  }
  return g;
};
const fields = frames.map(field);
const l1 = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
};

const steps = [];
for (let i = 1; i < frames.length; i++) {
  steps.push({
    i,
    y: frames[i].y,
    d: l1(fields[i - 1], fields[i]),
    pa: frames[i].pa,
    pb: frames[i].pb,
    pm: frames[i].pm,
    prevPa: frames[i - 1].pa,
    prevPb: frames[i - 1].pb,
    prevPm: frames[i - 1].pm,
    switched: frames[i].pa !== frames[i - 1].pa || frames[i].pb !== frames[i - 1].pb,
  });
}
const inSvc = steps.filter((s) => s.pa > 0 || s.pb > 0);
const med = (arr) => {
  const v = [...arr].sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 0;
};
const medStep = med(inSvc.map((s) => s.d));
console.log(`median per-frame FIELD change inside S4: ${medStep.toFixed(3)} (${inSvc.length} frames)`);

const worst = [...inSvc].sort((a, b) => b.d - a.d).slice(0, 10);
console.log("\nLARGEST PER-FRAME FIELD JUMPS (ratio = jump / median):");
for (const s of worst) {
  console.log(
    `  y=${String(s.y).padStart(6)}  d=${s.d.toFixed(2).padStart(8)}  ratio=${(s.d / medStep).toFixed(1).padStart(6)}x` +
      `  pair ${s.prevPa}->${s.prevPb} m=${s.prevPm.toFixed(3)} ==> ${s.pa}->${s.pb} m=${s.pm.toFixed(3)}` +
      (s.switched ? "  [PAIR SWITCH]" : ""),
  );
}

console.log("\nAT EACH PAIR SWITCH:");
for (const s of steps.filter((x) => x.switched && (x.pa > 0 || x.prevPa > 0))) {
  console.log(
    `  y=${String(s.y).padStart(6)}  ${s.prevPa}->${s.prevPb} (m=${s.prevPm.toFixed(3)})` +
      ` becomes ${s.pa}->${s.pb} (m=${s.pm.toFixed(3)})   jump=${(s.d / medStep).toFixed(1)}x median`,
  );
}

// ── how much TOTAL field mass exists through each melt? A morph that stays one
// body holds roughly constant mass; a collapse-and-reappear dips hard.
const counts = frames.map((f) => f.count);
console.log(`\nlive iBallCount across the run: ${Math.min(...counts)}..${Math.max(...counts)}`);

console.log("\nFIELD MASS THROUGH EACH MELT (min mass as % of the pair's max):");
const byPair = new Map();
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  if (f.pa === f.pb || f.pa <= 0) continue;
  const key = `${f.pa}->${f.pb}`;
  let m = 0;
  for (const v of fields[i]) m += v;
  if (!byPair.has(key)) byPair.set(key, []);
  byPair.get(key).push({ m, pm: f.pm });
}
for (const [key, arr] of byPair) {
  const max = Math.max(...arr.map((a) => a.m));
  const lo = arr.reduce((acc, a) => (a.m < acc.m ? a : acc), arr[0]);
  console.log(
    `  ${key.padEnd(8)} max=${max.toFixed(0).padStart(6)}  min=${lo.m.toFixed(0).padStart(6)}` +
      ` (${((lo.m / max) * 100).toFixed(0)}% at m=${lo.pm.toFixed(2)})`,
  );
}

fs.writeFileSync(path.join(OUT, "frames.json"), JSON.stringify({ geo, step: STEP, frames }));

// ── filmstrip: render the reconstructed FIELD around the worst jump.
const centre = worst[0]?.i ?? 0;
const from = Math.max(0, centre - 6);
const to = Math.min(frames.length - 1, centre + 6);
const cols = to - from + 1;
const strip = new PNG({ width: GW * cols, height: GH });
strip.data.fill(0);
for (let c = 0; c < cols; c++) {
  const g = fields[from + c];
  const isBreak = from + c === centre;
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const v = Math.min(1, g[gy * GW + gx] / 1.2);
      const o = (gy * strip.width + c * GW + gx) << 2;
      strip.data[o] = isBreak ? 255 * v : 40 * v;
      strip.data[o + 1] = isBreak ? 60 * v : 225 * v;
      strip.data[o + 2] = isBreak ? 60 * v : 240 * v;
      strip.data[o + 3] = 255;
    }
  }
}
fs.writeFileSync(path.join(OUT, "filmstrip.png"), PNG.sync.write(strip));
console.log(`\nfilmstrip -> ${path.join(OUT, "filmstrip.png")} (frames ${from}..${to}, break in RED)`);

const video = page.video();
await page.close();
if (video) console.log(`video     -> ${await video.path()}`);
await context.close();
await browser.close();
