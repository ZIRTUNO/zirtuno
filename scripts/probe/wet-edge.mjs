// probe/wet-edge — the reading front, as numbers.
//
// The wetting edge is scroll-scrubbed colour on live type, which means a
// screenshot can tell you it looks right and nothing else. This reports what
// the front is actually DOING: where each block's --wet-p sits, and the alpha
// ramp across its words — the shape of the front, which is the only way to
// see whether it is a FRONT at all or has degenerated into a block fade.
//
// It also gates the invariants that matter beyond taste:
//
//   FAIL-SAFE   every word resolves to its block's authored colour when the
//               runtime is not driving it, because that is the state static
//               tiers, reduced motion and no-JS get (rule #13).
//   ARRIVED     a block the front has passed rests at the authored colour to
//               its last word — the front must never leave copy dimmed.
//   RAMP        early words lead late ones. A block whose words all move
//               together is a fade wearing a front's clothes.
//
// Dev server must be running:  node scripts/probe/wet-edge.mjs
//   --url=<base>   default http://localhost:3000
//   --shots        also write a filmstrip into captures/wet-edge/

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("url", process.env.BASE_URL || "http://localhost:3000");
const SHOTS = process.argv.includes("--shots");
const OUT = "captures/wet-edge";
const VIEW = { width: 1440, height: 900 };

let failures = 0;
const check = (ok, label, detail) => {
  console.log(
    `${ok ? "  OK  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

// ── page-side readers ───────────────────────────────────────────────────────
// Passed through page.evaluate as source, so they must be self-contained.

const READ_BLOCKS = () => {
  const alphaOf = (el) => {
    const c = getComputedStyle(el).color;
    // Chromium serialises the color-mix() result as oklab(L a b / alpha);
    // an undriven word is a plain rgb()/rgba().
    const slash = /\/\s*([0-9.]+)\s*\)/.exec(c);
    if (slash) return +slash[1];
    const rgba = /rgba?\(([^)]+)\)/.exec(c);
    if (!rgba) return 1;
    const parts = rgba[1].split(",").map((s) => parseFloat(s));
    return parts.length > 3 ? parts[3] : 1;
  };
  return Array.from(document.querySelectorAll(".wet")).map((block) => {
    const rect = block.getBoundingClientRect();
    const names = String(block.className)
      .split(" ")
      .filter((c) => c && c !== "wet");
    // ARRIVEDNESS, on one scale for both paints. An ink word arrives by
    // gaining alpha; a glass word arrives by LOSING it, because what it
    // carries is a veil over the slab rather than the slab's own colour.
    // Reading raw alpha would print the glass ramp backwards and, worse,
    // let the ramp assertion below pass on the ink blocks alone while never
    // testing the glass ones at all.
    const glass = block.dataset.paint === "glass";
    const alphas = Array.from(block.querySelectorAll(".wet-w")).map(alphaOf);
    return {
      tag: `${block.tagName.toLowerCase()}.${names[0] ?? ""}`,
      driven: block.dataset.wet === "on",
      glass,
      p: +(getComputedStyle(block).getPropertyValue("--wet-p").trim() || 1),
      top: Math.round(rect.top),
      alphas,
      arrived: glass ? alphas.map((a) => +(1 - a).toFixed(3)) : alphas,
    };
  });
};

const COUNT_DIM = () => {
  const dim = [];
  for (const w of document.querySelectorAll(".wet-w")) {
    const m = /\/\s*([0-9.]+)\s*\)/.exec(getComputedStyle(w).color);
    if (m && +m[1] < 0.6) dim.push(w.textContent);
  }
  return {
    blocks: document.querySelectorAll(".wet").length,
    words: document.querySelectorAll(".wet-w").length,
    driven: document.querySelectorAll('.wet[data-wet="on"]').length,
    dim,
  };
};

/** One glyph per word: · not reached · ▪ under the front · █ arrived. */
const ramp = (arrived) => {
  const lo = Math.min(...arrived);
  const hi = Math.max(...arrived);
  if (hi - lo < 0.01) return "█".repeat(arrived.length);
  return arrived
    .map((a) => {
      const t = (a - lo) / (hi - lo);
      return t > 0.8 ? "█" : t > 0.3 ? "▪" : "·";
    })
    .join("");
};

const browser = await chromium.launch(LAUNCH);

// ── 1 · no JS at all ────────────────────────────────────────────────────────
{
  console.log("no-JS · copy is never left waiting on the front");
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: VIEW,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  const s = await page.evaluate(COUNT_DIM);
  check(s.blocks > 0, `${s.blocks} wet blocks are server-rendered`, `${s.words} words`);
  check(s.driven === 0, "nothing is driven without JS", `${s.driven} driven`);
  check(s.dim.length === 0, "no word is dimmed without JS", s.dim.slice(0, 3).join(" · "));
  await ctx.close();
}

// ── 2 · reduced motion ──────────────────────────────────────────────────────
{
  console.log("reduced motion · the front does not run");
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: VIEW });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const s = await page.evaluate(COUNT_DIM);
  check(s.driven === 0, "nothing is driven under reduced motion", `${s.driven} driven`);
  check(s.dim.length === 0, "no word is dimmed under reduced motion", s.dim.slice(0, 3).join(" · "));
  await ctx.close();
}

// ── 3 · arming ──────────────────────────────────────────────────────────────
// data-wet is what switches the dry state on. If it is ever set BEFORE the
// block's position is known, the block renders arrived (--wet-p fails safe to
// 1) and then drops to its true progress on the next frame — copy visibly
// un-reading itself. Only a deep link into a chapter puts a wet block on
// screen at load, so that is where this is caught. The observer is installed
// before any page script runs.
{
  console.log("armed · the dry state never precedes a position");
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__wetArm = [];
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.oldValue !== null) continue; // an update, not the arming write
        const el = r.target;
        window.__wetArm.push({
          tag: String(el.className).slice(0, 40),
          hadPosition: el.style.getPropertyValue("--wet-p") !== "",
        });
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-wet"],
    });
  });
  await page.goto(`${BASE}/pt#services`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const armed = await page.evaluate(() => window.__wetArm ?? []);
  const bare = armed.filter((a) => !a.hadPosition);
  check(armed.length > 0, `${armed.length} blocks armed on a deep link`);
  check(
    bare.length === 0,
    "every block carried its position before the dry state turned on",
    bare.map((b) => b.tag).slice(0, 3).join(" · "),
  );
  await ctx.close();
}

// ── 4 · the front itself ────────────────────────────────────────────────────
console.log("scrubbed · the shape of the front");
const ctx = await browser.newContext({ viewport: VIEW });
const page = await ctx.newPage();
await page.goto(`${BASE}/pt`, { waitUntil: "load" });
await page.waitForTimeout(2500); // the field mounts and the page settles
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });

const sawFront = { ink: false, glass: false };
const sawRamp = { ink: false, glass: false };
const STEPS = 30;
for (let step = 0; step <= STEPS; step++) {
  if (step > 0) {
    // Lenis honours wheel; window.scrollTo does not stick here.
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(340); // read at rest, not mid-inertia
  }
  const blocks = await page.evaluate(READ_BLOCKS);
  for (const b of blocks) {
    if (!b.driven || b.arrived.length < 3) continue;
    if (b.top < -300 || b.top > VIEW.height) continue;
    const lo = Math.min(...b.arrived);
    const hi = Math.max(...b.arrived);
    if (b.p > 0.05 && b.p < 0.95 && hi - lo > 0.08) {
      sawFront[b.glass ? "glass" : "ink"] = true;
      if (b.arrived[0] > b.arrived.at(-1) + 0.05) {
        sawRamp[b.glass ? "glass" : "ink"] = true;
      }
    }
    console.log(
      `   ${String(step).padStart(2)} p=${b.p.toFixed(2)} ${b.glass ? "glass" : "ink  "} ` +
        `${b.tag.slice(0, 22).padEnd(22)} ${ramp(b.arrived)} ` +
        `arrived ${lo.toFixed(2)}->${hi.toFixed(2)}`,
    );
  }
  if (SHOTS && step % 3 === 0) {
    await page.screenshot({ path: `${OUT}/step-${String(step).padStart(2, "0")}.png` });
  }
}

for (const paint of ["ink", "glass"]) {
  check(sawFront[paint], `${paint}: the front crosses mid-scroll (0 < p < 1, words disagree)`);
  check(sawRamp[paint], `${paint}: the front is a RAMP — early words lead late ones`);
}

// ── 5 · what the front leaves behind ────────────────────────────────────────
{
  const stranded = await page.evaluate(() => {
    // Compare PAINTED colour, not the serialisation: an arrived word is an
    // oklab() mix and its parent is an rgb(), so the strings differ while the
    // pixels do not. Canvas resolves both to the same four bytes.
    const probe = document.createElement("canvas").getContext("2d");
    const rgba = (css) => {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = css;
      probe.fillRect(0, 0, 1, 1);
      return Array.from(probe.getImageData(0, 0, 1, 1).data);
    };
    const out = [];
    for (const block of document.querySelectorAll(".wet")) {
      if (block.getBoundingClientRect().bottom > 0) continue; // not passed yet
      const want = rgba(getComputedStyle(block).color);
      for (const w of block.querySelectorAll(".wet-w")) {
        const got = rgba(getComputedStyle(w).color);
        if (got.some((v, i) => Math.abs(v - want[i]) > 3)) {
          out.push(
            `${block.tagName}.${String(block.className).slice(0, 24)} "${w.textContent}" ` +
              `got ${got.join()} want ${want.join()}`,
          );
          break;
        }
      }
    }
    return out;
  });
  check(
    stranded.length === 0,
    "every block the front has passed rests at its authored colour",
    stranded.slice(0, 3).join(" · "),
  );
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall wet-edge checks passed");
process.exit(failures ? 1 : 0);
