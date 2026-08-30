// The three legal documents the footer's Legal column links to (S11).
// `slug` is the URL segment under /[locale]/legal/; `key` indexes the copy
// under the `legal.docs` i18n namespace, so both locales stay in lockstep.
export const LEGAL_DOCS = [
  { slug: "terms", key: "terms" },
  { slug: "privacy", key: "privacy" },
  { slug: "cookies", key: "cookies" },
] as const;

export type LegalDoc = (typeof LEGAL_DOCS)[number];
export type LegalSlug = LegalDoc["slug"];

/** One shape for the copy each document carries, read via `t.raw()`. */
export type LegalSection = { heading: string; body: string };

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}

/**
 * The copy shipped in `lib/i18n/messages` is an HONEST SCAFFOLD: it describes
 * only what this codebase demonstrably does (Plausible analytics, Resend
 * contact delivery, Sanity as the portfolio source) and invents no legal
 * commitments. Until the owner replaces it with reviewed text, the pages
 * carry a visible review notice AND `noindex` — a placeholder policy that
 * search engines treat as the real one is worse than no page at all.
 *
 * Set LEGAL_COPY_APPROVED=true to drop both. Same fail-closed grammar as
 * CONTACT_DELIVERY_READY and PUBLIC_IDENTITY_READY.
 */
export const LEGAL_COPY_APPROVED =
  process.env.LEGAL_COPY_APPROVED?.trim() === "true";
