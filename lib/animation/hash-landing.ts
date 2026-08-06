"use client";

/**
 * Hash landings across a real navigation (R5-E).
 *
 * The homepage scrolls through Lenis, which owns `window.scrollY` frame by
 * frame. A browser's native "jump to #id" therefore gets overwritten within a
 * frame or two, and a locale switch that carried `#contact` still woke up on
 * the Hero. This module remembers the requested hash across the navigation and
 * lets `LenisProvider` land on it once the chapter actually exists in the DOM
 * (chapters stream in, so the anchor can be absent on the first frame).
 *
 * sessionStorage — not a module variable: a locale switch is a server
 * navigation and may remount the whole client tree.
 */

const KEY = "zirtuno:hash-landing";

export function rememberHashLanding(hash: string): void {
  if (!hash || hash === "#") return;
  try {
    sessionStorage.setItem(KEY, hash);
  } catch {
    /* storage may be blocked — the native hash jump remains the fallback */
  }
}

/** Reads and clears the pending landing (returns `#id`, or null). */
export function takeHashLanding(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
