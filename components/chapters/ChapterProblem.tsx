import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { FractureField } from "@/components/field/FractureField";
import { CtaStructure } from "@/components/chrome/CtaButton";

type Symptom = { label: string; desc: string };

// the shards' broken horizontal rhythm (rem, desktop only — deliberately
// irregular: the layout itself is fragmenting)
const SHARD_X = [0, 7, 2, 11, 5, 13, 1];

/**
 * S3 · The Problem (remake) — the reader walks INSIDE the fragmentation. A
 * full-viewport liquid layer (FractureField) holds the mark, breaking one
 * notch per symptom; the seven symptoms float as offset SHARDS over it, each
 * given near-viewport presence so the fracture has room to be felt. Copy is
 * server-rendered (RSC) for SEO; the liquid layer is decorative.
 */
export function ChapterProblem() {
  const t = useTranslations("problem");
  const symptoms = t.raw("symptoms") as Symptom[];

  return (
    <section
      id="problem"
      data-chapter
      className="relative border-t border-paper-faint"
    >
      {/* the liquid field — sticky full viewport, everything scrolls over it */}
      <FractureField />

      <div className="page-x relative z-10 py-24 md:py-32">
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

        {/* Seven symptoms — floating shards; each crossing breaks the mark further */}
        <ul className="mt-[16vh] max-w-xl md:mt-[22vh]">
          {symptoms.map((s, i) => (
            <Reveal
              inView
              as="li"
              key={s.label}
              className="symptom"
              style={{ "--shard-x": `${SHARD_X[i % SHARD_X.length]}rem` } as React.CSSProperties}
            >
              <span className="symptom-num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="symptom-label">{s.label}</p>
                <p className="symptom-desc">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal inView className="mt-[14vh] flex">
          <CtaStructure />
        </Reveal>
      </div>
    </section>
  );
}
