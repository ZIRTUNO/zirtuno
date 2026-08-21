// verify-frame-cost — what the visitor's eye actually complains about.
//
// This is the REAL-GPU companion to verify-perf.mjs. That script runs the
// Playwright default browser on software GL, so its absolute numbers mean
// nothing on their own and it says so; it is useful only scene-vs-scene. This
// one launches the SYSTEM Chrome with a visible window, so frames go through
// the real driver and the real compositor, and the numbers are the ones the
// visitor gets.
//
// It reports JITTER, not just mean frame time, because stutter is variance.
// A steady 48 fps does not read as stutter; 48 fps assembled out of alternating
// 14 ms and 28 ms frames does. Mean frame time cannot tell those apart and it
// was the metric that let a very visible stutter sit unmeasured.
//
// It also reports the settled RUNG and the buffer size in megapixels, because
// this shader is very nearly pure fill: measured on an Intel UHD at 144 Hz the
// frame cost tracks buffer AREA and almost nothing else (1.77 Mpx → 24.3 ms,
// 1.13 → 17.3, 0.55 → 10.4). A frame-cost regression is almost always a
// buffer-size regression, so the two belong in the same line of output.
//
// Paired and interleaved: each condition is measured alternately in one browser
// session, and the MEDIAN of the repeats is reported. An integrated GPU warms
// up and throttles measurably over a few minutes of this, which is more than
// enough to invert an A/B run as two separate blocks.
//
//   node scripts/verify-frame-cost.mjs
//   CHROME_PATH=... BASE_URL=http://localhost:3000 node scripts/verify-frame-cost.mjs
//
// Compares the shipped buffer budget against ?fbudget=0, the rollback that
// restores the old spend-all-devicePixelRatio rule.

import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PAIRS = Number(process.env.PAIRS || 5);

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));
if (!executablePath) {
  console.error(
    "no system Chrome found — set CHROME_PATH. A bundled headless Chromium " +
      "would run on software GL and the numbers would be meaningless.",
  );
  process.exit(1);
}

const browser = await chromium.launch({
  headless: false, // headless falls back to SwiftShader: not the real cost
  chromiumSandbox: false,
  executablePath,
  args: ["--window-position=0,0", "--window-size=1460,960"],
});

/** One measured scroll pass over the services morphs, at the machine's own dpr. */
const sample = async (query) => {
  const ctx = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 60000,
  });
  await page.waitForTimeout(5200);
  await page.evaluate(() => document.getElementById("services")?.scrollIntoView());
  await page.waitForTimeout(1600);

  // The probe is armed BEFORE the scroll starts and resolves on its own clock,
  // so no CDP input dispatch lands inside the measured window.
  const probe = page.evaluate(
    () =>
      new Promise((res) => {
        const f = [];
        let last = performance.now();
        const t0 = last;
        const drawn0 = window.__optics?.frames ?? 0;
        const tick = (n) => {
          f.push(n - last);
          last = n;
          if (n - t0 < 2200) return requestAnimationFrame(tick);
          const raw = f.slice(3); // drop the arming frames
          const s = [...raw].sort((a, b) => a - b);
          const q = (x) => +s[Math.floor(s.length * x)].toFixed(1);
          let j = 0;
          for (let i = 1; i < raw.length; i++) j += Math.abs(raw[i] - raw[i - 1]);
          const d = window.__optics ?? {};
          const wall = raw.reduce((a, b) => a + b, 0);
          res({
            p50: q(0.5),
            p95: q(0.95),
            p99: q(0.99),
            // mean absolute change between consecutive frames — the number that
            // corresponds to what a visitor calls stutter
            jitter: +(j / Math.max(raw.length - 1, 1)).toFixed(2),
            drawHz: +(((d.frames - drawn0) / wall) * 1000).toFixed(1),
            tier: d.tier ?? "?",
            scale: d.scale ?? 0,
            vsync: d.vsync ?? 0,
            mpx: +(
              (d.scale * d.scale * innerWidth * innerHeight) /
              1e6
            ).toFixed(2),
          });
        };
        requestAnimationFrame(tick);
      }),
  );
  for (let i = 0; i < 26; i++) {
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(70);
  }
  const r = await probe;
  await ctx.close();
  return r;
};

const A = [];
const B = [];
for (let i = 0; i < PAIRS; i++) {
  A.push(await sample(""));
  B.push(await sample("?fbudget=0"));
}

const med = (arr, k) => {
  const s = arr.map((x) => x[k]).sort((a, b) => a - b);
  return +s[Math.floor(s.length / 2)].toFixed(2);
};
const line = (name, arr) =>
  " " +
  name.padEnd(26) +
  String(arr[0].tier).padEnd(10) +
  String(med(arr, "mpx")).padStart(6) +
  String(med(arr, "p50")).padStart(8) +
  String(med(arr, "p95")).padStart(8) +
  String(med(arr, "p99")).padStart(8) +
  String(med(arr, "jitter")).padStart(9) +
  String(med(arr, "drawHz")).padStart(10);

console.log(`panel vsync ≈ ${A[0].vsync} ms  ·  ${PAIRS} interleaved pairs`);
console.log(
  "\n condition                 tier         Mpx     p50     p95     p99   jitter  liquidHz",
);
console.log(line("shipped (buffer budget)", A));
console.log(line("?fbudget=0 (old rule)", B));

const worse =
  med(A, "p99") > med(B, "p99") * 1.05 || med(A, "jitter") > med(B, "jitter") * 1.1;
console.log(
  worse
    ? "\nFRAME_COST REGRESSION: the budget path is no better than the rollback"
    : "\nframe cost holds: the budget path is at least as smooth as the rollback",
);
await browser.close();
process.exit(worse ? 1 : 0);
