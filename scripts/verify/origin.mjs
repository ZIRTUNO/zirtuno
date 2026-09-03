// verify-origin (R7) — the machine teeth behind THE CONVERGENCE, in a real
// browser against a running server:
//
//   1. THE MIST EXISTS   the one liquid canvas carries the vapour: a float
//                        state texture, a population, and it STEPS while the
//                        chapter is on screen and only then
//   2. IT IS ALIVE       at every beat the stage paints vapour (cyan above the
//                        type band), and it moves between two captures
//   3. IT SPELLS         the name's glyphs are sampled and uploaded, and at the
//                        resolution the wordmark's box is lit by vapour BEFORE
//                        the type has faded in, and dark beside it
//   4. THE DIRECTOR      the copy is choreographed on the same clock: the two
//                        names are split into letters, the mask's numbers are
//                        driven, each beat's block is open while its band is
//                        pinned and closed before the next arrives, and the
//                        split keeps the accessible name
//   5. ?fmist=0          no vapour, chapter intact — the rollback
//   6. REDUCED MOTION    no director, no split, every block open
//   7. ONE CANVAS        still exactly one liquid canvas
//
// Dev server must be running:  node scripts/verify/origin.mjs

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "../support/launch.mjs";
import { ORIGIN_BEATS, ORIGIN_ARC } from "../../lib/webgl/origin-score.mjs";

const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "captures", "origin-verify");
const VW = 1440;
const VH = 900;

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

/** Wait until the vapour has run `ms` of ITS time (MIST.H_MS per substep),
 *  whatever the renderer's frame rate; capped at 25 s of wall clock. */
async function simSettle(page, ms) {
  const need = await page.evaluate((m) => (window.__optics?.mistSim ?? 0) + m / 8, ms);
  await page
    .waitForFunction((n) => (window.__optics?.mistSim ?? 0) >= n, need, { timeout: 25000 })
    .catch(() => {});
}

/** Scroll the runway to fraction f of its p and settle. */
async function goP(page, f, settle = 1400) {
  await page.evaluate(async (frac) => {
    const wr = document.querySelector("#name .origin-journey");
    const top = wr.getBoundingClientRect().top + window.scrollY;
    const t = Math.round(top + (wr.offsetHeight - window.innerHeight) * frac);
    for (let i = 0; i < 30; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 100));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, f);
  await page.waitForTimeout(settle);
}

/** Mean brightness (0..255) of a rect of a PNG, sampled every 2nd pixel. */
function meanLuma(png, x0, y0, x1, y1) {
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, y0 | 0); y < Math.min(png.height, y1 | 0); y += 2)
    for (let x = Math.max(0, x0 | 0); x < Math.min(png.width, x1 | 0); x += 2) {
      const i = (y * png.width + x) * 4;
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  return n ? sum / n : 0;
}
const shot = async (page) => PNG.sync.read(await page.screenshot({ type: "png" }));

// ═══ A · the live path ══════════════════════════════════════════════════════
{
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__optics && !!window.__scenes, { timeout: 40000 });
  await page.addStyleTag({ content: ".breath-layer{display:none !important}" });
  await page.waitForTimeout(4500);

  console.log("A · the live path");
  const optics0 = await page.evaluate(() => ({
    pop: window.__optics.mistPop,
    fmt: window.__optics.mistFmt,
    mist: window.__optics.mist,
    liquid: document.querySelectorAll(".journey-canvas canvas").length,
    spellN: window.__originSpell,
  }));
  check(optics0.pop > 0, "the vapour has a population", `pop=${optics0.pop} fmt=${optics0.fmt}`);
  check(optics0.fmt !== "none", "a renderable float state texture", `fmt=${optics0.fmt}`);
  check(optics0.mist === 0, "the vapour does not step over the hero", `mist=${optics0.mist}`);
  check(optics0.liquid === 1, "one liquid canvas", `${optics0.liquid}`);
  check(optics0.spellN > 100, "the name's glyphs are sampled", `samples=${optics0.spellN}`);

  // the entrance: the boil-off across the chapter's opening
  await page.evaluate(async () => {
    const sec = document.querySelector("#name");
    const t = Math.round(sec.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.1);
    for (let i = 0; i < 30; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 100));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  });
  await page.waitForTimeout(1600);
  const entry = await page.evaluate(() => ({
    lead: window.__scenes.origin.lead,
    on: window.__scenes.origin.on,
    mist: window.__optics.mist,
    steps: window.__optics.mistSteps,
    spell: window.__optics.spell,
  }));
  check(entry.lead > 0.2 && entry.lead < 1, "the approach is measured before p starts", `lead=${entry.lead?.toFixed(2)}`);
  check(entry.mist === 1, "the vapour steps as the liquid boils off", `mist=${entry.mist} steps=${entry.steps}`);
  check(entry.spell === 1, "the letter targets are uploaded to the GPU", `spell=${entry.spell}`);
  const entryShot = await shot(page);
  fs.writeFileSync(path.join(OUT_DIR, "entrance.png"), PNG.sync.write(entryShot));

  // the beats: vapour painted above the band, and moving
  const stops = [
    ["ideas", 0.08],
    ["tension", 0.3],
    ["mark", 0.5],
    ["purpose", 0.68],
    ["spell", 0.9],
  ];
  for (const [label, f] of stops) {
    await goP(page, f);
    const st = await page.evaluate(() => ({
      p: window.__scenes.origin.p,
      mist: window.__optics.mist,
      share: window.__optics.mistShare,
      count: window.__optics.count,
      floor: window.__scenes.origin.floor,
    }));
    check(st.mist === 1, `vapour stepping at ${label}`, `p=${st.p?.toFixed(3)} share=${st.share}`);
    const a = await shot(page);
    await page.waitForTimeout(700);
    const b = await shot(page);
    fs.writeFileSync(path.join(OUT_DIR, `beat-${label}.png`), PNG.sync.write(a));
    // the stage's upper field: cyan present
    const upper = meanLuma(a, VW * 0.08, VH * 0.1, VW * 0.92, VH * 0.58);
    check(upper > 2.5, `stage lit at ${label}`, `mean luma ${upper.toFixed(2)}`);
    // …and moving between two captures 0.7 s apart
    let delta = 0;
    for (let i = 0; i < a.data.length; i += 16)
      delta += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    check(delta > 500, `liquid alive at ${label}`, `delta=${delta}`);
    if (label === "spell") {
      // The software renderer runs a few frames a second and the vapour's
      // catch-up is bounded per frame, so the field lags wall-clock here.
      // Wait on the SIMULATION's clock instead — the spring settles in well
      // under two seconds of its time, so three seconds of substeps is what a
      // real GPU would have given it — then measure the PARTICLES (a readback
      // of the state textures) as well as the pixels.
      await simSettle(page, 3000);
      const st2 = await page.evaluate(() => {
        const o = window.__scenes.origin;
        const m = window.__optics.mistStats();
        return { m, wx: o.wx, wy: o.wy, ww: o.ww, wh: o.wh };
      });
      check(
        !!st2.m && st2.m.alive > 1000,
        "the vapour's population is alive at the resolution",
        `alive=${st2.m?.alive} skin=${st2.m?.skin}`,
      );
      check(
        !!st2.m && Math.abs(st2.m.meanY - st2.wy) < st2.wh * 0.6 && Math.abs(st2.m.meanX - st2.wx) < st2.ww * 0.35,
        "the vapour's centre of mass sits on the name",
        `mean=(${st2.m?.meanX.toFixed(3)}, ${st2.m?.meanY.toFixed(3)}) box=(${st2.wx.toFixed(3)}, ${st2.wy.toFixed(3)}) ±(${st2.ww.toFixed(3)}, ${st2.wh.toFixed(3)})`,
      );
      // the wordmark's box is lit by vapour while the type is still faint,
      // and the band beside it is dark
      const box = await page.evaluate(() => {
        const g = document.querySelector("#name .origin-wordmark-glyphs");
        const r = g.getBoundingClientRect();
        return {
          l: r.left,
          t: r.top,
          r: r.right,
          b: r.bottom,
          op: parseFloat(getComputedStyle(g).opacity),
          wOn: window.__scenes.origin.wOn,
          wy: window.__scenes.origin.wy,
          spell: window.__optics.spell,
        };
      });
      const settled = await shot(page);
      fs.writeFileSync(path.join(OUT_DIR, "beat-spell-settled.png"), PNG.sync.write(settled));
      const inBox = meanLuma(settled, box.l, box.t, box.r, box.b);
      const beside = meanLuma(settled, 20, box.t, box.l - 60, box.b);
      check(box.wOn === 1 && box.spell === 1, "the spelling is armed at p 0.9", `wOn=${box.wOn} spell=${box.spell} wy=${box.wy?.toFixed(3)}`);
      check(box.op < 0.5, "the type has not yet taken over at p 0.9", `opacity=${box.op}`);
      check(inBox > beside * 3 && inBox > 4, "the vapour lights the letters, not the band", `box=${inBox.toFixed(2)} beside=${beside.toFixed(2)}`);
    }
  }

  // ── the director ────────────────────────────────────────────────────────
  console.log("  the director");
  const dir = await page.evaluate(() => {
    const chars = document.querySelectorAll("#name .origin-char").length;
    const words = document.querySelectorAll("#name .origin-word").length;
    const wordEls = [...document.querySelectorAll('#name [data-origin="word"]')];
    const labels = wordEls.map((el) => el.getAttribute("aria-label"));
    const text = wordEls.map((el) => el.textContent.trim());
    return { chars, words, labels, text };
  });
  check(dir.chars === dir.text.join("").length, "the two names are split into letters", `${dir.chars} chars for ${JSON.stringify(dir.text)}`);
  check(dir.words > 3, "the thesis is split into words", `${dir.words}`);
  check(dir.labels.every((l, i) => l === dir.text[i]), "the split keeps each name's accessible label", JSON.stringify(dir.labels));
  // each beat's block: open while pinned, closed before the next opens
  for (let i = 0; i < ORIGIN_BEATS.length; i++) {
    const beat = ORIGIN_BEATS[i];
    const mid = beat.until > 1 ? 0.95 : (beat.from + beat.span + beat.until) / 2;
    await goP(page, mid, 900);
    const w = await page.evaluate((id) => {
      const el = document.querySelector(`#name [data-beat="${id}"]`);
      const cs = getComputedStyle(el);
      return { inN: parseFloat(cs.getPropertyValue("--wipe-in")), outN: parseFloat(cs.getPropertyValue("--wipe-out")), p: window.__scenes.origin.p };
    }, beat.id);
    check(w.inN > 0.97 && w.outN < 0.03, `${beat.id} open mid-beat`, `p=${w.p?.toFixed(3)} in=${w.inN} out=${w.outN}`);
    if (i < ORIGIN_BEATS.length - 1) {
      const next = ORIGIN_BEATS[i + 1];
      await goP(page, next.from + next.span * 0.5, 900);
      const w2 = await page.evaluate((id) => {
        const el = document.querySelector(`#name [data-beat="${id}"]`);
        return parseFloat(getComputedStyle(el).getPropertyValue("--wipe-out"));
      }, beat.id);
      check(w2 > 0.97, `${beat.id} released before ${next.id} arrives`, `out=${w2}`);
    }
  }
  // the type takes over at the end of the runway
  await goP(page, 1, 1200);
  const end = await page.evaluate(() => ({
    op: parseFloat(getComputedStyle(document.querySelector("#name .origin-wordmark-glyphs")).opacity),
  }));
  check(end.op > 0.95, "the wordmark's type is fully in at the end of the runway", `opacity=${end.op}`);
  check(ORIGIN_ARC.FADE[1] <= 1, "the fade completes inside the runway");

  // past the chapter the vapour stops stepping
  await page.evaluate(async () => {
    const st = document.querySelector("#contact");
    const t = Math.round(st.getBoundingClientRect().top + window.scrollY);
    for (let i = 0; i < 30; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 100));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ mist: window.__optics.mist, liquid: document.querySelectorAll(".journey-canvas canvas").length }));
  check(after.mist === 0, "the vapour does not step over Contact", `mist=${after.mist}`);
  check(after.liquid === 1, "still one liquid canvas at the end", `${after.liquid}`);
  await ctx.close();
}

// ═══ B · ?fmist=0 — the rollback ═══════════════════════════════════════════
{
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?ftier=full&fgov=0&fmist=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__optics && !!window.__scenes, { timeout: 40000 });
  await page.addStyleTag({ content: ".breath-layer{display:none !important}" });
  await page.waitForTimeout(3500);
  console.log("B · ?fmist=0");
  await goP(page, 0.5);
  const st = await page.evaluate(() => ({
    pop: window.__optics.mistPop,
    mist: window.__optics.mist,
    holder: window.__cine?.stats?.holderId,
    chars: document.querySelectorAll("#name .origin-char").length,
  }));
  check(st.pop === 0 && st.mist === 0, "no vapour", `pop=${st.pop} mist=${st.mist}`);
  const still = await shot(page);
  const lit = meanLuma(still, VW * 0.3, VH * 0.15, VW * 0.7, VH * 0.65);
  check(st.holder === "origin" && lit > 4, "the exact mark still carries the chapter", `holder=${st.holder} luma=${lit.toFixed(2)}`);
  check(st.chars > 0, "the director still runs without the vapour", `chars=${st.chars}`);
  await ctx.close();
}

// ═══ C · reduced motion — nothing is hidden, nothing is split ═══════════════
{
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.waitForTimeout(2500);
  console.log("C · reduced motion");
  const st = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll("#name .origin-copy")];
    const ins = blocks.map((el) => parseFloat(getComputedStyle(el).getPropertyValue("--wipe-in")));
    const words = [...document.querySelectorAll('#name [data-origin="word"], #name [data-origin="statement"], #name [data-origin="wordmark"], #name [data-origin="closing"]')];
    return {
      liquid: document.querySelector(".liquid-journey")?.dataset.liquid,
      chars: document.querySelectorAll("#name .origin-char").length,
      ins,
      opacities: words.map((el) => parseFloat(getComputedStyle(el).opacity)),
    };
  });
  check(st.liquid === "static", "static liquid path");
  check(st.chars === 0, "no letter split under reduced motion", `${st.chars}`);
  check(st.ins.every((v) => v === 1), "every block fully open", JSON.stringify(st.ins));
  check(st.opacities.every((v) => v === 1), "every moved element at full opacity", JSON.stringify(st.opacities));
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "ORIGIN: all checks green" : `ORIGIN FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
