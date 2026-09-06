/**
 * THE COMPANION, LARGE — a geometry contact sheet straight from the kernel.
 *
 * Same argument `capture/coalesce-sheet.mjs` makes: the thing under review is
 * a 76 px droplet on a 1440 px page, and judging an EXPRESSION at that size is
 * guessing. A brow that reads as a scowl at 5x can read as a smudge at 1x, and
 * — the failure that actually matters here — a pose that reads as *sad* rather
 * than *angry* is invisible in a page still and obvious in a grid.
 *
 * So this bypasses the page entirely: it drives `companion.mjs` directly, lets
 * each expression settle, emits every contour into one SVG at 4x and rasterises
 * it. No dev server, no layout, no clock — just the geometry, big enough to
 * judge. What a reviewer is looking for, in order:
 *
 *   · every expression is DISTINCT from its neighbours at a glance
 *   · `angry` reads as anger and not as sleep — the tell is the flat crown and
 *     the dropped INNER corners, not the narrowed lids on their own
 *   · `doubt` is milder than `angry` by an obvious margin, because it is what
 *     a first mistake gets
 *   · `delivered` reads as content, not as unconscious
 *   · no pupil touches the body's edge in any panel, at any gaze
 *   · nothing squares off, kinks or grows a cone anywhere in the sweep
 *
 *   node scripts/capture/companion.mjs        (npm run companion:sheet)
 *   ONLY=angry node scripts/capture/companion.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
import { COMP, EXPRESSION_NAMES, makeCompanion } from "../../lib/motion/companion.mjs";

const OUT = process.env.OUT ?? "captures/companion";
const Z = Number(process.env.Z ?? 4);
const COLS = Number(process.env.COLS ?? 5);
const ONLY = process.env.ONLY ?? null;

const VIEW = COMP.VIEW * 2; // the shipped viewBox, straight from the kernel
const CELL = VIEW * Z;
const HEAD = 26;

fs.mkdirSync(OUT, { recursive: true });

/** Settle a companion into a pose and return its three contours. */
function pose({
  expression,
  gx = 0,
  gy = 0,
  seed = 1,
  strike = null,
  hand = null,
  ms = 1600,
}) {
  const c = makeCompanion(seed);
  c.step(0);
  c.express(expression);
  c.aim(gx, gy);
  let t = 0;
  const frame = 1000 / 60;
  while (t < ms) {
    t += frame;
    c.step(t);
  }
  // A HAND HELD AGAINST THE SURFACE — the CTAs' displacement well, on the
  // droplet's ring. Held for a while, because the well is integrated rather
  // than applied: a panel shot one frame after contact shows nothing.
  if (hand) {
    c.hand(hand[0], hand[1], 0, 0);
    c.press(true);
    for (let i = 0; i < 18; i++) {
      t += frame;
      c.step(t);
    }
  }
  if (strike) {
    c.strike(strike[0], strike[1], t, 1);
    c.poke(strike[0], strike[1], strike[2] ?? 1);
    for (let i = 0; i < 5; i++) {
      t += frame;
      c.step(t);
    }
  }
  return {
    body: c.bodyPath(),
    left: c.pupilPath(-1),
    right: c.pupilPath(1),
    chill: c.chill,
  };
}

// ── the panels ──────────────────────────────────────────────────────────────
// Block A: every expression, looking straight at the reader. This is the sheet
// that answers "are these thirteen different things".
const panels = [];
const names = ONLY ? EXPRESSION_NAMES.filter((n) => n === ONLY) : EXPRESSION_NAMES;
for (const name of names) {
  panels.push({ label: name, ...pose({ expression: name }) });
}

if (!ONLY) {
  // Block B: the gaze, on the state a visitor spends most of their time in.
  // Eight compass points, so a clamp that only fires on one axis shows up.
  const compass = [
    ["N", 0, -1],
    ["NE", 0.7, -0.7],
    ["E", 1, 0],
    ["SE", 0.7, 0.7],
    ["S", 0, 1],
    ["SW", -0.7, 0.7],
    ["W", -1, 0],
    ["NW", -0.7, -0.7],
  ];
  for (const [tag, gx, gy] of compass) {
    panels.push({
      label: `attend ${tag}`,
      ...pose({ expression: "attend", gx: gx * 1.4, gy: gy * 1.4 }),
    });
  }

  // Block C: the scowl under a committed stare, and under a blow. `angry`
  // spends gaze 1.2, so this is where containment is closest.
  // Block C0: the surface answering a hand and a press — the whole of what
  // "the same property as our CTAs" means, and invisible in every other panel.
  panels.push({
    label: "hand E",
    ...pose({ expression: "curious", gx: 1.2, hand: [COMP.R, 0] }),
  });
  panels.push({
    label: "hand SW",
    ...pose({ expression: "curious", gx: -0.9, gy: 0.9, hand: [-COMP.R * 0.7, COMP.R * 0.7] }),
  });
  panels.push({
    label: "struck N",
    ...pose({ expression: "startled", gy: -1.2, hand: [0, -COMP.R], strike: [0, -COMP.R, 1.4] }),
  });

  panels.push({ label: "angry E", ...pose({ expression: "angry", gx: 1.4, gy: 0 }) });
  panels.push({ label: "angry SW", ...pose({ expression: "angry", gx: -1, gy: 1 }) });
  panels.push({
    label: "angry struck",
    ...pose({ expression: "angry", gx: 1.2, gy: -0.4, strike: [0.4, 0.9, 1.4] }),
  });
  panels.push({
    label: "read struck",
    ...pose({ expression: "read", gx: -0.8, gy: 0.5, strike: [-1, 0.2, 1] }),
  });
  // `dodge` is the one expression that is INVISIBLE at gaze zero: its whole
  // content is a negative lean, and a lean with nothing to lean away from is
  // just the rest pose. Shown against a gaze, beside the state it contrasts
  // with, or the panel says nothing.
  panels.push({ label: "dodge E", ...pose({ expression: "dodge", gx: 1.4, gy: 0 }) });
  panels.push({ label: "notice E", ...pose({ expression: "notice", gx: 1.4, gy: 0 }) });

  // Block D: the same rest pose on four seeds. The lobe is seeded, so this is
  // the check that no seed produces a silhouette with a flat spot or a cusp.
  for (const seed of [1, 2, 3, 4]) {
    panels.push({ label: `rest seed ${seed}`, ...pose({ expression: "rest", seed }) });
  }
}

const rows = Math.ceil(panels.length / COLS);
const CELL_H = CELL + HEAD;

// The shipped material: a cyan hairline over a fill at 0.012, with the pupils
// solid. `chill` is mixed here the way `.cp-svg` mixes it in CSS, so the sheet
// shows the colour the page will actually paint.
const CYAN = [0x00, 0xe3, 0xfe];
const DEEP = [0x00, 0xb6, 0xcc];
const mix = (k) =>
  "#" +
  CYAN.map((c, i) =>
    Math.round(c * (1 - k) + DEEP[i] * k)
      .toString(16)
      .padStart(2, "0"),
  ).join("");

let body = "";
panels.forEach((p, i) => {
  const col = i % COLS;
  const row = (i / COLS) | 0;
  const ox = col * CELL + CELL / 2;
  const oy = row * CELL_H + HEAD + CELL / 2;
  const stroke = mix(p.chill);
  body +=
    `<g transform="translate(${ox} ${oy}) scale(${Z})">` +
    `<path d="${p.body}" fill="#00E3FE" fill-opacity="0.012" stroke="${stroke}" stroke-width="${1 / Z}"/>` +
    (p.left ? `<path d="${p.left}" fill="${stroke}" fill-opacity="0.9"/>` : "") +
    (p.right ? `<path d="${p.right}" fill="${stroke}" fill-opacity="0.9"/>` : "") +
    `</g>` +
    `<text x="${col * CELL + 10}" y="${row * CELL_H + 17}" fill="#F2F0EB" fill-opacity="0.55"` +
    ` font-family="monospace" font-size="12">${p.label}</text>`;
});

const W = COLS * CELL;
const H = rows * CELL_H;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="100%" height="100%" fill="#000000"/>${body}</svg>`;

fs.writeFileSync(`${OUT}/sheet.svg`, svg);

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: W, height: Math.min(H, 4000) } });
await page.setContent(`<body style="margin:0;background:#000">${svg}</body>`);
await page.screenshot({ path: `${OUT}/sheet.png`, fullPage: true });
await browser.close();

console.log(
  `R=${COMP.R} ring=${COMP.RING_N} pupil=${COMP.PUPIL_N} · ${panels.length} panels at ${Z}x -> ${OUT}/sheet.png`,
);
