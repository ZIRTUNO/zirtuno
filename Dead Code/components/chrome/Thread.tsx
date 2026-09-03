"use client";

import { useEffect, useRef } from "react";
import { makeThread } from "@/lib/motion/membrane.mjs";
import {
  registerMembrane,
  pokeMembranes,
  membraneMode,
} from "@/lib/motion/membrane-runtime";

/**
 * Quarantined secondary CTA rule. Its kernel was removed from
 * `lib/motion/membrane.mjs` with the active secondary CTA family.
 *
 * A secondary is a word, an arrow and a line under it. The line used to arrive
 * by `transform: scaleX(0 → 1)` from the left — which is fine on its own and
 * indefensible next to a primary running a real displacement well. Two buttons
 * side by side in Método and Studio would have been answering the same hand
 * with two unrelated ideas of what a hover is.
 *
 * So it is the same material at the scale this element deserves: a filled
 * ribbon that POURS from wherever the pointer crossed in, carries a meniscus
 * profile (fattest at the source, drawn to nothing at both ends) and takes the
 * same crest-then-trough pulse on a press that the membrane's strike does.
 *
 * Deliberately limited to secondary CTAs. Primary actions use the full
 * membrane treatment instead.
 */

const PAD = 6;

export function Thread() {
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (membraneMode() === "off") return;

    const holderEl = holder.current;
    const host = holderEl?.parentElement as HTMLElement | null;
    const svg = holderEl?.querySelector("svg") as SVGSVGElement | null;
    const path = svg?.querySelector(".thr-fill") as SVGPathElement | null;
    if (!holderEl || !host || !svg || !path) return;

    const box = () => {
      const r = host.getBoundingClientRect();
      return [Math.max(r.width, 1), Math.max(r.height, 1)] as const;
    };
    let [w, h] = box();
    const thread = makeThread(w, h);

    const setBox = () => {
      svg.setAttribute("viewBox", `0 ${-PAD} ${w} ${h + PAD * 2}`);
    };
    setBox();

    // The rule sits on the text's baseline gutter, not at the element's
    // bottom: `.cta-secondary` reserves `padding-block` for a 44 px hit area,
    // so `h` is taller than the type and a line at `h` would float away.
    const baseline = () => {
      const label = host.querySelector(".cta-label") as HTMLElement | null;
      if (!label) return h - 1;
      const lr = label.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      return lr.bottom - hr.top + 3;
    };
    let y = baseline();

    let lastD = "";
    const draw = (t: typeof thread, tMs: number) => {
      const d = t.path(tMs, y);
      if (d === lastD) return;
      lastD = d;
      path.setAttribute("d", d);
    };

    const unregister = registerMembrane({
      el: host,
      mem: thread,
      draw,
      rect: null,
      visible: true,
    });

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const r = host.getBoundingClientRect();
      thread.press(true);
      thread.strike(e.clientX - r.left, performance.now());
      pokeMembranes();
    };
    const onUp = () => {
      thread.press(false);
      pokeMembranes();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return;
      thread.press(true);
      thread.strike(w * 0.5, performance.now());
      pokeMembranes();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      thread.press(false);
      pokeMembranes();
    };

    host.addEventListener("pointerdown", onDown, { passive: true });
    host.addEventListener("pointerup", onUp, { passive: true });
    host.addEventListener("pointercancel", onUp, { passive: true });
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("keyup", onKeyUp);

    const ro = new ResizeObserver(() => {
      const [nw, nh] = box();
      if (Math.abs(nw - w) < 0.5 && Math.abs(nh - h) < 0.5) return;
      w = nw;
      h = nh;
      thread.resize(w, h);
      y = baseline();
      setBox();
      lastD = "";
    });
    ro.observe(host);

    host.setAttribute("data-thread", "on");

    return () => {
      unregister();
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("keyup", onKeyUp);
      host.removeAttribute("data-thread");
    };
  }, []);

  return (
    <span className="thr" ref={holder} aria-hidden="true">
      <svg
        className="thr-svg"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path className="thr-fill" d="" />
      </svg>
    </span>
  );
}
