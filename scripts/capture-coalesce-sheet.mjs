/**
 * THE MERGE, LARGE — a geometry contact sheet straight from the kernel.
 *
 * `capture-field-liquid.mjs` photographs the real page, which is the only way
 * to know the layer is wired up. But the merge itself is a 16 px detail on a
 * 576 px form, and judging its SHAPE from a full-form screenshot is guessing:
 * the squared-off tab that this design went through survived two rounds of
 * page stills before anyone could see what it was.
 *
 * So this bypasses the page entirely. It drives `coalesce.mjs` directly at a
 * sweep of standoffs, emits every contour into one SVG at 5x, and rasterises
 * it. No dev server, no clock, no layout — just the geometry, big enough to
 * review. What a reviewer is looking for, in order:
 *
 *   · the resting bead reads as liquid ON the rim, not as a dent in it
 *   · the neck draws OUT as the bead leaves — it does not simply thin
 *   · nothing squares off, kinks, or grows a cone anywhere in the sweep
 *   · the frame the bead becomes its own body is not findable by eye
 *   · the corners are still corners in every single panel
 *
 *   node scripts/capture-coalesce-sheet.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
import { makeMembrane } from "../lib/motion/membrane.mjs";
import {
  COAL,
  dropRing,
  unionContour,
  beadContour,
} from "../lib/motion/coalesce.mjs";

const OUT = process.env.OUT ?? "captures/field-liquid";
const Z = Number(process.env.Z ?? 5); // zoom
// A SHORT field. The merge geometry depends on the edge's HEIGHT and not at
// all on its width, and drawing the shipped 576 px width at 5x put every
// panel's body straight through the six panels after it.
const W = 100;
const H = 57;
// A window around the bead's rest position — the whole event fits in this.
const VIEW_W = 140;
const VIEW_H = H + 30;

fs.mkdirSync(OUT, { recursive: true });

const mem = makeMembrane(W, H);
mem.step(0);
const beadMem = makeMembrane(0, 0, {
  ring: dropRing(COAL.R, COAL.RING_N, 0.61),
  handR: COAL.R * 2.6,
  maxN: COAL.R * 0.7,
});
beadMem.step(0);

/** A bead frozen at one standoff, optionally drawn out along its travel. */
const frozen = (standoff, stretch = 0) => ({
  x: -standoff,
  y: H / 2,
  r: COAL.R,
  stretch,
  ux: 0,
  uy: 1,
  alive: true,
  sdf: (qx, qy) => {
    const dx = qx + standoff;
    const dy = qy - H / 2;
    if (stretch <= 1e-4) return Math.hypot(dx, dy) - COAL.R;
    const sa = 1 + stretch;
    const sb = 1 / sa;
    return (Math.hypot(dx / sb, dy / sa) - COAL.R) * sb;
  },
});

// The sweep. Denser through the handover at K/2, because that is the frame
// that has to be unfindable.
const stops = (process.env.STOPS ?? "0,2,4,6,7,8,9,10,12,14,17,20,23,26").split(",").map(Number);
const COLS = Number(process.env.COLS ?? 5);
const rows = Math.ceil(stops.length / COLS);
const CELL_W = VIEW_W * Z;
const CELL_H = VIEW_H * Z + 26;

let body = "";
stops.forEach((p, i) => {
  const col = i % COLS;
  const row = (i / COLS) | 0;
  // The bead is drawn out along its travel in proportion to how far it is
  // lifted, which is what the runtime does — so a panel is a real frame.
  const stretch = COAL.STRETCH_K * Math.min(p / COAL.LIFT_MAX, 1);
  const b = frozen(p, stretch);
  const u = unionContour(mem, b);
  const bd = u.merged ? "" : beadContour(beadMem, b); // as shipped
  const label = `${p} px${u.merged ? "  · absorbed" : "  · own body"}`;
  // origin: the field's left edge, with room to its left for the bead
  const ox = col * CELL_W + 34 * Z;
  const oy = row * CELL_H + 14 * Z + 22;
  body +=
    // Clipped to its own cell, so one panel can never bleed into the next.
    // The clip group is OUTSIDE the transform on purpose: `clip-path` on an
    // element that also carries a `transform` is evaluated in that element's
    // NEW user space, so a rect written in page coordinates lands somewhere
    // else entirely — which clipped twelve of these panels out of existence
    // and cropped the bulge off the thirteenth.
    `<clipPath id="c${i}"><rect x="${col * CELL_W}" y="${row * CELL_H}" width="${CELL_W - 4}" height="${CELL_H}"/></clipPath>` +
    `<g clip-path="url(#c${i})"><g transform="translate(${ox} ${oy}) scale(${Z})">` +
    `<path d="${u.d}" fill="#00E3FE" fill-opacity="0.03" stroke="#00E3FE" stroke-width="${1 / Z}"/>` +
    (bd
      ? `<path d="${bd}" fill="#00E3FE" fill-opacity="0.06" stroke="#00E3FE" stroke-width="${1 / Z}"/>`
      : "") +
    `</g></g>` +
    `<text x="${col * CELL_W + 10}" y="${row * CELL_H + 16}" fill="#F2F0EB" fill-opacity="0.55"` +
    ` font-family="monospace" font-size="12">${label}</text>`;
});

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL_W}" height="${rows * CELL_H}"` +
  ` viewBox="0 0 ${COLS * CELL_W} ${rows * CELL_H}">` +
  `<rect width="100%" height="100%" fill="#000000"/>${body}</svg>`;

fs.writeFileSync(`${OUT}/sheet.svg`, svg);

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({
  viewport: { width: COLS * CELL_W, height: rows * CELL_H },
});
await page.setContent(
  `<body style="margin:0;background:#000">${svg}</body>`,
);
await page.screenshot({ path: `${OUT}/sheet.png` });
await browser.close();

console.log(
  `R=${COAL.R} K=${COAL.K} handover at ${COAL.K / 2} px · ${stops.length} panels at ${Z}x → ${OUT}/sheet.png`,
);
