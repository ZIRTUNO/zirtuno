import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/lib/i18n/config";
import { Footer } from "@/components/chrome/Footer";
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
 * The legal documents the footer links to (S11). Deliberately the plainest
 * page on the site: no liquid, no PageStage, no chapter choreography — the
 * reader is here to read terms, and the field would be noise over them.
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
      <main
        id="content"
        className="page-x min-h-svh pb-[var(--space-section)] pt-[calc(var(--topbar-h)+3rem)]"
      >
        <div className="legal-doc">
          <p className="chapter-label">{t("chapterLabel")}</p>
          <h1 className="type-page-title mt-[var(--type-space-label-title)] text-paper">
            {t(`docs.${doc.key}.title`)}
          </h1>
          <p className="type-lead-copy mt-[var(--type-space-title-lead)]">
            {t(`docs.${doc.key}.summary`)}
          </p>
          <p className="legal-updated">
            {t("updated", { date: t(`docs.${doc.key}.updated`) })}
          </p>

          {!LEGAL_COPY_APPROVED && (
            <p className="legal-notice" role="note">
              {t("draftNotice")}
            </p>
          )}

          {sections.map((section) => (
            <section key={section.heading} className="legal-section">
              <h2 className="legal-heading">{section.heading}</h2>
              <p className="legal-body">{section.body}</p>
            </section>
          ))}

          <p className="legal-contact">{t("contactLine")}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
