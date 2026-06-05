"use client";

/**
 * Bake the raymarched glass look into a MATCAP for the mesh metaball (the
 * integrated/mobile path). A matcap is a sphere of the material as seen from the
 * camera: we render one fullscreen pass whose per-fragment shading is COPIED from
 * MetaballScene's raymarch (cyan body + IOR 1.34 refraction tint, the three-light
 * `envProc` speculars, fresnel, the two clearcoat lobes), evaluated at a sphere
 * normal. Sampling that texture by the mesh's view-space normal reproduces the
 * raymarch's surface almost exactly — but as a single texture lookup, so it runs
 * at 60fps on an integrated GPU with no per-pixel loop (no TDR freeze).
 *
 * Rendered once into an offscreen WebGL context and read back into a CPU-side
 * DataTexture, so it's safe to hand to the R3F renderer (different GL context).
 * Cached per session.
 */

import * as THREE from "three";

const SIZE = 512;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Shading lifted from MetaballScene's fragment `main()` (the surface part), with
// the matcap normal standing in for the raymarched surface normal.
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

#define IOR 1.34
const vec3 CY_GLOW = vec3(0.55, 0.96, 1.0);  // bright cyan at the rim
const vec3 CY      = vec3(0.0, 0.89, 0.996);  // brand cyan, mid-body
const vec3 CY_DEEP = vec3(0.0, 0.42, 0.60);  // rich deep teal through the thick centre

// the raymarch's procedural 3-light environment (white-on-cyan speculars)
float envProc(vec3 d) {
  float s = 0.0;
  s += smoothstep(0.60, 0.96, dot(d, normalize(vec3(0.35, 0.85, 0.55))));
  s += 0.85 * smoothstep(0.74, 0.99, dot(d, normalize(vec3(-0.85, 0.10, 0.45))));
  s += 0.70 * smoothstep(0.82, 0.995, dot(d, normalize(vec3(0.75, 0.40, -0.25))));
  return s;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;          // matcap disc, [-1, 1]
  float r2 = dot(p, p);
  if (r2 > 1.0) p = normalize(p);    // clamp to the silhouette
  float z = sqrt(max(0.0, 1.0 - dot(p, p)));
  vec3 n = vec3(p, z);               // view-space surface normal
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);

  float facing = max(n.z, 0.0);
  float edge = 1.0 - facing;
  float fres = 0.04 + 0.96 * pow(edge, 5.0);
  vec3 reflCol = vec3(envProc(reflect(rd, n)));

  // refraction approximation: tint the body by the env seen through the glass
  vec3 rdr = refract(rd, n, 1.0 / IOR);
  vec3 through = vec3(envProc(rdr));

  // thickness ramp: looking straight on (facing≈1) we see through the THICK centre
  // → rich deep teal; toward the rim (facing≈0) the glass thins → bright cyan glow.
  // Two stops through brand cyan so the mid-body reads as #00E3FE, not milky.
  float td = pow(facing, 0.7);
  vec3 body = td < 0.5
    ? mix(CY_GLOW, CY, td * 2.0)
    : mix(CY, CY_DEEP, (td - 0.5) * 2.0);
  body += through * 0.28;

  vec3 col = mix(body, reflCol, fres);
  col += reflCol * 0.34;                                  // softened reflections (less wash)
  col += CY_GLOW * pow(edge, 3.0) * 0.24;                 // cyan rim bloom

  // clearcoat — two sharp specular lobes → wet, glossy liquid glass
  vec3 L1 = normalize(vec3(0.42, 0.78, 0.55));
  vec3 L2 = normalize(vec3(-0.62, 0.34, 0.42));
  float cc = pow(max(dot(n, normalize(L1 + V)), 0.0), 210.0)
           + 0.55 * pow(max(dot(n, normalize(L2 + V)), 0.0), 120.0);
  col += vec3(1.0) * cc * 0.8;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

let cached: THREE.Texture | null | undefined;

/** The baked cyan-glass matcap (512², RGBA8). Null if WebGL2 is unavailable. */
export function bakeGlassMatcap(): THREE.Texture | null {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      cached = null;
      return null;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      cached = null;
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, SIZE, SIZE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const raw = new Uint8Array(SIZE * SIZE * 4);
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, raw);

    // readPixels is bottom-up; flip rows so the texture reads top-down like an image
    const data = new Uint8Array(SIZE * SIZE * 4);
    const stride = SIZE * 4;
    for (let y = 0; y < SIZE; y++) {
      data.set(raw.subarray(y * stride, y * stride + stride), (SIZE - 1 - y) * stride);
    }

    const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;

    // release the bake context
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();

    cached = tex;
    return tex;
  } catch {
    cached = null;
    return null;
  }
}
