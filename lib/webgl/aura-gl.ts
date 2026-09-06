/**
 * THE AURA'S RENDERER — the smallest thing that can suspend a population of
 * motes in the viewport.
 *
 * One WebGL2 context; two programs; one empty VAO, because neither program has
 * an attribute. The STEP is a fullscreen triangle over a SIZE x SIZE float
 * texture, ping-ponged — one fragment is one mote and one pass is one fixed
 * substep. The DRAW is an instanced quad per mote off `gl_InstanceID`. The
 * shaders and the tuning live in `aura-shaders.mjs`; this is only the plumbing.
 *
 * ONE RGBA32F TARGET, NOT THE MIST'S TWO. `mist-gl.ts` carries a second
 * attachment (life, capture state, host, phase) and needs MRT and `drawBuffers`
 * for it. Every one of those channels exists to serve S7's choreography —
 * emission from a droplet, capture as its skin, release, spelling the name —
 * and a background has none of that. Position and velocity fit one texel, so
 * this needs no MRT, no draw-buffer setup, and no second framebuffer
 * attachment per pair.
 *
 * FLOAT IS REQUIRED, AND HALF FLOAT IS NOT ENOUGH. Positions live in roughly
 * [-0.1, 1.8]; half float carries about 1e-3 of absolute precision up there,
 * which is a whole pixel on a 900 px viewport, while a mote moves 0.66 px in a
 * frame. Quantised to that grid the field would stall and jump rather than
 * drift. So `EXT_color_buffer_float` is a hard requirement; a context without
 * it gets no vapour and the CSS ground stands alone, which is a calm and
 * complete background in its own right.
 *
 * IT IS A SEPARATE CONTEXT FROM THE LIQUID, ON PURPOSE. FieldStage's canvas is
 * the site's material, it is fill-rate bound, and it demotes itself through
 * seven rungs on sustained slow frames; the atmosphere has no business inside
 * that budget or that watchdog. The step pass here is 160 x 160 fragments -
 * 0.026 Mpx - and the draw covers a few thousand pixels of tiny quads, against
 * the liquid's ~1.9 Mpx.
 *
 * It does READ the liquid, one way only: `packOccluders` takes the droplet
 * buffer FieldStage publishes and hands the draw shader the largest bodies, so
 * the vapour can take itself out of them. Nothing is written back, and a route
 * without liquid simply has none to read.
 *
 * `startAura()` returns a stop function. Everything it owns is released there.
 */

import {
  AURA,
  AURA_VERT,
  AURA_STEP_FRAG,
  AURA_DRAW_VERT,
  AURA_DRAW_FRAG,
  assertAscii,
  auraSize,
} from "./aura-shaders.mjs";

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    // Not thrown: a background that cannot compile must degrade, never break
    // the page. The caller keeps its CSS ground when start() returns null.
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

function link(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[aura] link:", gl.getProgramInfoLog(p));
    }
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

export type AuraStats = {
  size: number;
  count: number;
  steps: number;
  frames: number;
  /** Liquid droplets the vapour is currently taking itself out of. */
  occluders: number;
  /** GL's own verdict on the last frame; 0 is NO_ERROR. */
  err: number;
  /** The drawing buffer, in device pixels. */
  buf: [number, number];
  /**
   * DIAGNOSTIC ONLY — a synchronous readback of the state texture and of what
   * the last frame actually painted. The mist carries the same thing for the
   * same reason: a near-black particle layer cannot be judged from a
   * screenshot, and "the field is stepping" and "the field is visible" are
   * different claims that fail independently. No render path calls this.
   */
  probe(): {
    /** Mean and extent of the population's positions, in field units. */
    meanX: number;
    meanY: number;
    minX: number;
    maxX: number;
    /** Mean speed, units/s. Zero means the current is not reaching them. */
    speed: number;
    /** Brightest channel the last drawn frame put on the canvas, 0..255. */
    peak: number;
    /** Share of the canvas carrying any light at all. */
    covered: number;
  };
};

export type AuraHandle = {
  stop: () => void;
  /** DIAGNOSTIC ONLY — what the probe reads to describe the live field. */
  readonly stats: AuraStats;
};

/**
 * Drive `canvas` as the aura's vapour.
 *
 * @param canvas the layer's canvas — sized here, from its CSS box
 * @param still  advance the field once and hold it (prefers-reduced-motion)
 * @param tier   "lite" halves the population
 * @returns a handle, or null when the context or the float target is refused —
 *          the caller keeps the CSS ground in that case
 */
export function startAura(
  canvas: HTMLCanvasElement,
  still = false,
  tier: "full" | "lite" = "full",
): AuraHandle | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    // The frame is redrawn from state every time; there is nothing to keep.
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  // See the header: half float is not precise enough to hold a position here,
  // so this is a hard requirement rather than a preference with a fallback.
  if (!gl.getExtension("EXT_color_buffer_float")) return null;

  if (process.env.NODE_ENV !== "production") {
    // GLSL ES rejects non-ASCII in comments and reports nothing; catch it here
    // rather than shipping a layer that silently never starts.
    assertAscii("AURA_VERT", AURA_VERT);
    assertAscii("AURA_STEP_FRAG", AURA_STEP_FRAG);
    assertAscii("AURA_DRAW_VERT", AURA_DRAW_VERT);
    assertAscii("AURA_DRAW_FRAG", AURA_DRAW_FRAG);
  }

  const pStep = link(gl, AURA_VERT, AURA_STEP_FRAG);
  const pDraw = link(gl, AURA_DRAW_VERT, AURA_DRAW_FRAG);
  if (!pStep || !pDraw) {
    if (pStep) gl.deleteProgram(pStep);
    if (pDraw) gl.deleteProgram(pDraw);
    return null;
  }

  const size = auraSize(tier);
  const count = size * size;

  // ── the state: one RGBA32F texel per mote, ping-ponged ─────────────────────
  const makeState = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tex = [makeState(), makeState()];
  const fbo = [gl.createFramebuffer(), gl.createFramebuffer()];
  let complete = true;
  for (let k = 0; k < 2; k++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[k]);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex[k],
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      complete = false;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // A VAO is required in WebGL2 even to draw from gl_VertexID alone. Neither
  // program has an attribute, so one empty VAO serves both.
  const vao = gl.createVertexArray();

  const release = () => {
    gl.deleteProgram(pStep);
    gl.deleteProgram(pDraw);
    for (const t of tex) gl.deleteTexture(t);
    for (const f of fbo) gl.deleteFramebuffer(f);
    gl.deleteVertexArray(vao);
  };
  if (!complete) {
    release();
    return null;
  }

  gl.bindVertexArray(vao);
  gl.useProgram(pStep);
  gl.uniform1i(gl.getUniformLocation(pStep, "uState"), 0);
  gl.uniform1i(gl.getUniformLocation(pStep, "uSize"), size);
  gl.uniform1f(gl.getUniformLocation(pStep, "uMargin"), AURA.MARGIN);
  const uS = {
    dt: gl.getUniformLocation(pStep, "uDt"),
    time: gl.getUniformLocation(pStep, "uTime"),
    seed: gl.getUniformLocation(pStep, "uSeed"),
    field: gl.getUniformLocation(pStep, "uField"),
    scroll: gl.getUniformLocation(pStep, "uScroll"),
  };
  gl.useProgram(pDraw);
  gl.uniform1i(gl.getUniformLocation(pDraw, "uState"), 0);
  gl.uniform1i(gl.getUniformLocation(pDraw, "uSize"), size);
  gl.uniform1f(gl.getUniformLocation(pDraw, "uMargin"), AURA.MARGIN);
  const uD = {
    pxUv: gl.getUniformLocation(pDraw, "uPxUv"),
    alpha: gl.getUniformLocation(pDraw, "uAlpha"),
    field: gl.getUniformLocation(pDraw, "uField"),
    occ: gl.getUniformLocation(pDraw, "uOcc"),
    occN: gl.getUniformLocation(pDraw, "uOccN"),
  };

  let cur = 0; // the pair holding the CURRENT state
  let bufW = 0;
  let bufH = 0;
  let field: [number, number] = [1.6, 1];
  let pxUv = 1 / 900;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const cssW = Math.max(1, r.width);
    const cssH = Math.max(1, r.height);
    // Real device pixels. This layer's cost is its STEP pass and a few thousand
    // tiny quads, not its fill, so unlike the wash it replaced there is nothing
    // to buy by rendering it small - and a mote is 1.5 CSS px, which is exactly
    // the size that wants the extra samples along its edge.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.max(1, Math.round(cssW * dpr));
    const nh = Math.max(1, Math.round(cssH * dpr));
    if (nw !== bufW || nh !== bufH) {
      bufW = nw;
      bufH = nh;
      canvas.width = nw;
      canvas.height = nh;
      stats.buf = [nw, nh];
    }
    // The field's y is the viewport HEIGHT, so x carries the aspect and the
    // weather is never stretched by the shape of the window.
    field = [cssW / cssH, 1];
    pxUv = 1 / cssH;
  };

  const bindState = (k: number) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[k]);
  };

  // Reading the canvas back needs the frame to still be there. The default
  // drawing buffer is cleared by the compositor after every paint, so the probe
  // draws its own frame first (see probe() below) rather than trusting that the
  // last one survived.
  let readState: Float32Array | null = null;
  let readPix: Uint8Array | null = null;

  const stats: AuraStats = {
    size,
    count,
    steps: 0,
    frames: 0,
    occluders: 0,
    err: 0,
    buf: [0, 0],
    probe() {
      if (!readState) readState = new Float32Array(count * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo[cur]);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, readState);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      let sx = 0;
      let sy = 0;
      let sv = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < count; i++) {
        const x = readState[i * 4];
        const y = readState[i * 4 + 1];
        sx += x;
        sy += y;
        sv += Math.hypot(readState[i * 4 + 2], readState[i * 4 + 3]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      // Redraw into the current buffer and read it straight back, so what is
      // measured is this call's own frame rather than whatever the compositor
      // has already discarded.
      draw();
      const w = Math.min(bufW, 900);
      const h = Math.min(bufH, 600);
      if (!readPix || readPix.length < w * h * 4) readPix = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, readPix);
      let peak = 0;
      let covered = 0;
      for (let i = 0; i < w * h; i++) {
        const v = Math.max(readPix[i * 4 + 1], readPix[i * 4 + 2]);
        if (v > peak) peak = v;
        if (v > 0) covered++;
      }
      return {
        meanX: sx / count,
        meanY: sy / count,
        minX,
        maxX,
        speed: sv / count,
        peak,
        covered: covered / (w * h),
        sample: Array.from(readState.slice(0, 16)),
      };
    },
  };

  const runStep = (dtS: number, tS: number, scroll: number, seed: boolean) => {
    const next = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]);
    gl.viewport(0, 0, size, size);
    // BLENDING OFF, AND THIS IS NOT HOUSEKEEPING. Blend state is global and
    // survives both the program switch and the framebuffer switch, so the
    // ONE/ONE the draw pass leaves enabled turns this pass from a write into an
    // ACCUMULATOR: every substep adds the new state to the old one instead of
    // replacing it. The symptom is a physics one - positions leave the box, and
    // speeds sail past a cap that is right there in the shader - which is why
    // it cost a canary to find. `mist-gl.ts` disables it at the top of step()
    // for exactly this reason.
    gl.disable(gl.BLEND);
    bindState(cur);
    gl.uniform1f(uS.dt, dtS);
    gl.uniform1f(uS.time, tS);
    gl.uniform1f(uS.seed, seed ? 1 : 0);
    gl.uniform1f(uS.scroll, scroll);
    gl.uniform2f(uS.field, field[0], field[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = next;
    stats.steps++;
  };

  // ── THE OCCLUDERS ──────────────────────────────────────────────────────────
  // The liquid's own droplets, so the vapour can take itself out of them. The
  // buffer is a LIVE reference FieldStage publishes for the measurement
  // harnesses (`window.__optics.balls`, packed x/y/r by slot, with `dens`
  // alongside); it is read, never held, and a route with no liquid simply has
  // no `__optics` and contributes nothing.
  //
  // Only the biggest OCCLUDERS of them are sent. The metaball field is
  // dominated by the largest bodies, and the population above the authored 48
  // is motes - small shells derived from a host, sitting inside the field that
  // host already creates - so taking the largest is taking the ones that decide
  // the surface. Selection is an insertion into a fixed array rather than a
  // sort, so a 512-droplet frame costs one pass and no allocation.
  const occ = new Float32Array(AURA.OCCLUDERS * 4);
  const pick = new Int32Array(AURA.OCCLUDERS);
  type Optics = { balls?: Float32Array; dens?: Float32Array; count?: number };
  const packOccluders = (aspect: number) => {
    const o = (window as unknown as { __optics?: Optics }).__optics;
    const balls = o?.balls;
    const n = Math.min(o?.count ?? 0, balls ? (balls.length / 3) | 0 : 0);
    if (!balls || n <= 0) return 0;
    const dens = o?.dens;
    // The liquid works in field uv: the viewport centre is (0.5, 0.5), the unit
    // is min(width, height) and y points up. This field's unit is the HEIGHT
    // and its origin is the bottom-left, so one scale and one offset convert
    // both the positions and the radii. min(width, height) / height is exactly
    // min(aspect, 1), which is 1 on any landscape window.
    const s = Math.min(aspect, 1);
    const half = aspect * 0.5;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const r = balls[i * 3 + 2];
      if (!(r > 0)) continue;
      if (k < AURA.OCCLUDERS) {
        pick[k++] = i;
        // keep the array ordered smallest-first so the head is the drop victim
        for (let j = k - 1; j > 0 && balls[pick[j - 1] * 3 + 2] > r; j--) {
          const t = pick[j];
          pick[j] = pick[j - 1];
          pick[j - 1] = t;
        }
      } else if (r > balls[pick[0] * 3 + 2]) {
        pick[0] = i;
        for (let j = 0; j + 1 < AURA.OCCLUDERS && balls[pick[j + 1] * 3 + 2] < r; j++) {
          const t = pick[j];
          pick[j] = pick[j + 1];
          pick[j + 1] = t;
        }
      }
    }
    for (let j = 0; j < k; j++) {
      const i = pick[j];
      occ[j * 4] = half + (balls[i * 3] - 0.5) * s;
      occ[j * 4 + 1] = 0.5 + (balls[i * 3 + 1] - 0.5) * s;
      occ[j * 4 + 2] = balls[i * 3 + 2] * s;
      occ[j * 4 + 3] = dens ? dens[i] : 1;
    }
    return k;
  };

  const draw = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, bufW, bufH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pDraw);
    bindState(cur);
    gl.uniform1f(uD.pxUv, pxUv);
    gl.uniform1f(uD.alpha, 1);
    gl.uniform2f(uD.field, field[0], field[1]);
    const occN = packOccluders(field[0]);
    stats.occluders = occN;
    if (occN > 0) gl.uniform4fv(uD.occ, occ);
    gl.uniform1i(uD.occN, occN);
    // Premultiplied light, accumulated. See the note in AURA_DRAW_FRAG: over an
    // ink page under `screen`, what lands here IS what the reader sees.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    stats.frames++;
    // getError() is a synchronous round trip, so it is sampled only over the
    // opening frames - long enough to catch a setup fault, short enough not to
    // be a per-frame stall.
    if (stats.frames <= 4) stats.err = gl.getError() || stats.err;
  };

  // ── the clock ──────────────────────────────────────────────────────────────
  const hS = AURA.H_MS / 1000;
  const t0 = performance.now();
  let acc = 0;
  let lastNow = t0;
  let nextDrawAt = 0;
  let raf = 0;
  let lost = false;

  // Scroll, in viewport-heights per second, read the way PageStage reads it:
  // from the position, once a frame. Lenis owns smooth scrolling on this site
  // and native scroll events arrive coarse and stale, so a listener would make
  // the lean visibly lag the page.
  let lastY = typeof window === "undefined" ? 0 : window.scrollY;
  let scroll = 0;

  const advance = (now: number) => {
    const dtMs = Math.min(Math.max(now - lastNow, 0), 100);
    lastNow = now;
    const vh = Math.max(1, window.innerHeight);
    const y = window.scrollY;
    const raw = dtMs > 0 ? ((y - lastY) / vh) * (1000 / dtMs) : 0;
    lastY = y;
    // Smoothed, then clamped: an unfiltered per-frame delta is spiky enough to
    // read as a twitch in the field, and a fling must lean the air rather than
    // blow it off the screen.
    scroll = scroll * 0.72 + raw * 0.28;
    const sc = Math.max(-AURA.SCROLL_CLAMP, Math.min(AURA.SCROLL_CLAMP, scroll));

    acc += dtMs;
    let n = 0;
    gl.useProgram(pStep);
    while (acc >= AURA.H_MS && n < AURA.MAX_STEPS) {
      acc -= AURA.H_MS;
      runStep(hS, ((now - acc - t0) / 1000) * AURA.TIME, sc, false);
      n++;
    }
    if (n === AURA.MAX_STEPS) acc = 0; // spiral-of-death guard
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (lost) return;
    // Throttle: the field renews over a minute, so 30 fps is imperceptible on
    // it and halves the cost outright.
    if (now < nextDrawAt) return;
    nextDrawAt = now + 1000 / AURA.FPS;
    resize();
    advance(now);
    draw();
  };

  const onLost = (e: Event) => {
    // Default would make the context unrestorable.
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    // Nothing to rebuild by hand: the caller remounts the layer, which is
    // cheaper to reason about than re-uploading state this renderer keeps on
    // the GPU anyway.
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  // ── the cold start ─────────────────────────────────────────────────────────
  resize();
  gl.useProgram(pStep);
  runStep(hS, 0, 0, true);
  for (let k = 0; k < AURA.WARMUP; k++) runStep(hS, (k * hS) * AURA.TIME, 0, false);
  draw();

  if (!still) raf = requestAnimationFrame(frame);

  return {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      release();
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
    get stats() {
      return stats;
    },
  };
}
