"use client";

/**
 * makeMist (R7) — THE MIST's GPU resources, inside the one liquid canvas.
 *
 * Owns: two ping-pong state pairs (RGBA32F where EXT_color_buffer_float
 * renders, RGBA16F under EXT_color_buffer_half_float, otherwise the mist does
 * not exist and the chapter plays on the droplets alone), the update and draw
 * programs, its own VAOs, and the per-particle letter-target texture.
 *
 * Ownership contract with FieldStage:
 *   step()  runs the fixed substeps into the ping-pong targets and leaves the
 *           DEFAULT framebuffer bound with the viewport the caller had. Call it
 *           BEFORE the liquid pass, so nothing the liquid binds is disturbed.
 *   draw()  draws into whatever framebuffer is bound (the post chain's scene
 *           target or the backbuffer) with the caller's viewport, then restores
 *           the blend state it found and the default VAO.
 *
 * THE BLEND. The scene target stores straight alpha (rgb, coverage) and the
 * composite multiplies rgb by alpha; the backbuffer is straight alpha over the
 * ink page. Vapour is LIGHT, so it adds: rgb blends ONE/ONE with the sprite's
 * premultiplied brightness, and the alpha channel takes MAX with the sprite's
 * alpha of 1 — over empty stage the pixel then carries exactly the sprite's
 * brightness, and over liquid (alpha already 1) the brightness is added to the
 * body. Bloom sees dense vapour the same way it sees dense liquid.
 */

import {
  MIST_VERT,
  MIST_UPDATE_FRAG,
  MIST_DRAW_VERT,
  MIST_DRAW_FRAG,
  MIST_HOSTS,
  MIST_OBSTACLES,
} from "./mist-shaders.mjs";
import { MIST } from "./mist.mjs";
import type { MistDials } from "./mist.mjs";
import { FLUID_OBSTACLE_STRIDE } from "./fluid-core.mjs";

export type MistStepInput = {
  dtMs: number;
  tMs: number;
  aspect: number;
  dials: MistDials;
  /** N × (x, y, skin radius, presence) — the authored droplets as displayed. */
  hosts: Float32Array;
  /** px, py, pvx, pvy, pon, press, scroll (vh/s), shockK */
  env: Float32Array;
  /** The FORM shock uniforms (xy, front, amplitude) × slots, or null. */
  shock: Float32Array | null;
  obstacles: Float32Array | null;
  obstacleCount: number;
};

export type Mist = {
  size: number;
  count: number;
  fmt: "f32" | "f16";
  /** Seed every particle at its home droplet on the next step (and warm up). */
  reset(): void;
  step(input: MistStepInput): number;
  draw(w: number, h: number, bufferScale: number, alpha: number, hosts: Float32Array): void;
  /** Glyph samples in box space [-1, 1] (K × 2); null clears the spelling. */
  setSpellSamples(samples: Float32Array | null): void;
  readonly hasSpell: boolean;
  /** Share of the population drawn (the rung ladder's lever), 0..1. */
  setShare(share: number): void;
  /** DIAGNOSTIC ONLY — a synchronous readback of the state textures: how
   *  many particles are alive and how many are skin, and the alive mean
   *  position in field uv. The browser gate measures the vapour with this
   *  instead of guessing from pixels; no render path calls it. */
  stats(): { alive: number; skin: number; meanX: number; meanY: number };
  dispose(): void;
};

const GOLDEN = 0.6180339887498949;

export function makeMist(gl: WebGL2RenderingContext, size: number): Mist | null {
  let fmt: "f32" | "f16" | null = null;
  if (gl.getExtension("EXT_color_buffer_float")) fmt = "f32";
  else if (gl.getExtension("EXT_color_buffer_half_float")) fmt = "f16";
  if (!fmt) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const program = (vert: string, frag: string, attr: string | null) => {
    const v = compile(gl.VERTEX_SHADER, vert);
    const f = compile(gl.FRAGMENT_SHADER, frag);
    if (!v || !f) {
      if (v) gl.deleteShader(v);
      if (f) gl.deleteShader(f);
      return null;
    }
    const p = gl.createProgram();
    if (!p) return null;
    if (attr) gl.bindAttribLocation(p, 0, attr);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return null;
    }
    return p;
  };

  const pUpdate = program(MIST_VERT, MIST_UPDATE_FRAG, "position");
  const pDraw = program(MIST_DRAW_VERT, MIST_DRAW_FRAG, null);
  if (!pUpdate || !pDraw) {
    if (pUpdate) gl.deleteProgram(pUpdate);
    if (pDraw) gl.deleteProgram(pDraw);
    return null;
  }
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);

  // ── the state: two pairs, ping-pong ────────────────────────────────────────
  const internal = fmt === "f32" ? gl.RGBA32F : gl.RGBA16F;
  const texType = fmt === "f32" ? gl.FLOAT : gl.HALF_FLOAT;
  const makeState = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, size, size, 0, gl.RGBA, texType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const pos = [makeState(), makeState()];
  const aux = [makeState(), makeState()];
  const fbos = [gl.createFramebuffer(), gl.createFramebuffer()];
  let complete = true;
  for (let k = 0; k < 2; k++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[k]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pos[k], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, aux[k], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) complete = false;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // the letter targets: one texel per particle, box space [-1, 1]
  const spellTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, spellTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, size, size, 0, gl.RG, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  let hasSpell = false;

  // ── VAOs: a full-screen triangle for the update, an empty one for the draw ─
  const vaoUpdate = gl.createVertexArray();
  const triBuf = gl.createBuffer();
  gl.bindVertexArray(vaoUpdate);
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  // No attributes at all: the draw derives its quad from gl_VertexID and its
  // particle from gl_InstanceID, which WebGL2 permits on an empty VAO.
  const vaoDraw = gl.createVertexArray();

  if (!complete) {
    dispose();
    return null;
  }

  // static uniforms
  gl.useProgram(pUpdate);
  gl.uniform1i(U(pUpdate, "uPos"), 5);
  gl.uniform1i(U(pUpdate, "uAux"), 6);
  gl.uniform1i(U(pUpdate, "uSpell"), 7);
  gl.uniform1i(U(pUpdate, "uSize"), size);
  gl.useProgram(pDraw);
  gl.uniform1i(U(pDraw, "uPos"), 5);
  gl.uniform1i(U(pDraw, "uAux"), 6);
  gl.uniform1i(U(pDraw, "uSize"), size);

  const uU = {
    dt: U(pUpdate, "uDt"),
    time: U(pUpdate, "uTime"),
    reset: U(pUpdate, "uReset"),
    host: U(pUpdate, "uHost"),
    dialA: U(pUpdate, "uDialA"),
    dialB: U(pUpdate, "uDialB"),
    centre: U(pUpdate, "uCentre"),
    poleB: U(pUpdate, "uPoleB"),
    hand: U(pUpdate, "uHand"),
    handK: U(pUpdate, "uHandK"),
    shock: U(pUpdate, "uShock"),
    shockK: U(pUpdate, "uShockK"),
    obs: U(pUpdate, "uObs"),
    obsW: U(pUpdate, "uObsW"),
    obsN: U(pUpdate, "uObsN"),
    spellBox: U(pUpdate, "uSpellBox"),
  };
  const uD = {
    res: U(pDraw, "uRes"),
    pxUv: U(pDraw, "uPxUv"),
    alpha: U(pDraw, "uAlpha"),
    host: U(pDraw, "uHost"),
  };

  const count = size * size;
  let share = 1;
  let cur = 0; // the pair holding the CURRENT state
  let pendingReset = true;
  let acc = 0;
  const zeroShock = new Float32Array(4 * 4);
  const obs = new Float32Array(MIST_OBSTACLES * 4);
  const obsW = new Float32Array(MIST_OBSTACLES);

  const bindState = (k: number) => {
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, pos[k]);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, aux[k]);
  };

  const runSubstep = (dtS: number, tS: number, reset: boolean) => {
    const next = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[next]);
    bindState(cur);
    gl.uniform1f(uU.dt, dtS);
    gl.uniform1f(uU.time, tS);
    gl.uniform1f(uU.reset, reset ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = next;
  };

  const step = (input: MistStepInput) => {
    const { dials, hosts, env } = input;
    const dtMs = Math.min(Math.max(input.dtMs, 0), 100);
    gl.useProgram(pUpdate);
    gl.bindVertexArray(vaoUpdate);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, size, size);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, spellTex);
    gl.uniform4fv(uU.host, hosts);
    gl.uniform4f(uU.dialA, dials.evap, dials.pull, dials.poles, dials.condense);
    gl.uniform4f(uU.dialB, dials.release, dials.spell, dials.curl, dials.floorOn);
    gl.uniform4f(uU.centre, dials.cx, dials.cy, dials.ax, dials.ay);
    gl.uniform4f(uU.poleB, dials.bx, dials.by, dials.floor, Math.max(input.aspect, 0.6) / 2);
    gl.uniform4f(uU.hand, env[0], env[1], env[2], env[3]);
    gl.uniform4f(uU.handK, env[4], env[5], env[6], hasSpell && dials.spellOn > 0.5 ? 1 : 0);
    gl.uniform4fv(uU.shock, input.shock ?? zeroShock);
    gl.uniform1f(uU.shockK, env[7]);
    const n = Math.min(input.obstacleCount, MIST_OBSTACLES);
    if (input.obstacles && n > 0) {
      for (let k = 0; k < n; k++) {
        const o = k * FLUID_OBSTACLE_STRIDE;
        obs[k * 4] = input.obstacles[o];
        obs[k * 4 + 1] = input.obstacles[o + 1];
        obs[k * 4 + 2] = input.obstacles[o + 2];
        obs[k * 4 + 3] = input.obstacles[o + 3];
        obsW[k] = input.obstacles[o + 4];
      }
    }
    gl.uniform4fv(uU.obs, obs);
    gl.uniform1fv(uU.obsW, obsW);
    gl.uniform1i(uU.obsN, input.obstacles ? n : 0);
    gl.uniform4f(uU.spellBox, dials.wx, dials.wy, dials.ww, dials.wh);

    let steps = 0;
    const hS = MIST.H_MS / 1000;
    if (pendingReset) {
      pendingReset = false;
      acc = 0;
      runSubstep(hS, input.tMs / 1000, true);
      // the warm-up: a chapter entry or a deep link lands on a settled field
      for (let k = 0; k < MIST.WARMUP; k++) {
        runSubstep(hS, input.tMs / 1000 - (MIST.WARMUP - k) * hS, false);
        steps++;
      }
    }
    acc += dtMs;
    let ran = 0;
    while (acc >= MIST.H_MS && ran < MIST.MAX_STEPS) {
      acc -= MIST.H_MS;
      runSubstep(hS, (input.tMs - acc) / 1000, false);
      ran++;
    }
    if (ran === MIST.MAX_STEPS) acc = 0; // spiral-of-death guard
    steps += ran;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    return steps;
  };

  const draw = (w: number, h: number, bufferScale: number, alpha: number, hosts: Float32Array) => {
    if (alpha <= 0.001 || share <= 0) return;
    const blendWasOn = gl.isEnabled(gl.BLEND);
    gl.useProgram(pDraw);
    gl.bindVertexArray(vaoDraw);
    bindState(cur);
    gl.uniform2f(uD.res, w, h);
    gl.uniform1f(uD.pxUv, bufferScale / Math.max(Math.min(w, h), 1));
    gl.uniform1f(uD.alpha, alpha);
    gl.uniform4fv(uD.host, hosts);
    gl.enable(gl.BLEND);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.max(1, Math.round(count * share)));
    // restore what the liquid and the post chain expect
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (!blendWasOn) gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  const spellTargets = new Float32Array(count * 2);
  const setSpellSamples = (samples: Float32Array | null) => {
    if (!samples || samples.length < 2) {
      hasSpell = false;
      return;
    }
    const k = samples.length >> 1;
    // Golden-ratio hashing spreads consecutive particles across the glyphs
    // instead of stacking the first thousand on the Z; the jitter thickens
    // the stroke so the letters read as a body of vapour, not as a lattice.
    for (let i = 0; i < count; i++) {
      const s = Math.floor(((i * GOLDEN) % 1) * k);
      const j1 = Math.sin(i * 12.9898) * 43758.5453;
      const j2 = Math.sin(i * 78.233) * 43758.5453;
      spellTargets[i * 2] = samples[s * 2] + ((j1 - Math.floor(j1)) - 0.5) * 0.012;
      spellTargets[i * 2 + 1] = samples[s * 2 + 1] + ((j2 - Math.floor(j2)) - 0.5) * 0.03;
    }
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, spellTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RG, gl.FLOAT, spellTargets);
    hasSpell = true;
  };

  let readPos: Float32Array | null = null;
  let readAux: Float32Array | null = null;
  const stats = () => {
    if (!readPos) readPos = new Float32Array(count * 4);
    if (!readAux) readAux = new Float32Array(count * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbos[cur]);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, readPos);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, readAux);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    let alive = 0;
    let skin = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < count; i++) {
      if (readAux[i * 4] <= 0) continue;
      alive++;
      if (readAux[i * 4 + 1] > 0.5) skin++;
      sx += readPos[i * 4];
      sy += readPos[i * 4 + 1];
    }
    return {
      alive,
      skin,
      meanX: alive ? sx / alive : 0,
      meanY: alive ? sy / alive : 0,
    };
  };

  function dispose() {
    gl.deleteProgram(pUpdate);
    gl.deleteProgram(pDraw);
    for (const t of pos) gl.deleteTexture(t);
    for (const t of aux) gl.deleteTexture(t);
    for (const f of fbos) gl.deleteFramebuffer(f);
    gl.deleteTexture(spellTex);
    gl.deleteBuffer(triBuf);
    gl.deleteVertexArray(vaoUpdate);
    gl.deleteVertexArray(vaoDraw);
  }

  return {
    size,
    count,
    fmt,
    reset: () => {
      pendingReset = true;
    },
    step,
    draw,
    setSpellSamples,
    get hasSpell() {
      return hasSpell;
    },
    setShare: (s: number) => {
      share = Math.max(0, Math.min(1, s));
    },
    stats,
    dispose,
  };
}

export { MIST_HOSTS };
