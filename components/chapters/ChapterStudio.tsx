import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WetType } from "@/components/ui/WetType";
import { StudioCards } from "@/components/chapters/StudioCards";

/**
 * S8 · The Studio. Where (Curitiba + coordinates) · Who (the team's shape,
 * then the three cards that SHOW it) · Why (sans statement + serif-italic
 * closing clause). No process block — that lives in Método (S6).
 *
 * "Who" was an anonymous six-cell role grid until 2026-09-09. It named the
 * functions and showed none of their output, which asked the reader to take
 * "Design" and "Engenharia" on faith in the one chapter whose whole job is to
 * answer who this is. `StudioCards` keeps the claim and makes it visible; the
 * six role names survive inside the three card subtitles, so nothing that
 * shipped as copy was dropped, only re-staged.
 */
export function ChapterStudio() {
  const t = useTranslations("studio");

  return (
    <section
      id="studio"
      data-chapter
      className="page-x relative py-[var(--space-section)]"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <div className="mt-[var(--space-block)] grid gap-[var(--space-block)] md:grid-cols-[0.9fr_1.1fr]">
        {/* Where */}
        <Reveal inView>
          <h2 className="case-label">{t("whereLabel")}</h2>
          <p className="type-feature-title mt-[var(--space-group)] text-paper">
            {t("city")}
          </p>
          <p className="mt-[var(--space-tight)] font-mono text-mono uppercase text-paper-mute">
            {t("coordinates")}
          </p>
        </Reveal>

        {/* Who — the claim */}
        <Reveal inView delay={0.05}>
          <h2 className="case-label">{t("whoLabel")}</h2>
          <WetType
            as="p"
            className="studio-lead mt-[var(--space-group)] max-w-[38ch] text-body-l text-paper-lead"
          >
            {t("whoLead")}
          </WetType>
        </Reveal>
      </div>

      {/* Who — the proof. Full shell width: three cards at the reference's
          415.814/520 need the whole column, not the 1.1fr half the role list
          used to sit in. */}
      <Reveal inView delay={0.08} className="mt-[var(--space-block)]">
        <StudioCards />
      </Reveal>

      {/* Why — closing line */}
      <div className="mt-[var(--space-span)] max-w-3xl">
        <h2 className="case-label">{t("whyLabel")}</h2>
        {/* Glass at 768px and up, like the chapter titles, so it takes the
            same paint. This is the block that used to carry the rejected
            `Reveal variant="blur"`. */}
        <WetType
          as="p"
          paint="glass"
          className="type-feature-title mt-[var(--space-group)] text-paper"
        >
          {t("closingStatement")}{" "}
          <span className="font-poetic text-paper-mute">
            {t("closingItalic")}
          </span>
        </WetType>
      </div>

    </section>
  );
}
