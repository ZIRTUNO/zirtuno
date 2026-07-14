import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, routing } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { ProjectCard } from "@/components/chapters/ProjectCard";
import { Footer } from "@/components/chrome/Footer";
import { getProjectsByCategory } from "@/lib/content/work";
import { PROJECT_CATEGORIES } from "@/lib/sanity/types";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "work" });
  const title = t("indexTitle");
  const description = t("indexLead");
  const canonical = `/${locale}/work`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { "pt-BR": "/pt/work", en: "/en/work" },
    },
    openGraph: {
      type: "website",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: canonical,
      title,
      description,
      images: [{ url: `/${locale}/opengraph-image`, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/${locale}/opengraph-image`],
    },
  };
}

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("work");
  const projects = await getProjectsByCategory(category);
  const active = category ?? "all";

  return (
    <>
      <main
        id="content"
        className="page-x min-h-svh pb-28 pt-[calc(var(--topbar-h)+3rem)]"
      >
        <p className="chapter-label">{t("chapterLabel")}</p>
        <h1 className="type-page-title mt-[var(--type-space-label-title)] text-paper">
          {t("indexTitle")}
        </h1>
        <p className="type-lead-copy mt-[var(--type-space-title-lead)] text-paper-mute">
          {t("indexLead")}
        </p>

        <nav
          className="mt-10 flex flex-wrap gap-2"
          aria-label={t("indexTitle")}
        >
          <Link
            href="/work"
            data-cursor="hover"
            className={cn("work-filter", active === "all" && "is-active")}
            aria-current={active === "all" ? "page" : undefined}
          >
            {t("filterAll")}
          </Link>
          {PROJECT_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/work?category=${c}`}
              data-cursor="hover"
              className={cn("work-filter", active === c && "is-active")}
              aria-current={active === c ? "page" : undefined}
            >
              {t(`categories.${c}`)}
            </Link>
          ))}
        </nav>

        {projects.length === 0 ? (
          <p className="mt-16 max-w-2xl text-body-l text-paper-mute">
            {t(category ? "empty" : "emptyPortfolio")}
          </p>
        ) : (
          <div className="mt-12 grid min-w-0 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
