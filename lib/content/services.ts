// Structural (locale-independent) data for the 7 service pillars (S5.3).
// Translatable copy lives in messages under `services.pillars.<key>`.
// `state` maps each pillar to its metaball state index (S2.3 / Phase 2).
// `category` is the /work filter slug (must match work.categories keys).

export const PILLARS = [
  { key: "web", category: "web-design", state: 0 },
  { key: "software", category: "software", state: 1 },
  { key: "ai", category: "ai", state: 2 },
  { key: "automation", category: "automation", state: 3 },
  { key: "data", category: "data", state: 4 },
  { key: "branding", category: "branding", state: 5 },
  { key: "marketing", category: "marketing", state: 6 },
] as const;

export type Pillar = (typeof PILLARS)[number];
export type PillarKey = Pillar["key"];
