"use client";

import { useEffect, useRef } from "react";
import { RIBBON_VERT, RIBBON_FRAG } from "@/lib/lab/ribbon-shader";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * LAB — the liquid ribbon renderer.
 *
 * Self-contained on purpose: this is a test space, so it owns its own context,
 * its own loop and its own lifecycle rather than borrowing the homepage's
 * conductor. One quad, one fragment shader (lib/lab/ribbon-shader.ts).
 *
 * Reduced motion gets a still first frame — the composition still reads, it
 * just does not move. No WebGL2 gets a pure-CSS cyan horizon so the hero is
 * never a black band.
 */
export function HeroRibbon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      host.dataset.ribbon = "fallback";
      return;
    }
    host.dataset.ribbon = "live";

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
      return s;
    };

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, RIBBON_VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, RIBBON_FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    } catch {
      host.dataset.ribbon = "fallback";
      return;
    }
    gl.useProgram(program);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uEnter = gl.getUniformLocation(program, "uEnter");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const uEnergy = gl.getUniformLocation(program, "uEnergy");

    let width = 0;
    let height = 0;
    const resize = () => {
      // The stream is a soft, out-of-focus body of liquid — it has no edges
      // worth resolving, so it does not need device pixels. Rendering at ~0.7
      // CSS px and letting the canvas scale up is invisible here and costs
      // roughly an EIGHTH of the fragments a dpr-2 buffer did.
      const dpr = Math.min(window.devicePixelRatio || 1, 1) * 0.7;
      const r = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // pointer bias and scroll energy — damped, never per-frame allocated
    let pointerTarget = 0;
    let pointer = 0;
    let energyTarget = 0;
    let energy = 0;
    const onPointer = (e: PointerEvent) => {
      pointerTarget = (e.clientX / window.innerWidth) * 2 - 1;
    };
    const onScroll = () => {
      energyTarget = Math.min(1, window.scrollY / (window.innerHeight * 0.9));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    const start = performance.now();
    let raf = 0;
    let running = true;

    const draw = (now: number) => {
      if (!running) return;
      resize();
      const elapsed = (now - start) / 1000;
      // the sheet floods in over the first ~1.6 s, then holds
      const enter = reduced ? 1 : Math.min(1, elapsed / 1.6);
      pointer += (pointerTarget - pointer) * 0.045;
      energy += (energyTarget - energy) * 0.06;

      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, reduced ? 3.2 : elapsed);
      gl.uniform1f(uEnter, enter);
      gl.uniform1f(uPointer, reduced ? 0 : pointer);
      gl.uniform1f(uEnergy, reduced ? 0 : energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (reduced) return; // one settled frame is the whole reduced-motion path
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // Never burn frames the visitor cannot see. The tab check was here; the
    // SCROLL check was not — so the whole shader kept running at full rate,
    // alongside the page's own liquid canvas, for the entire rest of the
    // journey. That was the stutter.
    let onScreen = true;
    let tabVisible = true;
    const sync = () => {
      const shouldRun = onScreen && tabVisible;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { rootMargin: "10% 0px" },
    );
    observer.observe(host);

    const onVisibility = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    };
  }, [reduced]);

  return (
    <div className="lab-ribbon" ref={hostRef} aria-hidden="true">
      <canvas className="lab-ribbon-canvas" ref={canvasRef} />
    </div>
  );
}
