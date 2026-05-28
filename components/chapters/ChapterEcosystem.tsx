import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { EcosystemDiagram } from "@/components/ecosystem/EcosystemDiagram";
import { CtaStructure, CtaPortfolio } from "@/components/chrome/CtaButton";

/**
 * S4 · The Ecosystem — the conceptual centerpiece. "Ecossistemas, não peças
 * soltas." Resolves the fracture from S3 into one connected organism. Copy is
 * server-rendered (RSC) for SEO.
 */
export function ChapterEcosystem() {
  const t = useTranslations("ecosystem");

  return (
    <section
      id="ecosystem"
      data-chapter
      className="page-x relative border-t border-paper-faint py-24 md:py-32"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <Reveal inView delay={0.05}>
        <h2 className="mt-6 max-w-4xl text-balance text-display-l font-medium text-paper">
          {t("headline")}
        </h2>
      </Reveal>

      <Reveal inView delay={0.1}>
        <p className="mt-6 max-w-3xl text-body-l text-paper-mute">{t("lead")}</p>
      </Reveal>

      <Reveal inView delay={0.1} className="mt-16">
        <EcosystemDiagram />
      </Reveal>

      <Reveal
        inView
        className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-4"
      >
        <CtaStructure />
        <CtaPortfolio />
      </Reveal>
    </section>
  );
}
