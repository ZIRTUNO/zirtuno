import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { WebglPlaceholder } from "@/components/ui/WebglPlaceholder";

/**
 * S8 · The Name (etymology) + manifesto coda. The emotional peak, placed AFTER
 * the business case. The concentrated 30% poetic — set entirely in serif italic
 * (the only place the display serif carries headline weight). Six-beat reveal:
 * Wind → ZÉFIRO → VENTURA → Convergence → ZIRTUNO → Return. Phase 2 replaces the
 * particle placeholder with the text→particles→text reveal (S8.2).
 */
export function ChapterName() {
  const t = useTranslations("name");
  const manifesto = t.raw("manifesto") as string[];

  return (
    <section
      id="name"
      data-chapter
      className="page-x relative border-t border-paper-faint py-28 md:py-40"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <div className="mt-20 flex flex-col items-center gap-24 text-center md:gap-36">
        {/* Beat 1 — Wind */}
        <Reveal inView>
          <p className="font-poetic max-w-2xl text-poetic text-paper-mute md:text-display-m">
            {t("b1")}
          </p>
        </Reveal>

        {/* Beat 2 — ZÉFIRO */}
        <Reveal inView>
          <p className="name-word">{t("zefiroWord")}</p>
          <p className="font-poetic name-word-text">{t("zefiroText")}</p>
        </Reveal>

        {/* Beat 3 — VENTURA */}
        <Reveal inView>
          <p className="name-word">{t("venturaWord")}</p>
          <p className="font-poetic name-word-text">{t("venturaText")}</p>
        </Reveal>

        {/* Beats 4–6 — Convergence → ZIRTUNO → Return */}
        <Reveal inView className="flex flex-col items-center">
          <div className="w-full max-w-sm">
            <WebglPlaceholder
              variant="particles"
              label="etymology particles · phase 2"
              ariaLabel={t("zirtunoWord")}
            />
          </div>
          <p className="name-word mt-10">{t("zirtunoWord")}</p>
          <p className="font-poetic name-word-text">{t("zirtunoText")}</p>
        </Reveal>
      </div>

      {/* Manifesto coda — tight sequence */}
      <div className="manifesto mt-32 md:mt-44">
        {manifesto.map((line, i) => (
          <Reveal inView key={i} delay={i * 0.1}>
            <p className="manifesto-line">{line}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
