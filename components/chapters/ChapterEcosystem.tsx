import { useTranslations } from "next-intl";
import { WetType } from "@/components/ui/WetType";
import { ConfluenceMark } from "@/components/chapters/ConfluenceMark";
import { CtaStructure } from "@/components/chrome/CtaButton";
import { GATHER_SYSTEMS } from "@/lib/webgl/gathering.mjs";

/** S3: a continuous, scroll-composed story. Every word and disclosure is RSC.
 * PageStage enhances this document with one sampled GSAP score; the existing
 * field renders the currents. No mounted second canvas or mobile text substitute. */
export function ChapterEcosystem() {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as { name: string; tooltip: string }[];
  const chapters = t.raw("chapters") as { title: string; copy: string }[];
  return (
    <section id="ecosystem" data-chapter aria-label={t("headline")}>
      <header className="eco-intro page-x">
        <p className="chapter-label">{t("chapterLabel")}</p>
        <WetType as="h2" paint="glass" className="type-section-title eco-headline">
          {t("headline")}
        </WetType>
        <WetType as="p" className="type-lead-copy eco-lead">{t("lead")}</WetType>
      </header>
      <div className="eco-runway" data-organism>
        <div className="eco-stage page-x" data-eco-beat="0">
          <div className="eco-stage-eyeline" aria-hidden="true">
            <span className="eco-eyeline-dot" />{t("eyeline")}
          </div>
          <div className="eco-visual-fallback" aria-hidden="true">
            <ConfluenceMark ariaLabel={t("centerLabel")} />
          </div>
          <div className="eco-panels">
            {GATHER_SYSTEMS.map((system, i) => (
              <article className="eco-panel" id={`eco-${system.id}`} key={system.id}>
                <p className="eco-panel-label"><span>0{i + 1}</span>{t(`systems.${system.id}`)}</p>
                <h3 className="eco-statement">{chapters[i].title}</h3>
                <p className="eco-description">{chapters[i].copy}</p>
                <div className="eco-capabilities">
                  {system.nodes.map((slot) => (
                    <details className="eco-capability" key={slot}>
                      <summary data-eco-node={slot}>{nodes[slot].name}<span aria-hidden="true" className="eco-plus" /></summary>
                      <p>{nodes[slot].tooltip}</p>
                    </details>
                  ))}
                </div>
              </article>
            ))}
            <article className="eco-panel eco-panel-whole">
              <p className="eco-panel-label">{t("centerLabel")}</p>
              <h3 className="eco-statement">{t("together")}</h3>
              <p className="eco-description">{t("togetherLead")}</p>
              <CtaStructure placement="ecosystem" />
            </article>
          </div>
          <div className="eco-navigation" role="group" aria-label={t("journeyLabel")}>
            {GATHER_SYSTEMS.map((system, i) => (
              <button key={system.id} type="button" data-eco-step={i} aria-pressed={i === 0} aria-controls={`eco-${system.id}`}>
                <span className="eco-nav-number">0{i + 1}</span>
                <span>{t(`systems.${system.id}`)}</span>
                <span className="eco-nav-track" aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className="eco-core-label" aria-hidden="true">{t("centerLabel")}</span>
        </div>
      </div>
      <div className="eco-outro page-x">
        <WetType as="p" className="eco-outro-line">{t("resolution")}</WetType>
      </div>
    </section>
  );
}
