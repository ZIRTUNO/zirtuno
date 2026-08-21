// The STRIKE gate — click physics, end to end in a real browser.
//
// scripts/verify-conductor.mjs proves the FORCE (wave, crown, saturation,
// bind=1 parity, rollback) against the pure core. This proves the WIRING, which
// that harness cannot see: that a real pointer event on a real page reaches the
// conductor, that the liquid visibly answers it, that a held pointer registers
// as a press, that the click is passive — it never swallows a navigation — and
// that reduced motion has none of it.
//
// Section 0 is node-only and guards the exact-rest contract: the forms answer
// the pointer through a SEPARATE compile variant, so the sources the
// deterministic rest stills compile must contain none of it.
//
//   node scripts/verify-strike.mjs
//   BASE_URL=http://localhost:3001 node scripts/verify-strike.mjs

import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";
import { FLUID } from "../lib/webgl/fluid-core.mjs";
import {
  SDF_GLASS_FRAG,
  SDF_GLASS_FRAG_SHAPE,
  SDF_GLASS_FRAG_TOUCH,
  SDF_GLASS_FRAG_SHAPE_TOUCH,
  SDF_FORM_SHOCKS,
} from "../lib/webgl/sdf-glass-shader.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
// Small on purpose. The FPS watchdog demotes the material when a software
// rasteriser cannot hold the frame budget, and a 1280×800 field on SwiftShader
// is exactly the case that trips it — which would quietly disable the code
// under test and report a pass.
const VW = 900;
const VH = 620;

let failures = 0;
const check = (ok, label, detail) => {
  console.log(
    `${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

// ═══ 0 · the shader variants — exact rest is protected by SEPARATION ════════
// The forms answering a pointer is new code in a new compile variant. What
// keeps `forms:rest` and verify-rest-exact sound is that the sources those
// gates compile do not contain that code AT ALL — a structural claim, not a
// floating-point one. Assert the separation rather than trusting it, because
// the day someone folds the touch branch into the shared source is the day the
// exact-rest argument quietly becomes "identity at zero, probably".
{
  console.log("0 · shader variants");
  const clean = [
    ["SDF_GLASS_FRAG", SDF_GLASS_FRAG],
    ["SDF_GLASS_FRAG_SHAPE", SDF_GLASS_FRAG_SHAPE],
  ];
  for (const [name, src] of clean) {
    const leaked = ["iTouch", "iShock", "formTouch"].filter((t) =>
      src.includes(t),
    );
    check(
      leaked.length === 0,
      `${name} carries no interaction code`,
      leaked.length ? `leaked: ${leaked.join(", ")}` : undefined,
    );
  }
  for (const [name, src] of [
    ["SDF_GLASS_FRAG_TOUCH", SDF_GLASS_FRAG_TOUCH],
    ["SDF_GLASS_FRAG_SHAPE_TOUCH", SDF_GLASS_FRAG_SHAPE_TOUCH],
  ]) {
    check(
      src.includes("vec2 formTouch(") &&
        src.includes("uniform vec4 iTouch") &&
        src.includes(`uniform vec4 iShock[${SDF_FORM_SHOCKS}]`),
      `${name} carries the interaction field`,
    );
  }
  check(
    SDF_GLASS_FRAG_SHAPE_TOUCH.includes("iBallShape"),
    "the combined variant keeps deformation as well as touch",
  );

  // The spatial profile is injected from FLUID so a physics retune cannot move
  // the droplets and leave the forms answering the old law. Rebuild the exact
  // literals the generator should have produced and look for those — GLSL has
  // no implicit int → float, so a whole-number constant has to arrive as "2.0"
  // and a regression to a bare "2" is a compile error at runtime that nothing
  // else in this suite would reach.
  const glslNum = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  const glsl = SDF_GLASS_FRAG_TOUCH;
  const injected = [
    ["SHOCK_WIDTH", `/ ${glslNum(FLUID.SHOCK_WIDTH)};`],
    ["SHOCK_LAG", `u + ${glslNum(FLUID.SHOCK_LAG)};`],
    ["SHOCK_LAG window", `< -${glslNum(FLUID.SHOCK_LAG + 2.4)}`],
    ["SHOCK_RECOIL", `- ${glslNum(FLUID.SHOCK_RECOIL)} * trough`],
    ["SHOCK_IRREG", `+ ${glslNum(FLUID.SHOCK_IRREG)} *`],
    ["CURSOR_RIM", `- ${glslNum(FLUID.CURSOR_RIM)} * back`],
  ];
  for (const [name, needle] of injected)
    check(glsl.includes(needle), `${name} reached the shader from FLUID`, needle);
  check(
    SDF_FORM_SHOCKS === FLUID.SHOCK_SLOTS,
    "the shader reads the same wave slots the droplets do",
    `${SDF_FORM_SHOCKS} vs ${FLUID.SHOCK_SLOTS}`,
  );
}

const browser = await chromium.launch(LAUNCH);

/**
 * Read the liquid from the GL BALL BUFFER, not from pixels.
 *
 * Screenshots cannot measure this. The surface never stops moving, so two
 * captures of the same build differ by ~1% of pixels on their own — the same
 * order as the thing being measured. The uniform upload is exact: intercept
 * `iBalls` / `iBallCount` on their way to the shader and every droplet's
 * position is available per frame, in field uv, with no noise floor at all.
 *
 * Installed as an init script so no source changes are needed. The post chain
 * calls drawArrays several times per frame, hence the timestamp dedupe.
 */
const BALL_PROBE = () => {
  const names = new WeakMap();
  const vals = {};
  const G = WebGL2RenderingContext.prototype;
  const getLoc = G.getUniformLocation;
  G.getUniformLocation = function (program, name) {
    const loc = getLoc.call(this, program, name);
    if (loc) names.set(loc, name);
    return loc;
  };
  for (const fn of [
    "uniform4fv",
    "uniform3fv",
    "uniform1fv",
    "uniform1i",
    "uniform1f",
  ]) {
    const orig = G[fn];
    G[fn] = function (loc, v) {
      const n = loc ? names.get(loc) : undefined;
      if (n) vals[n] = v && v.length !== undefined ? Array.from(v) : v;
      return orig.apply(this, arguments);
    };
  }
  {
    const orig = G.uniform2f;
    G.uniform2f = function (loc, x, y) {
      const n = loc ? names.get(loc) : undefined;
      if (n) vals[n] = [x, y];
      return orig.apply(this, arguments);
    };
  }
  const draw = G.drawArrays;
  window.__ballFrame = null;
  window.__ballLog = null;
  window.__uniforms = vals; // section E reads iFormOff / iFormA / iBallCount
  G.drawArrays = function () {
    const count = vals.iBallCount;
    const balls = vals.iBalls;
    if (typeof count === "number" && balls) {
      const t = performance.now();
      const prev = window.__ballFrame;
      if (!prev || prev.t !== t) {
        const frame = { t, count, balls };
        window.__ballFrame = frame;
        if (window.__ballLog) window.__ballLog.push(frame);
      }
    }
    return draw.apply(this, arguments);
  };
};

/** Record the ball buffer for `ms`, then hand back the frames. */
async function record(page, ms, during) {
  await page.evaluate(() => {
    window.__ballLog = [];
  });
  if (during) await during();
  await page.waitForTimeout(ms);
  const frames = await page.evaluate(() => {
    const out = window.__ballLog || [];
    window.__ballLog = null;
    return out;
  });
  return frames;
}

/**
 * Per-droplet displacement between two frames, by INDEX.
 *
 * The conductor packs the canonical 48 first, in droplet order, then spray,
 * then ambient — so indices 0..47 are stable as long as no droplet crosses the
 * cull threshold mid-window. The caller asserts on a stable count for exactly
 * that reason; a shifted index would read as a teleport.
 */
function displacement(a, b, n = 48) {
  const out = [];
  const lim = Math.min(n, a.count, b.count);
  for (let i = 0; i < lim; i++) {
    out.push(
      Math.hypot(
        b.balls[i * 3] - a.balls[i * 3],
        b.balls[i * 3 + 1] - a.balls[i * 3 + 1],
      ),
    );
  }
  return out;
}

/**
 * Mean per-pixel change between two canvas shots.
 *
 * Section E has to use pixels: a FORM renders from an SDF texture and never
 * enters the ball buffer, so there is nothing else to read it from. What makes
 * that measurable here — where it was not for the droplets — is the gate the
 * section runs under: with iBallCount at 0 the stage holds a form and nothing
 * else, and a resting form's only motion is the slow iWarp wobble, which is far
 * quieter than free liquid.
 */
function pixelDelta(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 255;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4)
    sum +=
      (Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2])) /
      3;
  return sum / (a.width * a.height);
}

/**
 * Share of the canvas the liquid covers.
 *
 * The resting form is never the same twice — liquidWarp is time-driven — so
 * "is it back to the shape it was" cannot be asked by diffing two frames
 * seconds apart; the warp phase alone would answer no. Coverage is nearly
 * invariant to that warp (it displaces the boundary and roughly preserves the
 * area inside it) while a dent that outlived the pointer would move it.
 */
function coverage(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4)
    if (png.data[i + 1] > 60 || png.data[i + 2] > 60) n++;
  return n / (png.width * png.height);
}

/** Lenis owns the scroll; window.scrollTo bypasses it and injects jitter. */
async function wheelTo(page, targetY) {
  for (let guard = 0; guard < 240; guard++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(y - targetY) < 60) break;
    const d = Math.max(-700, Math.min(700, targetY - y));
    await page.mouse.wheel(0, d);
    await page.waitForTimeout(55);
  }
  await page.waitForTimeout(900); // let Lenis and the scene presences settle
}

/**
 * Peak `stats.energy` over a window, sampled on the page's own rAF.
 *
 * Reading it once straight after the click is a race: energy is recomputed
 * inside driver.frame, so whether the read lands before or after the next frame
 * depends on how long the screenshot before it happened to stall. A strike's
 * energy is a decaying envelope, not a level — peak over a window is the only
 * stable thing to assert on.
 */
async function peakEnergy(page, ms) {
  await page.evaluate((win) => {
    window.__peak = 0;
    const t0 = performance.now();
    const tick = () => {
      const e = window.__cine ? window.__cine.stats.energy : 0;
      if (e > window.__peak) window.__peak = e;
      if (performance.now() - t0 < win) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
  await page.waitForTimeout(ms + 80);
  return page.evaluate(() => window.__peak);
}

async function openPage(query, reduced = "no-preference") {
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    reducedMotion: reduced,
  });
  const page = await ctx.newPage();
  await page.addInitScript(BALL_PROBE);
  await page.goto(`${BASE}/en${query}`, { waitUntil: "domcontentloaded" });
  return { ctx, page };
}

// ═══ A · a click reaches the liquid, and the liquid answers ══════════════════
{
  console.log("\nA · the strike reaches the liquid");
  const { ctx, page } = await openPage("?ftier=full&fgov=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  // The Problem: the mark has poured and the liquid is free (bind 0), which is
  // the only place a strike is allowed to do anything at all.
  const target = await page.evaluate(() => {
    const el = document.getElementById("problem");
    return el.offsetTop + window.innerHeight * 0.7;
  });
  await wheelTo(page, target);

  const wired = await page.evaluate(() => ({
    hasPress: window.__flow && "press" in window.__flow,
    balls: !!window.__ballFrame,
  }));
  check(wired.hasPress, "the press input is exposed on the live conductor");
  check(wired.balls, "the ball buffer probe is reading the live field");

  // The click, in field uv — the same mapping PageStage uses, so the assertions
  // below can be about distance FROM THE IMPACT rather than from screen centre.
  const clickVX = VW / 2;
  const clickVY = VH / 2;
  const md = Math.min(VW, VH);
  const kx = 0.5 + (clickVX - VW / 2) / md;
  const ky = 0.5 - (clickVY - VH / 2) / md;

  // Baseline: the ambient curl never stops, so the strike has to beat the
  // field's own motion, not zero.
  const quiet = await record(page, 900);
  const quietStep = [];
  for (let i = 1; i < quiet.length; i++)
    quietStep.push(...displacement(quiet[i - 1], quiet[i]));
  const quietMax = quietStep.length ? Math.max(...quietStep) : 0;
  // Index stability, stated as what it actually requires. The total count is
  // NOT it — pinch-off spray appears and expires on its own schedule, so the
  // count breathes on a perfectly healthy field. What matters is that the
  // canonical 48 are all packed (they come first, so spray and ambient append
  // behind them and shift nothing) and that no index teleports, which is
  // precisely what a shifted slot would look like: a droplet jumping across the
  // field in one frame. quietMax measures that directly.
  const counts = quiet.map((fr) => fr.count);
  const minCount = counts.length ? Math.min(...counts) : 0;
  check(
    quiet.length > 6 && minCount >= 48 && quietMax < 0.01,
    "indices identify droplets — the 48 are packed and none teleports",
    `count ${minCount}–${counts.length ? Math.max(...counts) : "—"} over ${quiet.length} frames, max step ${quietMax.toFixed(4)} uv`,
  );

  const energyBefore = await peakEnergy(page, 300);
  const base = await page.evaluate(() => window.__ballFrame);
  await page.evaluate(() => {
    window.__peakAfter = 0;
    const t0 = performance.now();
    const tick = () => {
      const e = window.__cine ? window.__cine.stats.energy : 0;
      if (e > window.__peakAfter) window.__peakAfter = e;
      if (performance.now() - t0 < 500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const wave = await record(page, 900, () =>
    page.mouse.click(clickVX, clickVY),
  );
  const energyAfter = await page.evaluate(() => window.__peakAfter ?? 0);

  check(
    energyAfter > energyBefore + 0.2,
    "the click raises the governor's energy",
    `peak ${energyBefore.toFixed(2)} idle → ${energyAfter.toFixed(2)} struck`,
  );

  // peak displacement per droplet across the wave, and when each one first moved
  const peak = new Array(48).fill(0);
  const firstMoved = new Array(48).fill(-1);
  const t0 = wave.length ? wave[0].t : 0;
  for (const fr of wave) {
    const d = displacement(base, fr);
    for (let i = 0; i < d.length; i++) {
      if (d[i] > peak[i]) peak[i] = d[i];
      if (firstMoved[i] < 0 && d[i] > quietMax * 2.5 + 0.002)
        firstMoved[i] = fr.t - t0;
    }
  }
  const globalPeak = Math.max(...peak);
  check(
    globalPeak > Math.max(quietMax * 4, 0.012),
    "the liquid answers the click",
    `peak droplet displacement ${globalPeak.toFixed(4)} uv vs ${quietMax.toFixed(4)} ambient step`,
  );

  // Distance from the impact, at rest. A strike is LOCAL and it TRAVELS: near
  // droplets must move more, and must move FIRST.
  const rows = [];
  for (let i = 0; i < Math.min(48, base.count); i++)
    rows.push({
      d: Math.hypot(base.balls[i * 3] - kx, base.balls[i * 3 + 1] - ky),
      peak: peak[i],
      at: firstMoved[i],
    });
  rows.sort((a, b) => a.d - b.d);
  const near = rows.slice(0, 8);
  const far = rows.slice(-8);
  const mean = (xs, k) => xs.reduce((a, r) => a + r[k], 0) / xs.length;
  check(
    mean(near, "peak") > mean(far, "peak") * 1.5,
    "the response is LOCAL to the impact, not a global lurch",
    `nearest 8 moved ${mean(near, "peak").toFixed(4)} uv, farthest 8 ${mean(far, "peak").toFixed(4)}`,
  );

  // Bands by RANK AMONG RESPONDERS, not by absolute distance. The wave dies at
  // SHOCK_REACH, so the farthest droplets on stage legitimately never move —
  // filtering them out of a fixed "farthest 8" leaves a sample of one or two
  // and makes the timing meaningless. Split the liquid the wave actually
  // reached, and ask whether its near half answered before its far half.
  const responded = rows.filter((r) => r.at >= 0);
  const half = Math.max(Math.floor(responded.length / 2), 1);
  const nearAt = responded.slice(0, half);
  const farAt = responded.slice(-half);
  const travel = farAt.length && nearAt.length
    ? mean(farAt, "at") - mean(nearAt, "at")
    : 0;
  check(
    responded.length >= 8 && travel > 30,
    "the front TRAVELS — near liquid answers before far liquid",
    `${responded.length} droplets reached; near half ${nearAt.length ? mean(nearAt, "at").toFixed(0) : "—"}ms, far half ${farAt.length ? mean(farAt, "at").toFixed(0) : "—"}ms`,
  );

  // press: down holds it, up releases it
  await page.mouse.move(clickVX, clickVY);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const pressDown = await page.evaluate(() => window.__flow.press);
  await page.mouse.up();
  await page.waitForTimeout(80);
  const pressUp = await page.evaluate(() => window.__flow.press);
  check(
    pressDown === 1 && pressUp === 0,
    "a held pointer registers as a press and releases",
    `down=${pressDown} up=${pressUp}`,
  );

  // and it SETTLES: the wave must not leave the field permanently agitated
  await page.waitForTimeout(2200);
  const late = await record(page, 900);
  const lateStep = [];
  for (let i = 1; i < late.length; i++)
    lateStep.push(...displacement(late[i - 1], late[i]));
  const lateMax = lateStep.length ? Math.max(...lateStep) : 0;
  check(
    lateMax < Math.max(quietMax * 2, 0.002),
    "the field returns to its ambient motion after the wave",
    `max step ${lateMax.toFixed(4)} uv vs ${quietMax.toFixed(4)} ambient`,
  );

  await ctx.close();
}

// ═══ B · the strike is PASSIVE — it never consumes the gesture ═══════════════
{
  console.log("\nB · the click stays passive");
  const { ctx, page } = await openPage("?ftier=full&fgov=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  await page.waitForTimeout(600);
  // A real control under the pointer must still receive its click. The liquid
  // listens on window with passive listeners and no preventDefault, so this is
  // a construction rather than a convention — but it is the one regression that
  // would be invisible in a screenshot and fatal to the site.
  const clicked = await page.evaluate(async () => {
    const btn = document.querySelector("a[href], button");
    if (!btn) return "no-control";
    let got = false;
    const onClick = (e) => {
      got = true;
      e.preventDefault();
    };
    btn.addEventListener("click", onClick);
    btn.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    btn.removeEventListener("click", onClick);
    return got ? "ok" : "swallowed";
  });
  check(clicked === "ok", "a control under the pointer still gets its click", clicked);

  // text selection must survive a press-drag
  await page.mouse.move(200, 300);
  await page.mouse.down();
  await page.mouse.move(420, 300, { steps: 6 });
  await page.mouse.up();
  const selectionWorks = await page.evaluate(
    () => typeof window.getSelection === "function",
  );
  check(selectionWorks, "press-drag leaves the document interactive");
  await ctx.close();
}

// ═══ C · ?fstrike=0 removes the blow, keeps the hand ════════════════════════
{
  console.log("\nC · the rollback flag");
  const { ctx, page } = await openPage("?ftier=full&fgov=0&fstrike=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  const target = await page.evaluate(() => {
    const el = document.getElementById("problem");
    return el.offsetTop + window.innerHeight * 0.7;
  });
  await wheelTo(page, target);
  const e0 = await peakEnergy(page, 300);
  await page.mouse.move(VW / 2, VH / 2);
  await page.mouse.down();
  const e1 = await peakEnergy(page, 400);
  await page.mouse.up();
  check(
    e1 <= e0 + 0.15,
    "?fstrike=0 leaves the click without physics",
    `peak ${e0.toFixed(2)} idle → ${e1.toFixed(2)} struck`,
  );
  await ctx.close();
}

// ═══ D · reduced motion has none of it ══════════════════════════════════════
{
  console.log("\nD · reduced motion");
  const { ctx, page } = await openPage("?ftier=full", "reduce");
  await page.waitForTimeout(1200);
  await page.mouse.move(VW / 2, VH / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const state = await page.evaluate(() => ({
    press: window.__flow ? window.__flow.press : -1,
    pon: window.__flow ? window.__flow.pon : -1,
    flashes: window.__cine ? window.__cine.stats.flashes : -1,
  }));
  await page.mouse.up();
  check(
    state.press === 0 && state.pon === 0,
    "no strike or press wiring under reduced motion",
    `press=${state.press} pon=${state.pon}`,
  );
  check(state.flashes === 0, "the one-flash gate is still zero", `${state.flashes}`);
  await ctx.close();
}

// ═══ E · the FORMS answer too ═══════════════════════════════════════════════
// The eight owner-traced SVGs render from SDF textures and never entered the
// ball buffer, so no force could reach them: the most prominent liquid on the
// page was the only part of it that ignored a hand. They now answer as a domain
// displacement — see formTouch in the shader.
//
// The measurement runs at Contact, and only on a frame where iBallCount is 0
// with the form at full weight. That gate is what makes the section sound:
// with no droplets anywhere on stage, every pixel that moves is the form.
{
  console.log("\nE · the forms answer");
  const { ctx, page } = await openPage("?ftier=full&fgov=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  const target = await page.evaluate(() => {
    const el = document.getElementById("contact");
    return el.offsetTop + window.innerHeight * 0.4;
  });
  await wheelTo(page, target);
  await page.mouse.move(20, VH - 20);
  await page.waitForTimeout(900);

  const shot = async () => {
    const el = await page.$(".journey-canvas canvas");
    return PNG.sync.read(await el.screenshot());
  };
  const stage = () =>
    page.evaluate(() => ({
      balls: window.__uniforms.iBallCount,
      fa: window.__uniforms.iFormA,
      off: window.__uniforms.iFormOff,
      touch: window.__uniforms.iTouch,
    }));

  const before = await stage();
  check(
    before.balls === 0 && before.fa > 0.99,
    "a pure-form frame: the stage holds a form and no droplets",
    `balls=${before.balls} formA=${(before.fa ?? 0).toFixed(2)}`,
  );

  // where the scene has actually staged the form — not screen centre
  const md = Math.min(VW, VH);
  const fx = (before.off?.[0] ?? 0) * md + VW / 2;
  const fy = VH / 2 - (before.off?.[1] ?? 0) * md;

  const q0 = await shot();
  await page.waitForTimeout(250);
  const q1 = await shot();
  const ambient = pixelDelta(q0, q1);

  await page.mouse.move(fx, fy);
  await page.waitForTimeout(350);
  const hovered = await shot();
  const hover = pixelDelta(q1, hovered);

  await page.mouse.down();
  await page.waitForTimeout(320);
  const pressed = await shot();
  const press = pixelDelta(q1, pressed);
  await page.mouse.up();

  const held = await stage();
  check(
    (held.touch?.[3] ?? 0) > 0,
    "iTouch reaches the shader with a live gain",
    `gain=${(held.touch?.[3] ?? 0).toFixed(4)}`,
  );
  check(
    hover > ambient * 2.5,
    "the form dents under the hand",
    `${hover.toFixed(2)} vs ${ambient.toFixed(2)} ambient warp`,
  );
  check(
    press > hover * 1.2,
    "and deeper under a press",
    `${press.toFixed(2)} vs ${hover.toFixed(2)} hovering`,
  );

  await page.mouse.move(20, VH - 20);
  await page.waitForTimeout(900);
  const s0 = await shot();
  await page.mouse.click(fx, fy);
  await page.waitForTimeout(200);
  const s1 = await shot();
  const strike = pixelDelta(s0, s1);
  check(
    strike > ambient * 2.5,
    "and ripples when the wave crosses it",
    `${strike.toFixed(2)} vs ${ambient.toFixed(2)} ambient warp`,
  );

  // The release. Moving the pointer aside is NOT a release — the hand is still
  // on the page, so a live hover gain there is correct. The real exit is the
  // pointer leaving the document, which is the path that has to return the form
  // to rest; assert that one, or the dent could outlive the visitor.
  await page.waitForTimeout(2400);
  await page.evaluate(() =>
    document.documentElement.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: false }),
    ),
  );
  await page.waitForTimeout(500);
  const r0 = await shot();
  await page.waitForTimeout(250);
  const r1 = await shot();
  const residual = pixelDelta(r0, r1);
  const after = await stage();
  check(
    (after.touch?.[3] ?? 1) === 0,
    "the pointer leaving the document releases iTouch",
    `gain=${after.touch?.[3]}`,
  );
  check(
    residual < Math.max(ambient * 2, 0.4),
    "the form returns to its resting warp",
    `${residual.toFixed(2)} vs ${ambient.toFixed(2)} ambient`,
  );
  const restCover = coverage(q1);
  const pressCover = coverage(pressed);
  const settledCover = coverage(r1);
  check(
    Math.abs(pressCover - restCover) > restCover * 0.01,
    "the press actually moves the form's boundary",
    `coverage ${(restCover * 100).toFixed(2)}% → ${(pressCover * 100).toFixed(2)}%`,
  );
  check(
    Math.abs(settledCover - restCover) < restCover * 0.01,
    "and the form recovers its area — no dent outlives the pointer",
    `coverage ${(restCover * 100).toFixed(2)}% → ${(settledCover * 100).toFixed(2)}%`,
  );
  await ctx.close();
}

// ═══ F · ?fformtouch=0 leaves the forms alone ═══════════════════════════════
{
  console.log("\nF · the form rollback");
  const { ctx, page } = await openPage("?ftier=full&fgov=0&fformtouch=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  const linked = await page.evaluate(
    () => window.__uniforms && window.__uniforms.iTouch,
  );
  check(
    linked === undefined,
    "?fformtouch=0 links a shader with no iTouch at all",
    linked === undefined ? undefined : `iTouch present: ${linked}`,
  );
  // … and the droplets still answer, because this flag is not the strike's
  const target = await page.evaluate(() => {
    const el = document.getElementById("problem");
    return el.offsetTop + window.innerHeight * 0.7;
  });
  await wheelTo(page, target);
  const base = await page.evaluate(() => window.__ballFrame);
  await page.mouse.click(VW / 2, VH / 2);
  const wave = await record(page, 700);
  let moved = 0;
  for (const fr of wave)
    for (const d of displacement(base, fr)) if (d > moved) moved = d;
  check(
    moved > 0.01,
    "?fformtouch=0 leaves droplet physics untouched",
    `peak droplet displacement ${moved.toFixed(4)} uv`,
  );
  await ctx.close();
}

// ═══ G · NO DEAD BAND through a morph ═══════════════════════════════════════
// The regression this section exists for: mid-morph the stage is nothing but
// BOUND droplets (bind = 1, the §3.3 melt state), where every environmental
// force is switched off by contract — so the liquid went completely dead to the
// hand exactly when it was most alive to look at. Bound droplets now take the
// form's render displacement, and this walks the whole Services morph to prove
// there is no scroll position left where a click does nothing.
//
// Measured on the ball buffer, not pixels: through a scroll-driven morph the
// COMPOSITION is moving, so a pixel baseline is swamped by the choreography
// itself. Steps that stage no droplets at all are the form's case, and section
// E measures that where the stage is genuinely still.
{
  console.log("\nG · no dead band through the morph");
  const { ctx, page } = await openPage("?ftier=full&fgov=0");
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    { timeout: 40000 },
  );
  const sec = await page.evaluate(() => {
    const el = document.getElementById("services");
    return { top: el.offsetTop, h: el.offsetHeight };
  });

  let steps = 0;
  let withDroplets = 0;
  let inert = 0;
  let weakest = Infinity;
  let weakestAt = 0;
  for (let k = 0; k <= 10; k++) {
    await wheelTo(page, sec.top - VH * 0.2 + (sec.h * k) / 10);
    // let the scroll body force die, or IT would be the thing that moved them
    await page.waitForTimeout(700);
    const base = await page.evaluate(() => window.__ballFrame);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    steps++;
    if (!base || base.count === 0) continue;
    withDroplets++;
    await page.mouse.click(VW / 2, VH / 2);
    const wave = await record(page, 600);
    let peak = 0;
    for (const fr of wave)
      for (const d of displacement(base, fr)) if (d > peak) peak = d;
    if (peak < weakest) {
      weakest = peak;
      weakestAt = y;
    }
    if (peak < 0.006) inert++;
  }
  check(
    withDroplets >= 6,
    "the walk actually crossed the morph",
    `${withDroplets} of ${steps} steps staged droplets`,
  );
  check(
    inert === 0,
    "every step with liquid on stage answers a click",
    `${inert} inert of ${withDroplets}; weakest ${weakest.toFixed(4)} uv at scrollY ${weakestAt}`,
  );
  await ctx.close();
}

await browser.close();
console.log(
  `\nSTRIKE_CHECK ${JSON.stringify({ viewport: `${VW}x${VH}`, failures })}`,
);
if (failures) {
  console.log("strike gate FAILED");
  process.exit(1);
}
console.log("strike gate holds");
