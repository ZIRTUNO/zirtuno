/**
 * THE MEMBRANE — the vector half of the site's liquid.
 *
 * `fluid-core.mjs` gave the page a hand and a strike: a volume-conserving
 * displacement WELL (an outward lobe at q≈0.30, a return lobe at q≈0.70 whose
 * area-weighted integrals cancel) and a TRAVELLING pressure ring (crest out,
 * trough back, per-body arrival jitter, saturation on repeat). Every droplet on
 * the homepage answers those two definitions.
 *
 * The buttons did not. They were a rectangle with a fill that slid left→right —
 * the one part of the interface a visitor is actually asked to touch, and the
 * only surface that answered like a div. This kernel closes that: it runs the
 * SAME two definitions — the same profile constants, the same recoil, the same
 * irregularity — on a closed vector contour instead of on 48 droplets.
 *
 * What is deliberately NOT borrowed is scale. `fluid-core` works in field uv
 * over a viewport; a button is ~200×48 px and must answer a finger inside
 * ~200 ms, not 1050. Distance and time constants are therefore re-derived in
 * px/ms and marked as such. The CHARACTER constants — RECOIL, LAG, IRREG,
 * FRONT_JIT, RIM, SATURATE — are the field's, unchanged, because those are what
 * make a wave read as liquid rather than as arithmetic.
 *
 * Two contracts this file exists to keep:
 *
 *   EXACT REST. With no hand and no strike the membrane settles, snaps every
 *   displacement to zero and SLEEPS. `path()` then returns the rest string
 *   character-for-character. A button at rest is a drawn rectangle, not a
 *   simulation idling at 0.02 px. (AGENTS.md §4.3, in spirit: the resting form
 *   is the authored form.)
 *
 *   VOLUME. The HAND's normal acceleration is mean-removed around the ring
 *   before integration, weighted by each vertex's own involvement, so
 *   ∮a·n ds = 0 and the enclosed area has no first-order rate of change. This
 *   is the whole reason the surface reads as an incompressible liquid: it
 *   cannot bulge toward your cursor without drawing itself in somewhere else.
 *   The STRIKE is deliberately exempt — see the note above it; a hand is a
 *   lateral displacement inside the plane, an impact is not.
 *
 * DOM-free and deterministic on purpose — `scripts/verify-membrane.mjs` runs it
 * in plain node.
 */

/** Character constants shared with the field, and the px/ms re-derivations. */
export const MEM = {
  // ── integration ───────────────────────────────────────────────────────────
  H_MS: 8, // fixed substep — fluid-core.FLUID.H_MS
  // Substep ceiling per step(). It exists so a backgrounded tab cannot come
  // back and spiral, but at 5 it also capped catch-up at 40 ms — and a frame
  // longer than that leaves the integrator permanently behind wall time. The
  // strike's envelope advances on wall time (`front = SPEED × age`) while the
  // surface integrates in clamped chunks, so on a slow device the wave swept
  // past each vertex in fewer substeps and delivered less impulse: a tap on a
  // large-viewport tablet measured 1.7 px where the same geometry gives 4.9 px
  // in node. Degraded click feedback on exactly the devices where the tap is
  // the only feedback there is.
  //
  // 10 allows 80 ms of catch-up, which covers a 12 fps frame, and still bounds
  // a returning tab. The cost is paid only on frames that are already slow.
  MAX_SUB: 10,

  // Form memory. ω=14 rad/s with ζ=0.55 returns through exactly ONE soft
  // overshoot and is still inside ~500 ms. Critical damping (ζ=1) reads as
  // rubber returning to a mould; a real meniscus overshoots once. Below ~0.45
  // it starts to ring and the button becomes a toy — measured, not guessed:
  // `verify-membrane.mjs §4` counts the sign changes of the hottest vertex and
  // fails outside 1–4.
  OMEGA: 14,
  ZETA: 0.55,

  // Surface tension, as the discrete Laplacian along the ring. This is the
  // single term that separates "liquid" from "rubber sheet": a rubber sheet
  // dents where you push it, a liquid surface DIFFUSES the dent along itself.
  // K_TEN is a wave speed² in index space — √2600 ≈ 51 vertices/s, so a dent
  // spreads about a quarter of a short button's edge in 150 ms.
  // Symplectic-Euler stability wants h·√(4·K_TEN) < 2 → h < 19.6 ms. At 8 ms
  // there is 2.4× margin, which the substep clamp above preserves.
  K_TEN: 2600,
  // Laplacian of VELOCITY — kills the top mode's ring. Kept low: at 26 it was
  // also eating the strike's recoil, which is the one part of the wave that
  // makes it read as liquid rather than as a blast.
  K_VIS: 14,

  // Tangential channel. Kept stiff and shallow: the perimeter may smear with a
  // moving hand, never travel. Without this the ring can wind onto itself.
  OMEGA_T: 21,
  ZETA_T: 0.9,
  MAX_T: 2.6, // px

  MAX_N: 9, // px — normal displacement clamp; a flick stirs, never tears

  // ── the hand (fluid-core §the hand) ───────────────────────────────────────
  // Profile constants are the field's, verbatim. Only RADIUS/PUSH are re-scaled
  // out of uv into px, because the object is a button and not a viewport.
  RIM: 0.5, // FLUID.CURSOR_RIM — the return lobe that keeps volume
  HAND_PUSH: 4400, // px/s² (FLUID.CURSOR_PUSH 3.1 uv/s², re-derived)
  HAND_SWIRL: 118, // px/s² (FLUID.CURSOR_SWIRL)
  HAND_WAKE: 840, // px/s², velocity-signed (FLUID.CURSOR_WAKE)
  HAND_DRAG: 0.24, // FLUID.CURSOR_DRAG, tangential only
  WAKE_CLAMP: 900, // px/s — clamp the raw pointer speed BEFORE falloff
  PRESS_GAIN: 0.9, // FLUID.CURSOR_PRESS
  PRESS_TAU: 90, // ms — FLUID.PRESS_TAU: a squeeze, not a switch
  // Influence radius, scaled off the button's SHORT dimension — its thickness
  // as a ribbon — not its diagonal. Against the diagonal, a 271x54 CTA got a
  // 132 px radius: half the button's width, so the outward lobe and the rim
  // lobe landed 90 px apart and the pair read as a general S-warp of the whole
  // outline rather than as a meniscus following the cursor. One and a bit
  // button-heights is the natural capillary scale of a thin ribbon, and it puts
  // the rim dimple about 50 px from the finger, which is close enough to see
  // as one feature.
  HAND_R_K: 1.35, // x min(w, h)
  HAND_R_MIN: 46,
  HAND_R_MAX: 92,

  // ── the strike (fluid-core §the strike) ───────────────────────────────────
  SHOCK_SLOTS: 3,
  SHOCK_RECOIL: 0.52, // FLUID.SHOCK_RECOIL — the cavity pulling back
  SHOCK_LAG: 1.55, // FLUID.SHOCK_LAG — trough centre, in wave widths
  SHOCK_IRREG: 0.38, // FLUID.SHOCK_IRREG — angular amplitude irregularity
  SHOCK_FRONT_JIT: 0.24, // FLUID.SHOCK_FRONT_JIT — desynchronises the front
  SHOCK_SATURATE: 0.55, // FLUID.SHOCK_SATURATE — a mash stops compounding
  SHOCK_LOAD_TAU: 620, // ms — FLUID.SHOCK_LOAD_TAU
  SHOCK_MERGE_MS: 110, // FLUID.SHOCK_MERGE_MS
  // Speed and width are ONE decision, and the thing they trade against is the
  // form-memory period (2π/ω ≈ 450 ms). SHOCK_LAG puts the trough
  // 1.55 widths behind the crest, so the surface feels them
  // `1.55 · WIDTH / SPEED` apart — and if that gap is small next to its own
  // period the vertex cannot resolve two events and integrates them into one
  // push. At the first tuning (width 15, speed 780) the gap was 30 ms against
  // 450 and the recoil measured 0.07 px on a 2.7 px crest: arithmetically
  // present, invisible on screen, and the wave read as a blast.
  //
  // 26 px at 560 px/s puts the trough 72 ms behind the crest and restores the
  // recoil to 35% of the crest — out, back through rest, still. The cost is
  // that the front takes ~283 ms to cross a 232 px CTA instead of 233 ms; the
  // liquid under the finger still answers on the first frame, which is the
  // part a reader actually feels as latency.
  SHOCK_SPEED: 560, // px/s
  SHOCK_WIDTH: 26, // px — annulus half-width
  // Spend the wave over DISTANCE, not over time — fluid-core's SHOCK_REACH.
  // A time envelope makes the same click die halfway across a wide CTA and
  // overshoot a narrow one; a reach envelope crosses any button in the family
  // with the same amount left over.
  SHOCK_REACH: 330, // px the front travels before it is spent
  SHOCK_LIFE: 620, // ms — hard expiry, incl. the trough's tail
  SHOCK_A: 1800, // px/s² — crest acceleration ceiling

  // ── awareness + breath ────────────────────────────────────────────────────
  // The button wakes BEFORE it is touched. This is the site's magnetism, and
  // it is deliberately not a translate(): the element never moves, its surface
  // gains tension. Nothing on the page shifts under the reader's eye.
  AWARE_R: 340, // px — proximity at which the membrane starts to wake
  // Asymmetric on purpose: attention arrives gradually and leaves quickly.
  // A symmetric tau also kept the surface integrating for 1.4 s after the
  // pointer had gone, which is frames spent on something nobody is looking at.
  AWARE_TAU: 260, // ms — waking
  AWARE_TAU_OUT: 150, // ms — withdrawing
  BREATH_MS: 8000, // the site's --dur-breath
  // OFF by default, and for the same reason BOW is: this was a 0.42 px
  // travelling capillary wave meant to keep the surface alive while a hand was
  // near, and on a 1 px hairline over black a 0.42 px displacement does not
  // read as breathing. It reads as the antialiasing under the line changing
  // its mind — indistinguishable from a rendering fault, and it costs frames
  // the whole time a pointer is anywhere in the neighbourhood.
  //
  // Awareness still exists and is still visible; it just speaks through the
  // interior WASH instead (`Membrane.tsx`), which is a filled area and renders
  // fractional tone changes cleanly. Raise this only on a surface with a
  // stroke thick enough to carry sub-pixel motion.
  BREATH_A: 0,
  BREATH_WAVES: 1.5, // wavelengths around the perimeter (never an integer)

  // ── the tide (touch devices) ──────────────────────────────────────────────
  // A phone has no hover, so everything above — awareness, the well, the
  // meniscus that follows a cursor — is unreachable. Left at that, a mobile CTA
  // would be a dead rectangle on a page whose whole argument is that it is
  // liquid, and the one control the visitor is asked to press would be the only
  // inert thing on screen.
  //
  // The tide is the autonomous answer, and it is deliberately NOT the breath
  // above with the amplitude turned up. Two things make it read as intent
  // rather than as decoration:
  //
  //   It travels along the LONG AXIS, not around the ring. A wave indexed by
  //   ring position bulges the top edge out while the bottom goes in, and the
  //   button appears to sway. Indexed by x, the crest pushes both long edges
  //   outward together as it passes — the button breathes in height, exactly as
  //   if the page's liquid were running through it. Which is the claim.
  //
  //   It is driven by SCROLL, not only by a clock. `fluid-core` already couples
  //   scroll into the field (SCROLL_STIR / SCROLL_LEAN) because the page is a
  //   container being dragged past the fluid it carries; the buttons are in that
  //   fluid. A timer alone is an animation playing at someone. Scroll makes it
  //   an answer to what the reader is actually doing, and on a phone scrolling
  //   IS the interaction.
  //
  // Amplitude is set where it is for a reason established the hard way: below
  // ~1 px, motion on a 1 px hairline reads as unstable antialiasing rather than
  // as life (see BREATH_A and BOW). 1.9 px is comfortably above that floor and
  // still far below the 3.5 px a deliberate press produces, so the tide can
  // never be mistaken for a response to touch.
  TIDE_A: 1.9, // px — the resting swell
  TIDE_MS: 5200, // ms per crossing — slow enough to feel like weather
  TIDE_WAVES: 0.85, // crossings visible at once (never an integer: no symmetry)
  TIDE_RISE: 900, // ms — fades in as the button enters view, never snaps on
  // Out faster than in, like AWARE: a membrane scrolled out of view should stop
  // costing frames promptly. At the symmetric 900 ms it took 5.6 s to fall
  // below the sleep threshold, all of it off-screen.
  TIDE_FALL: 300, // ms
  // Scroll gain. Held deliberately below the press crest (3.5 px): at 1.5 a
  // hard flick produced 3.8 px, which is a deliberate press's worth of
  // deformation arriving because the reader scrolled. The tide must never be
  // mistakable for a response to touch — that is the whole reason it is
  // allowed to run unprompted.
  TIDE_SCROLL_A: 0.7, // extra amplitude at full scroll speed (x TIDE_A)
  TIDE_SCROLL_RATE: 1.35, // extra phase speed at full scroll speed
  TIDE_SCROLL_CLAMP: 1900, // px/s — the ceiling scroll is measured against
  TIDE_SCROLL_TAU: 420, // ms — scroll energy decays as the page settles

  // ── rest form ─────────────────────────────────────────────────────────────
  //
  // The rest form is a SHARP rectangle, and that is the art direction, not a
  // simplification. This site's CTA has never had a border radius; the brand
  // words are "Discreto. Preciso." A button that sits there looking like a
  // jelly bean has announced the trick before anyone touches it. The liquid is
  // meant to be a property of the material that only a hand reveals — so at
  // rest the reader gets an engineered rectangle, and the surprise is that it
  // turns out to be a surface.
  //
  // BOW was a real idea that had to go. A membrane under internal pressure
  // genuinely does bow between its anchors, so the rest ring used to carry a
  // 0.5 px half-sine on each edge. On a 1 px cyan hairline over black that is
  // pure sub-pixel drift, and sub-pixel drift on a hairline does not read as a
  // gentle swell — it reads as UNEVEN ANTIALIASING, i.e. as a shaky hand-drawn
  // line, i.e. as a rendering bug. Kept as a parameter because it is correct
  // physics and would be right on a thicker stroke; defaulted off because on
  // this one it destroys the precision the brand is built on.
  BOW: 0,
  SEG_PX: 9, // target arc length per vertex
  N_MIN: 32,
  N_MAX: 88,

  // ── sleep ─────────────────────────────────────────────────────────────────
  EPS_D: 0.02, // px
  EPS_V: 0.9, // px/s
};

/** fluid-core's hash, verbatim — same seeds, same irregularity. */
export const hash = (i, k) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/**
 * The rest ring.
 *
 * Sampled PER EDGE rather than uniformly around the whole perimeter, and the
 * difference is the corners. A single arc-length walk puts vertices wherever
 * they fall, so on a 271x54 CTA the four 90-degree corners got between zero and
 * one vertex each — and a Catmull-Rom spline that has to turn a right angle
 * using vertices 9 px either side of it does not turn a right angle, it draws a
 * 9 px blob. The rendered button had four rounded lumps where the brand has
 * four corners. Forcing each edge to start on a corner puts a vertex exactly on
 * every one, and `sharp` tells `path()` to cusp there.
 *
 * Spacing stays near-uniform (each edge divides its own length into whole
 * segments), which is what the Laplacian needs to be a real surface-tension
 * operator: equal spacing means equal rest lengths.
 *
 * Uniform ANGULAR sampling - the other obvious option - would put most vertices
 * on the 54 px ends of a 271 px button and starve the long edges, which is
 * where every interesting deformation happens.
 */
export function buildRest(w, h, opts = {}) {
  const bow = opts.bow ?? MEM.BOW;
  const seg = opts.segPx ?? MEM.SEG_PX;
  const L = 2 * (w + h);

  const edges = [
    { len: w, x0: 0, y0: 0, dx: 1, dy: 0, nx: 0, ny: -1 },
    { len: h, x0: w, y0: 0, dx: 0, dy: 1, nx: 1, ny: 0 },
    { len: w, x0: w, y0: h, dx: -1, dy: 0, nx: 0, ny: 1 },
    { len: h, x0: 0, y0: h, dx: 0, dy: -1, nx: -1, ny: 0 },
  ];
  // Choose a step that divides every edge into whole segments and lands the
  // total inside [N_MIN, N_MAX].
  let step = seg;
  let counts = edges.map((e) => Math.max(2, Math.round(e.len / step)));
  let total = counts.reduce((a, b) => a + b, 0);
  for (let guard = 0; guard < 24 && (total < MEM.N_MIN || total > MEM.N_MAX); guard++) {
    step *= total > MEM.N_MAX ? 1.12 : 0.9;
    counts = edges.map((e) => Math.max(2, Math.round(e.len / step)));
    total = counts.reduce((a, b) => a + b, 0);
  }

  const n = total;
  const bx = new Float32Array(n);
  const by = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const sharp = new Uint8Array(n);
  const longest = Math.max(w, h) || 1;

  let i = 0;
  for (let e = 0; e < 4; e++) {
    const sp = edges[e];
    const c = counts[e];
    const prev = edges[(e + 3) % 4];
    for (let j = 0; j < c; j++) {
      const u = j / c;
      const s = u * sp.len;
      // the pressurised bow - a half-sine over the span, scaled by its length
      const b = bow * (sp.len / longest) * Math.sin(Math.PI * u);
      bx[i] = sp.x0 + sp.dx * s + sp.nx * b;
      by[i] = sp.y0 + sp.dy * s + sp.ny * b;
      if (j === 0) {
        // A corner belongs to both edges. Its normal is the bisector, so the
        // hand pushes a corner diagonally - which is what a corner does.
        const mx = sp.nx + prev.nx;
        const my = sp.ny + prev.ny;
        const m = Math.hypot(mx, my) || 1;
        nx[i] = mx / m;
        ny[i] = my / m;
        sharp[i] = 1;
      } else {
        nx[i] = sp.nx;
        ny[i] = sp.ny;
      }
      i++;
    }
  }
  return { n, w, h, L, bx, by, nx, ny, sharp };
}

/**
 * The same rest contract, built from an ARBITRARY closed ring instead of from
 * a rectangle — so the kernel can run on the brand mark itself (the S1.10
 * intro) and not only on buttons.
 *
 * Everything downstream of `rest` is already shape-agnostic: the tension
 * Laplacian walks the ring by index, the hand and the strike work off each
 * vertex's position and normal, and `path()` splines whatever it is handed.
 * The only rectangle knowledge in this file lives in `buildRest`, which is
 * exactly why this can be a sibling of it rather than a fork of the engine.
 *
 * Two requirements on `pts`, both of which the intro's generator guarantees
 * and neither of which this function can cheaply verify:
 *
 *   UNIFORM ARC SPACING. K_TEN is a wave speed in INDEX space, so it is only a
 *   surface-tension operator when equal index steps mean equal rest lengths.
 *   Feed it a ring sampled by angle or by control point and the tension term
 *   quietly becomes a different stiffness at every vertex.
 *
 *   TRUE OUTWARD NORMALS. On a self-intersecting contour — the mark is one —
 *   "outward" is not recoverable from winding order. The generator measures it
 *   from the distance field instead (scripts/generate-intro-trace.mjs).
 *
 * `sharp` is all-zero: an organic contour has no cusps to preserve, so every
 * vertex takes a real Catmull-Rom tangent and the silhouette stays C¹.
 */
export function ringRest(pts) {
  const n = pts.n ?? pts.x.length;
  const bx = Float32Array.from(pts.x);
  const by = Float32Array.from(pts.y);
  const nx = Float32Array.from(pts.nx);
  const ny = Float32Array.from(pts.ny);
  let L = 0;
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (let i = 0; i < n; i++) {
    const j = i === n - 1 ? 0 : i + 1;
    L += Math.hypot(bx[j] - bx[i], by[j] - by[i]);
    if (bx[i] < minx) minx = bx[i];
    if (bx[i] > maxx) maxx = bx[i];
    if (by[i] < miny) miny = by[i];
    if (by[i] > maxy) maxy = by[i];
  }
  return {
    n,
    // The bbox stands in for w/h. The hand's out-of-bounds falloff and the
    // tide's spatial phase both read these; on a ring they are the extent the
    // shape actually occupies, which is the same thing they meant on a rect.
    w: maxx - minx,
    h: maxy - miny,
    x0: minx,
    y0: miny,
    L,
    bx,
    by,
    nx,
    ny,
    sharp: new Uint8Array(n),
  };
}

/**
 * THE THREAD — the same material, one dimension down.
 *
 * A secondary CTA is a word and an arrow with a rule under it, and the rule
 * used to arrive by `transform: scaleX(0 → 1)`. Next to a primary running an
 * actual displacement well, a wipe from the left is not restraint, it is a
 * different design. This is the same liquid at the scale the element deserves:
 * a filled ribbon whose THICKNESS is the state, not a stroke whose length is.
 *
 * It POURS from wherever the pointer crossed into the element rather than
 * always from the left, and it carries a real surface: `spread` is where the
 * liquid has reached, `thick` how much of it has arrived, and the profile
 * between them is a meniscus — fattest at the pour point, drawn to nothing at
 * both ends by the same tension that holds the primary's outline together.
 *
 * Returns a closed path, so the ribbon has two banks and can actually taper.
 * A `stroke` cannot: SVG stroke width is uniform along a path, which is why
 * every "liquid underline" built out of one looks like a rectangle.
 */
export function threadPath(w, y, x0, spread, thick, seed = 0) {
  if (thick <= 0.02 || spread <= 1) return "";
  const n = 26;
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    // distance from the pour point, in units of how far the liquid has run
    const q = clamp(Math.abs(x - x0) / spread, 0, 1);
    // meniscus: full body at the source, feathering to zero at the front. The
    // 1.6 exponent is what makes the ends look drawn out rather than cut off.
    const body = Math.pow(1 - q * q, 1.6);
    // a slow ripple along the ribbon, so the two banks are never parallel
    const rip = 1 + 0.16 * Math.sin(x * 0.055 + seed) * body;
    const t = thick * body * rip;
    top.push([x, y - t * 0.5]);
    bot.push([x, y + t * 0.5]);
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  let d = `M${r1(top[0][0])} ${r1(top[0][1])}`;
  for (let i = 1; i <= n; i++) {
    const p = top[i - 1];
    const c = top[i];
    d += `Q${r1((p[0] + c[0]) / 2)} ${r1(p[1])} ${r1(c[0])} ${r1(c[1])}`;
  }
  for (let i = n - 1; i >= 0; i--) {
    const p = bot[i + 1];
    const c = bot[i];
    d += `Q${r1((p[0] + c[0]) / 2)} ${r1(p[1])} ${r1(c[0])} ${r1(c[1])}`;
  }
  return `${d}Z`;
}

/**
 * A closed contour around (cx, cy) at radius r, carrying the SAME angular lobe
 * irregularity as the strike. Used for the commit flood on a primary CTA, and
 * sharing the lobe is the point: the fill and the wave that launched it read as
 * one event rather than as two effects that happen to fire together.
 *
 * A perfect circle expanding out of a click is the single most recognisable
 * "ripple effect" on the web. This is the same idea with the arithmetic taken
 * out of the silhouette.
 */
export function lobedCirclePath(cx, cy, r, seed, n = 44) {
  const px = new Array(n);
  const py = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283185307;
    const lobe =
      1 +
      0.055 *
        (0.62 * Math.sin(3 * a + seed) + 0.38 * Math.sin(5 * a - seed * 1.7));
    const rr = r * lobe;
    px[i] = cx + Math.cos(a) * rr;
    py[i] = cy + Math.sin(a) * rr;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  let d = `M${r1(px[0])} ${r1(py[0])}`;
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const i2 = (i + 1) % n;
    const i3 = (i + 2) % n;
    d +=
      `C${r1(px[i] + (px[i2] - px[i0]) / 6)} ${r1(py[i] + (py[i2] - py[i0]) / 6)}` +
      ` ${r1(px[i2] - (px[i3] - px[i]) / 6)} ${r1(py[i2] - (py[i3] - py[i]) / 6)}` +
      ` ${r1(px[i2])} ${r1(py[i2])}`;
  }
  return `${d}Z`;
}

/** The thread's own constants — the 1-D half of the same material. */
export const THREAD = {
  THICK: 2.2, // px — the ribbon's full body at the pour point
  // Asymmetric, and this is the whole feel of it: liquid RUNS when it is let
  // go and is drawn back slowly. Out is fast with one small overshoot (the
  // front runs slightly past and settles); back is calm and never overshoots,
  // because a retreating meniscus does not bounce.
  OMEGA_OUT: 17,
  ZETA_OUT: 0.72,
  OMEGA_IN: 10,
  ZETA_IN: 1,
  // Thickness runs on its OWN, slower spring so the front arrives before the
  // body does: a thin filament reaches across the word, then fills in behind
  // itself. On one shared spring the two were numerically identical and the
  // ribbon just scaled up, which is a wipe with extra steps.
  OMEGA_FILL: 10.5,
  ZETA_FILL: 0.9,
  // The press pulse: the same crest-then-trough the field's strike has, at the
  // one dimension a rule under a word can carry.
  PULSE_MS: 460,
  PULSE_GAIN: 0.9,
  RECOIL: 0.52, // FLUID.SHOCK_RECOIL, again
  // Autonomous resting body on a touch device. Deliberately part-way: the rule
  // must look live without looking hovered, so a real press still has somewhere
  // to go.
  AUTO_BODY: 0.5,
  EPS: 0.004,
};

/**
 * A thread. Same forces, one dimension: `spread` is how far the liquid has run
 * from the pour point and `thick` is how much of it has arrived. Rendered by
 * `threadPath`.
 *
 * Satisfies the same `hand / press / strike / step / asleep` shape the runtime
 * drives membranes with, so a page with both still has exactly one rAF.
 */
export function makeThread(w = 120, h = 20) {
  let W = w;
  let H = h;
  let x0 = W * 0.5;
  let s = 0; // spread, 0..1
  let vs = 0;
  let th = 0; // thick, 0..1
  let vth = 0;
  let over = false;
  let auto = 0; // 0..1 autonomous presence (no hover device)
  let scrollE = 0;
  let pulseT0 = 0;
  let seed = hash(Math.round(W), 11) * 6.283;
  let last = 0;
  let acc = 0;
  let asleep = true;

  const resize = (nw, nh) => {
    W = nw;
    H = nh;
    seed = hash(Math.round(W), 11) * 6.283;
  };

  const hand = (x, y) => {
    const was = over;
    if (x === null) {
      over = false;
    } else {
      over = x >= -4 && x <= W + 4 && y >= -6 && y <= H + 6;
      // The pour point is set on ENTRY and then held. Tracking the pointer
      // would make the ribbon slide around under the word, which is a hover
      // effect following a cursor; pouring from where the reader actually
      // crossed the edge is a liquid answering an event.
      if (over && !was) x0 = clamp(x, 0, W);
    }
    if (over) asleep = false;
  };

  const press = (down) => {
    if (down) asleep = false;
  };

  /**
   * Autonomous mode. The rule cannot wait to be hovered on a phone, so it
   * settles at a RESTING BODY rather than at nothing — thinner than a hover
   * so the two are still distinguishable — and breathes with the page's
   * scroll, the same driver the membrane's tide uses.
   */
  const setTide = (on) => {
    auto = clamp(on, 0, 1);
    if (auto > 0) asleep = false;
  };
  const scroll = (pxPerSec) => {
    const e = clamp(Math.abs(pxPerSec) / MEM.TIDE_SCROLL_CLAMP, 0, 1);
    if (e > scrollE) scrollE = e;
    if (auto > 0 && e > 0.02) asleep = false;
  };
  /** One pour as it comes into view — the liquid reaching the rule. */
  const arrive = (fromBelow, tMs) => {
    void fromBelow;
    pulseT0 = tMs;
    x0 = W * 0.5;
    asleep = false;
  };

  const strike = (x, tMs) => {
    pulseT0 = tMs;
    x0 = clamp(x, 0, W);
    asleep = false;
  };

  /** crest out, trough back — the strike's silhouette in one dimension */
  const pulse = (tMs) => {
    if (!pulseT0) return 0;
    const u = (tMs - pulseT0) / THREAD.PULSE_MS;
    if (u < 0 || u > 1) {
      if (u > 1) pulseT0 = 0;
      return 0;
    }
    const a = (u - 0.15) / 0.16;
    const b = (u - 0.44) / 0.22;
    const crest = Math.exp(-a * a);
    const trough = Math.exp(-b * b);
    return (crest - THREAD.RECOIL * trough) * (1 - u);
  };

  const step = (tMs) => {
    if (!last) {
      last = tMs;
      return false;
    }
    const dtMs = tMs - last;
    last = tMs;
    if (dtMs <= 0) return false;
    if (asleep && !over && auto <= 0.01 && !pulseT0) return false;

    acc += Math.min(dtMs, MEM.H_MS * MEM.MAX_SUB);
    let ran = false;
    while (acc >= MEM.H_MS) {
      acc -= MEM.H_MS;
      const hSec = MEM.H_MS / 1000;
      const goal = over ? 1 : THREAD.AUTO_BODY * auto * (1 + 0.5 * scrollE);
      const out = goal > s;
      const w0 = out ? THREAD.OMEGA_OUT : THREAD.OMEGA_IN;
      const z0 = out ? THREAD.ZETA_OUT : THREAD.ZETA_IN;
      vs += (w0 * w0 * (goal - s) - 2 * z0 * w0 * vs) * hSec;
      s += vs * hSec;
      const outT = goal > th;
      const w1 = outT ? THREAD.OMEGA_FILL : THREAD.OMEGA_IN;
      const z1 = outT ? THREAD.ZETA_FILL : THREAD.ZETA_IN;
      vth += (w1 * w1 * (goal - th) - 2 * z1 * w1 * vth) * hSec;
      th += vth * hSec;
      ran = true;
    }
    if (!ran) return false;

    scrollE *= Math.exp(-MEM.H_MS / MEM.TIDE_SCROLL_TAU);
    if (
      !over &&
      auto <= 0.01 &&
      !pulseT0 &&
      Math.abs(s) < THREAD.EPS &&
      Math.abs(th) < THREAD.EPS &&
      Math.abs(vs) < 0.05 &&
      Math.abs(vth) < 0.05
    ) {
      s = 0;
      th = 0;
      vs = 0;
      vth = 0;
      asleep = true;
    }
    return true;
  };

  /** SVG path data for the ribbon at baseline `y`. */
  const path = (tMs, y = H - 1) => {
    const p = pulse(tMs);
    const thick = THREAD.THICK * clamp(th + THREAD.PULSE_GAIN * p, 0, 2.2);
    // The spread must cover the element even when the pour point is at an end.
    const reach = s * Math.max(x0, W - x0) * 1.25;
    return threadPath(W, y, x0, reach, thick, seed);
  };

  return {
    resize,
    hand,
    press,
    strike,
    arrive,
    setTide,
    scroll,
    step,
    path,
    get asleep() {
      return asleep;
    },
    get spread() {
      return s;
    },
    get thick() {
      return th;
    },
  };
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Closed uniform Catmull-Rom → cubic Bézier, over a point list.
 *
 * Module scope rather than a closure inside `makeMembrane` because it is the
 * one piece of this file a SPLICED contour also needs: `coalesce.mjs` builds a
 * union point list (ring + a densely sampled merge arc) and has to emit it
 * through exactly this routine, or the same rectangle would round-trip to two
 * different `d` strings and the exact-rest guarantee would become a claim
 * about two implementations agreeing rather than about one running twice.
 *
 * `sharp[i]` zeroes vertex i's tangent, which collapses that end's control
 * point onto the vertex — the standard way to put a CUSP in an otherwise
 * smooth spline, and what keeps the four corners at ninety degrees. Between
 * two adjacent cusps both control points collapse and the segment degenerates
 * to a straight line: exactly right for an edge.
 */
export function splinePath(px, py, sharp) {
  const n = px.length;
  if (n < 3) return "";
  const tx = new Array(n);
  const ty = new Array(n);
  for (let i = 0; i < n; i++) {
    if (sharp && sharp[i]) {
      tx[i] = 0;
      ty[i] = 0;
    } else {
      const a = (i - 1 + n) % n;
      const b = (i + 1) % n;
      tx[i] = (px[b] - px[a]) / 6;
      ty[i] = (py[b] - py[a]) / 6;
    }
  }
  let d = `M${r1(px[0])} ${r1(py[0])}`;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    d +=
      `C${r1(px[i] + tx[i])} ${r1(py[i] + ty[i])}` +
      ` ${r1(px[j] - tx[j])} ${r1(py[j] - ty[j])}` +
      ` ${r1(px[j])} ${r1(py[j])}`;
  }
  return `${d}Z`;
}

/**
 * One membrane. Owns its ring, its two displacement channels and its strike
 * slots. Allocation happens on construction and on resize — never per frame,
 * per the field's own convention.
 */
export function makeMembrane(w = 200, h = 48, opts = {}) {
  // A supplied ring (opts.ring) makes this a membrane on an arbitrary closed
  // contour — see ringRest. It owns its own coordinate space, so `resize` has
  // nothing to rebuild and the caller scales it (an SVG viewBox, typically).
  const fixedRing = opts.ring ? ringRest(opts.ring) : null;
  let rest = fixedRing ?? buildRest(w, h, opts);
  let n = rest.n;
  // Per-instance displacement ceiling. Defaults to the field's, so every
  // existing caller is byte-identical; the intro raises it because a 1000-unit
  // mark is not a 48 px button and 9 units of swell there is invisible.
  const maxN = opts.maxN ?? MEM.MAX_N;

  let dn = new Float32Array(n); // normal displacement (px)
  let vn = new Float32Array(n);
  let dt = new Float32Array(n); // tangential displacement (px)
  let vt = new Float32Array(n);
  let an = new Float32Array(n); // per-substep scratch — never reallocated
  let at = new Float32Array(n);
  let wk8 = new Float32Array(n); // volume-correction footprint (see substep)

  // hand
  let hx = 0,
    hy = 0,
    hvx = 0,
    hvy = 0;
  let handOn = false;
  let pressT = 0; // 0..1, PRESS_TAU-smoothed
  let pressWant = 0;
  let aware = 0; // 0..1 proximity wake
  let awareWant = 0;

  // the tide — autonomous, for devices with no hover (see MEM.TIDE_*)
  let tide = 0; // 0..1, TIDE_RISE-smoothed
  let tideWant = 0;
  let tidePh = 0;
  let scrollE = 0; // 0..1 decayed scroll energy

  // strike slots: x, y, front(px), amp
  const SHK = MEM.SHOCK_SLOTS;
  const sk = new Float32Array(SHK * 4);
  const skT0 = new Float64Array(SHK);
  const skSeed = new Float32Array(SHK);
  let seq = 0;
  let load = 0;
  let loadT = 0;

  let last = 0;
  let acc = 0;
  let asleep = true;
  let handR = fixedRing
    ? // On a ring the influence radius is a fraction of the form's own short
      // side, unclamped: MEM's px floor/ceiling are button-sized numbers and
      // mean nothing in a caller's design units.
      (opts.handR ?? 0.22 * Math.min(rest.w, rest.h))
    : clamp(MEM.HAND_R_K * Math.min(w, h), MEM.HAND_R_MIN, MEM.HAND_R_MAX);

  const resize = (nw, nh) => {
    if (fixedRing) return; // a supplied ring is its own geometry — nothing to rebuild
    if (nw === rest.w && nh === rest.h) return;
    rest = buildRest(nw, nh, opts);
    if (rest.n !== n) {
      n = rest.n;
      dn = new Float32Array(n);
      vn = new Float32Array(n);
      dt = new Float32Array(n);
      vt = new Float32Array(n);
      an = new Float32Array(n);
      at = new Float32Array(n);
      wk8 = new Float32Array(n);
    } else {
      dn.fill(0);
      vn.fill(0);
      dt.fill(0);
      vt.fill(0);
    }
    handR = clamp(
      MEM.HAND_R_K * Math.min(nw, nh),
      MEM.HAND_R_MIN,
      MEM.HAND_R_MAX,
    );
    asleep = true;
  };

  /** Pointer in LOCAL px (origin = the element's top-left). `null` lifts it. */
  const hand = (x, y, vx = 0, vy = 0) => {
    if (x === null) {
      handOn = false;
      awareWant = 0;
      pressWant = 0;
      return;
    }
    handOn = true;
    hx = x;
    hy = y;
    hvx = vx;
    hvy = vy;
    // Awareness is measured to the button's BOX, not its centre — otherwise a
    // wide CTA would wake late at its ends and early at its middle.
    // A rect's box starts at the origin; a supplied ring carries its own.
    const bx0 = rest.x0 ?? 0;
    const by0 = rest.y0 ?? 0;
    const ox = Math.max(bx0 - x, 0, x - (bx0 + rest.w));
    const oy = Math.max(by0 - y, 0, y - (by0 + rest.h));
    const gap = Math.hypot(ox, oy);
    awareWant = gap >= MEM.AWARE_R ? 0 : 1 - gap / MEM.AWARE_R;
    if (awareWant > 0 || pressWant > 0) asleep = false;
  };

  const press = (down) => {
    pressWant = down ? 1 : 0;
    if (down) asleep = false;
  };

  /**
   * Turn the autonomous tide on or off. `on` is a 0..1 target, so a caller can
   * fade it with viewport presence rather than snapping it.
   *
   * A membrane running the tide never sleeps — which is the point, and also why
   * the runtime only ever enables it for membranes actually IN VIEW, and steps
   * them at a reduced cadence on the device class least able to pay for frames.
   */
  const setTide = (on) => {
    tideWant = clamp(on, 0, 1);
    if (tideWant > 0) asleep = false;
  };

  /**
   * Feed page scroll speed in px/s. The swell grows and quickens with it and
   * decays back to resting weather when the page settles — the same coupling
   * `fluid-core` gives the droplets, for the same reason: the page is a
   * container being dragged past the fluid it carries.
   */
  const scroll = (pxPerSec) => {
    const e = clamp(Math.abs(pxPerSec) / MEM.TIDE_SCROLL_CLAMP, 0, 1);
    if (e > scrollE) scrollE = e;
    if (tideWant > 0 && e > 0.02) asleep = false;
  };

  /**
   * A click. Repeats inside SHOCK_MERGE_MS fold into the live wave and the
   * amplitude divides by a decaying load count — already-agitated liquid
   * absorbs a second blow far less than a still surface does, so mashing
   * still registers without compounding into chaos.
   */
  const strike = (x, y, tMs, strength = 1, ambient = false) => {
    let amp;
    if (ambient) {
      // AMBIENT strikes — the arrival, and anything else the page fires on the
      // reader's behalf — are exempt from the saturation ledger, in both
      // directions. They are not attenuated by it and, more importantly, they
      // do not CHARGE it.
      //
      // Saturation exists so that mashing a button stops compounding into
      // chaos. Spent by autonomous events it does the opposite of its job:
      // scrolling a CTA in and out of view on a phone fired an arrival each
      // time, and a tap arriving with load=3 came out divided by 2.65 — the
      // reader's own press, the one event that must always read, attenuated to
      // roughly the size of the ambient tide by motion nobody asked for.
      amp = MEM.SHOCK_A * strength;
    } else {
      load *= Math.exp(-(tMs - loadT) / MEM.SHOCK_LOAD_TAU);
      loadT = tMs;
      amp = (MEM.SHOCK_A * strength) / (1 + MEM.SHOCK_SATURATE * load);
      load += 1;
    }

    let slot = -1;
    let oldest = Infinity;
    for (let k = 0; k < SHK; k++) {
      if (sk[k * 4 + 3] > 0 && tMs - skT0[k] < MEM.SHOCK_MERGE_MS) {
        slot = k;
        break;
      }
      if (sk[k * 4 + 3] <= 0) {
        slot = k;
        break;
      }
      if (skT0[k] < oldest) {
        oldest = skT0[k];
        slot = k;
      }
    }
    const o = slot * 4;
    sk[o] = x;
    sk[o + 1] = y;
    sk[o + 2] = 0;
    sk[o + 3] = amp;
    skT0[slot] = tMs;
    seq++;
    skSeed[slot] = hash(seq, 83) * 6.283;
    asleep = false;
  };

  /**
   * The arrival: one wave as the surface comes into view, entering from the
   * edge the reader is travelling toward.
   *
   * On a hover device the button announces itself when you approach it. A
   * touch device has no equivalent, so the moment it becomes visible is the
   * only chance to say "this is live" before the reader decides it is a static
   * box. Struck at 0.55 strength — plainly gentler than a real press, so a tap
   * still reads as the harder event.
   */
  const arrive = (fromBelow, tMs) => {
    strike(rest.w * 0.5, fromBelow ? rest.h : 0, tMs, 0.55, true);
  };

  /** 0..1 — how much strike energy is still in the surface. */
  const charge = () => {
    let m = 0;
    for (let k = 0; k < SHK; k++) m = Math.max(m, sk[k * 4 + 3] / MEM.SHOCK_A);
    return clamp(m, 0, 1);
  };

  function substep(hSec, tMs) {
    an.fill(0);
    at.fill(0);

    // ── the hand ──────────────────────────────────────────────────────────
    if (handOn && (pressT > 0.001 || awareWant > 0)) {
      const gain = 1 + MEM.PRESS_GAIN * pressT;
      const sp = Math.hypot(hvx, hvy);
      const cl = sp > MEM.WAKE_CLAMP ? MEM.WAKE_CLAMP / sp : 1;
      const pvx = hvx * cl;
      const pvy = hvy * cl;
      let sumA = 0;
      let sumW = 0;
      for (let i = 0; i < n; i++) {
        const ddx = rest.bx[i] - hx;
        const ddy = rest.by[i] - hy;
        const d = Math.hypot(ddx, ddy);
        const q = d / handR;
        if (q >= 1) continue;
        const d0 = d > 1e-4 ? d : 1e-4;
        const ux = ddx / d0;
        const uy = ddy / d0;
        const q3 = q * q * q;
        const taper = 1 - q3 * q3; // exact zero at the influence edge
        const outward = Math.exp(-(q - 0.3) * (q - 0.3) * 18);
        const back = Math.exp(-(q - 0.7) * (q - 0.7) * 30);
        const nearFade = q < 0.12 ? q / 0.12 : 1;
        const radial = (outward - MEM.RIM * back) * taper * nearFade;
        const fall = (1 - q * q) * taper;
        // project the well onto the surface normal — the boundary answers with
        // its normals intact, which is what lets a bulge light itself
        const proj = ux * rest.nx[i] + uy * rest.ny[i];
        const push = MEM.HAND_PUSH * radial * gain * proj;
        an[i] += push;
        sumA += push;
        // the correction's footprint — see the mean-removal note below
        wk8[i] = taper;
        sumW += taper;
        // wake: signed by (pointer velocity × offset), so the two sides of the
        // hand's path counter-rotate the way flow past a real body does
        const tx = -rest.ny[i];
        const ty = rest.nx[i];
        const cross = pvx * uy - pvy * ux;
        const wk = clamp(cross / MEM.WAKE_CLAMP, -1, 1) * fall;
        at[i] +=
          (MEM.HAND_SWIRL * fall + MEM.HAND_WAKE * wk) *
            gain *
            (ux * ty - uy * tx) +
          (pvx * tx + pvy * ty) * MEM.HAND_DRAG * fall * gain;
      }
      // VOLUME: cancel the net normal acceleration, so the well cannot inflate
      // or deflate the button. Without this the "liquid" is a scale transform
      // wearing a costume.
      //
      // The correction is WEIGHTED by each vertex's own involvement rather than
      // spread flat over the ring. A flat mean is defensible incompressibility
      // — pressure in a truly incompressible fluid does travel instantly — but
      // it telegraphs every local touch to the whole outline on the same frame,
      // and the far end of a 232 px CTA twitching because you brushed the near
      // end is exactly the tell that gives a simulation away. Weighting by
      // `taper` returns the displaced volume inside the hand's own footprint,
      // which is what the RIM lobe is already doing analytically; this only
      // cleans up the residual left by projecting the well onto the normals.
      // Σ(a − (ΣA/ΣW)·w) = 0 exactly, so volume is still conserved to the digit.
      if (sumW > 1e-6) {
        const kx = sumA / sumW;
        for (let i = 0; i < n; i++)
          if (wk8[i] > 0) {
            an[i] -= kx * wk8[i];
            wk8[i] = 0;
          }
      }
    }

    // ── the strike ────────────────────────────────────────────────────────
    //
    // Deliberately NOT volume-corrected, unlike the hand above, and the
    // asymmetry is the physics rather than an oversight.
    //
    // The hand is a LATERAL displacement: liquid moves within the plane the
    // silhouette lives in, so whatever the surface gives up on one side it
    // must take back on another, and the correction above enforces that. A
    // click is an impact INTO the surface — the volume it displaces leaves
    // through the third dimension, and a 2-D outline watching that happen is
    // entitled to swell. Forcing area conservation here was tried and it
    // cancels ~80% of the wave, because on a convex boundary an outward
    // impulse from an interior point is almost purely inflating: there is no
    // "somewhere else" inside the annulus for the volume to go.
    //
    // What keeps this from reading as a scale-up is structure, not bookkeeping:
    // the front TRAVELS, its amplitude is lobed and per-vertex jittered, a
    // trough follows the crest at SHOCK_LAG and pulls the surface back through
    // rest, and the form-memory spring returns every vertex to exact zero. A
    // uniform instantaneous swell and a travelling irregular annulus with a
    // recoil look nothing alike.
    for (let k = 0; k < SHK; k++) {
      const o = k * 4;
      if (sk[o + 3] <= 0) continue;
      const age = tMs - skT0[k];
      if (age > MEM.SHOCK_LIFE) {
        sk[o + 3] = 0;
        continue;
      }
      const front = (MEM.SHOCK_SPEED * age) / 1000;
      if (front > MEM.SHOCK_REACH) {
        sk[o + 3] = 0;
        continue;
      }
      sk[o + 2] = front;
      const env = 1 - front / MEM.SHOCK_REACH;
      const amp = sk[o + 3] * env;
      const seed = skSeed[k];
      for (let i = 0; i < n; i++) {
        const ddx = rest.bx[i] - sk[o];
        const ddy = rest.by[i] - sk[o + 1];
        const d = Math.hypot(ddx, ddy);
        if (d < 1e-5) continue;
        // per-vertex arrival jitter — desynchronising the FRONT is stronger
        // than modulating its amplitude, because a perfect ring is the
        // signature of arithmetic and not of a fluid
        const jit = 1 + MEM.SHOCK_FRONT_JIT * (hash(i, 17) * 2 - 1);
        const u = (d - sk[o + 2] * jit) / MEM.SHOCK_WIDTH;
        if (u > 2.4 || u < -(MEM.SHOCK_LAG + 2.4)) continue;
        const crest = Math.exp(-u * u * 1.35);
        const lag = u + MEM.SHOCK_LAG;
        const trough = Math.exp(-lag * lag * 0.9);
        const ang = Math.atan2(ddy, ddx);
        const lobe =
          1 +
          MEM.SHOCK_IRREG *
            (0.62 * Math.sin(3 * ang + seed) +
              0.38 * Math.sin(5 * ang - seed * 1.7));
        // No radial projection here — and that is the difference between the
        // two forces, not an omission. The hand is a DISPLACEMENT field: it
        // has a direction, so the boundary answers only with the component
        // along its own normal, and `proj` above is required. A strike is a
        // PRESSURE field, and pressure is a scalar: when the front arrives it
        // pushes whatever boundary it finds along that boundary's own normal,
        // at full strength, whatever angle the origin happens to lie at.
        //
        // Projecting it was tried and it makes a wide CTA nearly immune to its
        // own clicks: on a 232×48 button the radial direction from any interior
        // point is almost horizontal while the long edges' normals are vertical,
        // so proj ≈ 0.13 and the wave that should cross the button arrives as a
        // rounding error. The lobe term above already carries the directional
        // character the projection was accidentally supplying.
        an[i] +=
          (crest - MEM.SHOCK_RECOIL * trough) * Math.max(lobe, 0) * amp;
      }
    }

    // ── the tide ──────────────────────────────────────────────────────────
    // Travels along the long axis. `stir` is decayed scroll energy, so the
    // swell grows and quickens while the reader moves the page and settles
    // back to its resting weather when they stop.
    if (tide > 0.01) {
      const stir = scrollE;
      const amp =
        MEM.TIDE_A *
        tide *
        (1 + MEM.TIDE_SCROLL_A * stir) *
        MEM.OMEGA *
        MEM.OMEGA;
      tidePh +=
        ((hSec * 6.283) / (MEM.TIDE_MS / 1000)) *
        (1 + MEM.TIDE_SCROLL_RATE * stir);
      const span = rest.w || 1;
      for (let i = 0; i < n; i++)
        an[i] +=
          amp *
          Math.sin((rest.bx[i] / span) * 6.283 * MEM.TIDE_WAVES - tidePh);
    }

    // ── breath ────────────────────────────────────────────────────────────
    // Only while the surface is aware of a hand. A button no one is near is a
    // drawn rectangle; motion nobody caused is noise.
    if (aware > 0.01) {
      const ph = (tMs / MEM.BREATH_MS) * 6.283;
      const A = MEM.BREATH_A * aware * MEM.OMEGA * MEM.OMEGA;
      for (let i = 0; i < n; i++)
        an[i] += A * Math.sin((i / n) * 6.283 * MEM.BREATH_WAVES - ph);
    }

    // ── integrate (symplectic Euler) ──────────────────────────────────────
    const w2 = MEM.OMEGA * MEM.OMEGA;
    const cN = 2 * MEM.ZETA * MEM.OMEGA;
    const w2t = MEM.OMEGA_T * MEM.OMEGA_T;
    const cT = 2 * MEM.ZETA_T * MEM.OMEGA_T;
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? n - 1 : i - 1;
      const q = i === n - 1 ? 0 : i + 1;
      const lap = dn[p] + dn[q] - 2 * dn[i]; // surface tension
      const lav = vn[p] + vn[q] - 2 * vn[i]; // viscosity
      vn[i] +=
        (an[i] - w2 * dn[i] - cN * vn[i] + MEM.K_TEN * lap + MEM.K_VIS * lav) *
        hSec;
      vt[i] += (at[i] - w2t * dt[i] - cT * vt[i]) * hSec;
    }
    for (let i = 0; i < n; i++) {
      dn[i] = clamp(dn[i] + vn[i] * hSec, -maxN, maxN);
      dt[i] = clamp(dt[i] + vt[i] * hSec, -MEM.MAX_T, MEM.MAX_T);
    }
  }

  /** Advance to `tMs`. Returns true if the surface moved this call. */
  const step = (tMs) => {
    if (!last) {
      last = tMs;
      return false;
    }
    const dtMs = tMs - last;
    last = tMs;
    if (dtMs <= 0) return false;
    if (asleep && !handOn && pressWant === 0) return false;

    // press and awareness are smoothed OUTSIDE the substep loop — they are
    // input conditioning, not physics
    const kP = 1 - Math.exp(-dtMs / MEM.PRESS_TAU);
    pressT += (pressWant - pressT) * kP;
    const tauA = awareWant > aware ? MEM.AWARE_TAU : MEM.AWARE_TAU_OUT;
    const kA = 1 - Math.exp(-dtMs / tauA);
    aware += (awareWant - aware) * kA;
    const tauT = tideWant > tide ? MEM.TIDE_RISE : MEM.TIDE_FALL;
    tide += (tideWant - tide) * (1 - Math.exp(-dtMs / tauT));
    scrollE *= Math.exp(-dtMs / MEM.TIDE_SCROLL_TAU);

    acc += Math.min(dtMs, MEM.H_MS * MEM.MAX_SUB);
    let ran = false;
    while (acc >= MEM.H_MS) {
      acc -= MEM.H_MS;
      substep(MEM.H_MS / 1000, tMs - acc);
      ran = true;
    }
    if (!ran) return false;

    // ── sleep, and with it EXACT REST ────────────────────────────────────
    // `tide > 0.002` blocks it: a membrane the runtime has handed the tide to
    // is meant to keep moving. Once the tide is faded out (scrolled out of
    // view, or a hover device took over) it settles to exact rest like any
    // other, so the contract is suspended, never broken.
    if (!handOn && pressWant === 0 && charge() <= 0 && tide <= 0.01) {
      let md = 0;
      let mv = 0;
      for (let i = 0; i < n; i++) {
        const a = Math.abs(dn[i]);
        if (a > md) md = a;
        const b = Math.abs(vn[i]);
        if (b > mv) mv = b;
        const c = Math.abs(dt[i]);
        if (c > md) md = c;
      }
      if (md < MEM.EPS_D && mv < MEM.EPS_V && aware < 0.01) {
        dn.fill(0);
        vn.fill(0);
        dt.fill(0);
        vt.fill(0);
        aware = 0;
        pressT = 0;
        asleep = true;
      }
    }
    return true;
  };

  /** Enclosed area (px²) — the volume contract's measurement. */
  const area = () => {
    let a = 0;
    for (let i = 0; i < n; i++) {
      const j = i === n - 1 ? 0 : i + 1;
      const xi = rest.bx[i] + rest.nx[i] * dn[i] - rest.ny[i] * dt[i];
      const yi = rest.by[i] + rest.ny[i] * dn[i] + rest.nx[i] * dt[i];
      const xj = rest.bx[j] + rest.nx[j] * dn[j] - rest.ny[j] * dt[j];
      const yj = rest.by[j] + rest.ny[j] * dn[j] + rest.nx[j] * dt[j];
      a += xi * yj - xj * yi;
    }
    return Math.abs(a) / 2;
  };

  /**
   * The ring, displaced, as a point list. Split out of `path()` so that a
   * caller which needs to SPLICE the contour — see `coalesce.mjs`, where a
   * merged droplet replaces a span of the ring with a densely sampled union
   * arc — works from the same points this membrane would have drawn, rather
   * than reconstructing them and drifting out of sync.
   */
  const points = (offset = 0, push = null) => {
    const px = new Array(n);
    const py = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = dn[i] + offset + (push ? push[i] : 0);
      px[i] = rest.bx[i] + rest.nx[i] * o - rest.ny[i] * dt[i];
      py[i] = rest.by[i] + rest.ny[i] * o + rest.nx[i] * dt[i];
    }
    return { px, py, sharp: rest.sharp };
  };

  /**
   * Closed uniform Catmull-Rom → cubic Bézier. Splining the ring rather than
   * emitting a 45-gon is what keeps the silhouette a SURFACE: the deformation
   * is C¹ across every vertex, so a dent has no facets to catch light on.
   *
   * `push` is an optional per-vertex EXTRA outward displacement, in px, that
   * lives outside the simulation state: it is applied at emission and never
   * integrated, never damped and never remembered. That is deliberate, and it
   * is the same exception the homepage forms take for the hand (AGENTS §8.3) —
   * a render-only term is the only way to add a shape to the surface without
   * putting the exact-rest contract at the mercy of an integrator. Pass
   * nothing and this is byte-identical to what it always emitted.
   */
  const path = (offset = 0, push = null) => {
    const p = points(offset, push);
    return splinePath(p.px, p.py, p.sharp);
  };

  return {
    resize,
    hand,
    press,
    strike,
    arrive,
    setTide,
    scroll,
    step,
    points,
    path,
    area,
    charge,
    get asleep() {
      return asleep;
    },
    get aware() {
      return aware;
    },
    get pressure() {
      return pressT;
    },
    /** 0..1 — how much of the autonomous tide is faded in. */
    get tide() {
      return tide;
    },
    get count() {
      return n;
    },
    get rest() {
      return rest;
    },
    /** Read-only normal displacements (px) — harness and debug only. */
    get dn() {
      return dn;
    },
  };
}
