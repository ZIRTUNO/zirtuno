// The ARRIVAL gate — every way a visitor can reach a legal page, and the one
// rule that has to hold on all of them.
//
// THE BUG THIS EXISTS TO CATCH. The reference has no curtain, so its sections
// animate as the document paints. This site opens behind the entry veil
// (~3.42s on every document load) and navigates behind the page veil, and
// React runs a PAGE's effects before its LAYOUT's — so a reveal built on mount
// plays and finishes while an opaque curtain is still up. The curtain then
// lifts on a page that has already finished arriving. Nothing errors, nothing
// looks broken in a screenshot, and every capture taken with the repo's `?f*`
// convention passes, because `?f*` suppresses the veil. It is invisible to
// exactly the tools that would normally catch it, which is why it gets a gate
// of its own.
//
//   TWO RULES        · no section may be mid-tween while a curtain is covering
//                    · whatever happens, sections that come into view must land
//
//   node scripts/verify/legal-arrival.mjs
//
// Deliberately NOT using `?f*`: this gate is only meaningful with the veil
// running. Needs the dev server on :3000. Budget ~90s — most of it is spent
// waiting out real intros, which is the point.

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TERMS = `${BASE}/en/legal/terms`;
const V = { width: 1440, height: 900 };
/** Comfortably past the entry veil's own hard cap (SCORE.end + 1.2 ≈ 4.62s). */
const INTRO = 6500;

let failed = 0;
const pass = (name, extra = "") =>
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
const fail = (name, why) => {
  failed++;
  console.log(`  FAIL ${name} — ${why}`);
};

/** Sample every frame: is a curtain up, and where is each section? */
const SAMPLER = (ms) =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const out = [];
    const tick = () => {
      const sections = [...document.querySelectorAll("[data-doc-reveal]")];
      const entry = !!document.querySelector(".entry-veil");
      const pv = document.querySelector(".page-veil");
      const veil = pv ? pv.dataset.veil || "idle" : "none";
      out.push({
        t: Math.round(performance.now() - t0),
        covered: entry || veil === "cover" || veil === "reveal",
        op: sections.map((el) => Number(getComputedStyle(el).opacity)),
      });
      if (performance.now() - t0 < ms) requestAnimationFrame(tick);
      else resolve(out);
    };
    requestAnimationFrame(tick);
  });

/**
 * `expectCurtain` guards the TEST, not the page: a path that was supposed to
 * exercise a curtain and saw none has stopped testing anything, and would sit
 * there passing forever.
 */
function judge(name, samples, { expectCurtain = true, inView = 2 } = {}) {
  const sawCurtain = samples.some((f) => f.covered);
  // Mid-tween means strictly between hidden and landed. A section sitting at 0
  // under the curtain is correct — it is WAITING, which is the whole fix.
  const leaked = samples.filter(
    (f) => f.covered && f.op.some((o) => o > 0.02 && o < 0.999),
  );
  const last = samples[samples.length - 1];

  if (expectCurtain && !sawCurtain) {
    fail(`${name} · curtain present`, "saw no curtain — this path is no longer being exercised");
  } else if (leaked.length) {
    fail(
      `${name} · nothing animates behind the curtain`,
      `${leaked.length} frame(s) mid-tween while covered, first at ${leaked[0].t}ms`,
    );
  } else {
    pass(`${name} · nothing animates behind the curtain`, sawCurtain ? "curtain seen" : "no curtain");
  }

  // Only the sections that actually came into view. The ones below the fold are
  // SUPPOSED to still be waiting — that is the reference's behaviour too.
  if (last.op.length && last.op.slice(0, inView).every((o) => o > 0.99)) {
    pass(`${name} · in-view sections land`);
  } else {
    fail(`${name} · in-view sections land`, `final opacities ${JSON.stringify(last.op)}`);
  }
}

const browser = await chromium.launch(LAUNCH);
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: V, ...opts });
  return [ctx, await ctx.newPage()];
};

// ── 1. cold load straight to the page (entry veil) ───────────────────────────
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  judge("cold load", await page.evaluate(SAMPLER, 7500));
  await ctx.close();
}

// ── 2. in-site navigation (page veil) ────────────────────────────────────────
{
  const [ctx, page] = await fresh();
  // networkidle never settles on the homepage — the liquid keeps the socket
  // busy — so wait for the veil to detach instead.
  await page.goto(`${BASE}/en`, { waitUntil: "load" });
  await page
    .waitForSelector(".entry-veil", { state: "detached", timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  const link = page.locator('a[href$="/legal/terms"]').first();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await link.click();
  judge("in-site navigation", await page.evaluate(SAMPLER, 6000));
  await ctx.close();
}

// ── 3. reload (the intro plays again on every document load) ─────────────────
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  await page.waitForTimeout(INTRO);
  await page.reload({ waitUntil: "commit" });
  judge("reload", await page.evaluate(SAMPLER, 7500));
  await ctx.close();
}

// ── 4. locale switch — a soft nav that remounts the whole provider ───────────
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  await page.waitForTimeout(INTRO);
  const other = page.locator(".lang-toggle .lang-opt:not(.is-active)").first();
  if (await other.count()) {
    await other.click();
    judge("locale switch", await page.evaluate(SAMPLER, 5000), { expectCurtain: false });
  } else {
    fail("locale switch", "no inactive .lang-opt in .lang-toggle — selector has drifted");
  }
  await ctx.close();
}

// ── 5. back navigation ───────────────────────────────────────────────────────
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  await page.waitForTimeout(INTRO);
  await page.goto(`${BASE}/en/legal/privacy`, { waitUntil: "commit" });
  await page.waitForTimeout(INTRO);
  await page.goBack({ waitUntil: "commit" });
  judge("back navigation", await page.evaluate(SAMPLER, 6000), { expectCurtain: false });
  await ctx.close();
}

// ── 6. the intro skipped — the reveal has to follow the skip, not the score ──
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  await page.waitForTimeout(1500);
  const sampling = page.evaluate(SAMPLER, 6500);
  await page.keyboard.press("Escape");
  judge("intro skipped", await sampling);
  await ctx.close();
}

// ── 7. reduced motion — no curtain, no tweens, nothing hidden ────────────────
{
  const [ctx, page] = await fresh({ reducedMotion: "reduce" });
  await page.goto(TERMS, { waitUntil: "commit" });
  judge("reduced motion", await page.evaluate(SAMPLER, 3000), { expectCurtain: false });
  await ctx.close();
}

// ── 8. JS off — the layout's <noscript> rule is the only thing standing ──────
{
  const [ctx, page] = await fresh({ javaScriptEnabled: false });
  await page.goto(TERMS, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const op = await page.evaluate(() =>
    [...document.querySelectorAll("[data-doc-reveal]")].map((el) =>
      Number(getComputedStyle(el).opacity),
    ),
  );
  if (op.length && op.every((o) => o > 0.99)) pass("JS off · every section visible");
  else fail("JS off · every section visible", JSON.stringify(op));
  await ctx.close();
}

// ── 9. read to the bottom — nothing may be stranded ──────────────────────────
{
  const [ctx, page] = await fresh();
  await page.goto(TERMS, { waitUntil: "commit" });
  await page.waitForTimeout(INTRO);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(2000);
  const op = await page.evaluate(() =>
    [...document.querySelectorAll("[data-doc-reveal]")].map((el) =>
      Number(getComputedStyle(el).opacity),
    ),
  );
  if (op.length && op.every((o) => o > 0.99)) pass("read to the bottom · no section stranded");
  else fail("read to the bottom · no section stranded", JSON.stringify(op));
  await ctx.close();
}

await browser.close();
console.log(
  failed
    ? `\n${failed} check(s) FAILED — a reveal is playing where nobody can see it\n`
    : "\nall arrival paths clean — every reveal runs on a page the visitor can see\n",
);
process.exit(failed ? 1 : 0);
