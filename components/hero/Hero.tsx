import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { CtaAnalysis, CtaPortfolio } from "@/components/chrome/CtaButton";
import { MetaballCanvas } from "./MetaballCanvas";
import { PillarIndicator } from "./PillarIndicator";

/**
 * S2 · Hero (Overture). Business-first: positioning headline + subline state
 * the offer immediately; the poetic eyebrow (serif italic) is a supporting
 * accent only. Copy is server-rendered (RSC) for SEO. Reveal sequence per S2.4.
 */
export function Hero() {
  const t = useTranslations("hero");

  return (
    <section
      id="hero"
      className="page-x relative grid min-h-svh grid-cols-1 items-center gap-12 pb-20 pt-[calc(var(--topbar-h)+2.5rem)] md:grid-cols-2 md:gap-10 md:pb-12 md:pt-[var(--topbar-h)]"
    >
      {/* Left — text stack */}
      <div className="order-1 max-w-[38rem]">
        <Reveal as="p" y={12} duration={1} className="chapter-label">
          {t("chapterLabel")}
        </Reveal>

        <Reveal delay={0.2} y={0} duration={0.8} ease="calm">
          <p className="font-poetic type-breathe mt-6 text-poetic text-paper-mute">
            {t("eyebrow")}
          </p>
        </Reveal>

        <Reveal as="h1" delay={0.4} y={16} duration={1.1} className="mt-4 text-hero font-medium text-paper">
          {t("headline")}
        </Reveal>

        <Reveal delay={0.8} y={0} duration={0.8} ease="calm">
          <p className="mt-6 max-w-[32rem] text-body-l text-paper-mute">
            {t("subline")}
          </p>
        </Reveal>

        <Reveal delay={1.1} y={12} duration={0.7} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <CtaAnalysis />
          <CtaPortfolio />
        </Reveal>
      </div>

      {/* Right — metaball (placeholder in Phase 1) + pillar index */}
      <div className="order-2 flex flex-col items-center md:items-end">
        <Reveal y={0} delay={0.6} duration={1.4} className="w-full">
          <MetaballCanvas />
        </Reveal>
        <PillarIndicator />
      </div>
    </section>
  );
}
