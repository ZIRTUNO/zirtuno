// Normalized portfolio types (S7.4). Shared by the Sanity schema, the GROQ
// result shape, and the local seed fallback.

export type ProjectCategory =
  | "web-design"
  | "software"
  | "ai"
  | "automation"
  | "data"
  | "branding"
  | "marketing";

/**
 * Outcome rule (S7.2 / CLAUDE.md rule #3): only "metric" carries a verified
 * number. "narrative" is an honest non-numeric result. "architecture" renders
 * the "Arquitetura selecionada / Selected architecture" label. NEVER fabricate.
 */
export type OutcomeType = "metric" | "narrative" | "architecture";

export interface LocaleString {
  pt: string;
  en: string;
}

export interface Project {
  _id?: string;
  slug: string;
  title: LocaleString;
  category: ProjectCategory[];
  /** Service tags (mono, "·"-separated on the card). Not localized. */
  servicesInvolved: string[];
  challenge: LocaleString;
  built: LocaleString;
  outcome: LocaleString;
  outcomeType: OutcomeType;
  credits?: LocaleString;
  /** Sanity image asset ref/url; undefined for seed → CSS preview fallback. */
  previewImage?: string;
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
