/**
 * Morph SYMBOLS for the metaball hero — the single source of truth (plain ESM so
 * the Next app `lib/webgl/symbols.ts` AND the capture harness
 * `scripts/capture-symbols.mjs` read the same data).
 *
 * STYLE (brand reference): fluid blobs that run free and NECK together into the
 * symbol — fat bulbs, thin pronounced necks, real internal gaps (the brain's
 * folds, the window's screen, the mark's counter). That look is the 2D metaball
 * field  total = Σ rᵢ²/|p−cᵢ|²  rendered at a TIGHT iso-level.
 *
 *   ISO_LEVEL = 2.2  (NOT react-bits' 1.3 — that's too blobby and fills every gap)
 *
 * At this iso: a ball renders ~0.67·r; two balls merge while centres are within
 * ~1.9·r. So:  smooth stroke → spacing ≤ ~1.3·r ; visible neck → ~1.6·r ;
 * deliberate GAP (sulcus / counter) → centres ≳ 2.2·r apart. The hero shader MUST
 * use the same iso-level, or the silhouettes won't match.
 *
 * Order matches METABALL_STATES: mark · web · software · ai · automation · data ·
 * branding · marketing. Space ~[-0.42, 0.42], +y up.
 */

export const ISO_LEVEL = 2.2;

const TAU = Math.PI * 2;
const RAD = (deg) => (deg * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;

/** A chain of circles along a segment (endpoints inclusive). spacing = ×r. */
function stroke(x1, y1, x2, y2, r, spacing = 1.25) {
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
function taper(x1, y1, x2, y2, r1, r2, spacing = 1.25) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / (spacing * ((r1 + r2) / 2))));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([lerp(x1, x2, t), lerp(y1, y2, t), lerp(r1, r2, t)]);
  }
  return out;
}

/** Circles along an arc a0→a1 (radians), auto-spaced for a smooth/necked tube. */
function arc(cx, cy, R, r, a0, a1, spacing = 1.3) {
  const len = Math.abs(a1 - a0) * R;
  const n = Math.max(1, Math.round(len / (spacing * r)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, r]);
  }
  return out;
}

/** A filled rounded panel (two parallel strokes). */
function panel(cx, cy, halfW, halfH, r) {
  return [
    ...stroke(cx - halfW, cy + halfH, cx + halfW, cy + halfH, r, 1.15),
    ...stroke(cx - halfW, cy - halfH, cx + halfW, cy - halfH, r, 1.15),
  ];
}

const disc = (x, y, r) => [x, y, r];

// ── 0 · MARK — the brand's flowing N: two uprights + a diagonal, a free drop ─────
const MARK = {
  key: "mark",
  label: "Mark",
  balls: [
    ...taper(-0.22, -0.26, -0.19, 0.24, 0.085, 0.1), // left upright
    ...taper(0.21, -0.24, 0.24, 0.27, 0.085, 0.11), // right upright (bulb top)
    ...stroke(-0.17, 0.16, 0.18, -0.16, 0.058), // the diagonal (N stroke)
    disc(-0.02, 0.05, 0.05), // a free drop near the crossing
  ],
};

// ── 1 · WEB — a browser window: title bar + 3 controls, framed content, lines ─────
const WEB = {
  key: "web",
  label: "Web",
  balls: [
    ...stroke(-0.28, 0.28, 0.28, 0.28, 0.03, 1.6), // top (thin + sparse → open interior)
    ...stroke(-0.3, -0.27, -0.3, 0.28, 0.03, 1.6), // left
    ...stroke(0.3, -0.27, 0.3, 0.28, 0.03, 1.6), // right
    ...stroke(-0.28, -0.27, 0.28, -0.27, 0.03, 1.6), // bottom
    ...stroke(-0.26, 0.14, 0.26, 0.14, 0.024, 1.6), // title-bar divider
    disc(-0.2, 0.21, 0.026), // 3 controls
    disc(-0.13, 0.21, 0.026),
    disc(-0.06, 0.21, 0.026),
    ...panel(-0.14, -0.04, 0.07, 0.05, 0.035), // content thumbnail (left)
    ...stroke(0.06, 0.02, 0.23, 0.02, 0.02, 1.5), // two text lines (right)
    ...stroke(0.06, -0.08, 0.2, -0.08, 0.02, 1.5),
  ],
};

// ── 2 · SOFTWARE — two modules bridged (a dumbbell) + a module + a </> glyph ──────
const SOFTWARE = {
  key: "software",
  label: "Software",
  balls: [
    disc(-0.26, 0.16, 0.115), // node TL
    disc(0.1, 0.2, 0.1), // node TR
    ...stroke(-0.17, 0.17, 0.0, 0.2, 0.045, 1.5), // bridge TL→TR (necked)
    disc(-0.26, -0.14, 0.1), // node BL
    ...stroke(-0.26, 0.06, -0.26, -0.05, 0.045, 1.4), // neck TL→BL
    ...stroke(0.13, -0.03, 0.02, -0.15, 0.03, 1.2), // <
    ...stroke(0.02, -0.15, 0.13, -0.27, 0.03, 1.2),
    ...stroke(0.25, -0.03, 0.36, -0.15, 0.03, 1.2), // >
    ...stroke(0.36, -0.15, 0.25, -0.27, 0.03, 1.2),
  ],
};

// ── 3 · AI — a brain SILHOUETTE: bilobed hemispheres (fissure dip) + stem ─────────
const AI = {
  key: "ai",
  label: "AI",
  balls: [
    disc(-0.14, 0.15, 0.13), // left hemisphere
    disc(0.14, 0.15, 0.13), // right hemisphere (dip between = central fissure)
    disc(-0.2, 0.0, 0.12), // temples
    disc(0.2, 0.0, 0.12),
    disc(0.0, 0.04, 0.14), // mass
    disc(-0.1, -0.13, 0.11), // lower
    disc(0.1, -0.13, 0.11),
    disc(0.0, -0.22, 0.06), // stem
    disc(-0.22, -0.21, 0.032), // firing neurons
    disc(-0.15, -0.28, 0.026),
  ],
};

// ── 4 · AUTOMATION — a cycle: a fluid necked loop with a gap + arrow bulbs ────────
const AUTOMATION = {
  key: "automation",
  label: "Automation",
  balls: [
    ...arc(0, 0, 0.27, 0.05, RAD(120), RAD(408), 1.45), // ~288° necked loop
    disc(Math.cos(RAD(120)) * 0.27, Math.sin(RAD(120)) * 0.27, 0.08), // tail bulb
    disc(Math.cos(RAD(48)) * 0.27, Math.sin(RAD(48)) * 0.27, 0.1), // arrow head bulb
  ],
};

// ── 5 · DATA — a bar chart: four fluid necked columns, growing, well-separated ────
function column(x, y0, y1, r, spacing = 1.4) {
  const n = Math.max(0, Math.round((y1 - y0) / (spacing * r)));
  const out = [];
  for (let i = 0; i <= n; i++) out.push([x, n ? lerp(y0, y1, i / n) : y0, r]);
  return out;
}
const DATA = {
  key: "data",
  label: "Data",
  balls: [
    ...column(-0.3, -0.26, -0.04, 0.05),
    ...column(-0.1, -0.26, 0.22, 0.052), // tallest
    ...column(0.1, -0.26, 0.04, 0.05),
    ...column(0.3, -0.26, 0.14, 0.05),
  ],
};

// ── 6 · BRANDING — one essence + an orbit (organic core, ring arcs, satellites) ───
const BRANDING = {
  key: "branding",
  label: "Branding",
  balls: [
    disc(0, 0, 0.13), // essence core (organic)
    disc(-0.05, 0.04, 0.085),
    disc(0.05, -0.04, 0.085),
    ...arc(0, 0, 0.33, 0.04, RAD(25), RAD(155), 1.45), // orbit (top arc, necked)
    ...arc(0, 0, 0.33, 0.04, RAD(205), RAD(335), 1.45), // orbit (bottom arc)
    disc(0.0, 0.4, 0.046), // satellites
    disc(-0.4, 0.0, 0.04),
    disc(0.4, 0.05, 0.038),
  ],
};

// ── 7 · MARKETING — a megaphone broadcasting right (horn + necked signal waves) ───
const MK = [-0.08, 0.02]; // the bell mouth
const MARKETING = {
  key: "marketing",
  label: "Marketing",
  balls: [
    ...taper(-0.34, 0.0, MK[0], MK[1], 0.05, 0.15), // horn (back → bell)
    disc(-0.34, 0.0, 0.05), // mouthpiece
    ...arc(MK[0], MK[1], 0.28, 0.04, RAD(-50), RAD(50), 1.5), // wave 1 (necked)
    ...arc(MK[0], MK[1], 0.44, 0.044, RAD(-46), RAD(46), 1.5), // wave 2
    disc(0.24, 0.34, 0.04), // stray broadcast drops
    disc(0.3, -0.32, 0.045),
  ],
};

export const MARK_RAW = MARK;
export const PILLARS_RAW = [WEB, SOFTWARE, AI, AUTOMATION, DATA, BRANDING, MARKETING];
export const ALL_RAW = [MARK, ...PILLARS_RAW];
