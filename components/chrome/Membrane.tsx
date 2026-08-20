"use client";

import { useEffect, useId, useRef } from "react";
import { makeMembrane, lobedCirclePath } from "@/lib/motion/membrane.mjs";
import {
  registerMembrane,
  pokeMembranes,
  membraneMode,
} from "@/lib/motion/membrane-runtime";

/**
 * The vector skin over a CTA.
 *
 * Renders nothing that carries meaning: the label, the link, the focus target
 * and every state that a reader depends on live in the host element and in
 * `globals.css`. This is a decorative SVG that draws the host's own outline as
 * a liquid surface, and if it never mounts — reduced motion, an old browser, a
 * JS failure — the CTA underneath is the complete, styled, usable button. That
 * is why the CSS keeps its own `:hover` / `:focus-visible` rules rather than
 * delegating them here.
 *
 * It finds its host through `parentElement` rather than a forwarded ref: the
 * host is a next-intl `<Link>` or a `<button>` depending on the caller, and
 * threading a ref through both costs more than it buys for an element that is
 * always rendered as a direct child.
 */

// Room for the deformation to leave the border box: MAX_N (9) + the focus
// contour's offset + a stroke. The SVG is inset by this on every side.
const PAD = 18;
const FOCUS_OFFSET = 4.5;

// The commit flood, fired by a press. One envelope: rise, hold, drain.
const FLOOD_RISE = 520;
const FLOOD_HOLD = 240;
const FLOOD_DRAIN = 680;
const FLOOD_LIFE = FLOOD_RISE + FLOOD_HOLD + FLOOD_DRAIN;

/** The site's `arrive` / `calm` curves, sampled — see lib/animation/easings. */
const arrive = (t: number) => 1 - Math.pow(1 - t, 3);
const calm = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type MembraneProps = {
  /** Draw the interior wash + commit flood (primary only). */
  filled?: boolean;
};

export function Membrane({ filled = false }: MembraneProps) {
  const holder = useRef<HTMLSpanElement>(null);
  // useId, not a module counter: the counter numbered the server render and the
  // client render from different starting points, so every membrane hydrated
  // with a mismatched clipPath id and React logged a tree-mismatch for each.
  const clipId = `mem${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const mode = membraneMode();
    if (mode === "off") return;

    const holderEl = holder.current;
    const host = holderEl?.parentElement as HTMLElement | null;
    const svg = holderEl?.querySelector("svg") as SVGSVGElement | null;
    if (!holderEl || !host || !svg) return;

    const edge = svg.querySelector(".mem-edge") as SVGPathElement;
    const skin = svg.querySelector(".mem-skin") as SVGPathElement | null;
    const flood = svg.querySelector(".mem-flood") as SVGPathElement | null;
    const clip = svg.querySelector(".mem-clip-path") as SVGPathElement | null;
    const ring = svg.querySelector(".mem-focus") as SVGPathElement;
    const ink = host.querySelector(".cta-label-ink") as HTMLElement | null;

    // Fractional, not offsetWidth: the viewBox and the CSS box must agree to
    // sub-pixel or the whole drawing picks up a scale factor, and a 1 px cyan
    // stroke scaled by 1.004 is a 1 px cyan stroke that shimmers on resize.
    const box = () => {
      const r = host.getBoundingClientRect();
      return [Math.max(r.width, 1), Math.max(r.height, 1)] as const;
    };
    let [w, h] = box();
    const mem = makeMembrane(w, h);

    const setBox = () => {
      svg.setAttribute("viewBox", `${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`);
    };
    setBox();

    // ── flood state ─────────────────────────────────────────────────────────
    let floodT0 = 0;
    let floodX = 0;
    let floodY = 0;
    let floodR = 0;
    let floodSeed = 0;
    let lastFloodD = "";

    const openFlood = (x: number, y: number, t: number) => {
      if (!filled) return;
      floodT0 = t;
      floodX = x;
      floodY = y;
      floodSeed = Math.random() * 6.283;
      // reach the far corner, so the fill always completes
      floodR = Math.max(
        Math.hypot(x, y),
        Math.hypot(w - x, y),
        Math.hypot(x, h - y),
        Math.hypot(w - x, h - y),
      );
    };

    const drawFlood = (t: number) => {
      if (!filled || !flood || !floodT0) return;
      const age = t - floodT0;
      if (age > FLOOD_LIFE) {
        floodT0 = 0;
        lastFloodD = "";
        flood.setAttribute("d", "");
        if (ink) ink.style.clipPath = "";
        return;
      }
      let r: number;
      if (age < FLOOD_RISE) r = floodR * arrive(age / FLOOD_RISE);
      else if (age < FLOOD_RISE + FLOOD_HOLD) r = floodR;
      else r = floodR * (1 - calm((age - FLOOD_RISE - FLOOD_HOLD) / FLOOD_DRAIN));
      if (r < 0.6) {
        if (lastFloodD) {
          lastFloodD = "";
          flood.setAttribute("d", "");
          if (ink) ink.style.clipPath = "";
        }
        return;
      }
      // The flood front carries the SAME lobe irregularity as the strike, so
      // the fill and the wave that launched it are visibly one event.
      const d = lobedCirclePath(floodX, floodY, r, floodSeed, 44);
      if (d !== lastFloodD) {
        lastFloodD = d;
        flood.setAttribute("d", d);
        // The ink copy of the label is clipped to the same front, so the words
        // flip paper→ink along a curved liquid edge rather than a wipe box.
        if (ink) ink.style.clipPath = `path('${d}')`;
      }
    };

    // ── the frame ───────────────────────────────────────────────────────────
    let lastD = "";
    const draw = (m: typeof mem, t: number) => {
      const d = m.path();
      if (d !== lastD) {
        lastD = d;
        edge.setAttribute("d", d);
        skin?.setAttribute("d", d);
        clip?.setAttribute("d", d);
        ring.setAttribute("d", m.path(FOCUS_OFFSET));
      }
      // WETTING. This is what proximity looks like, and it is the whole of the
      // awareness state: as a hand comes inside AWARE_R the interior takes on a
      // faint cyan, well before the pointer is close enough to deform anything.
      // The button notices you approaching and answers by changing MATERIAL —
      // no halo, no scale, and nothing on the page moves under the reader's eye.
      //
      // It has to be the FILL rather than the stroke. The first version put
      // awareness into a sub-pixel travelling wave on the outline, and 0.4 px
      // of motion on a 1 px hairline reads as unstable antialiasing, not as
      // life. A filled area carries fractional opacity perfectly.
      //
      // aware^0.6 rather than aware: proximity is worth most at its START, when
      // the reader is still deciding whether this thing is interactive. Linear,
      // the wash spent most of its range on the last 80 px of the approach and
      // the button stayed visually dead until the cursor was nearly on it.
      //
      // On a touch device `aware` never rises — there is no approach to
      // detect — so the tide supplies the resting level instead. Without it a
      // mobile CTA would sit at the 1.5% floor and read as inert next to a
      // page made of liquid. It rests lower than a desktop hover, so the two
      // never claim the same state.
      skin?.setAttribute(
        "fill-opacity",
        (
          0.015 +
          0.085 * Math.pow(m.aware, 0.6) +
          0.05 * m.tide +
          0.06 * m.pressure
        ).toFixed(3),
      );
      drawFlood(t);
    };

    const unregister = registerMembrane({
      el: host,
      mem,
      draw,
      rect: null,
      visible: true,
    });

    // ── input ───────────────────────────────────────────────────────────────
    const local = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const [x, y] = local(e);
      const t = performance.now();
      mem.press(true);
      mem.strike(x, y, t);
      openFlood(x, y, t);
      pokeMembranes();
    };
    const onUp = () => {
      mem.press(false);
      pokeMembranes();
    };
    // A keyboard press has no coordinates. The centre would give a perfectly
    // symmetric ring, but the per-strike angular seed breaks that on its own,
    // so a keyboard activation looks like any other.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.repeat) return;
      const t = performance.now();
      mem.press(true);
      mem.strike(w * 0.5, h * 0.5, t);
      openFlood(w * 0.5, h * 0.5, t);
      pokeMembranes();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      mem.press(false);
      pokeMembranes();
    };

    host.addEventListener("pointerdown", onDown, { passive: true });
    host.addEventListener("pointerup", onUp, { passive: true });
    host.addEventListener("pointercancel", onUp, { passive: true });
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("keyup", onKeyUp);

    // ── size ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const [nw, nh] = box();
      if (Math.abs(nw - w) < 0.5 && Math.abs(nh - h) < 0.5) return;
      w = nw;
      h = nh;
      mem.resize(w, h);
      setBox();
      lastD = "";
      const d = mem.path();
      edge.setAttribute("d", d);
      skin?.setAttribute("d", d);
      clip?.setAttribute("d", d);
      ring.setAttribute("d", mem.path(FOCUS_OFFSET));
    });
    ro.observe(host);

    // first paint: the authored rest form, drawn once
    const d0 = mem.path();
    edge.setAttribute("d", d0);
    skin?.setAttribute("d", d0);
    clip?.setAttribute("d", d0);
    ring.setAttribute("d", mem.path(FOCUS_OFFSET));
    host.setAttribute("data-membrane", mode);

    return () => {
      unregister();
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("keyup", onKeyUp);
      host.removeAttribute("data-membrane");
      if (ink) ink.style.clipPath = "";
    };
  }, [filled]);

  return (
    <span className="mem" ref={holder} aria-hidden="true">
      <svg
        className="mem-svg"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        {filled && (
          <defs>
            <clipPath id={clipId}>
              <path className="mem-clip-path" d="" />
            </clipPath>
          </defs>
        )}
        {filled && <path className="mem-skin" d="" fillOpacity="0.02" />}
        {filled && (
          <g clipPath={`url(#${clipId})`}>
            <path className="mem-flood" d="" />
          </g>
        )}
        <path className="mem-edge" d="" />
        <path className="mem-focus" d="" />
      </svg>
    </span>
  );
}
