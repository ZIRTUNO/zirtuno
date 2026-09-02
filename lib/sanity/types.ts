// Normalized portfolio types (S7.4). Shared by the Sanity schema, the GROQ
// result shape, and the explicit local concept source.

export type ProjectCategory =
  | "web-design"
  | "software"
  | "ai"
  | "automation"
  | "data"
  | "branding"
  | "marketing";

/**
 * Outcome rule (S7.2 / AGENTS.md rule #3): only "metric" carries a verified
 * number. "narrative" is an honest non-numeric result. "architecture" renders
 * the "Arquitetura selecionada / Selected architecture" label. NEVER fabricate.
 */
export type OutcomeType = "metric" | "narrative" | "architecture";

export interface LocaleString {
  pt: string;
  en: string;
}

/**
 * Optional, authored Rive layer for a case study. The source is projected from
 * a Sanity file asset; arbitrary third-party URLs are intentionally excluded
 * from the content contract. Title and description remain ordinary localized
 * content so the case is understandable when canvas, JavaScript, or motion is
 * unavailable.
 */
export interface ProjectRiveExperience {
  src: string;
  artboard?: string;
  stateMachine?: string;
  title: LocaleString;
  description: LocaleString;
  posterImage?: string;
}

export interface Project {
  _id?: string;
  slug: string;
  title: LocaleString;
  category: ProjectCategory[];
  /** Service tags (mono, "·"-separated on the card). Not localized. */
  servicesInvolved: string[];
  /**
   * One-breath description for the gallery panel (S7.5). The panel is a
   * glance, not the case study, so this is the shortest true sentence about
   * the project. Falls back to `challenge` when a project has not authored it.
   */
  summary?: LocaleString;
  challenge: LocaleString;
  built: LocaleString;
  outcome: LocaleString;
  outcomeType: OutcomeType;
  credits?: LocaleString;
  /** Sanity image asset ref/url; undefined for seed → CSS preview fallback. */
  previewImage?: string;
  /**
   * The client's own logo mark, shown as the small square badge on the card.
   * Optional: without it the card caption stands on its own.
   */
  markImage?: string;
  /** Optional case-only Rive enhancement. Never used by the homepage field. */
  riveExperience?: ProjectRiveExperience | null;
  liveUrl?: string;
  featured?: boolean;
  order?: number;
  /** Seed placeholder flag — replace with real verified content. */
  prototype?: boolean;
}

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  "web-design",
  "software",
  "ai",
  "automation",
  "data",
  "branding",
  "marketing",
];

/** Resolve a localized field for the active locale. */
export function localize(value: LocaleString, locale: string): string {
  return locale === "en" ? value.en : value.pt;
}
