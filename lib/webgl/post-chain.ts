"use client";

/**
 * makePostChain (R5-C, metaball-morph-spec §10.2) — the framebuffer pipeline
 * behind the one liquid canvas:
 *
 *   scene → offscreen target (RGBA16F where EXT_color_buffer_float renders,
 *   RGBA8 fallback) → half-res bright pass → separable gaussian ping-pong →
 *   opaque composite to the backbuffer (bloom + dither + grain).
 *
 * Ownership contract with FieldStage: begin() binds the scene target (the
 * stage draws exactly as it would to the backbuffer — same viewport, same
 * clear); end() runs the chain and leaves the DEFAULT framebuffer bound and
 * the default VAO active. The chain renders through its OWN VAO, so the
 * scene program's attribute state (set once by makeLayer on the default VAO)
 * is never disturbed. Blend state is owned by the caller.
 *
 * Returns null when the pipeline cannot be built (no renderable color
 * format, shader/link failure) — the caller keeps the direct path, which is
 * exactly the full-nofx behavior (§12.3).
 */

import {
  POST_VERT,
  POST_BRIGHT_FRAG,
  POST_BLUR_FRAG,
  POST_COMPOSITE_FRAG,
  POST,
} from "./post-shaders.mjs";

export type PostChain = {
  fmt: "f16" | "rgba8";
  /** Bind the scene target (lazily (re)sized to w×h). The caller then draws
   *  the scene pass into it — viewport and clear included. */
  begin(w: number, h: number): void;
  /** bright → blur ping-pong → composite to the backbuffer. */
  end(tSec: number): void;
  dispose(): void;
};

export function makePostChain(gl: WebGL2RenderingContext): PostChain | null {
  let fmt: "f16" | "rgba8" = gl.getExtension("EXT_color_buffer_float")
    ? "f16"
    : "rgba8";

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  };
  const program = (frag: string) => {
    const v = compile(gl.VERTEX_SHADER, POST_VERT);
    const f = compile(gl.FRAGMENT_SHADER, frag);
    if (!v || !f) return null;
    const p = gl.createProgram();
    if (!p) return null;
    gl.bindAttribLocation(p, 0, "position"); // one VAO serves all three
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  };

  const pBright = program(POST_BRIGHT_FRAG);
  const pBlur = program(POST_BLUR_FRAG);
  const pComp = program(POST_COMPOSITE_FRAG);
  if (!pBright || !pBlur || !pComp) return null;
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);

  // static uniforms once (sampler indices + the POST dial-in)
  gl.useProgram(pBright);
  gl.uniform1i(U(pBright, "iScene"), 0);
  gl.uniform1f(U(pBright, "iTh"), POST.TH);
  gl.uniform1f(U(pBright, "iKnee"), POST.KNEE);
  gl.useProgram(pBlur);
  gl.uniform1i(U(pBlur, "iTex"), 0);
  gl.useProgram(pComp);
  gl.uniform1i(U(pComp, "iScene"), 0);
  gl.uniform1i(U(pComp, "iBloom"), 1);
  gl.uniform1f(U(pComp, "iBloomAmt"), POST.AMT);
  gl.uniform1f(U(pComp, "iGrain"), POST.GRAIN);
  const uDir = U(pBlur, "iDir");
  const uT = U(pComp, "iT");

  // fullscreen triangle on the chain's OWN VAO (attrib 0 everywhere)
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const texScene = gl.createTexture();
  const texA = gl.createTexture();
  const texB = gl.createTexture();
  const fboScene = gl.createFramebuffer();
  const fboA = gl.createFramebuffer();
  const fboB = gl.createFramebuffer();

  const alloc = (tex: WebGLTexture | null, tw: number, th: number) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      fmt === "f16" ? gl.RGBA16F : gl.RGBA8,
      tw,
      th,
      0,
      gl.RGBA,
      fmt === "f16" ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const attach = (fbo: WebGLFramebuffer | null, tex: WebGLTexture | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  };

  let w = 0;
  let h = 0;
  let hw = 0;
  let hh = 0;
  const size = (nw: number, nh: number) => {
    if (nw === w && nh === h) return true;
    w = nw;
    h = nh;
    hw = Math.max(1, nw >> 1);
    hh = Math.max(1, nh >> 1);
    alloc(texScene, w, h);
    alloc(texA, hw, hh);
    alloc(texB, hw, hh);
    let ok = attach(fboScene, texScene) && attach(fboA, texA) && attach(fboB, texB);
    if (!ok && fmt === "f16") {
      // half-float allocations refused by this driver — fall back to RGBA8
      fmt = "rgba8";
      alloc(texScene, w, h);
      alloc(texA, hw, hh);
      alloc(texB, hw, hh);
      ok = attach(fboScene, texScene) && attach(fboA, texA) && attach(fboB, texB);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok;
  };
  // probe completeness up front so a hopeless context degrades to direct
  if (!size(4, 4)) {
    dispose();
    return null;
  }

  function dispose() {
    gl.deleteProgram(pBright);
    gl.deleteProgram(pBlur);
    gl.deleteProgram(pComp);
    gl.deleteTexture(texScene);
    gl.deleteTexture(texA);
    gl.deleteTexture(texB);
    gl.deleteFramebuffer(fboScene);
    gl.deleteFramebuffer(fboA);
    gl.deleteFramebuffer(fboB);
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(vao);
  }

  return {
    get fmt() {
      return fmt;
    },
    begin(nw: number, nh: number) {
      size(nw, nh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboScene);
    },
    end(tSec: number) {
      gl.bindVertexArray(vao);
      // bright: scene → A (half res)
      gl.useProgram(pBright);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
      gl.viewport(0, 0, hw, hh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texScene);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // separable gaussian ping-pong, growing radius per iteration
      gl.useProgram(pBlur);
      for (const r of POST.RADII) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        gl.uniform2f(uDir, r / hw, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
        gl.bindTexture(gl.TEXTURE_2D, texB);
        gl.uniform2f(uDir, 0, r / hh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // opaque composite to the backbuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pComp);
      gl.uniform1f(uT, tSec);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texScene);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose,
  };
}
