"use client";

/**
 * The letter targets the mist spells (R7).
 *
 * OriginWordmark samples the rendered wordmark into glyph points (box space,
 * [-1, 1] on both axes, y up) and publishes them here; FieldStage's mist
 * module notices the version change on its next frame and expands them into
 * a per-particle target texture. Module scope, like the Lenis store: the two
 * sides never hold a reference to each other, and a wordmark that re-measures
 * (a resize, the font landing) simply publishes again.
 */

let samples: Float32Array | null = null;
let version = 0;

export function setSpellSamples(next: Float32Array | null): void {
  samples = next && next.length >= 2 ? next : null;
  version++;
}

export function getSpellSamples(): { samples: Float32Array | null; version: number } {
  return { samples, version };
}
