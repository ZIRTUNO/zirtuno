/**
 * LAB — the liquid ribbon.
 *
 * The reference hero anchors its whole composition on a wide iridescent sheet
 * that folds and flows across the bottom of the stage. Its rainbow thin-film is
 * off-brand for Zirtuno, so this keeps the STRUCTURE — a folded liquid sheet
 * with hard specular ridges, deep voids between folds and a slow internal
 * current — and rebuilds the material in the brand's cyan-on-black range.
 *
 * The surface is a stack of four height fields composited back to front. Each
 * layer carries its own crest, phase and drift, so the folds slide over one
 * another and the silhouette never repeats. Shading is analytic: the slope of
 * the height field IS the normal, so a ridge lights up exactly where the sheet
 * turns toward the key light.
 *
 * Raw WebGL2, one quad, no dependencies.
 */

export const RIBBON_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const RIBBON_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uEnter;   // 0..1 entry reveal — the sheet floods in from the floor
uniform float uPointer; // -1..1 horizontal pointer bias
uniform float uEnergy;  // 0..1 extra swell (scroll / interaction)

const vec3 INK       = vec3(0.0);
const vec3 CYAN_DEEP = vec3(0.000, 0.408, 0.470);
const vec3 CYAN      = vec3(0.000, 0.890, 0.996);
const vec3 CYAN_GLOW = vec3(0.302, 0.925, 1.000);
const vec3 PAPER     = vec3(0.949, 0.941, 0.921);

// ── value noise / fbm (cheap, no texture) ──────────────────────────────────
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  // three octaves, not five: this is called twice per layer across four layers,
  // so every octave costs eight fbm evaluations per pixel. The lost detail sits
  // below the blur the material already has.
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

// One fold's height at x. Three octaves of travelling sine keep the crest
// organic without ever looping visibly.
float crest(float x, float t, float seed) {
  float h = 0.0;
  h += 0.55 * sin(x * 2.1 + t * 0.42 + seed * 6.28);
  h += 0.28 * sin(x * 3.7 - t * 0.31 + seed * 3.11);
  h += 0.17 * sin(x * 6.3 + t * 0.55 + seed * 9.42);
  return h;
}

// the surface height of layer i, in uv-y
float layerY(float x, float t, float base, float amp, float seed) {
  return base + amp * crest(x, t, seed);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  float x = uv.x * aspect;
  float t = uTime;

  // the entry: the sheet floods up from below the floor and settles
  float enter = clamp(uEnter, 0.0, 1.0);
  float rise = mix(-0.55, 0.0, enter * enter * (3.0 - 2.0 * enter));

  vec3 col = INK;
  float coverage = 0.0;
  float topGlow = 0.0;

  // BACK TO FRONT — four folds. Each is darker and flatter behind, brighter
  // and sharper in front, which is what reads as depth in the reference.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float depth = fi / 3.0;                     // 0 = far, 1 = near
    float seed = 0.37 * fi + 0.11;
    float base = 0.30 + 0.13 * depth + rise + 0.05 * uEnergy * depth;
    float amp = (0.085 + 0.052 * depth) * mix(0.75, 1.0, enter);

    // pointer parallax — nearer folds slide further, so the sheet has volume
    float px = x + uPointer * 0.07 * (0.25 + depth);

    float h = layerY(px, t * (0.7 + 0.5 * depth), base, amp, seed);
    float dh = (layerY(px + 0.01, t * (0.7 + 0.5 * depth), base, amp, seed) - h) / 0.01;

    // inside the fold?
    float edge = h - uv.y;
    float aa = 1.5 / uRes.y;
    float inside = smoothstep(-aa, aa, edge);
    // the glow this fold throws upward — gathered here so the atmosphere pass
    // does not have to rebuild every height field a second time
    topGlow = max(topGlow, smoothstep(0.20, 0.0, -edge));
    if (inside <= 0.001) continue;

    // How far INTO the sheet this pixel sits. This — not a flat lambert — is
    // what carries the form: light reaches a short way under the lip and dies,
    // so each fold is a bright edge over a dark body instead of a filled shape.
    // Exponential, not linear: a linear ramp still had light at the floor.
    float lip = exp(-edge * (4.6 - 1.4 * depth));

    // the curve of the fold, as a normal. The slope term makes a crest that
    // leans toward the key light brighter than one that leans away, which is
    // what gives the sheet its metal.
    vec3 n = normalize(vec3(-dh * 0.42, lip * 1.35 + 0.08, sqrt(max(0.02, 1.0 - lip * lip))));
    vec3 lightDir = normalize(vec3(-0.42, 0.74, 0.52));
    vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));

    float lambert = max(dot(n, lightDir), 0.0);
    float spec = pow(max(dot(n, halfDir), 0.0), 24.0);
    float ridge = pow(max(dot(n, halfDir), 0.0), 150.0);

    // the internal current: advected fbm, stretched along x like flowing liquid
    float flow = fbm(vec2(px * 1.25 - t * 0.14, uv.y * 2.6 + t * 0.05 + fi));
    float veins = fbm(vec2(px * 5.0 + t * 0.22, uv.y * 11.0 - t * 0.10 + fi * 3.0));

    // ── the material: DARK by default, cyan only where light finds it ─────
    // The sheet's body is almost ink. Everything that reads as colour is a
    // light event on it — that contrast is the whole look.
    vec3 body = CYAN_DEEP * 0.05;

    // light that has travelled THROUGH the sheet — strongest just under the
    // lip, gone by the time it reaches the body
    body += CYAN_DEEP * lip * (0.55 + 0.75 * flow) * 1.5;
    body += CYAN * pow(lip, 1.8) * (0.30 + 0.70 * lambert) * 0.9;

    // the veins: thin filaments of refracted light inside the fold. They fade
    // with depth so they never turn the body into a flat wash.
    float filament = pow(veins, 3.5) * pow(lip, 0.9);
    body += CYAN_GLOW * filament * 1.9;

    // the chrome specular, and the one place the material reaches paper
    body += CYAN_GLOW * spec * pow(lip, 1.2) * 0.6;
    body += PAPER * ridge * pow(lip, 0.6) * 0.9;

    // the cut edge — a hard hot line along the crest, the sheet's silhouette
    float rim = smoothstep(0.020, 0.0, abs(edge));
    body += mix(CYAN, PAPER, ridge * 0.8) * rim * (0.55 + 0.75 * lambert);

    // the fold in FRONT casts onto this one: a dark separation right below
    // each crest, which is what stops four sheets reading as one mass
    body *= 1.0 - 0.55 * smoothstep(0.0, 0.055, edge) * (1.0 - smoothstep(0.055, 0.16, edge));

    col = mix(col, body, inside);
    coverage = max(coverage, inside);
  }

  // atmosphere above the sheet: the glow the liquid throws into the black.
  // topGlow was accumulated inside the main loop — recomputing four more
  // height fields down here doubled the sine cost of the whole shader.
  col += CYAN * topGlow * 0.06 * (0.6 + 0.4 * enter);

  // grain — the same blue-noise-ish dither the site uses, keeps banding out of
  // the long cyan gradients
  float g = hash(gl_FragCoord.xy + fract(t) * 133.7) - 0.5;
  col += g * 0.016;

  fragColor = vec4(col, 1.0);
}`;
