"use client";

import { useEffect, useRef } from "react";
import {
  registerMembrane,
  membraneMode,
  type MembraneHandle,
} from "@/lib/motion/membrane-runtime";
import { COMP, makeCompanion } from "@/lib/motion/companion.mjs";
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
 * existed only to duplicate a scheduler already on the page, and which this
 * file may never grow back. The life cycle below is therefore built out of
 * TIMESTAMPS compared inside the draw callback, not out of timers: a droplet
 * that fell asleep on a `setTimeout` would go on falling asleep in a tab nobody
 * is looking at, and would wake up mid-doze when the reader came back.
 *
 * ── IT FOLLOWS YOU ──────────────────────────────────────────────────────────
 *
 * The droplet is `position: fixed` once the layer is live, and springs between
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
 * The slot stays in the flow at full size, so detaching never shifts the layout
 * by a pixel.
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
 *   `.contact-error[role=alert]`       -> delivery failed: deflation, then sorrow
 *   `.contact-success` replaces it     -> confirmed: a burst, then the lids close
 *
 * ── WHY IT NEVER FADES IN ───────────────────────────────────────────────────
 *
 * The rest pose is computed at MODULE SCOPE and rendered into the server HTML,
 * so the droplet is present in the first painted frame, at rest, looking
 * straight ahead. There is no arrival to catch and no opacity animated
 * anywhere. With JavaScript off, under `prefers-reduced-motion`, or if the
 * module fails to evaluate, that still droplet is the whole feature and it is a
 * complete one — it stays in the flow, in its slot, and `data-companion` (which
 * gates the fixed positioning and every live colour channel) is never set.
 */

/** How far a target has to be before the gaze is fully committed. */
const AIM_R = 380;
/** Pointer inside this radius of the droplet's centre and it leans away. */
const DODGE_R = 104;
/** How long after a keystroke the visitor still counts as writing. */
const TYPING_MS = 1100;
/** How long after the last pointer move the visitor still counts as present. */
const POINTER_MS = 2600;
/** How long a beat of relief lasts when an invalid field becomes valid. */
const APPROVE_MS = 620;
/** How long a startle lasts. An event, not a mood. */
const STARTLE_MS = 720;
/** Where it parks, as a fraction of the viewport height, once undocked. */
const PARK_VH = 0.62;
/** The dock/park spring. Slower than the gaze: a body travelling, not an eye. */
const OMEGA_POS = 7.4;
const ZETA_POS = 0.92;

/**
 * THE LIFE CYCLE, which is the half of the reference this build was missing.
 *
 * The first version had fifteen REACTIONS and no life: between events it sat at
 * `rest` indefinitely, which is a screensaver with good manners. What the lab
 * gets right is that an avatar left alone should visibly pass time — get bored,
 * get heavy, go under — because that is what makes coming back to it feel like
 * waking something rather than resuming a loop.
 *
 * The ladder is deliberately SLOW. A droplet that yawns after four seconds is
 * commenting on how long you are taking to fill in a form, and nobody asked it
 * to. These numbers are long enough that a visitor who is actually working
 * never sees past `rest`, and only somebody who has genuinely walked away does.
 */
const BORED_MS = 15000;
const DROWSY_MS = 32000;
const SLEEP_MS = 58000;
/** How long the waking pose is held before the ladder hands over to the mood. */
const WAKE_MS = 950;

/**
 * BEING TOUCHED, REPEATEDLY.
 *
 * One poke is a startle. The second inside the window is the droplet realising
 * it is a game (`playful`), and the third and beyond is it enjoying the game
 * (`laughing`). A companion that answers the tenth poke exactly as it answered
 * the first is not reacting, it is responding — and the visitor stops after two.
 */
const POKE_WINDOW_MS = 2800;
const PLAY_MS = 1500;
const LAUGH_MS = 2300;

/** Hovered continuously this long and it gets self-conscious. */
const SHY_MS = 3000;
/** Crowded — not touched — this long and it stops dodging and starts staring. */
const SUSPECT_MS = 2200;
/** Closing speed that reads as a lunge rather than as a hand arriving (px/s). */
const RUSH_SPEED = 1900;
/** Page speed above which it stops trying to fix on anything (px/s). */
const SEARCH_SPEED = 1100;
/** How long a scroll keeps it scanning after the page stops moving. */
const SEARCH_MS = 650;
/** The default hold for a one-off reaction with no other clock. */
const BEAT_MS = 1400;
/** How long the send is celebrated before it settles into `delivered`. */
const CELEBRATE_MS = 2300;
/** An error left on screen this long stops being news and becomes sorrow. */
const SAD_AFTER_MS = 9000;
/** Uninterrupted typing for this long turns watching (`read`) into `working`. */
const WORKING_MS = 2600;
/** A single input event that removes this many characters reads as a scrap. */
const SCRAP_CHARS = 14;

/**
 * THE ANGER POLICY, and the only piece of taste in this file.
 *
 * A companion that scowls the instant anything is wrong is a nag; one that
 * never scowls is furniture. The rule shipped here:
 *
 *   · the FIRST rejected submit gets `doubt` — a raised brow, not a scowl.
 *     Everyone mistypes an email once, and being glared at for it is a worse
 *     experience than no companion at all.
 *   · the SECOND and every later rejection gets `angry`, and it escalates:
 *     each further rejection holds the scowl longer, to a ceiling.
 *   · it FORGIVES. Anger expires on its own, any correction cancels it, and a
 *     confirmed send resets the count to zero.
 *
 * `rejections` is 1-based.
 */
function angerPolicy(rejections: number): {
  expression: CompanionExpression;
  holdMs: number;
} {
  if (rejections <= 1) return { expression: "doubt", holdMs: 2400 };
  return {
    expression: "angry",
    holdMs: Math.min(2600 + (rejections - 2) * 900, 6000),
  };
}

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
  /** Anger, approval and startle windows. */
  angryUntil: number;
  angryAs: CompanionExpression;
  approveUntil: number;
  rejections: number;
  /** Controls that were invalid on the previous pass. */
  invalid: Set<string>;
  /** The pointer is inside DODGE_R / actually on the droplet. */
  crowded: boolean;
  crowdedAt: number;
  hovered: boolean;
  hoveredAt: number;
  /** This hover has already spent its parting wink. */
  winked: boolean;

  /**
   * ONE-OFF REACTIONS, as a window rather than as a flag each.
   *
   * `startled`, `scared`, `surprised`, `confused`, `playful` and `laughing` all
   * have the same shape — an expression that outranks the mood for a while and
   * then simply stops. Six booleans with six expiries would be six chances for
   * two of them to be true at once and no rule about which wins; one slot
   * cannot contradict itself, and the LAST thing that happened to the droplet
   * is by definition the thing it should be answering.
   */
  beatUntil: number;
  beatAs: CompanionExpression;

  /** The touch ledger, for the poke escalation. */
  pokes: number;
  pokedAt: number;

  /** The last pointer sample, for the closing speed that reads as a lunge. */
  px: number;
  py: number;
  pt: number;

  /**
   * THE IDLE LADDER. `activeAt` is the last time the visitor did ANYTHING;
   * everything below rest is measured from it. `wokeAt` is the start of the
   * waking beat, and `deep` remembers that there is something to wake FROM —
   * without it, every stray pointer move would fire a waking animation.
   */
  activeAt: number;
  wokeAt: number;
  deep: boolean;

  /** When the current uninterrupted run of typing began. */
  runFrom: number;
  /** Value lengths from the previous input event, to see a big deletion. */
  lens: Map<string, number>;

  /** When the outcome nodes appeared, so a beat can be timed off them. */
  successAt: number;
  errorAt: number;

  /** Page speed, from the runtime's own read phase. */
  scrollV: number;
  scrolledAt: number;
};

export function Companion() {
  const slot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const slotEl = slot.current;
    if (!slotEl) return;
    // The same gate the membranes use: reduced motion turns this off entirely
    // and leaves the still droplet already in the markup, in the flow.
    if (membraneMode() === "off") return;

    const carrier = slotEl.querySelector<HTMLElement>(".cp-carrier");
    const bodyEl = slotEl.querySelector<SVGPathElement>(".cp-body");
    const eyeL = slotEl.querySelector<SVGPathElement>(".cp-eye-l");
    const eyeR = slotEl.querySelector<SVGPathElement>(".cp-eye-r");
    if (!carrier || !bodyEl || !eyeL || !eyeR) return;

    const comp = makeCompanion(1);
    const now0 = performance.now();
    const live: Live = {
      ax: 0,
      ay: 0,
      aiming: false,
      typedAt: -1e9,
      movedAt: -1e9,
      angryUntil: -1e9,
      angryAs: "doubt",
      approveUntil: -1e9,
      rejections: 0,
      invalid: new Set(),
      crowded: false,
      crowdedAt: -1e9,
      hovered: false,
      hoveredAt: -1e9,
      winked: false,
      beatUntil: -1e9,
      beatAs: "startled",
      pokes: 0,
      pokedAt: -1e9,
      px: 0,
      py: 0,
      pt: 0,
      // It starts AWAKE. A droplet that is already bored when the page paints
      // is commenting on a visitor who has not arrived yet.
      activeAt: now0,
      wokeAt: -1e9,
      deep: false,
      runFrom: -1e9,
      lens: new Map(),
      successAt: -1,
      errorAt: -1,
      scrollV: 0,
      scrolledAt: -1e9,
    };

    const panel = document.querySelector(".contact-panel");
    const form = () =>
      document.querySelector<HTMLFormElement>("form.contact-form");

    /** Anything the visitor does. Resets the ladder and, if it was under, wakes it. */
    function stir(now: number) {
      live.activeAt = now;
      if (live.deep) {
        live.deep = false;
        live.wokeAt = now;
        comp.blink();
        // A small push off the floor — the stretch of something sitting up.
        comp.hop(0.45);
      }
    }

    /** Hold a one-off reaction for a while. The last thing to happen wins. */
    function beat(expression: CompanionExpression, ms = BEAT_MS) {
      live.beatAs = expression;
      live.beatUntil = performance.now() + ms;
    }

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
       * hold the droplet — narrow viewports, where the shell is nearly the whole
       * window — it keeps its column position instead, because a droplet half
       * off the left edge is worse than one that overlaps a margin.
       */
      // `.contact-page` carries the gutter as PADDING, so its own box starts at
      // the viewport edge and its `left` is always 0. The gutter has to be read
      // off something laid out INSIDE it — the masthead is the first such block
      // and is present on every width.
      const content = document.querySelector(".contact-masthead");
      const gutter = content ? content.getBoundingClientRect().left : 0;
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
      const gone = dockY < -slotW * 0.6 || dockY > pageVH - slotW * 0.35;
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
      if (el.id === "contact-email") {
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
          live.approveUntil = now + APPROVE_MS;
          // A small bob of relief. `approve` is a pose; this is the body
          // agreeing with it.
          comp.hop(0.35);
          // RELIEF CANCELS THE SCOWL. Any correction earns it, even a partial
          // one: someone working through two errors is making progress, and a
          // companion that keeps glaring until the last is fixed is punishing
          // them for the ones they already got right.
          live.angryUntil = -1e9;
        }
      }
    }

    /**
     * IS THE FORM READY TO GO?
     *
     * Every visible control carries a value and none of them is flagged. It is
     * read off the same nodes `pollValidity` already walks, so it costs nothing
     * extra, and it is the one piece of ANTICIPATION the droplet has: it looks
     * pleased at a finished form a beat before the visitor presses send.
     */
    function formComplete() {
      if (!controls.length) return false;
      for (const el of controls) {
        if (el.getAttribute("aria-invalid") === "true") return false;
        const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
        if (!value || !value.trim()) return false;
      }
      return true;
    }

    /** Is the pointer over the submit button? */
    let ctaHot = false;

    /** The form's published state, in priority order. Highest wins. */
    function readState(now: number): CompanionExpression {
      if (panel?.querySelector(".contact-success")) {
        // A confirmed send wipes the ledger. The companion does not carry a
        // grudge from one enquiry into the next.
        live.rejections = 0;
        live.angryUntil = -1e9;
        if (live.successAt < 0) {
          live.successAt = now;
          // THE ONE UNRESERVED MOMENT IN THE WHOLE FEATURE. Everywhere else the
          // droplet is deliberately understated; this is the single event the
          // page exists to produce, and it is allowed to be loud for two
          // seconds.
          comp.hop(1.3);
          comp.laugh(1);
        }
        return now - live.successAt < CELEBRATE_MS ? "celebrate" : "delivered";
      }
      live.successAt = -1;

      if (panel?.querySelector(".contact-error")) {
        if (live.errorAt < 0) live.errorAt = now;
        // Deflation first, then sorrow. An alert that has been on screen for
        // ten seconds is not news any more, and holding the flinch that long
        // reads as a stuck animation rather than as a reaction.
        return now - live.errorAt > SAD_AFTER_MS ? "sad" : "fail";
      }
      live.errorAt = -1;

      if (panel?.querySelector(".contact-pending")) return "hold";
      if (form()?.getAttribute("aria-busy") === "true") return "effort";

      // A reaction outranks a mood: it is a direct answer to something that
      // just happened, and an answer that arrives after the next mood has
      // settled is not an answer.
      if (now < live.beatUntil) return live.beatAs;
      if (now < live.angryUntil) return live.angryAs;
      if (now < live.approveUntil) return "approve";
      // Coming back from under. Held briefly so waking is something the reader
      // can watch rather than a cut.
      if (now - live.wokeAt < WAKE_MS) return "waking";

      // Deliberate attention beats everything below it, including a focused
      // field: someone who has put their cursor ON him is talking to him. Held
      // too long, the attention stops being flattering.
      if (live.hovered) {
        return now - live.hoveredAt > SHY_MS ? "shy" : "curious";
      }
      // The pointer is on the send button. It knows what that button does.
      if (ctaHot) return "excited";

      const el = focusedControl();
      if (el) {
        if (looksWrong(el)) return "doubt";
        if (now - live.typedAt < TYPING_MS) {
          if (el instanceof HTMLTextAreaElement && el.value.length > 90) {
            return "ponder";
          }
          // Watching somebody type is `read`. Typing that has been going for a
          // few seconds without a break is somebody who knows what they want to
          // say, and the droplet settles into the work with them.
          return now - live.runFrom > WORKING_MS ? "working" : "read";
        }
        return "attend";
      }

      if (live.crowded) {
        // Circling him without touching. It stops flinching and starts
        // watching — which is a much better answer to a cursor that keeps
        // coming back than a fourth identical dodge.
        return now - live.crowdedAt > SUSPECT_MS ? "suspicious" : "dodge";
      }
      // The page is moving too fast to fix on anything.
      if (now - live.scrolledAt < SEARCH_MS) return "searching";
      // Everything is filled in and nothing is wrong. It looks pleased with the
      // work a beat before the visitor sends it.
      if (formComplete()) return "proud";
      if (now - live.movedAt < POINTER_MS) return "notice";

      // ── the life cycle, once nothing above has anything to say ─────────────
      const alone = now - live.activeAt;
      if (alone > SLEEP_MS) return "sleeping";
      if (alone > DROWSY_MS) return "drowsy";
      if (alone > BORED_MS) return "bored";
      return "rest";
    }

    // ── listeners ────────────────────────────────────────────────────────────

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const c = centre();
      const d = Math.hypot(e.clientX - c.x, e.clientY - c.y);

      /**
       * A LUNGE, not an arrival.
       *
       * The same cursor landing on the droplet can be a hand coming to rest or
       * a hand thrown at it, and the difference is entirely in the speed. Taken
       * as CLOSING speed rather than raw speed: something crossing the screen
       * fast is not coming for him, and answering that with fear would make the
       * droplet frightened of ordinary mouse travel.
       */
      const dt = live.pt ? now - live.pt : 0;
      if (dt > 4 && dt < 240) {
        const was = Math.hypot(live.px - c.x, live.py - c.y);
        const closing = ((was - d) / dt) * 1000;
        if (closing > RUSH_SPEED && d < DODGE_R * 1.6 && now > live.beatUntil) {
          beat("scared", 1000);
          comp.shake(0.8);
        }
      }
      live.px = e.clientX;
      live.py = e.clientY;
      live.pt = now;

      live.movedAt = now;
      stir(now);
      const crowded = d < DODGE_R;
      if (crowded && !live.crowded) live.crowdedAt = now;
      live.crowded = crowded;
      // While the visitor is writing, the caret outranks the pointer: a hand
      // resting on a mouse is not where the attention is.
      if (now - live.typedAt > TYPING_MS) {
        aimAt(e.clientX, e.clientY);
      }
    };

    const onDown = (e: PointerEvent) => {
      const now = performance.now();
      const c = centre();
      const dx = e.clientX - c.x;
      const dy = e.clientY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      // The blow arrives FROM the click, so the body squashes toward it and
      // recoils across. Close clicks hit harder.
      comp.poke(dx / d, dy / d, Math.max(0.25, 1 - d / (AIM_R * 1.6)));
      aimAt(e.clientX, e.clientY);
      live.movedAt = now;
      stir(now);
    };

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
      const now = performance.now();
      // A run of typing is one that has not paused for longer than the window
      // that counts as still writing.
      if (now - live.typedAt > TYPING_MS) live.runFrom = now;
      live.typedAt = now;
      stir(now);
      comp.tick();

      /**
       * SOMEBODY JUST BINNED WHAT THEY WROTE.
       *
       * A single input event that removes a dozen characters is a select-all
       * and delete, or a cut — not typing. It is the one editing action that is
       * unambiguous without listening to keys, and it is the moment a reader is
       * most likely to be starting over, which is worth a reaction.
       */
      const key = el.id || el.name || "?";
      const was = live.lens.get(key) ?? el.value.length;
      if (was - el.value.length >= SCRAP_CHARS) {
        beat("confused", 1100);
        comp.shake(1);
      }
      live.lens.set(key, el.value.length);

      const p = caretPoint(el);
      aimAt(p.x, p.y);
    };

    /**
     * PASTED. Something appeared in the field all at once, which is exactly
     * what `surprised` is for — and unlike every other reaction here it is a
     * thing arriving rather than a thing being done to the droplet, which is
     * the distinction between `surprised` and `startled`.
     */
    const onPaste = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.closest("form.contact-form")) {
        return;
      }
      if (el.closest(".contact-honeypot")) return;
      stir(performance.now());
      beat("surprised", 1000);
      comp.hop(0.5);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.closest("form.contact-form") &&
        !el.closest(".contact-honeypot")
      ) {
        stir(performance.now());
        comp.blink();
        live.lens.set(el.id || el.name || "?", el.value.length);
        const p = caretPoint(el);
        aimAt(p.x, p.y);
      }
    };

    const onSubmit = () => {
      // Reset the ledger optimistically: if the submit is rejected, the summary
      // focus below counts it again a moment later. A submit that GOES THROUGH
      // must not leave anger armed behind it.
      live.angryUntil = -1e9;
      stir(performance.now());
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

      live.rejections += 1;
      const { expression, holdMs } = angerPolicy(live.rejections);
      live.angryAs = expression;
      live.angryUntil = performance.now() + holdMs;
      // The scowl gets a refusal to go with it, from the second one on. A shake
      // on the FIRST mistake would be a telling-off, which is exactly what the
      // anger policy above exists to avoid.
      if (expression === "angry") comp.shake(1.1);

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

    /**
     * THE SEND BUTTON, watched from the outside.
     *
     * `pointerover` on the document rather than a listener bound to the button:
     * `ContactForm` owns that node, it re-renders it, and a companion holding a
     * reference to it is a companion with an opinion about the form's render
     * tree. Delegation costs one `closest` on a pointer event that is already
     * being handled and cannot go stale.
     */
    const onOver = (e: PointerEvent) => {
      const el = e.target;
      ctaHot =
        el instanceof HTMLElement &&
        !!el.closest("form.contact-form .cta-primary");
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
      live.hoveredAt = performance.now();
      live.winked = false;
      stir(performance.now());
      comp.blink();
    };
    const onLeave = () => {
      const now = performance.now();
      /**
       * A PARTING WINK, and only after a real look.
       *
       * It fires once per hover and only if the cursor stayed long enough for
       * the droplet to have noticed — a wink at every cursor that clips its
       * edge on the way past is a tic, not a gesture. This is the one place the
       * companion initiates something instead of answering.
       */
      if (!live.winked && now - live.hoveredAt > 900) {
        live.winked = true;
        comp.wink(live.px < posX + slotW / 2 ? -1 : 1);
      }
      live.hovered = false;
    };
    const onBodyDown = (e: PointerEvent) => {
      const now = performance.now();
      stir(now);

      // THE POKE LEDGER. Inside the window it escalates; outside it, the game
      // has been forgotten and the next touch is a fresh surprise.
      live.pokes = now - live.pokedAt < POKE_WINDOW_MS ? live.pokes + 1 : 1;
      live.pokedAt = now;

      if (live.pokes === 1) {
        beat("startled", STARTLE_MS);
      } else if (live.pokes === 2) {
        beat("playful", PLAY_MS);
        comp.hop(0.9);
      } else {
        // Three and up. It is a game now, and the mirth builds on itself
        // because `laugh` tops up rather than restarting.
        beat("laughing", LAUGH_MS);
        comp.laugh(0.85);
        comp.hop(0.7);
      }

      const p = toLocal(e.clientX, e.clientY);
      // THE SAME WAVE A PRESSED CTA RUNS, from the point that was struck.
      comp.press(true);
      comp.strike(p.x, p.y, now, 1);
      // …plus a whole-body recoil away from the hand, which a button does not
      // do because a button is not a body. It softens as the game goes on: the
      // fourth poke is not a shock.
      const c = centre();
      const dx = e.clientX - c.x;
      const dy = e.clientY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      comp.poke(dx / d, dy / d, live.pokes === 1 ? 1.4 : 0.7);
    };
    const onUp = () => comp.press(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("input", onInput, true);
    document.addEventListener("paste", onPaste, true);
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

    let chillWas = -1;
    let glowWas = -1;
    let lumenWas = -1;
    let litWas = false;
    let drew = false;

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
      step: (t: number) => comp.step(t),
      get asleep() {
        return comp.asleep;
      },
      setTide: (on: number) => comp.setTide(on),
      /**
       * The page's SPEED, already smoothed by the runtime for the tide — so
       * noticing a reader moving too fast to be reading costs this file no
       * listener, no sampling and no second opinion about what "fast" is.
       * `scroll` is the tide's driver first; reading it here is free.
       */
      scroll(v: number) {
        comp.scroll(v);
        live.scrollV = v;
        if (Math.abs(v) > SEARCH_SPEED) {
          const now = performance.now();
          live.scrolledAt = now;
          live.activeAt = now;
        }
      },
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

      const want = readState(now);
      if (want !== comp.expression) comp.express(want);
      // Anything at drowsy or below is properly under, and coming back out of
      // it is an event the next `stir` will fire. Set from the STATE rather
      // than from the clock so a droplet dozing off mid-frame and a droplet
      // that never dozed cannot disagree.
      if (want === "drowsy" || want === "sleeping") live.deep = true;

      /**
       * WHERE IT LOOKS WHEN IT IS NOT WITH YOU.
       *
       * Boredom and sleep are not poses that can be held while the eyes stay
       * locked on the last place the cursor was — that reads as a stare, which
       * is the opposite of both. Handing the gaze back to the kernel's own
       * wander is what makes the ladder legible: the eyes drift off first, and
       * only then do the lids come down.
       */
      const adrift =
        want === "bored" ||
        want === "drowsy" ||
        want === "sleeping" ||
        want === "shy";
      if (adrift && live.aiming) {
        live.aiming = false;
        comp.release();
      }

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
      if (!placed) {
        posX = target.x;
        posY = target.y;
        velX = 0;
        velY = 0;
        placed = true;
      } else {
        const h = 1 / 60;
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

      /**
       * THE BOUNCE RIDES ON THE TRAVEL, in CSS pixels.
       *
       * The kernel deliberately keeps `hop` out of the ring — `COMP.VIEW` is
       * sized for the widest SHAPE it can reach and a translation would spend
       * that margin — so the gesture arrives here, in viewBox units, and is
       * scaled by the same factor the SVG is. Added to the spring's own
       * transform rather than to a second one: two transforms on one element is
       * two ways for the droplet's position to be wrong.
       */
      const bob = (comp.offset.y * slotW) / (COMP.VIEW * 2);
      carrier!.style.transform = `translate3d(${posX.toFixed(1)}px, ${(posY + bob).toFixed(1)}px, 0)`;

      bodyEl!.setAttribute("d", comp.bodyPath());
      // An empty string is the kernel saying the lid is shut. Blanking `d` is
      // how the eye closes; there is no separate lid element to hide.
      eyeL!.setAttribute("d", comp.pupilPath(-1));
      eyeR!.setAttribute("d", comp.pupilPath(1));

      /**
       * THE LIGHT CHANNELS, written only when they have actually moved.
       *
       * A custom property set every frame is a style recalculation every frame,
       * for values that change over hundreds of milliseconds. Rounded to two
       * decimals first, so the comparison is against what would be WRITTEN and
       * not against a float that never repeats.
       *
       * Three channels, all inside the brand's own cyans: `chill` toward
       * cyan-deep, `glow` toward cyan-glow, and `lumen` — which is not a hue at
       * all but how much of itself the droplet is spending. `app/contact.css`
       * owns the tokens; nothing here knows a colour.
       */
      const chill = Math.round(comp.chill * 100) / 100;
      if (chill !== chillWas) {
        slotEl!.style.setProperty("--cp-chill", String(chill));
        chillWas = chill;
      }
      const glow = Math.round(comp.glow * 100) / 100;
      if (glow !== glowWas) {
        slotEl!.style.setProperty("--cp-glow", String(glow));
        glowWas = glow;
      }
      const lumen = Math.round(comp.lumen * 100) / 100;
      if (lumen !== lumenWas) {
        slotEl!.style.setProperty("--cp-lumen", String(lumen));
        lumenWas = lumen;
      }
      /**
       * THE HALO IS GATED ON AN ATTRIBUTE, not on the value.
       *
       * `filter: drop-shadow()` at radius zero is still a filter: the element
       * keeps its own compositing pass for a blur nobody can see, on a surface
       * that redraws every frame. So the rule is attached only while the glow
       * is worth something, and the attribute flips at a threshold rather than
       * tracking the number — one class change per mood, not one per frame.
       */
      const lit = glow > 0.08;
      if (lit !== litWas) {
        if (lit) slotEl!.setAttribute("data-glow", "");
        else slotEl!.removeAttribute("data-glow");
        litWas = lit;
      }

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
      window.removeEventListener("pointerover", onOver);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusin", onSummaryFocus, true);
      document.removeEventListener("submit", onSubmit, true);
      bodyEl.removeEventListener("pointerenter", onEnter);
      bodyEl.removeEventListener("pointerleave", onLeave);
      bodyEl.removeEventListener("pointerdown", onBodyDown);
      slotEl.removeAttribute("data-companion");
      slotEl.removeAttribute("data-glow");
      carrier.style.transform = "";
    };
  }, []);

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
