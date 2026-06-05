"use client";

/**
 * Whether this device should mount the RAYMARCHED glass (S2.3). Thin wrapper over
 * the device-tier system (lib/webgl/gpu-tier): true only for the "full" tier
 * (capable/discrete GPUs that clear the perf probe). Integrated / mobile / masked
 * ("lite") and software ("none") fall back to the static SVG mark here — the
 * raymarch is a per-pixel workload that TDR-freezes weak GPUs, so it must never
 * mount on them.
 *
 * The hero metaball is the exception: it serves the lighter MESH technique to the
 * "lite" tier (see lib/webgl/gpu-tier → glassTech, and MetaballCanvas). The other
 * sections (fracture / ecosystem / services / contact / origin) keep the static
 * fallback on "lite" until the mesh technique is extended to them.
 */

import { canRaymarch } from "./gpu-tier";

export { glassForced } from "./gpu-tier";

export function canRunGlass(): boolean {
  if (typeof window === "undefined") return false;
  return canRaymarch();
}
