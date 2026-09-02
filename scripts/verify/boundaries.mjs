// verify-boundaries — the gate for "one continuous physical experience".
//
// Acts II and III are supposed to have no seams: the Problem's fracture becomes
// the Ecosystem's headwaters, the gathered mark's first act is the melt into
// the first service, and the seventh form pours out of frame rather than being
// switched off before Método. Those are motion claims, and motion claims fail
// in two specific ways that a still can never show:
//
//   1. A DEAD BAND — some scroll position where the liquid has no visible mass
//      at all. That is a cut, however smooth the fade into it was. Mass means
//      DROPLETS *OR* FORM: the two exact form slots are rendered from SDF
//      textures and never appear in the ball buffer, so counting droplets
//      alone reports an empty stage during exactly the passages where a solid
//      form is carrying the composition on its own.
//   2. A JUMP — the field's centre of mass teleporting between frames, which is
//      what "objects being swapped" actually looks like in the numbers.
//   3. INK ON GLASS — that the liquid actually PAINTS. Everything above reads
//      simulation state, and state can be perfectly healthy while the shader
//      emits nothing: a NaN in the light score once multiplied `col` to zero
//      across an entire chapter while the droplet buffer, the form weights and
//      the ball count all looked correct. State gates cannot see that. This
//      reads the framebuffer.
//
// Both are measured on the real packed buffer while wheel input drives Lenis
// across Hero → Problem → Ecosystem → Services → Método.
//
// Dev server must be running:  node scripts/verify/boundaries.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";
// A teleport is a DISCONTINUITY, not a speed. During a §3.3 melt the whole
// cloud is legitimately in transit and the centre of mass moves fast — an
// absolute ceiling flags that healthy motion and misses the thing it was
// written to catch. So the test is an outlier test: a step this many times the
// journey's median step is a step nothing physical could have taken.
// KNOWN LIMITATION, do not "fix" by raising this. The traverse steps ~110px
// per wheel tick, and pairM is scroll-derived, so a single captured frame can
// legitimately advance a §3.3 melt by a third of its span — a real 0.12 uv
// centroid move caused by the INPUT, not by the material. Comparing that to a
// median dominated by near-stationary frames measures scroll cadence, not
// continuity. Making this sound needs the step normalised by the scroll delta
// that produced it (or a settle-and-sample traverse); until then the ratio is
// reported and the assertion is left deliberately loose.
const JUMP_RATIO = 80;
// Total visible area (Σ r²) below which the stage is effectively empty.
const DEAD_AREA = 6e-4;

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 900, height: 620 },
  reducedMotion: "no-preference",
});

await ctx.addInitScript(() => {
  const names = new WeakMap();
  const getU = WebGL2RenderingContext.prototype.getUniformLocation;
  const u3 = WebGL2RenderingContext.prototype.uniform3fv;
  const u1i = WebGL2RenderingContext.prototype.uniform1i;
  const tap = { on: false, frames: [], pending: null, fa: 0, fb: 0 };
  window.__bounds = tap;
  WebGL2RenderingContext.prototype.getUniformLocation = function (p, n) {
    const l = getU.call(this, p, n);
    if (l) names.set(l, n);
    return l;
  };
  const u1f = WebGL2RenderingContext.prototype.uniform1f;
  WebGL2RenderingContext.prototype.uniform1f = function (l, v) {
    if (tap.on && l) {
      const n = names.get(l);
      if (n === "iFormA") tap.fa = v;
      else if (n === "iFormB") tap.fb = v;
    }
    return u1f.call(this, l, v);
  };
  WebGL2RenderingContext.prototype.uniform3fv = function (l, v, ...r) {
    if (tap.on && names.get(l) === "iBalls" && v && tap.frames.length < 6000) {
      const f = {
        y: window.scrollY,
        // the Hero hands over to the page field as it leaves; below that the
        // field is meant to be empty and is not part of this measurement
        hero: window.__scenes?.site?.heroPhase ?? 0,
        // distance from the viewport bottom to Método's top: the window this
        // gate owns closes once that chapter has fully taken the stage
        methodTop:
          (document.getElementById("method")?.getBoundingClientRect().top ??
            1e6) / window.innerHeight,
        pa: window.__scenes?.site?.pairA ?? 0,
        pb: window.__scenes?.site?.pairB ?? 0,
        pm: window.__scenes?.site?.pairM ?? 0,
        // the other half of the field: form-slot weights for this draw
        form: tap.fa + tap.fb,
        count: -1,
        balls: Array.from(v),
      };
      tap.frames.push(f);
      tap.pending = f;
    }
    return u3.call(this, l, v, ...r);
  };
  WebGL2RenderingContext.prototype.uniform1i = function (l, v) {
    if (tap.on && names.get(l) === "iBallCount") {
      // R6 — THE TILED PATH. The renderer carries its population in a texture,
      // so `iBalls` never reaches a uniform setter and the tap above cannot
      // fire. iBallCount is uploaded at exactly the point iBalls used to be, so
      // building the frame here keeps the timing identical, and FieldStage
      // publishes the same packed buffer on __optics for this purpose. Without
      // it this gate would silently measure nothing on the shipped path.
      if (!tap.pending) {
        const o = window.__optics;
        if (o && o.tiled && o.balls && tap.frames.length < 6000) {
          const f = {
            y: window.scrollY,
            hero: window.__scenes?.site?.heroPhase ?? 0,
            methodTop:
              (document.getElementById("method")?.getBoundingClientRect().top ??
                1e6) / window.innerHeight,
            pa: window.__scenes?.site?.pairA ?? 0,
            pb: window.__scenes?.site?.pairB ?? 0,
            pm: window.__scenes?.site?.pairM ?? 0,
            form: tap.fa + tap.fb,
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
    return u1i.call(this, l, v);
  };
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#services", { timeout: 30000 });
await page.mouse.move(450, 310);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__bounds.on = true;
});

// One long, steady traverse. Steady on purpose: a flick would let the damped
// channels lag and blur the very seams under test.
const marks = [];
for (let i = 0; i < 210; i++) {
  await page.mouse.wheel(0, 110);
  if (i % 3 === 0) {
    const m = await page.evaluate(() => {
      const s = window.__scenes?.site;
      return {
        y: window.scrollY,
        gather: +(s?.gather ?? 0).toFixed(3),
        svcPos: +(s?.svcPos ?? 0).toFixed(3),
        exit: +(s?.exit ?? 0).toFixed(3),
        tier: window.__optics?.tier ?? "?",
      };
    });
    marks.push(m);
  }
  await page.waitForTimeout(38);
}
await page.waitForTimeout(900);

const frames = await page.evaluate(() => {
  window.__bounds.on = false;
  return window.__bounds.frames;
});

// ── INK ON GLASS ────────────────────────────────────────────────────────────
// Sample the real composited page at three points where liquid must be on
// screen. Screenshots, not canvas readback: the GL context has no
// preserveDrawingBuffer, so drawImage() off it returns an empty buffer and
// would report zero for a perfectly healthy render.
const inkAt = async (label, ticks) => {
  await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content: ".cursor-ring,.cursor-dot{display:none!important}",
  });
  await page.mouse.move(450, 310);
  await page.waitForTimeout(1300);
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1800);
  const shot = await page.screenshot();
  const { createHash } = await import("node:crypto");
  // count pixels with real cyan energy, cheaply, straight off the PNG-decoded
  // screenshot via the browser (no image lib in this repo)
  const b64 = shot.toString("base64");
  const lit = await page.evaluate(
    (d) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement("canvas");
          cv.width = img.width;
          cv.height = img.height;
          const g = cv.getContext("2d");
          g.drawImage(img, 0, 0);
          const px = g.getImageData(0, 0, cv.width, cv.height).data;
          let n = 0;
          for (let i = 0; i < px.length; i += 4)
            if (px[i + 2] > 90 && px[i + 2] > px[i] + 40) n++;
          res(n);
        };
        img.src = "data:image/png;base64," + d;
      }),
    b64,
  );
  void createHash;
  return { label, lit };
};

const ink = [];
ink.push(await inkAt("problem (fracture)", 13));
ink.push(await inkAt("ecosystem (gathering)", 26));
ink.push(await inkAt("services (a form)", 44));

await browser.close();

/** Area-weighted centre of mass + total area of one packed frame. */
function moment(f) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < f.count; i++) {
    const r = f.balls[i * 3 + 2];
    if (r < 0.0012) continue;
    const a = r * r;
    area += a;
    cx += f.balls[i * 3] * a;
    cy += f.balls[i * 3 + 1] * a;
  }
  return area > 0
    ? { area, x: cx / area, y: cy / area, form: f.form ?? 0 }
    : { area: 0, x: 0, y: 0, form: f.form ?? 0 };
}

// THE WINDOW THIS GATE OWNS: from the Hero handover to the point Método has
// fully taken the stage. That is exactly the span the three redesigned
// boundaries cover. Beyond it the later chapters run their own much quieter
// compositions, and folding those into this measurement would let an unrelated
// scene's calm read as a failure of these seams.
const live = frames.filter((f) => f.hero > 0.95 && f.methodTop > -0.6);
const after = frames.filter((f) => f.hero > 0.95 && f.methodTop <= -0.6);
const moments = live.map(moment);
let dead = 0;
let deadAt = -1;
for (let i = 0; i < moments.length; i++) {
  // alive if droplets carry it OR a form is on screen
  if (moments[i].area < DEAD_AREA && moments[i].form < 0.02) {
    dead++;
    if (deadAt < 0) deadAt = live[i].y;
  }
}
const steps = [];
let worstJump = 0;
let jumpAt = -1;
let jumpCtx = "";
for (let i = 1; i < moments.length; i++) {
  if (moments[i].area < DEAD_AREA || moments[i - 1].area < DEAD_AREA) continue;
  // centroid of a droplet-thin frame is dominated by stray beads — not a seam
  const d = Math.hypot(
    moments[i].x - moments[i - 1].x,
    moments[i].y - moments[i - 1].y,
  );
  steps.push(d);
  if (d > worstJump) {
    worstJump = d;
    jumpAt = live[i].y;
    jumpCtx = `pair ${live[i].pa}->${live[i].pb} m=${live[i].pm.toFixed(2)} (prev ${live[i - 1].pa}->${live[i - 1].pb} m=${live[i - 1].pm.toFixed(2)})`;
  }
}

const span = (pred) => marks.filter(pred).length;
console.log(`frames: ${frames.length} total, ${live.length} after the Hero handover · scroll ${frames[0]?.y} → ${frames.at(-1)?.y}`);
console.log(
  `phases sampled: gathering=${span((m) => m.gather > 0.02 && m.gather < 0.98)} · services=${span((m) => m.svcPos > 0.5)} · exiting=${span((m) => m.exit > 0.02)}`,
);
const noCount = live.filter((f) => f.count < 0).length;
const deadFrames = live.filter(
  (f, i) => moments[i].area < DEAD_AREA && moments[i].form < 0.02,
);
console.log(
  `frames whose ball COUNT never arrived: ${noCount} (these score zero area and are a tap artefact, not a dead stage)`,
);
if (deadFrames.length)
  console.log(
    `dead range: y=${deadFrames[0].y} → ${deadFrames.at(-1).y} · counts ${JSON.stringify([...new Set(deadFrames.map((f) => f.count))].slice(0, 6))}`,
  );
if (after.length) {
  const aa = after.map(moment).map((m) => m.area).sort((x, y) => x - y);
  console.log(
    `beyond Método (informational, not this gate's scope): ${after.length} frames, median area ${aa[Math.floor(aa.length / 2)].toExponential(2)}`,
  );
}
console.log(
  `visible area: min=${Math.min(...moments.map((m) => m.area)).toExponential(2)} median=${moments.map((m) => m.area).sort((a, b) => a - b)[Math.floor(moments.length / 2)].toExponential(2)}`,
);
const sorted = [...steps].sort((a, b) => a - b);
const medStep = sorted[Math.floor(sorted.length / 2)] || 1e-9;
const ratio = worstJump / medStep;
console.log(
  `centre-of-mass step: median ${medStep.toFixed(4)} uv · worst ${worstJump.toFixed(4)} uv (${ratio.toFixed(1)}x median) at y=${jumpAt} · ${jumpCtx}`,
);

let bad = 0;
const check = (ok, label, detail) => {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
console.log("");
check(
  live.length > 150,
  "the traverse rendered liquid from the Hero handover onward",
  `${live.length} frames`,
);
check(
  span((m) => m.gather > 0.02 && m.gather < 0.98) >= 3,
  "the gathering was scrubbed, not skipped",
);
check(span((m) => m.exit > 0.02) > 2, "the services exit was reached");
check(
  dead === 0,
  "no dead band — the liquid is never switched off mid-journey",
  dead ? `${dead} empty frames, first at y=${deadAt}` : "continuous",
);
check(
  ratio < JUMP_RATIO,
  `nothing teleports at a seam (no step > ${JUMP_RATIO}x the median)`,
  `worst ${ratio.toFixed(1)}x`,
);
for (const i of ink)
  check(
    i.lit > 1500,
    `ink on glass — the liquid actually paints at ${i.label}`,
    `${i.lit} cyan px`,
  );
check(errors.length === 0, "no page errors", errors[0]);
console.log(bad === 0 ? "BOUNDARIES: one continuous liquid" : `BOUNDARY FAILURES: ${bad}`);
process.exit(bad ? 1 : 0);
