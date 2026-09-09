"use client";

import { useEffect, useRef, useState } from "react";
import {
  registerMembrane,
  membraneMode,
  type MembraneHandle,
} from "@/lib/motion/membrane-runtime";
import { COMP, PARAM, makeCompanion } from "@/lib/motion/companion.mjs";
import { makeCompanionBehavior } from "@/lib/motion/companion-behavior.mjs";
import type { CompanionExpression } from "@/lib/motion/companion.mjs";

/**
 * THE COMPANION (S10) — the droplet that watches you fill the form in.
 *
 * `lib/motion/companion.mjs` owns the geometry, the surface and every
 * expression; this file owns only what the kernel cannot know — what the
 * visitor is doing, where they are doing it, and where on the page the droplet
 * should be while they do it.
 *
 * ── IT IS DRIVEN BY THE CTAs' OWN SCHEDULER ─────────────────────────────────
 *
 * It registers with `membrane-runtime` as a `Driven`, exactly as every button
 * on the site does. That is not a stylistic echo: the runtime owns the pointer,
 * the per-frame hand feed, the visibility observer, the autonomous tide on
 * touch devices and the scroll geometry, and the kernel runs `makeMembrane` on
 * the droplet's own ring. So the hand-well under the cursor, the travelling
 * shock on a press and the proximity wake are the SAME code a CTA runs, on a
 * different contour. Registering also deleted this file's own rAF loop, its
 * IntersectionObserver and its visibilitychange handler — three things that
 * existed only to duplicate a scheduler already on the page.
 *
 * ── IT FOLLOWS YOU ──────────────────────────────────────────────────────────
 *
 * With a wide enough gutter the live droplet is fixed, and springs between
 * two targets: DOCKED in its slot on the statement's label line, and PARKED at
 * a fixed height in the viewport once that slot has scrolled away. So it rides
 * down the page beside the reader and settles back into the composition when
 * they scroll back up. There is no scroll listener and no `scrollHeight` read
 * here — `travel()` hands over the scroll geometry the runtime has already
 * taken, in its read phase, which is the whole reason that callback exists.
 * That also means it never has to know about Lenis, which owns scrolling on
 * this site and whose native scroll events arrive about twice per 900px and
 * hundreds of pixels stale.
 *
 * The slot stays in the flow at full size. On narrow screens the carrier also
 * stays in that slot, so it cannot park over the form's controls.
 *
 * ── WHY IT TOUCHES NOTHING ──────────────────────────────────────────────────
 *
 * `ContactForm.tsx` is UNCHANGED by this feature. It carries the whole
 * conversion path, and a decorative layer that edits any of it is a decorative
 * layer that can take the business down with it. So the companion READS the DOM
 * the form already publishes for accessibility, and none of it was added here:
 *
 *   `aria-invalid` on a control        -> doubt
 *   the error summary TAKES FOCUS      -> the submit was REJECTED: anger
 *   `form[aria-busy="true"]`           -> the request is in flight: effort
 *   `.contact-pending`                 -> accepted, unconfirmed: hold
 *   `.contact-error[role=alert]`       -> delivery failed: deflation
 *   `.contact-success` replaces it     -> confirmed: the lids close
 *
 * ── WHY IT NEVER FADES IN ───────────────────────────────────────────────────
 *
 * The rest pose is computed at MODULE SCOPE and rendered into the server HTML,
 * so the droplet is present in the first painted frame, at rest, looking
 * straight ahead. There is no arrival to catch and no opacity animated
 * anywhere. With JavaScript off, under `prefers-reduced-motion`, or if the
 * module fails to evaluate, that still droplet is the whole feature and it is a
 * complete one — it stays in the flow, in its slot, and `data-companion` (which
 * gates both the fixed positioning and the live colour) is never set.
 */

/** How far a target has to be before the gaze is fully committed. */
const AIM_R = 380;
/** Pointer inside this radius of the droplet's centre and it leans away. */
const DODGE_R = 104;
/** How long after a keystroke the visitor still counts as writing. */
const TYPING_MS = 1100;
/** How long after the last pointer move the visitor still counts as present. */
const POINTER_MS = 2600;
/** Where it parks, as a fraction of the viewport height, once undocked. */
const PARK_VH = 0.62;
/** The dock/park spring. Slower than the gaze: a body travelling, not an eye. */
const OMEGA_POS = 7.4;
const ZETA_POS = 0.92;

/**
 * The rest pose, frozen at t = 0.
 *
 * Module scope, so it is computed once per process and is identical on the
 * server and in the browser — the kernel is deterministic, membrane included.
 * This is what makes "no reveal" possible: the droplet ships in the HTML.
 */
const REST = (() => {
  const c = makeCompanion(1);
  c.step(0);
  return {
    body: c.bodyPath(),
    left: c.pupilPath(-1),
    right: c.pupilPath(1),
  };
})();

type Live = {
  /** Where the eyes should be pointed, in client coordinates. */
  ax: number;
  ay: number;
  /** True while something is aiming it; false hands the gaze back to the wander. */
  aiming: boolean;
  /** Timestamps of the last keystroke and the last pointer move. */
  typedAt: number;
  movedAt: number;
  /** Controls that were invalid on the previous pass. */
  invalid: Set<string>;
  /** The pointer is inside DODGE_R / actually on the droplet. */
  crowded: boolean;
  hovered: boolean;
};

export function Companion() {
  const slot = useRef<HTMLSpanElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const slotEl = slot.current;
    if (!slotEl) return;
    // The same gate the membranes use: reduced motion turns this off entirely
    // and leaves the still droplet already in the markup, in the flow.
    if (!motionAllowed || membraneMode() === "off") return;

    const carrier = slotEl.querySelector<HTMLElement>(".cp-carrier");
    const bodyEl = slotEl.querySelector<SVGPathElement>(".cp-body");
    const eyeL = slotEl.querySelector<SVGPathElement>(".cp-eye-l");
    const eyeR = slotEl.querySelector<SVGPathElement>(".cp-eye-r");
    if (!carrier || !bodyEl || !eyeL || !eyeR) return;

    const comp = makeCompanion(1);
    const behavior = makeCompanionBehavior(performance.now());
    const live: Live = {
      ax: 0,
      ay: 0,
      aiming: false,
      typedAt: -1e9,
      movedAt: -1e9,
      invalid: new Set(),
      crowded: false,
      hovered: false,
    };

    const panel = document.querySelector(".contact-panel");
    // The card publishes which of its three forms is on stage. Read that
    // identity: both tracks remain visible during a slide, and an offstage
    // track may retain a pending outcome. No layout read is needed here.
    const form = () =>
      panel?.querySelector<HTMLFormElement>(".contact-slot[data-active] form.contact-form") ??
      panel?.querySelector<HTMLFormElement>("form.contact-form") ?? null;

    // ── where the droplet is ─────────────────────────────────────────────────
    //
    // THE SLOT'S DOCUMENT POSITION IS CACHED, not read per frame. A rect read
    // inside the runtime's WRITE phase forces a synchronous layout — the whole
    // reason that runtime separates its phases — and the slot's position in the
    // DOCUMENT only changes when the layout does. A ResizeObserver catches
    // that; scrolling is handled by `travel`, which hands over the scrollY the
    // runtime already read.

    let slotDocX = 0;
    let slotDocY = 0;
    let slotW = 0;
    let parkX = 0;
    let canPark = false;
    function measureSlot() {
      const r = slotEl!.getBoundingClientRect();
      slotDocX = r.left + window.scrollX;
      slotDocY = r.top + window.scrollY;
      slotW = r.width;

      /**
       * WHERE IT GOES WHEN IT LEAVES THE COMPOSITION.
       *
       * Not the slot's own x. Docked, that x is the right end of the statement
       * column, which is the correct place for it to sit ON the label's line —
       * and completely the wrong place to hover once the column is gone, because
       * it is then floating in the middle of whatever is on screen. The first
       * build parked there and landed between two columns of body copy.
       *
       * So it slides into THE SHELL'S GUTTER, which `--page-padding` keeps empty
       * at every width by construction (`zirtuno-shell-is-the-bar`): the one
       * strip of the viewport nothing is ever laid out in. If the gutter cannot
       * hold the droplet, it stays in normal document flow at its original slot.
       */
      // `.contact-page` carries the gutter as PADDING, so its own box starts at
      // the viewport edge and its `left` is always 0. The gutter has to be read
      // off something laid out INSIDE it — the masthead is the first such block
      // and is present on every width.
      const content = document.querySelector(".contact-masthead");
      const gutter = content ? content.getBoundingClientRect().left : 0;
      canPark = gutter >= slotW + 28;
      parkX =
        gutter >= slotW + 28 ? Math.max(12, (gutter - slotW) / 2) : slotDocX;
    }
    measureSlot();

    let posX = slotDocX;
    let posY = slotDocY - window.scrollY;
    let velX = 0;
    let velY = 0;
    let placed = false;
    let pageY = window.scrollY;
    let pageVH = window.innerHeight;

    function positionTarget() {
      const dockY = slotDocY - pageY;
      // DOCKED while the slot is on screen with room to spare, PARKED once it
      // has gone. The band is generous on purpose: a target that flipped the
      // moment the slot touched an edge would swap back and forth on any
      // scroll that hovered there.
      const gone = canPark && (dockY < -slotW * 0.6 || dockY > pageVH - slotW * 0.35);
      return {
        x: gone ? parkX : slotDocX,
        y: gone ? pageVH * PARK_VH : dockY,
      };
    }

    // ── aiming ───────────────────────────────────────────────────────────────

    /** Centre of the droplet in client coordinates — from the spring, not a rect. */
    function centre() {
      return { x: posX + slotW / 2, y: posY + slotW / 2 };
    }

    /**
     * THE CARET, approximated.
     *
     * There is no API for a caret's pixel position inside an input, and the
     * usual workaround — a mirrored, absolutely positioned clone of the field
     * measured off-screen — is a second copy of the form's typography that has
     * to be kept in step with the stylesheet forever. For a gaze fifteen pixels
     * wide at the far end of a column, the fraction of the way through the
     * value is indistinguishable from the truth, and it costs a rect and a
     * division.
     */
    function caretPoint(el: HTMLInputElement | HTMLTextAreaElement) {
      const r = el.getBoundingClientRect();
      const len = el.value.length || 1;
      const at = el.selectionStart ?? len;
      if (el instanceof HTMLTextAreaElement) {
        const before = el.value.slice(0, at);
        const lines = before.split("\n").length;
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
        const col = before.length - before.lastIndexOf("\n") - 1;
        return {
          x: Math.min(r.right - 10, r.left + 12 + col * 7.6),
          y: Math.min(r.bottom - 8, r.top + 12 + (lines - 0.5) * lh),
        };
      }
      const frac = Math.min(1, at / Math.max(len, 8));
      return { x: r.left + 12 + frac * (r.width - 24), y: r.top + r.height / 2 };
    }

    function aimAt(x: number, y: number) {
      live.ax = x;
      live.ay = y;
      live.aiming = true;
    }

    // ── what is the visitor doing ────────────────────────────────────────────

    function focusedControl() {
      const el = document.activeElement;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.closest("form.contact-form") &&
        !el.closest(".contact-honeypot")
      ) {
        return el;
      }
      return null;
    }

    /**
     * Is what is in the field wrong RIGHT NOW?
     *
     * `aria-invalid` is the form's own answer and it is authoritative — but it
     * only appears once a submit has been rejected, because that is when
     * react-hook-form runs the resolver. So there is one live check beside it,
     * and exactly one: an email grown past a few characters with no `@`. That
     * is unambiguous, it is the single most common thing a visitor gets wrong
     * here, and it resolves the moment they type the `@`. Anything cleverer
     * starts scolding people mid-word.
     */
    function looksWrong(el: HTMLInputElement | HTMLTextAreaElement) {
      if (el.getAttribute("aria-invalid") === "true") return true;
      // Every track has an email field, so this is keyed on the control's type
      // rather than on one id.
      if (el instanceof HTMLInputElement && el.type === "email") {
        const v = el.value.trim();
        return v.length > 4 && !v.includes("@");
      }
      return false;
    }

    /**
     * DID A FIELD JUST BECOME VALID?
     *
     * THIS CANNOT LIVE IN THE `input` HANDLER, and the first build put it
     * there. `aria-invalid` is React state: at the moment an `input` event
     * fires, the re-render that will clear the attribute has not happened yet,
     * so the handler reads the OLD value and the true -> false edge is
     * invisible to it. The companion went on scowling at somebody who had
     * already fixed their email, which is the single worst thing this feature
     * could do. A draw callback is inherently a frame behind the event, which
     * is exactly the vantage point needed to see React's render land.
     */
    let controls: HTMLElement[] = [];
    let controlsOf: HTMLFormElement | null = null;

    function pollValidity(now: number) {
      const f = form();
      if (f !== controlsOf) {
        controlsOf = f;
        controls = f
          ? Array.from(
              f.querySelectorAll<HTMLElement>(".field input, .field textarea"),
            ).filter((el) => !el.closest(".contact-honeypot"))
          : [];
        if (!f) live.invalid.clear();
      }
      for (const el of controls) {
        const bad = el.getAttribute("aria-invalid") === "true";
        const was = live.invalid.has(el.id);
        if (bad && !was) {
          live.invalid.add(el.id);
        } else if (!bad && was) {
          live.invalid.delete(el.id);
          // RELIEF CANCELS THE SCOWL. Any correction earns it, even a partial
          // one: someone working through two errors is making progress, and a
          // companion that keeps glaring until the last is fixed is punishing
          // them for the ones they already got right.
          behavior.event("correct", now);
        }
      }
    }

    /** The form's published state, in priority order. Highest wins. */
    function readState(now: number): CompanionExpression {
      const el = focusedControl();
      const f = form();
      return behavior.read(now, {
        status: panel?.querySelector(".contact-success") ? "success"
          : f?.getAttribute("aria-busy") === "true" ? "busy"
          : f?.querySelector(".contact-pending") ? "pending"
          : f?.querySelector(".contact-error") ? "error" : "idle",
        focused: !!el,
        typing: !!el && now - live.typedAt < TYPING_MS,
        longText: el instanceof HTMLTextAreaElement && el.value.length > 90,
        invalid: !!el && looksWrong(el),
        crowded: live.crowded,
        moving: now - live.movedAt < POINTER_MS,
      });
    }

    // ── listeners ────────────────────────────────────────────────────────────

    let pointerX = 0, pointerY = 0, pointerAt = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      live.movedAt = now;
      const c = centre();
      live.crowded = Math.hypot(e.clientX - c.x, e.clientY - c.y) < DODGE_R;
      const distance = pointerAt ? Math.hypot(e.clientX - pointerX, e.clientY - pointerY) : 0;
      const speed = distance / Math.max(16, now - pointerAt) * 1000;
      behavior.stroke(distance, speed, live.crowded, now);
      pointerX = e.clientX; pointerY = e.clientY; pointerAt = now;
      // While the visitor is writing, the caret outranks the pointer: a hand
      // resting on a mouse is not where the attention is.
      if (performance.now() - live.typedAt > TYPING_MS) {
        aimAt(e.clientX, e.clientY);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.target === bodyEl) return;
      const c = centre();
      const dx = e.clientX - c.x;
      const dy = e.clientY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      // The blow arrives FROM the click, so the body squashes toward it and
      // recoils across. Close clicks hit harder.
      comp.poke(dx / d, dy / d, Math.max(0.25, 1 - d / (AIM_R * 1.6)));
      aimAt(e.clientX, e.clientY);
      live.movedAt = performance.now();
      behavior.activity(performance.now());
    };

    let milestoneUsed = false;
    const onInput = (e: Event) => {
      const el = e.target;
      if (
        !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      if (!el.closest("form.contact-form") || el.closest(".contact-honeypot")) {
        return;
      }
      live.typedAt = performance.now();
      behavior.event("type", live.typedAt);
      if (!milestoneUsed && el instanceof HTMLTextAreaElement && el.value.length > 160) {
        milestoneUsed = true;
        behavior.event("milestone", live.typedAt);
      }
      comp.tick();
      const p = caretPoint(el);
      aimAt(p.x, p.y);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.closest("form.contact-form") &&
        !el.closest(".contact-honeypot")
      ) {
        comp.blink();
        behavior.activity(performance.now());
        const p = caretPoint(el);
        aimAt(p.x, p.y);
      }
    };

    const onSubmit = () => {
      // Reset the ledger optimistically: if the submit is rejected, the summary
      // focus below counts it again a moment later. A submit that GOES THROUGH
      // must not leave anger armed behind it.
      behavior.event("submit", performance.now());
      const btn = form()?.querySelector(".cta-primary");
      if (btn) {
        const r = btn.getBoundingClientRect();
        aimAt(r.left + r.width / 2, r.top + r.height / 2);
      }
    };

    /**
     * THE REJECTION COUNTER.
     *
     * THE FIRST BUILD COUNTED THE SUMMARY APPEARING, AND IT ONLY EVER FIRED
     * ONCE. `ContactForm` keeps `.contact-error-summary` mounted for as long as
     * the errors persist, so the second refusal — and the third, and the fourth
     * — mutate nothing. The companion took the first mistake as doubt and then
     * never reacted again, the exact opposite of the behaviour this feature
     * exists for. It was caught by `capture/companion-page.mjs` and by nothing
     * else: the geometry sheet cannot see wiring, and the page looked fine.
     *
     * The signal used instead is one the form already emits for screen-reader
     * users and cannot drop without regressing accessibility: on EVERY rejected
     * submit it moves focus to the summary so the complete error state is
     * announced as one event. A `focusin` there is therefore exactly "a submit
     * was just refused", once per refusal, with no bookkeeping.
     */
    const onSummaryFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.closest(".contact-error-summary")) return;

      behavior.event("reject", performance.now());

      const first = document.querySelector<HTMLAnchorElement>(
        ".contact-error-summary a",
      );
      const target = first?.getAttribute("href")?.slice(1);
      const field = target ? document.getElementById(target) : null;
      if (field) {
        const r = field.getBoundingClientRect();
        aimAt(r.left + r.width / 2, r.top + r.height / 2);
      }
    };

    // ── being touched directly ───────────────────────────────────────────────
    //
    // Only the droplet's own silhouette takes the pointer: `.cp-body` is the
    // one thing with `pointer-events`, so the reactive area is the SHAPE and
    // not its box, and the layer still cannot come between a reader and a
    // control. It stays `aria-hidden` and unfocusable — nothing here is an
    // action, so there is nothing a keyboard user is being denied.

    /** Client coordinates -> the membrane's space (viewBox units, centred). */
    function toLocal(x: number, y: number) {
      const k = slotW ? (COMP.VIEW * 2) / slotW : 1;
      return { x: (x - posX) * k - COMP.VIEW, y: (y - posY) * k - COMP.VIEW };
    }

    const onEnter = () => {
      live.hovered = true;
      behavior.hover(true, performance.now());
      comp.blink();
    };
    const onLeave = () => {
      live.hovered = false;
      behavior.hover(false, performance.now());
    };
    const onBodyDown = (e: PointerEvent) => {
      behavior.touch(true, performance.now());
      const p = toLocal(e.clientX, e.clientY);
      // THE SAME WAVE A PRESSED CTA RUNS, from the point that was struck.
      comp.press(true);
      comp.strike(p.x, p.y, performance.now(), 1);
      // …plus a whole-body recoil away from the hand, which a button does not
      // do because a button is not a body.
      const c = centre();
      const dx = e.clientX - c.x;
      const dy = e.clientY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      comp.poke(dx / d, dy / d, 1.4);
    };
    const onUp = () => {
      comp.press(false);
      behavior.touch(false, performance.now());
    };
    let awayAt = -1;
    const onCancel = () => {
      comp.press(false);
      comp.hand(null);
      behavior.cancel();
      live.hovered = live.crowded = false;
    };
    const onWindowBlur = () => { awayAt = performance.now(); onCancel(); };
    const onWindowFocus = () => {
      if (awayAt >= 0 && performance.now() - awayAt > 1000) behavior.event("return", performance.now());
      awayAt = -1;
    };
    const onChoice = (e: Event) => {
      const el = e.target;
      // The radios moved OUT of the form when the intent chips became the
      // card's track switch. It is the same gesture — picking a direction —
      // so the same reaction fires, from the same kind of control.
      if (
        el instanceof HTMLInputElement &&
        el.type === "radio" &&
        el.closest(".contact-card")
      ) {
        behavior.event("choice", performance.now());
        comp.tick(.8);
      }
    };
    /**
     * WHICH TRACK IS SHOWING, where the wizard's stage number used to be.
     * Changing track is the move the companion used to see as advancing a
     * stage, so it still reads as one — the direction is just no longer
     * ordered, and "advance" is the honest reading of any deliberate switch.
     */
    const stepOf = () =>
      form()?.closest("[data-slot-track]")?.getAttribute("data-slot-track") ??
      "";
    let formStep = stepOf();
    let trackReactionAt = 0;

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("change", onChoice, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusin", onSummaryFocus, true);
    document.addEventListener("submit", onSubmit, true);
    bodyEl.addEventListener("pointerenter", onEnter);
    bodyEl.addEventListener("pointerleave", onLeave);
    bodyEl.addEventListener("pointerdown", onBodyDown);

    const ro = new ResizeObserver(() => measureSlot());
    ro.observe(document.documentElement);
    ro.observe(slotEl);

    // ── the Driven adapter ───────────────────────────────────────────────────
    //
    // The runtime hands `hand()` coordinates relative to the registered
    // element's box, in CSS pixels. The membrane lives in viewBox units centred
    // on the body, so the conversion happens here — reading the rect the
    // runtime already took in its READ phase rather than taking one of its own
    // in the write phase, which is the distinction that keeps this off the
    // forced-layout path.

    const colorChannels = ["chill", "cool", "warm", "gold", "blush", "glow"] as const;
    const colorsWere = new Float64Array(colorChannels.length).fill(-1);
    let expressionWas = "", poseWas = "";
    let drew = false;
    let lastDraw = 0;

    const driven = {
      hand(x: number | null, y = 0, vx = 0, vy = 0) {
        const r = handle.rect;
        if (x === null || !r || !r.width) {
          comp.hand(null);
          return;
        }
        const k = (COMP.VIEW * 2) / r.width;
        comp.hand(x * k - COMP.VIEW, y * k - COMP.VIEW, vx * k, vy * k);
      },
      step: (t: number) => handle.visible ? comp.step(t) : false,
      get asleep() {
        return !handle.visible || comp.asleep;
      },
      setTide: (on: number) => comp.setTide(on),
      scroll: (v: number) => comp.scroll(v),
      arrive: (fromBelow: boolean, t: number) => comp.arrive(fromBelow, t),
      /**
       * The scroll geometry, read once per frame by the runtime in its read
       * phase and handed to every surface that draws the scroll rather than
       * merely reacting to it. Here it is what lets the droplet follow the page
       * with no scroll listener of its own.
       */
      travel(y: number, vh: number) {
        pageY = y;
        pageVH = vh;
      },
    };

    function draw(_m: unknown, now: number) {
      pollValidity(now);
      const nextStep = stepOf();
      if (nextStep && nextStep !== formStep) {
        // Let the chosen direction read before acknowledging the new track.
        trackReactionAt = now + 1550;
        formStep = nextStep;
      }
      if (trackReactionAt && now >= trackReactionAt) {
        behavior.event("advance", now);
        trackReactionAt = 0;
      }

      const want = readState(now);
      if (want !== comp.expression) comp.play(want);

      // Nothing has aimed it for a while and no field has focus: hand the gaze
      // back to its own wander rather than leaving it staring at a stale point.
      if (live.aiming && now - live.movedAt > POINTER_MS && !focusedControl()) {
        live.aiming = false;
        comp.release();
      }
      if (live.aiming) {
        const c = centre();
        comp.aim((live.ax - c.x) / AIM_R, (live.ay - c.y) / AIM_R);
      }

      // THE TRAVEL. A spring, not an ease: the target changes mid-flight every
      // time the reader reverses, and an ease would have to restart.
      const target = positionTarget();
      if (!placed || !canPark) {
        posX = target.x;
        posY = target.y;
        velX = 0;
        velY = 0;
        placed = true;
      } else {
        // The runtime runs at 30 Hz on touch and up to 120 Hz on desktop.
        // Integrate elapsed time in bounded substeps so travel has one speed.
        const dt = Math.min(64, Math.max(0, now - lastDraw)) / 1000;
        const steps = Math.max(1, Math.ceil(dt * 120));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
        velX +=
          (-2 * ZETA_POS * OMEGA_POS * velX -
            OMEGA_POS * OMEGA_POS * (posX - target.x)) *
          h;
        velY +=
          (-2 * ZETA_POS * OMEGA_POS * velY -
            OMEGA_POS * OMEGA_POS * (posY - target.y)) *
          h;
        posX += velX * h;
        posY += velY * h;
        }
      }
      lastDraw = now;
      carrier!.style.transform = canPark
        ? `translate3d(${posX.toFixed(1)}px, ${posY.toFixed(1)}px, 0)` : "";
      slotEl!.dataset.follow = canPark ? "gutter" : "docked";

      bodyEl!.setAttribute("d", comp.bodyPath());
      // An empty string is the kernel saying the lid is shut. Blanking `d` is
      // how the eye closes; there is no separate lid element to hide.
      eyeL!.setAttribute("d", comp.pupilPath(-1));
      eyeR!.setAttribute("d", comp.pupilPath(1));

      // The colour channel is written only when it has actually moved. A custom
      // property set every frame is a style recalculation every frame, for a
      // value that changes over hundreds of milliseconds.
      for (let i = 0; i < colorChannels.length; i++) {
        const key = colorChannels[i];
        const value = Math.round(Math.max(0, Math.min(1, comp.params[PARAM[key]])) * 100) / 100;
        if (value !== colorsWere[i]) {
          slotEl!.style.setProperty(`--cp-${key}`, String(value));
          colorsWere[i] = value;
        }
      }
      if (expressionWas !== comp.expression) {
        slotEl!.dataset.emotion = expressionWas = comp.expression;
      }
      if (poseWas !== comp.pose) slotEl!.dataset.eyePose = poseWas = comp.pose;

      if (!drew) {
        drew = true;
        slotEl!.setAttribute("data-companion", "live");
      }
    }

    const handle: MembraneHandle<typeof driven> = {
      el: carrier,
      mem: driven,
      draw,
      rect: null,
      visible: true,
    };
    const unregister = registerMembrane(handle);

    return () => {
      unregister();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("change", onChoice, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusin", onSummaryFocus, true);
      document.removeEventListener("submit", onSubmit, true);
      bodyEl.removeEventListener("pointerenter", onEnter);
      bodyEl.removeEventListener("pointerleave", onLeave);
      bodyEl.removeEventListener("pointerdown", onBodyDown);
      slotEl.removeAttribute("data-companion");
      slotEl.removeAttribute("data-emotion");
      slotEl.removeAttribute("data-eye-pose");
      slotEl.removeAttribute("data-follow");
      for (const key of colorChannels) slotEl.style.removeProperty(`--cp-${key}`);
      carrier.style.transform = "";
      bodyEl.setAttribute("d", REST.body);
      eyeL.setAttribute("d", REST.left);
      eyeR.setAttribute("d", REST.right);
    };
  }, [motionAllowed]);

  return (
    <span ref={slot} className="companion" aria-hidden="true">
      {/* The SLOT stays in the flow at full size; the CARRIER is what detaches
          and travels. Splitting them is what lets the droplet leave the
          composition without the label row collapsing behind it. */}
      <span className="cp-carrier">
        {/* The drawing surface comes from `COMP.VIEW` rather than a literal,
            because a silhouette clipped by its own viewBox has a straight edge
            cut across it — the one thing a liquid can never have — and a second
            copy of the number here is a second thing to get out of step with
            the geometry. `verify/companion.mjs` sweeps every expression, gaze,
            hand and strike against that same constant. */}
        <svg
          className="cp-svg"
          viewBox={`${-COMP.VIEW} ${-COMP.VIEW} ${COMP.VIEW * 2} ${COMP.VIEW * 2}`}
          role="presentation"
          focusable="false"
        >
          <path className="cp-body" d={REST.body} />
          <path className="cp-eye cp-eye-l" d={REST.left} />
          <path className="cp-eye cp-eye-r" d={REST.right} />
        </svg>
      </span>
    </span>
  );
}
