// verify-cinematics (R5-D) — the machine teeth behind the cinematic cut:
//
//   1. NO FLASH    no Origin flash surface or score channel exists
//   2. ACT FADES   exactly two veil bands (Método→Work, Origin→Studio),
//                  peaks within (0.2, 0.41], fully released at reading rests
//   3. NO DEAD ZONES  the canvas is alive (non-black, moving) over Work,
//                  Studio and the Footer coda — rule §4.2's machine check
//   4. MENISCUS    hovering a project card drives the work scene's channels
//   5. REDUCED MOTION  no veils, static liquid path
//   6. ?fcine=0    no veils, permanently neutral score
//   7. CONTRAST    standing reads keep veil ≈ 0; under the transient peak
//                  every visible text node still clears 3.5:1 against ink
//
// Dev server must be running:  node scripts/verify-cinematics.mjs

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "captures", "cinematics");
const VW = 1280;
const VH = 800;

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function sampleAt(page, y, settleMs = 550) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(settleMs);
  return page.evaluate(() => {
    // The score vars are written on the layer that CONSUMES them (.cine-veils)
    // rather than on the page-wide .liquid-journey wrapper: a custom property
    // set on an ancestor invalidates style for everything beneath it, and
    // these move every frame. .liquid-journey stays as the fallback so this
    // gate still reads a pre-scoping build.
    const wrap =
      document.querySelector(".cine-veils") ??
      document.querySelector(".liquid-journey");
    const num = (v) => {
      const s = wrap ? getComputedStyle(wrap).getPropertyValue(v).trim() : "";
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      y: window.scrollY,
      veil: num("--cine-veil"),
      vig: num("--cine-vig"),
    };
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch(LAUNCH);

// ═══ A · the live cinematic path ═════════════════════════════════════════════
{
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  // EXTRA_QS appends rollback flags to section A, so a failure here can be
  // attributed: rerun with EXTRA_QS="fmotes=1&ftemper=0&ftile=0" and a result
  // that does not move is a pre-existing one, not a liquid regression.
  await page.goto(
    `${BASE}/en?ftier=full&fgov=0${process.env.EXTRA_QS ? "&" + process.env.EXTRA_QS : ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector(".journey-canvas canvas"), {
    timeout: 40000,
  });
  await page.addStyleTag({ content: ".breath-layer{display:none !important}" });
  await page.waitForTimeout(5500); // entry veil + SDF builds

  console.log("A · live cinematic path");
  check(
    (await page.locator(".cine-veils").count()) === 1,
    "veil layer mounts exactly once on the live path",
  );
  check(
    (await page.locator(".cine-flash").count()) === 0,
    "the removed Origin flash surface is absent",
  );
  check(
    await page.evaluate(
      () => !!window.__cine && !("flash" in window.__cine.score),
    ),
    "the removed Origin flash score channel is absent",
  );

  const A = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: r.height };
    };
    return {
      work: box("#work"),
      studio: box("#studio"),
      origin: box("#name .origin-journey"),
      method: box("#method .method-journey"),
      max: document.documentElement.scrollHeight - window.innerHeight,
      vh: window.innerHeight,
    };
  });
  check(!!(A.work && A.studio && A.origin && A.method), "anchors measurable");

  // ── full traversal: dense samples tracking the two veil bands ─────────────
  const samples = [];
  const STEPS = 46;
  for (let i = 0; i <= STEPS; i++) {
    samples.push(await sampleAt(page, Math.round((A.max * i) / STEPS), 420));
  }
  // ── the two act fades ───────────────────────────────────────────────────────
  const peak = Math.max(...samples.map((s) => s.veil));
  check(peak > 0.2 && peak <= 0.41, "act-fade peak within (0.2, 0.41]", `peak=${peak.toFixed(3)}`);
  // veil bands: contiguous sample groups above the visibility floor
  const bands = [];
  let cur = null;
  for (const s of samples) {
    if (s.veil > 0.12) {
      if (!cur) bands.push((cur = { from: s.y, to: s.y, max: s.veil }));
      cur.to = s.y;
      cur.max = Math.max(cur.max, s.veil);
    } else cur = null;
  }
  check(bands.length === 2, "exactly two act-fade bands", `found ${bands.length}`);
  if (bands.length === 2) {
    const nearSeam = (band, seamTop) =>
      band.from < seamTop + A.vh * 1.6 && band.to > seamTop - A.vh * 1.6;
    check(nearSeam(bands[0], A.work.top), "fade 1 sits on the Método → Work seam");
    check(nearSeam(bands[1], A.studio.top), "fade 2 sits on the Origin → Studio seam");
  }
  // reading rests: veil fully released where copy is read
  const rests = [
    ["hero", 0],
    ["mid-method", A.method.top + A.method.h * 0.5 - A.vh * 0.5],
    ["mid-work grid", A.work.top + A.work.h * 0.55 - A.vh * 0.4],
    ["mid-studio", A.studio.top + A.studio.h * 0.55 - A.vh * 0.4],
  ];
  for (const [label, y] of rests) {
    const s = await sampleAt(page, Math.max(0, Math.round(y)), 650);
    check(s.veil < 0.05, `veil released at ${label}`, `veil=${s.veil.toFixed(3)}`);
  }
  const vigMax = Math.max(...samples.map((s) => s.vig));
  check(vigMax <= 0.3, "vignette stays a whisper (≤ 0.3)", `max=${vigMax.toFixed(3)}`);

  // ── no dead zones: the canvas is alive over Work / Studio / Footer ─────────
  for (const [label, y] of [
    ["work", A.work.top + A.work.h * 0.45 - A.vh * 0.5],
    ["studio", A.studio.top + A.studio.h * 0.45 - A.vh * 0.5],
    // the release is sampled MID-FLIGHT (p ≈ 0.7): at the absolute bottom it
    // has completed — the droplet has left and the coda rests calm black,
    // which is the intended end state, not a dead zone
    ["footer release", A.max - A.vh * 0.22],
  ]) {
    await sampleAt(page, Math.max(0, Math.round(y)), 900);
    // alive = VISIBLY MOVING liquid: two lossless captures 1.2 s apart. All
    // DOM here is settled and static (breath layer hidden), so any pixel
    // drift is the liquid itself — a dead black band scores exactly zero.
    const shot1 = await page.screenshot({ type: "png" });
    await page.waitForTimeout(1200);
    const shot2 = await page.screenshot({ type: "png" });
    const p1 = PNG.sync.read(shot1);
    const p2 = PNG.sync.read(shot2);
    let delta = 0;
    // Brand cyan carries almost no red (#00E3FE). The old red-only probe made
    // clean cyan motion numerically invisible and happened to pass only while
    // the glass stack injected white highlights. Measure the rendered colour,
    // not one channel, so this remains a liquid-motion gate rather than an
    // accidental gloss-presence gate.
    for (let i = 0; i < p1.data.length; i += 16) {
      delta += Math.abs(p1.data[i] - p2.data[i]);
      delta += Math.abs(p1.data[i + 1] - p2.data[i + 1]);
      delta += Math.abs(p1.data[i + 2] - p2.data[i + 2]);
    }
    check(delta > 500, `liquid alive over ${label}`, `delta=${delta}`);
    fs.writeFileSync(
      path.join(OUT_DIR, `alive-${label.replace(/\s+/g, "-")}.png`),
      shot1,
    );
  }

  // ── the meniscus wiring ─────────────────────────────────────────────────────
  // The empty-portfolio state (zero mounted cards) is a DESIGNED content
  // state, not a cinematic defect — the current swims regardless (asserted
  // above). The hover drill only runs when cards exist to hover.
  await sampleAt(page, Math.round(A.work.top + A.work.h * 0.35 - A.vh * 0.45), 800);
  const hadCard = (await page.locator("#work .zw-card").count()) > 0;
  if (hadCard) {
    await page.locator("#work .zw-card").first().hover();
    await page.waitForTimeout(400);
    const hov = await page.evaluate(() => ({
      hov: window.__scenes?.work?.hov,
      mOn: window.__scenes?.work?.mOn,
    }));
    check(hov.hov === 0 && hov.mOn === 1, "meniscus docks on card hover", JSON.stringify(hov));
    await page.mouse.move(VW / 2, 10);
    await page.waitForTimeout(400);
    const off = await page.evaluate(() => window.__scenes?.work?.hov);
    check(off === -1, "meniscus releases on unhover", `hov=${off}`);
  } else {
    console.log("  – skip meniscus hover drill: empty-portfolio state (no cards mounted)");
  }

  // ── contrast under the transient peak ──────────────────────────────────────
  // Standing reads are veil-free (asserted above), so static AA is untouched.
  // At the measured peak, every visible text node must still clear 3.5:1
  // against ink — the documented transient floor (body copy clears 6:1).
  let peakY = samples[0].y;
  for (const s of samples) if (s.veil === peak) peakY = s.y;
  await sampleAt(page, peakY, 650);
  const worst = await page.evaluate(() => {
    const wrap =
      document.querySelector(".cine-veils") ??
      document.querySelector(".liquid-journey");
    const veil =
      parseFloat(getComputedStyle(wrap).getPropertyValue("--cine-veil")) || 0;
    const lumaOf = (rgb) => {
      const m = rgb.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      const a = m.length > 3 ? m[3] : 1;
      const ch = (v) => {
        const s = (v / 255) * a; // over ink: alpha premultiplies toward black
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(m[0]) + 0.7152 * ch(m[1]) + 0.0722 * ch(m[2]);
    };
    let min = Infinity;
    let at = "";
    for (const el of document.querySelectorAll("h1,h2,h3,p,li,a,span,button,label")) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 2) continue;
      if (!el.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
      const L = lumaOf(cs.color) * (1 - veil);
      const ratio = (L + 0.05) / 0.05; // against ink under the veil
      if (ratio < min) {
        min = ratio;
        at = `${el.tagName}.${el.className}`.slice(0, 60);
      }
    }
    return { min, at, veil };
  });
  check(
    worst.min >= 3.5,
    "every visible text node clears 3.5:1 under the transient peak",
    `worst=${worst.min.toFixed(2)} at ${worst.at} (veil=${worst.veil})`,
  );

  await ctx.close();
}

// ═══ B · reduced motion — the cut simply does not exist ══════════════════════
{
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.waitForTimeout(2500);
  console.log("B · reduced motion");
  check(
    (await page.locator(".cine-veils").count()) === 0,
    "no veil layer under reduced motion",
  );
  check(
    (await page.locator('.liquid-journey[data-liquid="static"]').count()) === 1,
    "liquid takes the static path",
  );
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  for (let i = 1; i <= 6; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((max * i) / 6));
    await page.waitForTimeout(250);
  }
  await ctx.close();
}

// ═══ C · ?fcine=0 — the escape hatch ═════════════════════════════════════════
{
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?ftier=full&fcine=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector(".journey-canvas canvas"), {
    timeout: 40000,
  });
  await page.waitForTimeout(4000);
  console.log("C · ?fcine=0");
  check((await page.locator(".cine-veils").count()) === 0, "no veil layer with fcine=0");
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  let anyScore = false;
  for (let i = 1; i <= 10; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((max * i) / 10));
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => {
      const sc = window.__cine?.score;
      return sc
        ? sc.veil !== 0 || sc.vignette !== 0 || sc.exposure !== 1 || sc.key !== 0
        : null;
    });
    if (s) anyScore = true;
  }
  check(!anyScore, "score stays neutral across the whole journey");
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0 ? "CINEMATICS: all checks green" : `CINEMATICS FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
