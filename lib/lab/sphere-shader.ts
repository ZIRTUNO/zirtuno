/**
 * THE HERO SPHERE — a cloud of dots that happens to be a sphere.
 *
 * The reference (vanlent.dev) anchors a section on a globe drawn entirely out
 * of points: a bright silhouette, a dimmer interior, and slow bands of light
 * crossing the surface. That structure is right for Zirtuno — it is a SYSTEM
 * seen whole, which is the argument the rest of the page spends nine chapters
 * making — so this keeps the structure and rebuilds the material in the
 * brand's cyan-on-black range.
 *
 * ── why points, and why no depth buffer ─────────────────────────────────────
 *
 * The sphere is never a surface. Every dot is an independent particle that
 * merely SITS on a sphere at rest, which is what lets the same object later
 * disperse, gather, swell and re-seat without any of those being a different
 * renderer, and without anything ever fading in or out.
 *
 * Because the dots are light on ink they composite ADDITIVELY, and additive
 * blending is order-independent. So there is no depth buffer, no sort, and no
 * per-frame CPU work at all: the cloud is uploaded once as STATIC_DRAW and
 * every frame after it is nine uniforms and one drawArrays.
 *
 * ── the drivers ─────────────────────────────────────────────────────────────
 *
 * Nothing here is keyframed. The shader reads a small vocabulary of scalars
 * (SphereState) and derives the whole picture from them, so a future timeline
 * animates the sphere by writing NUMBERS rather than by reaching into the
 * renderer. That is the conductor contract in miniature: the caller emits
 * targets, the loop owns damping and integration. The damping and the handle
 * live in components/lab/HeroSphere.tsx.
 *
 * Raw WebGL2, one draw call, no dependencies. Pure: no DOM, no timers — so a
 * node-side harness can build the same cloud the browser draws.
 */

// ── the state the shader reads ──────────────────────────────────────────────

/**
 * THE CLOCKS. Integrated, never damped — a rate is a target, a clock is not.
 * A scrubbed timeline takes these over by zeroing the rate and writing the
 * clock directly, which is what lets the sphere run BACKWARDS under a scrub
 * instead of easing forward toward wherever the scrub happens to be.
 */
export type SphereClocks = {
  /** radians about the sphere's own axis */
  spin: number;
  /** the surface flow's own time, in seconds */
  flow: number;
};

/**
 * THE DAMPED SCALARS. Every one of these is a target the loop chases with its
 * own time constant, so a caller may step them arbitrarily hard and the sphere
 * still answers as a body with mass rather than as a cut.
 */
export type SphereDrivers = {
  /** radians the axis leans toward the viewer */
  tilt: number;
  /** the seat's radius as a fraction of the stage's SHORTER axis */
  radius: number;
  /** 0 = a loose cloud with no sphere in it … 1 = every dot on its seat */
  gather: number;
  /** extra excursion off the seat, each dot along its own vector */
  scatter: number;
  /** how far the surface flow displaces the dots along their own normal */
  swell: number;
  /** the flow field's spatial frequency — low is banding, high is grain */
  grain: number;
  /** overall brightness */
  energy: number;
  /** the silhouette's boost over the interior */
  rim: number;
  /** dot size multiplier */
  dot: number;
};

/** The clocks plus everything aimable — the whole of what the loop carries. */
export type SphereState = SphereClocks & SphereTargets;

/**
 * THE LOOP'S OWN DRIVERS. Damped exactly like the shader's, but consumed on
 * the way to the uniforms rather than uploaded: two clock rates, and how much
 * of the pointer the sphere accepts.
 */
export type SphereLoop = {
  /** radians per second of spin */
  spinRate: number;
  /** seconds of flow time per second */
  flowRate: number;
  /**
   * How much the pointer leans the sphere, 0..1.
   *
   * The lean is ADDED to spin and tilt on the way to the uniforms — it is
   * never written into them. So a timeline may own `tilt` outright and the
   * hand still works on top of it, and dialling `hand` to 0 for a scripted
   * moment cannot leave a stale lean baked into the state.
   */
  hand: number;
};

/** Everything a caller may aim at. */
export type SphereTargets = SphereDrivers & SphereLoop;

/** How fast each driver answers, in seconds. Bigger = heavier. */
export const SPHERE_TAU: Readonly<SphereTargets> = {
  tilt: 0.55,
  radius: 0.7,
  // The assembly is the slowest thing the sphere does, on purpose: it is the
  // one driver whose entire job is to be WATCHED.
  gather: 1.1,
  scatter: 0.5,
  swell: 0.9,
  grain: 0.9,
  energy: 0.45,
  rim: 0.45,
  dot: 0.4,
  // The rates are heavier still. A spin that changes speed quickly reads as a
  // nudge; one that takes a second and a half reads as the body's own inertia.
  spinRate: 1.4,
  flowRate: 1.4,
  hand: 0.5,
};

/**
 * WHAT IS AIMABLE — the keys the damping loop walks, taken from SPHERE_TAU
 * rather than from the target object.
 *
 * This is load-bearing, not tidiness. SPHERE_REST carries the clocks too, so a
 * target seeded from it has `spin` and `flow` on it; walking the TARGET's keys
 * then looked up SPHERE_TAU.spin, got undefined, and `Math.exp(-dt / undefined)`
 * is NaN. A NaN clock reaches `gl_Position` and every point silently fails
 * clipping — no GL error, no warning, an empty canvas. Deriving the walk from
 * the tau table makes a driver aimable only if somebody said how fast it
 * answers, which is the right thing to require anyway.
 */
export const AIM_KEYS = Object.keys(SPHERE_TAU) as (keyof SphereTargets)[];

/**
 * How far the hand may lean the sphere at `hand: 1`, in radians.
 *
 * Deliberately small. The sphere sits inside `.lab-plane`, which ALREADY leans
 * to the same pointer (useCinematicHero's camera, ~1.65°), so this is a second
 * answer to one hand. It reads as the object turning rather than as a rival
 * parallax only while it stays under about twelve degrees. `hand: 0` turns it
 * off outright for a scripted moment.
 */
export const HAND_SPIN = 0.21;
export const HAND_TILT = 0.12;

/**
 * How far the CANVAS overruns the block the sphere reserves in the layout.
 *
 * The sphere is not the only thing on its stage — a swell, a scatter and the
 * assembly's loose shell all put dots outside the seated silhouette, and a
 * canvas sized to the silhouette clips them against a straight edge. So the
 * canvas is bigger than the box and `radius` is scaled to compensate: at rest
 * the seated sphere measures `radius * STAGE_OVERRUN` of the reserved block.
 *
 * It is declared here rather than only in CSS because `radius` is meaningless
 * without it. `.lab-sphere-canvas` in app/lab.css must carry the same number.
 */
export const STAGE_OVERRUN = 1.5;

/**
 * REST — the sphere with nothing asking anything of it.
 *
 * `gather: 1`, not 0: rest is the SEATED sphere. An entry that assembles
 * starts by snapping gather to 0 and releasing it, so the assembly is a
 * departure from rest rather than a state the sphere has to be talked out of
 * before it can be itself.
 */
export const SPHERE_REST: Readonly<SphereState> = {
  spin: 0,
  flow: 0,
  tilt: -0.16,
  // 0.55 × STAGE_OVERRUN ≈ 0.82 — the seated sphere fills 82% of the block it
  // reserves, and the remaining canvas is headroom for everything that leaves
  // the surface
  radius: 0.55,
  gather: 1,
  scatter: 0,
  swell: 0.055,
  grain: 2.1,
  energy: 1,
  rim: 1,
  dot: 1,
  spinRate: 0.085,
  flowRate: 0.11,
  hand: 1,
};

/**
 * The frame the reduced-motion and no-loop paths draw.
 *
 * Not rest with the clocks at zero: at spin 0 the lattice's poles sit dead on
 * the vertical and the spiral arcs land symmetric, which reads as a diagram.
 * A quarter turn in and a few seconds of flow is the same sphere caught at a
 * moment that looks lived-in.
 */
export const SPHERE_STILL: Readonly<SphereState> = {
  ...SPHERE_REST,
  spin: 0.72,
  flow: 4.1,
};

// ── the cloud ───────────────────────────────────────────────────────────────

/**
 * Integer hash → [0,1). Deterministic and allocation-free, matching the
 * lattice hash in lib/webgl/noise.mjs: the cloud must come out byte-identical
 * on every machine or the QA stills are not comparable between runs.
 */
function lhash(i: number, salt: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(salt, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** the golden angle — what makes the lattice spiral instead of stripe */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export type DotCloud = {
  count: number;
  /** vec3 per dot — its seat on the unit sphere */
  pos: Float32Array;
  /** vec4 per dot — xyz a random unit vector, w a stable 0..1 identity */
  seed: Float32Array;
};

/**
 * Build the cloud.
 *
 * A FIBONACCI lattice, not a lat/long grid. Two reasons, and the second is the
 * one that decides it: a lat/long grid piles dots at the poles, so the sphere
 * comes out dense exactly where it is turning away from you and sparse where
 * it faces you — backwards. And the golden angle is what produces the curved
 * arcs that read as structure without ever resolving into rows.
 *
 * The seed's xyz is a random unit vector rather than the seat's own normal, so
 * a dispersing cloud spreads in every direction instead of inflating like a
 * balloon. Its w is the dot's identity: size, brightness, distance out in the
 * loose cloud and therefore assembly stagger all key off it, so a dot stays
 * recognisably itself through any animation rather than being interchangeable.
 */
export function buildDotSphere(count: number): DotCloud {
  const n = Math.max(1, Math.floor(count));
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);

  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN * i;
    pos[i * 3] = Math.cos(theta) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(theta) * r;

    // a random direction, drawn ON the sphere so the dispersal is isotropic —
    // three independent randoms in a box would bias every dot toward a corner
    const u = lhash(i, 1) * 2 - 1;
    const phi = lhash(i, 2) * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    seed[i * 4] = Math.cos(phi) * s;
    seed[i * 4 + 1] = u;
    seed[i * 4 + 2] = Math.sin(phi) * s;
    seed[i * 4 + 3] = lhash(i, 3);
  }

  return { count: n, pos, seed };
}

// ── the shader ──────────────────────────────────────────────────────────────

export const SPHERE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPos;   // the dot's seat on the unit sphere
in vec4 aSeed;  // xyz = its own direction, w = its identity

uniform vec2  uRes;   // drawing buffer, device px
uniform float uDotPx; // base dot size in device px, dpr already folded in

uniform float uSpin;
uniform float uFlow;
uniform float uTilt;
uniform float uRadius;
uniform float uGather;
uniform float uScatter;
uniform float uSwell;
uniform float uGrain;
uniform float uDot;

out float vGlow;  // 0..1 how close to the silhouette
out float vDepth; // 0 far hemisphere … 1 near hemisphere
out float vBand;  // 0..1 the surface flow, carried as light
out float vSeed;

// ── value noise / fbm — the 3D twin of the ribbon's ────────────────────────
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}
// TWO octaves, not four. This runs once per DOT, and the flow it describes is
// the size of a continent — the detail a third octave would add is finer than
// the gap between neighbouring dots, so it is structure nobody can resolve.
float fbm3(vec3 p) {
  return 0.66 * vnoise3(p) + 0.34 * vnoise3(p * 2.03 + 17.3);
}

// column-major, as GLSL takes them
mat3 rotY(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, -s,
              0.0, 1.0, 0.0,
              s, 0.0, c);
}
mat3 rotX(float a) {
  float s = sin(a), c = cos(a);
  return mat3(1.0, 0.0, 0.0,
              0.0, c, s,
              0.0, -s, c);
}

void main() {
  vec3 seat = aPos;

  // THE SURFACE FLOW. On a unit sphere the normal IS the seat, so displacing
  // along it is one multiply-add. The field is sampled in the sphere's OWN
  // frame and the frame is rotated afterwards, which is what keeps the bands
  // stuck to the surface instead of sliding across a turning ball.
  float band = fbm3(seat * uGrain + vec3(0.0, uFlow, uFlow * 0.6));
  vec3 p = seat * (1.0 + (band - 0.5) * uSwell);

  // THE CLOUD the dots are gathered OUT OF: a loose shell, each dot waiting at
  // its own height above its own seat, so the assembly staggers by identity
  // rather than by a delay somebody had to author per dot.
  //
  // The shell reaches ~1.8 units and no further. Not a taste call — see
  // STAGE_OVERRUN: a wider dispersal starts outside the canvas, so the dots
  // stream in across a hard rectangular edge and the assembly announces the
  // box it is happening in. uScatter is the driver for going further, and it
  // is the caller's business whether that leaves the frame.
  vec3 loose = seat * (1.0 + aSeed.w * 0.38) + aSeed.xyz * (0.15 + aSeed.w * 0.26);
  p = mix(loose, p, uGather);

  // and the excursion on top — the same move, without losing the seat
  p += aSeed.xyz * uScatter * (0.35 + aSeed.w * 0.95);

  mat3 cam = rotX(uTilt) * rotY(uSpin);
  p = cam * p;
  vec3 nrm = cam * seat;

  // A WEAK perspective: enough that the near hemisphere reads larger than the
  // far one, not so much that the silhouette stops being a circle.
  const float CAM = 3.4;
  float persp = CAM / (CAM - p.z);

  // sized off the SHORTER axis, so the sphere never crops on a phone
  float unit = min(uRes.x, uRes.y) * 0.5 * uRadius;
  gl_Position = vec4((p.xy * persp * unit) / (uRes * 0.5), 0.0, 1.0);
  gl_PointSize = max(1.0, uDot * uDotPx * persp * (0.62 + aSeed.w * 0.72));

  // THE RIM is taken on the dot's own NORMAL, not on where it ended up: a dot
  // thrown off the surface by scatter keeps the silhouette it belongs to
  // instead of relighting itself as it travels.
  vGlow = pow(1.0 - abs(nrm.z), 2.6);
  vDepth = smoothstep(-1.0, 1.0, nrm.z);
  vBand = band;
  vSeed = aSeed.w;
}`;

export const SPHERE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float vGlow;
in float vDepth;
in float vBand;
in float vSeed;
out vec4 fragColor;

uniform float uEnergy;
uniform float uRim;

const vec3 CYAN_DEEP = vec3(0.000, 0.408, 0.470);
const vec3 CYAN      = vec3(0.000, 0.890, 0.996);
const vec3 CYAN_GLOW = vec3(0.302, 0.925, 1.000);

void main() {
  // The dot: a soft round falloff with a tight core inside it, so a two-pixel
  // point still reads as light and not as a square. No discard — the falloff
  // reaches zero at the edge and additive blending drops it there for free,
  // which is cheaper than a branch on every fragment of every dot.
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float fall = max(0.0, 1.0 - length(q));
  float a = fall * fall + 0.34 * pow(fall, 7.0);

  // Colour is DEPTH, light is the RIM. The far hemisphere sits in cyan-deep
  // and the near one comes up to brand cyan; only the silhouette reaches the
  // glow. That split is what makes a flat scatter of dots read as a volume.
  vec3 col = mix(CYAN_DEEP, CYAN, vDepth);
  col = mix(col, CYAN_GLOW, clamp(vGlow * uRim, 0.0, 1.0));

  // The flow, spent as LIGHT as well as as motion. This is what puts the slow
  // dark bands across the body at rest, when the swell is far too small to be
  // seen as displacement — the sphere is alive before anything has moved. The
  // range reaches past 1 deliberately: the bands have to be readable against
  // the ribbon burning underneath the hero, and crushing the floor instead
  // would have taken the body with them.
  float lit = mix(0.34, 1.08, vBand);

  // The far hemisphere's floor is 0.38 and not lower. Below about a third the
  // back of the sphere stops being dim and starts being ABSENT, and the object
  // reads as a lit disc with a wire edge instead of a body you can see into.
  a *= uEnergy * lit * mix(0.38, 1.0, vDepth) * (1.0 + 1.35 * vGlow * uRim)
     * (0.72 + 0.5 * vSeed);

  // premultiplied: the canvas composites over the hero, and the hero is ink
  fragColor = vec4(col * a, a);
}`;
