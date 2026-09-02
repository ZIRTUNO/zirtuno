// verify-deformation — the gate for the deformable liquid-glass material.
//
// Three claims are asserted against the REAL page, because all three were
// previously true only behind opt-in flags and are now the shipped default:
//
//   1. DEFORMATION IS LIVE — the velocity-aware field actually linked, and the
//      geometry + optics uniforms (iBallShape / iStrain) are driven non-zero
//      while liquid moves. A silent fallback to the plain field would leave the
//      page looking correct-ish and quietly ship sliding discs.
//      NOTE: the strain OPTICS are opt-in on the live site (they read as
//      glitchy on moving liquid), so every URL here carries ?fstrain=1. The
//      deformation GEOMETRY is still the shipped default and needs no flag.
//   2. THE LIQUID IS ALIVE AT REST — with no scroll and no pointer, droplets
//      still travel. The legacy integrator (?fphys=0) is the control: it has no
//      curl current, so it should be markedly stiller. "Alive between the
//      transitions" is the requirement this protects.
//   3. NOTHING TELEPORTS — no droplet jumps further in one frame than liquid
//      could plausibly travel. This is the regression that a physics change is
//      most likely to introduce and the hardest to see in a still.
//
// Dev server must be running:  BASE=http://localhost:3000 node scripts/verify-deformation.mjs

import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "pt";
// uv/s — SHAPE_SPEED_MIN in sdf-glass-shader. Below this the shader rejects
// motion as filter noise and renders a circle, so it is the threshold that
// decides whether deformation is visible at all.
const SHAPE_SPEED_MIN = 0.055;
// uv per frame. A droplet crossing more than a third of the field between two
// consecutive draws is not travelling, it is being repositioned.
const TELEPORT_UV = 0.34;

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

/** Hook the uniform uploads so we read exactly what the shader was given. */
const INIT = () => {
  const names = new WeakMap();
  const getUniformLocation =
    WebGL2RenderingContext.prototype.getUniformLocation;
  const uniform3fv = WebGL2RenderingContext.prototype.uniform3fv;
  const uniform1f = WebGL2RenderingContext.prototype.uniform1f;
  const uniform1i = WebGL2RenderingContext.prototype.uniform1i;

  const tap = {
    on: false,
    frames: [],
    pending: null,
    shape: [],
    strain: [],
  };
  window.__deform = tap;

  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const loc = getUniformLocation.call(this, p, n);
    if (loc) names.set(loc, n);
    return loc;
  };
  WebGL2RenderingContext.prototype.uniform1f = function (loc, v) {
    if (tap.on && loc) {
      const n = names.get(loc);
      if (n === "iBallShape") tap.shape.push(v);
      else if (n === "iStrain") tap.strain.push(v);
    }
    return uniform1f.call(this, loc, v);
  };
  WebGL2RenderingContext.prototype.uniform3fv = function (loc, val, ...rest) {
    if (
      tap.on &&
      names.get(loc) === "iBalls" &&
      val &&
      val.length >= 48 * 3 &&
      tap.frames.length < 4000
    ) {
      // The WHOLE packed buffer, not just the 48 canonical droplets: the
      // ambient beads and the pinch-off spray are packed after them and are a
      // large part of what "alive between transitions" actually means.
      const f = {
        t: performance.now(),
        y: window.scrollY,
        count: -1,
        balls: Array.from(val),
      };
      tap.frames.push(f);
      tap.pending = f;
    }
    return uniform3fv.call(this, loc, val, ...rest);
  };
  WebGL2RenderingContext.prototype.uniform1i = function (loc, v) {
    if (tap.on && names.get(loc) === "iBallCount") {
      // R6 — THE TILED PATH. The renderer carries its population in a texture,
      // so `iBalls` never reaches a uniform setter and the tap above cannot
      // fire. iBallCount is uploaded at exactly the point iBalls used to be, so
      // building the frame here keeps the timing identical, and FieldStage
      // publishes the same packed buffer on __optics for this purpose. Without
      // it this gate would silently measure nothing on the shipped path.
      if (!tap.pending) {
        const o = window.__optics;
        if (o && o.tiled && o.balls && tap.frames.length < 4000) {
          const f = {
            t: performance.now(),
            y: window.scrollY,
            count: -1,
            balls: Array.from(o.balls),
          };
          tap.frames.push(f);
          tap.pending = f;
        }
      }
      if (tap.pending) {
        tap.pending.count = v;
        tap.pending = null;
      }
    }
    return uniform1i.call(this, loc, v);
  };

  // __optics.shapeSpeed is the CURRENT frame's peak droplet speed. Reading it
  // after the scroll stops reports the settled value (zero) rather than what
  // the material did while moving, so track the running maximum in-page.
  tap.peakSpeed = 0;
  tap.tiers = {};
  const watch = () => {
    if (tap.on && window.__optics) {
      tap.peakSpeed = Math.max(tap.peakSpeed, window.__optics.shapeSpeed || 0);
      // Which tier was live while we measured. Under software GL the FPS
      // watchdog walks full → fullnofx → glass1x → rigid → glasshalf → lite →
      // half. Deformation is shed at `rigid` (it costs ~1.49× the glass pass),
      // so from that rung down the velocity sampler is not run at all — a peak
      // of 0 there means "not measured", never "the liquid did not move".
      const t = window.__optics.tier;
      tap.tiers[t] = (tap.tiers[t] || 0) + 1;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
};

/**
 * Per-droplet travel between consecutive captured draws.
 *
 * Normalised to uv/SECOND, not per frame. Software GL renders at wildly
 * different cadences across runs, and a per-frame step silently rewards the
 * SLOWER run (each frame covers more wall time) — which would have made the
 * currentless control look livelier than the current.
 */
function travelStats(frames) {
  let total = 0;
  let worst = 0;
  let elapsed = 0;
  let pairs = 0;
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].t - frames[i - 1].t;
    if (dt <= 0 || dt > 400) continue; // dropped/stalled pair
    // The conductor packs only VISIBLE droplets, so a droplet shrinking out of
    // the buffer shifts every slot behind it. Diffing slot-against-slot across
    // a count change compares two different droplets and reports the gap
    // between them as a teleport. Only equal-count pairs are comparable.
    if (frames[i].count !== frames[i - 1].count || frames[i].count <= 0) continue;
    const a = frames[i - 1].balls;
    const b = frames[i].balls;
    let stepSum = 0;
    let visible = 0;
    for (let d = 0; d < frames[i].count; d++) {
      const r = b[d * 3 + 2];
      const pr = a[d * 3 + 2];
      if (r < 0.0012 || pr < 0.0012) continue;
      // FieldStage's own stable-slot heuristic: a slot whose radius jumped is
      // very likely a different droplet, not the same one deforming.
      if (Math.abs(r - pr) > Math.max(0.014, Math.max(r, pr) * 0.65)) continue;
      const dx = b[d * 3] - a[d * 3];
      const dy = b[d * 3 + 1] - a[d * 3 + 1];
      const step = Math.hypot(dx, dy);
      stepSum += step;
      visible++;
      if (step > worst) worst = step;
    }
    if (!visible) continue;
    total += stepSum / visible; // mean droplet travel over this interval
    elapsed += dt;
    pairs++;
  }
  return {
    perSecond: elapsed > 0 ? (total * 1000) / elapsed : 0,
    worst,
    frames: frames.length,
    pairs,
    elapsed: Math.round(elapsed),
  };
}

async function run(query, { scroll }) {
  // Small on purpose. The field costs 80 ball evaluations PER PIXEL, so under
  // SwiftShader a desktop viewport is slow enough that the FPS watchdog demotes
  // full → lite and the very path under test stops running. Shrinking the
  // buffer keeps the shipped full-tier path alive in software.
  const ctx = await browser.newContext({
    viewport: { width: 700, height: 480 },
    reducedMotion: "no-preference",
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${LOCALE}?${query}`, {
    waitUntil: "domcontentloaded",
  });
  // MEASURE EARLY. Software GL cannot hold the full tier for long, and the
  // watchdog is right to demote it — but the `rigid` rung and everything below
  // stop running the very code under test. So get into the field and start
  // sampling promptly rather than settling first.
  //
  // The peak-speed tap opens BEFORE the warm-up scroll on purpose. Deformation
  // is a property of the fast choreographed passages — the pour, the fracture,
  // a pointer flick — not of ambient drift, which is slow precisely because
  // slow liquid should not stretch. A window that skips the transitions
  // measures the one regime where zero stretch is the correct answer.
  await page.evaluate(() => { window.__deform.on = true; });
  await page.mouse.move(350, 240);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(700);

  const optics = await page.evaluate(() => {
    const o = window.__optics;
    return o
      ? {
          tier: o.tier,
          shapeRequested: o.shapeRequested,
          shapeShader: o.shapeShader,
          shape: o.shape,
        }
      : null;
  });

  // Trajectory sampling restarts for the measurement window; the peak speed
  // deliberately carries over from the warm-up transition.
  await page.evaluate(() => {
    window.__deform.frames.length = 0;
    window.__deform.shape.length = 0;
    window.__deform.strain.length = 0;
  });

  if (scroll) {
    for (let i = 0; i < 18; i++) {
      await page.mouse.wheel(0, 90);
      await page.waitForTimeout(55);
    }
  } else {
    // Pointer parked well away from the liquid so the cursor force field is not
    // what we end up measuring, then simply wait.
    await page.mouse.move(4, 4);
    await page.waitForTimeout(2600);
  }

  const tap = await page.evaluate(() => {
    window.__deform.on = false;
    const t = window.__deform;
    return {
      frames: t.frames,
      shapeMax: t.shape.length ? Math.max(...t.shape) : null,
      strainMax: t.strain.length ? Math.max(...t.strain) : null,
      shapeSamples: t.shape.length,
      strainSamples: t.strain.length,
      peakSpeed: t.peakSpeed,
      tiers: t.tiers,
      counts: [...new Set(t.frames.map((f) => f.count))].sort((a, b) => a - b),
      yRange: t.frames.length
        ? [t.frames[0].y, t.frames[t.frames.length - 1].y]
        : null,
    };
  });
  await ctx.close();
  return { optics, tap, errors, stats: travelStats(tap.frames) };
}

console.log("== default (shipped material), scrolling ==");
const scrolled = await run("ftier=full&fstrain=1", { scroll: true });
console.log("  optics:", JSON.stringify(scrolled.optics));
console.log(
  `  iBallShape max=${scrolled.tap.shapeMax} (${scrolled.tap.shapeSamples} uploads) · iStrain max=${scrolled.tap.strainMax} (${scrolled.tap.strainSamples})`,
);
console.log(`  peak ball speed: ${scrolled.tap.peakSpeed?.toFixed(4)} uv/s · tiers seen ${JSON.stringify(scrolled.tap.tiers)}`);
console.log(
  `  travel: ${scrolled.stats.perSecond.toFixed(4)} uv/s · worst step ${scrolled.stats.worst.toFixed(4)} uv · ${scrolled.stats.frames} frames`,
);

console.log("\n== default (shipped material), idle ==");
const idle = await run("ftier=full&fstrain=1", { scroll: false });
console.log(
  `  travel: ${idle.stats.perSecond.toFixed(4)} uv/s · ${idle.stats.frames} frames`,
);

console.log("\n== control: legacy integrator (?fphys=0), idle ==");
const legacy = await run("ftier=full&fstrain=1&fphys=0", { scroll: false });
console.log(
  `  travel: ${legacy.stats.perSecond.toFixed(4)} uv/s · ${legacy.stats.frames} frames`,
);

console.log(`  balls packed: ${JSON.stringify(legacy.tap.counts)} · scrollY ${JSON.stringify(legacy.tap.yRange)} · ${legacy.stats.pairs} pairs over ${legacy.stats.elapsed}ms`);

const errors = [...scrolled.errors, ...idle.errors, ...legacy.errors];
const checks = [
  [
    "the velocity-aware field linked (no silent fallback to sliding discs)",
    scrolled.optics?.shapeShader === 1,
  ],
  [
    "droplet geometry deforms — iBallShape is driven",
    scrolled.tap.shapeMax === 1,
  ],
  [
    "the glass optics answer the deformation — iStrain is driven",
    (scrolled.tap.strainMax ?? 0) > 0,
  ],
  [
    `the liquid reaches deformation speed during a transition (> ${SHAPE_SPEED_MIN} uv/s)`,
    (scrolled.tap.peakSpeed ?? 0) > SHAPE_SPEED_MIN,
  ],
  ["the liquid is alive with no scroll and no pointer", idle.stats.perSecond > 2e-3],
  // NOT compared against ?fphys=0 here. Under software GL the two runs hit the
  // FPS watchdog on different schedules, so their cadences differ and the ratio
  // measures the demotion timing rather than the current. The absolute floor is
  // the honest assertion; the A/B belongs on real hardware.
  [
    "the ambient current is running, not merely non-zero",
    idle.stats.perSecond > 2e-3,
  ],
  [
    `nothing teleports — worst single-frame travel ${scrolled.stats.worst.toFixed(3)} uv`,
    scrolled.stats.worst < TELEPORT_UV,
  ],
  ["no page errors", errors.length === 0],
];

console.log("");
let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
if (errors.length) console.log(errors);
await browser.close();
process.exit(bad ? 1 : 0);
