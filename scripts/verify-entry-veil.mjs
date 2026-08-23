// Entry-intro (S1.10) regression guard. Asserts the behaviours that make the
// opening sequence safe to ship, and the two design contracts it rests on.
//
//   Dev server must be running:
//   BASE_URL=http://localhost:3051 node scripts/verify-entry-veil.mjs
//
//   1. EVERY document load: the sequence is up at load and releases the page in
//      ≤ 5 s. The hard cap can never strand it.
//   2. A RELOAD plays it again. It is the brand's first frame, and the owner
//      wants it to be the brand's first frame every time — there is deliberately
//      no session claim. What must NOT replay is a remount inside a document
//      that already showed it (a locale switch, a client-side navigation), and
//      the `html[data-zveil="seen"]` attribute set on release is what draws that
//      line: it survives navigation and dies with the document.
//   3. CAPTURE CONTEXTS (?f*) and REDUCED MOTION: it never paints.
//   4. NO FADES. Nothing in the sequence animates `opacity`. This is a taste
//      rule the owner has stated plainly, and it is load-bearing here: every
//      appearance is a move, a draw, a flood or a thinning. Checked by walking
//      the held clock and reading computed opacity off every layer — a rule
//      that is only written in a comment is a rule that comes back.
//   5. ONE GEOMETRY. The drawn line and the liquid body render the SAME path
//      data, so the vector the visitor watches being drawn is exactly the form
//      that then comes alive. If these ever diverge, the flood will not
//      register with the trace and the whole read falls apart.
//   6. THE SKIP is a real, focusable button that leaves through the exit rather
//      than cutting.

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ...opts,
  });
  return { ctx, page: await ctx.newPage() };
};

// ── 1 + 2: first visit plays, same-session reload skips ──────────────────────
console.log("\n1. lifecycle");
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "commit" });
  await page.waitForSelector(".entry-veil", { state: "attached", timeout: 15000 });
  const playing = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !!v && getComputedStyle(v).display !== "none";
  });
  check(playing, "first visit: the sequence is up at load");

  const t0 = Date.now();
  await page
    .waitForFunction(() => !document.querySelector(".entry-veil"), {
      timeout: 6000,
    })
    .then(
      () =>
        check(
          Date.now() - t0 < 5200,
          `first visit: releases the page (${((Date.now() - t0) / 1000).toFixed(2)} s)`,
        ),
      () => check(false, "first visit: releases the page (≤ 5 s)"),
    );

  // A locale switch is the sharpest test of the in-document guard: it is a SOFT
  // navigation (the JS realm survives) that nonetheless crosses the root layout,
  // so React re-renders `<html>` and any attribute set on it imperatively is
  // gone. Guarding on `data-zveil` therefore looked right and replayed the whole
  // intro on every language toggle. Exercise the real control, not the flag.
  await page.evaluate(() => {
    window.__sameDoc = true;
  });
  await page.locator(".lang-opt:not(.is-active)").first().click();
  await page.waitForURL(/\/(pt|en)/, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const afterSwitch = await page.evaluate(() => ({
    sameDocument: !!window.__sameDoc,
    veil: !!document.querySelector(".entry-veil"),
  }));
  check(
    afterSwitch.sameDocument && !afterSwitch.veil,
    afterSwitch.sameDocument
      ? "a locale switch does NOT replay it — the in-document guard holds"
      : "a locale switch stayed in the same document (test premise)",
  );

  await page.reload({ waitUntil: "commit" });
  await page
    .waitForSelector(".entry-veil", { state: "attached", timeout: 15000 })
    .then(
      async () => {
        const up = await page.evaluate(() => {
          const v = document.querySelector(".entry-veil");
          return !!v && getComputedStyle(v).display !== "none";
        });
        check(up, "a reload plays it again — there is no session claim");
      },
      () => check(false, "a reload plays it again — there is no session claim"),
    );
  await ctx.close();
}

// ── capture contexts: the only pre-paint skip left ───────────────────────────
console.log("\n2. capture contexts");
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/${LOCALE}?ftier=full`, {
    waitUntil: "domcontentloaded",
  });
  const hidden = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !v || getComputedStyle(v).display === "none";
  });
  check(hidden, "any ?f* param renders the page deterministically — no intro");
  await ctx.close();
}

// ── 3: reduced motion never sees it ──────────────────────────────────────────
console.log("\n3. reduced motion");
{
  const { ctx, page } = await newPage({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "domcontentloaded" });
  const hidden = await page.evaluate(() => {
    const v = document.querySelector(".entry-veil");
    return !v || getComputedStyle(v).display === "none";
  });
  check(hidden, "reduced motion: it never paints");
  await ctx.close();
}

// ── 4 + 5 + 6: the design contracts, walked on the held clock ────────────────
console.log("\n4. contracts");
{
  const { ctx, page } = await newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/${LOCALE}?zintro=hold`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!window.__zintro, { timeout: 60000 });

  const SEL = [
    ".entry-veil",
    ".entry-veil-curtain",
    ".entry-veil-mark",
    ".entry-veil-stage",
    ".zi-body",
    ".zi-trace",
    ".zi-dot",
    ".zi-ring",
  ];
  const beats = [];
  for (let t = 0; t <= 3.45; t += 0.15) beats.push(Number(t.toFixed(2)));

  const report = await page.evaluate(
    async ({ sels, beats }) => {
      const faded = [];
      const geometry = [];
      for (const t of beats) {
        window.__zintro.seek(t);
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const o = Number(getComputedStyle(el).opacity);
          if (o < 0.999) faded.push({ t, sel, o });
        }
        const body = document.querySelector(".zi-body")?.getAttribute("d") || "";
        const trace =
          document.querySelector(".zi-trace")?.getAttribute("d") || "";
        if (body && trace && body !== trace) geometry.push(t);
      }
      return { faded, geometry, duration: window.__zintro.duration };
    },
    { sels: SEL, beats },
  );

  check(
    report.faded.length === 0,
    `no fades — every layer holds opacity 1 across ${beats.length} beats` +
      (report.faded.length
        ? `  (first: ${report.faded[0].sel} = ${report.faded[0].o} at ${report.faded[0].t}s)`
        : ""),
  );
  check(
    report.geometry.length === 0,
    "one geometry — the drawn line and the liquid body share the same path" +
      (report.geometry.length ? `  (diverged at ${report.geometry[0]}s)` : ""),
  );
  check(
    report.duration <= 4,
    `the score fits its budget — ${report.duration.toFixed(2)} s`,
  );
  check(errors.length === 0, `the sequence runs clean${errors.length ? `: ${errors[0].slice(0, 160)}` : ""}`);
  await ctx.close();
}

// ── the skip control ─────────────────────────────────────────────────────────
console.log("\n5. the skip");
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "commit" });
  await page.waitForSelector(".entry-veil-skip.is-ready", { timeout: 8000 });
  const usable = await page.evaluate(() => {
    const b = document.querySelector(".entry-veil-skip");
    const cs = getComputedStyle(b);
    return {
      tag: b.tagName,
      label: (b.textContent || "").trim().length > 0,
      focusable: b.tabIndex >= 0,
      hittable: cs.pointerEvents !== "none" && cs.visibility === "visible",
    };
  });
  check(usable.tag === "BUTTON", "the skip is a real button");
  check(usable.label, "the skip is labelled");
  check(usable.focusable && usable.hittable, "the skip is focusable and hittable");

  // Bounded on BOTH sides. Too fast is a jump cut; too slow means the skip did
  // not actually drive the exit and the hard cap released the page instead —
  // which is indistinguishable from a working skip if you only assert "it went
  // away eventually". It is, in fact, what shipped the first time.
  const SKIP_MIN = 250;
  const SKIP_MAX = 1600;
  const t0 = Date.now();
  await page.click(".entry-veil-skip");
  await page
    .waitForFunction(() => !document.querySelector(".entry-veil"), {
      timeout: 4000,
    })
    .then(
      () => {
        const dt = Date.now() - t0;
        check(
          dt > SKIP_MIN && dt < SKIP_MAX,
          `skipping runs the exit itself, not the hard cap (${dt} ms, want ${SKIP_MIN}–${SKIP_MAX})`,
        );
      },
      () => check(false, "skipping releases the page"),
    );
  await ctx.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} entry-intro check(s) FAILED`);
  process.exit(1);
}
console.log(
  "\nENTRY INTRO OK — plays every load, never fades, one geometry, skippable.",
);
