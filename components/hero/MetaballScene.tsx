"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD, getRestingState } from "@/lib/webgl/states";
import { detectGpuTier, demoteToSvg, type GpuTier } from "@/lib/webgl/gpu-tier";
import { getEnvMapData, makeEnvTexture } from "@/lib/webgl/env-map";
import type { SdfResult } from "@/lib/webgl/trace-logo";

/* ---------------------------------------------------------------------------
 * Raymarched glass (S2.3). States: 0 = the mark (SDF texture, extruded);
 * 1-7 = the service pillars (SDF primitives). It morphs by a CONNECTED SDF
 * blend (lerp bridged through the fused union) so the body stays one liquid
 * mass. ?state=N previews a single static form (contact sheet).
 * ------------------------------------------------------------------------- */
const THICK = 0.46;
const DOME = 0.28;
const ROUND = 0.04;
const ERODE = 0.025;
const IOR = 1.34; // spec S1: liquid-glass refraction (was 1.4)
const VIEW = 1.05;

// Per-tier raymarch budget (backlog 5.0). "lite" runs on integrated GPUs (Intel
// UHD etc.): fewer steps, a shorter thickness loop, a coarser normal epsilon, and
// (set on the Canvas) a smaller internal resolution + no AA — light enough to hold
// a stable framerate where the full shader froze. `env` = sample the real HDRI
// (5.1); lite keeps the cheap procedural lighting. `dpr` may be a [min,max] range.
type TierCfg = {
  steps: number;
  tsteps: number;
  neps: number;
  dpr: number | [number, number];
  aa: boolean;
  env: boolean;
};
const TIER: Record<"full" | "lite", TierCfg> = {
  full: { steps: 56, tsteps: 12, neps: 0.0035, dpr: [1, 2], aa: true, env: true },
  lite: { steps: 34, tsteps: 6, neps: 0.006, dpr: 0.65, aa: false, env: false },
};

const BREATH = FIELD.breath;
const BREATH_HZ = 1 / 8;
const OMEGA = BREATH_HZ * Math.PI * 2;

const HOLD = 9.0;
const TRANS = 1.4;
const CONV_DUR = 1.9; // S4 converge: shards reassemble (uFracture 1→0) over this many seconds
const STATES = 8; // 0 = mark, 1-7 = the service pillars
const AI_STATE = 3;
const K_MORPH = 0.22; // union-bridge smin (base)
const K_MID = 0.34; // extra smin smoothing at mid-morph → fewer holes (5.4)
const BRIDGE = 0.8; // bridge strength (leaner = more mercury-like, still connected)
const INFLATE = 0.05; // mid-morph surface inflation → plump mercury neck (5.4)

export const CAPTURE_TIME = { rest: 0, breath: Math.PI / 2 / OMEGA } as const;

const f = (x: number) => x.toFixed(5);
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const makeFragment = (
  STEPS: number,
  TSTEPS: number,
  NEPS: number,
  USE_ENV: boolean,
) => /* glsl */ `
  precision highp float;
  ${USE_ENV ? "#define USE_ENV" : ""}
  varying vec2 vUv;
  uniform sampler2D uSDF;
  uniform float uTime;
  uniform float uMorph;
  uniform int uStateA;
  uniform int uStateB;
  uniform vec2 uPointer;
  uniform float uFracture;
  uniform sampler2D uEnv;   // studio HDRI (full tier); folded to luminance
  uniform float uHasEnv;    // 0 until the HDRI has loaded

  #define THICK ${f(THICK)}
  #define DOME ${f(DOME)}
  #define ROUND ${f(ROUND)}
  #define ERODE ${f(ERODE)}
  #define IOR ${f(IOR)}
  #define VIEW ${f(VIEW)}
  #define BREATH ${f(BREATH)}
  #define OMEGA ${f(OMEGA)}

  const vec3 CY      = vec3(0.0, 0.890, 0.996);
  const vec3 CY_GLOW = vec3(0.302, 0.925, 1.0);
  const vec3 CY_DEEP = vec3(0.0, 0.714, 0.8);

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }
  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }
  float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
  }
  float sdTorusZ(vec3 p, float R, float r) { return length(vec2(length(p.xy) - R, p.z)) - r; }
  float sdTorusX(vec3 p, float R, float r) { return length(vec2(length(p.yz) - R, p.x)) - r; }
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }

  // a solid disc along Z (the gear body)
  float sdCylZ(vec3 p, float R, float h) {
    vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(R, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  // a thick, rounded, molten-glass gear: rounded disc + polar-repeated teeth,
  // bored through the centre. Axis = local Z (faces the camera until tilted).
  float sdGear(vec3 p, float R, float h, float teeth, float toothLen, float toothW, float hole) {
    float body = sdCylZ(p, R, h) - 0.02;
    float ang = atan(p.y, p.x);
    float seg = 6.2831853 / teeth;
    float a = floor(ang / seg + 0.5) * seg;       // nearest tooth spoke
    vec2 dir = vec2(cos(a), sin(a));
    float xr = dot(p.xy, dir);
    float yr = dot(p.xy, vec2(-dir.y, dir.x));
    vec3 tp = vec3(xr - R, yr, p.z);
    float tooth = sdRoundBox(tp, vec3(toothLen, toothW, h), 0.012);
    float g = min(body, tooth);
    float bore = sdCylZ(p, hole, h + 0.05);
    return max(g, -bore);                          // hollow centre
  }

  float sdf2D(vec2 p) {
    vec2 uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return texture2D(uSDF, uv).r;
  }

  // 0 — the mark, extruded with a domed profile + rounded edges.
  float sdfLogo(vec3 p, float br) {
    vec3 q = p / br;
    float d2 = sdf2D(q.xy);
    float t = clamp(-d2 / DOME, 0.0, 1.0);
    float td = THICK * (t * t * t * (t * (t * 6.0 - 15.0) + 10.0));
    float dz = abs(q.z) - td;
    float ox = max(d2, 0.0);
    float oz = max(dz, 0.0);
    float outside = sqrt(ox * ox + oz * oz);
    float inside = min(max(d2, dz), 0.0);
    return (outside + inside - ROUND + ERODE) * br;
  }

  // 1 — Web Design: a PORTAL (5.2) — a plump rounded glass frame, an open window
  // to the built thing, with a fluid drop crossing the threshold. Abstract and
  // brand-native, not a literal browser (no chrome/dots/buttons).
  float sdfWeb(vec3 p, float br) {
    vec3 q = p / br;
    q = rotY(q, 0.14);
    q = rotX(q, -0.07);
    float outer = sdRoundBox(q, vec3(0.50, 0.42, 0.075), 0.12);
    float inner = sdRoundBox(q, vec3(0.27, 0.21, 0.18), 0.10);
    float d = max(outer, -inner);                       // the open frame
    d = smin(d, length(q - vec3(0.04, -0.40, 0.02)) - 0.090, 0.07); // drop at the sill
    return d * br;
  }

  // 2 — Software: cascading translucent panels (stacked windows) with a raised
  // </> code glyph on the front window (per ref).
  float sdfSoftware(vec3 p, float br) {
    vec3 q = p / br;
    float k = 0.05;
    float d = sdRoundBox(q - vec3(-0.20, 0.20, 0.20), vec3(0.40, 0.28, 0.035), 0.05);
    d = smin(d, sdRoundBox(q, vec3(0.40, 0.28, 0.035), 0.05), k);
    d = smin(d, sdRoundBox(q - vec3(0.20, -0.20, -0.20), vec3(0.40, 0.28, 0.035), 0.05), k);
    // </> glyph + code line — bold AND wide-spaced glass rods: proud enough to
    // catch light, far enough apart to read as three distinct glyphs.
    float gz = 0.265, tr = 0.026, kg = 0.008;
    vec2 g = vec2(-0.20, 0.235);
    d = smin(d, sdCapsule(q, vec3(g.x - 0.095, g.y + 0.062, gz), vec3(g.x - 0.155, g.y, gz), tr), kg); // <
    d = smin(d, sdCapsule(q, vec3(g.x - 0.155, g.y, gz), vec3(g.x - 0.095, g.y - 0.062, gz), tr), kg);
    d = smin(d, sdCapsule(q, vec3(g.x - 0.022, g.y - 0.082, gz), vec3(g.x + 0.022, g.y + 0.082, gz), tr), kg); // /
    d = smin(d, sdCapsule(q, vec3(g.x + 0.095, g.y + 0.062, gz), vec3(g.x + 0.155, g.y, gz), tr), kg); // >
    d = smin(d, sdCapsule(q, vec3(g.x + 0.155, g.y, gz), vec3(g.x + 0.095, g.y - 0.062, gz), tr), kg);
    d = smin(d, sdCapsule(q, vec3(g.x - 0.13, g.y - 0.165, gz), vec3(g.x + 0.13, g.y - 0.165, gz), 0.019), kg); // code line
    return d * br;
  }

  // 3 — AI: a clean NODE NETWORK (per reference) — a plump central hub + a ring of
  // six glass nodes in a hexagon, joined by clean struts (hub→ring + ring rim).
  // Plump nodes, clean connections — not a thin wireframe, not a random web.
  float sdfAI(vec3 p, float br) {
    vec3 q = p / br;
    q = rotY(q, 0.12);   // gentle 3/4 so the glass reads dimensional, not flat
    q = rotX(q, -0.05);
    float k = 0.045;
    vec3 hub = vec3(0.0, 0.0, 0.0);
    vec3 n0 = vec3(0.0, 0.42, 0.0);
    vec3 n1 = vec3(-0.364, 0.21, 0.0);
    vec3 n2 = vec3(-0.364, -0.21, 0.0);
    vec3 n3 = vec3(0.0, -0.42, 0.0);
    vec3 n4 = vec3(0.364, -0.21, 0.0);
    vec3 n5 = vec3(0.364, 0.21, 0.0);
    float strut = 0.052, rim = 0.044; // plumper struts (5.2) — connections, not wireframe
    // struts (clean): hub → each ring node, then the ring perimeter
    float d = sdCapsule(q, hub, n0, strut);
    d = min(d, sdCapsule(q, hub, n1, strut));
    d = min(d, sdCapsule(q, hub, n2, strut));
    d = min(d, sdCapsule(q, hub, n3, strut));
    d = min(d, sdCapsule(q, hub, n4, strut));
    d = min(d, sdCapsule(q, hub, n5, strut));
    d = min(d, sdCapsule(q, n0, n1, rim));
    d = min(d, sdCapsule(q, n1, n2, rim));
    d = min(d, sdCapsule(q, n2, n3, rim));
    d = min(d, sdCapsule(q, n3, n4, rim));
    d = min(d, sdCapsule(q, n4, n5, rim));
    d = min(d, sdCapsule(q, n5, n0, rim));
    // plump glass nodes bulging over the struts
    d = smin(d, length(q - hub) - 0.17, k);
    d = smin(d, length(q - n0) - 0.10, k);
    d = smin(d, length(q - n1) - 0.10, k);
    d = smin(d, length(q - n2) - 0.10, k);
    d = smin(d, length(q - n3) - 0.10, k);
    d = smin(d, length(q - n4) - 0.10, k);
    d = smin(d, length(q - n5) - 0.10, k);
    return d * br;
  }

  // 4 — Automation: two thick, molten 3D GEARS meshing (per reference). Rounded
  // glass discs with polar teeth, bored centres, tilted to show volume. min-unioned
  // so they read as two distinct gears touching, not one fused blob.
  float sdfAutomation(vec3 p, float br) {
    vec3 q = p / br;
    q = rotY(q, 0.12);   // mostly face-on (per ref), slight tilt for rim volume
    q = rotX(q, -0.09);
    vec3 pa = q - vec3(-0.17, 0.13, 0.0);          // larger gear, upper-left
    float ga = sdGear(pa, 0.30, 0.14, 10.0, 0.055, 0.045, 0.105);
    vec3 pb = q - vec3(0.22, -0.17, 0.0);          // smaller gear, lower-right
    pb = rotZ(pb, 0.196);                          // half-tooth offset → teeth mesh
    float gb = sdGear(pb, 0.22, 0.13, 8.0, 0.050, 0.042, 0.075);
    return min(ga, gb) * br;
  }

  // 5 — Data: an ASCENDING STREAM (5.2) — four drops of growing size rising along
  // a diagonal, threaded by a flowing tendril. Growth + flow, not a bar chart.
  float sdfData(vec3 p, float br) {
    vec3 q = p / br;
    float k = 0.06;
    vec3 a = vec3(-0.36, -0.32, 0.00);
    vec3 b = vec3(-0.13, -0.10, 0.05);
    vec3 c = vec3(0.13, 0.14, 0.00);
    vec3 e = vec3(0.36, 0.36, 0.05);
    float d = length(q - a) - 0.095;
    d = smin(d, length(q - b) - 0.115, k);
    d = smin(d, length(q - c) - 0.135, k);
    d = smin(d, length(q - e) - 0.155, k);
    // the stream threading the drops together
    d = smin(d, sdCapsule(q, a, c, 0.045), k);
    d = smin(d, sdCapsule(q, c, e, 0.05), k);
    return d * br;
  }

  // 6 — Branding: ONE ESSENCE, MANY EXPRESSIONS (5.2) — a dominant central
  // identity orb with satellites of varied size at organic (not clock-evenly-
  // spaced) positions. Separate orbs (min, no struts) → reads as a living cluster,
  // distinct from the AI network.
  float sdfBranding(vec3 p, float br) {
    vec3 q = p / br;
    float d = length(q) - 0.205;                            // dominant identity
    d = min(d, length(q - vec3(0.02, 0.41, 0.02)) - 0.090);
    d = min(d, length(q - vec3(0.36, 0.20, 0.0)) - 0.062);
    d = min(d, length(q - vec3(0.40, -0.18, 0.03)) - 0.078);
    d = min(d, length(q - vec3(0.12, -0.41, 0.0)) - 0.052);
    d = min(d, length(q - vec3(-0.31, -0.31, 0.02)) - 0.082);
    d = min(d, length(q - vec3(-0.43, 0.11, 0.0)) - 0.060);
    d = min(d, length(q - vec3(-0.17, 0.30, 0.04)) - 0.045);
    return d * br;
  }

  // 7 — Marketing: a BROADCAST BLOOM (5.2) — a source with tapering rays fanning
  // upward/outward, each tipped with a drop (reach spreading). Directional fan,
  // not a target: distinct from AI's symmetric ring and Branding's orbit.
  float sdfMarketing(vec3 p, float br) {
    vec3 q = p / br;
    q = rotY(q, 0.10);
    vec3 core = vec3(0.0, -0.34, 0.0);
    float d = length(q - core) - 0.135;        // the source
    float k = 0.05;
    for (int i = 0; i < 5; i++) {
      float a = 0.6108652 + float(i) * 0.4487990; // ~35°..138° fan
      vec2 dir = vec2(cos(a), sin(a));
      vec3 tip = core + vec3(dir * 0.62, 0.02);
      d = smin(d, sdCapsule(q, core, tip, 0.038), k); // the ray
      d = smin(d, length(q - tip) - 0.058, k);        // tip drop (the reach)
    }
    return d * br;
  }

  float sdfForState(vec3 p, float br, int s) {
    if (s == 0) return sdfLogo(p, br);
    if (s == 1) return sdfWeb(p, br);
    if (s == 2) return sdfSoftware(p, br);
    if (s == 3) return sdfAI(p, br);
    if (s == 4) return sdfAutomation(p, br);
    if (s == 5) return sdfData(p, br);
    if (s == 6) return sdfBranding(p, br);
    return sdfMarketing(p, br);
  }

  // Fracture the mark into disconnected shards pulled outward (S3 → S4 converge).
  // f: 0 = whole connected mark, 1 = fully dispersed. Voronoi cells over the mark;
  // each shard pushed radially out + depth-staggered so it reads clearly broken.
  vec3 shatter(vec3 p, float f) {
    vec2 seeds[6];
    seeds[0] = vec2(-0.30, 0.32);
    seeds[1] = vec2(0.28, 0.36);
    seeds[2] = vec2(-0.40, -0.06);
    seeds[3] = vec2(0.08, -0.04);
    seeds[4] = vec2(0.42, -0.20);
    seeds[5] = vec2(-0.12, -0.42);
    vec2 c = seeds[0];
    float bd = distance(p.xy, seeds[0]);
    float id = 0.0;
    for (int i = 1; i < 6; i++) {
      float dd = distance(p.xy, seeds[i]);
      if (dd < bd) { bd = dd; c = seeds[i]; id = float(i); }
    }
    vec2 dir = normalize(c + vec2(0.0008, 0.0006));
    float z = fract(sin(id * 43.7) * 7919.0) - 0.5;
    p.xy -= dir * (0.50 * f);  // bigger gaps → clearly disconnected shards
    p.z -= z * 0.60 * f;       // deeper stagger → shards float at different depths
    return p;
  }

  float map(vec3 p, float br) {
    // hover physics — the whole glass body leans toward the pointer
    p = rotY(p, uPointer.x * 0.20);
    p = rotX(p, -uPointer.y * 0.20);
    if (uFracture > 0.001) p = shatter(p, uFracture);
    float a = sdfForState(p, br, uStateA);
    if (uMorph <= 0.0005) return a;
    float b = sdfForState(p, br, uStateB);
    if (uMorph >= 0.9995) return b;
    // connected liquid morph — bridges like mercury (5.4). At mid-morph (mid =
    // sin 0→1→0) the union smin widens so the two forms fuse smoothly instead of
    // overlapping into a holey lump, and the surface inflates slightly to plump
    // the neck; both vanish at the endpoints so uMorph 0/1 stay exactly A/B.
    float lerp = mix(a, b, uMorph);
    float mid = sin(uMorph * 3.14159265);
    float uni = smin(a, b, ${f(K_MORPH)} + ${f(K_MID)} * mid);
    return mix(lerp, uni, mid * ${f(BRIDGE)}) - ${f(INFLATE)} * mid;
  }

  vec3 calcNormal(vec3 p, float br) {
    vec2 e = vec2(${f(NEPS)}, 0.0);
    return normalize(vec3(
      map(p + e.xyy, br) - map(p - e.xyy, br),
      map(p + e.yxy, br) - map(p - e.yxy, br),
      map(p + e.yyx, br) - map(p - e.yyx, br)
    ));
  }

  // Procedural 3-light fallback (lite tier, or until the HDRI loads).
  float envProc(vec3 d) {
    float s = 0.0;
    s += smoothstep(0.60, 0.96, dot(d, normalize(vec3(0.35, 0.85, 0.55))));
    s += 0.85 * smoothstep(0.74, 0.99, dot(d, normalize(vec3(-0.85, 0.10, 0.45))));
    s += 0.70 * smoothstep(0.82, 0.995, dot(d, normalize(vec3(0.75, 0.40, -0.25))));
    return s;
  }

  // Reflection environment, returned as grayscale luminance (mixed onto cyan
  // glass downstream) so highlights stay white-on-cyan — never an off-brand hue.
  vec3 envColor(vec3 d) {
#ifdef USE_ENV
    if (uHasEnv > 0.5) {
      // direction → equirectangular UV (1/2pi, 1/pi)
      vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5,
                     acos(clamp(d.y, -1.0, 1.0)) * 0.31830989);
      vec3 e = texture2D(uEnv, uv).rgb;
      float lum = dot(e, vec3(0.299, 0.587, 0.114));
      // tone the real environment into crisp speculars: a steep curve crushes the
      // dim room to near-black (so the deep cyan body stays rich) and keeps the
      // bright light sources as structured, believable highlights.
      float hi = pow(clamp(lum, 0.0, 6.0), 2.4) * 0.55;
      return vec3(hi);
    }
#endif
    return vec3(envProc(d));
  }

  void main() {
    float br = 1.0 + BREATH * sin(uTime * OMEGA);
    vec2 uv = vUv * 2.0 - 1.0;
    vec3 ro = vec3(uv * VIEW, 2.0);
    vec3 rd = vec3(0.0, 0.0, -1.0);

    float t = 0.0, d = 0.0;
    bool hit = false;
    for (int i = 0; i < ${STEPS}; i++) {
      vec3 p = ro + rd * t;
      d = map(p, br);
      if (d < 0.0006) { hit = true; break; }
      t += max(d * 0.85, 0.0025);
      if (t > 4.0) break;
    }
    if (!hit) discard;

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos, br);
    vec3 V = -rd;

    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 reflCol = envColor(reflect(rd, n));

    vec3 rdr = refract(rd, n, 1.0 / IOR);
    vec3 pin = pos + rdr * 0.012;
    float thick = 0.0;
    for (int j = 0; j < ${TSTEPS}; j++) {
      if (map(pin, br) > 0.0) break;
      pin += rdr * 0.02;
      thick += 0.02;
    }
    vec3 nin = -calcNormal(pin, br);
    vec3 rout = refract(rdr, nin, IOR);
    if (dot(rout, rout) < 0.0001) rout = reflect(rdr, nin);
    vec3 through = envColor(rout);

    float td = clamp(thick / (THICK * 2.2), 0.0, 1.0);
    vec3 body = mix(CY_GLOW, CY_DEEP, td);
    body += through * 0.35;

    vec3 col = mix(body, reflCol, fres);
    col += reflCol * 0.55;
    col += CY_GLOW * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.18;

    // clearcoat — two sharp, high-frequency specular lobes on top of the body
    // reflection so the surface reads wet and glossy (liquid glass), not matte.
    vec3 L1 = normalize(vec3(0.42, 0.78, 0.55));
    vec3 L2 = normalize(vec3(-0.62, 0.34, 0.42));
    float cc = pow(max(dot(n, normalize(L1 + V)), 0.0), 210.0)
             + 0.55 * pow(max(dot(n, normalize(L2 + V)), 0.0), 120.0);
    col += vec3(1.0) * cc * 0.8;

    // S3.2 — the fractured shards read lifeless: as uFracture 0→1 desaturate the
    // cyan toward a muted grey-cyan and drop luminance/specular so dispersed
    // pieces look dim and dead; as S4 converges (uFracture 1→0) the colour blooms
    // back to full vivid #00E3FE — that contrast is the emotional payoff. At
    // uFracture=0 (hero / resting / contact at rest) this is a no-op.
    if (uFracture > 0.001) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 dead = vec3(lum) * vec3(0.52, 0.64, 0.70); // cool, desaturated grey-cyan
      col = mix(col, dead, uFracture * 0.86);
      col *= 1.0 - uFracture * 0.50; // dim toward lifeless
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Glass({
  sdf,
  tier,
  stateA,
  stateB,
  morph0,
  time0,
  animate,
  manualState,
  fracture,
  converge,
  fractureRef,
  onReady,
  onActiveChange,
  onPerfFail,
}: {
  sdf: SdfResult;
  tier: "full" | "lite";
  stateA: number;
  stateB: number;
  morph0: number;
  time0: number;
  animate: boolean;
  manualState: number | null;
  fracture: number | null;
  converge: boolean;
  fractureRef: { current: number } | null;
  onReady: () => void;
  onActiveChange: (i: number) => void;
  onPerfFail: () => void;
}) {
  const texture = useMemo(() => {
    const t = new THREE.DataTexture(
      sdf.data,
      sdf.size,
      sdf.size,
      THREE.RedFormat,
      THREE.HalfFloatType,
    );
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [sdf]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: makeFragment(
          TIER[tier].steps,
          TIER[tier].tsteps,
          TIER[tier].neps,
          TIER[tier].env,
        ),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uSDF: { value: texture },
          uTime: { value: time0 },
          uMorph: { value: morph0 },
          uStateA: { value: stateA },
          uStateB: { value: stateB },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uFracture: { value: fracture ?? 0 },
          uEnv: { value: null as THREE.Texture | null },
          uHasEnv: { value: 0 },
        },
      }),
    [texture, tier, time0, morph0, stateA, stateB, fracture],
  );

  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const fired = useRef(false);
  const lastActive = useRef(-2);
  // auto/manual state machine: cur = settled state, nxt = melt target.
  const cur = useRef(0);
  const nxt = useRef(0);
  const phase = useRef<"hold" | "melt">("hold");
  const clk = useRef(0);
  // pointer spring (NDC, eased toward the cursor while hovering, back to centre off)
  const ptr = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);
  const convClk = useRef(0); // S4 converge progress (seconds)
  // FPS watchdog (5.0)
  const perfFrames = useRef(0); // frames observed since mount (skip warm-up)
  const badStreak = useRef(0); // consecutive janky frames
  const perfFailed = useRef(false);

  // Load the studio HDRI for the full tier and feed it as the reflection env (5.1).
  // Lazy + cached (decoded once); failure silently keeps the procedural lighting.
  useEffect(() => {
    if (!TIER[tier].env) return;
    let env: THREE.DataTexture | null = null;
    let alive = true;
    getEnvMapData()
      .then((data) => {
        if (!alive) return;
        env = makeEnvTexture(data);
        material.uniforms.uEnv.value = env;
        material.uniforms.uHasEnv.value = 1;
        invalidate();
      })
      .catch(() => {});
    return () => {
      alive = false;
      env?.dispose();
    };
  }, [tier, material, invalidate]);

  // hover physics — track the cursor over the canvas, release to centre on leave
  useEffect(() => {
    if (!animate || fracture != null) return;
    const el = gl.domElement;
    const on = () => {
      hovering.current = true;
    };
    const off = () => {
      hovering.current = false;
    };
    el.addEventListener("pointerenter", on);
    el.addEventListener("pointermove", on);
    el.addEventListener("pointerleave", off);
    return () => {
      el.removeEventListener("pointerenter", on);
      el.removeEventListener("pointermove", on);
      el.removeEventListener("pointerleave", off);
    };
  }, [gl, animate, fracture]);

  useFrame((state, delta) => {
    if (fracture != null) {
      // fractured mark: breathe; if converging, reassemble uFracture fracture→0.
      // Frames only run while in view (frameloop gated by `play`), so the converge
      // advances when the section is on screen and freezes when scrolled away.
      material.uniforms.uTime.value = state.clock.elapsedTime;
      if (fractureRef) {
        // scroll-scrubbed converge — uFracture follows scroll progress (S4)
        material.uniforms.uFracture.value = fractureRef.current;
      } else if (converge) {
        convClk.current += Math.min(delta, 0.05);
        const tC = smoother(Math.min(convClk.current / CONV_DUR, 1));
        material.uniforms.uFracture.value = fracture * (1 - tC);
      }
    } else if (animate) {
      material.uniforms.uTime.value = state.clock.elapsedTime;

      // pointer spring → uPointer
      const tx = hovering.current ? state.pointer.x : 0;
      const ty = hovering.current ? state.pointer.y : 0;
      ptr.current.x += (tx - ptr.current.x) * 0.08;
      ptr.current.y += (ty - ptr.current.y) * 0.08;
      material.uniforms.uPointer.value.set(ptr.current.x, ptr.current.y);

      // advance the cycle. Holds use wall-time (clamped only against pathological
      // spikes) so the ~9s cadence is frame-rate-independent; melts stay frame-
      // smoothed (small clamp) so a lag spike can't snap a transition.
      clk.current +=
        phase.current === "hold" ? Math.min(delta, 0.5) : Math.min(delta, 0.05);
      let m = 0;
      if (phase.current === "hold") {
        material.uniforms.uStateA.value = cur.current;
        material.uniforms.uStateB.value = cur.current;
        material.uniforms.uMorph.value = 0;
        const target = manualState != null ? manualState : (cur.current + 1) % STATES;
        const ready =
          manualState != null ? manualState !== cur.current : clk.current >= HOLD;
        if (ready) {
          nxt.current = target;
          phase.current = "melt";
          clk.current = 0;
        }
      }
      if (phase.current === "melt") {
        m = smoother(Math.min(clk.current / TRANS, 1));
        material.uniforms.uStateA.value = cur.current;
        material.uniforms.uStateB.value = nxt.current;
        material.uniforms.uMorph.value = m;
        if (clk.current >= TRANS) {
          cur.current = nxt.current;
          phase.current = "hold";
          clk.current = 0;
          material.uniforms.uMorph.value = 0;
          material.uniforms.uStateA.value = cur.current;
          material.uniforms.uStateB.value = cur.current;
        }
      }

      const dom = phase.current === "melt" && m >= 0.5 ? nxt.current : cur.current;
      const active = dom === 0 ? -1 : dom - 1;
      if (active !== lastActive.current) {
        lastActive.current = active;
        onActiveChange(active);
      }
    }
    // FPS watchdog (5.0) — sustained jank on the live glass bails to the SVG, so a
    // device that slips through the tier probe never sits frozen/janky. Warm-up
    // frames (shader compile, first paints) are skipped; transient melt spikes reset
    // the streak; only a long run of slow frames trips it.
    if ((animate || fracture != null) && !perfFailed.current) {
      perfFrames.current++;
      if (perfFrames.current > 45) {
        if (delta > 0.05) {
          // < ~20fps
          badStreak.current += 1;
          if (badStreak.current > 60) {
            // ~3-4s sustained
            perfFailed.current = true;
            demoteToSvg();
            onPerfFail();
          }
        } else {
          badStreak.current = 0;
        }
      }
    }

    if (!fired.current) {
      fired.current = true;
      onReady();
    }
  });

  useEffect(() => {
    if (!animate) {
      material.uniforms.uTime.value = time0;
      material.uniforms.uMorph.value = morph0;
      invalidate();
    }
  }, [animate, time0, morph0, material, invalidate]);

  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function RestingMark(props: {
  tier: "full" | "lite";
  stateA: number;
  stateB: number;
  morph0: number;
  time0: number;
  animate: boolean;
  manualState: number | null;
  fracture: number | null;
  converge: boolean;
  fractureRef: { current: number } | null;
  onReady: () => void;
  onActiveChange: (i: number) => void;
  onPerfFail: () => void;
}) {
  const [sdf, setSdf] = useState<SdfResult | null>(null);
  useEffect(() => {
    let alive = true;
    getRestingState()
      .then((r) => {
        if (alive) setSdf(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!sdf) return null;
  return <Glass sdf={sdf} {...props} />;
}

/**
 * Hero metaball (S2.3): raymarched glass mark that morphs to the pillar states.
 * `capture` freezes the rest / mid-morph / AI phases; `previewState` freezes a
 * single static form for the contact sheet.
 */
export default function MetaballScene({
  onReady = () => {},
  onActiveChange = () => {},
  onPerfFail = () => {},
  capture = null,
  previewState = null,
  manualState = null,
  morphPair = null,
  fracture = null,
  converge = false,
  fractureRef = null,
  play = true,
}: {
  onReady?: () => void;
  onActiveChange?: (i: number) => void;
  onPerfFail?: () => void;
  capture?: "rest" | "breath" | "morph" | "ai" | null;
  previewState?: number | null;
  manualState?: number | null;
  morphPair?: [number, number, number] | null;
  fracture?: number | null;
  converge?: boolean;
  fractureRef?: { current: number } | null;
  play?: boolean;
}) {
  // Device tier (backlog 5.0) — "full" or "lite"; this component only mounts when
  // canRunGlass() (tier != none), so coerce defensively.
  const tier = useMemo<"full" | "lite">(() => {
    const t: GpuTier = detectGpuTier();
    return t === "none" ? "lite" : t;
  }, []);
  const cfg = TIER[tier];
  let stateA = 0;
  let stateB = AI_STATE;
  let morph0 = 0;
  let time0 = 0;
  let animate = true;
  if (fracture != null) {
    // The Problem (S3): the mark, fractured into disconnected shards. Mark-only,
    // breathing; the shatter amount comes from uFracture (set on the material).
    stateA = 0;
    stateB = 0;
    morph0 = 0;
    animate = true;
  } else if (morphPair != null) {
    // QA still: freeze an arbitrary A→B transition at morph m (?pair=a-b-m)
    stateA = morphPair[0];
    stateB = morphPair[1];
    morph0 = morphPair[2];
    animate = false;
  } else if (previewState != null) {
    stateA = previewState;
    stateB = previewState;
    animate = false;
  } else if (capture !== null) {
    animate = false;
    morph0 = capture === "morph" ? 0.5 : capture === "ai" ? 1 : 0;
    time0 = capture === "breath" ? CAPTURE_TIME.breath : 0;
  }
  return (
    <Canvas
      dpr={cfg.dpr}
      frameloop={animate && play ? "always" : "demand"}
      gl={{
        alpha: true,
        antialias: cfg.aa,
        toneMapping: THREE.NoToneMapping,
        powerPreference: tier === "full" ? "high-performance" : "low-power",
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <RestingMark
        tier={tier}
        stateA={stateA}
        stateB={stateB}
        morph0={morph0}
        time0={time0}
        animate={animate}
        manualState={manualState}
        fracture={fracture}
        converge={converge}
        fractureRef={fractureRef}
        onReady={onReady}
        onActiveChange={onActiveChange}
        onPerfFail={onPerfFail}
      />
    </Canvas>
  );
}
