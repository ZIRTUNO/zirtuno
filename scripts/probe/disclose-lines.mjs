// R6 · THE DISCLOSURE'S LINE SPLIT — the full drill.
//
// The panel's copy is split into its real line boxes when it opens, poured in
// on a masked stagger, and un-split the instant the open settles. Every claim
// in that sentence is load-bearing and every one of them is checked here.
//
//   BASE_URL=http://localhost:PORT node scripts/probe/disclose-lines.mjs
//
// Curves are read off a SLOWED clock. A Playwright-driven Chromium sharing a
// core with a live WebGL field renders the 620ms open in a handful of frames,
// which is not enough samples to say anything about a curve; GSAP reads
// `Date.now` (gsap-core.js `_getTime = Date.now` — NOT performance.now), so
// dividing that clock stretches the timeline across many more real frames
// without touching a line of shipped code. The samples carry the same slowed
// timestamps, so every number below is still in timeline seconds.
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "pt";
const SEL = "#services details.disclose";
const SLOW = 8;

/** Total length of the open, from Disclose.tsx's own timeline. */
const OPEN = 0.62;
/** Where the pour is scheduled to have landed. */
const POUR_END = 0.57;

let failures = 0;
const pass = (name, detail = "") =>
  console.log(`  ✓ ${name}${detail ? `  ${detail}` : ""}`);
const fail = (name, detail) => {
  failures++;
  console.log(`  ✗ ${name}  ${detail}`);
};
const check = (ok, name, detail) => (ok ? pass(name, detail) : fail(name, detail));
const head = (t) => console.log(`\n${t}`);

const url = (q = "") => `${BASE}/${LOCALE}?ftier=none${q}`;

const browser = await chromium.launch(LAUNCH);

/** A page parked on the first pillar with the disclosure hydrated and live. */
async function stage({ width = 1280, height = 900, slow = 1, reduced = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  if (slow > 1) {
    await context.addInitScript((k) => {
      const raw = Date.now;
      const t0 = raw();
      Date.now = () => t0 + (raw() - t0) / k;
    }, slow);
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (sel) => !!document.querySelector(sel),
    SEL,
    { timeout: 30000 },
  );
  if (!reduced) {
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.dataset.disclose === "live",
      SEL,
      { timeout: 30000 },
    );
  }
  await page.evaluate(
    (sel) => document.querySelector(sel).closest(".pillar").scrollIntoView({ block: "center" }),
    SEL,
  );
  await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 30000 });
  await page.waitForTimeout(900 * slow);
  return { page, context, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE SPLIT ITSELF — is it the real line boxes, and does it cost nothing
// ═══════════════════════════════════════════════════════════════════════════
head("THE SPLIT · 1280px");
{
  const { page, context, errors } = await stage();

  // NOTHING in this section touches `details.open` directly. An open this
  // component did not initiate is a teardown (that is the contract, and it is
  // checked in §3) — poking it here would clearProps the rows, and the
  // "settled panel === rendered panel" comparison below would then be
  // measuring the probe's own footprint instead of the component's.
  const rest = await page.evaluate((sel) => {
    const body = document.querySelector(sel).querySelector(".disclose-body");
    return {
      targets: body.querySelectorAll("[data-disclose-lines]").length,
      // everything but the sheen, which carries a GSAP transform for the life
      // of the open by design (its opacity is CSS's job, its travel is not)
      html: [...body.children]
        .filter((el) => !el.classList.contains("disclose-sheen"))
        .map((el) => el.outerHTML)
        .join(""),
    };
  }, SEL);

  check(rest.targets === 8, "blocks marked for splitting", `${rest.targets} (3 labels · 3 answers · caps · accent)`);

  // open, and freeze the truth while the split is standing
  const split = await page.evaluate(
    (sel) =>
      new Promise((res) => {
        const d = document.querySelector(sel);
        const body = d.querySelector(".disclose-body");
        d.querySelector("summary").click();
        // one frame in: the split is made synchronously on the press, so it is
        // already standing, and nothing has settled yet
        requestAnimationFrame(() => {
          const marked = [...body.querySelectorAll("[data-disclose-lines]")];
          const lines = [...body.querySelectorAll(".disclose-line")];
          const masks = [...body.querySelectorAll(".disclose-line-mask")];

          // descender safety, per split block. In a line box of height L over a
          // font whose bounding box is C = ascent + descent, the baseline sits
          // (L−C)/2 + ascent from the top, so the room under it inside the clip
          // is (L−C)/2 + descent. Ink reaches actualBoundingBoxDescent. The
          // margin between the two is what the clip may not eat.
          const ctx = document.createElement("canvas").getContext("2d");
          const room = marked.map((el) => {
            const cs = getComputedStyle(el);
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
            const m = ctx.measureText(el.textContent);
            const L = parseFloat(cs.lineHeight);
            const C = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
            const half = (L - C) / 2;
            return {
              tag: el.className || el.tagName.toLowerCase(),
              below: +(half + m.fontBoundingBoxDescent - m.actualBoundingBoxDescent).toFixed(2),
              above: +(half + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent).toFixed(2),
            };
          });

          res({
            lines: lines.length,
            masks: masks.length,
            bodyH: body.offsetHeight,
            // every mask is exactly its line's box, and clips rather than scrolls
            clip: masks.every((m) => getComputedStyle(m).overflow === "clip"),
            fits: masks.every(
              (m) => Math.abs(m.getBoundingClientRect().height - m.firstElementChild.getBoundingClientRect().height) < 0.5,
            ),
            // the block's OWN textContent, which is the whole point: the
            // wrappers went in around the text, not through it
            texts: marked.map((el) => el.textContent.replace(/\s+/g, " ").trim()),
            baselines: [...body.querySelectorAll(".pillar-block")].map((b) => {
              const dt = b.querySelector("dt").getBoundingClientRect();
              const dd = b.querySelector("dd").getBoundingClientRect();
              return +(dt.top - dd.top).toFixed(2);
            }),
            dots: [...body.querySelectorAll(".pillar-cap")].filter(
              (c) => getComputedStyle(c, "::after").content !== "none",
            ).length,
            // aria: "none" — the plugin must not have hidden a word of it
            hidden: body.querySelectorAll("[aria-hidden]:not(.disclose-sheen)").length,
            labelled: body.querySelectorAll("[aria-label]").length,
            capsSplitInside: body.querySelectorAll(".pillar-cap .disclose-line").length,
            room,
          });
        });
      }),
    SEL,
  );

  check(split.lines > 8, "copy split into real line boxes", `${split.lines} lines from 8 blocks`);
  check(split.masks === split.lines, "one mask per line", `${split.masks} masks`);
  check(split.clip, "masks clip, never scroll", "overflow: clip on every mask");
  check(split.fits, "mask box === line box", "no mask taller or shorter than the line it clips");
  // (measured against the settled panel, further down — same page, no poking)
  check(split.capsSplitInside === 0, "chips are never opened up", "ignore: .pillar-cap holds");
  check(
    split.hidden === 0 && split.labelled === 0,
    "no copy leaves the accessibility tree",
    "no aria-hidden, no aria-label added",
  );
  const tightBelow = Math.min(...split.room.map((r) => r.below));
  const tightAbove = Math.min(...split.room.map((r) => r.above));
  check(
    tightBelow > 0 && tightAbove > 0,
    "no glyph is clipped by its own mask",
    `tightest ${tightBelow.toFixed(2)}px under the baseline · ${tightAbove.toFixed(2)}px over it`,
  );

  // ── and the panel a reader actually reads ──────────────────────────────
  await page.waitForFunction(
    (sel) => document.querySelector(sel).querySelector(".disclose-pane").style.height === "auto",
    SEL,
    { timeout: 15000 },
  );
  // The settled panel IS the resting panel — so this is also where the
  // un-split truth gets measured, on the real thing rather than on a poked one.
  const settled = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    const body = d.querySelector(".disclose-body");
    const pane = d.querySelector(".disclose-pane");
    return {
      lines: body.querySelectorAll(".disclose-line").length,
      html: [...body.children]
        .filter((el) => !el.classList.contains("disclose-sheen"))
        .map((el) => el.outerHTML)
        .join(""),
      paneH: Math.round(pane.getBoundingClientRect().height),
      bodyH: body.offsetHeight,
      paneStyle: pane.style.height,
      texts: [...body.querySelectorAll("[data-disclose-lines]")].map((el) =>
        el.textContent.replace(/\s+/g, " ").trim(),
      ),
      // the label/answer baseline delta is the number `align-items: baseline`
      // exists to produce; a mask that synthesised its own baseline would move it
      baselines: [...body.querySelectorAll(".pillar-block")].map((b) => {
        const dt = b.querySelector("dt").getBoundingClientRect();
        const dd = b.querySelector("dd").getBoundingClientRect();
        return +(dt.top - dd.top).toFixed(2);
      }),
      dots: [...body.querySelectorAll(".pillar-cap")].filter(
        (c) => getComputedStyle(c, "::after").content !== "none",
      ).length,
    };
  }, SEL);

  check(settled.lines === 0, "the split does not survive the animation", "no line boxes left standing");
  check(
    settled.html === rest.html,
    "the settled panel is the rendered panel",
    "innerHTML identical to the server's, character for character",
  );
  check(
    split.texts.join("|") === settled.texts.join("|"),
    "not one character moved",
    "split text === resting text, block for block",
  );
  check(
    split.bodyH === settled.bodyH,
    "the split costs no height",
    `${split.bodyH}px split · ${settled.bodyH}px resting`,
  );
  check(
    split.baselines.join(",") === settled.baselines.join(","),
    "label/answer baselines hold through the mask",
    `Δ ${split.baselines.join(", ")}px split · ${settled.baselines.join(", ")}px resting`,
  );
  check(
    split.dots === settled.dots && split.dots === 5,
    "every chip separator survives being re-parented",
    `${split.dots} of 6 chips carry a separator, split and settled`,
  );
  check(
    settled.paneStyle === "auto" && Math.abs(settled.paneH - settled.bodyH) < 1,
    "the height is handed back to the document",
    `pane ${settled.paneH}px = body ${settled.bodyH}px, height: auto`,
  );

  // ── RESPONSIVE, at rest: the thing a pinned pixel height cannot do ──────
  await page.setViewportSize({ width: 820, height: 900 });
  await page.waitForTimeout(600);
  const reflow = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    const body = d.querySelector(".disclose-body");
    const pane = d.querySelector(".disclose-pane");
    return {
      paneH: Math.round(pane.getBoundingClientRect().height),
      bodyH: body.offsetHeight,
      clipped: body.offsetHeight - Math.round(pane.getBoundingClientRect().height),
    };
  }, SEL);
  check(
    Math.abs(reflow.clipped) < 1,
    "an open panel reflows with the window",
    `1280→820px: pane ${reflow.paneH}px tracks body ${reflow.bodyH}px`,
  );

  check(errors.length === 0, "no page errors", errors.join(" | ") || "clean");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE CURVES — the pour, and easeReverse on the way back
// ═══════════════════════════════════════════════════════════════════════════
head("THE CURVES · 1280px, clock ÷" + SLOW);
{
  const { page, context, errors } = await stage({ slow: SLOW });

  /** Sample the pane and every line for `seconds` of TIMELINE time.
   *
   *  `h` is 0 whenever <details> is shut, and that is not pedantry: a closed
   *  <details> puts `content-visibility: hidden` on its content, and Chrome
   *  keeps handing out the LAST RENDERED box for skipped content — so a naive
   *  reading has the pane springing back to full height the instant the close
   *  finishes, and the whole curve reads backwards. */
  const record = async (seconds) =>
    page.evaluate(
      ([sel, seconds]) =>
        new Promise((res) => {
          const d = document.querySelector(sel);
          const body = d.querySelector(".disclose-body");
          const pane = d.querySelector(".disclose-pane");
          const h = () => (d.open ? pane.getBoundingClientRect().height : 0);
          const out = [];
          const h0 = h();
          const t0 = Date.now();
          const y = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
          const tick = () => {
            const lines = [...body.querySelectorAll(".disclose-line")];
            out.push({
              t: (Date.now() - t0) / 1000,
              h: h(),
              n: lines.length,
              // each line's remaining travel, as a fraction of its own box
              y: lines.map((l) => +(y(l) / l.getBoundingClientRect().height).toFixed(4)),
            });
            if ((Date.now() - t0) / 1000 < seconds) requestAnimationFrame(tick);
            else res({ h0, samples: out });
          };
          d.querySelector("summary").click();
          requestAnimationFrame(tick);
        }),
      [SEL, seconds],
    );

  const { samples: openRun } = await record(OPEN + 0.06);
  check(openRun.length > 30, "enough samples to say anything", `${openRun.length} frames over ${OPEN}s`);

  const finalH = openRun[openRun.length - 1].h;
  const paneAt = (t) => {
    const s = openRun.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    return s.h / finalH;
  };
  // power4.out is 97% of the way there by its own midpoint — that is the curve,
  // and it is the whole reason the close may not mirror it.
  check(paneAt(OPEN / 2) > 0.9, "the pane arrives on `arrive`", `${(paneAt(OPEN / 2) * 100).toFixed(1)}% at the midpoint of the open`);

  // the pour: monotonic, no overshoot, and DONE before the sheet settles
  const withLines = openRun.filter((s) => s.n > 0);
  const nLines = withLines[0]?.n ?? 0;
  let monotonic = true;
  let overshoot = 0;
  let jump = 0;
  for (let i = 1; i < withLines.length; i++) {
    const a = withLines[i - 1].y;
    const b = withLines[i].y;
    if (a.length !== b.length) continue;
    for (let k = 0; k < b.length; k++) {
      if (b[k] > a[k] + 0.002) monotonic = false;
      overshoot = Math.min(overshoot, b[k]);
      jump = Math.max(jump, Math.abs(b[k] - a[k]));
    }
  }
  check(nLines > 8, "the pour has lines to pour", `${nLines} of them`);
  check(monotonic, "every line rises, none of them backs up");
  check(overshoot > -0.002, "nothing overshoots its box", `deepest ${(overshoot * 100).toFixed(2)}%`);
  check(jump < 0.35, "no line jumps a third of its box in a frame", `worst frame ${(jump * 100).toFixed(1)}%`);

  const start = withLines.find((s) => s.y.some((v) => v < 1.0999));
  const landedAll = withLines.find((s) => s.y.every((v) => v > -0.002 && v < 0.002));
  const firstLanded = withLines.find((s) => s.y.some((v) => v > -0.002 && v < 0.002));
  check(
    !!landedAll && landedAll.t <= POUR_END + 0.04,
    "the type lands before the sheet settles",
    landedAll
      ? `last line at ${landedAll.t.toFixed(3)}s, pane at ${OPEN}s`
      : "some line never landed",
  );
  check(
    !!firstLanded && !!landedAll && landedAll.t - firstLanded.t > 0.12,
    "and it lands as a CASCADE, not a slab",
    firstLanded && landedAll
      ? `first ${firstLanded.t.toFixed(3)}s → last ${landedAll.t.toFixed(3)}s (${((landedAll.t - firstLanded.t) * 1000).toFixed(0)}ms of pour)`
      : "no spread",
  );
  check(!!start && start.t < 0.12, "and it starts with the sheet, not after it", start ? `${start.t.toFixed(3)}s` : "never");

  // ── the close ──────────────────────────────────────────────────────────
  // `timeScale(1.5)` — leaving is quicker than arriving — so the exit occupies
  // OPEN / 1.5 of timeline time, and its midpoint is that, halved.
  await page.waitForTimeout(1200 * SLOW);
  const CLOSE = OPEN / 1.5;
  const { h0: closeH0, samples: closeRun } = await record(CLOSE + 0.06);
  const closeAt = (t) => {
    const s = closeRun.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    return s.h / closeH0;
  };
  const mid = closeAt(CLOSE / 2);
  check(
    mid > 0.02 && mid < 0.5,
    "the close does NOT mirror the open",
    `${(mid * 100).toFixed(1)}% of height left at its midpoint — the same tween reversed WITHOUT easeReverse replays the quintic entry and sits at ~97%`,
  );
  const closeEnd = closeRun[closeRun.length - 1];
  check(
    closeEnd.h === 0 && closeEnd.n === 0,
    "and it finishes, taking the split with it",
    `${closeEnd.h.toFixed(1)}px left of ${closeH0.toFixed(0)}px, ${closeEnd.n} line boxes`,
  );
  let closeMonotonic = true;
  let closeWorst = 0;
  for (let i = 1; i < closeRun.length; i++) {
    const rise = closeRun[i].h - closeRun[i - 1].h;
    if (rise > 1) closeMonotonic = false;
    closeWorst = Math.max(closeWorst, rise);
  }
  check(closeMonotonic, "the sheet withdraws without a bounce", `worst rebound ${closeWorst.toFixed(2)}px`);

  check(errors.length === 0, "no page errors", errors.join(" | ") || "clean");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE INTERRUPTIONS — the split may never outlive the movement it is for
// ═══════════════════════════════════════════════════════════════════════════
head("THE INTERRUPTIONS");
{
  const { page, context, errors } = await stage({ slow: 4 });
  const summary = page.locator(`${SEL} summary`).first();
  const state = () =>
    page.evaluate((sel) => {
      const d = document.querySelector(sel);
      const body = d.querySelector(".disclose-body");
      const pane = d.querySelector(".disclose-pane");
      return {
        open: d.open,
        lines: body.querySelectorAll(".disclose-line").length,
        // 0 when shut — see the note on `record()` above
        paneH: d.open ? Math.round(pane.getBoundingClientRect().height) : 0,
        bodyH: body.offsetHeight,
        paneStyle: pane.style.height,
      };
    }, SEL);

  // close caught mid-open
  await summary.click();
  await page.waitForTimeout(300);
  const midOpen = await state();
  check(midOpen.lines > 0 && midOpen.paneH < midOpen.bodyH, "mid-open: split standing, sheet still rising", `${midOpen.lines} lines, ${midOpen.paneH}/${midOpen.bodyH}px`);
  await summary.click();
  await page.waitForTimeout(4000);
  let s = await state();
  check(
    !s.open && s.lines === 0 && s.paneStyle === "",
    "closing mid-open leaves nothing behind",
    `open=${s.open}, ${s.lines} line boxes, no inline height`,
  );

  // reopen caught mid-close
  await summary.click();
  await page.waitForTimeout(3200);
  await summary.click();
  await page.waitForTimeout(300);
  await summary.click();
  await page.waitForTimeout(4500);
  s = await state();
  check(
    s.open && s.lines === 0 && s.paneStyle === "auto" && Math.abs(s.paneH - s.bodyH) < 1,
    "reopening mid-close settles fully open",
    `pane ${s.paneH}px = body ${s.bodyH}px, height: ${s.paneStyle}`,
  );

  // an open this component did not initiate
  await summary.click();
  await page.waitForTimeout(4000);
  await page.evaluate((sel) => { document.querySelector(sel).open = true; }, SEL);
  await page.waitForTimeout(400);
  s = await state();
  check(
    s.open && s.lines === 0 && Math.abs(s.paneH - s.bodyH) < 1,
    "find-in-page is not a gesture",
    `content simply there: pane ${s.paneH}px = body ${s.bodyH}px`,
  );

  check(errors.length === 0, "no page errors", errors.join(" | ") || "clean");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE NARROW STAGE — where the line count nearly doubles
// ═══════════════════════════════════════════════════════════════════════════
head("THE NARROW STAGE · 390px");
{
  const { page, context, errors } = await stage({ width: 390, height: 844, slow: 4 });

  // The page already runs 8px wide of its own viewport at 390px, closed, with
  // nothing of this component on screen (a fixed cursor ring and the lab
  // wordmark sizer) — so the number that means anything here is the DELTA the
  // panel adds, which must be none.
  const overflowBefore = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  const run = await page.evaluate(
    (sel) =>
      new Promise((res) => {
        const d = document.querySelector(sel);
        const body = d.querySelector(".disclose-body");
        const name = d.closest(".pillar").querySelector(".pillar-name");
        const tops = [];
        let lines = 0;
        let overflow = 0;
        let splitH = 0;
        const t0 = Date.now();
        const tick = () => {
          tops.push(name.getBoundingClientRect().top);
          const n = body.querySelectorAll(".disclose-line").length;
          if (n > lines) {
            lines = n;
            splitH = body.offsetHeight;
          }
          overflow = Math.max(
            overflow,
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          if (Date.now() - t0 < 900) requestAnimationFrame(tick);
          else
            res({
              lines,
              splitH,
              drift: Math.max(...tops.map((t) => Math.abs(t - tops[0]))),
              overflow,
            });
        };
        d.querySelector("summary").click();
        requestAnimationFrame(tick);
      }),
    SEL,
  );
  check(run.lines >= 8, "the copy splits here too", `${run.lines} lines at 390px`);
  check(
    run.overflow <= overflowBefore,
    "the pour adds no horizontal overflow",
    `${overflowBefore}px closed → ${run.overflow}px splitting`,
  );
  // the pin measures real layout rather than a formula, so it has to hold on
  // the single-column stage too — where the liquid's band sits ABOVE the copy
  // and the centring maths is a different shape entirely
  check(run.drift < 12, "the headline holds its line", `${run.drift.toFixed(2)}px excursion`);

  await page.waitForTimeout(4000);
  const settled = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    return {
      lines: d.querySelectorAll(".disclose-line").length,
      bodyH: d.querySelector(".disclose-body").offsetHeight,
      dots: [...d.querySelectorAll(".pillar-cap")].filter(
        (c) => getComputedStyle(c, "::after").content !== "none",
      ).length,
    };
  }, SEL);
  check(
    run.splitH === settled.bodyH,
    "and the split costs no height here either",
    `${run.splitH}px split · ${settled.bodyH}px resting`,
  );
  check(
    settled.lines === 0 && settled.dots === 5,
    "and un-splits cleanly here too",
    `${settled.dots} separators`,
  );

  check(errors.length === 0, "no page errors", errors.join(" | ") || "clean");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · REDUCED MOTION — nothing is ever split on the path that asked for less
// ═══════════════════════════════════════════════════════════════════════════
head("REDUCED MOTION");
{
  const { page, context, errors } = await stage({ reduced: true });
  const before = await page.evaluate(
    (sel) => ({
      mq: matchMedia("(prefers-reduced-motion: reduce)").matches,
      disclose: document.querySelector(sel).dataset.disclose ?? "unset",
    }),
    SEL,
  );
  await page.locator(`${SEL} summary`).first().click();
  await page.waitForTimeout(600);
  const after = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    const body = d.querySelector(".disclose-body");
    return {
      open: d.open,
      lines: body.querySelectorAll(".disclose-line").length,
      bodyH: body.offsetHeight,
      paneH: Math.round(d.querySelector(".disclose-pane").getBoundingClientRect().height),
    };
  }, SEL);
  check(
    before.mq && before.disclose === "unset",
    "the choreography never arms",
    `prefers-reduced-motion=${before.mq}, data-disclose=${before.disclose}`,
  );
  check(after.open && after.lines === 0, "the panel just opens", `open=${after.open}, 0 line boxes`);
  check(Math.abs(after.paneH - after.bodyH) < 1, "at its natural height", `${after.paneH}px`);
  check(errors.length === 0, "no page errors", errors.join(" | ") || "clean");
  await context.close();
}

await browser.close();
console.log(
  failures === 0
    ? "\nALL CHECKS PASS\n"
    : `\n${failures} CHECK${failures > 1 ? "S" : ""} FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
