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
  /** 1 while the liquid's canvas is being sampled as an occlusion mask. */
  mask: number;
  /** Rolling cost of that upload, ms. */
  maskMs: number;
  /** Motes actually drawn: the population scaled to the viewport's area. */
  drawn: number;
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
    /** Brightest pixel in the uploaded liquid mask; 0 means it came back blank. */
    maskPeak: number;
  };
};

export type AuraHandle = {
  stop: () => void;
  /** Park invisible atmosphere without discarding its particle state. */
  setVisible: (visible: boolean) => void;
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
  // Declared here rather than beside the mask block below, because release()
  // runs on an incomplete framebuffer - which happens before that block - and a
  // const in the temporal dead zone would throw instead of cleaning up.
  // Declared here rather than beside the blocks that build them, because
  // release() runs on an incomplete framebuffer - before those blocks - and a
  // const in the temporal dead zone would throw instead of cleaning up.
  let maskTex: WebGLTexture | null = null;

  const release = () => {
    gl.deleteProgram(pStep);
    gl.deleteProgram(pDraw);
    for (const t of tex) gl.deleteTexture(t);
    for (const f of fbo) gl.deleteFramebuffer(f);
    if (maskTex) gl.deleteTexture(maskTex);
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
  gl.uniform1i(gl.getUniformLocation(pDraw, "uMask"), 1);
  const uD = {
    pxUv: gl.getUniformLocation(pDraw, "uPxUv"),
    alpha: gl.getUniformLocation(pDraw, "uAlpha"),
    field: gl.getUniformLocation(pDraw, "uField"),
    maskOn: gl.getUniformLocation(pDraw, "uMaskOn"),
  };

  let cur = 0; // the pair holding the CURRENT state
  let bufW = 0;
  let bufH = 0;
  const field: [number, number] = [1.6, 1];
  let pxUv = 1 / 900;
  let share = 1;
  let sizeDirty = true;
  let measuredDpr = 0;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const cssW = Math.max(1, r.width);
    const cssH = Math.max(1, r.height);
    // Real device pixels. This layer's cost is its STEP pass and a few thousand
    // tiny quads, not its fill, so unlike the wash it replaced there is nothing
    // to buy by rendering it small - and a mote is 1.5 CSS px, which is exactly
    // the size that wants the extra samples along its edge.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    measuredDpr = dpr;
    sizeDirty = false;
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
    field[0] = cssW / cssH;
    pxUv = 1 / cssH;
    // Constant SPACING, not a constant count: see AURA.REF_PX. The motes are
    // hash-scattered, so drawing a prefix of them is a uniform random subset
    // and thinning costs nothing but a smaller instance count.
    share = Math.min(1, Math.max(AURA.MIN_SHARE, (cssW * cssH) / AURA.REF_PX));
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
    mask: 0,
    maskMs: 0,
    drawn: 0,
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
      // Is the mask carrying the liquid? A blank upload is how the first two
      // attempts failed, and both failed SILENTLY: a canvas whose context lacks
      // preserveDrawingBuffer uploads black without erroring.
      let maskPeak = 0;
      if (maskTex) {
        const mfb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, mfb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, maskTex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
          // THE WHOLE TEXTURE, not a corner of it. Reading a 640x400 window
          // reported maskPeak 0 on a frame whose liquid was simply outside that
          // window, which reads exactly like the blank-upload failure this
          // check exists to catch. A diagnostic that can cry wolf is worse than
          // none. It is a 5 MB readback and no render path calls it.
          const mw = bufW;
          const mh = bufH;
          const px = new Uint8Array(mw * mh * 4);
          gl.readPixels(0, 0, mw, mh, gl.RGBA, gl.UNSIGNED_BYTE, px);
          for (let i = 0; i < mw * mh; i++) {
            const v = Math.max(px[i * 4 + 1], px[i * 4 + 2]);
            if (v > maskPeak) maskPeak = v;
          }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(mfb);
      }
      return {
        maskPeak,
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

  // ── THE LIQUID, SAMPLED ────────────────────────────────────────────────────
  // FieldStage's canvas, uploaded here every frame and read once per mote in
  // the draw shader. It is the liquid ITSELF rather than a model of it: exact
  // for droplets, motes, forms and melts alike, where a rebuild from the
  // published droplet buffer covered none of the forms and only part of the
  // droplets. It requires `preserveDrawingBuffer` on that context, which is set
  // in `sdf-gl.ts` beside the measurement of what it cost.
  //
  // UNPACK_FLIP_Y so the canvas's top row lands at v = 1, which is this field's
  // own orientation - the sample then needs no flip and no offset.
  maskTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // The liquid canvas is looked up lazily and re-looked-up while missing: this
  // layer mounts in the locale layout and FieldStage is lazy and client-only,
  // so on the homepage it is simply not there for the first frames, and on
  // every other route it never will be.
  let liquid: HTMLCanvasElement | null = null;
  let liquidRetryAt = 0;
  const findLiquid = () => {
    if (liquid && liquid.isConnected) return liquid;
    liquid = null;
    // The layout survives routes. A capped attempt count permanently lost the
    // mask when a reader spent time elsewhere before arriving on the homepage.
    const now = performance.now();
    if (now < liquidRetryAt) return null;
    liquidRetryAt = now + 500;
    liquid = document.querySelector<HTMLCanvasElement>(".journey-canvas canvas");
    return liquid;
  };

  const uploadMask = () => {
    const src = findLiquid();
    if (!src || src.width < 2 || src.height < 2) return 0;
    const t0 = performance.now();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch {
      // A source canvas can refuse an upload while it is being resized or after
      // its own context is lost. Losing the mask for a frame is a mote or two
      // in the wrong place; throwing here would take the whole layer down.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return 0;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    stats.maskMs = stats.maskMs * 0.9 + (performance.now() - t0) * 0.1;
    return 1;
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
    stats.mask = uploadMask();
    gl.uniform1f(uD.maskOn, stats.mask);
    bindState(cur); // the upload left unit 1 bound; the state lives on unit 0
    // Premultiplied light, accumulated. See the note in AURA_DRAW_FRAG: over an
    // ink page under `screen`, what lands here IS what the reader sees.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const drawn = Math.max(1, Math.round(count * share));
    stats.drawn = drawn;
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, drawn);
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
  let visible = true;

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
    raf = 0;
    if (lost || !visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
    // Throttle: the field renews over a minute, so 30 fps is imperceptible on
    // it and halves the cost outright.
    if (now < nextDrawAt) return;
    nextDrawAt = now + 1000 / AURA.FPS;
    // Geometry changes through layout/viewport resize, not atmospheric motion.
    // Reading it on every draw forced layout after the page's animated writes.
    if (sizeDirty || measuredDpr !== Math.min(window.devicePixelRatio || 1, 2)) resize();
    advance(now);
    draw();
  };

  const sync = () => {
    if (lost || !visible || document.hidden || still) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      // Resume from the retained state, without integrating time spent hidden
      // or turning a route's scroll jump into an atmospheric gust.
      lastNow = performance.now();
      lastY = window.scrollY;
      scroll = 0;
      acc = 0;
      nextDrawAt = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  const onLost = (e: Event) => {
    // Default would make the context unrestorable.
    e.preventDefault();
    lost = true;
    sync();
  };
  const onRestored = () => {
    // Nothing to rebuild by hand: the caller remounts the layer, which is
    // cheaper to reason about than re-uploading state this renderer keeps on
    // the GPU anyway.
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", sync);
  const ro = new ResizeObserver(() => {
    sizeDirty = true;
    // Reduced motion still needs to fit an orientation/viewport change.
    if (still && !lost) { resize(); draw(); }
  });
  ro.observe(canvas);

  // ── the cold start ─────────────────────────────────────────────────────────
  resize();
  gl.useProgram(pStep);
  runStep(hS, 0, 0, true);
  for (let k = 0; k < AURA.WARMUP; k++) runStep(hS, (k * hS) * AURA.TIME, 0, false);
  draw();

  sync();

  return {
    setVisible(next) {
      if (visible === next) return;
      visible = next;
      sync();
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", sync);
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
