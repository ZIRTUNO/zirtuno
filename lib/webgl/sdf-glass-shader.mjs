/**
 * SDF-GLASS shader (metaball-morph-spec v1.2 §6.1 + v1.7): renders the owner's
 * EXACT vector forms as LIVING liquid glass — and lets metaball droplets (the
 * cursor, the melt bridge) physically MERGE with them in one shared field.
 *
 * v1.7 unified field (owner amendments — lighting untouched): everything is ONE
 * normalised scalar field with its surface at T = 1:
 *
 *   T(p) = iFormA·S(dA) + iFormB·S(dB) + Σ ρᵢ² / |p − cᵢ|²
 *
 * S maps a form's signed distance onto the SAME inverse-square falloff profile
 * as a metaball, S(d) = (1 + d/GOO)⁻², so the vector form and the droplets sum
 * and NECK into each other like one liquid (the react-bits goo). T is inverted
 * back to a pseudo-distance d' = GOO·(T^−½ − 1) for the shading. With no balls
 * near, d' == d EXACTLY (S round-trips through its own inverse), so the resting
 * silhouette, dome and lighting are bit-identical to the v1.2 static renderer.
 *
 * The melt (v1.2/§3.3, restored): form A's weight drains over the first BRIDGE
 * window while the 48-droplet cloud condenses on its footprint, travels (stagger,
 * radius-leads), and fuses into form B as its weight rises — a single iso-surface
 * the whole time, so the old crossfade double-exposure cannot exist.
 *
 * The lighting block below is byte-for-byte the field-shader glass branch —
 * dome → wrapped diffuse → tight specular (pow 26) → broad sheen → fresnel rim
 * (pow 2.6), no glow. field-shader.mjs stays LOCKED; this mirrors its math.
 * R1 additions AROUND the locked math (improvement-plan): iGlass=0 = the flat
 * cyan lite branch (mirrors the locked field-shader's), iMute = the S3 scatter
 * desaturation toward paper-dim. Both leave the glass math untouched; consumers
 * MUST set iGlass (GLSL defaults it to 0 = flat).
 *
 * Input: R32F textures, R = signed distance in frame units (negative inside,
 * positive in holes/outside). Holes come for free — and stay exact.
 */

// Ball budget: 48 melt droplets (FIELD_N) + 3 cursor droplets (1 + trail 2)
// + 12 ambient lava-lamp droplets (the site-wide atmosphere).
export const SDF_BALL_MAX = 63;

// Form-field falloff depth (frame units): how far a form's liquid "reaches" —
// bigger = softer tail = gooier merging with the cursor. Purely interactional:
// the resting silhouette is exact for ANY value (see d' inversion note above).
export const SDF_GOO = 0.35;

// A ball's field is windowed to zero beyond REACH × its visible radius — the
// bounded-influence guardrail: the form can bulge toward / merge with a droplet,
// never be globally inflated, and the silhouette recovers as soon as it leaves.
export const SDF_BALL_REACH = 7.0;

export const SDF_GLASS_VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

export const SDF_GLASS_FRAG = `#version 300 es
precision highp float;

uniform highp sampler2D iSDF;  // form A: R = signed distance (frame units), < 0 inside
uniform highp sampler2D iSDF2; // form B (melt target; idle while iFormB = 0)
uniform vec2 iRes;             // framebuffer size (px) — uv = fragCoord / iRes
uniform vec2 iTexel;           // 1.0 / SDF texture size (gradient sample offset)
uniform float iThick;          // bevel band width to the flat top (frame units)
uniform float iFormA;          // field weight of form A (1 = resting form, 0 = dissolved)
uniform float iFormB;          // field weight of form B (rises as a melt lands)
uniform float iEroA;           // form A erosion offset (frame units): 0 = exact; growing
                               //     it dissolves the form from its thin edges inward
uniform float iEroB;           // form B erosion: shrinking it to 0 GROWS the form from
                               //     its skeleton outward — the organic emergence
uniform float iTime;           // seconds — drives the liquid domain warp
uniform float iWarp;           // warp amplitude (frame units; 0 = static/exact)
uniform vec3 iBalls[${SDF_BALL_MAX}]; // xy = centre (uv space), z = visible radius (uv units)
uniform int iBallCount;        // active balls (cursor + melt droplets), ≤ ${SDF_BALL_MAX}
uniform float iGlass;          // 1 = liquid glass · 0 = flat cyan (lite tier; mirrors
                               //     the locked field-shader flat branch). SET EXPLICITLY.
uniform float iMute;           // 0 = brand cyan … 1 = desaturated toward paper-dim
                               //     (S3 scatter, improvement-plan R1 — fragments read broken)
uniform vec2 iFormOff;         // form-domain offset (uv units; full-bleed staging — the
                               //     form can sit off-centre while droplets roam the field)
uniform float iFormScale;      // form-domain scale (≤0 is treated as 1). Distances stay
                               //     form-local, so bevel/warp/erosion scale WITH the form.

in vec2 vUv;
out vec4 o;

const float GOO = ${SDF_GOO.toFixed(4)};          // form falloff depth (see exports)
const float REACH = ${SDF_BALL_REACH.toFixed(2)}; // ball influence window, × its radius
const float BALL_CORE = 0.18;                     // spike cap as a fraction of radius
const float FORM_SHIELD_INNER = 0.055;            // buried droplets stop embossing here
const float FORM_SHIELD_EDGE = 0.010;             // edge/outside droplets still merge

// slow large-scale liquid wobble: two sine octaves per axis, time-drifting.
// At iWarp 0 this is the identity → the exact vector silhouette. Applied to the
// FORM textures only — droplets stay crisp under the pointer.
vec2 liquidWarp(vec2 uv) {
  float t = iTime;
  return uv + iWarp * vec2(
    sin(uv.y * 9.2 + t * 0.7) + 0.6 * sin(uv.y * 17.0 - t * 1.1),
    cos(uv.x * 8.1 - t * 0.6) + 0.6 * sin(uv.x * 15.0 + t * 0.9)
  );
}

// signed distance → metaball-profile field, surface (S = 1) exactly at d = 0.
// The inside clamp keeps S finite and monotonic; it only flattens depths beyond
// the dome band, which the shading clamps to the flat top anyway.
float formField(float d) {
  float x = max(1.0 + d / GOO, 0.04);
  return 1.0 / (x * x);
}

float formOnlyField(vec2 uv) {
  float fs = iFormScale <= 0.0 ? 1.0 : iFormScale;
  vec2 fuv = (uv - iFormOff - 0.5) / fs + 0.5; // form-local domain
  vec2 w = clamp(liquidWarp(fuv), vec2(0.0), vec2(1.0));
  return iFormA * formField(texture(iSDF, w).r + iEroA)
       + iFormB * formField(texture(iSDF2, w).r + iEroB);
}

// the ONE liquid: both forms + every droplet, summed before the shared surface.
// Erosion (iEro*) moves each form's boundary CONTINUOUSLY — thin features
// dissolve first / the skeleton emerges first — so a form never pops in or out
// as a whole; the weight (iForm*) only drains the residual tail at the end.
float liquidField(vec2 uv) {
  float T = formOnlyField(uv);
  float formD = GOO * (inversesqrt(max(T, 1e-6)) - 1.0);
  // Droplets should bulge/merge at the edge, but once they are under a solid
  // form surface they must not sculpt visible circular normals inside the body.
  float formShield = smoothstep(-FORM_SHIELD_INNER, -FORM_SHIELD_EDGE, formD);
  for (int i = 0; i < ${SDF_BALL_MAX}; i++) {
    if (i >= iBallCount) break;
    vec3 b = iBalls[i];
    vec2 dv = uv - b.xy;
    float core = max(b.z * BALL_CORE, 1e-4);
    float d2 = max(dot(dv, dv), core * core);
    float cut2 = (REACH * b.z) * (REACH * b.z);
    float win = 1.0 - smoothstep(0.30 * cut2, cut2, d2); // bounded influence
    T += (b.z * b.z) / d2 * win * formShield;
  }
  return T;
}

// unified field → pseudo-distance for the locked shading. Exact inverse of
// formField, so with no balls near this returns the texture's own distance.
float dAt(vec2 uv) {
  return GOO * (inversesqrt(max(liquidField(uv), 1e-6)) - 1.0);
}

void main(){
  // min-dimension-normalised, centred domain: on a SQUARE canvas this is exactly
  // uv = fragCoord/iRes (no change for the hero and the square stages); on a
  // full-bleed canvas the square form domain sits centred and the field extends
  // horizontally — droplets stay round, the form stays proportional.
  float md = min(iRes.x, iRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * iRes) / md + 0.5;
  float d = dAt(uv);

  // crisp anti-aliased coverage — the form is defined strictly by fill (no halo)
  float aa = fwidth(d) + 1e-5;
  float fill = smoothstep(aa, -aa, d);
  if (fill < 0.0015) { o = vec4(0.0); return; }       // outside / holes = pure black

  // ── flat cyan (lite tier) — mirrors the locked field-shader flat branch ──────
  if (iGlass < 0.5) {
    vec3 base = mix(vec3(0.0, 0.890, 0.996), vec3(0.33, 0.38, 0.40), iMute); // #00E3FE
    o = vec4(base, fill);
    return;
  }

  // rounded dome from the TRUE edge distance — same dome model as the metaball
  // glass, with an exact, even bevel.
  float inside = max(-d, 0.0);
  float t = clamp(inside / iThick, 0.0, 1.0);
  float curv = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)); // 0 at rim → 1 at top
  float slope = (1.0 - t) / max(curv, 0.05);                // steep rim, flat top

  // normal: the pseudo-distance gradient points OUTWARD (increasing), no negation
  float dl = dAt(uv - vec2(iTexel.x, 0.0)), dr = dAt(uv + vec2(iTexel.x, 0.0));
  float dn = dAt(uv - vec2(0.0, iTexel.y)), du = dAt(uv + vec2(0.0, iTexel.y));
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

  // scatter desaturation (S3): drain the cyan toward a dim grey liquid — the
  // shading shape survives so droplets still read as glass, just lifeless.
  col = mix(col, vec3(0.34, 0.40, 0.42) * (0.55 + 0.45 * diff), iMute);

  o = vec4(col, fill);                                 // straight alpha = coverage
}`;

// ── Rest-render constants — the SINGLE source for both the live components
// (FieldMorphHero / SdfGlassField) and the capture harnesses, so the sign-off
// sheets render exactly what ships.

// Bevel band (frame units). Tuned so the SDF dome matches the metaball glass
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

// ── Liquid-motion tunables (spec v1.7 — the owner's dial-in surface) ──────────
// Domain-warp amplitude at REST (frame units) — the living wobble on the exact
// vector (≈3 px at the hero size). Raise for more liquid, lower for calmer.
export const SDF_WARP_REST = 0.0055;
// Warp amplitude at the PEAK of a melt — the leaving/landing form agitates.
export const SDF_WARP_MORPH = 0.012;
// How deep a form erodes while dissolving/emerging (frame units). Sized to the
// forms' typical stroke half-thickness (~0.05–0.09): thin features dissolve
// first, thick cores linger as shrinking remnants (the weight drains those).
// Too big and the form vanishes in the first instants of a melt.
export const SDF_MELT_ERODE = 0.085;

// ── Cursor goo (spec v1.7 — the react-bits hover, owner amendment) ────────────
// Visible radius of the lead cursor droplet (uv units of the square stage).
export const CURSOR_R = 0.046;
// Trailing droplets behind the lead (each smaller and laggier). 0 disables.
export const CURSOR_TRAIL_N = 2;
// Follow smoothness — react-bits hoverSmoothness (≈0.05 syrup … 0.15 snappy):
// the per-frame (60 fps) lerp factor toward the pointer, frame-rate corrected.
export const CURSOR_SMOOTH = 0.1;
// Merge reach: a ball's field is windowed to SDF_BALL_REACH × its radius, so the
// cursor's influence is bounded to ≈ CURSOR_R × SDF_BALL_REACH ≈ 0.32 of the stage.
export const CURSOR_INFLUENCE = +(CURSOR_R * SDF_BALL_REACH).toFixed(3);
// The mark deforms least (guardrail): cursor radius is scaled by this while the
// hero rests on the logo. 1 = same as the pillars.
export const CURSOR_INFLUENCE_MARK = 0.72;
