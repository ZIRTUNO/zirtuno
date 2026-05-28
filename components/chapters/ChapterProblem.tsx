import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WebglPlaceholder } from "@/components/ui/WebglPlaceholder";
import { CtaStructure } from "@/components/chrome/CtaButton";

type Symptom = { label: string; desc: string };

/**
 * S3 · The Problem. Names the pain (structure, not marketing). The fractured
 * metaball (placeholder in Phase 1) reads as clearly disconnected and stays
 * unresolved — S4 resolves it. Copy is server-rendered (RSC) for SEO.
 */
export function ChapterProblem() {
  const t = useTranslations("problem");
  const symptoms = t.raw("symptoms") as Symptom[];

  return (
    <section
      id="problem"
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
        <p className="mt-6 max-w-2xl text-body-l text-paper-mute">{t("lead")}</p>
      </Reveal>

      <div className="mt-12 grid gap-12 md:grid-cols-[1.15fr_0.85fr] md:items-start">
        {/* Fractured visual — mobile first (simplified), desktop sticky right */}
        <div className="order-1 md:order-2 md:sticky md:top-[calc(var(--topbar-h)+1.5rem)]">
          <div className="mx-auto max-w-xs md:max-w-none">
            <WebglPlaceholder
              variant="fractured"
              label="fractured · phase 2"
              ariaLabel={t("chapterLabel")}
            />
          </div>
        </div>

        {/* Seven symptoms */}
        <ul className="order-2 md:order-1">
          {symptoms.map((s, i) => (
            <Reveal
              inView
              as="li"
              key={s.label}
              delay={i * 0.04}
              className="symptom"
            >
              <span className="symptom-num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="symptom-label">{s.label}</p>
                <p className="symptom-desc">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>

      <Reveal inView className="mt-14 flex">
        <CtaStructure />
      </Reveal>
    </section>
  );
}
