// Metaball state REGISTRY (S2.3) — the ONE ordered list every surface agrees on:
// the hero autocycle, the Services scrub, keyboard nav, the PillarIndicator and
// the chapter drivers all index states through here. Index 0 = the mark; 1–7 =
// the service pillars, in the same order as the Services chapter
// (lib/content/services). Folded from the old states.ts in R1; the legacy
// GLSL-generator content this file used to hold retired with MetaballScene.

export const METABALL_STATES = [
  { key: "mark", label: "Mark" },
  { key: "web", label: "Web Design" },
  { key: "software", label: "Software" },
  { key: "ai", label: "AI" },
  { key: "automation", label: "Automation" },
  { key: "data", label: "Data" },
  { key: "branding", label: "Branding" },
  { key: "marketing", label: "Marketing" },
] as const;

export type MetaballStateKey = (typeof METABALL_STATES)[number]["key"];

/** Total states (0 = mark, 1–7 = the service pillars). */
export const STATE_COUNT = METABALL_STATES.length;

/** The runtime SVG for each state — the EXACT vector rest forms the unified
 *  liquid field renders (morph-spec v1.6/v1.7). */
export const SVG_URLS: string[] = METABALL_STATES.map((s) =>
  s.key === "mark" ? "/brand/zirtuno-logo-mark.svg" : `/brand/forms/${s.key}.svg`,
);
