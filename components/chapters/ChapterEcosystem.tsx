import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { OrganismField, type EcoNode } from "@/components/field/OrganismField";
import { CtaStructure, CtaPortfolio } from "@/components/chrome/CtaButton";

/**
 * S4 · The Ecosystem (remake) — the conceptual centerpiece. "Ecossistemas,
 * não peças soltas." A full-bleed liquid stage: S3's fragments converge into
 * the breathing organism, then liquid tendrils grow outward to the ten
 * capability labels (OrganismField — no SVG diagram). Copy is server-rendered
 * (RSC) for SEO; mobile keeps the vertical capability stack below the stage.
 */
export function ChapterEcosystem() {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as EcoNode[];

  return (
    <section
      id="ecosystem"
      data-chapter
      className="relative border-t border-paper-faint"
    >
      <div className="page-x pt-24 pb-10 md:pt-32 md:pb-14">
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
      </div>

      <OrganismField
        nodes={nodes}
        centerLabel={t("centerLabel")}
        headline={t("headline")}
      />

      <div className="page-x pt-12 pb-24 md:pb-32">
        {/* Mobile — the capabilities as a connected stack (labels are desktop) */}
        <ul className="eco-stack mb-12 md:hidden" aria-label={t("headline")}>
          <li className="eco-stack-center">{t("centerLabel")}</li>
          {nodes.map((n, i) => (
            <li key={i} className="eco-stack-item">
              <span className="eco-stack-name">{n.name}</span>
              <span className="eco-stack-cap">{n.tooltip}</span>
            </li>
          ))}
        </ul>

        <Reveal inView className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <CtaStructure />
          <CtaPortfolio />
        </Reveal>
      </div>
    </section>
  );
}
