/**
 * THE CONFLUENCE's silhouette, traced from its own field — the outline the
 * static tier draws.
 *
 * Why this exists rather than a blur-and-threshold on 48 SVG circles, which is
 * the usual way to fake metaballs in a document: the two do not produce the
 * same shape, and the difference is not subtle. The field is Sum r^2/d^2, so a
 * CHAIN of overlapping droplets lights a band of half-thickness pi r^2 / s —
 * on the confluence's arms that is 0.095 against a droplet radius of 0.033,
 * nearly three times wider than the discs themselves. An SVG goo filter merges
 * the discs and leaves them the size they were. Built that way the fallback
 * rendered the right symbol at roughly a third of its weight: recognisable, and
 * visibly not the thing the live liquid resolves into.
 *
 * So the outline is MARCHED out of the real field — the same arithmetic the
 * shader runs, including the influence window — and emitted as one path. Exact
 * by construction and impossible to drift, because there is no second
 * description of the shape to keep in sync.
 *
 * SERVER-SIDE ONLY. This is imported by components/chapters/ConfluenceMark, a
 * server component, so the grid is walked once per process and never ships to a
 * browser. confluence.mjs itself stays free of it for that reason.
 */

import { CONFLUENCE } from "./confluence.mjs";
import { SDF_BALL_REACH } from "./sdf-glass-shader.mjs";

const RES = 224; // grid cells across the cloud's [0,1] square
const BALL_CORE = 0.18; // the shader's spike cap, as a fraction of radius

/** The liquid field at (x, y) in cloud space — mirrors BALL_LOOP exactly. */
function fieldAt(x, y) {
  let T = 0;
  for (const [bx, by, br] of CONFLUENCE) {
    const dx = x - bx;
    const dy = y - by;
    const core = Math.max(br * BALL_CORE, 1e-4);
    const d2 = Math.max(dx * dx + dy * dy, core * core);
    const cut2 = (SDF_BALL_REACH * br) ** 2;
    if (d2 >= cut2) continue;
    const t = (d2 - 0.3 * cut2) / (0.7 * cut2);
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    T += ((br * br) / d2) * (1 - u * u * (3 - 2 * u));
  }
  return T;
}

/**
 * Marching squares at T = 1, linearly interpolated on each crossing, walked
 * into closed rings. One ring for this shape — it is a single solid body — but
 * the walk is written for any number so a future station table cannot quietly
 * produce a broken path.
 */
function trace() {
  const G = new Float64Array((RES + 1) * (RES + 1));
  for (let j = 0; j <= RES; j++)
    for (let i = 0; i <= RES; i++) G[j * (RES + 1) + i] = fieldAt(i / RES, j / RES);

  const at = (i, j) => G[j * (RES + 1) + i];
  // crossing point on the horizontal edge (i,j)-(i+1,j), or on the vertical one
  const cutH = (i, j) => {
    const a = at(i, j);
    const b = at(i + 1, j);
    return [(i + (1 - a) / (b - a)) / RES, j / RES];
  };
  const cutV = (i, j) => {
    const a = at(i, j);
    const b = at(i, j + 1);
    return [i / RES, (j + (1 - a) / (b - a)) / RES];
  };

  // Collect segments per cell, then chain them by endpoint. Keyed on rounded
  // coordinates: every segment endpoint is produced by the same interpolation
  // from the same pair of samples, so equal points are bit-identical.
  const segs = [];
  const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  for (let j = 0; j < RES; j++)
    for (let i = 0; i < RES; i++) {
      const c =
        (at(i, j) >= 1 ? 1 : 0) |
        (at(i + 1, j) >= 1 ? 2 : 0) |
        (at(i + 1, j + 1) >= 1 ? 4 : 0) |
        (at(i, j + 1) >= 1 ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const L = () => cutV(i, j);
      const R = () => cutV(i + 1, j);
      const B = () => cutH(i, j);
      const Tp = () => cutH(i, j + 1);
      // Oriented so the inside is on the left; ambiguous cases (5, 10) are
      // resolved by the cell-centre sample, which is what stops a saddle from
      // joining two lobes that the field keeps apart.
      switch (c) {
        case 1: case 14: segs.push(c === 1 ? [L(), B()] : [B(), L()]); break;
        case 2: case 13: segs.push(c === 2 ? [B(), R()] : [R(), B()]); break;
        case 3: case 12: segs.push(c === 3 ? [L(), R()] : [R(), L()]); break;
        case 4: case 11: segs.push(c === 4 ? [R(), Tp()] : [Tp(), R()]); break;
        case 6: case 9: segs.push(c === 6 ? [B(), Tp()] : [Tp(), B()]); break;
        case 7: case 8: segs.push(c === 7 ? [L(), Tp()] : [Tp(), L()]); break;
        case 5:
        case 10: {
          const mid = fieldAt((i + 0.5) / RES, (j + 0.5) / RES) >= 1;
          if (c === 5) {
            if (mid) { segs.push([L(), Tp()], [R(), B()]); }
            else { segs.push([L(), B()], [R(), Tp()]); }
          } else if (mid) { segs.push([B(), L()], [Tp(), R()]); }
          else { segs.push([B(), R()], [Tp(), L()]); }
          break;
        }
      }
    }

  const from = new Map();
  for (const s of segs) {
    const k = key(s[0]);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(s);
  }
  const rings = [];
  const used = new Set();
  for (const s0 of segs) {
    if (used.has(s0)) continue;
    const ring = [s0[0]];
    let cur = s0;
    while (cur && !used.has(cur)) {
      used.add(cur);
      ring.push(cur[1]);
      const next = (from.get(key(cur[1])) ?? []).find((s) => !used.has(s));
      cur = next;
    }
    if (ring.length > 8) rings.push(ring);
  }
  return rings;
}

/**
 * Douglas-Peucker, so the path that ships is a couple of kilobytes rather than
 * eight. The tolerance is in cloud units: 0.0005 is 0.14 px at the size the
 * fallback actually renders (274 px), which is under a device pixel on every
 * display this will ever be drawn on.
 */
const SIMPLIFY = 0.0005;

function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  // A CLOSED ring starts and ends on the same point, so seeding Douglas-Peucker
  // with that single span degenerates: the chord has zero length, every
  // perpendicular distance is zero, and the whole outline collapses to one
  // segment. Split it at the point furthest from the start first.
  let far = 1;
  let farD = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = 1;
  const stack = [
    [0, far],
    [far, pts.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let worst = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

let cached = null;

/**
 * The silhouette as an SVG `d`, in a 0-100 viewBox with +y DOWN (cloud space is
 * +y up, so the trace is flipped here rather than in the markup).
 */
export function confluencePath() {
  if (cached) return cached;
  cached = trace()
    .map((ring) => simplify(ring, SIMPLIFY))
    .map(
      (ring) =>
        "M" +
        ring
          .map(([x, y]) => `${(x * 100).toFixed(2)} ${((1 - y) * 100).toFixed(2)}`)
          .join("L") +
        "Z",
    )
    .join("");
  return cached;
}
