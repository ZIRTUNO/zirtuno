/**
 * THE AURA'S VAPOUR — the atmosphere's live half.
 *
 * WHAT THIS REPLACED, AND WHY. The first aura drew its vapour as a fractal-
 * turbulence SVG translated on a 97s loop. It was cheap and it was WRONG, for
 * the reason the mist's own commit message states better than this one could:
 * a scrubbed animation stops being convincing the moment the reader stops
 * scrolling and simply watches it. Nothing was evolving; a fixed texture was
 * sliding. Utopia513's ground, the reference this whole layer is adapted from,
 * is a fragment shader recomputing every pixel every frame, and that — not its
 * brightness — is the entire difference in how alive it feels.
 *
 * So the vapour is a shader now, and specifically a shader over THE SITE'S OWN
 * CURRENT: `noise-glsl.mjs` is the octave ladder from `noise.mjs`, so this
 * field rides the same eddies as the droplets, one scale coarser and far
 * fainter. The atmosphere is not decoration next to the liquid; it is the same
 * weather, seen from further away.
 *
 * THE SHAPE OF IT. Density is `potential` — the ladder's own fbm, already
 * time-varying — sampled through a domain warp taken from `curlAt`, the same
 * curl the droplets drift on. Warping fbm by curl is what turns round blobs
 * into drawn-out filaments: the field is sheared along the flow, so the shapes
 * are the flow made visible.
 *
 * THEN IT IS THRESHOLDED, which is the step that makes it vapour rather than
 * fog. A full noise field is uniformly cloudy and reads as a grey wash;
 * clipping the low end away leaves only the crests, and disconnected crests are
 * wisps. `uShape.x/.y` are that window.
 *
 * COST. Deliberately tiny: this renders into a quarter-scale buffer and is
 * stretched back up, which is free visually — there is nothing in a vapour
 * field with an edge sharp enough to lose — and costs a sixteenth of the fill.
 * At 1440x900 that is 0.08 Mpx against the liquid's ~1.9, which matters because
 * FieldStage is fill-rate bound and demotes the liquid when frames go long.
 */

import { NOISE_GLSL, POTENTIAL_MAX } from "./noise-glsl.mjs";

const g = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};

/** Fullscreen triangle from gl_VertexID — no buffers, no VAO contents. */
export const AURA_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// EVERY SHADER STRING BELOW IS ASCII-ONLY, AND THAT IS A HARD REQUIREMENT, NOT
// A STYLE. GLSL ES 3.00 restricts its source character set, and ANGLE and
// SwiftShader enforce it INSIDE COMMENTS TOO: a single typographic dash in a
// comment fails the compile, and `getShaderInfoLog` comes back null, so the
// only symptom is a shader that silently refuses to exist. `assertAscii` below
// turns that into a real error in development. Write "-" and "->", never the
// dashes and arrows used everywhere else in this codebase.
export const AURA_FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uAspect;   // scale so the field is not stretched by the viewport
uniform vec3 uTint;     // the cyan the vapour is made of
uniform vec2 uShape;    // (threshold, knee) - the wisp window
uniform float uWarp;    // how hard the curl shears the density

${NOISE_GLSL}

void main() {
  // Field coordinates. Aspect-corrected so a wide monitor gets more weather
  // rather than the same weather stretched sideways.
  vec2 q = vUv * uAspect;

  // The domain warp: shear the sample point along the current. This is what
  // makes filaments instead of blobs - the density is dragged by the flow.
  vec2 c = curlAt(q * 0.5, uTime);
  vec2 w = q + c * uWarp;

  // Density is the ladder's own drifting fbm, read through that warp.
  float d = potential(w.x, w.y, uTime) * ${g(1 / POTENTIAL_MAX)};

  // Remap, NOT a hard threshold, and deliberately not squared.
  //
  // The first tuning did both, and the owner rejected the result on sight: a
  // narrow window plus a squaring is a contrast booster, and it turned the
  // field into cloud MASSES about a third of the screen across with black
  // voids between them. That reads as shapes, and the moment a background has
  // shapes it is something you look at rather than something you are inside.
  // A wide window keeps the field CONTINUOUS - fine structure everywhere, no
  // holes - which is what the static version it replaced got right and the
  // only thing about it that was worth keeping.
  float a = smoothstep(uShape.x, uShape.x + uShape.y, d);

  // Premultiplied: the layer is composited additively over the page's ink, so
  // it may only ever ADD light. It cannot dim the liquid it passes over.
  fragColor = vec4(uTint * a, a);
}`;

/**
 * Fail loudly in development if a shader string picked up a non-ASCII
 * character. See the note above AURA_FRAG: the GL error for this is silent, so
 * without this check the whole layer just quietly falls back to the static
 * vapour and looks like it was never wired up.
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

/**
 * The tuning, in one place.
 *
 * SCALE is in screen-widths: 1.15 puts roughly one coarse eddy across the
 * viewport, which is the size atmosphere wants — small enough to have a
 * direction, large enough that no shape reads as an object.
 *
 * TIME is a multiplier on the ladder's own drift, and it is well under 1 on
 * purpose. `OCT`'s coarse octave advances a full cycle in about 15 s at 1.0;
 * atmosphere that moves at reading speed becomes something you watch, which is
 * the failure mode for a background. At 0.35 it turns over in roughly 45 s —
 * plainly alive if you look, entirely ignorable if you do not.
 *
 * THRESHOLD / KNEE is the wisp window. Raising THRESHOLD thins the field
 * toward isolated filaments; widening KNEE softens them toward haze.
 */
export const AURA = {
  /**
   * Draw the vapour as a LIVE field, or leave the static CSS turbulence that
   * sits under the canvas to be the whole of it.
   *
   * This is a switch and not a decision made in code because it is a taste
   * call, and the two readings are genuinely different rather than better and
   * worse. `false` is the calmer ground - smooth, even, entirely inert.
   * `true` is the same ground with weather in it, on the site's own current.
   * Everything else in this file only matters when it is `true`; the fallback
   * path has to work regardless, because a refused context lands on it anyway.
   */
  LIVE: true,
  SCALE: 1.9,
  TIME: 0.35,
  WARP: 0.026,
  THRESHOLD: 0.2,
  KNEE: 0.72,
  /** Backing-store scale. Quarter-res: a sixteenth of the fill, no visible loss. */
  RES: 0.25,
  /** Update rate. The field turns over in ~45 s; 30 fps is imperceptible on it
   *  and halves the cost outright. */
  FPS: 30,
};
