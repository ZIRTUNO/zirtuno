/**
 * THE AURA'S VAPOUR — the Origin's mist, at background amplitude.
 *
 * ── what this replaced, and why ──────────────────────────────────────────────
 *
 * The first aura drew its vapour as a full-viewport NOISE WASH: `potential`
 * sheared by `curlAt`, remapped, tinted cyan and stretched over the screen. Two
 * things were wrong with it, and they are the same thing at two scales.
 *
 * IT HAD SHAPES. A remapped fbm field is a field of lobes — that is what fbm
 * IS — so the ground carried cloud masses a third of a screen across with
 * darker gaps between them. The tuning that shipped tried to cure this by
 * widening the remap until the lobes were faint, which does not remove them,
 * it only dims them: the blotches were still the largest visible structure on
 * every route that has no liquid. A background with shapes is something a
 * reader looks at, and the moment they look at it, it is no longer a
 * background.
 *
 * IT WAS A COLOUR. A cyan wash covering every pixel does not lift the ink, it
 * REPLACES it: measured, the ground went to rgb(4,12,13) — a petrol green-blue
 * the eye reads as the page's colour rather than as light on black. That is a
 * direct cost to the liquid, which is the site's one loud element and which
 * earns its punch from being cyan on BLACK. Against a ground already two
 * thirds of the way to its own hue, the droplets read as dull teal blobs.
 *
 * ── what it is now ───────────────────────────────────────────────────────────
 *
 * PARTICLES, NOT A FIELD. The atmosphere is a population of micro-droplets
 * suspended in the viewport, drifting on the site's own curl current: THE MIST
 * (`lib/webgl/mist.mjs`, written for the S7 convergence on
 * `feat/s7-convergence`), with everything belonging to that chapter's
 * choreography removed — no attractors, no condensation onto hosts, no skin,
 * no spelling. What is left is the part that was always atmosphere: free
 * vapour on the current.
 *
 * This is the whole answer to "it had shapes". A noise field cannot be made
 * shapeless, because its shapes are its content. A cloud of specks 2-3 px
 * across has no shape at any amplitude — the structure sits BELOW the scale
 * the eye groups at, so it reads as texture and depth however much of it there
 * is. It is also the honest version of the site's own argument: this is the
 * same liquid as everything else on the page, at the one scale where dispersal
 * has nothing solid left in it.
 *
 * ── the reference ────────────────────────────────────────────────────────────
 *
 * utopia513.com, which the owner brought, solves the flat-ground problem with a
 * single very low-frequency two-tone gradient (computed per-VERTEX on a coarse
 * mesh, so it is smooth by construction and cannot carry fine structure) plus a
 * great deal of film grain. The lesson taken is the SEPARATION OF DUTIES, not
 * the picture: the ground supplies a slow, shapeless luminance gradient, and
 * every bit of texture comes from a fine, uniform population on top of it.
 * Here the gradient is `.aura-lights` in CSS and the fine population is this,
 * with `.breath-layer`'s grain over both — the same three-layer stack the
 * reference uses, in this site's palette and at a fraction of its amplitude.
 *
 * ── the numbers are derived, not chosen ──────────────────────────────────────
 *
 * The mist's own constants do not transfer: it ran at 0.27 uv/s, an inflow that
 * crosses the stage in four seconds, because a chapter was being told with it.
 * A background at that speed is a distraction. The speeds here were solved
 * backwards from how long a mote should take to cross the screen (about a
 * minute), and `STREAK_T` was then re-derived from THAT speed — at the mist's
 * own 0.045 s a background mote draws a 0.8 px streak, which is a dot, and the
 * velocity-aligned capsule is the one thing that makes a drifting population
 * read as AIR rather than as stars. See each constant in `AURA` below.
 */

import { NOISE_GLSL } from "./noise-glsl.mjs";

/** GLSL literal for a JS number — GLSL ES has no implicit int to float. */
const g = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};

/**
 * THE TUNING, in one place. Field units: y spans 1.0 over the viewport HEIGHT
 * and x spans the aspect ratio, so a speed of 1.0 crosses the screen vertically
 * in one second and the weather is never stretched by the window's shape.
 */
export const AURA = {
  /**
   * Texture edge per tier; the population is its square. 160^2 is 25 600 motes,
   * which over a 1440x900 viewport is one about every 7 px — dense enough to
   * read as a continuous medium, sparse enough that no two ever group into
   * something with an outline.
   *
   * DENSITY IS THE RIGHT DIAL FOR PRESENCE, and brightness is the wrong one.
   * Both make the air more present, but a brighter mote eventually stops being
   * dust and becomes a dot somebody can point at, while more motes at the same
   * brightness just make the medium continuous. Raise this before ALPHA. It is
   * nearly free: the step pass is one fragment per mote, so 160^2 is 0.026 Mpx
   * against the liquid's ~1.9.
   */
  SIZE_FULL: 160,
  SIZE_LITE: 112,

  /** Fixed substep (ms) and the per-frame bound, as fluid-core and the mist
   *  run them: motion must not depend on the frame rate, and a tab stall must
   *  not spend a hundred passes catching up. */
  H_MS: 20,
  MAX_STEPS: 6,
  /** Substeps run at a cold start, so the field arrives already advected
   *  rather than visibly picking up speed from a standstill. */
  WARMUP: 40,

  // ── the current ────────────────────────────────────────────────────────────
  /**
   * EDDY SIZE, as a scale on the noise ladder's own frequencies. `curlAt`
   * returns the curl in the coordinate system it is sampled in, so this moves
   * the SIZE of the weather without touching its STRENGTH — the two dials are
   * genuinely independent, which is why the speed below could be solved on its
   * own. At 0.45 the ladder's coarse octave (f = 3.1) lands at 1.4 cycles per
   * screen height: about one eddy per viewport, which is the reference's own
   * character and the largest structure that can exist without being a shape.
   */
  CURL_SCALE: 0.45,
  /**
   * Curl gain. Measured over the ladder, mean |curl| is 1.95 at any scale, so
   * terminal speed is 1.95 * CURL_V / DRAG = 0.0217 field units per second —
   * a mote crosses the screen in about 46 seconds. Plainly moving if you watch
   * it; entirely ignorable if you do not, which is the whole specification.
   */
  CURL_V: 0.01,
  /** Velocity relaxation (1/s). ~1.1 s to answer a change in the current, so
   *  the population turns with the weather instead of snapping to it. */
  DRAG: 0.9,
  /** Speed ceiling. The strongest eddies measure |curl| 5.8, which would reach
   *  0.064; this bounds the tail without touching the typical mote. */
  V_MAX: 0.09,
  /**
   * A mote's OWN aperiodic drift (units/s^2) — value-noise fBm in time, per
   * particle. About a sixth of the curl's authority: enough that two motes in
   * one eddy disagree slightly, which is what stops a group of them reading as
   * a single object being carried.
   */
  DRIFT: 0.003,
  /**
   * THE SCROLL LEAN (units/s^2 per viewport-height/s of scroll). The one way
   * the atmosphere answers the reader, and deliberately the only one: leaning
   * with the page ties the air to READING, where a pointer response would tie
   * it to POINTING and invite exactly the attention a background must not get.
   * At a fast 3 vh/s scroll this displaces the field about 9 px and recovers.
   */
  SCROLL_LEAN: 0.0035,
  /** Scroll is clamped before it is used: a fling must lean the air, not blow
   *  it off the screen. */
  SCROLL_CLAMP: 4,
  /** The field's own clock, as a multiplier on the ladder's drift. Under 1 on
   *  purpose — weather that turns over at reading speed becomes something to
   *  watch. At 0.3 the pattern renews over roughly a minute. */
  TIME: 0.3,

  // ── the picture ────────────────────────────────────────────────────────────
  /**
   * Sprite half-size in CSS pixels, so a mote is the same size on every
   * display and a high-density screen spends its pixels on the EDGE of the
   * speck rather than on making it smaller.
   *
   * 1.0 is a 2 px dot, and the lower bound on that is set by the GRAIN, not by
   * taste: `.breath-layer` sits on top of this layer and its texture is
   * per-pixel, so a mote the size of a pixel or two competes with the noise
   * instead of reading through it. At 2 to 3.4 px a mote is plainly a
   * particle and still far below the size at which a thing has a shape.
   */
  SIZE_PX: 1,
  SIZE_VAR: 0.7,
  /**
   * A mote's streak is its velocity times this — the mist's signature, and the
   * one setting here with a ceiling set by TASTE rather than by arithmetic.
   *
   * The elongation has to be big enough that a mote reads as a thing being
   * CARRIED (which is what separates suspended air from a starfield) and small
   * enough that the population does not draw the flow field. At 0.25 it did
   * exactly that: neighbours in one eddy align, and with a 5 px streak on a
   * 2 px body the alignment became legible across the whole viewport as combed
   * striations — a wind map, which is a shape, and a large one. At 0.12 a mote
   * is a slightly oval speck whose long axis you can find if you look for it,
   * and the eddies stay invisible.
   */
  STREAK_T: 0.12,
  /** …and the cap, so a mote in the fastest eddy is a dash and never a stroke. */
  STREAK_MAX: 0.006,
  /**
   * Base opacity, and the spread across the population. Most of the field sits
   * at the faint end; the variance is what gives it depth rather than reading
   * as one flat sheet of dots.
   *
   * THE AUTHORED AMPLITUDE LIVES HERE, NOT IN THE CSS. `--aura-mist` drives the
   * canvas `opacity`, and opacity CLAMPS AT 1 — so that variable can only ever
   * dim this layer, never lift it, and a value above 1 does exactly nothing.
   * Raising the vapour means raising these two.
   *
   * The window is bounded at both ends, and neither end is taste. The floor is
   * the film grain, which peaks around nine levels: below that a mote is not a
   * particle, it is more noise. The ceiling is that motes draw ADDITIVELY, so
   * where two overlap they sum, and a mote bright enough to be pointed at has
   * stopped being dust. What matters is the RATIO to the ground it sits on
   * rather than the absolute: at the brighter ground this ships with, a peak
   * near 70 is a smaller step above the ink than 40 was against the darker one.
   */
  ALPHA: 0.1,
  ALPHA_VAR: 0.085,
  /** Far motes dim by this share — the R5-C depth grade, at this scale. */
  DEPTH_DIM: 0.55,
  /** Speed at which a mote reaches its brightest tint, and how far it leans. */
  SPEED_GLOW: 0.05,
  GLOW_MIX: 0.35,
  /**
   * THE MARGIN. The field's box is the viewport grown by this on every side,
   * and a mote that leaves one edge wraps to the other. Both the wrap and the
   * alpha fade that hides it happen entirely inside this band — which is
   * OFF SCREEN — so the population is conserved with no pop at the edges and,
   * just as importantly, no vignette: a fade inside the visible area would be
   * a shape, and the whole point here is that there are none.
   */
  MARGIN: 0.12,
  /** Draw rate. The field renews over a minute; 30 fps is imperceptible on it
   *  and halves the cost outright. */
  FPS: 30,
};

/** Fullscreen triangle from gl_VertexID — no buffers, no VAO contents. */
export const AURA_VERT = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// EVERY SHADER STRING BELOW IS ASCII-ONLY, AND THAT IS A HARD REQUIREMENT, NOT
// A STYLE. GLSL ES 3.00 restricts its source character set, and ANGLE and
// SwiftShader enforce it INSIDE COMMENTS TOO: a single typographic dash in a
// comment fails the compile, and `getShaderInfoLog` comes back null, so the
// only symptom is a shader that silently refuses to exist. `assertAscii` below
// turns that into a real error in development. Write "-" and "->", never the
// dashes and arrows used everywhere else in this codebase.

/**
 * THE STEP. One fragment is one mote, and one pass is one fixed substep of the
 * rule the mist states in JS. State is a single RGBA32F texel — position in xy,
 * velocity in zw — so unlike the mist there is no second target and no MRT:
 * life, capture state, host and phase were all choreography, and none of them
 * survives into a background.
 */
export const AURA_STEP_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uState; // xy position (field units) . zw velocity (units/s)
uniform int uSize;
uniform float uDt;      // substep, seconds
uniform float uTime;    // the field's own slow clock, seconds
uniform float uSeed;    // 1 = scatter the whole population and start again
uniform vec2 uField;    // the visible box: (aspect, 1.0)
uniform float uMargin;  // the off-screen band the wrap happens in
uniform float uScroll;  // viewport-heights per second, already clamped

out vec4 oState;

${NOISE_GLSL}

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  int i = tc.y * uSize + tc.x;
  vec2 lo = vec2(-uMargin);
  vec2 span = uField + uMargin * 2.0;

  // The seed. Hashed, so the start is a scatter and not a lattice, and
  // deterministic, so a remount lands on the same field rather than on a new
  // one the reader would see arrive.
  if (uSeed > 0.5) {
    oState = vec4(lo + span * vec2(lhashf(i, 101), lhashf(i, 102)), 0.0, 0.0);
    return;
  }

  vec4 S = texelFetch(uState, tc, 0);
  vec2 p = S.xy;
  vec2 v = S.zw;
  float h1 = lhashf(i, 311);
  float h2 = lhashf(i, 312);

  // THE CURRENT - the same curl the droplets ride, one scale coarser. The
  // per-mote gain is what keeps neighbours in one eddy from moving as a block.
  vec2 a = curlAt(p * ${g(AURA.CURL_SCALE)}, uTime)
         * (${g(AURA.CURL_V)} * (0.55 + 0.9 * h1));

  // ...and its own clock, so no two motes ever agree for long.
  float ck = 0.09 + 0.16 * h2;
  a += vec2(fbm1(uTime * ck, i * 2), fbm1(uTime * ck, i * 2 + 1))
     * ${g(AURA.DRIFT)};

  // The reader, leaning the air as the page moves under it.
  a.y -= uScroll * ${g(AURA.SCROLL_LEAN)};

  // Integrate: semi-implicit, exponential drag, a ceiling.
  v += a * uDt;
  v *= exp(-${g(AURA.DRAG)} * uDt);
  float sp = length(v);
  if (sp > ${g(AURA.V_MAX)}) v *= ${g(AURA.V_MAX)} / sp;
  p += v * uDt;

  // THE WRAP. GLSL mod() is x - y*floor(x/y), so this is correct for negative
  // positions and needs no branch. Population is conserved exactly: nothing is
  // ever spawned or killed, which is the mist's own contract and the reason the
  // field never appears to thin out on one side of the screen.
  p = lo + mod(p - lo, span);

  oState = vec4(p, v);
}`;

/**
 * THE DRAW. One instanced quad per mote, oriented along its velocity and
 * stretched by it — the mist's velocity-aligned CAPSULE, which is the arrow of
 * a flow drawn by the motion itself. Off an empty VAO: the quad comes from
 * gl_VertexID and the mote from gl_InstanceID, so there is nothing to bind.
 */
export const AURA_DRAW_VERT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uState;
uniform int uSize;
uniform float uPxUv;   // one CSS pixel, in field units
uniform float uAlpha;  // the layer's master
uniform vec2 uField;
uniform float uMargin;

out vec2 vQuad;
out float vLen;
out float vAlpha;
out vec3 vCol;

${NOISE_GLSL}

// The palette, and nothing else (AGENTS.md rule 8). The vapour is mostly
// cyan-deep - the darkest, least neon member of the family, and the only one
// that can cover a viewport without reading as a light source.
const vec3 DEEP  = vec3(0.000, 0.714, 0.800); // #00B6CC
const vec3 BRAND = vec3(0.000, 0.890, 0.996); // #00E3FE

void main() {
  int i = gl_InstanceID;
  ivec2 tc = ivec2(i - (i / uSize) * uSize, i / uSize);
  vec4 S = texelFetch(uState, tc, 0);
  vec2 p = S.xy;
  vec2 v = S.zw;
  float h1 = lhashf(i, 401);
  float h2 = lhashf(i, 402);
  float h3 = lhashf(i, 403);

  float speed = length(v);
  vec2 dir = speed > 1e-6 ? v / speed : vec2(cos(h1 * 6.2832), sin(h1 * 6.2832));
  float depth = h2; // 0 near . 1 far - the vapour has thickness

  float hs = uPxUv * (${g(AURA.SIZE_PX)} + ${g(AURA.SIZE_VAR)} * h3)
           * (1.0 - 0.3 * depth);
  float len = min(speed * ${g(AURA.STREAK_T)}, ${g(AURA.STREAK_MAX)});

  int vid = gl_VertexID;
  float sx = (vid == 0 || vid == 2) ? -1.0 : 1.0;
  float sy = (vid < 2) ? -1.0 : 1.0;
  float halfLen = hs + len * 0.5;
  vec2 corner = dir * (sx * halfLen) + vec2(-dir.y, dir.x) * (sy * hs);
  vec2 q = p + corner;

  gl_Position = vec4((q / uField) * 2.0 - 1.0, 0.0, 1.0);
  vQuad = vec2(sx * halfLen / hs, sy);
  vLen = halfLen / hs;

  // THE EDGE FADE, entirely inside the off-screen margin: a mote is already at
  // zero before it reaches the wrap, and back to full before it is visible
  // again. None of this is on screen, so the layer has no vignette.
  vec2 lo = vec2(-uMargin);
  vec2 hi = uField + uMargin;
  vec2 fIn = smoothstep(lo, lo + uMargin * 0.75, p);
  vec2 fOut = 1.0 - smoothstep(hi - uMargin * 0.75, hi, p);
  float edge = fIn.x * fIn.y * fOut.x * fOut.y;

  vAlpha = uAlpha * edge
         * (${g(AURA.ALPHA)} + ${g(AURA.ALPHA_VAR)} * h1)
         * (1.0 - ${g(AURA.DEPTH_DIM)} * depth);
  vCol = mix(DEEP, BRAND,
             ${g(AURA.GLOW_MIX)} * smoothstep(0.0, ${g(AURA.SPEED_GLOW)}, speed));
}`;

export const AURA_DRAW_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
in float vLen;
in float vAlpha;
in vec3 vCol;
out vec4 o;
void main() {
  // A capsule: the segment from -(L-1) to +(L-1) along x, radius 1.
  float ax = clamp(vQuad.x, -(vLen - 1.0), vLen - 1.0);
  float d = length(vec2(vQuad.x - ax, vQuad.y));
  float soft = 1.0 - smoothstep(0.25, 1.0, d);
  if (soft < 0.01) discard;
  float a = vAlpha * soft;
  // PREMULTIPLIED, and accumulated ONE/ONE by the caller. The layer composites
  // with mix-blend-mode: screen over an ink page, and screen over black
  // resolves to exactly the premultiplied value - so what is accumulated here
  // is literally the light the reader sees, and two overlapping motes are
  // brighter than one rather than one hiding the other.
  o = vec4(vCol * a, a);
}`;

/**
 * Fail loudly in development if a shader string picked up a non-ASCII
 * character. See the note above: the GL error for this is silent, so without
 * this check the whole layer just quietly falls back to the bare ground and
 * looks like it was never wired up.
 */
export function assertAscii(name, src) {
  const i = [...src].findIndex((ch) => ch.codePointAt(0) > 127);
  if (i >= 0) {
    throw new Error(
      `[aura] ${name} contains a non-ASCII character (${JSON.stringify(
        src.slice(Math.max(0, i - 30), i + 30),
      )}). GLSL ES rejects these, comments included.`,
    );
  }
}

/** Texture edge for a tier; the population is its square. */
export function auraSize(tier) {
  return tier === "lite" ? AURA.SIZE_LITE : AURA.SIZE_FULL;
}
