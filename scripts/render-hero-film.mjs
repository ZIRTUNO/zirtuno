// Pre-render the hero metaball morph cycle to a looping VIDEO so the real glass
// animation plays on EVERY device (integrated GPUs just decode video — no
// raymarch, no freeze). Live WebGL stays a capable-GPU enhancement on top.
//
// Renders deterministic frozen frames (?pair=a-b-m, full glass tier) around the
// full cycle mark→web→…→marketing→mark, then ffmpeg-encodes webm + mp4 + poster
// into public/hero/.
//   BASE_URL=http://localhost:PORT node scripts/render-hero-film.mjs

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:65138";
const SEL = "[data-hero-metaball] canvas"; // the glass plane only (no chrome)
const HIDE_CHROME =
  ".side-index,.pillar-indicator{display:none!important}"; // overlap the hero stage
const TMP = "captures/film";
const OUT = "public/hero";
const STEPS_PER = Number(process.env.STEPS_PER ?? 6); // m-steps per transition
const WAIT = Number(process.env.FRAME_WAIT ?? 6500); // software-GL settle per frame
const FPS = Number(process.env.FPS ?? 12);
const SIZE = 480;

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// the cycle: 0→1→2→…→7→0 (back to the mark), continuous morph
const transitions = [];
for (let i = 0; i < 8; i++) transitions.push([i, (i + 1) % 8]);

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await (
  await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  })
).newPage();

let idx = 0;
for (const [a, b] of transitions) {
  for (let s = 0; s < STEPS_PER; s++) {
    const m = (s / STEPS_PER).toFixed(3); // 0 … <1 (b's m=0 is next transition)
    await page.goto(`${BASE}/en?pair=${a}-${b}-${m}#hero`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
    await page.addStyleTag({ content: HIDE_CHROME });
    await page.waitForTimeout(WAIT);
    const el = page.locator(SEL).first();
    await el.scrollIntoViewIfNeeded();
    const file = path.join(TMP, `frame_${String(idx).padStart(3, "0")}.png`);
    await el.screenshot({ path: file });
    console.log(`frame ${idx} — ${a}→${b} @ ${m}`);
    idx++;
  }
}
await browser.close();
console.log(`captured ${idx} frames; encoding…`);

// normalize to an even square + encode. webm (vp9) for modern browsers, mp4
// (h264) fallback, jpg poster (the mark, frame 0).
const vf = `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`;
const inPat = path.join(TMP, "frame_%03d.png");

execFileSync(
  "ffmpeg",
  ["-y", "-framerate", String(FPS), "-i", inPat, "-vf", vf, "-an",
   "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-pix_fmt", "yuv420p",
   path.join(OUT, "morph-loop.webm")],
  { stdio: "inherit" },
);
execFileSync(
  "ffmpeg",
  ["-y", "-framerate", String(FPS), "-i", inPat, "-vf", vf, "-an",
   "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
   path.join(OUT, "morph-loop.mp4")],
  { stdio: "inherit" },
);
execFileSync(
  "ffmpeg",
  ["-y", "-i", path.join(TMP, "frame_000.png"), "-vf", vf, "-frames:v", "1",
   "-update", "1", "-q:v", "3", path.join(OUT, "morph-poster.jpg")],
  { stdio: "inherit" },
);

const sizes = ["morph-loop.webm", "morph-loop.mp4", "morph-poster.jpg"].map(
  (f) => `${f}=${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)}KB`,
);
console.log("FILM " + JSON.stringify({ frames: idx, fps: FPS, out: sizes }));
