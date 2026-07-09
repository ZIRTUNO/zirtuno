import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, routing } from "@/lib/i18n/config";
import { Footer } from "@/components/chrome/Footer";
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
  if (!project) return {};
  return {
    title: localize(project.title, locale),
    description: localize(project.challenge, locale),
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

  return (
    <>
    <main
      id="content"
      className="page-x min-h-svh pb-28 pt-[calc(var(--topbar-h)+3rem)]"
    >
      <Link href="/work" data-cursor="hover" className="cta cta-ghost">
        <span className="cta-arrow" aria-hidden="true">
          ←
        </span>
        <span className="cta-label">{t("case.back")}</span>
      </Link>

      <header className="mt-8 max-w-4xl">
        <p className="project-cats">{categories.join(" · ")}</p>
        <h1 className="mt-3 text-display-l font-grotesk font-medium text-paper">{title}</h1>
        {project.servicesInvolved.length > 0 && (
          <p className="project-services mt-4">
            {project.servicesInvolved.join(" · ")}
          </p>
        )}
      </header>

      <div className="case-hero mt-10">
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

      <div className="case-body mt-16 grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="case-label">{t("case.challenge")}</h2>
          <p className="mt-3 text-body-l text-paper">
            {localize(project.challenge, locale)}
          </p>
        </section>
        <section>
          <h2 className="case-label">{t("case.architecture")}</h2>
          <p className="mt-3 text-body-l text-paper">
            {localize(project.built, locale)}
          </p>
        </section>
      </div>

      <section className="mt-16 max-w-3xl">
        <h2 className="case-label">{t("case.outcome")}</h2>
        {project.outcomeType === "architecture" ? (
          <p className="mt-3">
            <span className="project-arch">{t("architectureLabel")}</span>
          </p>
        ) : (
          <p className="mt-3 text-display-m font-medium text-paper">
            {localize(project.outcome, locale)}
          </p>
        )}
      </section>

      {project.credits && (
        <section className="mt-16 max-w-3xl">
          <h2 className="case-label">{t("case.credits")}</h2>
          <p className="mt-3 text-paper-mute">
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
          className="cta cta-secondary mt-12 inline-flex"
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
          className="case-next mt-24 flex items-baseline justify-between gap-6 border-t border-paper-faint pt-8"
        >
          <span className="case-next-label">{t("case.next")}</span>
          <span className="case-next-name text-display-m">
            {localize(next.title, locale)} →
          </span>
        </Link>
      )}
    </main>
    <Footer />
    </>
  );
}
