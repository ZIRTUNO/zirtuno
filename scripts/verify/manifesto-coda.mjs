/** S7 coda — the swell is measured, not eyeballed.
 *
 * The animation is a pure function of ScrollTrigger progress, so every stop
 * below is DETERMINISTIC: the same scroll position always produces the same
 * displacement. That is why this reads transforms instead of diffing pixels —
 * there is no settle to wait out and no frame-timing noise floor to clear.
 *
 * Three things it is really guarding:
 *   · the sea actually rolls (words differ from each other at the head, and
 *     all reach dead flat by the end);
 *   · nothing fades (opacity is 1 at every stop, at every word);
 *   · the standing shadow SURVIVED the split. `.manifesto-line` is a member of
 *     the `--copy-shadow-standing` list in globals.css; if that class is ever
 *     renamed, or SplitText is ever given a mask, this copy loses its
 *     separation from the liquid and this assertion is the thing that says so.
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/manifesto-coda";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const LOC = process.env.LOC ?? "pt";
const STOPS = (process.env.STOPS ?? "0,0.25,0.5,0.75,1").split(",").map(Number);

// Must mirror the reading window in ManifestoQuote.tsx.
const START = 0.88;
const END = 0.34;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
try {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/${LOC}?ftier=full`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector(".liquid-journey")?.dataset.fieldReady === "true",
  );
  await page.evaluate(() => document.fonts.ready);
  // Park the custom cursor off-stage so it is not composited into a capture.
  await page.mouse.move(-20, -20);
  await page.waitForSelector(".manifesto-word");

  const report = [];
  for (const p of STOPS) {
    // Lenis rewrites scrollY every frame, so a scrollTo is not authoritative.
    // Converge with the wheel the way the origin captures do — but wait out
    // the lerp between pushes. At lerp 0.09 a wheel event needs ~30 frames to
    // land, and stacking them inside that window overshoots the target.
    for (let i = 0; i < 30; i++) {
      const delta = await page.evaluate(
        ([start, end, progress, height]) => {
          const fig = document.querySelector(".manifesto");
          const want = (start - (start - end) * progress) * height;
          return fig.getBoundingClientRect().top - want;
        },
        [START, END, p, H],
      );
      if (Math.abs(delta) < 1.5) break;
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(Math.abs(delta) > 400 ? 420 : 260);
    }
    await page.waitForTimeout(500);

    const row = await page.evaluate(() => {
      const yOf = (el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return m.m42;
      };
      const words = [...document.querySelectorAll(".manifesto-word")];
      const rule = document.querySelector(".manifesto-rule");
      const line = document.querySelector(".manifesto-line");
      const fig = document.querySelector(".manifesto");
      return {
        top: Math.round(fig.getBoundingClientRect().top),
        words: words.length,
        text: words.map((w) => w.textContent).join(" "),
        ys: words.map((w) => Number(yOf(w).toFixed(2))),
        latinY: Number(yOf(document.querySelector(".manifesto-latin")).toFixed(2)),
        citeY: Number(yOf(document.querySelector(".manifesto-cite")).toFixed(2)),
        ruleX: Number(
          new DOMMatrixReadOnly(getComputedStyle(rule).transform).m11.toFixed(3),
        ),
        minOpacity: Math.min(...words.map((w) => Number(getComputedStyle(w).opacity))),
        shadow: getComputedStyle(words[0]).textShadow,
        lineShadow: getComputedStyle(line).textShadow,
        // A peer in the same `--copy-shadow-standing` list. The list is turned
        // off wholesale at narrow widths, where the liquid is not behind the
        // copy in the same way — so "has a shadow" is not an absolute truth to
        // assert, but "has whatever its peers have" is.
        peerShadow: (() => {
          const peer = document.querySelector(".origin-closing");
          return peer ? getComputedStyle(peer).textShadow : null;
        })(),
        fontPx: Math.round(parseFloat(getComputedStyle(line).fontSize)),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    await page.screenshot({
      path: `${OUT}/${LOC}-${W}-${Math.round(p * 100).toString().padStart(3, "0")}.png`,
    });

    const swing = Math.max(...row.ys.map(Math.abs));
    const spread = Math.max(...row.ys) - Math.min(...row.ys);
    report.push({ p, swing: +swing.toFixed(2), spread: +spread.toFixed(2), ...row });

    // Nothing is ever hidden — the reveal is displacement, never opacity.
    assert.equal(row.minOpacity, 1, `p=${p}: a word is not fully opaque`);
    // The split did not cost this copy its separation from the liquid: a word
    // carries exactly what the paragraph it came out of carries.
    assert.equal(
      row.shadow,
      row.lineShadow,
      `p=${p}: split changed the standing shadow`,
    );
    // And the paragraph is separated wherever its peers in the same list are.
    // This is what fails if `.manifesto-line` is ever renamed out of that
    // forty-selector list in globals.css.
    if (row.peerShadow && row.peerShadow !== "none") {
      assert.notEqual(
        row.lineShadow,
        "none",
        `p=${p}: peers have a standing shadow and the coda does not`,
      );
    }
    assert.ok(row.overflow <= 1, `p=${p}: horizontal overflow ${row.overflow}`);
    console.log(
      `p=${p} top=${row.top} swing=${swing.toFixed(1)}px spread=${spread.toFixed(1)}px rule=${row.ruleX}`,
    );
  }

  const head = report[0];
  const tail = report[report.length - 1];

  // The split is the whole sentence, in order.
  assert.ok(head.words >= 8, `expected a split quote, got ${head.words} words`);

  // A SEA, not a block: at the head the words disagree with each other by a
  // real fraction of the swell. A spread near zero would mean CRESTS is too
  // low and the quote is heaving as one slab.
  assert.ok(
    head.spread > head.fontPx * 0.15,
    `head spread ${head.spread}px is too flat for a wave at ${head.fontPx}px type`,
  );
  assert.ok(
    head.swing > head.fontPx * 0.1,
    `head swing ${head.swing}px is too small to read as swell`,
  );

  // DEAD FLAT at the end — including the two riders the split does not own.
  assert.ok(tail.swing < 0.5, `tail swing ${tail.swing}px: the sea never calmed`);
  assert.ok(Math.abs(tail.latinY) < 0.5, `latin never settled (${tail.latinY}px)`);
  assert.ok(Math.abs(tail.citeY) < 0.5, `attribution never settled (${tail.citeY}px)`);
  assert.ok(tail.ruleX > 0.98, `rule never drew out (scaleX ${tail.ruleX})`);

  // Monotonic calming: every stop is quieter than the one before it.
  for (let i = 1; i < report.length; i++) {
    assert.ok(
      report[i].swing <= report[i - 1].swing + 0.75,
      `swell grew between p=${report[i - 1].p} and p=${report[i].p}`,
    );
  }

  assert.deepEqual(errors, [], "no runtime errors");

  // ── REDUCED MOTION ────────────────────────────────────────────────────────
  // The resting state must be the WHOLE quote, at full contrast, with the rule
  // drawn — never a split, never a hairline stuck at zero width. Nothing here
  // may depend on an animation having run.
  const still = await context.newPage();
  await still.emulateMedia({ reducedMotion: "reduce" });
  await still.goto(`${BASE}/${LOC}?ftier=full`, { waitUntil: "load" });
  await still.evaluate(() => document.fonts.ready);
  await still.waitForTimeout(1200);
  const rest = await still.evaluate(() => {
    const line = document.querySelector(".manifesto-line");
    const rule = document.querySelector(".manifesto-rule");
    return {
      words: document.querySelectorAll(".manifesto-word").length,
      text: line.textContent.trim(),
      lineTransform: getComputedStyle(line).transform,
      ruleX: new DOMMatrixReadOnly(getComputedStyle(rule).transform).m11,
      ruleOpacity: Number(getComputedStyle(rule).opacity),
      cite: document.querySelector(".manifesto-cite").textContent.trim(),
    };
  });
  await still.close();
  assert.equal(rest.words, 0, "reduced motion must not split the quote");
  assert.equal(rest.lineTransform, "none", "reduced motion must not transform copy");
  assert.equal(rest.ruleX, 1, `reduced motion left the rule at scaleX ${rest.ruleX}`);
  assert.ok(rest.text.length > 20, "the whole quote is present at rest");
  assert.ok(rest.cite.length > 5, "the attribution is present at rest");

  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\nOK — coda calms from ${head.swing}px to ${tail.swing}px`);
  console.log(`quote: ${head.text}`);
  console.log(`reduced motion: unsplit, untransformed, rule at ${rest.ruleX}`);
} finally {
  await browser.close();
}
