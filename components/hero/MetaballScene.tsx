"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD, getRestingState } from "@/lib/webgl/states";
import { detectGpuTier, demoteToSvg, type GpuTier } from "@/lib/webgl/gpu-tier";
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
const IOR = 1.4;
const VIEW = 1.05;

// Per-tier raymarch budget (backlog 5.0). "lite" runs on integrated GPUs (Intel
// UHD etc.): fewer steps, a shorter thickness loop, a coarser normal epsilon, and
// (set on the Canvas) a smaller internal resolution + no AA — light enough to hold
// a stable framerate where the full shader froze.
type TierCfg = { steps: number; tsteps: number; neps: number; dpr: number; aa: boolean };
const TIER: Record<"full" | "lite", TierCfg> = {
  full: { steps: 56, tsteps: 12, neps: 0.0035, dpr: 1, aa: true },
  lite: { steps: 34, tsteps: 6, neps: 0.006, dpr: 0.65, aa: false },
};

const BREATH = FIELD.breath;
const BREATH_HZ = 1 / 8;
const OMEGA = BREATH_HZ * Math.PI * 2;

const HOLD = 9.0;
const TRANS = 1.4;
const CONV_DUR = 1.9; // S4 converge: shards reassemble (uFracture 1→0) over this many seconds
const STATES = 8; // 0 = mark, 1-7 = the service pillars
const AI_STATE = 3;
const K_MORPH = 0.22; // union-bridge smin
const BRIDGE = 0.8; // bridge strength (leaner = more mercury-like, still connected)

export const CAPTURE_TIME = { rest: 0, breath: Math.PI / 2 / OMEGA } as const;

const f = (x: number) => x.toFixed(5);
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const makeFragment = (STEPS: number, TSTEPS: number, NEPS: number) => /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSDF;
  uniform float uTime;
  uniform float uMorph;
  uniform int uStateA;
  uniform int uStateB;
  uniform vec2 uPointer;
  uniform float uFracture;

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

  // 1 — Web Design: a clean dimensional BROWSER WINDOW (per reference). A glass
  // slab with a raised header bar + traffic-light dots, a big sidebar block, three
  // content lines, and three buttons. Bold plump blocks, molten (smin-joined).
  float sdfWeb(vec3 p, float br) {
    vec3 q = p / br;
    q = rotY(q, 0.13);
    q = rotX(q, -0.07);
    float k = 0.02;                                        // crisper steps → blocks read as solid raised pads
    float d = sdRoundBox(q, vec3(0.58, 0.46, 0.06), 0.05); // window slab
    vec3 e = q - vec3(0.0, 0.0, 0.085);                    // UI stands well off the face
    // header bar + traffic-light dots
    d = smin(d, sdRoundBox(e - vec3(0.0, 0.345, 0.0), vec3(0.50, 0.058, 0.065), 0.02), k);
    d = smin(d, length(e - vec3(-0.40, 0.345, 0.10)) - 0.048, 0.012); // dots proud of the bar
    d = smin(d, length(e - vec3(-0.295, 0.345, 0.10)) - 0.048, 0.012);
    d = smin(d, length(e - vec3(-0.19, 0.345, 0.10)) - 0.048, 0.012);
    d = smin(d, sdRoundBox(e - vec3(0.33, 0.345, 0.10), vec3(0.10, 0.016, 0.04), 0.012), 0.02); // header control (right)
    // big sidebar / hero block (left of body) — a solid filled pad
    d = smin(d, sdRoundBox(e - vec3(-0.27, -0.06, 0.0), vec3(0.205, 0.225, 0.07), 0.03), k);
    // three content lines (upper right)
    d = smin(d, sdRoundBox(e - vec3(0.245, 0.135, 0.0), vec3(0.20, 0.034, 0.06), 0.02), k);
    d = smin(d, sdRoundBox(e - vec3(0.245, 0.02, 0.0), vec3(0.20, 0.034, 0.06), 0.02), k);
    d = smin(d, sdRoundBox(e - vec3(0.245, -0.095, 0.0), vec3(0.20, 0.034, 0.06), 0.02), k);
    // three buttons (bottom right) — solid pads
    d = smin(d, sdRoundBox(e - vec3(0.07, -0.33, 0.0), vec3(0.078, 0.055, 0.065), 0.025), k);
    d = smin(d, sdRoundBox(e - vec3(0.255, -0.33, 0.0), vec3(0.078, 0.055, 0.065), 0.025), k);
    d = smin(d, sdRoundBox(e - vec3(0.44, -0.33, 0.0), vec3(0.078, 0.055, 0.065), 0.025), k);
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
    float strut = 0.040, rim = 0.034;
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

  // 5 — Data: four ascending glassy bars rising from a base platform (per ref).
  float sdfData(vec3 p, float br) {
    vec3 q = p / br;
    float w = 0.095, dp = 0.10, rb = 0.03, bt = -0.41; // bar width/depth/round, base top
    float d = sdRoundBox(q - vec3(-0.33, bt + 0.17, 0.0), vec3(w, 0.17, dp), rb);
    d = min(d, sdRoundBox(q - vec3(-0.11, bt + 0.25, 0.0), vec3(w, 0.25, dp), rb));
    d = min(d, sdRoundBox(q - vec3(0.11, bt + 0.33, 0.0), vec3(w, 0.33, dp), rb));
    d = min(d, sdRoundBox(q - vec3(0.33, bt + 0.43, 0.0), vec3(w, 0.43, dp), rb));
    d = smin(d, sdRoundBox(q - vec3(0.0, -0.47, 0.0), vec3(0.52, 0.055, 0.12), 0.03), 0.05); // base
    return d * br;
  }

  // 6 — Branding: a central identity orb encircled by eight evenly-spaced,
  // equal satellites (per ref) — separate glass orbs (min, no tendrils → not AI),
  // "one essence, many expressions."
  float sdfBranding(vec3 p, float br) {
    vec3 q = p / br;
    float R = 0.40, r = 0.075;
    float d = length(q) - 0.18; // central identity
    d = min(d, length(q - vec3(0.000, R, 0.0)) - r);
    d = min(d, length(q - vec3(0.283, 0.283, 0.0)) - r);
    d = min(d, length(q - vec3(R, 0.000, 0.0)) - r);
    d = min(d, length(q - vec3(0.283, -0.283, 0.0)) - r);
    d = min(d, length(q - vec3(0.000, -R, 0.0)) - r);
    d = min(d, length(q - vec3(-0.283, -0.283, 0.0)) - r);
    d = min(d, length(q - vec3(-R, 0.000, 0.0)) - r);
    d = min(d, length(q - vec3(-0.283, 0.283, 0.0)) - r);
    return d * br;
  }

  // 7 — Marketing: expanding concentric PULSES (reach spreading outward).
  float sdfMarketing(vec3 p, float br) {
    vec3 q = p / br;
    float d = length(q) - 0.10; // central core
    d = min(d, sdTorusZ(q, 0.26, 0.052));
    d = min(d, sdTorusZ(q, 0.42, 0.040));
    d = min(d, sdTorusZ(q, 0.56, 0.030));
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
    // connected liquid morph (lerp bridged through the fused union)
    float lerp = mix(a, b, uMorph);
    float uni = smin(a, b, ${f(K_MORPH)});
    float bridge = sin(uMorph * 3.14159265) * ${f(BRIDGE)};
    return mix(lerp, uni, bridge);
  }

  vec3 calcNormal(vec3 p, float br) {
    vec2 e = vec2(${f(NEPS)}, 0.0);
    return normalize(vec3(
      map(p + e.xyy, br) - map(p - e.xyy, br),
      map(p + e.yxy, br) - map(p - e.yxy, br),
      map(p + e.yyx, br) - map(p - e.yyx, br)
    ));
  }

  vec3 envColor(vec3 d) {
    float s = 0.0;
    s += smoothstep(0.60, 0.96, dot(d, normalize(vec3(0.35, 0.85, 0.55))));
    s += 0.85 * smoothstep(0.74, 0.99, dot(d, normalize(vec3(-0.85, 0.10, 0.45))));
    s += 0.70 * smoothstep(0.82, 0.995, dot(d, normalize(vec3(0.75, 0.40, -0.25))));
    return vec3(s);
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
