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
//       rest of the body after, drives the hov channel, and fills the HUD.
//   D · keyboard raises the same response.
//   E · reduced motion keeps the semantic story (the eco-stack).
//
// Dev server must be running:  node scripts/verify-ecosystem.mjs

import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

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

/** Visible label boxes in the gathering layer, with their text. */
const readLabels = () =>
  page.evaluate(() => {
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && parseFloat(cs.opacity) > 0.35;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().replace(/\s+/g, " "),
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    };
    const nodes = [...document.querySelectorAll(".organism-node")].filter(vis);
    const systems = [...document.querySelectorAll(".gather-system")].filter(vis);
    // the centre label is type in the same layer and collided with the lowest
    // lobe once — it belongs in the collision set, not outside it
    const centre = [...document.querySelectorAll(".organism-center")].filter(vis);
    const rail = document.querySelector(".side-index")?.getBoundingClientRect();
    return {
      nodes: nodes.map(box),
      systems: systems.map(box),
      centre: centre.map(box),
      rail: rail ? { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom } : null,
      meter: document.querySelector(".eco-hud-meter")?.textContent ?? "",
      hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
      grow: document.querySelector(".journey-interactions")?.style.getPropertyValue("--eco-grow"),
    };
  });

/** Pairs of boxes that genuinely overlap (a few px of touch is not a clash). */
function overlaps(boxes) {
  const PAD = -3; // shrink each box slightly: kerning slivers are not collisions
  const hits = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (
        a.right + PAD > b.left - PAD &&
        a.left - PAD < b.right + PAD &&
        a.bottom + PAD > b.top - PAD &&
        a.top - PAD < b.bottom + PAD
      )
        hits.push(`${a.text} × ${b.text}`);
    }
  return hits;
}

const settle = async (feco) => {
  await page.goto(`${BASE}/en?ftier=full&feco=${feco}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".organism-node", { timeout: 30000 });
  await page.waitForTimeout(2200);
};

console.log("A · the gathered body");
await settle(1);
const a = await readLabels();
const all = [...a.nodes, ...a.systems, ...a.centre];
const clash = overlaps(all);
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
  clash.length === 0,
  "no label collides with another",
  clash.length ? clash.join(" · ") : "clean",
);
check(a.meter.includes("10"), "HUD meter reads complete", a.meter);
check(a.hudLine.length > 0, "HUD idle line present", a.hudLine);

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
  overlaps([...early.nodes, ...early.systems]).length === 0 &&
    overlaps([...mid.nodes, ...mid.systems]).length === 0,
  "type stays clear of itself mid-gather too",
);

console.log("C · the system response (pointer)");
await settle(1);
const before = await page.evaluate(() => window.__liquid?.hov ?? -99);
await page.hover(".organism-node:nth-child(5) .organism-node-trigger");
await page.waitForTimeout(450);
const c = await page.evaluate(() => {
  const root = document.querySelector(".journey-interactions");
  const delays = [...document.querySelectorAll(".organism-node")].map((n) =>
    n.style.getPropertyValue("--pd"),
  );
  return {
    pulse: root?.getAttribute("data-pulse"),
    hov: window.__liquid?.hov ?? -99,
    distinct: new Set(delays).size,
    hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
    hudCap: document.querySelector(".eco-hud-cap")?.textContent ?? "",
  };
});
check(before === -1, "hov channel idle before touch", `hov=${before}`);
check(c.pulse === "true", "data-pulse raised on the layer");
check(c.hov === 4, "the hov channel carries the touched capability", `hov=${c.hov}`);
check(
  c.distinct >= 3,
  "the pulse reaches its own system before the rest of the body",
  `${c.distinct} distinct delays`,
);
check(c.hudLine.includes("05"), "HUD line shows the capability index", c.hudLine);
check(c.hudCap.length > 8, "HUD shows the capability line", c.hudCap.slice(0, 40));
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
    ".organism-node:nth-child(1) .organism-node-trigger",
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
  hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
}));
check(k.focused, "trigger takes keyboard focus");
check(
  k2.pulse === "true" && k2.hov === 0,
  "focus raises the same response",
  JSON.stringify(k2),
);
check(k2.hudLine.includes("01"), "HUD follows keyboard focus", k2.hudLine);

console.log("E · reduced motion keeps the semantic story");
const rmCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const rmPage = await rmCtx.newPage();
await rmPage.goto(`${BASE}/en`, { waitUntil: "networkidle" });
await rmPage.waitForTimeout(1200);
const d = await rmPage.evaluate(() => ({
  live: !!document.querySelector(".organism-node"),
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
