"use client";

/**
 * Morph-target geometry for the MESH metaball (the integrated/mobile glass path —
 * see lib/webgl/gpu-tier → "lite"). The raymarch's 8 SDF forms are too literal to
 * carve into a fixed-topology mesh (morph targets can't open holes), so each state
 * is an ABSTRACT cluster of glass blobs that keeps the form's *character* (the
 * mark's three lobes, AI's hub-and-ring, two gears, an ascending data stream …).
 *
 * Generation: weld an icosphere into a clean genus-0 base, then for each state
 * SHRINKWRAP it onto a smooth-min union of spheres (march each vertex down the
 * field gradient to the isosurface). The result is 8 meshes that all share the
 * base's topology → real GPU morph targets. Targets are ABSOLUTE positions with
 * `morphTargetsRelative = false`, so influences that sum to 1 give an exact
 * liquid lerp between any two forms (mercury morph, no per-frame remeshing).
 *
 * Order matches METABALL_STATES (lib/webgl/states): 0 mark · 1 web · 2 software ·
 * 3 ai · 4 automation · 5 data · 6 branding · 7 marketing.
 */

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { STATE_COUNT } from "./states";
import { METABALL_SYMBOLS, type SymbolBall } from "./symbols";

// Each form is a list of spheres [cx, cy, cz, r, k] in the same q-space the
// raymarch SDFs use (~[-0.55, 0.55]). k = smooth-union blend with the running
// accumulator (the first sphere ignores k). Bigger k = a more fused, fluid mass.
type Sphere = readonly [number, number, number, number, number];

const STATES: readonly Sphere[][] = [
  // 0 — the mark: three fluid lobes fused into one breathing body (the brand).
  [
    [-0.2, 0.12, 0.0, 0.27, 0],
    [0.22, 0.16, 0.03, 0.25, 0.18],
    [0.02, -0.24, 0.04, 0.27, 0.18],
  ],
  // 1 — web · a portal: a wide rounded screen with a drop at the sill.
  [
    [-0.34, 0.05, 0.0, 0.22, 0],
    [0.0, 0.05, 0.0, 0.25, 0.16],
    [0.34, 0.05, 0.0, 0.22, 0.16],
    [0.06, -0.3, 0.02, 0.11, 0.12],
  ],
  // 2 — software · cascading panels: a diagonal stack of slabs.
  [
    [-0.26, 0.22, 0.16, 0.22, 0],
    [0.0, 0.0, 0.0, 0.24, 0.15],
    [0.26, -0.22, -0.16, 0.22, 0.15],
  ],
  // 3 — ai · a node network: a plump hub ringed by six nodes.
  [
    [0.0, 0.0, 0.0, 0.18, 0],
    [0.0, 0.4, 0.0, 0.11, 0.1],
    [-0.346, 0.2, 0.0, 0.11, 0.1],
    [-0.346, -0.2, 0.0, 0.11, 0.1],
    [0.0, -0.4, 0.0, 0.11, 0.1],
    [0.346, -0.2, 0.0, 0.11, 0.1],
    [0.346, 0.2, 0.0, 0.11, 0.1],
  ],
  // 4 — automation · two meshing gears (two touching discs, lightly fused).
  [
    [-0.2, 0.13, 0.0, 0.3, 0],
    [0.24, -0.17, 0.0, 0.24, 0.08],
  ],
  // 5 — data · an ascending stream: four drops of growing size on a diagonal.
  [
    [-0.34, -0.3, 0.0, 0.1, 0],
    [-0.12, -0.1, 0.0, 0.13, 0.11],
    [0.12, 0.14, 0.0, 0.15, 0.11],
    [0.34, 0.34, 0.0, 0.17, 0.11],
  ],
  // 6 — branding · one essence, many expressions: a dominant orb + satellites.
  [
    [0.0, 0.0, 0.0, 0.24, 0],
    [0.02, 0.4, 0.02, 0.09, 0.09],
    [0.36, 0.2, 0.0, 0.07, 0.09],
    [0.38, -0.18, 0.03, 0.085, 0.09],
    [0.12, -0.4, 0.0, 0.06, 0.09],
    [-0.32, -0.3, 0.02, 0.085, 0.09],
    [-0.42, 0.12, 0.0, 0.07, 0.09],
  ],
  // 7 — marketing · a broadcast bloom: a source with drops fanning upward.
  [
    [0.0, -0.3, 0.0, 0.16, 0],
    [-0.3, 0.06, 0.0, 0.085, 0.11],
    [-0.1, 0.3, 0.0, 0.085, 0.11],
    [0.14, 0.34, 0.0, 0.085, 0.11],
    [0.34, 0.1, 0.0, 0.085, 0.11],
  ],
];

const MARK_STATE: readonly Sphere[] = STATES[0];

function symbolBallToSphere(ball: SymbolBall, index: number): Sphere {
  const [x, y, radius] = ball;
  const z = ((index % 3) - 1) * 0.018;
  const k = index === 0 ? 0 : Math.max(0.08, radius * 0.85);
  return [x, y, z, radius, k];
}

const SYMBOL_STATES: readonly (readonly Sphere[])[] = [
  MARK_STATE,
  ...METABALL_SYMBOLS.map((symbol) => symbol.balls.map(symbolBallToSphere)),
];

const R0 = 1.1; // start radius — safely outside every form
const ITERS = 18; // shrinkwrap steps
const RELAX = 0.8; // step damping (smooth-min underestimates distance near joins)
const EPS = 0.004; // gradient finite-difference epsilon

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

function field(prims: readonly Sphere[], x: number, y: number, z: number): number {
  let d = 0;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    const dx = x - p[0],
      dy = y - p[1],
      dz = z - p[2];
    const sd = Math.sqrt(dx * dx + dy * dy + dz * dz) - p[3];
    d = i === 0 ? sd : smin(d, sd, p[4]);
  }
  return d;
}

/**
 * Build the shared-topology morph-target geometry for the 8 states. Runs once at
 * mount (a few hundred ms on a weak CPU; the SVG shows until it's ready, then the
 * glass crossfades in). `detail` = icosphere subdivision (4 ≈ 2.5k verts).
 */
export function buildMetaballGeometry(detail = 4): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute("normal");
  ico.deleteAttribute("uv");
  const geo = mergeVertices(ico); // weld by position → clean indexed icosphere
  ico.dispose();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const N = pos.count;

  // base normals = unit-sphere normals (valid, but weight 0 once influences sum to 1)
  const baseN = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    baseN[i * 3] = pos.getX(i);
    baseN[i * 3 + 1] = pos.getY(i);
    baseN[i * 3 + 2] = pos.getZ(i);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(baseN, 3));

  const morphPos: THREE.BufferAttribute[] = [];
  const morphNor: THREE.BufferAttribute[] = [];

  for (let s = 0; s < STATE_COUNT; s++) {
    const prims = SYMBOL_STATES[s];
    const P = new Float32Array(N * 3);
    const Nr = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      // unit direction of this base vertex
      let dx = pos.getX(i),
        dy = pos.getY(i),
        dz = pos.getZ(i);
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;

      // march from outside down the gradient to the isosurface
      let x = dx * R0,
        y = dy * R0,
        z = dz * R0;
      for (let it = 0; it < ITERS; it++) {
        const d = field(prims, x, y, z);
        const gx = field(prims, x + EPS, y, z) - field(prims, x - EPS, y, z);
        const gy = field(prims, x, y + EPS, z) - field(prims, x, y - EPS, z);
        const gz = field(prims, x, y, z + EPS) - field(prims, x, y, z - EPS);
        const gl = Math.hypot(gx, gy, gz) || 1;
        const step = d * RELAX;
        x -= (gx / gl) * step;
        y -= (gy / gl) * step;
        z -= (gz / gl) * step;
      }

      // surface normal = field gradient at the landing point
      let nx = field(prims, x + EPS, y, z) - field(prims, x - EPS, y, z);
      let ny = field(prims, x, y + EPS, z) - field(prims, x, y - EPS, z);
      let nz = field(prims, x, y, z + EPS) - field(prims, x, y, z - EPS);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      P[i * 3] = x;
      P[i * 3 + 1] = y;
      P[i * 3 + 2] = z;
      Nr[i * 3] = nx;
      Nr[i * 3 + 1] = ny;
      Nr[i * 3 + 2] = nz;
    }

    morphPos.push(new THREE.BufferAttribute(P, 3));
    morphNor.push(new THREE.BufferAttribute(Nr, 3));
  }

  geo.morphAttributes.position = morphPos;
  geo.morphAttributes.normal = morphNor;
  geo.morphTargetsRelative = false; // absolute targets → Σinfluences=1 ⇒ exact lerp
  geo.computeBoundingSphere();
  return geo;
}
