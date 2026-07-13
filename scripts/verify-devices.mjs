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
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(LAUNCH);

const motionDelta = async (page, waitMs = 1200) => {
  const s1 = await page.screenshot({ type: "png" });
  await page.waitForTimeout(waitMs);
  const s2 = await page.screenshot({ type: "png" });
  const p1 = PNG.sync.read(s1);
  const p2 = PNG.sync.read(s2);
  let d = 0;
  for (let i = 0; i < p1.data.length; i += 16) d += Math.abs(p1.data[i] - p2.data[i]);
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
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
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
      stageH: document.querySelector(".journey-layer")?.getBoundingClientRect().height,
      svh,
      clientH: document.documentElement.clientHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check(env.hoverFine === false, "hover:none media path active");
  check(env.live === "live" && env.canvases === 1, "one live liquid canvas", JSON.stringify(env));
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
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((max * i) / 12));
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
  check(alive > 300, "liquid alive on the narrow stage (work current)", `delta=${alive}`);
  check(errors.length === 0, "zero errors on the mobile live path", errors[0]);
  await ctx.close();
}

// ═══ 2 · iPhone-class — "none" tier keeps the whole story ════════════════════
{
  console.log('2 · iPhone-class — ?ftier=none (static path)');
  const { ctx, page, errors } = await newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${BASE}/en?ftier=none`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => ({
    live: document.querySelector(".liquid-journey")?.dataset.liquid,
    canvases: document.querySelectorAll(".journey-canvas canvas").length,
    sections: [
      "hero", "problem", "ecosystem", "services", "method",
      "work", "name", "studio", "contact",
    ].filter((id) => !document.getElementById(id)).join(","),
    cta: !!document.querySelector('#contact button[type="submit"]'),
  }));
  check(s.live === "static" && s.canvases === 0, "static path: no canvas", JSON.stringify(s));
  check(s.sections === "", "all nine chapters present without WebGL", s.sections);
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
  await page.goto(`${BASE}/en?ftier=lite&fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector(".journey-canvas canvas"), {
    timeout: 40000,
  });
  await page.waitForTimeout(4000);
  const o = await page.evaluate(() => ({
    tier: window.__optics?.tier,
    post: window.__optics?.post,
    frames: window.__optics?.frames,
  }));
  check(o.tier === "lite" && o.post === 0, "lite tier active, post chain off", JSON.stringify(o));
  await page.waitForTimeout(1000);
  const o2 = await page.evaluate(() => window.__optics?.frames);
  check(o2 > o.frames, "lite is LIVE (draws advancing — never a still)", `${o.frames} → ${o2}`);
  // mid-page too: the choreography itself runs on the flat branch
  await page.evaluate(() => {
    const el = document.querySelector("[data-organism]");
    const r = el.getBoundingClientRect();
    window.scrollTo(0, r.top + scrollY + r.height * 0.5 - innerHeight * 0.5);
  });
  await page.waitForTimeout(1500);
  const alive = await motionDelta(page);
  check(alive > 300, "lite liquid visibly moving mid-choreography", `delta=${alive}`);
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
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__optics?.post === 1, { timeout: 40000 });
  await page.evaluate(() => window.__optics.demote());
  await page.waitForTimeout(800);
  const o = await page.evaluate(() => ({
    tier: window.__optics?.tier,
    post: window.__optics?.post,
    frames: window.__optics?.frames,
  }));
  check(o.tier === "fullnofx" && o.post === 0, "demote sheds the post chain first", JSON.stringify(o));
  await page.waitForTimeout(1000);
  const f2 = await page.evaluate(() => window.__optics?.frames);
  check(f2 > o.frames, "full-nofx keeps drawing", `${o.frames} → ${f2}`);
  check(errors.length === 0, "zero errors across the rung", errors[0]);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "DEVICES: matrix green" : `DEVICE MATRIX FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
