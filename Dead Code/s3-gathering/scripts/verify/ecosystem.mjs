// verify-ecosystem (S3 remake) — THE GATHERING's gate.
//
// The ecosystem is no longer a circuit of veins and sockets: the ten
// capabilities are masses that come forward out of the dark, arrive in three
// systems, and fuse into one body. Nothing is drawn between them, so there is
// no line-work to assert. What has to be true instead:
//
//   A · the gathered body (?feco=1): ten capability names and three system
//       markers visible, clear of the chapter-index rail, and — the defect
//       this build actually shipped once — CLEAR OF EACH OTHER. Type that
//       rides moving liquid collides in ways a static layout never does, so
//       overlap is a machine check, not an eye check.
//   B · the three beats: at a third of the clock only the first system has
//       landed; at the end all ten have. This is what stops the convergence
//       from collapsing back into a single undifferentiated event.
//   C · the response: touching a capability pulses its SYSTEM first and the
//       rest of the body after, drives the hov channel, and updates the quiet
//       explanatory note.
//   D · keyboard raises the same response.
//   E · reduced motion keeps the semantic story (the eco-stack).
//
// Dev server must be running:  node scripts/verify/ecosystem.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

/**
 * Visible label boxes in the gathering layer, plus the collisions between them.
 *
 * Collisions are computed IN THE PAGE, because the only way to tell a real
 * clash from a container is DOM ancestry: a `.gather-block` encloses its own
 * `.gather-row` children by construction, and comparing raw rectangles counted
 * every one of those as an overlap. That is what this check was reporting —
 * ten "collisions", each one a row sitting inside its own system block.
 */
const readLabels = () =>
  page.evaluate(() => {
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && parseFloat(cs.opacity) > 0.35;
    };
    const label = (el) => ({
      el,
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
      r: el.getBoundingClientRect(),
    });
    const box = (l) => ({
      text: l.text,
      left: l.r.left,
      right: l.r.right,
      top: l.r.top,
      bottom: l.r.bottom,
    });
    const nodes = [...document.querySelectorAll(".gather-row")]
      .filter(vis)
      .map(label);
    const systems = [...document.querySelectorAll(".gather-block")]
      .filter(vis)
      .map(label);
    // the resolution line is type in the same column and belongs in the
    // collision set, not outside it
    const centre = [...document.querySelectorAll(".organism-center")]
      .filter(vis)
      .map(label);
    const all = [...nodes, ...systems, ...centre];
    const PAD = -3; // kerning slivers are not collisions
    const clash = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        // containment is layout, not collision
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (
          a.r.right + PAD > b.r.left - PAD &&
          a.r.left - PAD < b.r.right + PAD &&
          a.r.bottom + PAD > b.r.top - PAD &&
          a.r.top - PAD < b.r.bottom + PAD
        )
          clash.push(`${a.text} × ${b.text}`);
      }
    const col = document.querySelector(".gather-col")?.getBoundingClientRect();
    // …measured against the STAGE, not the viewport. The deterministic hold
    // freezes the clock without scrolling to the runway, so a viewport-relative
    // bottom is wherever the page happens to be sitting. The sticky host is a
    // full-viewport box and is what the column actually has to fit inside.
    const host = document
      .querySelector("#ecosystem-interactions-host")
      ?.getBoundingClientRect();
    const rail = document.querySelector(".side-index")?.getBoundingClientRect();
    return {
      nodes: nodes.map(box),
      systems: systems.map(box),
      centre: centre.map(box),
      clash,
      // THE ONE AXIS. Every visible block and row is measured against the same
      // left edge. This is the redesign's core claim in a number: type that
      // sits on more than one axis is the "loose, scattered" reading the
      // chapter used to have, and it cannot regress silently.
      axes: new Set(
        [...nodes, ...systems].map((l) => Math.round(l.r.left)),
      ).size,
      // …and the column has to FIT. It accumulates as systems arrive, so its
      // full extension is the state that can overflow the stage.
      colFits: col && host ? col.bottom - host.top <= host.height - 4 : false,
      colBottom: col && host ? Math.round(col.bottom - host.top) : -1,
      rail: rail
        ? { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom }
        : null,
      noteName: document.querySelector(".gather-note-name")?.textContent ?? "",
      noteCopy: document.querySelector(".gather-note-copy")?.textContent ?? "",
      // The diagram chrome and the rejected pseudo-interface stay removed.
      chrome: document.querySelectorAll(
        ".gather-leader, .gather-frame, .gather-col-spine, .gather-col-head, .gather-row-index, .eco-hud",
      ).length,
      grow: document.querySelector(".journey-interactions")?.style.getPropertyValue("--eco-grow"),
    };
  });

const settle = async (feco) => {
  await page.goto(`${BASE}/en?ftier=full&feco=${feco}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".gather-row", { timeout: 30000 });
  await page.waitForTimeout(2200);
};

console.log("A · the gathered body");
await settle(1);
const a = await readLabels();
const all = [...a.nodes, ...a.systems, ...a.centre];
const railHit = a.rail
  ? all.filter(
      (n) =>
        n.right > a.rail.left &&
        n.left < a.rail.right &&
        n.bottom > a.rail.top &&
        n.top < a.rail.bottom,
    ).length
  : 0;
check(a.nodes.length === 10, "ten capability names visible", `${a.nodes.length}`);
check(a.systems.length === 3, "three system markers visible", `${a.systems.length}`);
check(railHit === 0, "type clear of the chapter-index rail", `overlaps=${railHit}`);
check(
  a.clash.length === 0,
  "no label collides with another",
  a.clash.length ? a.clash.join(" · ") : "clean",
);
check(a.axes === 1, "all type sits on ONE vertical axis", `${a.axes} axes`);
check(a.colFits, "the column fits the stage at full extension", `bottom=${a.colBottom}`);
check(a.chrome === 0, "no leaders, frame, counters, or HUD remain", `${a.chrome} elements`);
check(a.noteName.length > 0, "idle explanation names the latest arrival", a.noteName);
check(a.noteCopy.length > 8, "idle explanation carries authored copy", a.noteCopy);

console.log("B · the three beats");
await settle(0.3);
const early = await readLabels();
await settle(0.62);
const mid = await readLabels();
check(
  early.nodes.length > 0 && early.nodes.length < 6,
  "a third of the way in, only the first system has landed",
  `${early.nodes.length} names`,
);
check(
  mid.nodes.length > early.nodes.length,
  "the body keeps accumulating through the middle",
  `${early.nodes.length} → ${mid.nodes.length}`,
);
check(
  early.clash.length === 0 && mid.clash.length === 0,
  "type stays clear of itself mid-gather too",
  [...early.clash, ...mid.clash].join(" · ") || "clean",
);
// the column GROWS: the accumulation is the reason the runway has a length,
// and the old layout — three blocks at full height from the first screen with
// their rows dimmed — is what made two viewports of scroll look identical.
check(
  mid.colBottom > early.colBottom + 40,
  "the column visibly accumulates between beats",
  `${early.colBottom} → ${mid.colBottom}`,
);
check(
  early.axes === 1 && mid.axes === 1,
  "one axis holds mid-gather too",
  `${early.axes} / ${mid.axes}`,
);

console.log("C · the system response (pointer)");
await settle(1);
const before = await page.evaluate(() => window.__liquid?.hov ?? -99);
// The row at DOM index 4 is NOT capability 4: rows are grouped by system
// (identity · growth · operation), so reading order and slot order differ by
// construction. Ask the DOM which slot it is rather than assuming — the old
// hardcoded 4 was asserting an ordering the chapter has never had.
const TOUCH = 4;
const touched = await page.evaluate((i) => {
  const t = document.querySelectorAll(".gather-row-trigger")[i];
  return Number(t.getAttribute("data-slot"));
}, TOUCH);
await page.locator(".gather-row-trigger").nth(TOUCH).hover();
await page.waitForTimeout(450);
const c = await page.evaluate(() => {
  const root = document.querySelector(".journey-interactions");
  const delays = [...document.querySelectorAll(".gather-row")].map((n) =>
    n.style.getPropertyValue("--pd"),
  );
  return {
    pulse: root?.getAttribute("data-pulse"),
    hov: window.__liquid?.hov ?? -99,
    distinct: new Set(delays).size,
    noteName: document.querySelector(".gather-note-name")?.textContent ?? "",
    noteCopy: document.querySelector(".gather-note-copy")?.textContent ?? "",
  };
});
check(before === -1, "hov channel idle before touch", `hov=${before}`);
check(c.pulse === "true", "data-pulse raised on the layer");
check(
  c.hov === touched,
  "the hov channel carries the touched capability",
  `hov=${c.hov} expected=${touched}`,
);
check(
  c.distinct >= 3,
  "the pulse reaches its own system before the rest of the body",
  `${c.distinct} distinct delays`,
);
const touchedName = await page
  .locator(".gather-row-trigger")
  .nth(TOUCH)
  .locator(".gather-row-name")
  .textContent();
check(
  c.noteName.trim() === touchedName?.trim(),
  "explanation follows the touched capability",
  c.noteName,
);
check(c.noteCopy.length > 8, "explanation shows the capability copy", c.noteCopy.slice(0, 40));
await page.mouse.move(20, 20);
await page.waitForTimeout(350);
const cleared = await page.evaluate(() => ({
  pulse: document
    .querySelector(".journey-interactions")
    ?.getAttribute("data-pulse"),
  hov: window.__liquid?.hov ?? -99,
}));
check(
  cleared.pulse === null && cleared.hov === -1,
  "response releases on leave",
  JSON.stringify(cleared),
);

console.log("D · the system response (keyboard)");
const k = await page.evaluate(() => {
  const trigger = document.querySelector(
    ".gather-row:nth-child(1) .gather-row-trigger",
  );
  trigger.focus();
  return { focused: document.activeElement === trigger };
});
await page.waitForTimeout(350);
const k2 = await page.evaluate(() => ({
  pulse: document
    .querySelector(".journey-interactions")
    ?.getAttribute("data-pulse"),
  hov: window.__liquid?.hov ?? -99,
  noteName: document.querySelector(".gather-note-name")?.textContent ?? "",
}));
check(k.focused, "trigger takes keyboard focus");
check(
  k2.pulse === "true" && k2.hov === 0,
  "focus raises the same response",
  JSON.stringify(k2),
);
check(k2.noteName.trim() === "Brand", "explanation follows keyboard focus", k2.noteName);

console.log("E · reduced motion keeps the semantic story");
const rmCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const rmPage = await rmCtx.newPage();
await rmPage.goto(`${BASE}/en`, { waitUntil: "networkidle" });
await rmPage.waitForTimeout(1200);
const d = await rmPage.evaluate(() => ({
  live: !!document.querySelector(".gather-row"),
  stack: [...document.querySelectorAll(".eco-stack-item")].length,
  stackVisible: (() => {
    const el = document.querySelector(".eco-stack");
    if (!el) return false;
    return getComputedStyle(el).display !== "none";
  })(),
}));
check(!d.live, "no live gathering under reduced motion");
check(
  d.stack === 10 && d.stackVisible,
  "eco-stack carries all ten capabilities",
  `${d.stack}`,
);
await rmCtx.close();

check(errors.length === 0, "zero page errors across the gate", errors[0]);

await browser.close();
console.log(
  failures === 0 ? "ECOSYSTEM: the gathering is green" : `ECOSYSTEM FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
