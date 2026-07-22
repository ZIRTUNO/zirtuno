// verify-ecosystem (S4 remake) — THE CIRCULATION's gate. The ecosystem is a
// circulatory system: one closed vein loop, three arteries, ten organ
// sockets, instrument labels, a HUD readout, and a system-wide response to
// touch. This harness proves the circuit assembles, stays legible, and
// answers as ONE system — and that the static/reduced paths keep the
// semantic story.
//
//   A · assembled circuit (?feco=1): 13 veins drawn, 10 sockets, 10 labels
//       visible and clear of the chapter-index rail, HUD meter complete
//   B · the response: hovering an organ pulses the graph (data-pulse +
//       staggered --pd delays), swells its dock (hov channel), fills the HUD
//   C · keyboard: focusing a trigger raises the same response
//   D · reduced motion: no circuit — the eco-stack carries the capabilities
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

console.log("A · the assembled circuit");
await page.goto(`${BASE}/en?ftier=full&feco=1`, { waitUntil: "networkidle" });
await page.evaluate(() =>
  document.querySelector("[data-organism]")?.scrollIntoView({ block: "center" }),
);
await page.waitForTimeout(2500);

const a = await page.evaluate(() => {
  const root = document.querySelector(".journey-interactions");
  const veins = [...document.querySelectorAll(".eco-vein")];
  const sockets = [...document.querySelectorAll(".eco-socket")];
  const nodes = [...document.querySelectorAll(".organism-node")];
  const rail = document.querySelector(".side-index")?.getBoundingClientRect();
  const drawn = veins.filter((v) => {
    const cs = getComputedStyle(v);
    const len = parseFloat(v.style.getPropertyValue("--len")) || 0;
    return len > 0 && Math.abs(parseFloat(cs.strokeDashoffset)) < len * 0.02;
  }).length;
  const visible = nodes.filter((n) => {
    const cs = getComputedStyle(n);
    return cs.display !== "none" && parseFloat(cs.opacity) > 0.85;
  });
  const railHit = rail
    ? visible.filter((n) => {
        const r = n.getBoundingClientRect();
        return r.right > rail.left && r.left < rail.right && r.bottom > rail.top && r.top < rail.bottom;
      }).length
    : 0;
  return {
    grow: root?.style.getPropertyValue("--eco-grow"),
    veins: veins.length,
    drawn,
    sockets: sockets.length,
    labels: visible.length,
    railHit,
    meter: document.querySelector(".eco-hud-meter")?.textContent ?? "",
    hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
  };
});
check(a.veins === 13, "13 veins (3 arteries + 10 loop segments)", `${a.veins}`);
check(a.drawn === 13, "every vein fully drawn at feco=1", `drawn=${a.drawn}`);
check(a.sockets === 10, "10 organ sockets", `${a.sockets}`);
check(a.labels === 10, "10 labels visible", `${a.labels}`);
check(a.railHit === 0, "labels clear of the chapter-index rail", `overlaps=${a.railHit}`);
check(a.meter.includes("10"), "HUD meter reads complete", a.meter);
check(a.hudLine.length > 0, "HUD idle line present", a.hudLine);

console.log("B · the system response (pointer)");
const before = await page.evaluate(() => window.__liquid?.hov ?? -99);
await page.hover(".organism-node:nth-child(5) .organism-node-trigger");
await page.waitForTimeout(450);
const b = await page.evaluate(() => {
  const root = document.querySelector(".journey-interactions");
  const delays = [
    ...document.querySelectorAll(".eco-vein"),
  ].map((v) => v.style.getPropertyValue("--pd"));
  return {
    pulse: root?.getAttribute("data-pulse"),
    hov: window.__liquid?.hov ?? -99,
    distinct: new Set(delays).size,
    hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
    hudCap: document.querySelector(".eco-hud-cap")?.textContent ?? "",
  };
});
check(before === -1, "hov channel idle before touch", `hov=${before}`);
check(b.pulse === "true", "data-pulse raised on the layer");
check(b.hov === 4, "the hov channel carries the touched organ", `hov=${b.hov}`);
check(b.distinct >= 3, "pulse delays stagger by graph distance", `${b.distinct} distinct`);
check(b.hudLine.includes("05"), "HUD line shows the organ index", b.hudLine);
check(b.hudCap.length > 8, "HUD shows the capability line", b.hudCap.slice(0, 40));
await page.mouse.move(20, 20);
await page.waitForTimeout(350);
const cleared = await page.evaluate(() => ({
  pulse: document.querySelector(".journey-interactions")?.getAttribute("data-pulse"),
  hov: window.__liquid?.hov ?? -99,
}));
check(cleared.pulse === null && cleared.hov === -1, "response releases on leave", JSON.stringify(cleared));

console.log("C · the system response (keyboard)");
const k = await page.evaluate(() => {
  const trigger = document.querySelector(
    ".organism-node:nth-child(1) .organism-node-trigger",
  );
  trigger.focus();
  return {
    focused: document.activeElement === trigger,
  };
});
await page.waitForTimeout(350);
const k2 = await page.evaluate(() => ({
  pulse: document.querySelector(".journey-interactions")?.getAttribute("data-pulse"),
  hov: window.__liquid?.hov ?? -99,
  hudLine: document.querySelector(".eco-hud-line")?.textContent ?? "",
}));
check(k.focused, "trigger takes keyboard focus");
check(k2.pulse === "true" && k2.hov === 0, "focus raises the same response", JSON.stringify(k2));
check(k2.hudLine.includes("01"), "HUD follows keyboard focus", k2.hudLine);

console.log("D · reduced motion keeps the semantic story");
const rmCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const rmPage = await rmCtx.newPage();
await rmPage.goto(`${BASE}/en`, { waitUntil: "networkidle" });
await rmPage.waitForTimeout(1200);
const d = await rmPage.evaluate(() => ({
  circuit: !!document.querySelector(".eco-veins"),
  stack: [...document.querySelectorAll(".eco-stack-item")].length,
  stackVisible: (() => {
    const el = document.querySelector(".eco-stack");
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none";
  })(),
}));
check(!d.circuit, "no circuit under reduced motion");
check(d.stack === 10 && d.stackVisible, "eco-stack carries all ten capabilities", `${d.stack}`);
await rmCtx.close();

check(errors.length === 0, "zero page errors across the gate", errors[0]);

await browser.close();
console.log(failures === 0 ? "ECOSYSTEM: circuit green" : `ECOSYSTEM FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
