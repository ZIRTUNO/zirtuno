/**
 * Rebuilding the mark's ribbon from its spine — the geometry the reveal uses.
 *
 * Shared by the runtime (components/chrome/BrandDraw.tsx, every frame of a
 * draw) and by the generator (scripts/generate-mark-spine.mjs, which rasterises
 * exactly this to prove the finished reveal covers 100% of the artwork). Two
 * implementations of the same swept ribbon would let the proof drift away from
 * the thing it claims to prove, which is the one bug this file exists to make
 * impossible — the same reason `easings.mjs` is node-runnable.
 *
 * ── quads, not one polygon ─────────────────────────────────────────────────
 * The tidy build is a single closed polygon: the left offsets out, the right
 * offsets back. It is also wrong here. The brush radius runs 8.7 -> 112.4 over
 * this spine, so on the tight bends the INNER offset crosses itself, and a
 * self-intersecting ring hands `fill-rule` a reversed loop that can cancel its
 * own winding and punch a hole in the middle of the mark. One quad per segment,
 * all wound the same way, unions under `nonzero` with nothing to cancel.
 *
 * ── the window ─────────────────────────────────────────────────────────────
 * Everything here works on a [tail, head] window rather than a length, because
 * that is what GSAP's `drawSVG: "a% b%"` expresses and this geometry has to be
 * able to say the same things: a head laying the mark down, and a tail chasing
 * it back off again.
 */

/** Unit normal at sample i, from a central difference along the spine. */
function normalAt(s, i) {
  const a = Math.max(0, i - 1);
  const b = Math.min(s.x.length - 1, i + 1);
  const tx = s.x[b] - s.x[a];
  const ty = s.y[b] - s.y[a];
  const l = Math.hypot(tx, ty) || 1;
  return [-ty / l, tx / l];
}

/** Position, unit normal and radius at a fractional sample index. */
function at(s, t, margin) {
  const n = s.x.length;
  const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
  const u = t - i;
  const j = i + 1;
  const [ax, ay] = normalAt(s, i);
  const [bx, by] = normalAt(s, j);
  let nx = ax + (bx - ax) * u;
  let ny = ay + (by - ay) * u;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  return {
    x: s.x[i] + (s.x[j] - s.x[i]) * u,
    y: s.y[i] + (s.y[j] - s.y[i]) * u,
    nx,
    ny,
    r: s.r[i] + (s.r[j] - s.r[i]) * u + margin,
  };
}

/**
 * The ribbon between `tail` and `head` (each 0..1 of the stroke's sample span),
 * as quads [x0,y0, x1,y1, x2,y2, x3,y3].
 *
 * Both ends are flat cross-sections — perpendicular, no cap beyond them. That
 * is deliberate: a round cap would put the reveal front a whole brush radius
 * ahead of the pen (up to 112 units, 4 px at a header mark), so the form would
 * keep appearing before the line reached it. The generator instead extends the
 * spine past both tips of the mark, so a flat front still sweeps clean off the
 * end at head = 1.
 */
export function ribbonQuads(s, head, margin = 0, tail = 0) {
  const n = s.x.length;
  if (n < 2) return [];
  const span = n - 1;
  const t0 = Math.max(0, Math.min(1, tail)) * span;
  const t1 = Math.max(0, Math.min(1, head)) * span;
  if (t1 - t0 <= 1e-6) return [];

  const quads = [];
  const first = Math.floor(t0);
  const last = Math.min(span - 1, Math.ceil(t1) - 1);
  for (let i = first; i <= last; i++) {
    const a = Math.max(t0, i);
    const b = Math.min(t1, i + 1);
    if (b - a <= 1e-6) continue;
    const p = at(s, a, margin);
    const q = at(s, b, margin);
    quads.push([
      p.x + p.nx * p.r, p.y + p.ny * p.r,
      q.x + q.nx * q.r, q.y + q.ny * q.r,
      q.x - q.nx * q.r, q.y - q.ny * q.r,
      p.x - p.nx * p.r, p.y - p.ny * p.r,
    ]);
  }
  return quads;
}

/** Quads → one `d`. Rounded to 0.1 unit: the mark renders at ~29 px for 780
 *  units, so a tenth of a unit is a 270th of a pixel, and the string is the
 *  thing being rebuilt every frame. */
export function quadsToPath(quads) {
  let d = "";
  for (const q of quads) {
    d += `M${q[0].toFixed(1)} ${q[1].toFixed(1)}L${q[2].toFixed(1)} ${q[3].toFixed(1)}L${q[4].toFixed(1)} ${q[5].toFixed(1)}L${q[6].toFixed(1)} ${q[7].toFixed(1)}Z`;
  }
  return d;
}

/** The spine itself between `from` and `head`, as a polyline `d` — what the
 *  visible pen draws. A polyline is enough: 128 samples over 1600 units is
 *  12 units a step, under half a pixel at any size this mark is used. */
export function spinePath(s, head = 1, from = 0) {
  const n = s.x.length;
  if (n < 2) return "";
  const span = n - 1;
  const t0 = Math.max(0, Math.min(1, from)) * span;
  const t1 = Math.max(0, Math.min(1, head)) * span;
  if (t1 - t0 <= 1e-6) return "";
  const p = at(s, t0, 0);
  let d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  for (let i = Math.ceil(t0); i <= Math.floor(t1); i++) {
    d += `L${s.x[i].toFixed(1)} ${s.y[i].toFixed(1)}`;
  }
  const q = at(s, t1, 0);
  return d + `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}

/**
 * Split one overall progress across several strokes by ARC LENGTH, so the pen
 * keeps a constant speed across a lift instead of spending equal time on a
 * 1597-unit stroke and a 243-unit one.
 *
 * Returns a head per stroke: 1 for strokes already finished, 0 for ones not
 * started, the partial value for the one in hand.
 */
export function shareByLength(strokes, progress) {
  const total = strokes.reduce((a, s) => a + s.len, 0) || 1;
  let seen = 0;
  return strokes.map((s) => {
    const from = seen / total;
    const to = (seen + s.len) / total;
    seen += s.len;
    if (progress <= from) return 0;
    if (progress >= to) return 1;
    return (progress - from) / (to - from);
  });
}
