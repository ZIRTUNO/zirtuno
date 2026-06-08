/**
 * SDF-GLASS shader (metaball-morph-spec Update v1.2 + §6.1): renders a crisp vector
 * form (SVG) as liquid glass at REST, by feeding the SVG's signed-distance field
 * into the SAME locked glass-shading math as the metaball field (field-shader.mjs).
 *
 * Why a second source: the additive metaball field can't hold images-2/3's fine
 * holes (ai fissure, software brackets, the mark's counter+pupil). The SVG's SDF
 * gives an EXACT silhouette + exact holes (straight from the alpha), while the
 * lighting below is byte-for-byte the field-shader glass branch — dome → wrapped
 * diffuse → tight specular (pow 26) → broad sheen → fresnel rim (pow 2.6), no glow —
 * so a form looks identical in MATERIAL whether drawn by metaballs (morph) or by
 * this SDF (rest). field-shader.mjs stays LOCKED; this mirrors its math.
 *
 * Input: an R32F texture, one texel per pixel, R = signed distance in symbol units
 * (negative inside the shape, positive in holes/outside). Holes come for free.
 */

export const SDF_GLASS_VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

export const SDF_GLASS_FRAG = `#version 300 es
precision highp float;

uniform highp sampler2D iSDF; // R = signed distance (symbol units), < 0 inside
uniform vec2 iRes;            // framebuffer size (px) — uv = fragCoord / iRes
uniform vec2 iTexel;          // 1.0 / SDF texture size (gradient sample offset)
uniform float iThick;         // bevel band width to the flat top (symbol units)

in vec2 vUv;
out vec4 o;

float sdfAt(vec2 uv) {
  return texture(iSDF, clamp(uv, vec2(0.0), vec2(1.0))).r;
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

// Default bevel band (symbol units). Tuned so the SDF dome matches the metaball
// glass bevel proportion; overridable per render.
export const SDF_THICK = 0.1;
