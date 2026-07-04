import type { ProjectCategory } from "@/lib/sanity/types";

/**
 * Category → its SDF-glass form still (R3): baked, shipped PNGs of the EXACT
 * liquid forms (scripts/build-form-stills.mjs → public/brand/stills). The
 * work cards render these as placeholder ART until real project media
 * arrives — consistent, on-brand, zero runtime WebGL, every tier.
 */
export const FORM_STILLS: Record<ProjectCategory, string> = {
  "web-design": "/brand/stills/web-design.png",
  software: "/brand/stills/software.png",
  ai: "/brand/stills/ai.png",
  automation: "/brand/stills/automation.png",
  data: "/brand/stills/data.png",
  branding: "/brand/stills/branding.png",
  marketing: "/brand/stills/marketing.png",
};
