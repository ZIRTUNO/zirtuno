"use client";

/**
 * The live Lenis instance (set by LenisProvider), for imperative smooth scrolls
 * outside React — the same-page CTA path (R0): intent CTAs on the homepage
 * scroll to #contact through Lenis instead of triggering a router navigation.
 * Null under reduced motion (Lenis is disabled there) or before mount —
 * callers fall back to native scrollIntoView.
 */

import type Lenis from "lenis";

let current: Lenis | null = null;

export function setLenis(instance: Lenis | null): void {
  current = instance;
}

export function getLenis(): Lenis | null {
  return current;
}
