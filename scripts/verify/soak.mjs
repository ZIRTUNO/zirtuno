// verify-soak (R5-E) — the battery answer, measured. One continuous session
// against the PRODUCTION build: idle-heavy with periodic scroll bursts, five-
// second telemetry, and hard assertions at the end:
//
//   · the governor engages and holds through true idle (the ~30 Hz floor)
//   · the watchdog NEVER demotes a calm page (tier stays full end to end)
//   · draws never stop (the liquid never freezes — §4.14)
//   · the JS heap does not climb (first-third vs last-third median)
//   · zero page/console errors across the whole run
//
//   npx next start -p 3001        (production build)
//   SOAK_MIN=32 BASE_URL=http://localhost:3001 node scripts/verify/soak.mjs
//
// Writes captures/soak/soak-<stamp>.json (full telemetry) + a summary line
// per minute so a stalled run is visible live.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const SOAK_MIN = Number(process.env.SOAK_MIN || 30);
const OUT_DIR = path.join(process.cwd(), "captures", "soak");
const SAMPLE_MS = 5000;
const BURST_EVERY_MIN = 5; // a human returns to the page now and then

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector(".journey-canvas canvas"), {
  timeout: 40000,
});
await page.waitForTimeout(5000); // entry veil + SDF builds + settle

// park mid-page (the work band): no hero autocycle here — the governor's
// steady-state home. The bursts leave and return to this anchor.
const anchor = await page.evaluate(() => {
  const el = document.querySelector("#work");
  const r = el.getBoundingClientRect();
  return Math.round(r.top + window.scrollY + r.height * 0.45 - innerHeight * 0.5);
});
await page.evaluate((y) => window.scrollTo(0, y), anchor);
await page.waitForTimeout(2000);

const samples = [];
const t0 = Date.now();
const endAt = t0 + SOAK_MIN * 60 * 1000;
let lastBurst = t0;
let bursting = false;

while (Date.now() < endAt) {
  await page.waitForTimeout(SAMPLE_MS);

  // the burst: scroll away and back — wake, handoffs, re-idle
  if (!bursting && Date.now() - lastBurst > BURST_EVERY_MIN * 60 * 1000) {
    bursting = true;
    for (let i = 1; i <= 4; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), anchor + i * 400);
      await page.waitForTimeout(350);
    }
    for (let i = 3; i >= 0; i--) {
      await page.evaluate((y) => window.scrollTo(0, y), anchor + i * 400);
      await page.waitForTimeout(350);
    }
    lastBurst = Date.now();
    bursting = false;
  }

  const s = await page.evaluate(() => {
    const o = window.__optics ?? {};
    const m = performance.memory;
    return {
      frames: o.frames ?? -1,
      gov: o.gov ?? -1,
      tier: o.tier ?? "?",
      post: o.post ?? -1,
      heap: m ? m.usedJSHeapSize : -1,
      y: window.scrollY,
    };
  });
  s.t = Date.now() - t0;
  s.sinceBurstMs = Date.now() - lastBurst;
  samples.push(s);

  if (samples.length % 12 === 0) {
    const mins = Math.round(s.t / 60000);
    console.log(
      `  … ${mins} min: frames=${s.frames} gov=${s.gov} tier=${s.tier} heap=${(s.heap / 1048576).toFixed(1)}MB`,
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(
  path.join(OUT_DIR, `soak-${stamp}.json`),
  JSON.stringify({ base: BASE, soakMin: SOAK_MIN, anchor, errors, samples }),
);

// ── assertions ────────────────────────────────────────────────────────────────
console.log(`SOAK ${SOAK_MIN} min · ${samples.length} samples`);

// never frozen: every inter-sample window advanced (governed floor ≈ 30 Hz
// → ~150 draws per 5 s; 60 is the alarm line)
let minDelta = Infinity;
for (let i = 1; i < samples.length; i++) {
  const d = samples[i].frames - samples[i - 1].frames;
  if (d >= 0 && d < minDelta) minDelta = d; // ignore rebuild counter resets
}
check(minDelta >= 60, "draws never stall (governed floor holds)", `min Δframes/5s=${minDelta}`);

// the watchdog never demotes a calm page
const tiers = new Set(samples.map((s) => s.tier));
check(
  tiers.size === 1 && tiers.has("full"),
  "tier stays full end to end (no idle demotion)",
  [...tiers].join(","),
);

// the governor owns true idle: of the samples far from any burst (>90 s),
// most must be governed — the battery posture is the resting state
const idle = samples.filter((s) => s.sinceBurstMs > 90000);
const govRate = idle.length
  ? idle.filter((s) => s.gov === 1).length / idle.length
  : 1;
check(
  idle.length === 0 || govRate >= 0.7,
  "governor holds the idle floor (≥70% of idle samples)",
  `${(govRate * 100).toFixed(0)}% of ${idle.length}`,
);

// heap: first-third vs last-third median — a leak climbs, GC noise doesn't
const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  return a.length ? a[a.length >> 1] : 0;
};
const heaps = samples.map((s) => s.heap).filter((h) => h > 0);
const third = Math.max(1, Math.floor(heaps.length / 3));
const grow = (median(heaps.slice(-third)) - median(heaps.slice(0, third))) / 1048576;
check(grow < 25, "heap stays flat (no leak)", `${grow.toFixed(1)}MB median growth`);

check(errors.length === 0, "zero errors across the soak", errors[0]);

await browser.close();
console.log(failures === 0 ? "SOAK: green" : `SOAK FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
