import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Footer } from "@/components/chrome/Footer";
import { CtaButton } from "@/components/chrome/CtaButton";
import { routing } from "@/lib/i18n/config";
import { ogImage } from "@/lib/seo/og-image";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "careers" });
  const canonical = `/${locale}/careers`;

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical,
      languages: { "pt-BR": "/pt/careers", en: "/en/careers" },
    },
    openGraph: {
      type: "website",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: canonical,
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [ogImage(locale, t("metaTitle"))],
    },
  };
}

/**
 * S11 · Trabalhe Conosco / Work with us — the studio's open door.
 *
 * NO JOB BOARD. Zirtuno keeps no public list of openings, and inventing one
 * would be the single most damaging thing this page could do: a stale vacancy
 * costs a real applicant real effort. The page instead says what the studio
 * is, which functions it is organised by, and how to put your name in front
 * of it — and the application rides the contact pipeline that already works,
 * tagged `intent=careers` so it can be filtered from commercial enquiries.
 *
 * The six functions come from the `studio` namespace, not a copy of it: the
 * Studio chapter already publishes that list, and two lists that must agree
 * are one list that will eventually disagree.
 */
export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("careers");
  const tStudio = await getTranslations("studio");
  const roles = tStudio.raw("roles") as string[];
  const traits = t.raw("traits") as { heading: string; body: string }[];

  return (
    <>
      <main
        id="content"
        className="page-x min-h-svh pb-[var(--space-section)] pt-[calc(var(--topbar-h)+3rem)]"
      >
        <div className="careers-doc">
          <p className="chapter-label">{t("chapterLabel")}</p>
          <h1 className="type-page-title mt-[var(--type-space-label-title)] text-paper">
            {t("title")}
          </h1>
          <p className="type-lead-copy mt-[var(--type-space-title-lead)]">
            {t("lead")}
          </p>

          <section className="careers-section">
            <h2 className="careers-heading">{t("functionsHeading")}</h2>
            <p className="careers-body">{t("functionsBody")}</p>
            <ul className="careers-functions">
              {roles.map((role) => (
                <li key={role} className="careers-function">
                  {role}
                </li>
              ))}
            </ul>
          </section>

          <section className="careers-section">
            <h2 className="careers-heading">{t("traitsHeading")}</h2>
            <dl className="careers-traits">
              {traits.map((trait) => (
                <div key={trait.heading} className="careers-trait">
                  <dt className="careers-trait-title">{trait.heading}</dt>
                  <dd className="careers-trait-body">{trait.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="careers-section">
            <h2 className="careers-heading">{t("applyHeading")}</h2>
            <p className="careers-body">{t("applyBody")}</p>
            {/* Routed, not scrolled: from /careers the CTA's same-page path
                does not apply, so this navigates home carrying the tag. */}
            <div className="careers-cta">
              <CtaButton
                variant="primary"
                intent="careers"
                label={t("applyCta")}
                placement="careers"
              />
            </div>
            <p className="careers-note">{t("applyNote")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
