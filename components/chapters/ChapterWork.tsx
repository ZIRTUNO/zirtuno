import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";
import { WetType } from "@/components/ui/WetType";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
import { WorkGallery } from "@/components/work/WorkGallery";
import { getFeaturedProjects } from "@/lib/content/work";

/**
 * S7 · Selected Work (homepage strip). A curated set of featured projects,
 * presenting the portfolio selection itself. Primary credibility section.
 *
 * While the selection is empty the chapter must not pretend otherwise, and it
 * must not point at an empty index: the honest statement becomes a designed
 * panel and the action becomes the conversation (R5-E). Never invent proof
 * (§4.9) — but never dead-end the reader either.
 */
export async function ChapterWork() {
  const t = await getTranslations("work");
  const projects = await getFeaturedProjects(4);

  return (
    <section
      id="work"
      data-chapter
      className="page-x relative py-[var(--space-section)]"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      {/* Bricolage display type is liquid GLASS at 768px and up — the
          glyphs are cut out of --liquid-glass-fill by this block's own
          background-clip:text. paint="glass" is what lets the front travel
          THROUGH that fill instead of painting over it: the word veils the
          slab and clears to nothing on arrival, so the resting headline is
          exactly the one that shipped before. */}
      <WetType
        as="h2"
        paint="glass"
        className="type-section-title mt-[var(--type-space-label-title)] text-paper"
      >
        {t("headline")}
      </WetType>

      <WetType
        as="p"
        className="type-lead-copy mt-[var(--type-space-title-lead)]"
      >
        {t("lead")}
      </WetType>

      {projects.length > 0 ? (
        <WorkGallery projects={projects} className="work-strip mt-[var(--space-span)]" />
      ) : (
        <Reveal inView className="work-empty mt-[var(--space-block)]">
          <p className="work-empty-label">{t("emptyLabel")}</p>
          <p className="work-empty-body">{t("emptyPortfolio")}</p>
          <p className="work-empty-invite">{t("emptyInvite")}</p>
          <div className="mt-[var(--space-group)] flex">
            <CtaAnalysis placement="work_empty" />
          </div>
        </Reveal>
      )}
    </section>
  );
}
