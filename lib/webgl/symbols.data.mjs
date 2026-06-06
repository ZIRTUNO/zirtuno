/**
 * Morph SYMBOLS for the metaball hero — the single source of truth (plain ESM so
 * the Next app `lib/webgl/symbols.ts` AND the capture harness
 * `scripts/capture-symbols.mjs` read the same data).
 *
 * STYLE (from the brand reference): everything is FLUID — fat blobs that run free
 * and NECK together into the symbol. Each symbol is "drawn" as circles `[x, y, r]`
 * in a normalised square space (~[-0.42, 0.42], +y up); rendered through the 2D
 * metaball field  total = Σ rᵢ²/|p−cᵢ|²  thresholded at ~1.3 (react-bits OGL),
 * overlapping circles fuse into one liquid silhouette. To get the bulbs-and-necks
 * look: place BULBS (larger circles) at nodes/ends and connect them with sparse
 * chains (spacing ~1.5–1.8·r) so the joins pinch into necks. Open centres (rings)
 * give us frames / bores / brain folds even though a metaball is "solid".
 *
 * Order matches METABALL_STATES: mark · web · software · ai · automation · data ·
 * branding · marketing.
 */

const TAU = Math.PI * 2;
const RAD = (deg) => (deg * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;

/** A chain of circles along a segment (endpoints inclusive). spacing = ×r. */
function stroke(x1, y1, x2, y2, r, spacing = 1.5) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / (spacing * r)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([lerp(x1, x2, t), lerp(y1, y2, t), r]);
  }
  return out;
}

/** A tapering chain (radius r1→r2) — fluid strokes that swell / thin. */
function taper(x1, y1, x2, y2, r1, r2, n, spacing) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const count = n ?? Math.max(1, Math.round(len / ((spacing ?? 1.5) * ((r1 + r2) / 2))));
  const out = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    out.push([lerp(x1, x2, t), lerp(y1, y2, t), lerp(r1, r2, t)]);
  }
  return out;
}

/** `count` circles evenly around a full ring. */
function ring(cx, cy, R, r, count, phase = 0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * TAU;
    out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, r]);
  }
  return out;
}

/** `count` circles along an arc a0→a1 (radians) — waves / orbits / partial frames. */
function arc(cx, cy, R, r, a0, a1, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const a = lerp(a0, a1, t);
    out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, r]);
  }
  return out;
}

/** A filled rounded panel (two parallel strokes). */
function panel(cx, cy, halfW, halfH, r) {
  return [
    ...stroke(cx - halfW, cy + halfH, cx + halfW, cy + halfH, r, 1.3),
    ...stroke(cx - halfW, cy - halfH, cx + halfW, cy - halfH, r, 1.3),
  ];
}

/** A vertical fluid column of bulbs (data chart). */
function column(x, y0, y1, r, spacing = 1.7) {
  const n = Math.max(0, Math.round((y1 - y0) / (spacing * r)));
  const out = [];
  for (let i = 0; i <= n; i++) out.push([x, n ? lerp(y0, y1, i / n) : y0, r]);
  return out;
}

const disc = (x, y, r) => [x, y, r];

// ── 0 · MARK — the brand's fluid mark: two uprights + a diagonal (a flowing N) ────
const MARK = {
  key: "mark",
  label: "Mark",
  balls: [
    ...taper(-0.21, -0.26, -0.19, 0.26, 0.08, 0.09, 7), // left upright (slim)
    ...taper(0.21, -0.26, 0.23, 0.28, 0.08, 0.1, 7), // right upright (slim, bulb top)
    ...stroke(-0.16, 0.2, 0.18, -0.2, 0.05, 1.5), // the diagonal (N stroke)
    disc(0.0, 0.3, 0.045), // a free drop running off the top
  ],
};

// ── 1 · WEB — a browser WINDOW: open frame + three floating window controls ──────
const WEB = {
  key: "web",
  label: "Web",
  balls: [
    ...stroke(-0.3, 0.3, 0.3, 0.3, 0.04, 1.7), // top
    ...stroke(-0.3, -0.3, 0.3, -0.3, 0.04, 1.7), // bottom
    ...stroke(-0.31, -0.25, -0.31, 0.25, 0.04, 1.7), // left
    ...stroke(0.31, -0.25, 0.31, 0.25, 0.04, 1.7), // right
    ...stroke(-0.22, 0.13, 0.22, 0.13, 0.025, 1.6), // title-bar divider (thin)
    disc(-0.2, 0.22, 0.028), // three window controls (float in the title bar)
    disc(-0.12, 0.22, 0.028),
    disc(-0.04, 0.22, 0.028),
  ],
};

// ── 2 · SOFTWARE — two modules bridged (a dumbbell) + a module + a </> glyph ──────
const SOFTWARE = {
  key: "software",
  label: "Software",
  balls: [
    disc(-0.26, 0.18, 0.11), // node TL
    disc(0.1, 0.21, 0.1), // node TR
    ...stroke(-0.16, 0.18, 0.0, 0.2, 0.05, 1.8), // bridge TL→TR (dumbbell neck)
    disc(-0.26, -0.13, 0.1), // node BL
    ...stroke(-0.26, 0.08, -0.26, -0.04, 0.05, 1.7), // neck TL→BL
    ...stroke(0.1, -0.04, 0.0, -0.15, 0.024, 1.4), // < (separate glyph)
    ...stroke(0.0, -0.15, 0.1, -0.26, 0.024, 1.4),
    ...stroke(0.22, -0.04, 0.32, -0.15, 0.024, 1.4), // >
    ...stroke(0.32, -0.15, 0.22, -0.26, 0.024, 1.4),
  ],
};

// ── 3 · AI — a brain SILHOUETTE: bilobed hemispheres + stem + firing neurons ─────
// (Pure metaballs fill internal folds at this threshold, so we read it by the
//  outline: two top lobes with a central fissure dip, tapering to a stem.)
const AI = {
  key: "ai",
  label: "AI",
  balls: [
    disc(-0.14, 0.18, 0.15), // left hemisphere
    disc(0.14, 0.18, 0.15), // right hemisphere (dip between = fissure)
    disc(-0.24, 0.0, 0.12), // temples
    disc(0.24, 0.0, 0.12),
    disc(-0.12, 0.0, 0.16), // mass
    disc(0.12, 0.0, 0.16),
    disc(0.0, -0.16, 0.12), // base → stem
    disc(0.0, -0.28, 0.06),
    disc(-0.23, -0.22, 0.034), // firing neurons
    disc(-0.15, -0.3, 0.027),
  ],
};

// ── 4 · AUTOMATION — a cycle: a broken refresh ring necking, with arrow bulbs ─────
const AUTOMATION = {
  key: "automation",
  label: "Automation",
  balls: [
    ...arc(0, 0, 0.28, 0.052, RAD(118), RAD(412), 14), // ~294° loop (gap lower-right)
    disc(Math.cos(RAD(118)) * 0.28, Math.sin(RAD(118)) * 0.28, 0.08), // tail bulb
    disc(Math.cos(RAD(52)) * 0.28, Math.sin(RAD(52)) * 0.28, 0.1), // arrow head bulb
  ],
};

// ── 5 · DATA — a chart: four SEPARATED fluid columns of necked bulbs (growing) ───
const DATA = {
  key: "data",
  label: "Data",
  balls: [
    ...column(-0.32, -0.26, -0.06, 0.044),
    ...column(-0.11, -0.26, 0.22, 0.046), // tallest
    ...column(0.11, -0.26, 0.04, 0.044),
    ...column(0.32, -0.26, 0.13, 0.044),
  ],
};

// ── 6 · BRANDING — one essence + an orbit (planet, ring arcs, satellites) ─────────
const BRANDING = {
  key: "branding",
  label: "Branding",
  balls: [
    disc(0, 0, 0.14), // the essence (organic core)
    disc(-0.05, 0.04, 0.09),
    disc(0.05, -0.04, 0.09),
    ...arc(0, 0, 0.35, 0.036, RAD(25), RAD(155), 7), // orbit (top arc)
    ...arc(0, 0, 0.35, 0.036, RAD(205), RAD(335), 7), // orbit (bottom arc)
    disc(0.0, 0.4, 0.048), // satellites
    disc(-0.4, -0.05, 0.042),
    disc(0.38, 0.06, 0.038),
  ],
};

// ── 7 · MARKETING — a megaphone broadcasting right (horn + separated waves) ───────
const MK = [-0.1, 0.02]; // the bell mouth
const MARKETING = {
  key: "marketing",
  label: "Marketing",
  balls: [
    disc(-0.34, 0.0, 0.055), // mouthpiece (narrow back)
    disc(-0.22, 0.01, 0.1), // throat
    disc(-0.1, 0.02, 0.14), // bell (wide front)
    ...arc(MK[0], MK[1], 0.32, 0.03, RAD(-46), RAD(46), 7), // wave 1 (clear gap from bell)
    ...arc(MK[0], MK[1], 0.48, 0.034, RAD(-42), RAD(42), 9), // wave 2
    disc(0.22, 0.34, 0.04), // stray broadcast drops
    disc(0.28, -0.32, 0.045),
  ],
};

export const MARK_RAW = MARK;
export const PILLARS_RAW = [WEB, SOFTWARE, AI, AUTOMATION, DATA, BRANDING, MARKETING];
export const ALL_RAW = [MARK, ...PILLARS_RAW];
