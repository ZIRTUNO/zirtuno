// verify-devices (R5-E) — the emulated device matrix. What a machine CAN
// assert about the §12 tier/viewport contract without physical hardware:
//
//   iPhone-class   390×844 dpr3, touch, hover:none — loads live, sticky
//                  stage = visible viewport, no horizontal overflow, the
//                  no-hover input paths hold, liquid alive after a full
//                  touch-style traversal, "none" tier keeps the whole story
//   Android-class  412×915 dpr2.6, touch, ?ftier=lite — the lite tier MUST
//                  be LIVE (flat cyan branch drawing, never a still)
//   Desktop        1440×900 — full → full-nofx rung keeps drawing glass
//
// TRUE-device behavior (iOS URL-bar collapse, real GPU probes, thermal
// throttling) still needs the owner's hardware — this harness is the
// regression floor under it, not a replacement. Dev server must run:
//   node scripts/verify-devices.mjs

import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;
const check = (ok, label, detail) => {
  console.log(
    `${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

const browser = await chromium.launch(LAUNCH);

const motionDelta = async (page, waitMs = 1200) => {
  // Compare the renderer itself. A full-page screenshot can report motion from
  // DOM reveals/caret/chrome even when the canvas is static (or the inverse
  // after an unrelated typography change).
  const canvas = page.locator(".journey-canvas canvas");
  const s1 = await canvas.screenshot({ type: "png" });
  await page.waitForTimeout(waitMs);
  const s2 = await canvas.screenshot({ type: "png" });
  const p1 = PNG.sync.read(s1);
  const p2 = PNG.sync.read(s2);
  let d = 0;
  for (let i = 0; i < p1.data.length; i += 16)
    d += Math.abs(p1.data[i] - p2.data[i]);
  return d;
};

const newPage = async (opts) => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return { ctx, page, errors };
};

// ═══ 1 · iPhone-class — live path ═════════════════════════════════════════════
{
  console.log("1 · iPhone-class (390×844 dpr3, touch, hover:none)");
  const { ctx, page, errors } = await newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 40000,
  });
  await page.waitForTimeout(5000);

  const env = await page.evaluate(() => {
    // the layout viewport (== every CSS viewport unit) is the contract here;
    // window.innerHeight drifts in mobile EMULATION and under the real iOS
    // bar collapse — that dynamic belongs to the owner's device checklist
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;height:100svh;width:0;";
    document.body.appendChild(probe);
    const svh = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      hoverFine: matchMedia("(hover: hover) and (pointer: fine)").matches,
      canvases: document.querySelectorAll(".journey-canvas canvas").length,
      live: document.querySelector(".liquid-journey")?.dataset.liquid,
      stageH: document.querySelector(".journey-layer")?.getBoundingClientRect()
        .height,
      svh,
      clientH: document.documentElement.clientHeight,
      overflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  check(env.hoverFine === false, "hover:none media path active");
  check(
    env.live === "live" && env.canvases === 1,
    "one live liquid canvas",
    JSON.stringify(env),
  );
  check(
    Math.abs(env.stageH - env.svh) <= 2 && Math.abs(env.svh - env.clientH) <= 2,
    "sticky stage tracks 100svh == the layout viewport",
    `stage=${env.stageH} svh=${env.svh} client=${env.clientH}`,
  );
  check(env.overflowX <= 1, "no horizontal overflow", `${env.overflowX}px`);

  // full traversal — the narrow-stage compositions and handoffs all run
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight,
  );
  for (let i = 1; i <= 12; i++) {
    await page.evaluate(
      (y) => window.scrollTo(0, y),
      Math.round((max * i) / 12),
    );
    await page.waitForTimeout(700);
  }
  const pointer = await page.evaluate(() => ({
    heroCursorOn: window.__scenes?.site?.heroCursorOn,
    workHov: window.__scenes?.work?.hov,
  }));
  check(
    pointer.heroCursorOn === 0 && pointer.workHov === -1,
    "no-hover paths never armed by touch traversal",
    JSON.stringify(pointer),
  );
  await page.evaluate(() => {
    const el = document.querySelector("#work");
    const r = el.getBoundingClientRect();
    window.scrollTo(0, r.top + scrollY + r.height * 0.45 - innerHeight * 0.5);
  });
  await page.waitForTimeout(1200);
  const alive = await motionDelta(page);
  check(
    alive > 300,
    "liquid alive on the narrow stage (work current)",
    `canvas delta=${alive}`,
  );
  check(errors.length === 0, "zero errors on the mobile live path", errors[0]);
  await ctx.close();
}

// ═══ 2 · iPhone-class — "none" tier keeps the whole story ════════════════════
{
  console.log("2 · iPhone-class — ?ftier=none (static path)");
  const { ctx, page, errors } = await newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${BASE}/en?ftier=none`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 40000,
  });
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => ({
    live: document.querySelector(".liquid-journey")?.dataset.liquid,
    canvases: document.querySelectorAll(".journey-canvas canvas").length,
    sections: [
      "hero",
      "problem",
      "ecosystem",
      "services",
      "method",
      "work",
      "name",
      "studio",
      "contact",
    ]
      .filter((id) => !document.getElementById(id))
      .join(","),
    cta: !!document.querySelector('#contact button[type="submit"]'),
  }));
  check(
    s.live === "static" && s.canvases === 0,
    "static path: no canvas",
    JSON.stringify(s),
  );
  check(
    s.sections === "",
    "all nine chapters present without WebGL",
    s.sections,
  );
  check(s.cta, "the labeled contact submit is reachable");
  check(errors.length === 0, "zero errors on the static path", errors[0]);
  await ctx.close();
}

// ═══ 3 · Android-class — the lite tier MUST be live ══════════════════════════
{
  console.log("3 · Android-class (412×915 dpr2.6) — ?ftier=lite");
  const { ctx, page, errors } = await newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.6,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  });
  await page.goto(`${BASE}/en?ftier=lite&fgov=0&fshape=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => !!document.querySelector(".journey-canvas canvas"),
    {
      timeout: 40000,
    },
  );
  await page.waitForTimeout(4000);
  const o = await page.evaluate(() => ({
    tier: window.__optics?.tier,
    post: window.__optics?.post,
    frames: window.__optics?.frames,
    shapeRequested: window.__optics?.shapeRequested,
    shapeShader: window.__optics?.shapeShader,
    shape: window.__optics?.shape,
  }));
  // A probe-"lite" machine now enters at `rigid`, NOT at the flat branch: no
  // post chain and no deformation (the two costs it cannot afford), but the
  // liquid-glass MATERIAL intact at dpr 1. The probe measures a mid-range GPU,
  // and mid-range GPUs shade this material comfortably at dpr 1 — starting them
  // flat surrendered the site's core visual on a guess taken during page load.
  check(
    o.tier === "rigid" && o.post === 0,
    "probe-lite enters at `rigid` — cheap, but still glass",
    JSON.stringify(o),
  );
  check(
    o.shapeRequested === 1 && o.shapeShader === 0 && o.shape === 0,
    "…and keeps the original shader budget even when fshape is requested",
    `${o.shapeRequested}/${o.shapeShader}/${o.shape}`,
  );
  await page.waitForTimeout(1000);
  const o2 = await page.evaluate(() => window.__optics?.frames);
  check(
    o2 > o.frames,
    "lite is LIVE (draws advancing — never a still)",
    `${o.frames} → ${o2}`,
  );
  // Mid-page too: sample Work's authored CURRENT rather than Ecosystem's
  // resolved centre. The latter intentionally settles to an exact form and is
  // therefore a valid zero-delta reading even while the live loop advances.
  let alive = 0;
  for (const fraction of [0.25, 0.45, 0.65, 0.8]) {
    await page.evaluate((f) => {
      const el = document.querySelector("#work");
      const r = el.getBoundingClientRect();
      window.scrollTo(0, r.top + scrollY + r.height * f - innerHeight * 0.5);
    }, fraction);
    await page.waitForTimeout(650);
    alive = Math.max(alive, await motionDelta(page, 700));
    if (alive > 300) break;
  }
  check(
    alive > 300,
    "lite liquid visibly moving in the Work current",
    `canvas delta=${alive}`,
  );
  check(errors.length === 0, "zero errors on the lite path", errors[0]);
  await ctx.close();
}

// ═══ 4 · Desktop — the full-nofx rung completes the matrix ═══════════════════
{
  console.log("4 · Desktop (1440×900) — full → full-nofx rung");
  const { ctx, page, errors } = await newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__optics?.post === 1, {
    timeout: 40000,
  });
  await page.evaluate(() => window.__optics.demote());
  await page.waitForTimeout(800);
  const o = await page.evaluate(() => ({
    tier: window.__optics?.tier,
    post: window.__optics?.post,
    frames: window.__optics?.frames,
    physics: document.querySelector(".liquid-journey")?.dataset.fluidPhysics,
    obstacles:
      document.querySelector(".liquid-journey")?.dataset.fluidObstacles,
  }));
  check(
    o.tier === "fullnofx" && o.post === 0,
    "demote sheds the post chain first",
    JSON.stringify(o),
  );
  // v3 forces and typography-aware flow SHIPPED as defaults (R5-B); `?fphysv3=0`
  // and `?fobstacles=0` are now the rollbacks. This assertion tracked the old
  // opt-in contract and was left behind by that promotion.
  check(
    o.physics === "v3" && o.obstacles === "true",
    "default physics diagnostics report the shipped v3 + flow path",
    `${o.physics}/${o.obstacles}`,
  );
  await page.waitForTimeout(1000);
  const f2 = await page.evaluate(() => window.__optics?.frames);
  check(f2 > o.frames, "full-nofx keeps drawing", `${o.frames} → ${f2}`);
  check(errors.length === 0, "zero errors across the rung", errors[0]);
  await ctx.close();
}

// ═══ 5 · Desktop — approved review flags hydrate before the canvas ══════════
{
  console.log(
    "5 · Desktop — Physics v3 + obstacle + velocity-shape review path",
  );
  const { ctx, page, errors } = await newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    `${BASE}/en?ftier=full&fgov=0&fphysv3=1&fobstacles=1&fshape=1`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".liquid-journey")?.dataset.fluidPhysics ===
        "v3" && window.__optics?.shapeRequested === 1,
    { timeout: 40000 },
  );
  const exactShape = await page.evaluate(() => window.__optics?.shape);
  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight,
  );
  let freeShape = false;
  for (const fraction of [0.06, 0.12, 0.18, 0.45, 0.55]) {
    await page.evaluate(
      (y) => scrollTo(0, y),
      Math.round(maxScroll * fraction),
    );
    await page.waitForTimeout(500);
    if ((await page.evaluate(() => window.__optics?.shape)) === 1) {
      freeShape = true;
      break;
    }
  }
  const review = await page.evaluate(() => {
    const journey = document.querySelector(".liquid-journey");
    return {
      physics: journey?.dataset.fluidPhysics,
      obstacles: journey?.dataset.fluidObstacles,
      shapeRequested: window.__optics?.shapeRequested,
      shapeShader: window.__optics?.shapeShader,
      canvases: document.querySelectorAll(".journey-canvas canvas").length,
    };
  });
  check(
    review.physics === "v3" && review.obstacles === "true",
    "review physics and cached obstacle flow are active",
    JSON.stringify(review),
  );
  check(
    review.shapeRequested === 1 &&
      review.shapeShader === 1 &&
      exactShape === 0 &&
      freeShape,
    "shape shader preserves the exact mark and activates only on free liquid",
  );
  check(
    review.canvases === 1,
    "review path still owns exactly one liquid canvas",
  );
  check(
    errors.length === 0,
    "zero errors on the combined review path",
    errors[0],
  );
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0
    ? "DEVICES: matrix green"
    : `DEVICE MATRIX FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
