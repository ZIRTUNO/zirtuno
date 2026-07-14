import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";
import { CtaPortfolio } from "@/components/chrome/CtaButton";
import { ProjectCard } from "./ProjectCard";
import { getFeaturedProjects } from "@/lib/content/work";

/**
 * S7 · Selected Work (homepage strip). A curated set of featured projects,
 * ending with the portfolio CTA → /work. Primary credibility section.
 */
export async function ChapterWork() {
  const t = await getTranslations("work");
  const projects = await getFeaturedProjects(4);

  return (
    <section
      id="work"
      data-chapter
      className="page-x relative py-24 md:py-32"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <Reveal inView delay={0.05}>
        <h2 className="type-section-title mt-[var(--type-space-label-title)] text-paper">
          {t("headline")}
        </h2>
      </Reveal>

      <Reveal inView delay={0.1}>
        <p className="type-lead-copy mt-[var(--type-space-title-lead)] text-paper-mute">
          {t("lead")}
        </p>
      </Reveal>

      {projects.length > 0 ? (
        <>
          <div className="mt-16 grid gap-10 sm:grid-cols-2">
            {projects.map((project, index) => (
              <Reveal
                inView
                key={project.slug}
                delay={Math.min(index, 3) * 0.05}
              >
                <ProjectCard project={project} />
              </Reveal>
            ))}
          </div>

          <Reveal inView className="mt-12 flex">
            <CtaPortfolio placement="work" />
          </Reveal>
        </>
      ) : (
        <Reveal inView as="p" className="mt-12 max-w-2xl text-body-l text-paper-mute">
          {t("emptyPortfolio")}
        </Reveal>
      )}
    </section>
  );
}
