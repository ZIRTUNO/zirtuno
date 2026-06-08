/**
 * The 2D metaball FIELD shader — shared source of truth for the live hero
 * (components/hero/MetaballField.tsx, OGL) and the capture harness
 * (scripts/capture-field.mjs), so what we screenshot is exactly what ships.
 *
 * Engine (metaball-morph-spec §1): the react-bits OGL inverse-square scalar field
 *   total = Σ rᵢ² / |p − cᵢ|²
 * thresholded at a TIGHT iso-level (§2.1) — NOT the retired 3D raymarch and NOT
 * the capsule/smin of trace-icons. Balls live in symbol space [-0.5, 0.5], +y up,
 * mapped to the field by one frame scale.
 *
 * Two looks, switched by iGlass:
 *   0 — flat cyan #00E3FE × coverage (Phase 0 / lite tier / reduced-motion).
 *   1 — liquid GLASS, NO glow halo (Phase 1, §5): dome shading + tight specular +
 *       broad sheen + fresnel rim. Outside the fill = pure black (transparent).
 */

export const FIELD_ISO = 2.2; // authoring iso (symbols.data.mjs) — shader MUST match
export const FIELD_N = 48; // canonical ball budget (spec §3.1)
export const FIELD_FRAME = 1.0; // visible vertical extent in symbol units (zoom)

// WebGL2 / GLSL ES 3.00. OGL's Triangle supplies `position` (vec2) + `uv` (vec2).
export const FIELD_VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

export const FIELD_FRAG = `#version 300 es
precision highp float;

uniform vec2 iRes;            // framebuffer size in pixels
uniform vec3 iBalls[${FIELD_N}];   // x,y = centre (symbol space); z = radius
uniform int  iCount;         // active balls (≤ N)
uniform float iFrame;        // visible vertical extent in symbol units
uniform float iIso;          // iso-level (2.2)
uniform float iGlass;        // 0 = flat cyan, 1 = liquid glass

in vec2 vUv;
out vec4 o;

// inverse-square scalar field: total = Σ r² / |p − c|²
float fieldAt(vec2 q){
  float total = 0.0;
  for (int i = 0; i < ${FIELD_N}; i++) {
    if (i >= iCount) break;
    vec3 b = iBalls[i];
    vec2 d = q - b.xy;
    // 4e-4 floor (≈ρ 0.02) caps each ball's central spike so the field stays
    // smooth at ball centres (no fwidth blow-up → no interior specks); only
    // affects deep interior where total ≫ iso, so the silhouette is unchanged.
    total += (b.z * b.z) / max(dot(d, d), 4e-4);
  }
  return total;
}


void main(){
  float scale = iFrame / iRes.y;                       // symbol units per pixel
  vec2 q = (gl_FragCoord.xy - iRes * 0.5) * scale;     // symbol space, +y up
  float total = fieldAt(q);

  // crisp anti-aliased coverage — the form is defined strictly by fill (no halo)
  float aa = max(fwidth(total), 1e-5);
  float fill = smoothstep(-aa, aa, total - iIso);
  if (fill < 0.0015) { o = vec4(0.0); return; }        // outside = pure black

  // ── flat cyan ───────────────────────────────────────────────────────────
  if (iGlass < 0.5) {
    o = vec4(vec3(0.0, 0.890, 0.996), fill);           // #00E3FE
    return;
  }

  // ── liquid glass (no glow) — §5 ───────────────────────────────────────────
  // Rounded dome confined to a thin band just above the iso-level, so the bevel
  // hugs the true silhouette edge and the whole interior reads as one flat-topped
  // liquid mass (a wide band would expose the field's per-ball interior structure).
  // A densely-authored form keeps that near-iso band smooth all the way round.
  float THICK = 1.6;                                   // bevel band width (field units above iso)
  float t = clamp((total - iIso) / THICK, 0.0, 1.0);
  float curv = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)); // 0 at rim → 1 at top
  float slope = (1.0 - t) / max(curv, 0.05);                // steep rim, flat top

  // normal from the field gradient. Inverse-square gradient points INWARD (toward
  // mass), so negate for an OUTWARD-tilting dome normal.
  vec2 e = vec2(scale * 1.5, 0.0);
  vec2 g = vec2(fieldAt(q + e.xy) - fieldAt(q - e.xy),
                fieldAt(q + e.yx) - fieldAt(q - e.yx));
  vec2 gdir = length(g) > 1e-7 ? -normalize(g) : vec2(0.0, 1.0);
  vec3 n = normalize(vec3(gdir * slope, 1.0));

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
