/**
 * THE AURA'S RENDERER — the smallest thing that can draw a live field.
 *
 * One WebGL2 context, one program, one fullscreen triangle drawn from
 * `gl_VertexID` (no buffers, no VAO contents, nothing to bind). The shader and
 * its tuning live in `aura-shaders.mjs`; this is only the plumbing.
 *
 * IT IS A SEPARATE CONTEXT FROM THE LIQUID, ON PURPOSE. FieldStage's canvas is
 * the site's material and is fill-rate bound; the atmosphere has no business
 * inside its budget or its watchdog. At quarter resolution and 30 fps this
 * draws about 0.08 Mpx against the liquid's ~1.9, so the two are not competing
 * for anything worth measuring — and if this context is refused or lost, the
 * liquid never notices, because the caller falls back to the CSS vapour that
 * was here before it.
 *
 * `start()` returns a stop function. Everything it owns is released there.
 */

import { AURA, AURA_VERT, AURA_FRAG, assertAscii } from "./aura-shaders.mjs";

/** Cyan-deep (#00B6CC) in linear-ish 0..1 — the palette's darkest cyan. */
const TINT: [number, number, number] = [0, 182 / 255, 204 / 255];

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    // Not thrown: a background that cannot compile must degrade, never break
    // the page. The caller keeps its CSS fallback when start() returns null.
    if (process.env.NODE_ENV !== "production") {
      // The info log is null on some drivers when the source itself was
      // rejected outright, so report what was actually handed to GL as well.
      console.warn(
        "[aura] shader failed:",
        JSON.stringify({
          log: gl.getShaderInfoLog(s),
          glError: gl.getError(),
          len: src.length,
          head: src.slice(0, 48),
          nonAscii: [...src].findIndex((ch) => (ch.codePointAt(0) ?? 0) > 127),
        }),
      );
    }
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export type AuraHandle = { stop: () => void };

/**
 * Drive `canvas` as the aura's vapour.
 *
 * @param canvas   the layer's canvas — sized here, from its CSS box
 * @param still    render ONE frame and hold it (prefers-reduced-motion)
 * @returns a handle, or null if WebGL2 is unavailable — caller keeps the CSS
 *          vapour in that case
 */
export function startAura(
  canvas: HTMLCanvasElement,
  still = false,
): AuraHandle | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    // The field is redrawn every frame from a clock; there is nothing to keep.
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  if (process.env.NODE_ENV !== "production") {
    // GLSL ES rejects non-ASCII in comments and reports nothing; catch it here
    // rather than shipping a layer that silently never starts.
    assertAscii("AURA_VERT", AURA_VERT);
    assertAscii("AURA_FRAG", AURA_FRAG);
  }

  const vs = compile(gl, gl.VERTEX_SHADER, AURA_VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, AURA_FRAG);
  const prog = vs && fs ? gl.createProgram() : null;
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[aura] link:", gl.getProgramInfoLog(prog));
    }
    return null;
  }

  gl.useProgram(prog);
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uAspect = gl.getUniformLocation(prog, "uAspect");
  gl.uniform3fv(gl.getUniformLocation(prog, "uTint"), TINT);
  gl.uniform2f(
    gl.getUniformLocation(prog, "uShape"),
    AURA.THRESHOLD,
    AURA.KNEE,
  );
  gl.uniform1f(gl.getUniformLocation(prog, "uWarp"), AURA.WARP);

  // The shader writes premultiplied alpha and the layer may only add light.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // A VAO is required in WebGL2 even to draw from gl_VertexID alone.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  let w = 0;
  let h = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    // Quarter-res, and never zero — a zero-sized drawing buffer is a GL error.
    const nw = Math.max(1, Math.round(r.width * AURA.RES));
    const nh = Math.max(1, Math.round(r.height * AURA.RES));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    // Aspect-correct so a wide viewport gets MORE weather rather than the same
    // weather stretched. The smaller dimension is the unit.
    const m = Math.min(w, h) || 1;
    gl.uniform2f(uAspect, (w / m) * AURA.SCALE, (h / m) * AURA.SCALE);
  };

  const draw = (tSeconds: number) => {
    resize();
    gl.uniform1f(uTime, tSeconds * AURA.TIME);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let raf = 0;
  let lost = false;
  const t0 = performance.now();
  const step = 1000 / AURA.FPS;
  let nextAt = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (lost) return;
    // Throttle: the field turns over in ~45s, so 30fps is imperceptible on it
    // and halves the cost outright.
    if (now < nextAt) return;
    nextAt = now + step;
    draw((now - t0) / 1000);
  };

  const onLost = (e: Event) => {
    // Default would make the context unrestorable.
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    // Nothing to rebuild by hand: the caller remounts the layer, which is
    // cheaper to reason about than re-uploading state this renderer has none of.
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  if (still) {
    // Reduced motion: one frame, held. The field is a composition, not a
    // sequence, so a single sample of it is a perfectly good background.
    draw(0);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.deleteProgram(prog);
      gl.deleteVertexArray(vao);
      // DELIBERATELY NOT `WEBGL_lose_context().loseContext()`.
      //
      // `getContext` is per-CANVAS, not per-call: the second call on the same
      // element returns the SAME context object. React StrictMode invokes
      // effects twice in development — mount, clean up, mount — against one
      // canvas, so forcing the context lost on the way out hands the remount a
      // permanently dead context. Every compile then fails with
      // CONTEXT_LOST_WEBGL and a null info log, which reads exactly like a
      // broken shader and is not one. (The same trap the entry veil documents
      // for its own double-invoke.) The context dies with the canvas anyway.
    },
  };
}
