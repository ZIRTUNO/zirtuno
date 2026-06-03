import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { OriginMark } from "./OriginMark";
import { OriginWordmark } from "./OriginWordmark";

/**
 * S8 · Chapter 7 — A Origem / The Origin (+ manifesto coda). The emotional
 * peak, AFTER the business case. Zirtuno's real beginning: two brothers, three
 * founding pillars (social/health/finance — the WHY, distinct from the seven
 * service pillars), and a purpose: to build what doesn't exist yet. Five beats:
 * two forms → the mark + three pillars → purpose → ecosystem → wordmark.
 *
 * Skeleton render (static reveals). PHASE 2 turns this into the pinned ~600vh
 * ScrollTrigger scrub: Beat 2 forms the mark from the SVG-traced metaball, Beat
 * 5 converges the particles into the wordmark. Anchor id stays `name` so the
 * chapter index / SideIndex / hash links keep working.
 */
export function ChapterName() {
  const t = useTranslations("name");
  const pillars = t.raw("pillars") as string[];
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

      {/* Five beats with a deliberate rhythm — a soft open, a visual peak (the
          mark), a dominant statement, a quiet coda, the resolution — rather than
          a stack of identically-sized centred serif paragraphs (5.5). */}
      <div className="origin-flow">
        {/* Beat 1 — Two brothers: a quiet opening */}
        <Reveal inView>
          <p className="font-poetic origin-open">{t("b1")}</p>
        </Reveal>

        {/* Beat 2 — Three pillars, one mark (fracture→converge forms the mark) */}
        <Reveal inView className="origin-beat origin-beat--mark">
          <div className="origin-mark">
            <OriginMark />
          </div>
          <p className="founding-pillars">{pillars.join("   ·   ")}</p>
          <p className="font-poetic name-word-text">{t("b2")}</p>
        </Reveal>

        {/* Beat 3 — The purpose: the dominant line */}
        <Reveal inView>
          <p className="font-poetic origin-statement">{t("b3")}</p>
        </Reveal>

        {/* Beat 4 — The evolution: a quiet coda, tight to the statement */}
        <Reveal inView>
          <p className="font-poetic origin-coda">{t("b4")}</p>
        </Reveal>

        {/* Beat 5 — Resolution: CPU particle convergence → wordmark + closing line */}
        <Reveal inView className="origin-beat origin-beat--resolve">
          <div className="origin-wordmark-wrap">
            <OriginWordmark text={t("wordmark")} />
          </div>
          <p className="font-poetic origin-closing">{t("closing")}</p>
          {/* Zéfiro + Ventura kept ONLY as a single dim grace note (S8.5 default) */}
          <p className="font-poetic origin-grace">{t("graceNote")}</p>
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
