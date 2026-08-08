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
// + 12 ambient lava-lamp droplets (the site-wide atmosphere) + 14 pinch-off
// satellites (fluid-core spray, R5-B) + probe/margin. Pure loop bound — the
// rest render (count 0) is unaffected by the budget.
export const SDF_BALL_MAX = 80;
// Two vec2 velocity samples are packed into each vec4. This keeps the opt-in
// shape prototype inside WebGL2's conservative fragment-uniform budget while
// preserving one stable velocity vector for every packed ball slot.
export const SDF_BALL_VELOCITY_PACKED = Math.ceil(SDF_BALL_MAX / 2);

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

// The ball-sum loop, generated ONCE for both field variants so the T
// arithmetic can never drift between them: the byte-exact rest contract
// rides on liquidField and liquidFieldZ computing bit-identical T. The Z
// variant only ADDS a parallel depth accumulator (extra ops, same T chain).
const BALL_LOOP = (withZ, withShape = false) => {
  // The field-weighted velocity is only worth accumulating on the main sample,
  // exactly like zAvg: the four gradient taps use the plain variant and must
  // stay cheap. Forms contribute to T carrying no velocity, so a resting form
  // dilutes the average to zero on its own — the strain optics fade out under
  // solid liquid without needing a second guard.
  const accumV = withZ && withShape;
  return `
  float T = formOnlyField(uv);
  float formD = GOO * (inversesqrt(max(T, 1e-6)) - 1.0);
  // Droplets should bulge/merge at the edge, but once they are under a solid
  // form surface they must not sculpt visible circular normals inside the body.
  float formShield = smoothstep(-FORM_SHIELD_INNER, -FORM_SHIELD_EDGE, formD);
  ${withZ ? "float zw = 0.0;" : ""}${accumV ? "\n  vec2 vw = vec2(0.0);" : ""}
  for (int i = 0; i < ${SDF_BALL_MAX}; i++) {
    if (i >= iBallCount) break;
    vec3 b = iBalls[i];
    vec2 dv = uv - b.xy;
    float core = max(b.z * BALL_CORE, 1e-4);
    ${
      withShape
        ? `vec2 velocity = ballVelocity(i);
    float d2;
    // iBallShape == 0 is a deliberately separate identity path: the exact
    // signed-off circle metric remains byte-for-byte the original expression.
    if (iBallShape > 0.0) {
      float speed = length(velocity);
      vec2 axis = speed > 1e-5 ? velocity / speed : vec2(1.0, 0.0);
      vec2 normal = vec2(-axis.y, axis.x);
      // Area-preserving ellipse: motion stretches the leading axis while the
      // perpendicular axis contracts by the reciprocal amount.
      float amount = smoothstep(SHAPE_SPEED_MIN, SHAPE_SPEED_MAX, speed)
                   * SHAPE_STRETCH * iBallShape;
      float stretch = 1.0 + amount;
      float along = dot(dv, axis) / stretch;
      float across = dot(dv, normal) * stretch;
      d2 = max(along * along + across * across, core * core);
    } else {
      d2 = max(dot(dv, dv), core * core);
    }`
        : "float d2 = max(dot(dv, dv), core * core);"
    }
    float cut2 = (REACH * b.z) * (REACH * b.z);
    float win = 1.0 - smoothstep(0.30 * cut2, cut2, d2); // bounded influence
    ${
      withZ
        ? `float fb = (b.z * b.z) / d2 * win * formShield;
    T += fb;
    zw += fb * iBallZ[i];${accumV ? "\n    vw += fb * velocity;" : ""}`
        : `T += (b.z * b.z) / d2 * win * formShield;`
    }
  }`;
};

const makeGlassFrag = (withShape = false) => `#version 300 es
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
${
  withShape
    ? `uniform vec4 iBallVelocity[${SDF_BALL_VELOCITY_PACKED}]; // two packed xy velocities / vec4
uniform float iBallShape;      // 0 = exact circular metric; 1 = velocity-aligned free drops
uniform float iStrain;         // deformation OPTICS master. 0 = exact identity (every
                               //     term below is mul-by-0 / mix-by-0 / pow-by-1), so
                               //     the shape build still renders the locked material
                               //     until this is explicitly dialled in.`
    : ""
}
uniform float iGlass;          // 1 = liquid glass · 0 = flat cyan (lite tier; mirrors
                               //     the locked field-shader flat branch). SET EXPLICITLY.
uniform float iMute;           // 0 = brand cyan … 1 = desaturated toward paper-dim
                               //     (S3 scatter, improvement-plan R1 — fragments read broken)
uniform vec2 iFormOff;         // form-domain offset (uv units; full-bleed staging — the
                               //     form can sit off-centre while droplets roam the field)
uniform float iFormScale;      // form-domain scale (≤0 is treated as 1). Distances stay
                               //     form-local, so bevel/warp/erosion scale WITH the form.
// ── R5-C grade (spec §10.2): every uniform below DEFAULTS TO 0 = exact
// identity (mul-by-1 / add-0 / div-by-1 forms only), so consumers that never
// set them (the deterministic QA stills) and ?fgrade=0 render byte-identical
// to the locked pre-optics output. ────────────────────────────────────────────
uniform float iBallZ[${SDF_BALL_MAX}]; // per-ball depth, 0 = near … 1 = far
uniform float iExpo;           // exposure DELTA: col ×= 1+iExpo (score-driven)
uniform float iKey;            // additive key-light boost (score-driven; the
                               //     locked key direction is NEVER re-aimed)
uniform float iAbsorb;         // internal absorption strength (stage grade)
uniform float iDepthFx;        // depth-band strength (stage grade)

in vec2 vUv;
out vec4 o;

const float GOO = ${SDF_GOO.toFixed(4)};          // form falloff depth (see exports)
const float REACH = ${SDF_BALL_REACH.toFixed(2)}; // ball influence window, × its radius
const float BALL_CORE = 0.18;                     // spike cap as a fraction of radius
const float FORM_SHIELD_INNER = 0.055;            // buried droplets stop embossing here
const float FORM_SHIELD_EDGE = 0.010;             // edge/outside droplets still merge
${
  withShape
    ? `const float SHAPE_SPEED_MIN = 0.055;               // uv/s: reject idle/filter noise
const float SHAPE_SPEED_MAX = 0.850;               // uv/s: full deformation response
const float SHAPE_STRETCH = 0.42;                  // max major-axis growth (42%)
// ── deformation OPTICS (all scaled by iStrain; 0 = the locked material) ──────
const float STRAIN_SPEC = 0.55;   // highlight smears along the flow axis
const float STRAIN_THIN = 0.40;   // stretched liquid is thinner → less absorption
const float STRAIN_LEAD = 0.85;   // the compressed leading edge lights up
const float STRAIN_FLOW = 0.16;   // internal light dragged along the flow
const float STRAIN_FREQ = 38.0;   // spatial rate of the internal striations

// Velocity vectors are packed in vec4s to avoid spending one uniform vector
// per vec2 array entry on conservative WebGL2 implementations.
vec2 ballVelocity(int i) {
  int pair = i / 2;
  vec4 packed = iBallVelocity[pair];
  return (i - pair * 2) == 0 ? packed.xy : packed.zw;
}`
    : ""
}

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
  ${BALL_LOOP(false, withShape)}
  return T;
}

// main-sample variant (R5-C): the same field, plus the field-weighted average
// of per-ball depth. Forms weigh z toward 0 (near) by construction, so necks
// between near and far liquid grade smoothly. Only main() pays for it — the
// four gradient taps use the plain variant.
${
  withShape
    ? `// The shape build also returns the field-weighted velocity, which is what
// lets the MATERIAL know it is being deformed rather than merely repositioned.
float liquidFieldZ(vec2 uv, out float zAvg, out vec2 vAvg) {
  ${BALL_LOOP(true, withShape)}
  float inv = 1.0 / max(T, 1e-6);
  zAvg = zw * inv;
  vAvg = vw * inv;
  return T;
}`
    : `float liquidFieldZ(vec2 uv, out float zAvg) {
  ${BALL_LOOP(true, withShape)}
  zAvg = zw / max(T, 1e-6);
  return T;
}`
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
  // same transform as dAt(), via the z-averaging variant (R5-C): d is
  // bit-identical; zAvg only feeds the iDepthFx-gated grade below
  float zAvg;
${
  withShape
    ? `  vec2 vAvg;
  float d = GOO * (inversesqrt(max(liquidFieldZ(uv, zAvg, vAvg), 1e-6)) - 1.0);`
    : `  float d = GOO * (inversesqrt(max(liquidFieldZ(uv, zAvg), 1e-6)) - 1.0);`
}

  // crisp anti-aliased coverage — the form is defined strictly by fill (no
  // halo). fwidth is CLAMPED: at a ball's bounded-influence edge the windowed
  // field truncates and d explodes across one pixel — unclamped, the reversed
  // smoothstep degenerates to ~0.5 alpha and paints a phantom disc at every
  // ball's reach boundary (visible as a dark film around droplet fields).
  float aa = min(fwidth(d), 0.02) + 1e-5;
  float fill = smoothstep(aa, -aa, d);
  if (fill < 0.0015) { o = vec4(0.0); return; }       // outside / holes = pure black

  // ── flat cyan (lite tier) — mirrors the locked field-shader flat branch ──────
  if (iGlass < 0.5) {
    vec3 base = mix(vec3(0.0, 0.890, 0.996), vec3(0.33, 0.38, 0.40), iMute); // #00E3FE
    o = vec4(base, fill);
    return;
  }

${
  withShape
    ? `  // ── DEFORMATION STATE ────────────────────────────────────────────────────────
  // How hard this piece of liquid is being pulled, and along what axis. Forms
  // carry no velocity into the weighted average, so solid liquid reports zero
  // strain and keeps the locked material exactly.
  //
  // The dome is deliberately NOT re-derived from strain: the ellipse metric
  // already bent the field that produced d, so thickness has responded to the
  // deformation once. What follows is only what the geometry cannot say by
  // itself — how light behaves inside a volume that is being drawn out.
  float flowSpeed = length(vAvg);
  vec2 flowDir = flowSpeed > 1e-6 ? vAvg / flowSpeed : vec2(1.0, 0.0);
  float strain = clamp(smoothstep(SHAPE_SPEED_MIN, SHAPE_SPEED_MAX, flowSpeed)
                       * iStrain, 0.0, 1.0);
`
    : ""
}  // rounded dome from the TRUE edge distance — same dome model as the metaball
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
${
  withShape
    ? `  // A surface being drawn out along one axis has its curvature flattened along
  // that axis, and a flatter surface holds a reflection over a wider angle. So
  // the tight highlight SMEARS down the flow and stays tight across it — the
  // single cue that most separates stretching liquid from a moving disc.
  // Exactly pow(sp, 26.0) when strain is 0.
  float alongFlow = dot(gdir, flowDir);
  float specAniso = 1.0 - STRAIN_SPEC * strain * alongFlow * alongFlow;
  float spec  = pow(sp, 26.0 * specAniso);              // tight wet highlight
  float sheen = pow(sp, 4.0) * 0.20;                    // broad sheen
  float fres  = pow(1.0 - max(n.z, 0.0), 2.6) * 0.50;   // fresnel rim (depth, no halo)
  // The leading face is compressed by its own travel; the trailing face is
  // rarefied. Only the front brightens, which is what gives a moving droplet a
  // direction instead of a uniform glow.
  fres *= 1.0 + STRAIN_LEAD * strain * clamp(alongFlow, 0.0, 1.0);`
    : `  float spec  = pow(sp, 26.0);                          // tight wet highlight
  float sheen = pow(sp, 4.0) * 0.20;                    // broad sheen
  float fres  = pow(1.0 - max(n.z, 0.0), 2.6) * 0.50;   // fresnel rim (depth, no halo)`
}

  vec3 deep = vec3(0.000, 0.714, 0.800);               // #00B6CC
  vec3 lite = vec3(0.302, 0.925, 1.000);               // #4DECFF
  vec3 col = mix(deep, lite, diff);                    // body gradient
  col += vec3(1.0) * spec;                             // white-hot highlight
  col += lite * sheen;                                 // cyan sheen
  col += vec3(0.6, 0.95, 1.0) * fres;                  // glassy rim${
    withShape
      ? `
  // Internal light, dragged. Striations run ACROSS the flow (the phase advances
  // along it) and are advected by iTime, so the interior of a stretching body
  // slides through itself instead of translating rigidly — refraction read as
  // moving structure rather than a static texture. Masked to the interior so it
  // never touches the silhouette, and it adds exactly 0 at strain 0.
  float interior = smoothstep(0.0, 0.055, inside);
  float striation = sin(dot(uv, flowDir) * STRAIN_FREQ - iTime * 2.6) * 0.5 + 0.5;
  col += lite * (STRAIN_FLOW * strain * interior * striation);`
      : ""
  }

  // scatter desaturation (S3): drain the cyan toward a dim grey liquid — the
  // shading shape survives so droplets still read as glass, just lifeless.
  col = mix(col, vec3(0.34, 0.40, 0.42) * (0.55 + 0.45 * diff), iMute);

  // ── R5-C GRADE (all EXACT identity at the 0 uniform defaults) ───────────────
  // depth bands: far liquid reads as dimmer sub-surface MATERIAL — a pure
  // scalar dim (same hue; spec/sheen sink proportionally), never a new color
  col *= 1.0 - 0.62 * clamp(zAvg, 0.0, 1.0) * iDepthFx;
  // internal absorption (Beer-Lambert stand-in, exact 1 at iAbsorb 0): red
  // drains fastest with interior depth — thick cores read as dense water
${
  withShape
    ? `  // Stretch conserves volume, so liquid drawn out along one axis is THINNER
  // through the view axis, and thinner liquid absorbs less: a body under strain
  // becomes visibly more transparent and recovers its density as it settles.
  // This is the one place thickness is not already implied by the field.
  float insideFx = inside * (1.0 - STRAIN_THIN * strain);
  col /= vec3(1.0) + vec3(0.9, 0.45, 0.30) * (iAbsorb * insideFx / (insideFx + 0.12));`
    : `  col /= vec3(1.0) + vec3(0.9, 0.45, 0.30) * (iAbsorb * inside / (inside + 0.12));`
}
  // score-driven light: iKey only LIFTS the highlights the locked key already
  // computed (never re-aims); exposure rides last — the camera, not the light
  col += (vec3(1.0) * spec + lite * (sheen + 0.10 * diff)) * iKey;
  col *= 1.0 + iExpo;

  o = vec4(col, fill);                                 // straight alpha = coverage
}`;

// The default shader retains the original uniform budget and circular field.
// Only the explicit review URL compiles the additional packed-velocity path,
// so low-end/default devices pay neither its uniforms nor its branch cost.
export const SDF_GLASS_FRAG = makeGlassFrag(false);
export const SDF_GLASS_FRAG_SHAPE = makeGlassFrag(true);

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
// The deterministic stills force iWarp to 0 for rest states, so this is a live-
// page dial only and never reaches the byte gate.
export const SDF_WARP_REST = 0.0082;
// Warp amplitude at the PEAK of a melt — the leaving/landing form agitates.
export const SDF_WARP_MORPH = 0.012;
// How deep a form erodes while dissolving/emerging (frame units). Sized to the
// forms' typical stroke half-thickness (~0.05–0.09): thin features dissolve
// first, thick cores linger as shrinking remnants (the weight drains those).
// Too big and the form vanishes in the first instants of a melt.
export const SDF_MELT_ERODE = 0.085;

// ── R5-C stage grade (the dial-in surface) ────────────────────────────────────
// FieldStage applies these on the live page while the grade is on; the
// deterministic QA stills and ?fgrade=0 leave every grade uniform at its GLSL
// default 0 = exact identity. iExpo/iKey are score-driven per frame instead.
export const SDF_GRADE = {
  ABSORB: 1.1, // internal absorption — thick cores read dense, not painted
  DEPTH: 0.55, // depth bands — far/ambient liquid sinks to a dim sub-surface
};

// Deformation-optics master (iStrain). Only the shape build declares it, and 0
// is an exact bypass of every strain term — so this is the single dial between
// "liquid glass painted on a blob" and "glass that knows it is being pulled".
export const SDF_STRAIN = 1.0;

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
