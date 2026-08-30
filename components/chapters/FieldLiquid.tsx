"use client";

import { useEffect, useRef } from "react";
import {
  registerMembrane,
  pokeMembranes,
  membraneMode,
  type MembraneHandle,
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
 * Room for the liquid to leave the form's box: the drop's full lift, plus its
 * radius, plus the membrane's own displacement ceiling. It must track
 * COAL.LIFT_MAX — a neck that stretches further than the drawing surface is a
 * neck with a straight edge cut across it.
 */
const PAD = 96;

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
        /** Last frame's merge state — the edge that fires the wobble. */
        wasMerged: boolean;
      };

      const slots: Slot[] = controls.map((el) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "fl-edge");
        path.setAttribute("d", "");
        fieldsG.appendChild(path);
        return {
          el,
          mem: makeMembrane(10, 10, { radius: COAL.FIELD_R }),
          path,
          ox: 0,
          oy: 0,
          w: 10,
          h: 10,
          state: "",
          lastD: "",
          lastTf: "",
          wasMerged: false,
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
      /** Where the drop came from — the other end of the current hop. */
      let prevHost: Slot | null = null;

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
          // The element's box is written from the SAME constant that writes the
          // viewBox. It used to live in globals.css as well, and a hot reload
          // that updated one copy and not the other slid the whole layer 52 px
          // off the form it belongs to — the viewBox saying -44 while the CSS
          // said -96. One fact, one place.
          svg.style.inset = `${-PAD}px`;
          svg.style.width = `calc(100% + ${PAD * 2}px)`;
          svg.style.height = `calc(100% + ${PAD * 2}px)`;
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
       * THE TOUR — what the drop does when nobody is using the form.
       *
       * It walks the fields in reading order, settles into each, dwells, and
       * moves on. The form is never a still picture; the liquid is always
       * somewhere in it. The instant the reader engages — focus, or a pointer
       * over a control — the tour yields and the drop goes where they are and
       * STOPS there.
       *
       * SELF-PACED, not metronomic. It advances when the drop has actually
       * finished arriving (`bead.settled`) plus a dwell, so a long hop takes
       * as long as it takes and the pause afterwards is the same wherever it
       * lands. A fixed period would have to be set for the worst case and
       * would then leave the short hops sitting around waiting.
       *
       * This is NOT the tide `membrane-runtime` offers touch devices, and the
       * distinction matters: the tide makes every CTA breathe at once,
       * including ones the reader is working in. A form whose four fields all
       * shimmer while somebody is typing into one of them is a form that looks
       * unstable. The tour moves ONE drop, and it gets out of the way.
       */
      const TOUR = {
        /**
         * Pause after the drop has visibly arrived, before it moves on.
         *
         * It is not loitering: this is the room the DISSOLVE plays in. At 150 ms
         * the drop was merged for only ~720 ms of each stop, which the 880 ms
         * fade-out could not finish inside — so the dissolve was permanently
         * clipped and read as a flicker. The dwell has to be at least long
         * enough for the drop to actually finish giving itself up.
         */
        DWELL: 380,
        /** Ceiling on one stop, in case a hop never quite settles. */
        CAP: 5200,
        /**
         * Grace after the reader lets go, before the tour resumes. Without it
         * a tab through the form would send the drop wandering between every
         * keystroke's worth of focus change.
         */
        RESUME: 1600,
      };
      let tourAt = 0;
      let stopAt = 0;
      let arrivedAt = 0;
      let engagedAt = 0;

      /**
       * WHERE THE DROP BELONGS.
       *
       * Focus outranks hover, deliberately and in that order. Focus is where
       * the reader actually IS — the same for a mouse, a keyboard and a screen
       * reader — and it survives the pointer wandering off to read the label
       * above the next field. Hover only decides when nothing in the form has
       * focus. Below both of those sits the tour.
       *
       * Returns null only when the form is off-screen, and then the drop
       * drains: an unseen form costs nothing, and every path in the layer
       * emits its authored contour character-for-character.
       */
      const resolveHost = (t: number): Slot | null => {
        const active = document.activeElement;
        const focused = slots.find((s) => s.el === active);
        // Still inside the form but not on a control — the reader has tabbed to
        // the submit button, or to a link in the error summary. The drop HOLDS
        // rather than draining: draining there made it vanish on the last step
        // of the journey, which reads as the form losing interest exactly when
        // the reader is about to act.
        const inForm =
          !focused && active instanceof Node && form.contains(active);
        const hovered = focused
          ? null
          : slots.find((s) => s.el.matches(":hover"));
        const chosen = focused ?? (inForm ? host : null) ?? hovered ?? null;

        if (chosen) {
          // Engaged. Remember where the tour got to so it can pick up from
          // here rather than snapping back to wherever it left off.
          engagedAt = t;
          const i = slots.indexOf(chosen);
          if (i >= 0) tourAt = i;
          stopAt = t;
          arrivedAt = 0;
          return chosen;
        }

        if (!handle.visible) return null;
        if (t - engagedAt < TOUR.RESUME) return host;

        if (!stopAt) stopAt = t;
        // `arrived`, not `settled` — see COAL.ARRIVE_LIFT. Pacing off the
        // exact signal made every stop wait a third of a second on motion
        // under one pixel.
        if (bead.arrived) {
          if (!arrivedAt) arrivedAt = t;
        } else {
          arrivedAt = 0;
        }
        const dwelt = arrivedAt > 0 && t - arrivedAt >= TOUR.DWELL;
        if (dwelt || t - stopAt >= TOUR.CAP) {
          tourAt = (tourAt + 1) % slots.length;
          arrivedAt = 0;
          stopAt = t;
        }
        return slots[tourAt];
      };

      // ── the frame ────────────────────────────────────────────────────────────
      let lastBeadD = "";
      let lastBeadMat = "";

      const draw = (_m: unknown, t: number) => {
        place();

        // WHICH FIELD HOLDS THE DROP. Exactly one may, or two would each draw
        // the bulb and the drop would come out double-struck.
        //
        // Only the two ENDS of the current hop are eligible: where it left and
        // where it is going. Picking the nearest field outright let the drop
        // grab fields it was merely flying past — on the long return leg it
        // passes two of them — and a field that becomes owner and merged in the
        // same frame has not started its stroke transition yet, so for a frame
        // or two a rest-coloured circle sits under a wet-coloured drop. A
        // filament trails from where it left and reaches to where it is going;
        // it does not catch on the scenery.
        let owner: Slot | null = null;
        let ownerL = Infinity;
        if (bead.alive) {
          for (const s of [host, prevHost]) {
            if (!s) continue;
            const ay = Math.min(Math.max(bead.y, s.oy), s.oy + s.h);
            const d = Math.hypot(bead.x - s.ox, bead.y - ay);
            if (d < ownerL) {
              ownerL = d;
              owner = s;
            }
          }
        }

        for (const s of slots) {
          const lb = locals.get(s)!;
          const u = unionContour(s.mem, lb, { own: s === owner });
          // THE WOBBLE. Arriving and letting go are both impacts, and a surface
          // that takes one without ringing is not a surface. The membrane
          // already has the tension and the damping; it only ever needed to be
          // told that something happened. Ambient, so the reader's own clicks
          // keep their full amplitude (see MEM.SHOCK_SATURATE).
          if (u.merged !== s.wasMerged) {
            s.wasMerged = u.merged;
            const y = Math.min(Math.max(bead.y - s.oy, 0), s.h);
            s.mem.strike(0, y, t, u.merged ? 0.5 : 0.34, true);
            if (!u.merged) beadMem.strike(0, 0, t, COAL.PINCH_KICK, true);
            pokeMembranes();
          }
          if (u.d !== s.lastD) {
            s.lastD = u.d;
            // Drawn in the control's OWN space — the path's transform carries the
            // offset (see `place`), so the membrane never has to know where on
            // the page it sits.
            s.path.setAttribute("d", u.d);
          }
          // State mirrors the CSS the border used to carry — the colour logic
          // stays in the stylesheet, this only says which state applies.
          // WET is any field the drop is ON or ON ITS WAY TO. Both, because a
          // hop has two ends: the field it is leaving still owns the bridge for
          // a moment, and the field it is heading for needs its 200 ms stroke
          // transition FINISHED before the drop gets there. Keyed on ownership
          // alone, the arriving field was still dim when the bridge formed on
          // it, and the drop — which never leaves the wet state, since it
          // always has an owner — sat brighter than the circle it shared.
          //
          // Without any of it the drop lands on `--color-paper-faint` and the
          // brightness falls off a cliff. Focus stays the brightest state, so
          // the hierarchy holds: dim, then lit as the liquid comes, then full
          // cyan where the reader is.
          const state =
            s.el.getAttribute("aria-invalid") === "true"
              ? "invalid"
              : s.el === document.activeElement
                ? "focus"
                : s === owner || s === host
                  ? "wet"
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
        // THE OUTLINE STAYS ON. The drop is drawn for as long as it has mass,
        // merged or not.
        //
        // It used to be hidden the moment a field claimed it, on the reasoning
        // that the drop and the bridge's bulb are the same circle and drawing
        // both would double-strike one shape. That is true, and it is also why
        // hiding it needed a cross-fade, and why the cross-fade needed a
        // dissolve, and why the dissolve needed a dwell long enough to play
        // in — three rounds of machinery to make a disappearance acceptable.
        //
        // The owner looked at it and preferred the drop simply staying. A bead
        // resting half-submerged in its own meniscus, its outline visible
        // through the surface, is a real thing liquid does — and it costs
        // nothing to draw. `ONLY=tourfade` now guards the opposite invariant:
        // that the outline never goes out while the drop is alive.
        const d = bead.alive ? beadContour(beadMem, bead) : "";
        if (d !== lastBeadD) {
          lastBeadD = d;
          beadPath.setAttribute("d", d);
        }
        // THE DROP WEARS ITS HOST'S MATERIAL — TAKEN, NOT GUESSED.
        //
        // While the bridge is formed the field's contour draws the bulb and the
        // drop draws itself: two coincident circles. Identical, that is
        // indistinguishable from one. Different, it is a blink — the outline
        // used to go bolder and brighter on landing (cyan over cyan-deep, two
        // strokes) and thinner on leaving.
        //
        // Mirroring the host's STATE was not enough. A field's stroke eases
        // over 200 ms and the drop's does not, because the drop never leaves
        // the wet state — it always has an owner — so every time a field lit
        // up there was a window where a rest-coloured circle sat under a
        // wet-coloured one. Reading the host's computed stroke removes the
        // whole class of problem: whatever the contour is showing this frame,
        // transitions included, is what the drop is showing.
        const hostPath = owner?.path ?? null;
        const mat = hostPath
          ? getComputedStyle(hostPath).stroke
          : "var(--color-paper-faint)";
        if (mat !== lastBeadMat) {
          lastBeadMat = mat;
          beadPath.style.stroke = mat;
        }
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
          const want = resolveHost(t);
          if (want !== host) {
            if (host) prevHost = host;
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
      // Held rather than passed inline: the runtime writes `visible` on this
      // object from its IntersectionObserver, and the tour reads it. An
      // autonomous animation that keeps running for a form nobody can see is
      // the one thing this feature could reasonably be accused of.
      const handle: MembraneHandle<typeof composite> = {
        el: form,
        mem: composite,
        draw,
        rect: null,
        visible: true,
      };
      const unregister = registerMembrane(handle);

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
