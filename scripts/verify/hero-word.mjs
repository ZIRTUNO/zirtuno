// verify-hero-word (S1.9) — the rotating noun keeps the slot measured for it.
//
//   1. FIT            the word fits the slot the component sized for it, on a
//                     cold load AND on arrival from another route
//   2. NO OVERLAP     the painted word never reaches the fixed words either
//                     side of it ("Dê forma ao seu ⟨word⟩ com um")
//   3. TRANSFORM-PROOF the slot on arrival equals the slot on a cold load
//   4. WHOLE CYCLE    every word in the set, sampled in place after a return
//   5. REDUCED MOTION the no-transition, no-letters path holds too
//   6. NARROW STAGES  on a phone the word may not move the layout: the headline
//                     keeps its height and the subline its position across the
//                     whole set, at every width, in both locales
//
// THE REGRESSION THIS EXISTS FOR
// `PageTransition` holds the arriving route at scale(.8) for the length of its
// enter timeline, and the hero's camera tilts `.lab-plane` in perspective on
// top of that. `WordCycle` mounts inside both. Measured with
// getBoundingClientRect — which reports the box as PAINTED — every word came
// back 80% of itself and the slot was pinned there for the life of the page:
// `crescimento` needs 221px and got 178, and since the word is centred in its
// slot with nothing clipping it, it hung ~21px out of each end and sat on top
// of "seu" and "com um". ResizeObserver could not save it either — clearing a
// transform changes no layout, so nothing fired. Hence check 3: it is the one
// that fails on the old measurement and passes on the new one.
//
// THE SECOND REGRESSION — check 6
// Desktop holds line one at `white-space: nowrap`, so the slot's travel only
// re-centres a line that is already one row. A phone has to wrap, and there the
// slot's travel was choosing WHERE the line broke. At 390px
// "Dê forma ao seu futuro com um" fits one row and
// "Dê forma ao seu posicionamento com um" does not, so the headline gained and
// lost an entire row every three seconds: 13.7px of travel at 392–512px, 14.8px
// at 300–332px, in both locales, carrying the subline — and, since `.lab-hero`
// centres its content in 100svh, the rest of the composition — with it.
// `.lab-headline-lead` is the fix: the run before the word becomes a block on
// the phone stage, so row one is fixed copy and the word always opens row two.
// Check 6 is the gate on that, and it is a COPY gate as much as a CSS one — it
// reports the headroom left before the widest word would push its row over.
//
// Dev server must be running:  node scripts/verify/hero-word.mjs

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "captures", "hero-word");
const CYCLE_MS = 3000; // HERO_CYCLE_MS in useCinematicHero.ts

let failures = 0;
const check = (ok, label, detail) => {
  console.log(
    `${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

/**
 * One reading of the headline's changing word.
 *
 * `slot`/`natural` are read off `getComputedStyle`, so they are LAYOUT px and
 * survive being read while an ancestor is scaled — that is the whole point of
 * the fix and it has to be measurable without the scale in it. The overlap
 * test is the opposite: it reads PAINTED rects, because "does this word touch
 * the one beside it" is a question about pixels. Both live in the same
 * transformed space, so the comparison is valid at any scale.
 */
const READ = () => {
  const slot = document.querySelector(".lab-word");
  const sizer = document.querySelector(".lab-word-sizer");
  const faces = document.querySelectorAll(".lab-word-face");
  const face = faces[faces.length - 1];
  const line = document.querySelector(".lab-headline-line");
  const lights = line ? [...line.querySelectorAll(".lab-light")] : [];
  if (!slot || !sizer || !face || lights.length < 2) return null;

  const word = (face.textContent || "").trim();
  const candidate = [...sizer.children].find(
    (c) => (c.textContent || "").trim() === word,
  );
  const used = (el) => Number.parseFloat(getComputedStyle(el).width);

  // the painted extent of the word itself, not of the box holding it
  const range = document.createRange();
  range.selectNodeContents(face);
  const ink = range.getBoundingClientRect();
  range.detach?.();

  return {
    word,
    slot: +used(slot).toFixed(2),
    natural: candidate ? +used(candidate).toFixed(2) : null,
    // scrollWidth vs clientWidth is an independent witness: it is layout's own
    // answer to "did the content overflow its box", computed without us
    overflow: face.scrollWidth - face.clientWidth,
    gapBefore: +(ink.left - lights[0].getBoundingClientRect().right).toFixed(2),
    gapAfter: +(lights[1].getBoundingClientRect().left - ink.right).toFixed(2),
  };
};

function assertHealthy(reading, label) {
  if (!reading) {
    check(false, `${label} — headline found`, "no .lab-word on the page");
    return;
  }
  const { word, slot, natural, overflow, gapBefore, gapAfter } = reading;
  check(
    natural !== null && slot >= natural - 0.5,
    `${label} · "${word}" fits its slot`,
    `slot ${slot} vs word ${natural}`,
  );
  check(
    overflow <= 1,
    `${label} · "${word}" does not overflow`,
    `scrollWidth − clientWidth = ${overflow}`,
  );
  check(
    gapBefore > 0 && gapAfter > 0,
    `${label} · "${word}" clears the words either side`,
    `before ${gapBefore}px · after ${gapAfter}px`,
  );
}

/** Click through the site's own link interceptor — that is what plays the
 *  transition, and the transition is the thing under test. `evaluate` rather
 *  than `page.click` so a link parked in the closed mobile menu still counts. */
async function navigate(page, href) {
  const hit = await page.evaluate((h) => {
    const a = [...document.querySelectorAll("a[href]")].find((el) =>
      el.getAttribute("href")?.startsWith(h),
    );
    if (!a) return false;
    a.click();
    return true;
  }, href);
  if (!hit) throw new Error(`no link to ${href}`);
  await page.waitForFunction(
    (h) => location.pathname.startsWith(h.split("?")[0]),
    href,
    { timeout: 30000 },
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch(LAUNCH);

async function heroShot(page, name) {
  const hero = await page.$(".lab-headline");
  if (hero) await hero.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
}

// ── 1-3 · cold load, round trip, and the two compared ────────────────────────
for (const [w, h] of [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
]) {
  console.log(`\nhero-word · ${w}×${h}`);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1200);

  const cold = await page.evaluate(READ);
  assertHealthy(cold, `${w} cold`);
  await heroShot(page, `${w}-cold`);

  for (const route of ["/pt/contact", "/pt/work"]) {
    await navigate(page, route);
    await page.waitForTimeout(1500);
    await navigate(page, "/pt"); // arrives under the enter timeline's scale(.8)
    await page.waitForSelector(".lab-word-face", { timeout: 40000 });

    // read DURING the transition as well: the slot must already be right,
    // because this is the exact window the old measurement ran in
    await page.waitForTimeout(180);
    const midFlight = await page.evaluate(READ);
    await page.waitForTimeout(1500);
    const settled = await page.evaluate(READ);

    assertHealthy(settled, `${w} back from ${route}`);
    const sameWord =
      midFlight && cold && midFlight.word === settled.word ? midFlight : null;
    check(
      settled && cold && Math.abs(settled.natural - cold.natural) < 1,
      `${w} back from ${route} · word measures the same as on a cold load`,
      `${settled?.natural} vs ${cold?.natural}`,
    );
    check(
      !sameWord || Math.abs(sameWord.slot - settled.slot) < 1,
      `${w} back from ${route} · slot is right mid-transition, not just after`,
      `${sameWord?.slot} → ${settled?.slot}`,
    );
    await heroShot(page, `${w}-back-from-${route.split("/").pop()}`);
  }

  // The locale toggle is the harder arrival: it is a BUTTON calling
  // router.replace, so nothing intercepts it and no exit is played — the page
  // just remounts straight into the enter timeline's scale(.8), with a whole
  // new word set landing in the slot at the same time.
  await page.click(".lang-opt:not(.is-active)");
  await page.waitForFunction(() => location.pathname.startsWith("/en"), null, {
    timeout: 30000,
  });
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1800);
  assertHealthy(await page.evaluate(READ), `${w} after pt→en`);
  await heroShot(page, `${w}-en`);

  await ctx.close();
}

// ── 4 · the whole set, sampled in place after a return ───────────────────────
{
  console.log("\nhero-word · every word in the set, after a return");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await navigate(page, "/pt/contact");
  await page.waitForTimeout(1500);
  await navigate(page, "/pt");
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1200);

  // Sample ON the exchange, not on a fixed beat. Polling every CYCLE_MS aliases
  // against the hero's own clock and quietly skips words; and the slot is
  // legitimately mid-travel for ~720ms after each swap (a 420ms width ease
  // behind a 300ms delay), which is a resize this gate must not read as a
  // failure. So: wait for the word to change, let the slot land, then read.
  const seen = new Set();
  let previous = "";
  for (let i = 0; i < 6 && seen.size < 5; i++) {
    await page.waitForFunction(
      (prev) => {
        const faces = document.querySelectorAll(".lab-word-face");
        const now = (faces[faces.length - 1]?.textContent || "").trim();
        return now.length > 0 && now !== prev;
      },
      previous,
      { timeout: CYCLE_MS * 3 },
    );
    await page.waitForTimeout(900);
    const reading = await page.evaluate(READ);
    previous = reading?.word ?? previous;
    if (reading && !seen.has(reading.word)) {
      seen.add(reading.word);
      assertHealthy(reading, "cycle");
      await heroShot(page, `cycle-${reading.word}`);
    }
  }
  check(seen.size === 5, "all five words were sampled", [...seen].join(", "));
  await ctx.close();
}

// ── 5 · reduced motion — no transition, no letter spans ──────────────────────
{
  console.log("\nhero-word · reduced motion");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1200);
  assertHealthy(await page.evaluate(READ), "reduced cold");
  await navigate(page, "/pt/contact");
  await page.waitForTimeout(1200);
  await navigate(page, "/pt");
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1200);
  assertHealthy(await page.evaluate(READ), "reduced back from /pt/contact");
  await heroShot(page, "reduced");
  await ctx.close();
}

// ── 6 · narrow stages — the word may not move the layout ─────────────────────
/**
 * Walk the slot through every candidate width and watch what the PAGE does.
 *
 * Driving the slot directly rather than waiting out the cycle is deliberate:
 * the wrap is decided by the slot's width alone — both painted faces are
 * absolute and only the ghost is in flow, and the ghost cannot widen a box that
 * carries an explicit width — so a forced width reproduces the exact layout the
 * live cycle produces, without paying 3s a word at 100+ widths. 6b then runs
 * the real clock at the width the bug was worst, so nothing rests on that
 * argument alone.
 *
 * `headroom` is the gate on the COPY: how much wider the widest word could get
 * before it pushed the fragment after it onto another row and the layout
 * started moving again. It is reported at every width and asserted at the
 * tightest one.
 */
const NARROW = () => {
  const slot = document.querySelector(".lab-word");
  const sizer = document.querySelector(".lab-word-sizer");
  const visual = document.querySelector(".lab-headline-visual");
  const sub = document.querySelector(".lab-sub");
  if (!slot || !sizer || !visual || !sub) return null;

  const used = (el) => Number.parseFloat(getComputedStyle(el).width);
  const candidates = [...sizer.children].map((c) => ({
    word: (c.textContent || "").trim(),
    w: Math.ceil(used(c)),
  }));
  const widest = Math.max(...candidates.map((c) => c.w));

  // React owns this inline style; borrow it and hand it straight back
  const heldWidth = slot.style.width;
  const heldTransition = slot.style.transition;
  slot.style.transition = "none";
  const layoutAt = (w) => {
    slot.style.width = `${w}px`;
    void slot.offsetWidth;
    return {
      headline: visual.getBoundingClientRect().height,
      sub: sub.getBoundingClientRect().top,
    };
  };

  const readings = candidates.map((c) => ({ ...c, ...layoutAt(c.w) }));

  // the widest the slot could be before the headline gains a row
  const base = layoutAt(widest).headline;
  let fits = widest;
  let breaks = widest + 400;
  if (layoutAt(breaks).headline === base) fits = breaks;
  else
    while (breaks - fits > 1) {
      const mid = (fits + breaks) >> 1;
      if (layoutAt(mid).headline === base) fits = mid;
      else breaks = mid;
    }

  // No PAINTED run of the headline may reach past the viewport at any candidate
  // width. The measuring rig is excluded on purpose: it is hidden and clipped,
  // its candidates keep their full max-content rects by design, and counting
  // them here would report an overflow nobody can see. What the rig must not do
  // is extend the PAGE, and that is asserted separately below.
  const clientWidth = document.documentElement.clientWidth;
  const spill = Math.max(
    0,
    ...candidates.flatMap((c) => {
      layoutAt(c.w);
      return [...visual.querySelectorAll("*")]
        .filter((el) => !sizer.contains(el))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.width ? r.right - clientWidth : 0;
        });
    }),
  );

  // The rig is `position: absolute` and `visibility: hidden`, neither of which
  // takes it out of the scrollable overflow region — it used to hand the page a
  // horizontal scrollbar that came and went with the word. Ask layout directly:
  // how much of the document's scroll width is the rig responsible for?
  const scrollWithRig = document.documentElement.scrollWidth;
  sizer.style.display = "none";
  void document.documentElement.offsetWidth;
  const scrollWithout = document.documentElement.scrollWidth;
  sizer.style.display = "";
  const rigScroll = scrollWithRig - scrollWithout;

  slot.style.width = heldWidth;
  slot.style.transition = heldTransition;

  const heights = readings.map((r) => +r.headline.toFixed(1));
  const subs = readings.map((r) => +r.sub.toFixed(1));
  const widestWord = candidates.find((c) => c.w === widest).word;
  return {
    heights: [...new Set(heights)],
    subs: [...new Set(subs)],
    shift: +(Math.max(...subs) - Math.min(...subs)).toFixed(1),
    headroom: fits - widest,
    chars: +((fits - widest) / (widest / widestWord.length)).toFixed(1),
    widestWord,
    spill: +spill.toFixed(1),
    rigScroll,
  };
};

{
  console.log("\nhero-word · narrow stages, the whole set at every width");
  // 300 is the narrowest stage the site claims; 520 is where line one stops
  // wrapping at all, so the band either side of it is the one that mattered.
  const WIDTHS = [300, 320, 332, 344, 360, 375, 390, 412, 430, 480, 512, 560, 640, 767];
  for (const locale of ["pt", "en"]) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${locale}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lab-word-face", { timeout: 40000 });
    await page.waitForTimeout(1200);

    let tightest = null;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(120);
      const r = await page.evaluate(NARROW);
      if (!r) {
        check(false, `${locale} ${width} · headline found`);
        continue;
      }
      check(
        r.heights.length === 1,
        `${locale} ${width} · headline keeps its height across the set`,
        `heights ${r.heights.join(" / ")}`,
      );
      check(
        r.subs.length === 1,
        `${locale} ${width} · nothing under the headline moves`,
        `subline travels ${r.shift}px`,
      );
      check(
        r.spill <= 1,
        `${locale} ${width} · no word reaches past the column`,
        `${r.spill}px out`,
      );
      check(
        r.rigScroll <= 0,
        `${locale} ${width} · the measuring rig does not widen the page`,
        `${r.rigScroll}px of scrollWidth`,
      );
      if (!tightest || r.headroom < tightest.headroom) tightest = { ...r, width };
    }
    // A copy change is the realistic way this breaks next, so say plainly how
    // much room the longest word has left before it does.
    check(
      tightest.headroom >= 24,
      `${locale} · widest word has room to grow`,
      `"${tightest.widestWord}" +${tightest.headroom}px (~${tightest.chars} chars) at ${tightest.width}px, its tightest stage`,
    );
    await ctx.close();
  }
}

// ── 6b · the same claim, on the hero's own clock ─────────────────────────────
{
  console.log("\nhero-word · 390px, live cycle");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lab-word-face", { timeout: 40000 });
  await page.waitForTimeout(1500);

  const LIVE = () => {
    const faces = document.querySelectorAll(".lab-word-face");
    const visual = document.querySelector(".lab-headline-visual");
    const sub = document.querySelector(".lab-sub");
    return {
      word: (faces[faces.length - 1]?.textContent || "").trim(),
      headline: +visual.getBoundingClientRect().height.toFixed(1),
      sub: +sub.getBoundingClientRect().top.toFixed(1),
    };
  };

  const seen = new Map();
  let previous = "";
  for (let i = 0; i < 7 && seen.size < 5; i++) {
    await page.waitForFunction(
      (prev) => {
        const faces = document.querySelectorAll(".lab-word-face");
        const now = (faces[faces.length - 1]?.textContent || "").trim();
        return now.length > 0 && now !== prev;
      },
      previous,
      { timeout: CYCLE_MS * 3 },
    );
    // the slot travels for ~720ms after the swap (420ms ease behind a 300ms
    // delay) — read once it has landed
    await page.waitForTimeout(900);
    const reading = await page.evaluate(LIVE);
    previous = reading.word;
    if (!seen.has(reading.word)) {
      seen.set(reading.word, reading);
      await heroShot(page, `narrow-390-${reading.word}`);
    }
  }
  const live = [...seen.values()];
  check(seen.size === 5, "390 live · all five words were sampled", [...seen.keys()].join(", "));
  check(
    new Set(live.map((r) => r.headline)).size === 1,
    "390 live · the headline never changes height",
    live.map((r) => `${r.word} ${r.headline}`).join(" · "),
  );
  check(
    new Set(live.map((r) => r.sub)).size === 1,
    "390 live · the subline never moves",
    live.map((r) => `${r.word} ${r.sub}`).join(" · "),
  );
  await ctx.close();
}

await browser.close();
console.log(
  `\ncaptures → ${path.relative(process.cwd(), OUT_DIR)}`,
);
console.log(
  failures === 0 ? "HERO-WORD: all green" : `HERO-WORD FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
