import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { CtaAnalysis, CtaTalk } from "@/components/chrome/CtaButton";

type Phase = { name: string; desc: string };

/**
 * S6 · Método Zirtuno — Diagnóstico → Estrutura → Construção → Integração →
 * Evolução. Five phases linked by a connector line (static in Phase 1; Phase 2
 * draws it on scroll and adds a metaball gesture per phase). Horizontal on
 * desktop, vertical timeline on mobile. RSC copy.
 */
export function ChapterMethod() {
  const t = useTranslations("method");
  const phases = t.raw("phases") as Phase[];

  return (
    <section
      id="method"
      data-chapter
      className="page-x relative border-t border-paper-faint py-24 md:py-32"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <Reveal inView delay={0.05}>
        <h2 className="mt-6 text-display-l font-medium text-paper">
          {t("headline")}
        </h2>
      </Reveal>

      <Reveal inView delay={0.1}>
        <p className="font-poetic mt-5 max-w-2xl text-poetic text-paper-mute">
          {t("lead")}
        </p>
      </Reveal>

      <ol className="method">
        {phases.map((p, i) => (
          <Reveal inView as="li" key={p.name} delay={i * 0.08} className="method-phase">
            <span className="method-node" aria-hidden="true" />
            <span className="method-num">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="method-name text-display-m">{p.name}</h3>
            <p className="method-desc">{p.desc}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal inView className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-4">
        <CtaAnalysis />
        <CtaTalk variant="secondary" />
      </Reveal>
    </section>
  );
}
