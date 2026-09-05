// verify-hero-word (S1.9) — the rotating noun keeps the slot measured for it.
//
//   1. FIT            the word fits the slot the component sized for it, on a
//                     cold load AND on arrival from another route
//   2. NO OVERLAP     the painted word never reaches the fixed words either
//                     side of it ("Dê forma ao seu ⟨word⟩ com um")
//   3. TRANSFORM-PROOF the slot on arrival equals the slot on a cold load
//   4. WHOLE CYCLE    every word in the set, sampled in place after a return
//   5. REDUCED MOTION the no-transition, no-letters path holds too
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

await browser.close();
console.log(
  `\ncaptures → ${path.relative(process.cwd(), OUT_DIR)}`,
);
console.log(
  failures === 0 ? "HERO-WORD: all green" : `HERO-WORD FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
