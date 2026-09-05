import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WetType } from "@/components/ui/WetType";
import { PillarEntry } from "./PillarEntry";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
import { PILLARS } from "@/lib/content/services";

/**
 * S4 · AS SETE FORMAS — one body, seven shapes.
 *
 * The gathering ends with the ten capabilities fused into one mark. This
 * chapter is what that body can DO: it holds the centre of the stage and takes
 * each service's exact vector form in turn, and the §3.3 melt is the only
 * transition between them. The argument is not "here are seven services" — it
 * is "this is one system that becomes what the work needs", and a stacked
 * column of seven entries beside an illustration cannot make that argument.
 *
 * Each pillar is therefore a full stage rather than a list item: name above the
 * form, instrument band below it, and the middle left to the liquid. Copy is
 * server-rendered (RSC); the semantic order is unchanged, so assistive tech and
 * static tiers read exactly the same seven pillars in the same sequence.
 */
export function ChapterServices({ hasWork }: { hasWork: boolean }) {
  const t = useTranslations("services");

  return (
    <section id="services" data-chapter className="relative">
      <div className="page-x svc-intro">
        <Reveal inView as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>

        {/* Bricolage display type is liquid GLASS at 768px and up — the
            glyphs are cut out of --liquid-glass-fill by this block's own
            background-clip:text. paint="glass" is what lets the front travel
            THROUGH that fill instead of painting over it: the word veils the
            slab and clears to nothing on arrival, so the resting headline is
            exactly the one that shipped before. */}
        <WetType as="h2" paint="glass" className="type-section-title svc-claim">
          {t("headline")}
        </WetType>

        <WetType as="p" className="type-lead-copy svc-lead">
          {t("lead")}
        </WetType>
      </div>

      <div className="page-x svc-forms">
        {PILLARS.map((p, i) => (
          <PillarEntry
            key={p.key}
            index={i}
            pillarKey={p.key}
            category={p.category}
            hasWork={hasWork}
          />
        ))}
      </div>

      <div className="page-x svc-outro">
        <Reveal inView className="flex">
          <CtaAnalysis placement="services" />
        </Reveal>
      </div>
    </section>
  );
}
