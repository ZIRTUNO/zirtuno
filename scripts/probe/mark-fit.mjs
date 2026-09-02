/**
 * Re-derives `TRACE_VIEWBOX` in components/chrome/BrandDraw.tsx.
 *
 * The header's drawn line and the header's painted mark are the same artwork
 * fitted TWO different ways — `background: contain` fits the source viewBox,
 * `MARK_D` is fitted to 0.78 of a square — so the overlay's viewBox exists only
 * to cancel the difference. Nothing measures that at runtime, so this prints the
 * four numbers whenever the mark, the generator's FIT, or `.logo-mark`'s
 * background sizing changes.
 *
 *   node scripts/probe/mark-fit.mjs
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Sample-accurate bbox for absolute M/L/C/z data (the mark is M/C/z only). */
function bbox(d, dx = 0, dy = 0) {
  const toks = d.match(/[MCLZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const b = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity };
  const hit = (x, y) => {
    if (x < b.minx) b.minx = x;
    if (y < b.miny) b.miny = y;
    if (x > b.maxx) b.maxx = x;
    if (y > b.maxy) b.maxy = y;
  };
  const num = () => parseFloat(toks[i++]);
  let cmd = "";
  while (i < toks.length) {
    if (/^[MCLZz]$/.test(toks[i])) cmd = toks[i++];
    if (cmd === "M" || cmd === "L") {
      cx = num() + dx;
      cy = num() + dy;
      if (cmd === "M") {
        sx = cx;
        sy = cy;
      }
      hit(cx, cy);
    } else if (cmd === "C") {
      const x1 = num() + dx;
      const y1 = num() + dy;
      const x2 = num() + dx;
      const y2 = num() + dy;
      const x = num() + dx;
      const y = num() + dy;
      for (let s = 0; s <= 32; s++) {
        const u = s / 32;
        const m = 1 - u;
        hit(
          m * m * m * cx + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x,
          m * m * m * cy + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y,
        );
      }
      cx = x;
      cy = y;
    } else if (/^[Zz]$/.test(cmd)) {
      cx = sx;
      cy = sy;
      cmd = "";
    } else break;
  }
  return { ...b, w: b.maxx - b.minx, h: b.maxy - b.miny };
}

const union = (list) =>
  list.reduce((a, c) => ({
    minx: Math.min(a.minx, c.minx),
    miny: Math.min(a.miny, c.miny),
    maxx: Math.max(a.maxx, c.maxx),
    maxy: Math.max(a.maxy, c.maxy),
  }));

// ── the painted mark: source viewBox, fitted by `background: contain` ────────
const svg = readFileSync("public/brand/zirtuno-logo-mark.svg", "utf8");
const [, vbW, vbH] = svg
  .match(/viewBox="0 0 (\d+) (\d+)"/)
  .map(Number)
  .slice(0, 3)
  .map(Number);
const [, tx, ty] = svg.match(/translate\((-?[\d.]+) (-?[\d.]+)\)/).map(Number);
const src = union(
  [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => bbox(m[1], tx, ty)),
);

// `contain` on a SQUARE box: the taller side of the viewBox meets the box, so
// the ink stands at (ink height / viewBox height) of the box.
const inkFit = (src.maxy - src.miny) / vbH;
// The ink's left edge, as a fraction of the box: the letterboxing plus the
// ink's own inset inside the rendered viewBox.
const scale = vbW / vbH; // rendered width, in box units
const inkLeft = (1 - scale) / 2 + (src.minx / vbW) * scale;
const inkTop = src.miny / vbH;

// ── the drawn line: baked geometry, fitted to FIT of a square ───────────────
const baked = await import(
  pathToFileURL(process.cwd() + "/lib/animation/intro-trace.data.mjs").href
);
const ink = union([bbox(baked.MARK_D), bbox(baked.DOT_D)]);

const side = (ink.maxy - ink.miny) / inkFit;
const y0 = ink.miny - inkTop * side;
const x0 = ink.minx - inkLeft * side;

const r = (n) => Math.round(n * 100) / 100;
console.log(`painted  viewBox ${vbW}x${vbH}  ink ${r(src.maxx - src.minx)}x${r(src.maxy - src.miny)} @ (${r(src.minx)}, ${r(src.miny)})`);
console.log(`         ink stands at ${r(inkFit * 100)}% of the box, left edge at ${r(inkLeft * 100)}%`);
console.log(`baked    viewBox ${baked.INTRO_VIEW}  ink ${r(ink.maxx - ink.minx)}x${r(ink.maxy - ink.miny)} @ (${r(ink.minx)}, ${r(ink.miny)})`);
console.log("");
console.log(`TRACE_VIEWBOX = "${r(x0)} ${r(y0)} ${r(side)} ${r(side)}"`);
