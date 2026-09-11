/**
 * THE COMPANION, AS A STILL — one droplet, emitted straight from the kernel.
 *
 *   node scripts/capture/studio-avatar.mjs        (npm run studio:avatar)
 *   EXPRESSION=curious node scripts/capture/studio-avatar.mjs
 *
 * S8's stack fan carries the studio's own agent beside the tools it is built
 * on, and that tile needs a picture of him. Screenshotting the contact page
 * would have been quicker and would have been wrong twice over: the droplet
 * there is a live WebGL membrane at ~76 px, so the still would be soft, and it
 * would be a COPY — the moment the kernel's geometry changed, the card would
 * quietly keep showing last year's face.
 *
 * So this drives `lib/motion/companion.mjs` directly, exactly as
 * `capture/companion.mjs` does for its contact sheet, settles one expression,
 * and writes the three contours out as a standalone transparent SVG. Vector,
 * about 4 kB, sharp at any tile size, and regenerated from the same source of
 * truth the live droplet runs — re-run it after any change to the kernel.
 */
import fs from "node:fs";
import path from "node:path";
import { COMP, PARAM, makeCompanion } from "../../lib/motion/companion.mjs";

const OUT = process.env.OUT ?? "public/studio/avatar.svg";
const EXPRESSION = process.env.EXPRESSION ?? "curious";
const SEED = Number(process.env.SEED ?? 1);
// A little off-axis. Dead-centre pupils read as a stare at tile scale; a small
// lean gives him somewhere to be looking, which is the whole character.
const GAZE_X = Number(process.env.GAZE_X ?? 0.28);
const GAZE_Y = Number(process.env.GAZE_Y ?? -0.18);
// The contact sheet strokes at 1.15 inside a 4x scale, so its hairline is four
// times heavier than the same number here. This still is rendered at ~45 px in
// a fan tile, where 1.15 on a 120 viewBox is a third of a pixel and disappears
// — the droplet has to carry at tile scale or the tile is empty. It also has
// to hold its own beside five SOLID marks: a contour reads lighter than a
// filled glyph of the same size, so it is strengthened past what would be
// right on its own.
const STROKE = Number(process.env.STROKE ?? 3.6);
const FILL = Number(process.env.FILL ?? 0.2);

const c = makeCompanion(SEED);
c.step(0);
c.express(EXPRESSION);
c.aim(GAZE_X, GAZE_Y);
for (let t = 0; t < 1600; t += 1000 / 60) c.step(t);

const body = c.bodyPath();
const left = c.pupilPath(-1);
const right = c.pupilPath(1);

// `chill` and friends are the kernel's colour params; `app/contact.css` mixes
// them into `--cp-base` for the page. Lift that same block so the still is the
// colour the live droplet paints, not a hand-picked cyan that drifts from it.
const contactCSS = fs.readFileSync("app/contact.css", "utf8");
const palette = contactCSS.match(/ {2}--cp-base: [\s\S]*?\n}/)[0].slice(0, -1);
const params = ["chill", "cool", "warm", "gold", "blush", "glow"]
  .map((k) => `--cp-${k}:${Math.max(0, Math.min(1, c.params[PARAM[k]]))}`)
  .join(";");

const VIEW = COMP.VIEW * 2;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}"` +
  ` role="img" aria-labelledby="zirtuno-companion-title">` +
  `<title id="zirtuno-companion-title">Zirtuno companion</title>` +
  `<style>:root{--color-cyan:#00e3fe;--color-cyan-deep:#00b6cc;--color-paper:#f2f0eb}` +
  `.avatar{${palette}${params}}</style>` +
  `<g class="avatar">` +
  `<path d="${body}" fill="currentColor" fill-opacity="${FILL}" stroke="currentColor" stroke-width="${STROKE}"/>` +
  (left ? `<path d="${left}" fill="currentColor" fill-opacity="0.9"/>` : "") +
  (right ? `<path d="${right}" fill="currentColor" fill-opacity="0.9"/>` : "") +
  `</g></svg>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(
  `${EXPRESSION} · gaze ${GAZE_X},${GAZE_Y} · viewBox ${VIEW} -> ${OUT} (${svg.length} bytes)`,
);
