import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WebglPlaceholder } from "@/components/ui/WebglPlaceholder";
import { PillarIndicator } from "@/components/hero/PillarIndicator";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
import { PillarEntry } from "./PillarEntry";
import { PILLARS } from "@/lib/content/services";

/**
 * S5 · The Services. Seven pillars, each stating what it is / solves / creates.
 * Desktop: a sticky metaball (placeholder in Phase 1) holds while pillars scroll
 * past — Phase 2 morphs it per pillar and drives the indicator. RSC copy.
 */
export function ChapterServices() {
  const t = useTranslations("services");

  return (
    <section
      id="services"
      data-chapter
      className="page-x relative border-t border-paper-faint py-24 md:py-32"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <Reveal inView delay={0.05}>
        <h2 className="mt-6 max-w-3xl text-balance text-display-l font-medium text-paper">
          {t("headline")}
        </h2>
      </Reveal>

      <Reveal inView delay={0.1}>
        <p className="mt-6 max-w-2xl text-body-l text-paper-mute">{t("lead")}</p>
      </Reveal>

      <div className="mt-14 grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        {/* Sticky metaball (placeholder) — Phase 2 morphs per pillar */}
        <aside className="hidden md:block">
          <div className="md:sticky md:top-[calc(var(--topbar-h)+2rem)]">
            <WebglPlaceholder variant="unified" label="morph · phase 2" />
            <PillarIndicator />
          </div>
        </aside>

        <div>
          {/* Mobile metaball — appears above the pillar list */}
          <div className="mx-auto mb-10 max-w-[16rem] md:hidden">
            <WebglPlaceholder variant="unified" label="morph · phase 2" />
          </div>

          {PILLARS.map((p, i) => (
            <Reveal inView key={p.key} delay={Math.min(i, 3) * 0.03}>
              <PillarEntry index={i} pillarKey={p.key} category={p.category} />
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal inView className="mt-16 flex">
        <CtaAnalysis />
      </Reveal>
    </section>
  );
}
