/**
 * SDF-GLASS shader (metaball-morph-spec v1.2 §6.1 + v1.6): renders the owner's
 * EXACT vector forms as LIVING liquid glass, by feeding the SVGs' signed-distance
 * fields into the SAME locked glass-shading math as the metaball field
 * (field-shader.mjs).
 *
 * v1.6 field source (lighting untouched): the field is a BLEND of two SDF
 * textures (iSDF → iSDF2 by iMix — the morph: level sets melt organically from
 * one exact form to the other), sampled through a slow procedural DOMAIN WARP
 * (iWarp, iTime — the liquid is alive at rest and agitated mid-melt) with a
 * mid-melt PINCH (iPinch shrinks the field so thin necks break into droplets
 * and reform — the gooey split). At iMix=0, iWarp=0 this is exactly the v1.2
 * static renderer (all new uniforms default to 0 → existing users unchanged).
 *
 * The lighting block below is byte-for-byte the field-shader glass branch —
 * dome → wrapped diffuse → tight specular (pow 26) → broad sheen → fresnel rim
 * (pow 2.6), no glow. field-shader.mjs stays LOCKED; this mirrors its math.
 *
 * Input: R32F textures, R = signed distance in symbol units (negative inside,
 * positive in holes/outside). Holes come for free — and stay exact.
 */

export const SDF_GLASS_VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

export const SDF_GLASS_FRAG = `#version 300 es
precision highp float;

uniform highp sampler2D iSDF;  // form A: R = signed distance (symbol units), < 0 inside
uniform highp sampler2D iSDF2; // form B (morph target; unused while iMix = 0)
uniform vec2 iRes;             // framebuffer size (px) — uv = fragCoord / iRes
uniform vec2 iTexel;           // 1.0 / SDF texture size (gradient sample offset)
uniform float iThick;          // bevel band width to the flat top (symbol units)
uniform float iMix;            // 0 = form A … 1 = form B (the melt)
uniform float iTime;           // seconds — drives the liquid domain warp
uniform float iWarp;           // warp amplitude (symbol units; 0 = static/exact)
uniform float iPinch;          // mid-melt erosion (+ shrinks; necks split into droplets)

in vec2 vUv;
out vec4 o;

// slow large-scale liquid wobble: two sine octaves per axis, time-drifting.
// At iWarp 0 this is the identity → the exact vector silhouette.
vec2 liquidWarp(vec2 uv) {
  float t = iTime;
  return uv + iWarp * vec2(
    sin(uv.y * 9.2 + t * 0.7) + 0.6 * sin(uv.y * 17.0 - t * 1.1),
    cos(uv.x * 8.1 - t * 0.6) + 0.6 * sin(uv.x * 15.0 + t * 0.9)
  );
}

float sdfAt(vec2 uv) {
  vec2 w = clamp(liquidWarp(uv), vec2(0.0), vec2(1.0));
  float a = texture(iSDF, w).r;
  float b = texture(iSDF2, w).r;
  return mix(a, b, iMix) + iPinch;
}

void main(){
  vec2 uv = gl_FragCoord.xy / iRes;   // resolution-independent (texture may differ in size)
  float d = sdfAt(uv);

  // crisp anti-aliased coverage — the form is defined strictly by fill (no halo)
  float aa = fwidth(d) + 1e-5;
  float fill = smoothstep(aa, -aa, d);
  if (fill < 0.0015) { o = vec4(0.0); return; }       // outside / holes = pure black

  // rounded dome from the TRUE edge distance (the SDF) — same dome model as the
  // metaball glass, but with an exact, even bevel.
  float inside = max(-d, 0.0);
  float t = clamp(inside / iThick, 0.0, 1.0);
  float curv = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)); // 0 at rim → 1 at top
  float slope = (1.0 - t) / max(curv, 0.05);                // steep rim, flat top

  // normal: the SDF gradient points OUTWARD (increasing distance), so no negation
  float dl = sdfAt(uv - vec2(iTexel.x, 0.0)), dr = sdfAt(uv + vec2(iTexel.x, 0.0));
  float dn = sdfAt(uv - vec2(0.0, iTexel.y)), du = sdfAt(uv + vec2(0.0, iTexel.y));
  vec2 g = vec2(dr - dl, du - dn);
  vec2 gdir = length(g) > 1e-7 ? normalize(g) : vec2(0.0, 1.0);
  vec3 n = normalize(vec3(gdir * slope, 1.0));

  // ── EXACT field-shader.mjs glass lighting (locked — keep in sync) ─────────────
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.42, 0.72, 0.55));          // key light, upper-left
  float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);  // wrapped diffuse
  vec3 Rfl = reflect(-L, n);
  float sp = max(dot(Rfl, V), 0.0);
  float spec  = pow(sp, 26.0);                          // tight wet highlight
  float sheen = pow(sp, 4.0) * 0.20;                    // broad sheen
  float fres  = pow(1.0 - max(n.z, 0.0), 2.6) * 0.50;   // fresnel rim (depth, no halo)

  vec3 deep = vec3(0.000, 0.714, 0.800);               // #00B6CC
  vec3 lite = vec3(0.302, 0.925, 1.000);               // #4DECFF
  vec3 col = mix(deep, lite, diff);                    // body gradient
  col += vec3(1.0) * spec;                             // white-hot highlight
  col += lite * sheen;                                 // cyan sheen
  col += vec3(0.6, 0.95, 1.0) * fres;                  // glassy rim

  o = vec4(col, fill);                                 // straight alpha = coverage
}`;

// ── Rest-render constants — the SINGLE source for both the live component
// (components/hero/SdfGlassField) and the capture harness (scripts/capture-sdf),
// so the sign-off sheet renders exactly what ships.

// Bevel band (symbol units). Tuned so the SDF dome matches the metaball glass
// bevel proportion; overridable per render.
export const SDF_THICK = 0.1;
// SDF texture resolution. 512 is visually sufficient (sheet-verified) and keeps
// the main-thread EDT build cheap (~590k → ~260k px).
export const SDF_RES = 512;
// Content fills this fraction of the frame (margin for the glass rim).
export const SDF_DRAW = 0.82;
// SDF smoothing radius in px at SDF_RES (removes the medial-axis crease so the
// dome reads as one smooth liquid; the zero-contour stays sub-pixel crisp).
export const SDF_BLUR = 3;

// ── v1.6 liquid-motion constants (the warped-SDF hero) ────────────────────────
// Domain-warp amplitude at REST (symbol units) — a subtle living wobble that
// keeps the form unmistakably the exact vector (≈2 px at the hero size).
export const SDF_WARP_REST = 0.004;
// Warp amplitude at the PEAK of a melt — the liquid visibly agitates in motion.
export const SDF_WARP_MORPH = 0.018;
// Mid-melt erosion peak (symbol units, +shrinks): thin connections pinch apart
// into droplets and reform on arrival — the gooey split of the melt.
export const SDF_PINCH = 0.014;
