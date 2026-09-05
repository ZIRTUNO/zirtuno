import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WetType } from "@/components/ui/WetType";
import { CtaAnalysis } from "@/components/chrome/CtaButton";

type Phase = { name: string; desc: string };

/**
 * S6 · Método Zirtuno — Diagnóstico → Estrutura → Construção → Integração →
 * Evolução. The liquid REHEARSES the client's transformation on the PAGE
 * fluid (PageStage's method scene): the fragmented cloud is examined by a
 * probe (Diagnosis), snaps into a liquid lattice (Structure), accretes into
 * three masses (Construction), fuses until the EXACT mark resolves ("one
 * organism" — Integration), then grows and sheds orbital satellites
 * (Evolution). One phase owns the viewport at a time; a vertical thread
 * beside the copy fills with progress (--method-flow, written by the shell).
 * The `.method-journey` div is the scene's measurement anchor. Copy is
 * server-rendered (RSC); static tiers collapse to the plain numbered list.
 */
export function ChapterMethod() {
  const t = useTranslations("method");
  const phases = t.raw("phases") as Phase[];

  return (
    <section
      id="method"
      data-chapter
      className="relative"
    >
      <div className="page-x pt-[var(--space-section)]">
        <Reveal inView as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>

        {/* Bricolage display type is liquid GLASS at 768px and up — the
            glyphs are cut out of --liquid-glass-fill by this block's own
            background-clip:text. paint="glass" is what lets the front travel
            THROUGH that fill instead of painting over it: the word veils the
            slab and clears to nothing on arrival, so the resting headline is
            exactly the one that shipped before. */}
        <WetType
          as="h2"
          paint="glass"
          className="type-section-title mt-[var(--type-space-label-title)] text-paper"
        >
          {t("headline")}
        </WetType>

        <WetType
          as="p"
          className="font-poetic mt-[var(--type-space-title-lead)] max-w-2xl text-poetic text-paper-lead"
        >
          {t("lead")}
        </WetType>
      </div>

      <div className="method-journey">
        <ol className="method-runway page-x">
          {phases.map((p, i) => (
            <Reveal inView as="li" key={p.name} className="method-phase">
              <span className="method-num">
                {String(i + 1).padStart(2, "0")} / {String(phases.length).padStart(2, "0")}
              </span>
              <h3 className="method-name type-feature-title">{p.name}</h3>
              <p className="method-desc">{p.desc}</p>
            </Reveal>
          ))}
        </ol>
      </div>

      <div className="page-x pb-[var(--space-section)]">
        <Reveal inView className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <CtaAnalysis placement="method" />
        </Reveal>
      </div>
    </section>
  );
}
