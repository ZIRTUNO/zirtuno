// Generate the ENTRY-INTRO geometry from the canonical mark
// (public/brand/zirtuno-logo-mark.svg) — the data the S1.10 intro draws,
// floods, breathes and drains.
//
//   node scripts/generate-intro-trace.mjs
//
// Writes lib/animation/intro-trace.data.mjs. DO NOT hand-edit that file.
//
// Why a generator and not a hand-authored path: the mark is the OWNER-TRACED
// form and AGENTS.md §4.3 makes it sacred. Everything the intro draws is
// derived from that one file by exact affine transform (the source uses only
// absolute M/C/z, so baking `translate(-1050,-850)` and a uniform fit is
// lossless), or by measurement of its rasterised distance field. Re-run this
// whenever the mark changes; never re-draw it by hand.
//
// What comes out:
//   MARK_D / DOT_D  the two subforms, transformed into a square INTRO_VIEW.
//   RING            the contour resampled at UNIFORM ARC LENGTH, with an
//                   outward normal per vertex taken from the distance-field
//                   gradient (see §normals) — the rest ring the vector-liquid
//                   kernel deforms.
//   TRACE           where the trace is seeded and where its two heads meet.
//   TIPS            the handful of high-curvature points droplets may leave.
//
// §normals — why the gradient and not the polygon
// The mark's fill has TWO holes, which a simple closed curve cannot produce
// under the nonzero rule; the contour therefore crosses itself. "Outward" is
// consequently NOT a function of winding order, and the usual rotate-the-
// tangent trick silently flips sign somewhere in the middle of the ribbon. The
// exact Euclidean distance transform has no such ambiguity: inside the fill,
// −∇d points at the nearest edge, so it IS the outward normal, everywhere,
// self-intersection or not. Same EDT the rest forms are built on
// (lib/webgl/sdf-core.mjs) — one definition of "the edge of the mark".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { edt2d } from "../lib/webgl/sdf-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public", "brand", "zirtuno-logo-mark.svg");
const OUT = path.join(ROOT, "lib", "animation", "intro-trace.data.mjs");
const QA = path.join(ROOT, "captures", "intro");

/** Normalised design box the intro's SVG uses. Square, so the stage can be
 *  laid out with one number on every viewport. */
const VIEW = 1000;
/** Fraction of VIEW the artwork's longest side occupies. The rest is the
 *  breathing room droplets and the flood front need to stay inside the
 *  viewBox — an overflowing droplet is clipped, not clever. */
const FIT = 0.78;
/** Ring resolution. 220 vertices over a ~5700-unit contour is ~26 units of
 *  arc apart; the Catmull-Rom the kernel emits then deviates from the true
 *  cubic by under 0.1% of VIEW (~0.4 px at a 520 px stage), so swapping the
 *  exact `d` for the ring's `d` is invisible rather than a pop. */
const RING_N = 220;
/** Raster used to measure the distance field. */
const RES = 1024;

// ── path parsing (absolute M/C/z only — asserted, not assumed) ──────────────

/** [{ c: "M"|"C", p: [x,y,...] }] */
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
      throw new Error(
        `intro-trace: the mark must use only absolute M/C/z — found "${c}". ` +
          `Re-export it flattened, or teach this generator the new command.`,
      );
    }
    const n = c === "M" ? 2 : 6;
    const p = [];
    for (let k = 0; k < n; k++) p.push(Number(tok[i++]));
    out.push({ c, p });
    // a repeated coordinate run after M/C implies an implicit L/C
    while (i < tok.length && /^[-\d.]/.test(tok[i])) {
      const q = [];
      for (let k = 0; k < 6 && i < tok.length; k++) q.push(Number(tok[i++]));
      if (q.length === 6) out.push({ c: "C", p: q });
    }
  }
  return out;
}

const mapSeg = (seg, f) =>
  seg.map(({ c, p }) => {
    if (c === "Z") return { c, p };
    const q = [];
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = f(p[i], p[i + 1]);
      q.push(x, y);
    }
    return { c, p: q };
  });

const r2 = (v) => {
  const n = Math.round(v * 100) / 100;
  return Object.is(n, -0) ? 0 : n;
};

const toD = (seg) =>
  seg
    .map(({ c, p }) =>
      c === "Z" ? "Z" : c + p.map(r2).join(" ").replace(/ -/g, "-"),
    )
    .join("");

// ── exact cubic bbox (derivative roots, not sampling) ───────────────────────

function cubicBounds(p0, p1, p2, p3) {
  let lo = Math.min(p0, p3);
  let hi = Math.max(p0, p3);
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const push = (t) => {
    if (t <= 0 || t >= 1) return;
    const mt = 1 - t;
    const v =
      mt * mt * mt * p0 +
      3 * mt * mt * t * p1 +
      3 * mt * t * t * p2 +
      t * t * t * p3;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  };
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      push((-b + s) / (2 * a));
      push((-b - s) / (2 * a));
    }
  }
  return [lo, hi];
}

function bboxOf(segs) {
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  const grow = (x, y) => {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  };
  for (const seg of segs) {
    let cx = 0,
      cy = 0,
      sx = 0,
      sy = 0;
    for (const { c, p } of seg) {
      if (c === "M") {
        [cx, cy] = p;
        sx = cx;
        sy = cy;
        grow(cx, cy);
      } else if (c === "C") {
        const [bx0, bx1] = cubicBounds(cx, p[0], p[2], p[4]);
        const [by0, by1] = cubicBounds(cy, p[1], p[3], p[5]);
        grow(bx0, by0);
        grow(bx1, by1);
        cx = p[4];
        cy = p[5];
      } else {
        cx = sx;
        cy = sy;
      }
    }
  }
  return { minx, miny, maxx, maxy };
}

// ── flatten to a dense polyline (for arc-length work) ───────────────────────

function flatten(seg, perCurve = 48) {
  const pts = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0;
  for (const { c, p } of seg) {
    if (c === "M") {
      [cx, cy] = p;
      sx = cx;
      sy = cy;
      pts.push([cx, cy]);
    } else if (c === "C") {
      for (let k = 1; k <= perCurve; k++) {
        const t = k / perCurve;
        const mt = 1 - t;
        const x =
          mt * mt * mt * cx +
          3 * mt * mt * t * p[0] +
          3 * mt * t * t * p[2] +
          t * t * t * p[4];
        const y =
          mt * mt * mt * cy +
          3 * mt * mt * t * p[1] +
          3 * mt * t * t * p[3] +
          t * t * t * p[5];
        pts.push([x, y]);
      }
      cx = p[4];
      cy = p[5];
    } else {
      if (cx !== sx || cy !== sy) pts.push([sx, sy]);
      cx = sx;
      cy = sy;
    }
  }
  return pts;
}

// ═══ run ════════════════════════════════════════════════════════════════════

const svg = fs.readFileSync(SRC, "utf8");
const ds = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
if (ds.length !== 2) {
  throw new Error(`intro-trace: expected 2 paths in the mark, found ${ds.length}`);
}
const gm = svg.match(/transform="translate\((-?[\d.]+)[ ,]+(-?[\d.]+)\)"/);
const [gx, gy] = gm ? [Number(gm[1]), Number(gm[2])] : [0, 0];

// 1. bake the group transform
let markSeg = mapSeg(parsePath(ds[0]), (x, y) => [x + gx, y + gy]);
let dotSeg = mapSeg(parsePath(ds[1]), (x, y) => [x + gx, y + gy]);

// 2. fit both into the square VIEW, together, preserving aspect
const bb = bboxOf([markSeg, dotSeg]);
const bw = bb.maxx - bb.minx;
const bh = bb.maxy - bb.miny;
const S = (VIEW * FIT) / Math.max(bw, bh);
const ox = VIEW / 2 - (bb.minx + bw / 2) * S;
const oy = VIEW / 2 - (bb.miny + bh / 2) * S;
const fit = (x, y) => [x * S + ox, y * S + oy];
markSeg = mapSeg(markSeg, fit);
dotSeg = mapSeg(dotSeg, fit);

const MARK_D = toD(markSeg);
const DOT_D = toD(dotSeg);

// the dot as a circle — the intro drops it as a droplet, not as a path
const dotBB = bboxOf([dotSeg]);
const DOT = {
  cx: r2((dotBB.minx + dotBB.maxx) / 2),
  cy: r2((dotBB.miny + dotBB.maxy) / 2),
  r: r2((dotBB.maxx - dotBB.minx + dotBB.maxy - dotBB.miny) / 4),
};

// 3. arc-length resample the contour
const poly = flatten(markSeg, 64);
const segLen = [];
let L = 0;
for (let i = 0; i < poly.length; i++) {
  const j = (i + 1) % poly.length;
  const l = Math.hypot(poly[j][0] - poly[i][0], poly[j][1] - poly[i][1]);
  segLen.push(l);
  L += l;
}
const ring = [];
{
  const step = L / RING_N;
  let i = 0;
  let carry = 0;
  for (let k = 0; k < RING_N; k++) {
    let want = step;
    if (k === 0) {
      ring.push([poly[0][0], poly[0][1]]);
      continue;
    }
    while (want > segLen[i] - carry) {
      want -= segLen[i] - carry;
      carry = 0;
      i = (i + 1) % poly.length;
    }
    carry += want;
    const j = (i + 1) % poly.length;
    const u = segLen[i] > 1e-9 ? carry / segLen[i] : 0;
    ring.push([
      poly[i][0] + (poly[j][0] - poly[i][0]) * u,
      poly[i][1] + (poly[j][1] - poly[i][1]) * u,
    ]);
  }
}

// 4. outward normals from the distance-field gradient (§normals)
//    rasterise the mark at RES, EDT the background → d(x) inside the fill.
const mask = new Uint8Array(RES * RES);
{
  // scanline fill of the flattened contour, nonzero winding — the SVG default
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
const bgSeed = new Uint8Array(RES * RES);
for (let i = 0; i < RES * RES; i++) bgSeed[i] = mask[i] ? 0 : 1;
const d2 = edt2d(bgSeed, RES, RES);
const dist = new Float64Array(RES * RES);
for (let i = 0; i < RES * RES; i++) dist[i] = Math.sqrt(d2[i]);

const sampleDist = (x, y) => {
  const gx0 = Math.max(1, Math.min(RES - 2, Math.round((x / VIEW) * RES)));
  const gy0 = Math.max(1, Math.min(RES - 2, Math.round((y / VIEW) * RES)));
  return dist[gy0 * RES + gx0];
};
const gradAt = (x, y) => {
  const h = (VIEW / RES) * 1.5;
  return [
    sampleDist(x + h, y) - sampleDist(x - h, y),
    sampleDist(x, y + h) - sampleDist(x, y - h),
  ];
};

const RX = [],
  RY = [],
  RNX = [],
  RNY = [];
for (let i = 0; i < RING_N; i++) {
  const [x, y] = ring[i];
  // step a little INSIDE first: on the contour itself the field is ~0 and its
  // gradient is numerically useless. One ring-step in along the tangent normal
  // lands in real signal.
  const a = ring[(i - 1 + RING_N) % RING_N];
  const b = ring[(i + 1) % RING_N];
  let tx = b[0] - a[0];
  let ty = b[1] - a[1];
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;
  // the two candidate normals
  const cand = [
    [ty, -tx],
    [-ty, tx],
  ];
  const probe = (VIEW / RES) * 4;
  const din = cand.map(([nx, ny]) => sampleDist(x - nx * probe, y - ny * probe));
  // outward = the side whose INWARD probe sits deeper in the fill
  const pick = din[0] >= din[1] ? 0 : 1;
  let [nx, ny] = cand[pick];
  // refine with the gradient where it is strong
  const [gxv, gyv] = gradAt(x - nx * probe * 2, y - ny * probe * 2);
  const gl = Math.hypot(gxv, gyv);
  if (gl > 1e-3) {
    const ex = -gxv / gl;
    const ey = -gyv / gl;
    if (ex * nx + ey * ny > 0.2) {
      nx = ex;
      ny = ey;
    }
  }
  RX.push(r2(x));
  RY.push(r2(y));
  RNX.push(Math.round(nx * 1000) / 1000);
  RNY.push(Math.round(ny * 1000) / 1000);
}

// 5. the trace seed and its arc-length antipode
// On a ribbon outline, the antipode of one terminal tip IS the other terminal
// tip — going out along one bank and back along the other is the same length
// twice. So the two heads, launched from one tip at equal speed, meet at the
// far tip by construction. Pick the antipodal pair that are furthest apart in
// SPACE: those are the terminals.
let seed = 0;
let best = -1;
const half = RING_N >> 1;
for (let i = 0; i < RING_N; i++) {
  const j = (i + half) % RING_N;
  const dd = Math.hypot(RX[i] - RX[j], RY[i] - RY[j]);
  if (dd > best) {
    best = dd;
    seed = i;
  }
}
const meet = (seed + half) % RING_N;

// ── rotate the ring so the MEET is vertex 0 ─────────────────────────────────
// DrawSVG works on dash offsets along [0, L]; it cannot wrap a closed path's
// seam. Two heads spreading from a seed at fraction f therefore always finish
// at 0% and 100% — the seam — and only arrive TOGETHER if f is exactly 50%.
// Putting the seam on the meeting point makes that true by construction: the
// seed lands at vertex n/2, the tween runs "50% 50%" → "0% 100%", and the two
// lines close on the far terminal instead of wherever the exporter happened to
// start the path. Everything downstream — the kernel's ring, the rest path it
// emits, the droplet tips — is rotated with it so one index means one thing.
{
  const rot = (a) => a.slice(meet).concat(a.slice(0, meet));
  for (const a of [RX, RY, RNX, RNY]) {
    const r = rot(a);
    a.length = 0;
    a.push(...r);
  }
  const r = rot(ring);
  ring.length = 0;
  ring.push(...r);
}
const seedR = (seed - meet + RING_N) % RING_N; // === half, by construction
const meetR = 0;
const TRACE = {
  /** Ring index of the seed — where the droplet strikes and the trace starts.
   *  Exactly n/2 after the rotation above, which is what makes the DrawSVG
   *  tween "50% 50%" → "0% 100%" land both heads on the meet together. */
  seed: seedR,
  seedT: 0.5,
  seedX: RX[seedR],
  seedY: RY[seedR],
  /** Where the two heads meet — vertex 0, the path's seam, the flood's origin. */
  meet: meetR,
  meetT: 0,
  meetX: RX[meetR],
  meetY: RY[meetR],
  /** Contour length in VIEW units — the intro paces the trace off this. */
  len: Math.round(L * 100) / 100,
  /** The two terminals, apart, in VIEW units. */
  span: Math.round(best * 100) / 100,
};

// 5b. the PACE of each head — a hand slows into a curve
//
// A constant-speed head reads as a plotter. A hand carrying a line spends more
// time where the form turns, so the line arrives with weight in the curls and
// runs through the straights. Rather than hand-tune an ease until it "feels
// drawn", derive it from the mark: give every vertex an EFFORT cost of
// (1 + PACE_K·|turn|), accumulate it along each head's half of the contour,
// and invert. Uniform time then spends uniform effort, which puts the head's
// speed inversely proportional to how hard the contour is turning — and the
// two halves get genuinely different curves, because the mark's two lobes are
// genuinely different shapes.
//
// Emitted as CustomEase path strings so the runtime does no work: GSAP reads
// them straight into gsap.to({ ease }).
const PACE_K = 2.6;
const paceEase = (dir) => {
  const steps = half;
  const cost = new Float64Array(steps + 1);
  let total = 0;
  for (let j = 0; j <= steps; j++) {
    // the vertex this head is on after j steps out from the seed
    const idx = (seedR + dir * j + RING_N * 2) % RING_N;
    const a = ring[(idx - 2 + RING_N) % RING_N];
    const b = ring[idx];
    const c = ring[(idx + 2) % RING_N];
    const v1x = b[0] - a[0],
      v1y = b[1] - a[1];
    const v2x = c[0] - b[0],
      v2y = c[1] - b[1];
    const turn = Math.abs(
      Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y),
    );
    total += 1 + PACE_K * turn;
    cost[j] = total;
  }
  for (let j = 0; j <= steps; j++) cost[j] /= total;

  // invert: at uniform time t, how far along the half are we?
  const N = 40;
  const pts = [[0, 0]];
  let j = 0;
  for (let s = 1; s <= N; s++) {
    const t = s / N;
    while (j < steps && cost[j] < t) j++;
    pts.push([t, Math.min(1, j / steps)]);
  }
  pts[pts.length - 1] = [1, 1];

  // Catmull-Rom → cubic, clamped ends: a CustomEase built from L segments has
  // piecewise-constant velocity, which is a stutter, not a pace.
  let d = `M0,0`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const f = (v) => Math.round(v * 10000) / 10000;
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
};
TRACE.easeA = paceEase(-1); // the head that runs back toward the seam
TRACE.easeB = paceEase(+1); // the head that runs forward to it
TRACE.paceK = PACE_K;

// 6. droplet launch points: the sharpest OUTWARD turns, spaced apart
const curv = new Float64Array(RING_N);
for (let i = 0; i < RING_N; i++) {
  const a = ring[(i - 2 + RING_N) % RING_N];
  const b = ring[i];
  const c = ring[(i + 2) % RING_N];
  const v1x = b[0] - a[0],
    v1y = b[1] - a[1];
  const v2x = c[0] - b[0],
    v2y = c[1] - b[1];
  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  curv[i] = Math.abs(Math.atan2(cross, dot));
}
const TIPS = [];
{
  // A tip on a HOLE's boundary is still a sharp outward turn, and its normal is
  // still correct — it points into the counter. A droplet launched there flies
  // into an enclosed pocket of black and reads as a rendering artefact rather
  // than as surface tension letting go. The mark has two such counters, and the
  // first cut of this list put a droplet in one of them.
  //
  // Two tests, and a tip has to pass BOTH — for a decorative droplet, losing a
  // launch point costs nothing and putting one in a counter costs the shot.
  //
  //  MARCH: step along the outward normal and see whether the fill comes back.
  //  Outside the mark it never does; inside a counter it does, at the far wall.
  //  REACH has to exceed the widest counter measured ALONG ITS NORMAL, which is
  //  not the same as its narrow width: the upper counter is a tongue, and the
  //  tip at its closed end points down the long axis. At 170 that tip's march
  //  fell ~20 units short of the far wall and the droplet shipped inside the
  //  hole. 260 clears the form's largest void with margin.
  //
  //  FACING: the normal must point away from the mark's centroid. A counter's
  //  boundary faces inward by definition. Measured on this mark, outer tips run
  //  +0.41…+0.93 and counter tips −0.55/−0.98, so the two populations are not
  //  close — but the march is what makes the rule exact, and this is what makes
  //  it robust if the mark is ever re-cut.
  const HOLE_REACH = 260;
  let ccx = 0;
  let ccy = 0;
  for (let i = 0; i < RING_N; i++) {
    ccx += RX[i];
    ccy += RY[i];
  }
  ccx /= RING_N;
  ccy /= RING_N;
  const facesOut = (i) => {
    const vx = RX[i] - ccx;
    const vy = RY[i] - ccy;
    const L = Math.hypot(vx, vy) || 1;
    return (RNX[i] * vx + RNY[i] * vy) / L > 0;
  };
  const insideAt = (x, y) => {
    const gx = Math.round((x / VIEW) * RES);
    const gy = Math.round((y / VIEW) * RES);
    if (gx < 0 || gy < 0 || gx >= RES || gy >= RES) return 0;
    return mask[gy * RES + gx];
  };
  const onOuterBoundary = (i) => {
    for (let d = 8; d <= HOLE_REACH; d += 4) {
      if (insideAt(RX[i] + RNX[i] * d, RY[i] + RNY[i] * d)) return false;
    }
    return true;
  };

  const order = [...curv.keys()].sort((a, b) => curv[b] - curv[a]);
  const MIN_SEP = RING_N * 0.09;
  let rejected = 0;
  for (const i of order) {
    if (TIPS.length >= 6) break;
    if (
      TIPS.some((t) => {
        const d = Math.abs(t.i - i);
        return Math.min(d, RING_N - d) < MIN_SEP;
      })
    )
      continue;
    if (!onOuterBoundary(i) || !facesOut(i)) {
      rejected++;
      continue;
    }
    TIPS.push({ i, x: RX[i], y: RY[i], nx: RNX[i], ny: RNY[i] });
  }
  TIPS.sort((a, b) => a.i - b.i);
  console.log(`  rejected ${rejected} tip(s) on counter boundaries`);
  // The intro launches three. Fewer than that and the sequence has quietly lost
  // a beat, which is the kind of thing a generator should refuse to ship.
  if (TIPS.length < 3) {
    throw new Error(
      `intro-trace: only ${TIPS.length} outer droplet tip(s) survived; the ` +
        `intro needs 3. Loosen MIN_SEP or re-check the counter tests.`,
    );
  }
}

// ── emit ────────────────────────────────────────────────────────────────────

const arr = (a) => `[${a.join(",")}]`;
const banner = `/**
 * ENTRY-INTRO geometry — GENERATED by scripts/generate-intro-trace.mjs.
 * DO NOT hand-edit; re-run the script.
 *
 * Every number here is derived from public/brand/zirtuno-logo-mark.svg: the
 * paths by exact affine transform (the source is absolute M/C/z only, so the
 * bake is lossless), the normals by measuring its distance field. The mark
 * stays the single source of the form — see AGENTS.md §4.3.
 *
 * Frame: a square ${VIEW}x${VIEW} viewBox, artwork fitted to ${FIT} of the
 * longest side, +y DOWN (SVG convention, not the field's +y up).
 */
`;

const out = `${banner}
/** The intro's square design box. */
export const INTRO_VIEW = ${VIEW};

/** The mark's contour, exact. One closed, self-intersecting path. */
export const MARK_D =
  ${JSON.stringify(MARK_D)};

/** The mark's dot, exact — the intro drops it last. */
export const DOT_D =
  ${JSON.stringify(DOT_D)};

/** The same dot as a circle, for the droplet that becomes it. */
export const DOT = ${JSON.stringify(DOT)};

/**
 * The contour resampled at uniform arc length, with an OUTWARD normal per
 * vertex taken from the distance-field gradient. This is the rest ring the
 * vector-liquid kernel (lib/motion/membrane.mjs) deforms during the breath.
 */
export const RING = {
  n: ${RING_N},
  x: ${arr(RX)},
  y: ${arr(RY)},
  nx: ${arr(RNX)},
  ny: ${arr(RNY)},
};

/** Where the trace is seeded, and where its two heads meet. */
export const TRACE = ${JSON.stringify(TRACE, null, 2)};

/** Sharpest outward turns — the only places a droplet may leave the surface. */
export const TIPS = ${JSON.stringify(TIPS)};
`;

fs.writeFileSync(OUT, out);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`  contour length ${TRACE.len} · seed ${seedR} (=n/2) → meet ${meetR} (seam) · span ${TRACE.span}`);
console.log(`  ring ${RING_N} verts · dot r=${DOT.r} at (${DOT.cx}, ${DOT.cy})`);
console.log(`  tips at ring indices ${TIPS.map((t) => t.i).join(", ")}`);

// ── QA sheet: mask, ring, normals, seed/meet, tips ──────────────────────────
fs.mkdirSync(QA, { recursive: true });
{
  const W = 900;
  const png = new PNG({ width: W, height: W });
  const put = (x, y, r, g, b) => {
    const xi = Math.round(x),
      yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= W) return;
    const o = (yi * W + xi) * 4;
    png.data[o] = r;
    png.data[o + 1] = g;
    png.data[o + 2] = b;
    png.data[o + 3] = 255;
  };
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const mx = Math.floor((x / W) * RES);
      const my = Math.floor((y / W) * RES);
      const on = mask[my * RES + mx];
      put(x, y, on ? 0 : 8, on ? 70 : 8, on ? 82 : 10);
    }
  const toPx = (v) => (v / VIEW) * W;
  for (let i = 0; i < RING_N; i++) {
    const x = toPx(RX[i]);
    const y = toPx(RY[i]);
    // normal whisker
    for (let s = 0; s < 14; s++)
      put(x + RNX[i] * s, y + RNY[i] * s, 255, 120, 40);
    put(x, y, 255, 255, 255);
    put(x + 1, y, 255, 255, 255);
    put(x, y + 1, 255, 255, 255);
  }
  const blob = (i, r, g, b) => {
    const x = toPx(RX[i]);
    const y = toPx(RY[i]);
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if (dx * dx + dy * dy <= 25) put(x + dx, y + dy, r, g, b);
  };
  for (const t of TIPS) blob(t.i, 255, 227, 0);
  blob(seedR, 0, 227, 254);
  blob(meetR, 255, 60, 90);
  fs.writeFileSync(path.join(QA, "trace-geometry.png"), PNG.sync.write(png));
  console.log(`  QA → captures/intro/trace-geometry.png`);
  console.log(`     cyan = seed · red = meet · yellow = droplet tips · orange = outward normals`);
}
