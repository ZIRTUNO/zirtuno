import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/lib/i18n/config";
import { Footer } from "@/components/chrome/Footer";
import DocReveal from "@/components/motion/DocReveal";
import {
  LEGAL_DOCS,
  LEGAL_COPY_APPROVED,
  findLegalDoc,
  type LegalSection,
} from "@/lib/content/legal";
import { ogImage } from "@/lib/seo/og-image";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    LEGAL_DOCS.map((doc) => ({ locale, slug: doc.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) return {};

  const t = await getTranslations({ locale, namespace: "legal" });
  const title = t(`docs.${doc.key}.title`);
  const description = t(`docs.${doc.key}.summary`);
  const canonical = `/${locale}/legal/${doc.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "pt-BR": `/pt/legal/${doc.slug}`,
        en: `/en/legal/${doc.slug}`,
      },
    },
    // Unreviewed scaffold copy must not become the indexed policy of record.
    robots: LEGAL_COPY_APPROVED ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: canonical,
      title,
      description,
      images: [ogImage(locale, title)],
    },
  };
}

/**
 * The legal documents the footer links to (S11). Still the plainest page on
 * the site — no liquid, no PageStage, no chapter choreography — but the
 * composition and the one gesture it does have are now a port of
 * upsunday.co/terms.html, which is the owner's model for this experience.
 *
 * The structure that port asks for, and which the old markup did not have:
 *
 *   · a HEAD BLOCK closed by a hairline rule, so the eyebrow/title/lede/date
 *     read as a masthead instead of as the document's first four paragraphs;
 *   · a NUMBERED body, counted in CSS so the i18n copy stays free of ordinals
 *     (they would have to be renumbered by hand in two locales otherwise);
 *   · one reveal per section and none on the head — the title is simply there
 *     when you land. `DocReveal` owns it, on GSAP + ScrollTrigger, the same
 *     way the reference's own bundle does.
 *
 * Neither data attribute is decoration. `data-reveal` is what the layout's
 * <noscript> block keys off to unhide everything when JS is off;
 * `data-doc-armed` is the pre-hydration resting state, which `DocReveal`
 * removes the moment its tweens exist.
 */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("legal");
  const sections = t.raw(`docs.${doc.key}.sections`) as LegalSection[];

  return (
    <>
      {/* No `.page-x`: the reference's `.legal` centres its own fixed column
          against the viewport, so `.legal-doc` owns the width and the gutters
          and a shell inset on top of it would double them. */}
      <main id="content" className="legal-page min-h-svh">
        <div className="legal-doc" data-doc-armed="">
          <header className="legal-head">
            <p className="chapter-label">{t("chapterLabel")}</p>
            <h1 className="legal-title">{t(`docs.${doc.key}.title`)}</h1>
            <p className="legal-lede">{t(`docs.${doc.key}.summary`)}</p>
            <p className="legal-updated">
              {t("updated", { date: t(`docs.${doc.key}.updated`) })}
            </p>

            {!LEGAL_COPY_APPROVED && (
              <p className="legal-notice" role="note">
                {t("draftNotice")}
              </p>
            )}
          </header>

          <div className="legal-body-sections">
            {sections.map((section) => (
              <section
                key={section.heading}
                className="legal-section"
                data-reveal=""
                data-doc-reveal=""
              >
                <h2 className="legal-heading">{section.heading}</h2>
                <p className="legal-body">{section.body}</p>
              </section>
            ))}
          </div>

          <p className="legal-contact">{t("contactLine")}</p>
        </div>
        <DocReveal />
      </main>
      <Footer />
    </>
  );
}
