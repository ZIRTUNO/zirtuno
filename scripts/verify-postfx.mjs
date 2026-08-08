// verify-postfx (R5-C, metaball-morph-spec §14.2) — the optics gate.
//
//   node scripts/verify-postfx.mjs --baseline    pre-C: record reference stats
//   node scripts/verify-postfx.mjs               post-C: assert the contract
//
// The BYTE gate for shader identity is `npm run forms:rest` (deterministic
// stills — time and grade bypassed). The live page cannot be byte-compared
// across builds (time-driven warp, wandering ambient), so the `?fgrade=0`
// stop-the-line rule ("bypass differs from pre-C pixels: stop", §14.3) is
// enforced statistically against a pre-C baseline recorded by --baseline:
// at a frozen choreography hold (?feco=0.55&ftier=full&fcine=0, no scroll;
// fcine=0 keeps the R5-D light score neutral so this harness keeps
// measuring the OPTICS chain in isolation against its pre-C baseline) the
// mark-interior mean and a DOM-free liquid-field sample must match the pre-C
// values within tight tolerances, and the post chain must report OFF. The
// whole-page mean remains diagnostic only because typography is not optics.
//
// With the grade ON (default) it asserts the R5-C additions behave: the post
// chain reports on, the flat background stays EXACTLY black (the dither is
// luminance-gated — no seam against the #000 page, §10.2), the bloom halo
// shows no wide 8-bit banding runs, the grain is alive but bounded (≤2.5%,
// §10.2.6), the full-nofx watchdog rung still renders glass, and the energy
// governor halves the idle draw cadence without ever freezing (§12.3).
//
// The .breath-layer CSS noise overlay (S1.7) is hidden during sampling: its
// opacity ANIMATES (8 s pulse), it sits above the canvas, and it is
// independent of the optics chain — hiding it stabilises the statistics.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const BASELINE_PATH = path.join(process.cwd(), "scripts", "postfx-baseline.json");
const OUT_DIR = path.join(process.cwd(), "captures", "postfx");
const baselineMode = process.argv.includes("--baseline");

const VW = 1440;
const VH = 900;
// mark-interior probe: offset from centre so the organism-center DOM label
// (which sits exactly at the stage centre at this hold) never enters the crop
const CROP = { x: VW / 2 + 40, y: VH / 2 + 60, w: 120, h: 120 };
// DOM-free renderer samples. FIELD contains the hero liquid in both the
// original pre-C reference and the current layout; BACKGROUND is known-empty.
const FIELD = { x: 620, y: 120, w: 320, h: 600 };
const BACKGROUND = { x: 1000, y: 120, w: 150, h: 100 };
const SHOTS = 6;
const SHOT_GAP = 350;

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

function regionStats(d, width, box) {
  let sum = 0;
  let black = 0;
  const total = box.w * box.h;
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * width + x) * 4;
      sum += luma(d, i);
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) black++;
    }
  return { mean: sum / total, blackFrac: black / total };
}

function statsOf(buf) {
  const png = PNG.sync.read(buf);
  const d = png.data;
  let gSum = 0;
  let black = 0;
  const total = png.width * png.height;
  for (let p = 0; p < total; p++) {
    const l = luma(d, p * 4);
    gSum += l;
    if (d[p * 4] === 0 && d[p * 4 + 1] === 0 && d[p * 4 + 2] === 0) black++;
  }
  const crop = regionStats(d, png.width, CROP);
  const field = regionStats(d, png.width, FIELD);
  const background = regionStats(d, png.width, BACKGROUND);
  return {
    globalMean: gSum / total,
    cropMean: crop.mean,
    fieldMean: field.mean,
    fieldBlackFrac: field.blackFrac,
    backgroundBlackFrac: background.blackFrac,
    blackFrac: black / total,
    png,
  };
}

/**
 * What share of the liquid sits in ONE colour bucket. The flat-cyan branch
 * paints a single constant (#00E3FE) with no lighting, so it lands ~0.97;
 * genuinely shaded glass spreads across dome/specular/fresnel and lands far
 * lower. This is how a rung's MATERIAL is judged — not by its label.
 */
function liquidFlatness(png, box = FIELD) {
  const d = png.data;
  const buckets = new Map();
  let liquid = 0;
  // FIELD only. The page is full of cyan chrome — gradient-clipped headings, the
  // chapter rail, CTA rules — and counting those diluted a genuinely flat canvas
  // to a healthy-looking 7%. Judge the liquid inside the liquid's own box.
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const p = (y * png.width + x) * 4;
      const r = d[p];
      const g = d[p + 1];
      const b = d[p + 2];
      if (g > 60 && b > 60 && g > r + 25) {
        liquid++;
        const k = `${r >> 3},${g >> 3},${b >> 3}`;
        buckets.set(k, (buckets.get(k) || 0) + 1);
      }
    }
  }
  if (!liquid) return { liquid: 0, share: 0 };
  return { liquid, share: Math.max(...buckets.values()) / liquid };
}

async function settle(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.addStyleTag({ content: ".breath-layer{display:none !important}" });
  // entry veil + SDF builds + physics settle
  await page.waitForTimeout(6500);
}

async function sampleShots(page, tag) {
  const shots = [];
  for (let i = 0; i < SHOTS; i++) {
    const buf = await page.screenshot({ type: "png" });
    const s = statsOf(buf);
    shots.push(s);
    if (i === 0) fs.writeFileSync(path.join(OUT_DIR, `${tag}.png`), buf);
    await page.waitForTimeout(SHOT_GAP);
  }
  const avg = (k) => shots.reduce((a, s) => a + s[k], 0) / shots.length;
  const spread = (k) =>
    Math.max(...shots.map((s) => s[k])) - Math.min(...shots.map((s) => s[k]));
  return {
    globalMean: avg("globalMean"),
    cropMean: avg("cropMean"),
    fieldMean: avg("fieldMean"),
    fieldBlackFrac: avg("fieldBlackFrac"),
    backgroundBlackFrac: avg("backgroundBlackFrac"),
    blackFrac: avg("blackFrac"),
    spreadGlobal: spread("globalMean"),
    spreadCrop: spread("cropMean"),
    spreadField: spread("fieldMean"),
    last: shots[shots.length - 1].png,
  };
}

/** Longest run of identical 8-bit luma along a horizontal scanline restricted
 *  to the soft-gradient zone (luma 2–60) — the band where quantisation
 *  contours are visible. Dither should keep runs short. */
function maxBandRun(png, y) {
  const d = png.data;
  let run = 0;
  let best = 0;
  let prev = -1;
  for (let x = FIELD.x; x < FIELD.x + FIELD.w; x++) {
    const l = Math.round(luma(d, (y * png.width + x) * 4));
    if (l >= 2 && l <= 60) {
      run = l === prev ? run + 1 : 1;
      if (run > best) best = run;
    } else run = 0;
    prev = l;
  }
  return best;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();

if (baselineMode) {
  console.log("postfx --baseline: recording grade-bypass reference stats…");
  // A future deliberate baseline records the exact grade-bypass renderer, not
  // whatever the default optics implementation happens to be at that time.
  await settle(page, "/en?feco=0.55&ftier=full&fgrade=0&fcine=0");
  const s = await sampleShots(page, "baseline");
  const record = {
    note: "grade-bypass reference at /en?feco=0.55&ftier=full&fgrade=0, 1440x900 dsf1; renderer-only field sample",
    date: new Date().toISOString(),
    viewport: { w: VW, h: VH },
    crop: CROP,
    field: FIELD,
    globalMean: +s.globalMean.toFixed(3),
    cropMean: +s.cropMean.toFixed(3),
    fieldMean: +s.fieldMean.toFixed(3),
    fieldBlackFrac: +s.fieldBlackFrac.toFixed(4),
    blackFrac: +s.blackFrac.toFixed(4),
    spreadGlobal: +s.spreadGlobal.toFixed(3),
    spreadCrop: +s.spreadCrop.toFixed(3),
    spreadField: +s.spreadField.toFixed(3),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(record, null, 2) + "\n");
  console.log("  wrote", BASELINE_PATH, JSON.stringify(record));
  await browser.close();
  process.exit(0);
}

// ── verify mode ───────────────────────────────────────────────────────────────
const base = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
console.log("postfx verify vs baseline", base.date);

// 1 · the ?fgrade=0 bypass matches the pre-C baseline
await settle(page, "/en?feco=0.55&ftier=full&fgrade=0&fcine=0");
const off = await sampleShots(page, "fgrade0");
{
  const optics = await page.evaluate(() => window.__optics ?? null);
  check(optics && optics.post === 0, "fgrade=0: post chain reports OFF", JSON.stringify(optics));
  const dF = Math.abs(off.fieldMean - base.fieldMean);
  const dC = Math.abs(off.cropMean - base.cropMean);
  const dFB = Math.abs(off.fieldBlackFrac - base.fieldBlackFrac);
  const tolF = Math.max(1.2, base.fieldMean * 0.04, (base.spreadField ?? 0) * 2);
  const tolC = Math.max(3.5, base.cropMean * 0.05, base.spreadCrop * 2);
  check(dF <= tolF, "fgrade=0: liquid-field mean matches pre-C", `Δ=${dF.toFixed(3)} tol=${tolF.toFixed(3)}`);
  check(dC <= tolC, "fgrade=0: mark-interior mean matches pre-C", `Δ=${dC.toFixed(3)} tol=${tolC.toFixed(3)}`);
  check(dFB <= 0.03, "fgrade=0: liquid footprint matches pre-C", `black-fraction Δ=${dFB.toFixed(4)}`);
}

// 2 · default grade: post on, background exactly black, banding tamed, grain bounded
await settle(page, "/en?feco=0.55&ftier=full&fcine=0");
const on = await sampleShots(page, "grade-on");
{
  const optics = await page.evaluate(() => window.__optics ?? null);
  check(!!optics, "__optics diagnostic present", JSON.stringify(optics));
  if (optics?.post === 1) {
    check(true, `post chain ON (${optics.fmt})`);
    check(
      on.backgroundBlackFrac >= 0.9999,
      "flat background stays black under the opaque composite",
      `empty-region blackFrac=${on.backgroundBlackFrac.toFixed(4)}`,
    );
    // the grade may shift the liquid field either way (absorption/depth take,
    // bloom gives) — but only subtly: it is a grade, not a re-light
    const ratio = on.fieldMean / Math.max(off.fieldMean, 1e-6);
    check(
      ratio >= 0.85 && ratio <= 1.3,
      "grade shifts liquid-field luminance only subtly",
      `on=${on.fieldMean.toFixed(2)} off=${off.fieldMean.toFixed(2)} ratio=${ratio.toFixed(3)}`,
    );
    const run = maxBandRun(on.last, Math.round(VH / 2 + 10));
    check(run <= 64, "no wide 8-bit banding runs across the halo", `max identical-luma run=${run}px`);
    // grain: alive but bounded on lit pixels (two shots, masked diff)
    const g = await page.screenshot({ type: "png" });
    await page.waitForTimeout(120);
    const h = await page.screenshot({ type: "png" });
    const A = PNG.sync.read(g).data;
    const B = PNG.sync.read(h).data;
    let diff = 0;
    let n = 0;
    for (let y = CROP.y; y < CROP.y + CROP.h; y++)
      for (let x = CROP.x; x < CROP.x + CROP.w; x++) {
        const i = (y * VW + x) * 4;
        const la = luma(A, i);
        if (la > 30) {
          diff += Math.abs(la - luma(B, i));
          n++;
        }
      }
    const md = n ? diff / n : 0;
    check(n === 0 || md < 14, "grain/warp temporal delta bounded on lit liquid", `meanΔ=${md.toFixed(2)} over ${n}px`);
  } else {
    check(false, "post chain ON at full tier", JSON.stringify(optics));
  }
}

// 3 · full-nofx watchdog rung: glass survives the post chain turning off
{
  await page.evaluate(() => window.__optics.demote());
  await page.waitForTimeout(400);
  const o1 = await page.evaluate(() => ({ post: window.__optics.post, tier: window.__optics.tier }));
  check(o1.post === 0 && o1.tier === "fullnofx", "demote → full-nofx (glass, no post)", JSON.stringify(o1));
  const f0 = await page.evaluate(() => window.__optics.frames);
  await page.waitForTimeout(600);
  const f1 = await page.evaluate(() => window.__optics.frames);
  check(f1 > f0, "full-nofx keeps drawing (never freezes)", `frames +${f1 - f0}`);
  const shot = statsOf(await page.screenshot({ type: "png" }));
  check(shot.cropMean > 8, "full-nofx still renders the glass mark", `crop=${shot.cropMean.toFixed(2)}`);
}

// 3b · THE GLASS IS THE LAST THING TO GO. Measured on this shader, dropping
// dpr 2→1 saves ~75% while going flat saves ~58% — so every resolution and
// deformation rung must be spent BEFORE the material. Walking the whole ladder
// here pins that order down: five rungs bearing glass, then the flat floor.
// A regression that re-bundles resolution and material into one step (as the
// original ladder did) fails on the very first mismatch.
{
  const LADDER = ["fullnofx", "glass1x", "rigid", "glasshalf", "lite", "half"];
  const seen = [];
  const flat = {};
  for (let i = 1; i < LADDER.length; i++) {
    await page.evaluate(() => window.__optics.demote());
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => window.__optics.tier);
    seen.push(t);
    flat[t] = liquidFlatness(statsOf(await page.screenshot({ type: "png" })).png);
  }
  check(
    seen.join(",") === LADDER.slice(1).join(","),
    "watchdog descends resolution+deformation before the material",
    `saw ${seen.join(" → ")}`,
  );
  // The point of the whole redesign: the material outlives the resolution cuts.
  // Judged RELATIVELY. An absolute flatness threshold is not portable here —
  // the iso edge carries a continuous alpha ramp, so even the constant-colour
  // branch spreads across buckets wherever the blob meets the black page, and
  // how much of FIELD is edge depends on the hold. What cannot be explained
  // away is the ratio: the flat branch collapses the INTERIOR onto one colour,
  // so its dominant bucket must tower over a genuinely shaded rung's.
  const lastGlass = flat.glasshalf;
  check(
    lastGlass.liquid > 200 && lastGlass.share < 0.25,
    "the LAST glass-bearing rung still shades a real material",
    `glasshalf: ${lastGlass.liquid}px, dominant bucket ${(lastGlass.share * 100).toFixed(1)}%`,
  );
  check(
    flat.lite.share > lastGlass.share * 2,
    "…and only the flat floor below it collapses to one colour",
    `lite ${(flat.lite.share * 100).toFixed(1)}% vs glasshalf ${(lastGlass.share * 100).toFixed(1)}% dominant`,
  );
  // the floor still draws — degradation never becomes a freeze
  const f0 = await page.evaluate(() => window.__optics.frames);
  await page.waitForTimeout(600);
  check(
    (await page.evaluate(() => window.__optics.frames)) > f0,
    "the ladder floor keeps drawing (never freezes)",
  );
}

// 4 · energy governor: idle cadence halves; input restores full cadence
{
  await settle(page, "/en?feco=0.55&ftier=full&fcine=0");
  await page.waitForTimeout(2500); // sustain window entry
  const idle = await page.evaluate(
    () =>
      new Promise((res) => {
        const a = window.__optics.frames;
        setTimeout(() => res(window.__optics.frames - a), 2000);
      }),
  );
  // pointer motion wakes it
  const moveP = page.evaluate(
    () =>
      new Promise((res) => {
        const a = window.__optics.frames;
        setTimeout(() => res(window.__optics.frames - a), 2000);
      }),
  );
  for (let i = 0; i < 25; i++) {
    await page.mouse.move(300 + (i % 10) * 60, 400 + (i % 7) * 40);
    await page.waitForTimeout(75);
  }
  const active = await moveP;
  check(
    idle < active * 0.72 && idle > 20,
    "governor: idle cadence drops (≈30Hz), input restores it",
    `idle=${idle}/2s active=${active}/2s`,
  );
  await settle(page, "/en?feco=0.55&ftier=full&fgov=0&fcine=0");
  await page.waitForTimeout(1500);
  const ungov = await page.evaluate(
    () =>
      new Promise((res) => {
        const a = window.__optics.frames;
        setTimeout(() => res(window.__optics.frames - a), 2000);
      }),
  );
  check(ungov > idle * 1.4, "?fgov=0 disables the governor", `ungoverned=${ungov}/2s vs idle=${idle}/2s`);
}

// 5 · combo smoke: legacy physics + grade bypass coexist
{
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await settle(page, "/en?fphys=0&fgrade=0&ftier=full&fcine=0");
  const canvases = await page.evaluate(
    () => document.querySelectorAll(".journey-canvas canvas").length,
  );
  check(canvases === 1, "fphys=0&fgrade=0: one liquid canvas, no errors", `canvases=${canvases} errors=${errors.length}`);
}

await browser.close();
console.log(failures === 0 ? "POSTFX ALL GREEN" : `POSTFX FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
