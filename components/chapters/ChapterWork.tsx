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
        <h2 className="mt-6 text-display-l font-grotesk font-medium text-paper">
          {t("headline")}
        </h2>
      </Reveal>

      <Reveal inView delay={0.1}>
        <p className="mt-5 max-w-2xl text-lead text-paper-mute">
          {t("lead")}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        {projects.map((p, i) => (
          <Reveal inView key={p.slug} delay={Math.min(i, 3) * 0.05}>
            <ProjectCard project={p} />
          </Reveal>
        ))}
      </div>

      <Reveal inView className="mt-12 flex">
        <CtaPortfolio />
      </Reveal>
    </section>
  );
}
