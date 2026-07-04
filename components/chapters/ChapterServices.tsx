import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { PillarEntry } from "./PillarEntry";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
import { PILLARS } from "@/lib/content/services";

/**
 * S5 · The Services — ONE service owns the viewport at a time. The liquid
 * (the shared LiquidSite layer) melts pillar → pillar in lockstep with the
 * copy — beside the column on wide stages, smaller and below it on narrow
 * ones (placement, never dimming: the liquid keeps full luminosity). Each
 * pillar gets near-viewport presence — no competing states, no stacked
 * screens. Copy is server-rendered (RSC).
 */
export function ChapterServices() {
  const t = useTranslations("services");

  return (
    <section
      id="services"
      data-chapter
      className="relative border-t border-paper-faint"
    >
      <div className="page-x py-24 md:py-32">
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

        <div className="mt-[10vh] max-w-2xl">
          {PILLARS.map((p, i) => (
            <Reveal inView key={p.key} delay={0.03}>
              <PillarEntry index={i} pillarKey={p.key} category={p.category} />
            </Reveal>
          ))}
        </div>

        <Reveal inView className="mt-16 flex">
          <CtaAnalysis />
        </Reveal>
      </div>
    </section>
  );
}
