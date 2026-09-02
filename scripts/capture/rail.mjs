/**
 * THE WATERLINE — state stills of the chapter rail on the real page.
 *
 * `verify/rail.mjs` proves the kernel's numbers in node. This proves the half
 * that only exists in a browser: that the SVG is wired to the runtime at all,
 * that the swell stays inside the column `--rail-safe` reserves for it, that
 * the lit run tracks the document, that the label arrives on the right chapter,
 * and that a reader who has asked for stillness still gets a usable rail.
 *
 * VIRTUAL TIME, for the same reason `capture/membrane.mjs` uses it: a
 * screenshot under SwiftShader costs a few hundred ms, so a still labelled
 * "80 ms into the swell" taken in real time is a still of whatever the rail
 * had settled into half a second later.
 *
 *   node scripts/capture/rail.mjs
 *   BASE=http://localhost:3021 TAG=r2 node scripts/capture/rail.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3021";
const OUT = process.env.OUT ?? "captures/rail";
const TAG = process.env.TAG ?? "rail";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
/** The rail plus enough page to its left to see the swell against the copy. */
const STRIP = 200;

const log = [];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

/** Freeze the clock so every still is taken at the age it claims. */
const VIRTUAL = `
  window.__t = performance.now();
  const raf = [];
  window.requestAnimationFrame = (cb) => (raf.push(cb), raf.length);
  window.cancelAnimationFrame = () => {};
  performance.now = () => window.__t;
  window.__adv = (ms, step = 16.7) => {
    for (let left = ms; left > 0; left -= step) {
      window.__t += Math.min(step, left);
      const due = raf.splice(0, raf.length);
      for (const cb of due) cb(window.__t);
    }
  };
`;

async function shoot(page, name, note = "") {
  // The shutter here competes with a full-page WebGL liquid under SwiftShader:
  // mid-document a single frame costs most of a second, and the default 30 s
  // stability wait is not enough to get one. `scale: "css"` shoots at 1x
  // instead of the context's dpr 2, which is a quarter of the pixels for a
  // strip of line art that has no detail below a CSS pixel anyway.
  await page.screenshot({
    path: `${OUT}/${TAG}-${name}.png`,
    clip: { x: W - STRIP, y: 0, width: STRIP, height: H },
    scale: "css",
    timeout: 120_000,
  });
  log.push(`  ${name}${note ? ` — ${note}` : ""}`);
}

/** Read the rail's live state out of the DOM. */
const state = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector(".side-index");
    if (!nav) return { mounted: false };
    const box = nav.getBoundingClientRect();
    const d = (sel) =>
      document.querySelector(sel)?.getAttribute("d")?.trim() ?? "";
    const dots = (s) => (s.match(/M/g) ?? []).length;
    // the leftmost point any dot reaches, in page px
    const reach = [...d(".rail-ink").matchAll(/M(\d+(?:\.\d+)?) [\d.]+h(-?[\d.]+)/g)]
      .map(([, x, len]) => Number(x) + Number(len))
      .sort((a, b) => a - b)[0];
    // The loudest thing a "minimalist" rail can do is open a name card under
    // the cursor. It must never be visible to a pointer — only to keyboard
    // focus, which no reader of this page will ever see.
    const shown = [...document.querySelectorAll(".side-index-label")].filter(
      (el) => Number(getComputedStyle(el).opacity) > 0.01,
    );
    return {
      mounted: nav.dataset.rail === "on",
      wake: getComputedStyle(nav).getPropertyValue("--rail-wake").trim(),
      right: Math.round(window.innerWidth - box.right),
      width: Math.round(box.width),
      ink: dots(d(".rail-ink")),
      mark: dots(d(".rail-mark")),
      flow: dots(d(".rail-flow")),
      live: dots(d(".rail-live")),
      // how far the swell reached out of the column, in px from the page edge
      reachFromEdge: reach === undefined ? null : Math.round(box.left + reach),
      tags: shown.length,
      tagText: shown[0]?.textContent ?? null,
      // where the lit run starts, as a percentage down the rail — the number
      // that says whether the thumb is telling the truth
      runTop: (() => {
        const ys = [...d(".rail-flow").matchAll(/M[\d.]+ ([\d.]+)h/g)].map((m) =>
          Number(m[1]),
        );
        return ys.length ? Math.round((ys[0] / box.height) * 100) : -1;
      })(),
      restString: d(".rail-ink").slice(0, 24),
    };
  });

const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.addInitScript(VIRTUAL);
await page.goto(`${BASE}/pt`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate(() => window.__adv?.(2500));

const mounted = await state(page);
log.push(
  `mount: data-rail=${mounted.mounted} · column ${mounted.width}px at ${mounted.right}px from the edge`,
);
log.push(
  `dots: ${mounted.ink} ink · ${mounted.mark} marks · ${mounted.flow} lit · ${mounted.live} live`,
);
await shoot(page, "01-rest", "no hand, top of the document");

// ── the hand ────────────────────────────────────────────────────────────────
// The pointer is moved in two steps so the rail sees a real pointermove and a
// real velocity, not a teleport into position.
async function handAt(yFrac, ms = 400) {
  await page.mouse.move(W - 120, H * yFrac);
  await page.mouse.move(W - 26, H * yFrac);
  await page.evaluate((m) => window.__adv?.(m), ms);
}

await handAt(0.32);
const swell = await state(page);
log.push(
  `hand at 32%: wake=${swell.wake} · reach ${swell.reachFromEdge}px from the page edge · ` +
    `name tags visible: ${swell.tags} ${swell.tags === 0 ? "(none — correct)" : `("${swell.tagText}" — REGRESSION)`}`,
);
await shoot(page, "02-hand-upper", "no name tag");

await handAt(0.62);
const swell2 = await state(page);
log.push(`hand at 62%: name tags visible: ${swell2.tags}`);
await shoot(page, "03-hand-lower", "no name tag");

// approach only — the rail must already be awake before the pointer arrives
await page.mouse.move(W - 200, H * 0.5);
await page.evaluate(() => window.__adv?.(200));
const near = await state(page);
log.push(`approach at 200px out: wake=${near.wake}`);
await shoot(page, "04-approach", `wake ${near.wake}`);

// ── the page moving ─────────────────────────────────────────────────────────
await page.mouse.move(W / 2, H / 2);
await page.evaluate(() => window.__adv?.(600));
// ── the page moving, on a REAL clock ────────────────────────────────────────
// These three stills are the one part of this script the virtual clock cannot
// take. Frozen time is what makes a still labelled "80 ms into the swell" true,
// but a scroll position is not a moment — and with rAF stubbed the compositor
// never gets the fixed layer back after a jump, so the rail photographed BLANK
// at 35% and 70% while its paths were provably correct in the DOM. Chasing that
// would have been chasing the harness. A second page, running normally, shows
// what a reader sees.
const scrollCtx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
});
const sp = await scrollCtx.newPage();
await sp.goto(`${BASE}/pt`, { waitUntil: "networkidle" });
await sp.waitForTimeout(3000);
for (const frac of [0.35, 0.7, 1]) {
  await sp.evaluate(
    (f) =>
      window.scrollTo(
        0,
        (document.documentElement.scrollHeight - window.innerHeight) * f,
      ),
    frac,
  );
  await sp.waitForTimeout(2500); // let Lenis settle wherever it settles
  const at = await sp.evaluate(() => {
    const doc = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round((window.scrollY / doc) * 100);
  });
  const s = await state(sp);
  log.push(
    `document at ${at}%: ${s.flow} lit dots · live dot ${s.live ? "on" : "MISSING"} · run starts ${s.runTop}% down the rail`,
  );
  await shoot(sp, `05-scroll-${at}`, `${s.flow} lit at ${at}%`);
}

// ── the route transition ────────────────────────────────────────────────────
// The one failure a reader actually reported, and the one no still of a single
// page can catch. `position: fixed` resolves against the nearest ancestor with
// a transform, and `template.tsx` animates `y` on a wrapper around the whole
// page for half a second of every client-side navigation. A rail measured in
// that window believes it is as tall as the DOCUMENT — and because the dots
// keep their pitch, the top of the rail still looks perfectly normal while
// every mark, the lit run and the live chapter are laid out below the fold.
// It comes back from a legal page looking like a decorative dotted line.
{
  await sp.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await sp.waitForTimeout(1800);
  const legal = sp.locator('a[href*="/legal/"]').first();
  await legal.scrollIntoViewIfNeeded();
  await legal.click();
  await sp.waitForTimeout(2500);
  await sp.goBack();
  // Wait for the rail to exist before reading it. A fixed 4 s was enough until
  // the dev server had to compile the route cold, and then this gate failed
  // with a null rather than a verdict — a harness that cannot tell "broken"
  // from "not there yet" is not a gate.
  await sp.waitForSelector(".side-index[data-rail]", { timeout: 45_000 });
  await sp.waitForTimeout(3000);

  const back = await sp.evaluate(() => {
    const nav = document.querySelector(".side-index");
    const box = nav.getBoundingClientRect();
    const ys = ["ink", "taut", "mark", "flow", "live"].flatMap((k) =>
      [
        ...(
          document.querySelector(".rail-" + k)?.getAttribute("d") ?? ""
        ).matchAll(/M[\d.]+ ([\d.]+)h/g),
      ].map((m) => Number(m[1])),
    );
    return {
      dots: ys.length,
      lowest: Math.round(Math.max(...ys)),
      height: Math.round(box.height),
    };
  });
  const want = Math.round(back.height / 9) + 1;
  log.push(
    `after a client-side route transition: ${back.dots} dots (want ${want}), ` +
      `lowest at ${back.lowest}px of a ${back.height}px rail ` +
      `— ${back.dots === want && back.lowest <= back.height + 1 ? "INTACT" : "STALE LAYOUT"}`,
  );
  await shoot(sp, "08-after-route-change", `${back.dots} dots`);
}

// ── keyboard ────────────────────────────────────────────────────────────────
// This page has been in the background since the scroll stills moved to `sp`,
// and a document that does not have focus has no `:focus` at all as far as CSS
// is concerned — the still came back with no ring and no name, which reads
// exactly like a broken focus state.
await page.bringToFront();
// A real keystroke FIRST. `:focus-visible` is the whole point of this still,
// and it does not match a scripted `.focus()` on a link — the browser only
// paints a focus ring once the reader has shown they are using a keyboard. Tab
// sets that modality; the script then puts focus exactly where we want it.
await page.keyboard.press("Tab");
await page.evaluate(() => {
  const a = document.querySelectorAll(".side-index-link")[6];
  a?.focus();
});
await page.evaluate(() => window.__adv?.(300));
// A REAL wait, not a virtual one. The focus ring and the name fade in on a CSS
// transition, and CSS transitions run on the wall clock the frozen `__adv`
// clock knows nothing about — read immediately, the label is still at the
// opacity 0 it started from, and the still reports a focus state that never
// happened.
await page.waitForTimeout(400);
const focused = await state(page);
log.push(
  `keyboard focus: ${focused.tags} tag ${focused.tags === 1 ? `("${focused.tagText}") — the one place it survives` : "— MISSING, a keyboard reader cannot tell which dot they are on"}`,
);
await shoot(page, "06-focus", "keyboard on chapter 07");

// ── the fallback ────────────────────────────────────────────────────────────
const rmCtx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const rmPage = await rmCtx.newPage();
await rmPage.goto(`${BASE}/pt`, { waitUntil: "networkidle" });
await rmPage.waitForTimeout(1500);
const rm = await rmPage.evaluate(() => {
  const nav = document.querySelector(".side-index");
  const num = document.querySelector(".side-index-num");
  return {
    rail: nav?.dataset.rail ?? "(unset)",
    numbers: num ? getComputedStyle(num).display : "(missing)",
    links: document.querySelectorAll(".side-index-link").length,
  };
});
log.push(
  `reduced motion: data-rail=${rm.rail} · numbers display=${rm.numbers} · ${rm.links} links`,
);
await rmPage.screenshot({
  path: `${OUT}/${TAG}-07-reduced-motion.png`,
  clip: { x: W - STRIP, y: 0, width: STRIP, height: H },
});

await browser.close();
console.log(`\nthe waterline — ${OUT}/${TAG}-*.png\n`);
console.log(log.join("\n"));
console.log("");
