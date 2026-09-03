/**
 * THE MIST's shaders (R7) — generated from the same tables the droplets run on.
 *
 * Two programs:
 *
 *   UPDATE  a full-screen pass over the SIZE×SIZE state textures (ping-pong,
 *           MRT): position+velocity in one, life+state+host+phase in the other.
 *           One fragment = one particle = one fixed substep of the rule
 *           lib/webgl/mist.mjs states in JS.
 *   DRAW    an instanced quad per particle, oriented along its velocity and
 *           stretched by it — a velocity-aligned CAPSULE, which is the arrow of
 *           the owner's drawing drawn by the motion itself. Slow vapour is a
 *           speck; converging vapour is a stroke pointing where it is going.
 *
 * Nothing here is a second definition of a force. The curl noise is the
 * octave ladder from noise.mjs, injected; the hand's displacement well, the
 * strike's crest-and-trough ring and the obstacle avoidance are the profiles
 * from fluid-core.mjs with the FLUID constants injected — a physics retune
 * moves the droplets and the vapour together, or it moves neither.
 *
 * The strike arrives as the FORM uniform the conductor already resolves per
 * frame (x, y, front radius, form displacement amplitude): everything
 * time-dependent is decided once, in fluid-core, and this shader only turns
 * the form's displacement amplitude back into the droplets' acceleration
 * amplitude (uShockK), so a wave that moves the droplets moves the vapour at
 * the same instant.
 */

import { FLUID, FLUID_OBSTACLE_MAX } from "./fluid-core.mjs";
import { MIST } from "./mist.mjs";
import { OCT, EPS } from "./noise.mjs";
import { N } from "./phys.mjs";

// GLSL literal for a JS number — GLSL has no implicit int → float.
const g = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};

/** The number of hosts the vapour condenses onto: the authored droplets. */
export const MIST_HOSTS = N;
/** Obstacle rectangles the update reads — the same cache the droplets read. */
export const MIST_OBSTACLES = FLUID_OBSTACLE_MAX;

// ── the shared noise, ported ──────────────────────────────────────────────────
// Integer lattice hash in uint arithmetic: the same bits as noise.mjs's
// `lhash` (Math.imul wraps at 2^32 exactly as uint multiplication does), so the
// vapour rides the SAME eddies the droplets ride, not a lookalike field.
const NOISE_GLSL = `
uint lhash(int ix, int iy) {
  uint h = uint(ix) * 374761393u + uint(iy) * 668265263u;
  h = (h ^ (h >> 13)) * 1274126177u;
  h ^= h >> 16;
  return h;
}
float lhashf(int ix, int iy) { return float(lhash(ix, iy)) * (1.0 / 4294967296.0); }
float fadeC(float t) { return t * t * (3.0 - 2.0 * t); }
float vnoise2(float x, float y) {
  float xf = floor(x), yf = floor(y);
  int xi = int(xf), yi = int(yf);
  float u = fadeC(x - xf), v = fadeC(y - yf);
  float a = lhashf(xi, yi), b = lhashf(xi + 1, yi);
  float c = lhashf(xi, yi + 1), d = lhashf(xi + 1, yi + 1);
  float ab = a + (b - a) * u;
  return ab + (c + (d - c) * u - ab) * v;
}
float potential(float x, float y, float t) {
  float p = 0.0;
${OCT.map(
  (o, k) =>
    `  p += ${g(o.a)} * vnoise2(x * ${g(o.f)} + t * ${g(o.vx * o.f)} + ${g(k * 37.1)}, y * ${g(o.f)} + t * ${g(o.vy * o.f)} + ${g(k * 61.7)});`,
).join("\n")}
  return p;
}
vec2 curlAt(vec2 p, float t) {
  float px = potential(p.x + ${g(EPS)}, p.y, t) - potential(p.x - ${g(EPS)}, p.y, t);
  float py = potential(p.x, p.y + ${g(EPS)}, t) - potential(p.x, p.y - ${g(EPS)}, t);
  return vec2(py, -px) * ${g(1 / (2 * EPS))};
}
// a particle's own aperiodic clock (noise.mjs fbm1)
float fbm1(float x, int seed) {
  float v = 0.0, a = 1.0, f = 1.0, norm = 0.0;
  for (int k = 0; k < 3; k++) {
    float s = x * f + float(seed) * 19.7 + float(k) * 113.3;
    float i0f = floor(s);
    int i0 = int(i0f);
    float t = fadeC(s - i0f);
    float n0 = lhashf(i0, seed + k * 977);
    float n1 = lhashf(i0 + 1, seed + k * 977);
    v += a * (n0 + (n1 - n0) * t);
    norm += a;
    a *= 0.5;
    f *= 2.17;
  }
  return (v / norm) * 2.0 - 1.0;
}
`;

export const MIST_VERT = `#version 300 es
precision highp float;
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

export const MIST_UPDATE_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uPos;   // xy position (field uv) · zw velocity (uv/s)
uniform sampler2D uAux;   // x life · y state (0 free, 1 skin) · z host · w theta
uniform sampler2D uSpell; // per-particle letter target in box space [-1, 1]
uniform int uSize;
uniform float uDt;        // substep, seconds
uniform float uTime;      // seconds
uniform float uReset;     // 1 = seed every particle at its home droplet
uniform vec4 uHost[${MIST_HOSTS}]; // x, y, skin radius, presence
uniform vec4 uDialA;      // evap, pull, poles, condense
uniform vec4 uDialB;      // release, spell, curl, floorOn
uniform vec4 uCentre;     // centre xy · pole A xy
uniform vec4 uPoleB;      // pole B xy · floor y · half bleed width
uniform vec4 uDialC;      // recirc, -, -, -
uniform vec4 uHand;       // pointer xy · pointer velocity xy
uniform vec4 uHandK;      // pointer on · press · scroll (vh/s) · spellOn
uniform vec4 uShock[${FLUID.SHOCK_SLOTS}]; // xy · front · form amplitude
uniform float uShockK;    // form amplitude → droplet acceleration
uniform vec4 uObs[${MIST_OBSTACLES}];   // cx, cy, half w, half h
uniform float uObsW[${MIST_OBSTACLES}]; // weights
uniform int uObsN;
uniform vec4 uSpellBox;   // wx, wy, ww, wh — the wordmark in field uv

layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oAux;

${NOISE_GLSL}

float pullProfile(float r, float core, float far) {
  float inner = clamp(r / core, 0.0, 1.0);
  float soft = inner * inner * (3.0 - 2.0 * inner);
  float outer = 1.0 - clamp((r - far * 0.7) / (far * 0.3), 0.0, 1.0);
  return soft * outer;
}

// THE HAND — fluid-core's cursorAccel: a volume-conserving displacement well
// (outward lobe, return rim), a velocity-signed wake, and the pointer's drag.
vec2 handAccel(vec2 p) {
  if (uHandK.x < 0.5) return vec2(0.0);
  float rr = ${g(FLUID.CURSOR_RADIUS)};
  vec2 dv = p - uHand.xy;
  float d2 = dot(dv, dv);
  if (d2 >= rr * rr) return vec2(0.0);
  float d = sqrt(d2);
  float q = d / rr;
  vec2 n = dv / max(d, 1e-4);
  float q3 = q * q * q;
  float taper = 1.0 - q3 * q3;
  float outward = exp(-(q - 0.3) * (q - 0.3) * 18.0);
  float back = exp(-(q - 0.7) * (q - 0.7) * 30.0);
  float nearFade = min(q / 0.12, 1.0);
  float radial = (outward - ${g(FLUID.CURSOR_RIM)} * back) * taper * nearFade;
  float fall = (1.0 - q * q) * taper;
  float gain = 1.0 + ${g(FLUID.CURSOR_PRESS)} * uHandK.y;
  vec2 a = n * (${g(FLUID.CURSOR_PUSH)} * radial * gain);
  float cross = clamp(uHand.z * n.y - uHand.w * n.x, -1.2, 1.2) * fall;
  float tang = (${g(FLUID.CURSOR_SWIRL)} * fall + ${g(FLUID.CURSOR_WAKE)} * cross) * gain;
  a += vec2(-n.y, n.x) * tang;
  a += uHand.zw * (${g(FLUID.CURSOR_DRAG)} * fall * gain);
  return a;
}

// THE STRIKE — fluid-core's shockAccel: crest out, trough back, lobed, with
// this particle's own arrival jitter so the front never reads as a ring.
vec2 shockAccel(vec2 p, float jitA, float jitB) {
  vec2 acc = vec2(0.0);
  for (int k = 0; k < ${FLUID.SHOCK_SLOTS}; k++) {
    vec4 sk = uShock[k];
    if (sk.w <= 0.0) continue;
    vec2 dv = p - sk.xy;
    float d = length(dv);
    if (d < 1e-5) continue;
    float front = sk.z * (1.0 + ${g(FLUID.SHOCK_FRONT_JIT)} * (jitA - 0.5) * 2.0);
    float u = (d - front) / ${g(FLUID.SHOCK_WIDTH)};
    if (u > 2.4 || u < -${g(FLUID.SHOCK_LAG + 2.4)}) continue;
    float crest = exp(-u * u * 1.35);
    float lag = u + ${g(FLUID.SHOCK_LAG)};
    float trough = exp(-lag * lag * 0.9);
    float seed = fract(sin(dot(sk.xy, vec2(127.1, 311.7))) * 43758.5453) * 6.283;
    float theta = atan(dv.y, dv.x);
    float ang = 1.0 + ${g(FLUID.SHOCK_IRREG)} *
      (0.62 * sin(3.0 * theta + seed) + 0.38 * sin(5.0 * theta - seed * 1.7) + (jitB - 0.5) * 1.2);
    float amp = sk.w * uShockK * max(ang, 0.0);
    vec2 n = dv / d;
    acc += n * ((crest - ${g(FLUID.SHOCK_RECOIL)} * trough) * amp);
    acc += vec2(-n.y, n.x) * (crest * amp * ${g(FLUID.SHOCK_SWIRL)} * sin(3.0 * theta + seed * 2.3));
  }
  return acc;
}

// TYPE-AWARE FLOW — fluid-core's obstacle avoidance: the reading surfaces
// PageStage caches turn the vapour aside before it lands on a word.
vec2 obstacleAccel(vec2 p, float margin) {
  vec2 acc = vec2(0.0);
  for (int oi = 0; oi < ${MIST_OBSTACLES}; oi++) {
    if (oi >= uObsN) break;
    vec4 ob = uObs[oi];
    float w = uObsW[oi];
    if (w <= 0.0 || ob.z <= 0.0 || ob.w <= 0.0) continue;
    vec2 d = p - ob.xy;
    vec2 q = abs(d) - ob.zw;
    vec2 n;
    float fall;
    if (q.x > 0.0 || q.y > 0.0) {
      vec2 e = max(q, vec2(0.0)) * vec2(d.x < 0.0 ? -1.0 : 1.0, d.y < 0.0 ? -1.0 : 1.0);
      float dd = length(e);
      if (dd >= margin || dd < 1e-7) continue;
      n = e / dd;
      fall = 1.0 - dd / margin;
    } else {
      vec2 edge = ob.zw - abs(d);
      n = edge.x < edge.y ? vec2(d.x < 0.0 ? -1.0 : 1.0, 0.0) : vec2(0.0, d.y < 0.0 ? -1.0 : 1.0);
      fall = 1.0;
    }
    acc += n * (${g(FLUID.OBSTACLE_A)} * fall * fall * w);
  }
  return acc;
}

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  int i = tc.y * uSize + tc.x;
  vec4 P = texelFetch(uPos, tc, 0);
  vec4 A = texelFetch(uAux, tc, 0);
  vec2 p = P.xy;
  vec2 v = P.zw;
  float life = A.x;
  float state = A.y;
  int host = clamp(int(A.z + 0.5), 0, ${MIST_HOSTS - 1});
  float theta = A.w;
  float h1 = lhashf(i, 311);
  float h2 = lhashf(i, 312);
  float h3 = lhashf(i, 313);
  int home = i - (i / ${MIST_HOSTS}) * ${MIST_HOSTS};
  float dt = uDt;

  // ── the seed: every particle dormant at its home droplet ─────────────────
  if (uReset > 0.5) {
    vec4 H = uHost[home];
    float a = lhashf(i, 301) * 6.2832;
    float rr = H.z * lhashf(i, 302);
    oPos = vec4(H.xy + vec2(cos(a), sin(a)) * rr, 0.0, 0.0);
    oAux = vec4(0.0, 0.0, float(home), a);
    return;
  }

  // ── dormant: emitted only while the liquid boils off (evap) ──────────────
  if (life <= 0.0 && state < 0.5) {
    if (uDialA.x > h1) {
      vec4 H = uHost[home];
      float a = lhashf(i, 314) * 6.2832;
      vec2 dir = vec2(cos(a), sin(a));
      p = H.xy + dir * (H.z * (0.6 + 0.8 * h2));
      v = dir * (${g(MIST.EVAP_V)} * (0.5 + h3));
      life = 0.02;
      theta = a;
    } else {
      oPos = P;
      oAux = A;
      return;
    }
  }
  life = min(1.0, life + ${g(MIST.LIFE_RATE)} * dt);

  // ── the skin: taken up by a body, riding its outline ─────────────────────
  if (state > 0.5) {
    vec4 H = uHost[host];
    bool rel = (uDialB.x > h2) || (uHandK.w > 0.5 && uDialB.y > h3) || (H.w < 0.05);
    if (rel) {
      state = 0.0;
      vec2 dir = vec2(cos(theta), sin(theta));
      p = H.xy + dir * (H.z * ${g(MIST.SKIN_R)});
      v = dir * (${g(MIST.RELEASE_V)} * (0.6 + 0.8 * h1));
    } else {
      theta += ${g(MIST.SKIN_OMEGA)} * (0.5 + h1) * (h2 < 0.5 ? -1.0 : 1.0) * dt;
      float rr = H.z * (${g(MIST.SKIN_R)} + ${g(MIST.SKIN_VAR)} * h3
                 + ${g(MIST.SKIN_BREATH)} * sin(uTime * 1.7 + h1 * 6.28));
      oPos = vec4(H.xy + vec2(cos(theta), sin(theta)) * rr, 0.0, 0.0);
      oAux = vec4(life, 1.0, float(host), theta);
      return;
    }
  }

  // ── free vapour ──────────────────────────────────────────────────────────
  // THE RETURN — the same rule as the CPU reference (lib/webgl/mist.mjs): a
  // free particle that has ARRIVED at the centre is put back at the rim and
  // comes in again, so the inflow is a cycle and not a one-way collapse. The
  // angle carries uTime as well as the particle's hash, so the rim never
  // shows spokes.
  if (uDialC.x > 0.0 && uDialA.y > 0.05) {
    vec2 cd = p - uCentre.xy;
    if (dot(cd, cd) < ${g(MIST.RECIRC_R * MIST.RECIRC_R)} && uDialC.x > h2) {
      float ra = (lhashf(i, 315) + uTime * 0.11) * 6.2832;
      float rr = ${g(MIST.RECIRC_OUT)} * (1.0 + ${g(MIST.RECIRC_VAR)} * (h3 - 0.5) * 2.0);
      vec2 rd = vec2(cos(ra), sin(ra));
      oPos = vec4(uCentre.xy + rd * rr, -rd * ${g(MIST.RECIRC_V)});
      oAux = vec4(${g(MIST.RECIRC_LIFE)}, 0.0, A.z, ra);
      return;
    }
  }
  vec2 a = vec2(0.0);
  // the centre — the point of contact
  if (uDialA.y > 0.0) {
    vec2 d = uCentre.xy - p;
    float r = length(d);
    if (r > 1e-5)
      a += d * (${g(MIST.PULL_A)} * uDialA.y * pullProfile(r, ${g(MIST.PULL_CORE)}, ${g(MIST.PULL_FAR)}) / r);
  }
  // the two poles — each idea draws its own weather
  if (uDialA.z > 0.0) {
    vec2 d = uCentre.zw - p;
    float r = length(d);
    if (r > 1e-5)
      a += d * (${g(MIST.POLE_A)} * uDialA.z * pullProfile(r, ${g(MIST.POLE_CORE)}, ${g(MIST.POLE_FAR)}) / r);
    d = uPoleB.xy - p;
    r = length(d);
    if (r > 1e-5)
      a += d * (${g(MIST.POLE_A)} * uDialA.z * pullProfile(r, ${g(MIST.POLE_CORE)}, ${g(MIST.POLE_FAR)}) / r);
  }
  // condensation — a body within reach draws vapour; vapour at its surface
  // becomes its skin
  if (uDialA.w > 0.0) {
    for (int j = 0; j < ${MIST_HOSTS}; j++) {
      vec4 H = uHost[j];
      if (H.w < 0.05 || H.z < 1e-4) continue;
      vec2 d = H.xy - p;
      float r = length(d);
      float reach = ${g(MIST.HOST_REACH)} * H.z;
      if (r >= reach) continue;
      if (r < ${g(MIST.CAPTURE_R)} * H.z && uDialA.w > h3) {
        oPos = vec4(p, 0.0, 0.0);
        oAux = vec4(life, 1.0, float(j), atan(p.y - H.y, p.x - H.x));
        return;
      }
      a += d * (${g(MIST.HOST_A)} * uDialA.w * (1.0 - r / reach) / max(r, 1e-4));
    }
  }
  // the current — the same curl noise the droplets ride — and the particle's
  // own clock, so two neighbours in one eddy still disagree
  float restless = 0.6 + 0.8 * h1;
  a += curlAt(p, uTime) * (${g(MIST.CURL_V)} * uDialB.z * restless);
  a += vec2(fbm1(uTime * (0.1 + 0.2 * h2), i * 2), fbm1(uTime * (0.1 + 0.2 * h2), i * 2 + 1)) * ${g(MIST.DRIFT)};
  // the hand, the strike, the scroll
  a += handAccel(p) * ${g(MIST.HAND)};
  a += shockAccel(p, h1, h2) * ${g(MIST.SHOCK)};
  float sc = clamp(uHandK.z, -${g(FLUID.SCROLL_CLAMP)}, ${g(FLUID.SCROLL_CLAMP)});
  a.y -= sc * ${g(FLUID.SCROLL_LEAN * MIST.SCROLL_LEAN)};
  // the reading surfaces
  a += obstacleAccel(p, ${g(FLUID.OBSTACLE_MARGIN)} + 0.012);
  // the type band's wall — a push, and a brake on what dives into it
  if (uDialB.w > 0.0 && p.y < uPoleB.z) {
    float pen = clamp((uPoleB.z - p.y) / ${g(MIST.FLOOR_MARGIN)}, 0.0, 1.0);
    a.y += ${g(MIST.FLOOR_A)} * pen * uDialB.w;
    if (v.y < 0.0) a.y -= v.y * ${g(MIST.FLOOR_DAMP)} * pen * uDialB.w;
  }
  // the bleed's edges — a soft wall, never a hard clamp
  // The stage's edges — graded like the floor, and DAMPING the component that
  // is heading out, so vapour arriving at a wall settles against it instead of
  // stopping dead and stacking into a bright line (see MIST.EDGE_DAMP).
  float exl = 0.5 - uPoleB.w - ${g(MIST.EDGE_MARGIN)};
  float exr = 0.5 + uPoleB.w + ${g(MIST.EDGE_MARGIN)};
  if (p.x < exl) {
    float pen = clamp((exl - p.x) / ${g(MIST.EDGE_MARGIN)}, 0.0, 1.0);
    a.x += ${g(MIST.EDGE_A)} * pen;
    if (v.x < 0.0) a.x -= v.x * ${g(MIST.EDGE_DAMP)} * pen;
  }
  if (p.x > exr) {
    float pen = clamp((p.x - exr) / ${g(MIST.EDGE_MARGIN)}, 0.0, 1.0);
    a.x -= ${g(MIST.EDGE_A)} * pen;
    if (v.x > 0.0) a.x -= v.x * ${g(MIST.EDGE_DAMP)} * pen;
  }
  if (p.y < -${g(MIST.EDGE_MARGIN)}) {
    float pen = clamp((-${g(MIST.EDGE_MARGIN)} - p.y) / ${g(MIST.EDGE_MARGIN)}, 0.0, 1.0);
    a.y += ${g(MIST.EDGE_A)} * pen;
    if (v.y < 0.0) a.y -= v.y * ${g(MIST.EDGE_DAMP)} * pen;
  }
  if (p.y > ${g(1 + MIST.EDGE_MARGIN)}) {
    float pen = clamp((p.y - ${g(1 + MIST.EDGE_MARGIN)}) / ${g(MIST.EDGE_MARGIN)}, 0.0, 1.0);
    a.y -= ${g(MIST.EDGE_A)} * pen;
    if (v.y > 0.0) a.y -= v.y * ${g(MIST.EDGE_DAMP)} * pen;
  }
  // the name — a critically damped spring onto this particle's letter
  if (uHandK.w > 0.5 && uDialB.y > 0.0) {
    vec2 tgt = texelFetch(uSpell, tc, 0).xy;
    vec2 tp = uSpellBox.xy + tgt * uSpellBox.zw;
    float om = ${g(MIST.SPELL_OMEGA)} * (0.8 + 0.4 * h3);
    a += (om * om * (tp - p) - 2.0 * ${g(MIST.SPELL_ZETA)} * om * v) * uDialB.y;
  }
  // integrate: semi-implicit, light drag, a ceiling
  v += a * dt;
  v *= exp(-${g(MIST.DRAG)} * dt);
  float sp = length(v);
  if (sp > ${g(MIST.V_MAX)}) v *= ${g(MIST.V_MAX)} / sp;
  p += v * dt;
  oPos = vec4(p, v);
  oAux = vec4(life, 0.0, float(host), theta);
}`;

export const MIST_DRAW_VERT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uPos;
uniform sampler2D uAux;
uniform int uSize;
uniform vec2 uRes;        // drawing buffer (px)
uniform float uPxUv;      // one device pixel at the current buffer scale, in uv
uniform float uAlpha;     // on × fade
uniform vec4 uHost[${MIST_HOSTS}];

out vec2 vQuad;
out float vAlpha;
out vec3 vCol;
out float vLen;

${NOISE_GLSL}

const vec3 BRAND = vec3(0.000, 0.890, 0.996); // #00E3FE
const vec3 DEEP  = vec3(0.000, 0.714, 0.800); // #00B6CC
const vec3 GLOW  = vec3(0.302, 0.925, 1.000); // #4DECFF

void main() {
  int i = gl_InstanceID;
  ivec2 tc = ivec2(i - (i / uSize) * uSize, i / uSize);
  vec4 P = texelFetch(uPos, tc, 0);
  vec4 A = texelFetch(uAux, tc, 0);
  float life = A.x;
  if (life <= 0.001 || uAlpha <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vQuad = vec2(0.0); vAlpha = 0.0; vCol = vec3(0.0); vLen = 1.0;
    return;
  }
  float h1 = lhashf(i, 401);
  float h2 = lhashf(i, 402);
  float h3 = lhashf(i, 403);
  vec2 p = P.xy;
  vec2 v = P.zw;
  float speed = length(v);
  vec2 dir = speed > 1e-4 ? v / speed : vec2(cos(h1 * 6.283), sin(h1 * 6.283));
  bool skin = A.y > 0.5;
  float depth = h2; // 0 near … 1 far — the vapour has thickness
  float hs = uPxUv * (${g(MIST.SIZE_PX)} + ${g(MIST.SIZE_VAR)} * h3) * (1.0 - 0.35 * depth);
  float len = min(speed * ${g(MIST.STREAK_T)}, ${g(MIST.STREAK_MAX)});
  int vid = gl_VertexID;
  float sx = (vid == 0 || vid == 2) ? -1.0 : 1.0;
  float sy = (vid < 2) ? -1.0 : 1.0;
  float halfLen = hs + len * 0.5;
  vec2 corner = dir * (sx * halfLen) + vec2(-dir.y, dir.x) * (sy * hs);
  vec2 uv = p + corner;
  float md = min(uRes.x, uRes.y);
  gl_Position = vec4((uv - 0.5) * md / uRes * 2.0, 0.0, 1.0);
  vQuad = vec2(sx * halfLen / hs, sy);
  vLen = halfLen / hs;
  // Vapour INSIDE a body is the body. "Inside" is decided by the hosts'
  // summed FIELD — the same inverse-square profile the liquid shader sums,
  // with the surface at T = 1 — not by distance to any one host, because a
  // merged body is fatter than the union of its droplets' circles (they neck)
  // and a per-host test left rings of skin drawn through its interior. Free
  // vapour fades as it crosses the surface; a skin, which sits just outside
  // its own host at ~0.87 of a field, survives only where nothing else adds
  // to that — on the outer rind.
  float T = 0.0;
  for (int j = 0; j < ${MIST_HOSTS}; j++) {
    vec4 H = uHost[j];
    if (H.w < 0.05 || H.z < 1e-4) continue;
    vec2 dv = p - H.xy;
    float core = H.z * 0.18;
    float d2 = max(dot(dv, dv), core * core);
    float cut = 7.0 * H.z;
    float win = 1.0 - smoothstep(0.30 * cut * cut, cut * cut, d2);
    T += H.w * (H.z * H.z) / d2 * win;
  }
  float bodyFade = skin ? 1.0 - smoothstep(1.0, 1.35, T) : 1.0 - smoothstep(0.85, 1.35, T);
  float glow = smoothstep(0.0, ${g(MIST.SPEED_GLOW)}, speed);
  vAlpha = uAlpha * life * (skin ? ${g(MIST.ALPHA_SKIN)} : ${g(MIST.ALPHA)}) * bodyFade
         * (1.0 - ${g(MIST.DEPTH_DIM)} * depth);
  vec3 col = mix(DEEP, BRAND, 1.0 - 0.7 * depth);
  vCol = mix(col, GLOW, ${g(MIST.GLOW_MIX)} * glow + (skin ? 0.15 : 0.0));
}`;

export const MIST_DRAW_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
in float vAlpha;
in vec3 vCol;
in float vLen;
out vec4 o;
void main() {
  // a capsule: the segment from -(L-1) to +(L-1) along x, radius 1
  float ax = clamp(vQuad.x, -(vLen - 1.0), vLen - 1.0);
  float d = length(vec2(vQuad.x - ax, vQuad.y));
  float soft = 1.0 - smoothstep(0.35, 1.0, d);
  if (soft < 0.02) discard;
  // Additive light in rgb, and alpha 1 under a MAX blend: the composite
  // multiplies rgb by alpha, so a speck over empty stage must carry full
  // alpha to arrive at its own brightness (see mist-gl.ts).
  o = vec4(vCol * (vAlpha * soft), 1.0);
}`;
