// R6 disclosure regression guard — the orchestrated easeReverse panel.
//
// The claim under test is not "it animates". It is that the panel opens and
// closes on DIFFERENT curves, and that nothing about the native <details>
// contract was traded away to get that. So this asserts, in order:
//
//   1. the additive contract — data-disclose only after hydration
//   2. the open ramps (no snap) and lands exactly on the slab's own height
//   3. the mark OVERSHOOTS past 1, proving back.out(2.4) actually ran
//   4. the close starts moving on the first frame — no dead zone, which is
//      what a tween scheduled to end after the pane's would create
//   5. the close is not the open played backwards. This is the real gate: at
//      the midpoint of the collapse `easeReverse: "power2.out"` puts the pane
//      at ~25% of the slab, while the same tween reversed without it would
//      replay the quintic-out entry and still be at ~97%. Nothing between
//      those is ambiguous, so a dropped easeReverse fails hard rather than
//      degrading into a vibe.
//   6. the content outlives the exit — `open` flips only once height hits 0
//   7. reduced motion and no-JS both fall back to a plain, instant <details>
//
//   BASE_URL=http://localhost:PORT node scripts/verify-disclose.mjs

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
// any ?f* param renders the page deterministically and skips the entry intro
const URL = `${BASE}/${LOCALE}?ftier=full`;
const OUT = "captures/disclose";

const SEL = "#services details.disclose";
let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);

/** Click the summary and sample the pane every frame for `ms`. */
const record = (page, ms) =>
  page.evaluate(
    async ({ sel, ms }) => {
      const details = document.querySelector(sel);
      const summary = details.querySelector("summary");
      const pane = details.querySelector(".disclose-pane");
      const body = details.querySelector(".disclose-body");
      const samples = [];

      await new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          const t = performance.now() - t0;
          samples.push({
            t,
            h: pane.getBoundingClientRect().height,
            mark: parseFloat(
              getComputedStyle(details).getPropertyValue("--mark-turn"),
            ),
            open: details.open,
          });
          if (t < ms) requestAnimationFrame(tick);
          else resolve();
        };
        summary.click();
        requestAnimationFrame(tick);
      });

      return { samples, slab: body.offsetHeight };
    },
    { sel: SEL, ms },
  );

/** Click the summary and track the HEADLINE's viewport position every frame.
 *  Endpoint-only checks would miss the failure that matters here — the layout's
 *  response to the pane height has a knee in it, so a mis-fitted compensation
 *  drifts away and comes back, landing clean at both ends. */
const trackHeadline = (page, ms) =>
  page.evaluate(
    async ({ sel, ms }) => {
      const details = document.querySelector(sel);
      const name = details.closest(".pillar").querySelector(".pillar-name");
      const summary = details.querySelector("summary");
      const pillar = details.closest(".pillar");
      const pane = details.querySelector(".disclose-pane");
      const tops = [];
      const inPillar = [];
      const scrolls = [];
      const heights = [];

      await new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          const top = name.getBoundingClientRect().top;
          tops.push(top);
          inPillar.push(top - pillar.getBoundingClientRect().top);
          scrolls.push(window.scrollY);
          heights.push(pane.getBoundingClientRect().height);
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve();
        };
        summary.click();
        requestAnimationFrame(tick);
      });

      // A headline that never moved because the panel never moved is not a
      // passing pin, it is a vacuous test — hand back the travel so the caller
      // can insist something actually happened.
      const span = (a) => Math.max(...a.map((v) => Math.abs(v - a[0])));
      return {
        tops,
        worstViewport: span(tops),
        worstInPillar: span(inPillar),
        scrollDrift: span(scrolls),
        travel: Math.max(...heights) - Math.min(...heights),
        slab: details.querySelector(".disclose-body").offsetHeight,
      };
    },
    { sel: SEL, ms },
  );

// ── the live path ──────────────────────────────────────────────────────────
{
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 860 } })
  ).newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(SEL, { state: "attached", timeout: 40000 });
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.dataset.disclose === "live",
    SEL,
    { timeout: 20000 },
  );

  console.log("\nlive path");
  check(true, "data-disclose=live is set after hydration");

  // put the pillar on screen so the captures are of something
  await page.evaluate(
    (sel) =>
      document
        .querySelector(sel)
        .closest(".pillar")
        .scrollIntoView({ block: "center", behavior: "instant" }),
    SEL,
  );
  await page.waitForTimeout(900);

  const closedShot = `${OUT}/01-closed.png`;
  await page.locator(SEL).first().screenshot({ path: closedShot });

  // ── OPEN ────────────────────────────────────────────────────────────────
  const opened = await record(page, 1100);
  const oh = opened.samples.map((s) => s.h);
  const slab = opened.slab;

  // 0.6, not 0.25: what this rules out is the panel PAINTING AT FULL HEIGHT
  // before it collapses, which would put the first sample at ~slab. The budget
  // has to absorb a dropped startup frame instead — `power4.out` is front
  // loaded enough that two lost frames already put it near 50%.
  check(oh[0] < slab * 0.6, "the open starts collapsed (no full-height flash)", `${oh[0].toFixed(1)}px of ${slab}px`);
  check(
    oh.every((h, i) => i === 0 || h >= oh[i - 1] - 0.6),
    "the open never goes backwards",
  );
  const settled = oh[oh.length - 1];
  check(
    Math.abs(settled - slab) < 1.5,
    "it lands exactly on the slab's own height",
    `pane ${settled.toFixed(1)}px vs slab ${slab}px`,
  );
  const midOpen = opened.samples.filter((s) => s.h > 2 && s.h < slab - 2).length;
  check(midOpen >= 4, "the open is a ramp, not a snap", `${midOpen} intermediate frames`);

  const markPeak = Math.max(...opened.samples.map((s) => s.mark));
  check(markPeak > 1.02, "the mark overshoots — back.out(2.4) ran", `peak ${markPeak.toFixed(3)}`);
  check(
    Math.abs(opened.samples[opened.samples.length - 1].mark - 1) < 0.001,
    "the mark settles exactly on 1",
  );

  await page.locator(SEL).first().screenshot({ path: `${OUT}/02-open.png` });

  // ── CLOSE ───────────────────────────────────────────────────────────────
  // NOTE ON MEASURING A CLOSED PANEL. Once `open` is dropped, the pane sits
  // inside a `content-visibility: hidden` subtree and Chrome keeps serving its
  // LAST laid-out rect — a closed panel still reports 482px. Every height
  // reading below is therefore taken only from frames where `open` is still
  // true; the closed state is asserted from the attribute, never the box.
  const closed = await record(page, 1100);
  const live = closed.samples.filter((s) => s.open);

  check(
    live.length > 0 && live[live.length - 1].h <= 1.5,
    "the collapse reaches 0 before `open` is dropped",
    `${live.length ? live[live.length - 1].h.toFixed(1) : "n/a"}px on the last open frame`,
  );
  check(
    live.filter((s) => s.h > 1 && s.h < slab - 1).length >= 4,
    "the content outlives the exit — mid-collapse frames render while still open",
    `${live.filter((s) => s.h > 1 && s.h < slab - 1).length} frames`,
  );
  check(
    !closed.samples[closed.samples.length - 1].open,
    "`open` is dropped once the exit finishes",
  );

  // timings, measured from the samples themselves
  const first = (arr, done) => arr.find(done)?.t ?? Infinity;
  const openMs = first(opened.samples, (s) => s.h >= slab - 1.5);
  const closeMs = first(closed.samples, (s) => !s.open || s.h <= 1.5);
  check(
    closeMs < openMs,
    "leaving is quicker than arriving",
    `open ${openMs.toFixed(0)}ms · close ${closeMs.toFixed(0)}ms`,
  );
  // The pane must be the LONGEST tween or the reverse opens with a dead zone
  // where nothing moves. Counted in FRAMES, not milliseconds: the liquid can
  // starve rAF on this page, and a single dropped frame was enough to make a
  // 50ms budget flake at 73ms while the animation itself was fine.
  const moveFrame = closed.samples.findIndex((s) => s.h < slab - 2);
  const moveMs = first(closed.samples, (s) => s.h < slab - 2);
  check(
    moveFrame >= 0 && moveFrame <= 2,
    "the close starts moving immediately — no dead zone at the head of the reverse",
    `first drop on frame ${moveFrame} (${moveMs.toFixed(0)}ms)`,
  );

  // ── THE easeReverse GATE ────────────────────────────────────────────────
  // Halfway through the collapse, where is the height? `power2.out` predicts
  // 25% of the slab. The same tween reversed WITHOUT easeReverse would replay
  // the quintic-out entry backwards and still be at ~97%. Nothing between
  // those two numbers is ambiguous, so a dropped easeReverse fails here.
  const mid = live.find((s) => s.t >= moveMs + (closeMs - moveMs) * 0.5);
  const midPct = mid ? mid.h / slab : 1;
  check(
    midPct < 0.45,
    "the close is NOT the open mirrored (easeReverse is live)",
    `${(midPct * 100).toFixed(1)}% of slab at the midpoint — power2.out predicts 25%, a mirrored entry ~97%`,
  );

  await page.locator(SEL).first().screenshot({ path: `${OUT}/03-reclosed.png` });

  // ── INTERRUPTION ────────────────────────────────────────────────────────
  // easeReverse remaps from the playhead, not from the tween's recorded
  // endpoint, so catching an open half way should collapse from the height on
  // screen. If that ever regresses the panel will visibly SNAP to full height
  // before closing, which is what this measures.
  const cut = await page.evaluate(
    async ({ sel, at }) => {
      const details = document.querySelector(sel);
      const summary = details.querySelector("summary");
      const pane = details.querySelector(".disclose-pane");
      const slab = details.querySelector(".disclose-body").offsetHeight;
      const samples = [];
      let hAtCut = null;
      let tAtCut = null;

      await new Promise((resolve) => {
        const t0 = performance.now();
        let cutDone = false;
        const tick = () => {
          const t = performance.now() - t0;
          const h = pane.getBoundingClientRect().height;
          samples.push({ t, h, open: details.open });
          if (!cutDone && t >= at) {
            cutDone = true;
            hAtCut = h;
            tAtCut = t;
            summary.click(); // reverse mid-open
          }
          if (t < 1300) requestAnimationFrame(tick);
          else resolve();
        };
        summary.click();
        requestAnimationFrame(tick);
      });

      return { samples, slab, hAtCut, tAtCut };
    },
    { sel: SEL, at: 150 },
  );

  check(
    cut.hAtCut > 10 && cut.hAtCut < cut.slab - 10,
    "the open really was caught mid-flight",
    `${cut.hAtCut.toFixed(1)}px of ${cut.slab}px`,
  );
  // `open` frames only — see the note above: once the attribute is dropped the
  // rect is a content-visibility ghost that reports the natural height and
  // would read as a snap that never happened.
  const after = cut.samples.filter((s) => s.t > cut.tAtCut && s.open);
  const peak = Math.max(...after.map((s) => s.h));
  check(
    peak <= cut.hAtCut + 3,
    "an interrupted open collapses from where it was — no snap to full height",
    `peak after the cut ${peak.toFixed(1)}px vs ${cut.hAtCut.toFixed(1)}px at the cut`,
  );
  check(
    !cut.samples[cut.samples.length - 1].open,
    "the interrupted open still finishes closed",
  );

  // ── FIND-IN-PAGE ────────────────────────────────────────────────────────
  // A UA expanding the panel for an in-page match is not a gesture. The
  // component must take the state, drop any inline height a previous close
  // left behind, and let the content simply be there.
  const found = await page.evaluate(async (sel) => {
    const details = document.querySelector(sel);
    details.open = true; // what `hidden=until-found` does
    await new Promise((r) => setTimeout(r, 400));
    const pane = details.querySelector(".disclose-pane");
    return {
      inline: pane.getAttribute("style") ?? "",
      h: pane.getBoundingClientRect().height,
      slab: details.querySelector(".disclose-body").offsetHeight,
    };
  }, SEL);

  check(found.inline === "", "no inline height survives a non-gesture open", `style="${found.inline}"`);
  check(
    Math.abs(found.h - found.slab) < 1.5,
    "a find-in-page open shows the whole panel, unanimated",
    `${found.h.toFixed(1)}px of ${found.slab}px`,
  );

  // ── THE PIN ─────────────────────────────────────────────────────────────
  // Close it again, then watch the headline across a full open and a full
  // close. It must not move at ANY frame — the stage centres this column, so
  // without compensation opening it levers the name 165.7px upward.
  await page.evaluate((sel) => document.querySelector(sel).querySelector("summary").click(), SEL);
  await page.waitForTimeout(900);
  // re-settle the scroll: the cycles above changed the document height, and a
  // browser scroll-anchoring correction landing mid-measurement would be read
  // as pin error. The pillar-relative number below is immune to it either way,
  // but the viewport number is only meaningful from a settled scroll.
  await page.evaluate(
    (sel) =>
      document
        .querySelector(sel)
        .closest(".pillar")
        .scrollIntoView({ block: "center", behavior: "instant" }),
    SEL,
  );
  await page.waitForTimeout(1200);

  for (const [tag, ms] of [["open", 1200], ["close", 1200]]) {
    const { tops, travel, slab, worstViewport, worstInPillar, scrollDrift } =
      await trackHeadline(page, ms);
    check(
      // Half, deliberately loose: this separates "nothing happened" (travel ~0,
      // the vacuous pass this exists to catch) from "the panel animated". It is
      // not a precision measurement — dropped startup frames legitimately cost
      // it 100px or more, and the checks above already own the exact endpoints.
      travel > slab * 0.5,
      `the ${tag} actually ran (guards the pin check against passing vacuously)`,
      `pane travelled ${travel.toFixed(0)}px of ${slab}px`,
    );
    check(
      worstInPillar < 2,
      `the headline holds its line through the ${tag} — every frame, not just the ends`,
      `${worstInPillar.toFixed(2)}px within the pillar over ${tops.length} frames ` +
        `(viewport ${worstViewport.toFixed(2)}px, of which scroll ${scrollDrift.toFixed(2)}px)`,
    );
    await page.waitForTimeout(600);
  }

  await page.context().close();
}

// ── reduced motion ─────────────────────────────────────────────────────────
{
  const page = await (
    await browser.newContext({
      viewport: { width: 1280, height: 860 },
      reducedMotion: "reduce",
    })
  ).newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(SEL, { state: "attached", timeout: 40000 });
  await page.waitForTimeout(2500); // let hydration settle before claiming absence

  console.log("\nreduced motion");
  const state = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    d.querySelector("summary").click();
    const pane = d.querySelector(".disclose-pane");
    return {
      flag: d.dataset.disclose ?? null,
      open: d.open,
      h: pane.getBoundingClientRect().height,
      slab: d.querySelector(".disclose-body").offsetHeight,
      inline: pane.getAttribute("style") ?? "",
    };
  }, SEL);

  check(state.flag === null, "no data-disclose — the choreography never mounts", `flag=${state.flag}`);
  check(state.open, "the panel still opens");
  check(
    Math.abs(state.h - state.slab) < 1.5,
    "it is simply THERE, at full height, in the same task as the press",
    `${state.h.toFixed(1)}px of ${state.slab}px`,
  );
  check(state.inline === "", "no inline styles left on the pane", `style="${state.inline}"`);
  await page.context().close();
}

await browser.close();

// ── the server HTML ────────────────────────────────────────────────────────
// Read over the wire rather than through a JS-disabled browser context: this
// is exactly the bytes a crawler or a no-JS reader gets, and rule 12 says the
// commercial substance has to be in them.
{
  console.log("\nserver HTML (no JS)");
  const html = await (await fetch(URL)).text();

  check(!html.includes("data-disclose="), "no data-disclose in the served markup");
  check(html.includes("<details class=\"disclose pillar-detail\""), "the panel ships as a native <details>");

  const count = (re) => (html.match(re) ?? []).length;
  check(count(/class="pillar-block"/g) === 21, "21 is/solves/creates rows (7 pillars × 3)", `${count(/class="pillar-block"/g)}`);
  check(count(/data-disclose-row="true"/g) === 35, "35 stagger rows (7 pillars × 5)", `${count(/data-disclose-row="true"/g)}`);
  check(count(/class="disclose-pane"/g) === 7, "7 panes", `${count(/class="disclose-pane"/g)}`);
  check(count(/pillar-cap /g) > 0, "the capability set is in the server HTML");
}

console.log(`\ncaptures → ${OUT}/`);
if (failures) {
  console.error(`\n${failures} disclosure check(s) FAILED`);
  process.exit(1);
}
console.log("\nall disclosure checks passed");
// fetch keeps a live handle open; exit rather than let libuv assert on teardown
process.exit(0);
