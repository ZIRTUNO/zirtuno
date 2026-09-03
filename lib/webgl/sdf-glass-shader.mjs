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
 * The default material is a clean brand-cyan wash: a page-wide soft key plus a
 * whisper of surface response, with no rim or centre-weighted texture. iGloss=1
 * preserves the signed-off glass branch byte-for-byte as the review rollback:
 * dome → wrapped diffuse → tight specular → broad sheen → fresnel rim, no glow.
 * iGlass=0 remains the flat cyan lite branch; iMute remains the S3 scatter
 * desaturation toward paper-dim. Consumers MUST set iGlass explicitly (GLSL
 * defaults it to 0 = flat).
 *
 * Input: R32F textures, R = signed distance in frame units (negative inside,
 * positive in holes/outside). Holes come for free — and stay exact.
 */

import { FLUID } from "./fluid-core.mjs";
import { TILE_MAX_ITER, TILE_LIST_W } from "./tile-bin.mjs";

// Ball budget: 48 melt droplets (FIELD_N) + 3 cursor droplets (1 + trail 2)
// + 12 ambient lava-lamp droplets (the site-wide atmosphere) + 14 pinch-off
// satellites (fluid-core spray, R5-B) + probe/margin. Pure loop bound — the
// rest render (count 0) is unaffected by the budget.
//
// This is the UNIFORM-ARRAY path's ceiling and stays where it was: three float
// arrays of this length sit close to WebGL2's guaranteed 224 fragment uniform
// vectors, and a device that only offers the guaranteed minimum must still
// link. The TILED path (below) carries its population in a texture and is not
// bounded by this at all.
export const SDF_BALL_MAX = 80;
// Two vec2 velocity samples are packed into each vec4. This keeps the opt-in
// shape prototype inside WebGL2's conservative fragment-uniform budget while
// preserving one stable velocity vector for every packed ball slot.
export const SDF_BALL_VELOCITY_PACKED = Math.ceil(SDF_BALL_MAX / 2);

/**
 * THE TILED PATH'S POPULATION CEILING (R6).
 *
 * Ball data lives in an RGBA32F texture there, so this is a texture width and
 * an allocation size — not a uniform budget. Measured on an Intel UHD at
 * 1.13 Mpx with the tile list rebuilt and re-uploaded every frame:
 *
 *     48 → 6.8 ms    192 → 8.2 ms    768 → 11.1 ms    1536 → 13.8 ms
 *
 * …against 11.5 ms for 48 droplets on the uniform path. 512 sits comfortably
 * inside the 60 fps budget on the weakest GPU in the test set while leaving
 * room above the population the tiers actually ask for.
 */
export const SDF_BALL_CAP_TILED = 512;

/**
 * The uv distance the four gradient taps sample away from the fragment.
 *
 * gradStep = mix(vec2(softEps), iTexel, iGloss), and softEps is
 * max(0.008, max(iTexel) * 6). At SDF_RES 512 that is 6/512, which is the
 * larger of the two branches — so this is the worst case and the binner's
 * conservative margin. Exported rather than retyped: a tap that reaches outside
 * its tile's list reads a field with droplets missing, and the artefact is a
 * seam on a tile boundary that looks like a shader bug rather than a bin bug.
 */
export const SDF_GRAD_MARGIN = 6 / 512;

// Form-field falloff depth (frame units): how far a form's liquid "reaches" —
// bigger = softer tail = gooier merging with the cursor. Purely interactional:
// the resting silhouette is exact for ANY value (see d' inversion note above).
/**
 * Thickness (frame units) at which internal absorption is half-on.
 *
 * At 0.12 the term saturates almost everywhere inside a fused body, so the
 * WHOLE mass darkened — measured body luminance 130 against flat cyan 181 —
 * and the dark cores had nothing bright to read against. Pushing the knee out
 * keeps thin and mid-thickness liquid at full brand cyan and spends the whole
 * darkening range on genuinely stacked mass, which is the reference look:
 * flat neon cyan with soft dark patches, not a uniformly dimmed blob.
 */
export const SDF_ABSORB_KNEE = 0.45;

export const SDF_GOO = 0.35;

// A ball's field is windowed to zero beyond REACH × its visible radius — the
// bounded-influence guardrail: the form can bulge toward / merge with a droplet,
// never be globally inflated, and the silhouette recovers as soon as it leaves.
export const SDF_BALL_REACH = 7.0;

/**
 * THE MORPH'S SATURATION CEILING — OFF, and here is why it must be.
 *
 * The idea: a morph's 48 droplets are a crowd whose overlap piles up and
 * rounds the body, so bound how much every source beyond the strongest may
 * add. The field becomes
 *
 *   T = max Fi + C * (1 - exp(-(sum Fi - max Fi) / C))
 *
 * which is exact for a single source at any C, so resting forms and lone
 * droplets never move — only overlaps do. It was built, measured and tuned
 * over several passes, and every one of them shipped a different defect.
 *
 * IT CANNOT WORK, and the reason is structural: the overlap that inflates the
 * body is the SAME overlap that holds it together. melt.mjs says it in the
 * BRIDGE_RAMP note — "two droplets only neck while their gap is under 0.83 x
 * radius" — so anything that suppresses the field between neighbours closes
 * those necks. Measured over the eight melts, bodies and largest-connected
 * share at mid-morph:
 *
 *   ceiling      bodies   largest body   circularity
 *   off (sum)      4.9         40%          0.135
 *   4              5.4         29%          0.128
 *   1.5            6.2         25%          0.095
 *   1.0            6.6         25%          0.087
 *   0.6            7.9         19%          0.078
 *
 * The circularity column reads like a win and is a trap: a shattered cloud has
 * an enormous perimeter, so fragmenting the body SCORES AS LESS ROUND. That is
 * exactly how two of these passes were shipped — scripts/tools/melt-shape.mjs
 * now measures connectivity for that reason.
 *
 * So there is no setting on this dial that trades up: it exchanges a swollen
 * body for a broken one. The real lever is the cloud itself — 48 discs sized
 * to cover a thin vector form must overlap heavily, and more, smaller droplets
 * would cover the same silhouette with far less pile-up per neighbour. The
 * tiled path already carries SDF_BALL_CAP_TILED = 512.
 *
 * Left wired, at 0, because 0 is the byte-exact historical sum and the whole
 * apparatus is one uniform: `?fsat=<c>` explores it live without a rebuild.
 */
export const MELT_SAT = 0;

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
/** Concurrent strikes the FORM domain answers. Matches FLUID.SHOCK_SLOTS —
 *  the shader reads the same waves the droplets do, not a second set. */
export const SDF_FORM_SHOCKS = FLUID.SHOCK_SLOTS;

// GLSL literal for a JS number. GLSL has no implicit int → float, so a whole
// number has to reach the source as `2.0`; injecting the constants from FLUID
// rather than retyping them here is what stops a physics retune from moving
// the droplets and leaving the forms answering the old law.
const g = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};

/**
 * THE COMBINATION LAW — how pieces of liquid that overlap add up.
 *
 * Everything in this field used to be summed: T = Σ Fᵢ, surface at T = 1. A sum
 * of inverse-square fields is a union with a POSITIVE BIAS — wherever two
 * sources' tails overlap, T exceeds what either gives alone, so the iso-surface
 * is pushed OUTWARD. The bias is not uniform: it is strongest where sources are
 * densest, which is in concavities, between neighbours and across the necks of
 * thin features — precisely the operator that fills notches and closes holes.
 * That is why every melt inflated into a rounder body than either form it
 * connects (mid-melt circularity 0.115 against the forms' own 0.051).
 *
 * BUT THE PROBLEM WAS NEVER "TWO DROPLETS ADD". Two droplets adding IS the
 * goo — the cursor merging with a form, the pinch-off spray, the ambient
 * family, the necks that make a cloud read as one body all live on it. The
 * problem is FORTY-EIGHT adding. A plain sum cannot tell those apart, and the
 * first fix here could not either: a p-norm (Σ Fⁿ)^(1/n) bounds the crowd by
 * suppressing every overlap equally, so it took the inflation out and the
 * merge with it. Measured, at n = 2 it cost the page's multi-droplet bodies
 * 37-51% of their bulk — the Evolution ring, the confluence balls and the
 * cloud limbs all thinned and started showing their constituent droplets.
 *
 * So the law saturates instead of compressing:
 *
 *   T = max Fᵢ + C · (1 − exp(−(Σ Fᵢ − max Fᵢ) / C))
 *
 * The strongest single source arrives in full, and everything ELSE it overlaps
 * contributes on a curve that is linear at first and flattens toward a ceiling
 * of C. So the first neighbour is worth nearly what it was worth under the sum,
 * and the tenth is worth almost nothing. Same two behaviours, finally
 * separated. Measured against the p-norm at matched roundness it returns
 * 12-26 points more bulk and a wider merge reach.
 *
 * ONE SOURCE ROUND-TRIPS EXACTLY: max = Σ, the excess is 0, exp(0) = 1, so
 * T = F. Every resting form and every lone droplet is byte-identical for any C,
 * and only overlaps move — which is what makes C safe to dial.
 */
const satCombine = (sum, mx) => `fieldCombine(${sum}, ${mx})`;

const BALL_LOOP = (withZ, withShape = false, tiled = false) => {
  // The field-weighted velocity is only worth accumulating on the main sample,
  // exactly like zAvg: the four gradient taps use the plain variant and must
  // stay cheap. Forms contribute to T carrying no velocity, so a resting form
  // dilutes the average to zero on its own — the strain optics fade out under
  // solid liquid without needing a second guard.
  const accumV = withZ && withShape;
  return `
  // The two form slots combine among themselves first, and their RESULT then
  // enters the droplet accumulation as one source. Nesting rather than
  // flattening keeps formOnlyField a plain float — which is what lets the
  // off-GPU sim keep prepareForms/addBalls unchanged — and a single form is
  // still exact either way.
  float formT = formOnlyField(uv);
  float Tsum = formT, Tmax = formT;
  float formD = GOO * (inversesqrt(max(formT, 1e-6)) - 1.0);
  // Droplets should bulge/merge at the edge, but once they are under a solid
  // form surface they must not sculpt visible circular normals inside the body.
  float formShield = smoothstep(-FORM_SHIELD_INNER, -FORM_SHIELD_EDGE, formD);
  ${
    withZ
      ? `float zw = 0.0;
  // Contributor concentration is accumulated beside T, never folded into it:
  // one source gives q=T^2; balanced overlapping sources lower sqrt(q)/T.
  // That makes merges visible without another 80-ball field sample.
  float contributorQ = formT * formT;
  float z2w = 0.0;`
      : ""
  }${accumV ? "\n  vec2 vw = vec2(0.0);" : ""}
  ${
    tiled
      ? `// THE TILE LOOKUP is keyed on gl_FragCoord, not on the uv argument, so all
  // five field evaluations a fragment performs (one liquidFieldZ + four dAt
  // gradient taps) walk the SAME list. That is deliberate on both counts: the
  // lookup is hoisted out of the taps, and the binner already widens every
  // droplet's footprint by SDF_GRAD_MARGIN so an offset tap cannot reach liquid
  // its own tile does not carry.
  ivec2 tile = clamp(ivec2(gl_FragCoord.xy / iTilePx), ivec2(0), iTiles - 1);
  uvec2 tileHead = texelFetch(iTileHead, tile, 0).rg;
  // iBallCount gates the whole list rather than each entry: the binner only
  // ever emits indices below it, so this is belt-and-braces for the empty
  // frame — and it keeps the uniform LIVE, which matters more than it looks.
  // An unused uniform is optimised out, its location becomes null, and the
  // five measurement harnesses that recover droplet data by watching uniform
  // traffic go silent without failing. A gate that measures nothing is worse
  // than one that is red.
  int tileN = iBallCount > 0 ? int(tileHead.y) : 0;
  for (int k = 0; k < ${TILE_MAX_ITER}; k++) {
    if (k >= tileN) break;
    int e = int(tileHead.x) + k;
    int i = int(texelFetch(iTileList, ivec2(e % ${TILE_LIST_W}, e / ${TILE_LIST_W}), 0).r);
    vec4 ballRow = texelFetch(iBallTex, ivec2(i, 0), 0);
    vec3 b = ballRow.xyz;
    float dens = ballRow.w;`
      : `for (int i = 0; i < ${SDF_BALL_MAX}; i++) {
    if (i >= iBallCount) break;
    vec3 b = iBalls[i];
    float dens = iBallDensity[i];`
  }
    vec2 dv = uv - b.xy;
    float core = max(b.z * BALL_CORE, 1e-4);
    ${
      withShape
        ? `vec2 velocity = ${tiled ? "texelFetch(iBallTex, ivec2(i, 1), 0).gb" : "ballVelocity(i)"};
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
        ? `float fb = dens * (b.z * b.z) / d2 * win * formShield;
    Tsum += fb;
    Tmax = max(Tmax, fb);
    float ballZ = ${tiled ? "texelFetch(iBallTex, ivec2(i, 1), 0).r" : "iBallZ[i]"};
    zw += fb * ballZ;
    contributorQ += fb * fb;
    z2w += fb * ballZ * ballZ;${accumV ? "\n    vw += fb * velocity;" : ""}`
        : `float fb = dens * (b.z * b.z) / d2 * win * formShield;
    Tsum += fb;
    Tmax = max(Tmax, fb);`
    }
  }
  float T = ${satCombine("Tsum", "Tmax")};`;
};

const makeGlassFrag = (
  withShape = false,
  withTouch = false,
  tiled = false,
) => `#version 300 es
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
uniform float iFieldSat;       // THE SATURATION CEILING (see the combination law note).
                               //     <= 0 is the EXACT plain sum — the historical field,
                               //     byte for byte — and it is what every frame outside a
                               //     morph uploads. A morph ramps it down from there.
${
  tiled
    ? `// ── R6 TILED DATA PATH ───────────────────────────────────────────────────────
// The population lives in a texture instead of three uniform arrays, which is
// what removes the ceiling: row 0 is (x, y, radius, density), row 1 is
// (depth, velocity.x, velocity.y, —). One texel pair per droplet.
uniform highp sampler2D iBallTex;
// The screen tile grid. iTileHead is (offset, count) per tile; iTileList is one
// flat index array those offsets point into. See lib/webgl/tile-bin.mjs for why
// this beats a fixed-slot-per-tile texture on both bandwidth and correctness.
uniform highp usampler2D iTileHead;
uniform highp usampler2D iTileList;
uniform ivec2 iTiles;          // grid dimensions (tiles)
uniform float iTilePx;         // tile edge in device px
uniform int iBallCount;        // active balls — diagnostics only on this path`
    : `uniform vec3 iBalls[${SDF_BALL_MAX}]; // xy = centre (uv space), z = visible radius (uv units)
uniform int iBallCount;        // active balls (cursor + melt droplets), ≤ ${SDF_BALL_MAX}`
}
${
  withShape
    ? `${tiled ? "" : `uniform vec4 iBallVelocity[${SDF_BALL_VELOCITY_PACKED}]; // two packed xy velocities / vec4\n`}uniform float iBallShape;      // 0 = exact circular metric; 1 = velocity-aligned free drops
uniform float iStrain;         // deformation OPTICS master. 0 = exact identity (every
                               //     term below is mul-by-0 / mix-by-0 / pow-by-1), so
                               //     the shape build still renders the locked material
                               //     until this is explicitly dialled in.`
    : ""
}
uniform float iGlass;          // 1 = liquid glass · 0 = flat cyan (lite tier; mirrors
                               //     the locked field-shader flat branch). SET EXPLICITLY.
uniform float iGloss;          // 1 = signed-off wet GLASS · 0 = CLEAN BRAND CYAN
                               //
                               // iGlass=0 paints one constant colour and deletes every depth
                               // cue. The clean branch instead stays tightly centred on
                               // #00E3FE, using a broad field-level wash and only a tiny
                               // normal response. It does not encode the circumference or
                               // interior thickness of each droplet. iGloss=1 mixes back to
                               // the complete legacy glass material exactly.
uniform float iMute;           // 0 = brand cyan … 1 = desaturated toward paper-dim
                               //     (S3 scatter, improvement-plan R1 — fragments read broken)
${
  withTouch
    ? `uniform vec4 iTouch;           // xy = pointer (field uv) · z = influence radius ·
                               //   w = displacement gain. w = 0 is exact identity.
uniform vec4 iShock[${SDF_FORM_SHOCKS}]; // xy = strike centre · z = front radius ·
                               //   w = displacement amplitude (0 = spent slot)
`
    : ""
}uniform vec2 iFormOff;         // form-domain offset (uv units; full-bleed staging — the
                               //     form can sit off-centre while droplets roam the field)
uniform float iFormScale;      // form-domain scale (≤0 is treated as 1). Distances stay
                               //     form-local, so bevel/warp/erosion scale WITH the form.
// ── R5-C grade (spec §10.2): every uniform below DEFAULTS TO 0 = exact
// identity (mul-by-1 / add-0 / div-by-1 forms only), so consumers that never
// set them (the deterministic QA stills) and ?fgrade=0 render byte-identical
// to the locked pre-optics output. ────────────────────────────────────────────
${tiled ? "// (per-ball depth and density ride in iBallTex on the tiled path)" : `uniform float iBallZ[${SDF_BALL_MAX}]; // per-ball depth, 0 = near … 1 = far`}
// Per-ball field DENSITY, 1 = solid liquid (the identity every resting droplet
// uploads). Liquid that must leave the stage fades this to 0 instead of having
// its radius driven to 0, because two droplets only neck while their gap is
// under 0.83 x radius: draining radius closes that window proportionally, so a
// shrinking mass is GUARANTEED to break into separate beads on its way out, and
// each bead stays fully solid (peak field is 30.9 at every radius) until the
// packer drops it. Density is the channel that actually dissolves — the
// surface recedes from within while neighbours stay merged the whole way.
${tiled ? "" : `uniform float iBallDensity[${SDF_BALL_MAX}];`}
uniform float iExpo;         // exposure DELTA: col ×= 1+iExpo (score-driven)
uniform float iKey;            // additive key-light boost (score-driven; the
                               //     locked key direction is NEVER re-aimed)
uniform float iAbsorb;         // internal absorption strength (stage grade)
uniform float iDepthFx;        // depth-band strength (stage grade)
uniform float iShadow;         // field-native self-shadow/AO master; 0 = exact identity

in vec2 vUv;
out vec4 o;

const float ABSORB_KNEE = ${SDF_ABSORB_KNEE.toFixed(3)}; // thickness at which absorption is half-on
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

${tiled ? `// Velocity rides in iBallTex row 1 on the tiled path — no packing needed,
// which is the vec4 pairing hack retired.` : `// Velocity vectors are packed in vec4s to avoid spending one uniform vector
// per vec2 array entry on conservative WebGL2 implementations.
vec2 ballVelocity(int i) {
  int pair = i / 2;
  vec4 packed = iBallVelocity[pair];
  return (i - pair * 2) == 0 ? packed.xy : packed.zw;
}`}`
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

// THE COMBINATION LAW (see the note in this module's constants). The branch is
// on a UNIFORM, so it is uniform flow — one predicted branch per fragment, not
// a divergence — and iFieldSat <= 0 returns the original expression untouched.
float fieldCombine(float sum, float mx) {
  if (iFieldSat <= 0.0) return sum;
  return mx + iFieldSat * (1.0 - exp(-(sum - mx) / iFieldSat));
}

// signed distance → metaball-profile field, surface (S = 1) exactly at d = 0.
// The inside clamp keeps S finite and monotonic; it only flattens depths beyond
// the dome band, which the shading clamps to the flat top anyway.
float formField(float d) {
  float x = max(1.0 + d / GOO, 0.04);
  return 1.0 / (x * x);
}

${
  withTouch
    ? `// THE FORM ANSWERS THE HAND — and the strike.
//
// A droplet integrates a force through a spring; a form is a static SDF with no
// velocity state of its own, so it answers with that spring's EQUILIBRIUM
// instead: the same spatial profile, taken as a displacement. Displacing the
// sample DOMAIN moves the surface with its normals intact, so the bulge lights
// itself — there is no separate shading term, and the four gradient taps pick
// it up for free because they run through this very function.
//
// Returns a displacement in FIELD uv. Exactly vec2(0.0) when nothing is
// touching, which is what keeps the resting silhouette identical.
vec2 formTouch(vec2 p) {
  vec2 acc = vec2(0.0);

  // The hand: the displacement WELL. Pushed out under the pointer, drawn back
  // at the rim — the same lobes the droplets feel, so the form dents and piles
  // up around the finger instead of simply retreating from it.
  if (iTouch.w > 0.0 && iTouch.z > 0.0) {
    vec2 dv = p - iTouch.xy;
    float d2 = dot(dv, dv);
    float rr = iTouch.z;
    if (d2 < rr * rr) {
      float d = sqrt(d2);
      float q = d / rr;
      float q3 = q * q * q;
      float taper = 1.0 - q3 * q3;
      float outward = exp(-(q - 0.30) * (q - 0.30) * 18.0);
      float back = exp(-(q - 0.70) * (q - 0.70) * 30.0);
      float nearFade = min(q / 0.12, 1.0);
      // A perfect circle is the signature of arithmetic. This slow harmonic
      // keeps the meniscus breathing without turning it into a flower.
      float ang = atan(dv.y, dv.x);
      float lobe = 1.0 + 0.18 * sin(3.0 * ang + iTime * 0.6);
      float radial =
        (outward - ${g(FLUID.CURSOR_RIM)} * back) * taper * nearFade * lobe;
      acc += dv / max(d, 1e-4) * radial * iTouch.w;
    }
  }

  // The strikes: crest out, trough back, travelling. Front radius and decayed
  // amplitude arrive per frame from fluid-core — the TEMPORAL law stays there
  // and only the spatial profile is evaluated here, so the wave crossing a form
  // is the same wave that moved the droplets, not a lookalike.
  for (int k = 0; k < ${SDF_FORM_SHOCKS}; k++) {
    vec4 sk = iShock[k];
    if (sk.w <= 0.0) continue;
    vec2 dv = p - sk.xy;
    float d = length(dv);
    if (d < 1e-5) continue;
    float u = (d - sk.z) / ${g(FLUID.SHOCK_WIDTH)};
    if (u > 2.4 || u < -${g(FLUID.SHOCK_LAG + 2.4)}) continue;
    float crest = exp(-u * u * 1.35);
    float lag = u + ${g(FLUID.SHOCK_LAG)};
    float trough = exp(-lag * lag * 0.9);
    // Per-strike lobing, seeded from the strike's own position. The droplets
    // break their ring with per-droplet arrival jitter; a continuous surface
    // has no equivalent of that, so the form breaks its own with angular
    // harmonics — otherwise a wave crossing solid liquid is a clean circle.
    float seed = fract(sin(dot(sk.xy, vec2(127.1, 311.7))) * 43758.5453) * 6.283;
    float ang = atan(dv.y, dv.x);
    float lobe = 1.0 + ${g(FLUID.SHOCK_IRREG)} *
      (0.62 * sin(3.0 * ang + seed) + 0.38 * sin(5.0 * ang - seed * 1.7));
    acc += dv / d *
      ((crest - ${g(FLUID.SHOCK_RECOIL)} * trough) * max(lobe, 0.0) * sk.w);
  }
  return acc;
}

`
    : ""
}float formOnlyField(vec2 uv) {
  float fs = iFormScale <= 0.0 ? 1.0 : iFormScale;
  vec2 fuv = (uv - iFormOff - 0.5) / fs + 0.5; // form-local domain
${
  withTouch
    ? `  // Divided by fs because the displacement is authored in FIELD uv while fuv
  // is form-local. The branch is deliberate: with nothing touching, the
  // expression above reaches liquidWarp untouched rather than merely
  // arithmetically unchanged.
  vec2 tw = formTouch(uv);
  if (tw != vec2(0.0)) fuv -= tw / fs;
`
    : ""
}  vec2 w = clamp(liquidWarp(fuv), vec2(0.0), vec2(1.0));
  // The two form slots feed the same accumulators as every droplet, so a
  // melt's cross-dissolve is bounded by the same ceiling. melt.mjs measured
  // that swell under the plain sum: "0.82 both sit at ~0.93 and their UNION
  // clears it everywhere, 125% avg".
  float a = iFormA * formField(texture(iSDF, w).r + iEroA);
  float b = iFormB * formField(texture(iSDF2, w).r + iEroB);
  return ${satCombine("a + b", "max(a, b)")};
}

// the ONE liquid: both forms + every droplet, summed before the shared surface.
// Erosion (iEro*) moves each form's boundary CONTINUOUSLY — thin features
// dissolve first / the skeleton emerges first — so a form never pops in or out
// as a whole; the weight (iForm*) only drains the residual tail at the end.
float liquidField(vec2 uv) {
  ${BALL_LOOP(false, withShape, tiled)}
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
float liquidFieldZ(vec2 uv, out float zAvg, out float contributorMix,
                   out float depthSpread, out vec2 vAvg) {
  ${BALL_LOOP(true, withShape, tiled)}
  float inv = 1.0 / max(T, 1e-6);
  zAvg = zw * inv;
  contributorMix = clamp(1.0 - sqrt(max(contributorQ, 0.0)) * inv, 0.0, 1.0);
  depthSpread = sqrt(max(z2w * inv - zAvg * zAvg, 0.0));
  vAvg = vw * inv;
  return T;
}`
    : `float liquidFieldZ(vec2 uv, out float zAvg, out float contributorMix,
                   out float depthSpread) {
  ${BALL_LOOP(true, withShape, tiled)}
  float inv = 1.0 / max(T, 1e-6);
  zAvg = zw * inv;
  contributorMix = clamp(1.0 - sqrt(max(contributorQ, 0.0)) * inv, 0.0, 1.0);
  depthSpread = sqrt(max(z2w * inv - zAvg * zAvg, 0.0));
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
  float contributorMix;
  float depthSpread;
${
  withShape
    ? `  vec2 vAvg;
  float d = GOO * (inversesqrt(max(liquidFieldZ(uv, zAvg, contributorMix, depthSpread, vAvg), 1e-6)) - 1.0);`
    : `  float d = GOO * (inversesqrt(max(liquidFieldZ(uv, zAvg, contributorMix, depthSpread), 1e-6)) - 1.0);`
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
  float deformation = clamp(smoothstep(SHAPE_SPEED_MIN, SHAPE_SPEED_MAX, flowSpeed)
                            * iBallShape, 0.0, 1.0);
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

  // One adaptive gradient serves both materials. Clean cyan samples the field
  // broadly (the recovered low-pass dome); explicit legacy glass selects the
  // original one-texel step exactly. That keeps either path at four dAt calls
  // instead of evaluating both normal models and doubling the 80-ball loop.
  float softEps = max(0.008, max(iTexel.x, iTexel.y) * 6.0);
  vec2 gradStep = mix(vec2(softEps), iTexel, iGloss);
  // normal: the pseudo-distance gradient points OUTWARD (increasing), no negation
  float dl = dAt(uv - vec2(gradStep.x, 0.0)), dr = dAt(uv + vec2(gradStep.x, 0.0));
  float dn = dAt(uv - vec2(0.0, gradStep.y)), du = dAt(uv + vec2(0.0, gradStep.y));
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

  vec3 deep = vec3(0.000, 0.714, 0.800);               // #00B6CC · legacy only
  vec3 lite = vec3(0.302, 0.925, 1.000);               // #4DECFF · legacy only

  // CLEAN MATERIAL — CLAUDE'S ORIGINAL SOFT-DOME TECHNIQUE (May 30), recovered
  // from the edit log after the renderer that contained it was overwritten by
  // the 3D raymarcher. Its important distinction from the later locked glass
  // dome above is the LOW-PASS normal: sample the unified field several texels
  // apart, then lean a broad, shallow dome toward one key. It follows the liquid
  // as a single soft surface instead of tracing the immediate contour, bead
  // boundaries, or medial-axis structure.
  vec3 brand = vec3(0.000, 0.890, 0.996);               // #00E3FE
  float softDepth = clamp(inside / (iThick * 2.2), 0.0, 1.0);
  float softTilt = 0.46 * (1.0 - softDepth);
  vec3 softN = normalize(vec3(gdir * softTilt, 1.0));
  float softDiff = clamp(dot(softN, L), 0.0, 1.0);

  // CLEAN MATERIAL — FLAT NEON CYAN. The body is ONE colour: no dome, no
  // page-wide wash, no rim, no specular, no tonal gradient across the mass.
  //
  // Every attempt to give this material depth by SHADING the surface has been
  // rejected, and correctly so — a dome lights the silhouette, which is what
  // turns a fused body back into a row of visible beads. The depth in this
  // design has never come from the surface. It comes from BEHIND it: the depth
  // grade below dims liquid by its per-droplet z, so masses that sit further
  // back read as soft dark patches beneath a flat neon skin. That is the whole
  // effect, it is already in the field, and shading was only ever burying it.
  vec3 cleanCol = brand;

  // REVIEW ROLLBACK. At iGloss=1 this is the original signed-off glass colour
  // and highlight stack exactly; at 0 none of its rim/specular structure leaks.
  vec3 glassCol = mix(deep, lite, diff);
  glassCol += vec3(1.0) * spec;
  glassCol += lite * sheen;
  glassCol += vec3(0.6, 0.95, 1.0) * fres;
  vec3 col = mix(cleanCol, glassCol, iGloss);${
    withShape
      ? `
  // Internal light, dragged. Striations run ACROSS the flow (the phase advances
  // along it) and are advected by iTime, so the interior of a stretching body
  // slides through itself instead of translating rigidly — refraction read as
  // moving structure rather than a static texture. Masked to the interior so it
  // never touches the silhouette, and it adds exactly 0 at strain 0.
  float interior = smoothstep(0.0, 0.055, inside);
  float striation = sin(dot(uv, flowDir) * STRAIN_FREQ - iTime * 2.6) * 0.5 + 0.5;
  col += lite * (STRAIN_FLOW * strain * interior * striation) * iGloss;`
      : ""
  }

  // scatter desaturation (S3): preserve the selected material's own light
  // model. The clean path keeps the recovered low-pass dome; the explicit
  // legacy-glass path remains byte-identical at iGloss=1.
  float materialDiff = mix(softDiff, diff, iGloss);
  col = mix(col, vec3(0.34, 0.40, 0.42) * (0.55 + 0.45 * materialDiff), iMute);

  // ── DYNAMIC VOLUME SHADOW ──────────────────────────────────────────────────
  // This is self-shadow INSIDE the shared field, never a screen-space/drop
  // shadow. Four continuous cues combine: optical thickness, contributor
  // overlap at merge necks, depth variance where near/far liquid intersects,
  // and (shape build only) a soft trailing compression cue. Every term follows
  // the live field, so merging/splitting changes the shadow without storing a
  // second shadow geometry or revealing the source-droplet circles.
  float shadowSide = 1.0 - smoothstep(0.28, 0.78, softDiff);
  float shadowInterior = smoothstep(0.014, 0.18, inside);
  float ambientOcclusion = shadowInterior * (0.38 + 0.62 * shadowSide);
  float mergeOcclusion = smoothstep(0.055, 0.38, contributorMix)
                       * (1.0 - 0.62 * smoothstep(0.12, 0.30, inside));
  float depthOcclusion = smoothstep(0.025, 0.22, depthSpread)
                       * (0.35 + 0.65 * mergeOcclusion);
${
  withShape
    ? `  // The receding/trailing face falls into shadow as a droplet stretches;
  // it vanishes continuously with speed and is absent on rigid/reduced tiers.
  float deformationOcclusion = deformation
                             * smoothstep(0.06, 0.94, -alongFlow)
                             * (1.0 - smoothstep(0.16, 0.34, inside));`
    : `  float deformationOcclusion = 0.0;`
}
  float volumeShadow = 0.060 * ambientOcclusion
                     + 0.140 * mergeOcclusion
                     + 0.100 * depthOcclusion
                     + 0.080 * deformationOcclusion;
  // Multiplication preserves the cyan family. iShadow=0 is an exact identity,
  // which protects deterministic forms and the ?fgrade=0 pre-optics bypass.
  col *= 1.0 - clamp(volumeShadow * iShadow, 0.0, 0.26);

  // ── R5-C GRADE (all EXACT identity at the 0 uniform defaults) ───────────────
  // Depth and absorption keep their legacy strength under iGloss=1. The clean
  // material retains only a lightweight trace: enough scene depth to support
  // motion, not enough to expose individual droplets. Centre-weighted
  // absorption is fully absent from the clean branch below.
  // THE SHADOW. One strength for both materials — this is the depth cue the
  // whole design rests on, and holding the clean path at 0.10 against legacy's
  // 0.62 capped its darkening at 0.10 x iDepthFx(0.55) = 5.5%, which is
  // invisible. That single number is why the liquid read as flat cyan fill.
  float depthStrength = 0.62;
  col *= 1.0 - depthStrength * clamp(zAvg, 0.0, 1.0) * iDepthFx;
  // internal absorption (Beer-Lambert stand-in, exact 1 at iAbsorb 0): red
  // drains fastest with interior depth — thick cores read as dense water
${
  withShape
    ? `  // Stretch conserves volume, so liquid drawn out along one axis is THINNER
  // through the view axis, and thinner liquid absorbs less: a body under strain
  // becomes visibly more transparent and recovers its density as it settles.
  // This is the one place thickness is not already implied by the field.
  float insideFx = inside * (1.0 - STRAIN_THIN * strain);
  // THE SHADOW. Beer-Lambert internal absorption: liquid darkens by how THICK
  // it is, and interior thickness peaks at every droplet core — so a fused body
  // grows soft round dark patches wherever mass is stacked, and they merge and
  // part with the field itself. This is the depth cue the design has always
  // used. Gating it on iGloss switched it off with the gloss and left a flat
  // neon fill; it belongs to BOTH materials.
  float absorbStrength = 1.0;
  col /= vec3(1.0) + vec3(0.9, 0.45, 0.30) * (absorbStrength * iAbsorb * insideFx / (insideFx + ABSORB_KNEE));`
    : `  // THE SHADOW — see the shape variant above. Both materials, both builds.
  float absorbStrength = 1.0;
  col /= vec3(1.0) + vec3(0.9, 0.45, 0.30) * (absorbStrength * iAbsorb * inside / (inside + ABSORB_KNEE));`
}
  // The score lifts the clean field as a soft cyan wash. It only restores the
  // shape-revealing specular stack on the explicit legacy-glass rollback.
  // The score's key lift. It used to ride the page-wide wash (fieldWash) and a
  // lighter tint (cleanLight); both went with the wash, so it now leans on the
  // brand cyan and the soft normal alone — same magnitude, no dangling refs.
  vec3 cleanKey = mix(brand, vec3(0.120, 0.940, 1.000), 0.24)
                * (0.09 + 0.02 * softDiff);
  vec3 glassKey = vec3(1.0) * spec + lite * (sheen + 0.10 * diff);
  col += mix(cleanKey, glassKey, iGloss) * iKey;
  col *= 1.0 + iExpo;

  o = vec4(col, fill);                                 // straight alpha = coverage
}`;

// The default shader retains the original uniform budget and circular field.
// Only the explicit review URL compiles the additional packed-velocity path,
// so low-end/default devices pay neither its uniforms nor its branch cost.
//
// TOUCH is a separate axis from SHAPE for two reasons. It costs its own
// uniform vectors (1 + SDF_FORM_SHOCKS) on a block already close to WebGL2's
// guaranteed 224, so it belongs in the preference list where the driver
// answers for itself rather than in a prediction. And keeping
// SDF_GLASS_FRAG — the source the deterministic rest stills compile —
// byte-identical is what lets the exact-rest contract stay a claim about
// UNCHANGED CODE instead of a claim about floating point.
export const SDF_GLASS_FRAG = makeGlassFrag(false, false);
export const SDF_GLASS_FRAG_SHAPE = makeGlassFrag(true, false);
export const SDF_GLASS_FRAG_TOUCH = makeGlassFrag(false, true);
export const SDF_GLASS_FRAG_SHAPE_TOUCH = makeGlassFrag(true, true);

// ── R6: the same four sources on the TILED data path ─────────────────────────
// A separate set rather than a replacement, for the reason the shape/touch
// axes are separate: makeLayer takes a PREFERENCE LIST and asks the driver the
// real question by linking the real shader. If a device cannot give us integer
// textures or the extra samplers, it falls through to the uniform-array build
// and renders exactly what it rendered before — and `?ftile=0` picks that path
// deliberately. The field arithmetic is generated from the same BALL_LOOP, so
// the two cannot drift: only where the droplet data is READ from differs.
export const SDF_GLASS_FRAG_TILED = makeGlassFrag(false, false, true);
export const SDF_GLASS_FRAG_SHAPE_TILED = makeGlassFrag(true, false, true);
export const SDF_GLASS_FRAG_TOUCH_TILED = makeGlassFrag(false, true, true);
export const SDF_GLASS_FRAG_SHAPE_TOUCH_TILED = makeGlassFrag(true, true, true);


// ── Rest-render constants — the SINGLE source for both the live components
// (FormStillRenderer / FieldStage) and the capture harnesses, so the sign-off
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
  SHADOW: 1.0, // field-native AO: thickness + merges + z-overlap + deformation
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
