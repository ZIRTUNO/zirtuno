import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, routing } from "@/lib/i18n/config";
import { Footer } from "@/components/chrome/Footer";
import { CaseRiveExperience } from "@/components/work/CaseRiveExperience";
import { localize } from "@/lib/sanity/types";
import {
  getProjectBySlug,
  getAllProjectSlugs,
  getNextProject,
} from "@/lib/content/work";

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs();
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  // An unpublished slug renders the localized 404. This segment's metadata is
  // discarded once the page calls notFound(), so the head title comes from the
  // sibling layout's 404 default instead of from here.
  if (!project) return {};

  const t = await getTranslations({ locale, namespace: "work" });
  const title = localize(project.title, locale);
  const description = localize(project.challenge, locale);
  const isSelectedArchitecture =
    project.prototype || project.outcomeType === "architecture";
  const metaTitle = isSelectedArchitecture
    ? t("case.conceptMetaTitle", {
        status: t("architectureLabel"),
        title,
      })
    : title;
  const metaDescription = isSelectedArchitecture
    ? t("case.conceptMetaDescription", {
        status: t("architectureLabel"),
        description,
      })
    : description;
  const canonical = `/${locale}/work/${slug}`;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical,
      languages: {
        "pt-BR": `/pt/work/${slug}`,
        en: `/en/work/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: canonical,
      title: metaTitle,
      description: metaDescription,
      images: [{ url: `/${locale}/opengraph-image`, alt: metaTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: [`/${locale}/opengraph-image`],
    },
    robots: project.prototype ? { index: false, follow: false } : undefined,
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const t = await getTranslations("work");
  const next = await getNextProject(slug);
  const title = localize(project.title, locale);
  const categories = project.category.map((c) => t(`categories.${c}`));
  const isSelectedArchitecture =
    project.prototype || project.outcomeType === "architecture";
  const isNextSelectedArchitecture =
    next && (next.prototype || next.outcomeType === "architecture");
  const riveExperience = project.riveExperience;
  const riveTitle = riveExperience?.title
    ? localize(riveExperience.title, locale)
    : "";
  const riveDescription = riveExperience?.description
    ? localize(riveExperience.description, locale)
    : "";
  const rivePosterImage = riveExperience?.posterImage ?? project.previewImage;
  const hasAuthoredRiveExperience = Boolean(
    riveExperience?.src &&
    rivePosterImage &&
    riveExperience.title.pt.trim() &&
    riveExperience.title.en.trim() &&
    riveExperience.description.pt.trim() &&
    riveExperience.description.en.trim() &&
    riveTitle.trim() &&
    riveDescription.trim(),
  );

  return (
    <>
      <main
        id="content"
        className="page-x min-h-svh pb-[var(--space-section)] pt-[calc(var(--topbar-h)+3rem)]"
      >
        <header className="mt-[var(--space-block)] max-w-5xl">
          <p className="project-cats">{categories.join(" · ")}</p>
          {isSelectedArchitecture && (
            <p className="mt-[var(--space-tight)]">
              <span className="project-arch">{t("architectureLabel")}</span>
            </p>
          )}
          <h1 className="type-page-title mt-[var(--space-tight)] text-paper">{title}</h1>
          {isSelectedArchitecture && (
            <p className="mt-[var(--space-group)] max-w-2xl text-body-l text-paper-lead">
              {t("architectureNotice")}
            </p>
          )}
          {project.servicesInvolved.length > 0 && (
            <p className="project-services mt-[var(--space-tight)]">
              {project.servicesInvolved.join(" · ")}
            </p>
          )}
        </header>

        <div className="case-hero mt-[var(--space-block)]">
          {project.previewImage ? (
            <Image
              src={project.previewImage}
              alt={title}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          ) : (
            <span className="project-preview-cat" aria-hidden="true">
              {categories[0]}
            </span>
          )}
        </div>

        <div className="case-body mt-[var(--space-span)] grid gap-[var(--space-block)] md:grid-cols-2">
          <section>
            <h2 className="case-label">
              {t(
                isSelectedArchitecture
                  ? "case.conceptChallenge"
                  : "case.challenge",
              )}
            </h2>
            <p className="mt-[var(--space-tight)] text-body-l text-paper">
              {localize(project.challenge, locale)}
            </p>
          </section>
          <section>
            <h2 className="case-label">
              {t(
                isSelectedArchitecture
                  ? "case.conceptArchitecture"
                  : "case.architecture",
              )}
            </h2>
            <p className="mt-[var(--space-tight)] text-body-l text-paper">
              {localize(project.built, locale)}
            </p>
          </section>
        </div>

        {hasAuthoredRiveExperience && riveExperience && rivePosterImage && (
          <CaseRiveExperience
            key={riveExperience.src}
            src={riveExperience.src}
            artboard={riveExperience.artboard}
            stateMachine={riveExperience.stateMachine}
            title={riveTitle}
            description={riveDescription}
            posterImage={rivePosterImage}
          />
        )}

        <section className="mt-[var(--space-span)] max-w-3xl">
          <h2 className="case-label">
            {t(isSelectedArchitecture ? "case.conceptOutcome" : "case.outcome")}
          </h2>
          <p className="type-feature-title mt-[var(--space-tight)] text-paper">
            {localize(project.outcome, locale)}
          </p>
        </section>

        {project.credits && (
          <section className="mt-[var(--space-span)] max-w-3xl">
            <h2 className="case-label">{t("case.credits")}</h2>
            <p className="mt-[var(--space-tight)] text-paper-lead">
              {localize(project.credits, locale)}
            </p>
          </section>
        )}

        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="hover"
            className="cta cta-secondary mt-[var(--space-block)] inline-flex"
          >
            <span className="cta-label">{t("case.liveSite")}</span>
            <span className="cta-arrow" aria-hidden="true">
              →
            </span>
          </a>
        )}

        {next && (
          <Link
            href={`/work/${next.slug}`}
            data-cursor="hover"
            className="case-next mt-[var(--space-section)] flex flex-col gap-[var(--space-group)] border-t border-paper-faint pt-[var(--space-group)] md:flex-row md:items-baseline md:justify-between"
          >
            <span className="case-next-label">
              {t(
                isNextSelectedArchitecture
                  ? "case.nextArchitecture"
                  : "case.next",
              )}
            </span>
            <span className="case-next-name type-card-title md:max-w-[18ch] md:text-right">
              {localize(next.title, locale)} →
            </span>
          </Link>
        )}
      </main>
      <Footer />
    </>
  );
}
