/**
 * THE MARK'S SPINE — generates lib/animation/mark-spine.data.mjs.
 *
 *   node scripts/tools/generate-mark-spine.mjs
 *
 * The Zirtuno mark is not an outline with a fill in it; it is one continuous
 * brush stroke that loops. `MARK_D` records where that stroke's EDGE runs, which
 * is what you need to FILL it and the wrong thing entirely if you want to DRAW
 * it — a head running along the contour traces a silhouette, and the form never
 * gets built. This recovers the other description: the path the brush travelled,
 * and the brush's radius at every step along it.
 *
 * Method, reusing what `tools/generate-intro-trace.mjs` established as this repo's one
 * definition of "inside the mark":
 *
 *   1. bake the group transform and fit into the same square VIEW at the same
 *      FIT, so the spine shares a coordinate frame with MARK_D exactly;
 *   2. rasterise the fill at RES with nonzero winding;
 *   3. `edt2d` the background → the inside distance, i.e. the brush radius;
 *   4. Zhang-Suen thin the fill to a one-pixel skeleton;
 *   5. Dijkstra between the skeleton's tips to order it into strokes;
 *   6. resample at uniform arc length, smooth, and emit points + radii.
 *
 * ── why Dijkstra and not a pixel-degree graph ──────────────────────────────
 * The obvious walk — find pixels with three or more neighbours, call them
 * junctions, cut there — does not survive contact with a thinned raster. An
 * 8-connected diagonal staircase puts three neighbours on a pixel in the middle
 * of a perfectly straight run: this skeleton is 990 px with 3 real tips, and a
 * degree test calls 318 of them junctions, so every branch walk dies within
 * nine pixels of its tip. Degree-1 IS reliable (it found exactly the 3 tips the
 * QA sheet shows), so the tips are the anchors and geodesics do the ordering.
 *
 * QA sheets land in captures/spine/. Look at them before trusting the numbers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { edt2d } from "../../lib/webgl/sdf-core.mjs";
import { ribbonQuads } from "../../lib/animation/mark-spine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "public", "brand", "zirtuno-logo-mark.svg");
const OUT = path.join(ROOT, "lib", "animation", "mark-spine.data.mjs");
const QA = path.join(ROOT, "captures", "spine");

/** Same frame as intro-trace.data.mjs — the two must be interchangeable. */
const VIEW = 1000;
const FIT = 0.78;
/** Thinning raster. 512 over a ~700-unit form is ~2 units per pixel: fine
 *  enough for the spine, coarse enough not to grow hair. */
const RES = 512;
/** Spine samples. The runtime rebuilds a ribbon from these every frame, so this
 *  is a real cost — 128 puts them ~9 units apart, well under a pixel at any
 *  header size. */
const SPINE_N = 128;
/** Smoothing window, in samples. The skeleton is quantised to the raster; this
 *  takes the stair-step out without pulling the spine off the ridge. */
const SMOOTH = 5;
/** Extra brush radius, in VIEW units, so the reveal covers the mark COMPLETELY.
 *
 *  The union of maximal inscribed discs is the shape — in the continuum. Zhang-
 *  Suen prunes the medial-axis branches that reach into convex bulges, so discs
 *  on the thinned ridge leave a thin bare rim all the way round the boundary
 *  (see captures/spine/spine-bare.png). A MULTIPLICATIVE fix cannot close it:
 *  the rim is roughly constant in width, so scaling overshoots where the brush
 *  is fat and still falls short where it is thin — x1.25 only reached 99.1%.
 *  An additive margin is the shape of the actual error, and +30 closes it to
 *  zero bare pixels.
 *
 *  Cost: the ribbon runs 30 units proud of the mark, which is 1.1 px at the
 *  header's 29 px render — invisible outside the artwork (the mask is clipped
 *  by it) and worth about a pixel of early bleed where the form passes close to
 *  itself across a counter. The generator asserts the 100%, so this number
 *  cannot quietly stop being enough. */
const COVER_MARGIN = 30;

// ── path parsing (absolute M/C/z only — asserted, not assumed) ─────────────
function parsePath(d) {
  const out = [];
  const tok = d.match(/[MCZmcz]|-?[\d.]+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "Z" || c === "z") {
      out.push({ c: "Z", p: [] });
      continue;
    }
    if (c !== "M" && c !== "C") {
      throw new Error(`mark-spine: expected absolute M/C/z, found "${c}"`);
    }
    const n = c === "M" ? 2 : 6;
    out.push({ c, p: tok.slice(i, i + n).map(Number) });
    i += n;
  }
  return out;
}
const mapSeg = (seg, f) =>
  seg.map(({ c, p }) => {
    const q = [];
    for (let i = 0; i < p.length; i += 2) q.push(...f(p[i], p[i + 1]));
    return { c, p: q };
  });

function flatten(seg, perCurve = 64) {
  const pts = [];
  let cx = 0;
  let cy = 0;
  for (const { c, p } of seg) {
    if (c === "M") {
      [cx, cy] = p;
      pts.push([cx, cy]);
    } else if (c === "C") {
      const [x1, y1, x2, y2, x, y] = p;
      for (let s = 1; s <= perCurve; s++) {
        const u = s / perCurve;
        const m = 1 - u;
        pts.push([
          m * m * m * cx + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x,
          m * m * m * cy + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y,
        ]);
      }
      cx = x;
      cy = y;
    }
  }
  return pts;
}

const bboxOf = (polys) => {
  const b = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity };
  for (const poly of polys)
    for (const [x, y] of poly) {
      if (x < b.minx) b.minx = x;
      if (y < b.miny) b.miny = y;
      if (x > b.maxx) b.maxx = x;
      if (y > b.maxy) b.maxy = y;
    }
  return b;
};

// ── 1 · bake + fit ─────────────────────────────────────────────────────────
const svg = fs.readFileSync(SRC, "utf8");
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
const gm = svg.match(/transform="translate\((-?[\d.]+)[ ,]+(-?[\d.]+)\)"/);
const [gx, gy] = gm ? [Number(gm[1]), Number(gm[2])] : [0, 0];

let markSeg = mapSeg(parsePath(ds[0]), (x, y) => [x + gx, y + gy]);
let dotSeg = mapSeg(parsePath(ds[1]), (x, y) => [x + gx, y + gy]);
const bb = bboxOf([flatten(markSeg), flatten(dotSeg)]);
const bw = bb.maxx - bb.minx;
const bh = bb.maxy - bb.miny;
const S = (VIEW * FIT) / Math.max(bw, bh);
const ox = VIEW / 2 - (bb.minx + bw / 2) * S;
const oy = VIEW / 2 - (bb.miny + bh / 2) * S;
const fitPt = (x, y) => [x * S + ox, y * S + oy];
markSeg = mapSeg(markSeg, fitPt);
dotSeg = mapSeg(dotSeg, fitPt);
const poly = flatten(markSeg, 64);

// ── 2 · rasterise the fill, nonzero winding ────────────────────────────────
const mask = new Uint8Array(RES * RES);
{
  const px = poly.map(([x, y]) => [(x / VIEW) * RES, (y / VIEW) * RES]);
  for (let y = 0; y < RES; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < px.length; i++) {
      const j = (i + 1) % px.length;
      const [x0, y0] = px[i];
      const [x1, y1] = px[j];
      if (y0 === y1) continue;
      if (yc < Math.min(y0, y1) || yc >= Math.max(y0, y1)) continue;
      const t = (yc - y0) / (y1 - y0);
      xs.push([x0 + (x1 - x0) * t, y1 > y0 ? 1 : -1]);
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind !== 0) {
        const a = Math.max(0, Math.ceil(xs[i][0] - 0.5));
        const b = Math.min(RES - 1, Math.floor(xs[i + 1][0] - 0.5));
        for (let x = a; x <= b; x++) mask[y * RES + x] = 1;
      }
    }
  }
}

// ── 3 · inside distance = the brush radius ────────────────────────────────
const bgSeed = new Uint8Array(RES * RES);
for (let i = 0; i < RES * RES; i++) bgSeed[i] = mask[i] ? 0 : 1;
const dsq = edt2d(bgSeed, RES, RES);
const dist = new Float64Array(RES * RES);
for (let i = 0; i < RES * RES; i++) dist[i] = Math.sqrt(dsq[i]);

// ── 4 · Zhang-Suen thinning ───────────────────────────────────────────────
const skel = Uint8Array.from(mask);
{
  const at = (x, y) => (x < 0 || y < 0 || x >= RES || y >= RES ? 0 : skel[y * RES + x]);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const sub of [0, 1]) {
      const kill = [];
      for (let y = 1; y < RES - 1; y++) {
        for (let x = 1; x < RES - 1; x++) {
          if (!skel[y * RES + x]) continue;
          const p = [
            at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
            at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1),
          ];
          const B = p.reduce((a, v) => a + v, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++;
          if (A !== 1) continue;
          if (sub === 0) {
            if (p[0] * p[2] * p[4]) continue;
            if (p[2] * p[4] * p[6]) continue;
          } else {
            if (p[0] * p[2] * p[6]) continue;
            if (p[0] * p[4] * p[6]) continue;
          }
          kill.push(y * RES + x);
        }
      }
      if (kill.length) {
        changed = true;
        for (const i of kill) skel[i] = 0;
      }
    }
  }
}

const key = (x, y) => y * RES + x;
const isOn = (x, y) => x >= 0 && y >= 0 && x < RES && y < RES && !!skel[key(x, y)];
const N8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const nbrs = (x, y) => N8.filter(([dx, dy]) => isOn(x + dx, y + dy)).map(([dx, dy]) => [x + dx, y + dy]);

const skelPx = [];
for (let y = 0; y < RES; y++)
  for (let x = 0; x < RES; x++) if (skel[key(x, y)]) skelPx.push([x, y]);
const tips = skelPx.filter(([x, y]) => nbrs(x, y).length === 1);
if (tips.length < 2) throw new Error(`mark-spine: expected >=2 tips, found ${tips.length}`);

// ── 5 · order the skeleton with geodesics ─────────────────────────────────
/** Dijkstra over skeleton pixels from one source. Returns cost + predecessor. */
function geodesic([sx, sy]) {
  const cost = new Float64Array(RES * RES).fill(Infinity);
  const prev = new Int32Array(RES * RES).fill(-1);
  cost[key(sx, sy)] = 0;
  // Skeletons are ~1000 px; a sorted-insert frontier is plenty and keeps this
  // dependency-free.
  const frontier = [[0, sx, sy]];
  while (frontier.length) {
    frontier.sort((a, b) => b[0] - a[0]);
    const [c, x, y] = frontier.pop();
    if (c > cost[key(x, y)]) continue;
    for (const [nx, ny] of nbrs(x, y)) {
      const step = nx !== x && ny !== y ? Math.SQRT2 : 1;
      const nc = c + step;
      if (nc < cost[key(nx, ny)]) {
        cost[key(nx, ny)] = nc;
        prev[key(nx, ny)] = key(x, y);
        frontier.push([nc, nx, ny]);
      }
    }
  }
  return { cost, prev };
}
const trace = (prev, from) => {
  const out = [];
  let k = key(...from);
  while (k >= 0) {
    out.push([k % RES, (k / RES) | 0]);
    k = prev[k];
  }
  return out;
};

// longest tip-to-tip geodesic = the stroke the brush actually made
const fields = tips.map(geodesic);
let best = { d: -1 };
for (let i = 0; i < tips.length; i++)
  for (let j = i + 1; j < tips.length; j++) {
    const d = fields[i].cost[key(...tips[j])];
    if (Number.isFinite(d) && d > best.d) best = { d, i, j };
  }
if (best.d < 0) throw new Error("mark-spine: skeleton tips are not connected");
const spinePx = trace(fields[best.i].prev, tips[best.j]);

// the remaining tip joins the spine somewhere — that stub is its own stroke
const onSpine = new Set(spinePx.map(([x, y]) => key(x, y)));
let hookPx = [];
for (let t = 0; t < tips.length; t++) {
  if (t === best.i || t === best.j) continue;
  const walk = trace(fields[t].prev, tips[t]).reverse(); // from the field's source
  const from = trace(geodesic(tips[t]).prev, tips[t]);
  // walk out from this tip until the spine is reached
  const { prev } = geodesic(tips[t]);
  let target = null;
  let bestC = Infinity;
  const { cost } = geodesic(tips[t]);
  for (const k of onSpine)
    if (cost[k] < bestC) {
      bestC = cost[k];
      target = [k % RES, (k / RES) | 0];
    }
  if (target) hookPx = trace(prev, target).reverse();
  void walk;
  void from;
}

// ── 6 · resample, smooth, sample the radius ───────────────────────────────
const toView = (v) => (v / RES) * VIEW;
const radiusAt = (vx, vy) => {
  const gx0 = Math.max(0, Math.min(RES - 1, Math.round((vx / VIEW) * RES)));
  const gy0 = Math.max(0, Math.min(RES - 1, Math.round((vy / VIEW) * RES)));
  return toView(dist[key(gx0, gy0)]);
};

function resample(pxList, n) {
  const pts = pxList.map(([x, y]) => [toView(x + 0.5), toView(y + 0.5)]);
  if (pts.length < 2) return { x: [], y: [], r: [], len: 0 };
  const seg = [];
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push(l);
    L += l;
  }
  const out = [];
  const step = L / (n - 1);
  let i = 0;
  let carry = 0;
  out.push(pts[0]);
  for (let k = 1; k < n; k++) {
    let want = step;
    while (i < seg.length - 1 && want > seg[i] - carry) {
      want -= seg[i] - carry;
      carry = 0;
      i++;
    }
    carry += want;
    const u = seg[i] > 1e-9 ? Math.min(1, carry / seg[i]) : 0;
    out.push([
      pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u,
      pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u,
    ]);
  }
  // moving average, endpoints pinned so the stroke still starts at the tip
  const sm = out.map((p, k) => {
    if (k === 0 || k === out.length - 1) return p;
    let ax = 0;
    let ay = 0;
    let w = 0;
    for (let d = -SMOOTH; d <= SMOOTH; d++) {
      const j = k + d;
      if (j < 0 || j >= out.length) continue;
      ax += out[j][0];
      ay += out[j][1];
      w++;
    }
    return [ax / w, ay / w];
  });
  let len = 0;
  for (let k = 0; k < sm.length - 1; k++)
    len += Math.hypot(sm[k + 1][0] - sm[k][0], sm[k + 1][1] - sm[k][1]);
  // RADIUS FROM THE UNSMOOTHED POINT. `out[k]` still sits on the thinned ridge,
  // where the inscribed disc is maximal; `sm[k]` has been pulled off it, and
  // reading the distance field there systematically under-reports the brush.
  return {
    x: sm.map((p) => +p[0].toFixed(2)),
    y: sm.map((p) => +p[1].toFixed(2)),
    r: out.map((p) => +radiusAt(p[0], p[1]).toFixed(2)),
    len: +len.toFixed(2),
  };
}

let SPINE = resample(spinePx, SPINE_N);
let HOOK = resample(hookPx, Math.max(2, Math.round((SPINE_N * hookPx.length) / spinePx.length)));

/** Reverse a stroke in place-ish. */
const flip = (s) => ({ ...s, x: [...s.x].reverse(), y: [...s.y].reverse(), r: [...s.r].reverse() });

// DRAWING ORDER, NOT WALK ORDER. Dijkstra hands back whichever tip it started
// from; a pen starts at the top. Orient both strokes downward-ish so the mark
// builds the way a hand would build it rather than the way a search did.
if (SPINE.y[0] > SPINE.y.at(-1)) SPINE = flip(SPINE);
if (HOOK.y[0] > HOOK.y.at(-1)) HOOK = flip(HOOK);

/**
 * Push both ends of a stroke PAST the mark, along its own end tangent.
 *
 * The reveal front is a flat cross-section at the pen (see ribbonQuads — a
 * round cap would run a whole brush radius, up to 4 px, ahead of the line). A
 * flat front cannot cover a rounded tip, so at head=1 the mark's two extremities
 * would stay bare for ever. Extending the spine past them by a brush radius
 * plus the margin lets the flat front sweep clean off the end, and costs
 * nothing on the way in: the extension is outside the artwork, where the mask
 * is clipped anyway.
 */
const EXT_STEPS = 3;
function extend(s, steps = EXT_STEPS) {
  const ext = (endIdx, prevIdx) => {
    const dx = s.x[endIdx] - s.x[prevIdx];
    const dy = s.y[endIdx] - s.y[prevIdx];
    const l = Math.hypot(dx, dy) || 1;
    const reach = s.r[endIdx] + COVER_MARGIN;
    const out = [];
    for (let k = 1; k <= steps; k++) {
      const t = (reach * k) / steps;
      out.push([
        +(s.x[endIdx] + (dx / l) * t).toFixed(2),
        +(s.y[endIdx] + (dy / l) * t).toFixed(2),
        s.r[endIdx],
      ]);
    }
    return out;
  };
  const head = ext(0, 1).reverse();
  const tail = ext(s.x.length - 1, s.x.length - 2);
  return {
    x: [...head.map((p) => p[0]), ...s.x, ...tail.map((p) => p[0])],
    y: [...head.map((p) => p[1]), ...s.y, ...tail.map((p) => p[1])],
    r: [...head.map((p) => p[2]), ...s.r, ...tail.map((p) => p[2])],
    len: s.len,
  };
}
SPINE = extend(SPINE);
HOOK = extend(HOOK);

const dotPoly = flatten(dotSeg, 48);
const dbb = bboxOf([dotPoly]);
const DOT = {
  cx: +((dbb.minx + dbb.maxx) / 2).toFixed(2),
  cy: +((dbb.miny + dbb.maxy) / 2).toFixed(2),
  r: +((dbb.maxx - dbb.minx + dbb.maxy - dbb.miny) / 4).toFixed(2),
};

// ── coverage · the property the whole approach stands on ──────────────────
// At full draw the reveal mask must cover EVERY pixel of the artwork, or the
// logo sits permanently clipped in the header. The union of maximal inscribed
// discs is the shape exactly — in the continuum. Here the spine is sampled at
// SPINE_N and then smoothed off the true ridge, so the discs sit slightly
// inside and the boundary can go bare. This measures how bare, and how much
// inflation closes it.
// RASTERISE WHAT THE BROWSER WILL. This used to union discs, which is the
// medial-axis ideal and not the thing that ships: the runtime paints the quad
// ribbon from `ribbonQuads`, whose segment edges are chords across each bend
// rather than arcs. Proving the discs cover the mark proves nothing about the
// reveal. Same function, same margin, same head=1 as the finished draw.
function coverage(inflate, add = 0) {
  const seen = new Uint8Array(RES * RES);
  for (const stroke of [SPINE, HOOK]) {
    const scaled = { ...stroke, r: stroke.r.map((v) => v * inflate) };
    for (const q of ribbonQuads(scaled, 1, add)) {
      const pts = [];
      for (let i = 0; i < 8; i += 2) pts.push([(q[i] / VIEW) * RES, (q[i + 1] / VIEW) * RES]);
      const ys = pts.map((p) => p[1]);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const y1 = Math.min(RES - 1, Math.ceil(Math.max(...ys)));
      for (let y = y0; y <= y1; y++) {
        const yc = y + 0.5;
        const xs = [];
        for (let i = 0; i < 4; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[(i + 1) % 4];
          if (ay === by) continue;
          if (yc < Math.min(ay, by) || yc >= Math.max(ay, by)) continue;
          xs.push(ax + ((bx - ax) * (yc - ay)) / (by - ay));
        }
        if (xs.length < 2) continue;
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const a = Math.max(0, Math.ceil(xs[i] - 0.5));
          const b = Math.min(RES - 1, Math.floor(xs[i + 1] - 0.5));
          for (let x = a; x <= b; x++) seen[key(x, y)] = 1;
        }
      }
    }
  }
  let total = 0;
  let miss = 0;
  for (let i = 0; i < RES * RES; i++) {
    if (!mask[i]) continue;
    total++;
    if (!seen[i]) miss++;
  }
  return { pct: (100 * (total - miss)) / total, miss, total, seen };
}

if (process.env.BARE) {
  const { seen } = coverage(1, Number(process.env.BARE));
  const png = new PNG({ width: RES, height: RES });
  for (let i = 0; i < RES * RES; i++) {
    const j = i * 4;
    const inside = mask[i];
    const bare = inside && !seen[i];
    png.data[j] = bare ? 255 : inside ? 0 : 6;
    png.data[j + 1] = bare ? 40 : inside ? 90 : 8;
    png.data[j + 2] = bare ? 40 : inside ? 105 : 10;
    png.data[j + 3] = 255;
  }
  fs.writeFileSync(path.join(QA, "spine-bare.png"), PNG.sync.write(png));
  console.log(`bare map      ${path.relative(ROOT, path.join(QA, "spine-bare.png"))}`);
}

const shipped = coverage(1, COVER_MARGIN);
if (shipped.miss > 0) {
  throw new Error(
    `mark-spine: COVER_MARGIN=${COVER_MARGIN} leaves ${shipped.miss} px of the mark ` +
      `unreachable (${shipped.pct.toFixed(3)}% covered). The reveal would clip the logo ` +
      `permanently — raise the margin, or raise SPINE_N, and look at spine-bare.png.`,
  );
}

// ── QA sheets ─────────────────────────────────────────────────────────────
fs.mkdirSync(QA, { recursive: true });
{
  const png = new PNG({ width: RES, height: RES });
  const paint = (i, r, g, b) => {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  };
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) {
      const i = (y * RES + x) * 4;
      const inside = mask[key(x, y)];
      paint(i, inside ? 0 : 6, inside ? 110 : 8, inside ? 125 : 10);
    }
  const dab = (vx, vy, r, g, b) => {
    const px = Math.round((vx / VIEW) * RES);
    const py = Math.round((vy / VIEW) * RES);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || y < 0 || x >= RES || y >= RES) continue;
        paint((y * RES + x) * 4, r, g, b);
      }
  };
  // the reconstructed ribbon, so coverage is visible, then the spine on top
  for (let k = 0; k < SPINE.x.length; k++) {
    const steps = Math.max(8, Math.round(SPINE.r[k] / 2));
    for (let a = 0; a < steps; a++) {
      const th = (a / steps) * Math.PI * 2;
      dab(SPINE.x[k] + Math.cos(th) * SPINE.r[k], SPINE.y[k] + Math.sin(th) * SPINE.r[k], 255, 190, 40);
    }
  }
  SPINE.x.forEach((_, k) => dab(SPINE.x[k], SPINE.y[k], 255, 60, 60));
  HOOK.x.forEach((_, k) => dab(HOOK.x[k], HOOK.y[k], 90, 255, 120));
  fs.writeFileSync(path.join(QA, "spine-walk.png"), PNG.sync.write(png));
}

// ── emit ──────────────────────────────────────────────────────────────────
const arr = (a) => `[${a.join(",")}]`;
const src = `/**
 * THE MARK'S SPINE — GENERATED by scripts/tools/generate-mark-spine.mjs.
 * DO NOT hand-edit; re-run the script.
 *
 * The medial axis of public/brand/zirtuno-logo-mark.svg with the brush radius
 * at every sample: the path the mark was DRAWN along, as opposed to MARK_D,
 * which is where that stroke's edge ended up. Same frame as
 * intro-trace.data.mjs — square ${VIEW}x${VIEW}, artwork at ${FIT} of the side —
 * so a spine sample and a MARK_D coordinate mean the same thing.
 *
 * \`r\` is the exact inside distance, so a disc of radius r[k] at (x[k], y[k])
 * is inscribed in the mark and touches its edge. Reconstructing the ribbon from
 * these three arrays reproduces the fill; that is what makes them usable as a
 * reveal mask over the canonical artwork rather than a redrawing of it.
 */

/** Design box, shared with INTRO_VIEW. */
export const SPINE_VIEW = ${VIEW};

/** Add this to every \`r\` before using the strokes as a reveal mask.
 *  Without it the reveal leaves a bare rim around the whole mark; with it the
 *  generator measures ${shipped.pct.toFixed(3)}% of the artwork reachable
 *  (0 bare px at ${RES}x${RES}). See COVER_MARGIN in the generator for why the
 *  correction is additive and not a scale. */
export const SPINE_MARGIN = ${COVER_MARGIN};

/** The long stroke: the mark's longest tip-to-tip geodesic. */
export const SPINE = {
  n: ${SPINE.x.length},
  len: ${SPINE.len},
  ext: ${EXT_STEPS},
  x: ${arr(SPINE.x)},
  y: ${arr(SPINE.y)},
  r: ${arr(SPINE.r)},
};

/** The short stroke: the third tip, from its join with SPINE outward. */
export const HOOK = {
  n: ${HOOK.x.length},
  len: ${HOOK.len},
  ext: ${EXT_STEPS},
  x: ${arr(HOOK.x)},
  y: ${arr(HOOK.y)},
  r: ${arr(HOOK.r)},
};

/** The counter-dot, which no stroke passes through. */
export const SPINE_DOT = ${JSON.stringify(DOT)};
`;
fs.writeFileSync(OUT, src);

const stats = (a) => `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}`;
console.log(`raster        ${RES}x${RES}`);
console.log(`skeleton      ${skelPx.length} px · ${tips.length} tips`);
console.log(`spine         ${SPINE.x.length} samples · ${SPINE.len} units · radius ${stats(SPINE.r)}`);
console.log(`hook          ${HOOK.x.length} samples · ${HOOK.len} units · radius ${stats(HOOK.r)}`);
console.log("coverage      inflate  covered   bare px");
for (const f of [1.0, 1.08, 1.25, 1.5]) {
  const c = coverage(f);
  console.log(`              x${f.toFixed(2)}    ${c.pct.toFixed(3)}%   ${c.miss}`);
}
console.log("coverage      margin   covered   bare px   (1 unit = 0.037 px at a 29px mark)");
for (const a of [4, 8, 12, 16, 22, 30]) {
  const c = coverage(1, a);
  console.log(`              +${String(a).padStart(2)}      ${c.pct.toFixed(3)}%   ${c.miss}`);
}
console.log(`shipped       margin +${COVER_MARGIN} -> ${shipped.pct.toFixed(3)}% covered, ${shipped.miss} bare px`);
console.log(`dot           (${DOT.cx}, ${DOT.cy}) r=${DOT.r}`);
console.log(`emitted       ${path.relative(ROOT, OUT)}`);
console.log(`QA            ${path.relative(ROOT, path.join(QA, "spine-walk.png"))}`);
