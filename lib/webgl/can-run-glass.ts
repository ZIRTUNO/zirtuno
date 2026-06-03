"use client";

/**
 * Whether this device should mount the raymarched glass (S2.3) at all. Thin
 * wrapper over the device-tier system (lib/webgl/gpu-tier) so existing call
 * sites keep working: glass mounts for the "full" and "lite" tiers and falls
 * back to the static SVG mark only for "none" (software / no WebGL).
 *
 * The tier itself (full vs lite — step count, internal resolution, env) is read
 * directly from detectGpuTier() inside MetaballScene.
 */

import { detectGpuTier } from "./gpu-tier";

export { glassForced } from "./gpu-tier";

export function canRunGlass(): boolean {
  if (typeof window === "undefined") return false;
  return detectGpuTier() !== "none";
}
