import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { CtaAnalysis, CtaPortfolio } from "@/components/chrome/CtaButton";
import { MetaballCanvas } from "./MetaballCanvas";

/**
 * S2 · Hero (Overture). Business-first: positioning headline + subline state
 * the offer immediately; the poetic eyebrow (serif italic) is a supporting
 * accent only. Copy is server-rendered (RSC) for SEO. Reveal sequence per S2.4.
 */
const PILLAR_KEYS = [
  "web",
  "software",
  "ai",
  "automation",
  "data",
  "branding",
  "marketing",
] as const;

export function Hero() {
  const t = useTranslations("hero");
  const tp = useTranslations("services.pillars");
  // short pillar names for the metaball's keyboard a11y announcements (states 1-7)
  const pillarNames = PILLAR_KEYS.map((k) => tp(`${k}.categoryLabel`));

  return (
    <section
      id="hero"
      className="page-x relative grid min-h-svh grid-cols-1 items-center gap-16 pb-20 pt-[calc(var(--topbar-h)+2.5rem)] lg:grid-cols-2 lg:gap-10 lg:pb-12 lg:pt-[var(--topbar-h)]"
    >
      {/* Left — text stack */}
      <div className="order-1 max-w-[38rem]">
        <Reveal as="p" y={12} duration={1} className="chapter-label">
          {t("chapterLabel")}
        </Reveal>

        <Reveal delay={0.2} y={0} duration={0.8} ease="calm">
          <p className="font-poetic type-breathe mt-[var(--hero-label-space)] text-poetic text-paper-mute">
            {t("eyebrow")}
          </p>
        </Reveal>

        <Reveal
          as="h1"
          delay={0.4}
          y={16}
          duration={1.1}
          className="type-hero-title mt-[var(--type-space-eyebrow-title)] text-paper"
        >
          {t("headline")}
        </Reveal>

        <Reveal delay={0.8} y={0} duration={0.8} ease="calm">
          <p className="type-lead-copy mt-[var(--type-space-title-lead)] text-paper-mute">
            {t("subline")}
          </p>
        </Reveal>

        <Reveal
          delay={1.1}
          y={12}
          duration={0.7}
          className="mt-[var(--hero-action-space)] flex flex-wrap items-center gap-x-8 gap-y-4"
        >
          <CtaAnalysis placement="hero" />
          <CtaPortfolio placement="hero" />
        </Reveal>
      </div>

      {/* Right — raymarched glass metaball + pillar index (S2.3) */}
      <div className="order-2 flex flex-col items-center md:items-end">
        <Reveal y={0} delay={0.6} duration={1.4} className="w-full">
          <MetaballCanvas
            pillarNames={pillarNames}
            controlLabel={t("liquidControlLabel")}
            controlInstructions={t("liquidControlInstructions")}
            markLabel={t("liquidMarkLabel")}
          />
        </Reveal>
      </div>
    </section>
  );
}
