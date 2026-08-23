"use client";

import { useEffect, useRef } from "react";
import {
  registerMembrane,
  pokeMembranes,
  membraneMode,
} from "@/lib/motion/membrane-runtime";

/**
 * THE FORM'S LIQUID (S10).
 *
 * The contact form was the last inert surface on the page. Every button runs a
 * membrane, the whole homepage runs a fluid, and the four controls a visitor is
 * actually asked to touch were `1px solid` rectangles that answered a pointer
 * with a colour change. This gives them the same material, and adds the one
 * thing the membrane never had: a SECOND BODY that can arrive, fuse and leave.
 *
 * Two behaviours, and the second is the point:
 *
 *   THE CONTROLS ANSWER. Each input and the textarea carry a membrane — the
 *   same displacement well, travelling strike and proximity wash the CTAs run.
 *   Hovering a field deforms its outline toward the cursor; clicking into one
 *   sends a wave across it from the point that was struck.
 *
 *   THE BEAD TRAVELS. One droplet rides the left edge of whichever control the
 *   reader is in. Move focus and it is thrown off the rail by its own speed,
 *   crosses the gap as a free body drawn out along its travel, and fuses with
 *   the next control's edge as it settles. Nothing in that sentence is
 *   scheduled: the detachment and the re-fusion are what the smooth-union does
 *   when the gap crosses K/2, in both directions. See `coalesce.mjs`.
 *
 * ── What this owns, and what it must never own ───────────────────────────
 *
 * It draws outlines. It does not carry a single thing a reader depends on: the
 * labels, the values, the validation, the error summary, the focus ring and the
 * submit button are all exactly where they were. `data-fieldliquid` goes on the
 * form only after the layer has mounted AND drawn, and every CSS rule that
 * changes a field is gated behind it — so reduced motion, no-JS, pre-hydration
 * and any mount failure all fall through to the original bordered form,
 * complete and usable. That is the same contract `Membrane` keeps, for the same
 * reason, and it is the only reason it is safe for an SVG to take over
 * something as load-bearing as a form field's border.
 */

/**
 * Room for the liquid to leave the form's box: the bead's full lift plus its
 * radius, plus the membrane's own displacement ceiling.
 */
const PAD = 44;

export function FieldLiquid() {
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mode = membraneMode();
    if (mode === "off") return;
    // THE KERNELS ARE LOADED DYNAMICALLY, and that is a robustness decision
    // rather than a code-splitting one.
    //
    // This layer is decorative: it draws outlines and carries nothing a reader
    // depends on. But a STATIC import of a kernel puts that kernel on the
    // form's critical path — if the module fails to evaluate, the whole client
    // component fails with it, and the reader gets an empty space where the
    // contact form should be while the server-rendered heading above it sits
    // there looking fine. That is exactly what a stale dev chunk produced:
    // `coalesce.mjs` importing a `splinePath` that the cached copy of
    // `membrane.mjs` did not export yet.
    //
    // A dynamic import makes that failure CATCHABLE, which is the only way the
    // additive contract in `field-liquid-spec.md §4.3` can actually be true:
    // whatever goes wrong, `data-fieldliquid` never gets set, every CSS rule
    // gated on it stays inert, and the bordered form underneath is the form.
    let cancelled = false;
    let dispose: (() => void) | undefined;

    const wire = (
      makeMembrane: typeof import("@/lib/motion/membrane.mjs").makeMembrane,
      coal: typeof import("@/lib/motion/coalesce.mjs"),
    ): (() => void) | undefined => {
      const { COAL, makeBead, dropRing, unionContour, beadContour } = coal;


      const holderEl = holder.current;
      const form = holderEl?.closest("form") as HTMLFormElement | null;
      const svg = holderEl?.querySelector("svg") as SVGSVGElement | null;
      const fieldsG = svg?.querySelector(".fl-fields") as SVGGElement | null;
      const beadPath = svg?.querySelector(".fl-bead") as SVGPathElement | null;
      if (!holderEl || !form || !svg || !fieldsG || !beadPath) return;

      // The honeypot is off-screen at left:-10000px and must never be measured,
      // let alone ridden — a bead aimed at it would leave the viewport.
      const controls = Array.from(
        form.querySelectorAll<HTMLElement>(
          ".field input, .field textarea",
        ),
      ).filter((el) => !el.closest(".contact-honeypot"));
      if (!controls.length) return;

      type Slot = {
        el: HTMLElement;
        mem: ReturnType<typeof makeMembrane>;
        path: SVGPathElement;
        /** Offset of the control's border box within the form's. */
        ox: number;
        oy: number;
        w: number;
        h: number;
        state: string;
        lastD: string;
        lastTf: string;
      };

      const slots: Slot[] = controls.map((el) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "fl-edge");
        path.setAttribute("d", "");
        fieldsG.appendChild(path);
        return {
          el,
          mem: makeMembrane(10, 10),
          path,
          ox: 0,
          oy: 0,
          w: 10,
          h: 10,
          state: "",
          lastD: "",
          lastTf: "",
        };
      });

      // ── the bead ─────────────────────────────────────────────────────────────
      const bead = makeBead();
      // Its own membrane, so the travelling body is liquid too rather than a
      // rigid disc being translated: tension, the hand and a strike all reach it
      // through exactly the same kernel the fields use.
      const beadMem = makeMembrane(0, 0, {
        ring: dropRing(COAL.R, COAL.RING_N, 0.61),
        handR: COAL.R * 2.6,
        maxN: COAL.R * 0.7,
      });
      /** Which slot the bead belongs to, or null when it has drained. */
      let host: Slot | null = null;

      /**
       * The bead expressed in ONE slot's local coordinates. One adapter per slot,
       * created here and never again — `unionContour` needs the bead in the
       * membrane's own space, and rebuilding them every frame would allocate.
       */
      const localBead = (slot: Slot) => ({
        get x() {
          return bead.x - slot.ox;
        },
        get y() {
          return bead.y - slot.oy;
        },
        get r() {
          return bead.r;
        },
        get stretch() {
          return bead.stretch;
        },
        get ux() {
          return bead.ux;
        },
        get uy() {
          return bead.uy;
        },
        get alive() {
          return bead.alive;
        },
        sdf: (qx: number, qy: number) =>
          bead.sdf(qx + slot.ox, qy + slot.oy),
      });
      const locals = new Map(slots.map((s) => [s, localBead(s)]));

      // ── measurement ──────────────────────────────────────────────────────────
      let formW = 1;
      let formH = 1;
      let lastVb = "";

      /**
       * WRITE-ONLY. Where each contour SITS, and how big the drawing surface is.
       *
       * Split from `draw` on purpose. The first version wrote the transform
       * inside the `d !== lastD` guard, which quietly tied two independent pieces
       * of state — what the contour IS and where it sits — to one dirty check.
       * At rest the path data never changes, so the position froze at first
       * paint; then the mono label font swapped, every label grew 25 px, and all
       * four contours stayed behind, drawn a label's height above the controls
       * they belonged to. The measurement was correct the whole time. Nothing was
       * writing it.
       *
       * Reads no layout, so it is safe to call from anywhere.
       */
      const place = () => {
        const vb = `${-PAD} ${-PAD} ${formW + PAD * 2} ${formH + PAD * 2}`;
        if (vb !== lastVb) {
          lastVb = vb;
          svg.setAttribute("viewBox", vb);
        }
        for (const s of slots) {
          const tf = `translate(${s.ox} ${s.oy})`;
          if (tf !== s.lastTf) {
            s.lastTf = tf;
            s.path.setAttribute("transform", tf);
          }
        }
      };

      /** READ-ONLY, then one `place()`. Every layout read in this file is here. */
      const measure = () => {
        const fr = form.getBoundingClientRect();
        formW = Math.max(fr.width, 1);
        formH = Math.max(fr.height, 1);
        for (const s of slots) {
          const r = s.el.getBoundingClientRect();
          s.ox = r.left - fr.left;
          s.oy = r.top - fr.top;
          const w = Math.max(r.width, 1);
          const h = Math.max(r.height, 1);
          if (Math.abs(w - s.w) > 0.5 || Math.abs(h - s.h) > 0.5) {
            s.w = w;
            s.h = h;
            s.mem.resize(w, h);
            s.lastD = "";
          }
        }
        place();
      };

      /**
       * WHERE THE BEAD BELONGS.
       *
       * Focus outranks hover, deliberately and in that order. Focus is where the
       * reader actually IS — it is the same for a mouse, a keyboard and a screen
       * reader, and it survives the pointer wandering off to read the label above
       * the next field. Hover only decides when nothing in the form has focus,
       * which is the one moment the form has nothing better to say.
       *
       * Returns null when the form is not in use at all, and the bead drains: an
       * untouched form is the plain bordered form, and every path in the layer
       * emits its authored rectangle character-for-character.
       */
      const resolveHost = (): Slot | null => {
        const active = document.activeElement;
        const focused = slots.find((s) => s.el === active);
        if (focused) return focused;
        // Still inside the form but not on a control — the reader has tabbed to
        // the submit button, or to a link in the error summary. The bead HOLDS
        // rather than draining: draining here made it vanish on the last step of
        // the journey, which reads as the form losing interest exactly when the
        // reader is about to act. The button has its own membrane and its own
        // flood; it does not need the bead, but it should not delete it either.
        if (active instanceof Node && form.contains(active)) return host;
        const hov = slots.find((s) => s.el.matches(":hover"));
        return hov ?? null;
      };

      // ── the frame ────────────────────────────────────────────────────────────
      let lastBeadD = "";

      const draw = (_m: unknown, t: number) => {
        place();
        let anyMerged = false;

        for (const s of slots) {
          const lb = locals.get(s)!;
          const u = unionContour(s.mem, lb);
          if (u.merged) anyMerged = true;
          if (u.d !== s.lastD) {
            s.lastD = u.d;
            // Drawn in the control's OWN space — the path's transform carries the
            // offset (see `place`), so the membrane never has to know where on
            // the page it sits.
            s.path.setAttribute("d", u.d);
          }
          // State mirrors the CSS the border used to carry — the colour logic
          // stays in the stylesheet, this only says which state applies.
          const state =
            s.el.getAttribute("aria-invalid") === "true"
              ? "invalid"
              : s.el === document.activeElement
                ? "focus"
                : "rest";
          if (state !== s.state) {
            s.state = state;
            s.path.setAttribute("data-fl", state);
          }
          s.path.setAttribute(
            "fill-opacity",
            (0.012 + 0.05 * Math.pow(s.mem.aware, 0.6) + 0.05 * s.mem.pressure).toFixed(3),
          );
        }

        // The bead is drawn as its own body ONLY while it is one. Once a field's
        // contour has wrapped it, drawing it again would trace a second outline
        // through the inside of the merged shape.
        // `null`, not `hostSdf`, and this is a drawing truth rather than a physics
        // one: while the two are separate bodies the meniscus between them is ONE
        // surface, and if both contours reach for it they both draw it — the
        // contact plane comes out as a doubled straight line across the middle of
        // what should read as a single drop. The FIELD owns the reach (see
        // `unionContour`'s near mode); the bead stays a clean body.
        const d = anyMerged || !bead.alive ? "" : beadContour(beadMem, bead);
        if (d !== lastBeadD) {
          lastBeadD = d;
          beadPath.setAttribute("d", d);
        }
        void t;
      };

      // ── the composite handle ─────────────────────────────────────────────────
      // ONE registration for the whole form. The fields and the bead are not
      // independent — moving the bead changes a field's path even though that
      // field's own membrane never stepped — so they cannot be separate handles
      // that the scheduler wakes and sleeps on their own.
      const composite = {
        hand(x: number | null, y = 0, vx = 0, vy = 0) {
          if (x === null) {
            for (const s of slots) s.mem.hand(null);
            beadMem.hand(null);
            return;
          }
          for (const s of slots) s.mem.hand(x - s.ox, y - s.oy, vx, vy);
          // the bead's ring is centred on its own position
          beadMem.hand(x - bead.x, y - bead.y, vx, vy);
        },
        step(t: number) {
          const want = resolveHost();
          if (want !== host) {
            host = want;
            if (host) {
              // ON the edge, not beside it: at rest the bead is ABSORBED into
              // the contour, and only its own speed lifts it back out. See
              // COAL.K for why a standing-off bead cannot be drawn this way.
              bead.target(host.ox, host.oy + host.h / 2, -1, 0, COAL.R);
            } else {
              bead.drain();
            }
          }
          let moved = bead.step(t);
          for (const s of slots) if (s.mem.step(t)) moved = true;
          if (beadMem.step(t)) moved = true;
          return moved;
        },
        get asleep() {
          return (
            !bead.alive &&
            beadMem.asleep &&
            slots.every((s) => s.mem.asleep)
          );
        },
        // The autonomous tide is deliberately NOT forwarded. It exists so a CTA
        // on a touch device is not the only inert thing on a liquid page; four
        // form fields breathing on their own would be a form that looks unstable
        // while somebody is trying to type into it. On touch the bead still
        // follows focus, which is the behaviour that carries meaning.
        setTide() {},
        scroll() {},
      };

      measure();
      const unregister = registerMembrane({
        el: form,
        mem: composite,
        draw,
        rect: null,
        visible: true,
      });

      // ── input ────────────────────────────────────────────────────────────────
      const onDown = (e: PointerEvent) => {
        const slot = slots.find((s) => s.el === e.currentTarget);
        if (!slot) return;
        const r = slot.el.getBoundingClientRect();
        slot.mem.press(true);
        slot.mem.strike(e.clientX - r.left, e.clientY - r.top, performance.now());
        pokeMembranes();
      };
      const onUp = (e: PointerEvent) => {
        const slot = slots.find((s) => s.el === e.currentTarget);
        slot?.mem.press(false);
        pokeMembranes();
      };
      const onFocusChange = () => pokeMembranes();

      for (const s of slots) {
        s.el.addEventListener("pointerdown", onDown, { passive: true });
        s.el.addEventListener("pointerup", onUp, { passive: true });
        s.el.addEventListener("pointercancel", onUp, { passive: true });
      }
      form.addEventListener("focusin", onFocusChange);
      form.addEventListener("focusout", onFocusChange);
      form.addEventListener("pointerover", onFocusChange, { passive: true });
      form.addEventListener("pointerout", onFocusChange, { passive: true });

      // ── size ─────────────────────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        measure();
        pokeMembranes();
      });
      ro.observe(form);
      for (const s of slots) ro.observe(s.el);

      // first paint: every control's authored rectangle, drawn once, before the
      // attribute that hands the borders over is set.
      draw(null, performance.now());
      form.setAttribute("data-fieldliquid", mode);

      return () => {
        unregister();
        ro.disconnect();
        for (const s of slots) {
          s.el.removeEventListener("pointerdown", onDown);
          s.el.removeEventListener("pointerup", onUp);
          s.el.removeEventListener("pointercancel", onUp);
          s.path.remove();
        }
        form.removeEventListener("focusin", onFocusChange);
        form.removeEventListener("focusout", onFocusChange);
        form.removeEventListener("pointerover", onFocusChange);
        form.removeEventListener("pointerout", onFocusChange);
        form.removeAttribute("data-fieldliquid");
      };
    };

    void (async () => {
      try {
        const [membrane, coal] = await Promise.all([
          import("@/lib/motion/membrane.mjs"),
          import("@/lib/motion/coalesce.mjs"),
        ]);
        if (cancelled) return;
        dispose = wire(membrane.makeMembrane, coal);
      } catch (err) {
        // The form is already complete and usable without any of this. Say so
        // once in development and leave it alone.
        if (process.env.NODE_ENV !== "production") {
          console.error("[field-liquid] stayed off:", err);
        }
        holder.current
          ?.closest("form")
          ?.removeAttribute("data-fieldliquid");
      }
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <span className="fl" ref={holder} aria-hidden="true">
      <svg className="fl-svg" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <g className="fl-fields" />
        <path className="fl-bead" d="" />
      </svg>
    </span>
  );
}
