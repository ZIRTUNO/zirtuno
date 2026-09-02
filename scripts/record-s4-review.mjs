/**
 * Record a presentation-quality Services morph pass for owner review.
 *
 * The capture still follows the real scroll -> scene -> conductor path. The
 * only review-only additions are a clean crop, an unobtrusive form label, and
 * equal pacing for all six bridges so every transition receives the same
 * scrutiny.
 *
 *   node scripts/record-s4-review.mjs
 *   OUT=artifacts/s4-review/custom.mp4 node scripts/record-s4-review.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.OUT ?? "artifacts/s4-review/s4-morph-review-hq.mp4";
const RAW = process.env.RAW ?? "artifacts/s4-review/s4-morph-review-hq-raw.webm";
const MORPH_MS = Number(process.env.MORPH_MS ?? 4800);
const HOLD_MS = Number(process.env.HOLD_MS ?? 1700);
const FIRST_HOLD_MS = Number(process.env.FIRST_HOLD_MS ?? 2600);
const FINAL_HOLD_MS = Number(process.env.FINAL_HOLD_MS ?? 4500);
const REST_SETTLE_MS = Number(process.env.REST_SETTLE_MS ?? 2000);
const WHEEL_STEPS = Number(process.env.WHEEL_STEPS ?? 120);
const OUTPUT_FPS = Number(process.env.OUTPUT_FPS ?? 30);
const FORM_COUNT = Math.max(1, Math.min(7, Number(process.env.FORM_COUNT ?? 7)));
const HARDWARE_CAPTURE = process.env.HARDWARE_CAPTURE === "1";
const HEADFUL_CAPTURE = process.env.HEADFUL_CAPTURE === "1";
const WHEEL_MULTIPLIER = 0.9; // LenisProvider's locked wheelMultiplier
const VIEWPORT = { width: 1600, height: 1000 };
const CROP = { x: 600, y: 0, width: 1000, height: 1000 };
const LABELS = [
  "WEB DESIGN",
  "SOFTWARE",
  "AI",
  "AUTOMATION",
  "DATA",
  "BRANDING",
  "MARKETING",
];

for (const file of [OUT, RAW])
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  headless: HEADFUL_CAPTURE ? false : LAUNCH.headless,
  args: HARDWARE_CAPTURE
    ? ["--enable-gpu", "--ignore-gpu-blocklist"]
    : [
        "--enable-unsafe-swiftshader",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--ignore-gpu-blocklist",
      ],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: path.dirname(RAW), size: VIEWPORT },
});
const page = await context.newPage();
const recordingStartedAt = Date.now();

await page.goto(`${BASE}/en?ftier=full&fgov=0&fcine=0`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(
  () =>
    !!window.__scenes &&
    document.querySelector(".liquid-journey")?.getAttribute("data-field-ready") === "true",
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

// Preserve the full semantic page geometry for the conductor while showing
// only the persistent canvas. The label is capture metadata, not site UI.
await page.addStyleTag({
  content: `
    html, body { background: #000 !important; }
    .journey-content,
    .journey-interactions,
    .origin-pillar-labels,
    .cine-veils,
    .topbar,
    .side-index,
    .cursor-dot,
    .cursor-ring { visibility: hidden !important; }
    #s4-review-label {
      position: fixed;
      z-index: 9999;
      top: 34px;
      left: ${CROP.x + 42}px;
      color: rgba(242, 240, 235, 0.78);
      font: 600 15px/1.2 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: 0.12em;
      pointer-events: none;
    }
    #s4-review-label b { color: #00e3fe; font-weight: 700; }
  `,
});
await page.evaluate(() => {
  const label = document.createElement("div");
  label.id = "s4-review-label";
  document.body.appendChild(label);
});

const targets = await page.evaluate((formCount) => {
  const pillars = [...document.querySelectorAll("#services .pillar")];
  if (pillars.length !== 7)
    throw new Error(`expected 7 S4 pillars, got ${pillars.length}`);
  return pillars.slice(0, formCount).map((el) => {
    const box = el.getBoundingClientRect();
    const mid = box.top + window.scrollY + box.height / 2;
    return Math.round(mid - window.innerHeight / 2);
  });
}, FORM_COUNT);

const setLabel = async (html) =>
  page.evaluate((value) => {
    const label = document.querySelector("#s4-review-label");
    if (label) label.innerHTML = value;
  }, html);

const sceneState = () =>
  page.evaluate(() => {
    const s = window.__scenes.site;
    const shown = s.pairM >= 0.85 ? s.pairB : s.pairM <= 0.15 ? s.pairA : -1;
    return {
      scrollY: Math.round(window.scrollY),
      pairA: s.pairA,
      pairB: s.pairB,
      pairM: Number(s.pairM.toFixed(3)),
      shown,
    };
  });

const settleAt = async (target, wanted) => {
  // driveTo has already set Lenis's destination exactly. Let its shipped
  // inertia resolve instead of fighting it with scrollTo or correction wheels.
  await page.waitForFunction(
    (y) => Math.abs(window.scrollY - y) < 2,
    target,
    { timeout: 15000 },
  );
  await page.waitForTimeout(REST_SETTLE_MS);
  const state = await sceneState();
  if (state.shown !== wanted)
    throw new Error(
      `rest ${wanted} did not settle at target ${target} (scrollY ${state.scrollY}): ` +
        `pair ${state.pairA}->${state.pairB}, m=${state.pairM}`,
    );
  return state;
};

const driveTo = async (target) => {
  await page.evaluate(
    ({ destination, duration, steps, multiplier }) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        // Lenis scales incoming wheel deltas before adding them to its target.
        // Compensate once here so every visual bridge ends on its exact rest.
        const total = (destination - startY) / multiplier;
        const started = performance.now();
        let sent = 0;
        let previous = 0;
        const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
        const tick = (now) => {
          const due = Math.min(steps, Math.floor(((now - started) / duration) * steps));
          while (sent < due) {
            sent++;
            const cumulative = total * ease(sent / steps);
            window.dispatchEvent(
              new WheelEvent("wheel", {
                deltaY: cumulative - previous,
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                bubbles: true,
                cancelable: true,
              }),
            );
            previous = cumulative;
          }
          if (sent < steps) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      }),
    {
      destination: target,
      duration: MORPH_MS,
      steps: WHEEL_STEPS,
      multiplier: WHEEL_MULTIPLIER,
    },
  );
};

// Prepare off-camera. The encoded video begins only after the first exact form
// has settled, eliminating the white document/entry frames from the raw file.
await driveTo(targets[0]);
await settleAt(targets[0], 1);
await setLabel(`<b>01 / 07</b>&nbsp;&nbsp;${LABELS[0]}`);
await page.waitForTimeout(350);
const clipStartedAt = Date.now();
const rests = [];
rests.push(await sceneState());
await page.waitForTimeout(FIRST_HOLD_MS);

for (let index = 1; index < targets.length; index++) {
  const from = String(index).padStart(2, "0");
  const to = String(index + 1).padStart(2, "0");
  await setLabel(`<b>${from} → ${to}</b>&nbsp;&nbsp;MORPH`);
  await driveTo(targets[index]);
  const state = await settleAt(targets[index], index + 1);
  rests.push(state);
  await setLabel(`<b>${to} / 07</b>&nbsp;&nbsp;${LABELS[index]}`);
  await page.waitForTimeout(index === targets.length - 1 ? FINAL_HOLD_MS : HOLD_MS);
}

await page.waitForTimeout(1000);
const clipEndedAt = Date.now();
const video = page.video();
await page.close();
if (!video) throw new Error("Playwright did not create an S4 review video");
await video.saveAs(RAW);
await context.close();
await browser.close();

// Browser video starts with the page. Trim to the prepared first rest, crop to
// the liquid column, and deliver a broadly playable high-quality H.264 MP4.
const clipOffset = Math.max(0, (clipStartedAt - recordingStartedAt) / 1000 - 0.12);
const clipDuration = (clipEndedAt - clipStartedAt) / 1000 + 0.2;
const probed = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    RAW,
  ],
  { encoding: "utf8" },
);
if (probed.status !== 0)
  throw new Error(`ffprobe failed (${probed.status}):\n${probed.stderr}`);
const rawDuration = Number(probed.stdout.trim());
const encodeDuration = Math.min(
  clipDuration,
  Math.max(0, rawDuration - clipOffset - 0.05),
);
const fadeOutAt = Math.max(0, encodeDuration - 0.35);
const filter = [
  "setpts=PTS-STARTPTS",
  `crop=${CROP.width}:${CROP.height}:${CROP.x}:${CROP.y}`,
  "scale=1080:1080:flags=lanczos",
  `fps=${OUTPUT_FPS}`,
  "format=yuv420p",
  "fade=t=in:st=0:d=0.2",
  `fade=t=out:st=${fadeOutAt.toFixed(3)}:d=0.35`,
].join(",");
const encoded = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-ss",
    clipOffset.toFixed(3),
    "-i",
    RAW,
    "-t",
    encodeDuration.toFixed(3),
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "16",
    "-movflags",
    "+faststart",
    "-an",
    OUT,
  ],
  { encoding: "utf8" },
);
if (encoded.status !== 0)
  throw new Error(`ffmpeg failed (${encoded.status}):\n${encoded.stderr}`);

console.log(
  JSON.stringify(
    {
      output: OUT,
      raw: RAW,
      duration: Number(encodeDuration.toFixed(2)),
      fps: OUTPUT_FPS,
      hardwareCapture: HARDWARE_CAPTURE,
      headfulCapture: HEADFUL_CAPTURE,
      rests,
    },
    null,
    2,
  ),
);
