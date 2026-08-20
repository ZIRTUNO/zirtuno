"use client";

/**
 * One loop for every membrane on the page.
 *
 * The homepage already runs a WebGL fluid with an FPS watchdog and a ~30 Hz
 * idle governor. A per-button `requestAnimationFrame` would put four or five
 * independent loops beside it, each doing its own layout reads, each keeping
 * the compositor awake for a button nobody is looking at. So the runtime is a
 * single scheduler with three rules:
 *
 *   ONE rAF. Registered membranes are stepped from one tick. The tick stops
 *   entirely when every membrane is asleep, and restarts on the next pointer
 *   event. An idle page costs nothing.
 *
 *   ONE pointer listener, passive, on the window — not per element. Membranes
 *   need to know about the pointer BEFORE it reaches them (that is the whole
 *   awareness idea), so `pointerenter` on each button would be too late by
 *   design.
 *
 *   LAYOUT READS ARE BATCHED. Every rect is read at the top of the tick,
 *   before any write. Reading a rect after setting a `d` attribute is the
 *   classic layout thrash, and with Lenis moving the page every frame it would
 *   be a forced synchronous layout per button per frame.
 */

/**
 * The only shape the scheduler needs. A closed `Membrane` and a 1-D `Thread`
 * both satisfy it, which is what keeps a page carrying both down to one rAF
 * and one pointer listener rather than two parallel systems.
 */
export type Driven = {
  hand(x: number | null, y?: number, vx?: number, vy?: number): void;
  step(tMs: number): boolean;
  readonly asleep: boolean;
  /** Autonomous mode (no hover device). 0..1 target, faded not snapped. */
  setTide?(on: number): void;
  /** Page scroll speed in px/s — the tide's driver. */
  scroll?(pxPerSec: number): void;
  /** Fired once as the surface enters view, if it wants an arrival. */
  arrive?(fromBelow: boolean, tMs: number): void;
};

export type MembraneHandle<T extends Driven = Driven> = {
  el: HTMLElement;
  mem: T;
  /** Called only on frames where the surface actually moved.
   *  Method syntax on purpose: it is bivariant under `strictFunctionTypes`,
   *  which is exactly the truth here — `draw` is only ever invoked with this
   *  handle's own `mem`, so a narrower parameter type is always safe. Declared
   *  as an arrow property it would force every caller to cast. */
  draw(mem: T, tMs: number): void;
  /** Live rect, refreshed by the scheduler. */
  rect: DOMRect | null;
  visible: boolean;
  /** Set once the arrival has been fired, so it happens on entry only. */
  arrived?: boolean;
};

const handles = new Set<MembraneHandle>();
let raf = 0;
let io: IntersectionObserver | null = null;

// pointer state, in viewport coordinates
let px = -1e5;
let py = -1e5;
let pvx = 0;
let pvy = 0;
let pLast = 0;
let pointerSeen = false;

// ── autonomous mode (touch) ────────────────────────────────────────────────
// A phone has no hover, so the entire hand half of this system is unreachable
// there. `auto` hands the visible membranes their own tide and feeds them the
// page's scroll speed; see MEM.TIDE_* for why scroll rather than a plain timer.
let auto = false;
let scrollY = 0;
let scrollT = 0;
let scrollV = 0; // px/s, smoothed

function onScroll() {
  const now = performance.now();
  const y = window.scrollY;
  const dt = scrollT ? Math.min(now - scrollT, 120) : 0;
  if (dt > 8) {
    const v = ((y - scrollY) / dt) * 1000;
    scrollV += (v - scrollV) * 0.4;
    scrollT = now;
    scrollY = y;
  } else if (!scrollT) {
    scrollT = now;
    scrollY = y;
  }
  wake();
}

// Autonomous membranes never sleep while they are on screen, so the frame
// budget has to come from cadence instead. ~30 Hz matches the site's own idle
// energy governor, and a 5.2 s swell has nothing a 60 Hz sample would reveal.
const AUTO_HZ = 30;
let lastAuto = 0;
// …but a DIRECT response is never throttled. A tap on a touchscreen usually
// fires pointerdown/pointerup with no pointermove between them, so the "is a
// pointer active" test stayed false and the strike integrated at 30 Hz — the
// wave came out at roughly half the amplitude a press is supposed to produce,
// on exactly the devices where the tap is the only feedback there is.
// `pokeMembranes()` already runs on every press, release and key, so it is the
// natural place to lift the throttle for as long as the response lasts.
const BOOST_MS = 900;
let boostAt = -1e9;

function onPointerMove(e: PointerEvent) {
  const now = e.timeStamp || performance.now();
  const dt = pLast ? Math.min(now - pLast, 64) : 0;
  if (dt > 0) {
    // A light EMA: raw frame-to-frame pointer deltas are noisy enough that the
    // velocity-signed wake would flicker its sign between frames on a slow,
    // steady drag — which is the one thing that term exists to avoid.
    const vx = ((e.clientX - px) / dt) * 1000;
    const vy = ((e.clientY - py) / dt) * 1000;
    pvx += (vx - pvx) * 0.35;
    pvy += (vy - pvy) * 0.35;
  }
  px = e.clientX;
  py = e.clientY;
  pLast = now;
  pointerSeen = true;
  wake();
}

function onPointerUp(e: PointerEvent) {
  // A touch has no hover. When a finger lifts, there is no longer a pointer
  // over anything — but `pointermove` will never fire again to say so, and the
  // last known position stays wherever the tap landed. Without this a tapped
  // CTA stays pushed in until the reader happens to touch something else.
  if (e.pointerType !== "mouse") onPointerLeave();
}

function onPointerLeave() {
  px = -1e5;
  py = -1e5;
  pvx = 0;
  pvy = 0;
  for (const h of handles) h.mem.hand(null);
  wake();
}

function tick(t: number) {
  raf = 0;

  // In autonomous mode the loop is throttled rather than run flat out; see
  // AUTO_HZ. A pointer-driven frame is never throttled — that one is a direct
  // answer to a hand and has to land on the next frame.
  const throttled = auto && !pointerSeen && t - boostAt > BOOST_MS;
  if (throttled && t - lastAuto < 1000 / AUTO_HZ) {
    raf = requestAnimationFrame(tick);
    return;
  }
  lastAuto = t;

  // ── read phase: every layout read happens here, before any write ────────
  for (const h of handles) {
    if (!h.visible) {
      h.mem.hand(null);
      continue;
    }
    h.rect = h.el.getBoundingClientRect();
  }

  // ── write phase ─────────────────────────────────────────────────────────
  let alive = false;
  for (const h of handles) {
    const r = h.rect;
    if (h.visible && r && pointerSeen && px > -1e4) {
      h.mem.hand(px - r.left, py - r.top, pvx, pvy);
    } else if (!h.visible) {
      h.mem.hand(null);
    }
    if (auto) {
      h.mem.setTide?.(h.visible ? 1 : 0);
      if (h.visible) h.mem.scroll?.(scrollV);
    }
    if (h.mem.step(t)) h.draw(h.mem, t);
    if (!h.mem.asleep) alive = true;
  }

  // A still pointer stops generating events, so decay the velocity here or a
  // flick would leave the wake term permanently energised.
  pvx *= 0.86;
  pvy *= 0.86;
  scrollV *= 0.82;

  if (alive) raf = requestAnimationFrame(tick);
}

function wake() {
  if (!raf && handles.size) raf = requestAnimationFrame(tick);
}

function ensureGlobals() {
  if (io) return;
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        for (const h of handles) {
          if (h.el !== entry.target) continue;
          h.visible = entry.isIntersecting;
          if (!entry.isIntersecting) {
            h.mem.hand(null);
            h.arrived = false; // so it can arrive again on the way back
          } else if (auto && !h.arrived) {
            // THE ARRIVAL. On a touch device nothing announces that this
            // control is live, so the liquid reaches it as it comes into view:
            // one wave, from the edge the reader is travelling toward.
            h.arrived = true;
            h.mem.arrive?.(scrollV >= 0, performance.now());
          }
        }
      }
      wake();
    },
    // A generous margin: a membrane should be ready to answer the pointer the
    // moment it scrolls into view, not wake up a frame late looking dead.
    { rootMargin: "220px" },
  );
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerLeave, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave, { passive: true });
  // A tab that comes back has a stale pointer and a stale clock.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) onPointerLeave();
    else wake();
  });
}

export function registerMembrane<T extends Driven>(
  h: MembraneHandle<T>,
): () => void {
  ensureGlobals();
  handles.add(h);
  io?.observe(h.el);
  wake();
  return () => {
    handles.delete(h);
    io?.unobserve(h.el);
    if (!handles.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

/**
 * Kick the loop, and lift the autonomous throttle for BOOST_MS.
 *
 * Called on every press, release and key — i.e. exactly when the surface is
 * answering the reader directly and must run at full frame rate.
 */
export function pokeMembranes(): void {
  boostAt = performance.now();
  wake();
}

/**
 * Whether the vector liquid should run at all.
 *
 * Reduced motion is a hard no: the CSS states underneath this system are
 * complete on their own, so a reader who has asked for stillness gets the
 * plain, instant, fully usable button rather than a quieter simulation.
 *
 * Without hover the hand half of the system is unreachable, so those devices
 * get "auto": the tap still fires a real strike (a tap is exactly the event
 * the wave was written for), and on top of it the membranes run the TIDE —
 * an autonomous, scroll-driven swell. See MEM.TIDE_* for the reasoning.
 */
export function membraneMode(): "full" | "auto" | "off" {
  if (typeof window === "undefined") return "off";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return "off";
  // `(hover: hover)` and not `(pointer: fine)`: a tablet with a stylus reports
  // a fine pointer and still has no hover state, and a hover-driven system on
  // a device that cannot hover is a dead button.
  const canHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;
  if (!canHover) {
    auto = true;
    scrollY = window.scrollY;
  }
  return canHover ? "full" : "auto";
}
