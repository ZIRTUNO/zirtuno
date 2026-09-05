// The chapter index (S12). `id` = homepage section anchor, `key` = i18n key
// under nav.chapters. Shared by SideIndex and MobileMenu.
//
// Contact (S10) was quarantined on 2026-09-04 — see `Dead Code/README.md`.
// Restoring it means re-adding its entry HERE as well as re-mounting the
// chapter, or the index and the page disagree about where the page ends.
export const CHAPTERS = [
  { id: "hero", key: "hero" },
  { id: "problem", key: "problem" },
  { id: "ecosystem", key: "ecosystem" },
  { id: "services", key: "services" },
  { id: "method", key: "method" },
  { id: "work", key: "work" },
  { id: "name", key: "name" },
  { id: "studio", key: "studio" },
] as const;
