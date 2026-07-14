import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/hero/LogoMark";
import { CtaStructure, CtaPortfolio } from "@/components/chrome/CtaButton";

type Node = { name: string; tooltip: string };

/**
 * S4 · The Ecosystem — the conceptual centerpiece. "Ecossistemas, não peças
 * soltas." The liquid travel + converge + tendril choreography plays in the
 * shared LiquidSite layer; this chapter contributes the copy, the RUNWAY
 * (the scroll distance the converge is scrubbed across — no pins) and the
 * capability stack for narrow viewports / assistive tech / static tiers.
 * Copy is server-rendered (RSC) for SEO.
 */
export function ChapterEcosystem() {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as Node[];

  return (
    <section
      id="ecosystem"
      data-chapter
      className="relative"
    >
      <div className="page-x pt-24 pb-6 md:pt-32 md:pb-10">
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
      </div>

      {/* the converge runway — the sticky liquid layer plays across this
          scroll distance; static tiers see the resolved mark instead */}
      <div className="eco-runway" data-organism>
        {/* PageStage portals the live orbital controls here so their keyboard
            order remains Problem -> Ecosystem nodes -> Ecosystem CTAs. */}
        <div
          id="ecosystem-interactions-host"
          className="ecosystem-interactions-host"
        />
        <div className="journey-static organism-fallback">
          <LogoMark ariaLabel={t("centerLabel")} />
        </div>
      </div>

      <div className="page-x pt-10 pb-24 md:pb-32">
        {/* the capabilities as a connected stack — narrow viewports, static
            tiers and assistive tech (the orbital labels are lg+ and visual) */}
        <ul className="eco-stack mb-12" aria-label={t("headline")}>
          <li className="eco-stack-center">{t("centerLabel")}</li>
          {nodes.map((n, i) => (
            <li key={i} className="eco-stack-item">
              <span className="eco-stack-name">{n.name}</span>
              <span className="eco-stack-cap">{n.tooltip}</span>
            </li>
          ))}
        </ul>

        <Reveal inView className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <CtaStructure placement="ecosystem" />
          <CtaPortfolio placement="ecosystem" />
        </Reveal>
      </div>
    </section>
  );
}
