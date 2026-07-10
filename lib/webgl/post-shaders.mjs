/**
 * POST-CHAIN shaders (R5-C, metaball-morph-spec §10.2) — bright pass,
 * separable gaussian blur, and the final opaque composite: selective bloom +
 * blue-noise dither + luminance-gated film grain. The scene shader
 * (sdf-glass-shader) stays LOCKED; everything here happens on its output.
 *
 * The composite is OPAQUE ink-black (§10.2.4): the page behind the canvas is
 * pure #000 (--color-ink), so "over black" reduces to the premultiplied scene
 * plus additive bloom, and the dither smooths the darkest gradients — the
 * 8-bit banding zone — BEFORE quantisation. Both noise terms are gated off
 * flat black, so empty canvas is bit-zero and cannot seam against the page
 * (the .breath-layer CSS noise above the canvas keeps owning the background
 * texture; the grain here lives only on the liquid).
 *
 * Dither/grain source: interleaved gradient noise (Jimenez) — the standard
 * texture-free blue-noise-quality pattern, so no asset ships and the chain
 * stays self-contained.
 */

export const POST_VERT = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

// bright pass (half res, §10.2.2): premultiplied luminance over a soft knee —
// empty pixels (a = 0) contribute nothing, so bloom can only come from liquid
export const POST_BRIGHT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D iScene;
uniform float iTh;   // threshold (luma)
uniform float iKnee; // soft-knee width above the threshold
in vec2 vUv;
out vec4 o;
void main() {
  vec4 s = texture(iScene, vUv);
  vec3 c = s.rgb * s.a;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  o = vec4(c * smoothstep(iTh, iTh + iKnee, l), 1.0);
}`;

// separable gaussian (9-tap via 5 linear-filtered fetches), direction+radius
// premixed into iDir by the chain
export const POST_BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D iTex;
uniform vec2 iDir; // (radius/w, 0) or (0, radius/h)
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(iTex, vUv).rgb * 0.2270270270;
  vec2 o1 = iDir * 1.3846153846;
  vec2 o2 = iDir * 3.2307692308;
  c += texture(iTex, vUv + o1).rgb * 0.3162162162;
  c += texture(iTex, vUv - o1).rgb * 0.3162162162;
  c += texture(iTex, vUv + o2).rgb * 0.0702702703;
  c += texture(iTex, vUv - o2).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

export const POST_COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D iScene; // full-res straight-alpha scene
uniform sampler2D iBloom; // blurred premultiplied brightness (half res)
uniform float iBloomAmt;
uniform float iGrain; // §10.2.6: luminance-gated, ≤ 0.025
uniform float iT;     // seconds — reseeds the grain per frame
in vec2 vUv;
out vec4 o;

// interleaved gradient noise (Jimenez) — near-blue-noise dither quality
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 s = texture(iScene, vUv);
  vec3 bloom = texture(iBloom, vUv).rgb * iBloomAmt;
  // opaque over the pure-black page: premultiplied scene + additive bloom
  vec3 col = s.rgb * s.a + bloom;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // film grain: the liquid breathes; flat black and blown highlights stay
  // silent (double luminance gate)
  float gGate = smoothstep(0.02, 0.30, l) * (1.0 - smoothstep(0.80, 1.25, l));
  vec2 seed = gl_FragCoord.xy + vec2(fract(iT * 0.61) * 89.0, fract(iT * 0.83) * 71.0);
  col += (ign(seed) - 0.5) * iGrain * gGate;
  // blue-noise dither: breaks the 8-bit contours of the dark gradients; the
  // gate keeps untouched background at exactly 0 (no seam, no shimmer)
  float dGate = clamp(s.a * 6.0 + l * 10.0, 0.0, 1.0);
  col += (ign(gl_FragCoord.xy) - 0.5) * (dGate / 255.0);
  o = vec4(col, 1.0);
}`;

// ── the dial-in surface (owner taste rounds tune HERE) ────────────────────────
export const POST = {
  TH: 0.7, // bright-pass threshold — the glass tops and speculars bloom
  KNEE: 0.3, // soft knee above it — no hard bloom cutoff inside a gradient
  AMT: 0.5, // bloom strength in the composite
  RADII: [1.0, 1.9, 3.4], // half-res gaussian iterations — growing spread
  GRAIN: 0.018, // film-grain amplitude (spec ceiling 0.025)
};
