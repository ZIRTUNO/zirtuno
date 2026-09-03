"use client";

/**
 * THE ORIGIN's CLOCK (R7) — one number, read by every S7 surface.
 *
 * PageStage measures the runway once per frame and writes the scene's p here
 * beside the CSS variable it already writes for the dawn. The OriginDirector
 * (the chapter's GSAP master timeline) subscribes and scrubs itself to it.
 * There is deliberately no second measurement: a ScrollTrigger of the
 * director's own would be a second clock, and two clocks disagree by a frame
 * or two, which is exactly what makes a composition read as several effects
 * rather than as one move.
 *
 * Module scope, like the Lenis store: it survives React renders and needs no
 * context. A director that mounts after the first tick receives the last
 * value immediately, so it never opens on its resting frame.
 */

export type OriginClockListener = (p: number, on: number, lead: number) => void;

let listener: OriginClockListener | null = null;
let lastP = 0;
let lastOn = 0;
let lastLead = 0;
let live = false;

/** PageStage: the runway's clock, per frame (live path only). */
export function tickOriginClock(p: number, on: number, lead: number): void {
  lastP = p;
  lastOn = on;
  lastLead = lead;
  live = true;
  if (listener) listener(p, on, lead);
}

/** PageStage: the live loop is gone (static path, unmount) — directors idle. */
export function stopOriginClock(): void {
  live = false;
}

export function isOriginClockLive(): boolean {
  return live;
}

/** The director: subscribe (receives the last tick at once); returns unsubscribe. */
export function subscribeOriginClock(fn: OriginClockListener): () => void {
  listener = fn;
  if (live) fn(lastP, lastOn, lastLead);
  return () => {
    if (listener === fn) listener = null;
  };
}
