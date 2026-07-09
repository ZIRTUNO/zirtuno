import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/hero/LogoMark";
import { OriginWordmark } from "./OriginWordmark";

/**
 * S8 · Chapter 7 — A Origem / The Origin (+ manifesto coda). The emotional
 * peak, AFTER the business case. Zirtuno's real beginning: two brothers, three
 * founding pillars (social/health/finance — the WHY, distinct from the seven
 * service pillars), and a purpose: to build what doesn't exist yet.
 *
 * The five beats (build-spec S8.3) are SCRUBBED on the PAGE fluid (PageStage's
 * origin scene): the copy blocks scroll over the one sticky liquid stage while
 * the same 48 droplets play the story — two masses drift together, fuse into
 * the EXACT mark (+ the three founding-pillar labels, hosted by PageStage),
 * hold breathing under the purpose line, multiply outward as the ecosystem
 * echo, then drain while the particle wordmark assembles. The
 * `.origin-journey` div is the scene's measurement anchor. Copy is
 * server-rendered (RSC) for SEO; the static path (reduced motion / "none"
 * tier) collapses the runway to the plain column with the static mark.
 * Anchor id stays `name`.
 */
export function ChapterName() {
  const t = useTranslations("name");
  const pillars = t.raw("pillars") as string[];
  const manifesto = t.raw("manifesto") as string[];

  return (
    <section
      id="name"
      data-chapter
      className="relative"
    >
      <div className="page-x pt-28 md:pt-40">
        <Reveal inView as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>
      </div>

      <div className="origin-journey">
        {/* Beat 1 — Two brothers: a quiet opening; the two masses drift in */}
        <div className="origin-beat page-x">
          <Reveal inView>
            <p className="font-poetic origin-open">{t("b1")}</p>
          </Reveal>
        </div>

        {/* Beat 2 — Three pillars, one mark: the liquid fuses into the EXACT
            mark on the stage behind; static path shows the crisp mark */}
        <div className="origin-beat origin-beat--mark page-x">
          <div className="journey-static origin-static-mark" aria-hidden="true">
            <LogoMark />
          </div>
          {/* the joined line serves the static path; live mode floats the three
              labels beside the mark instead (b2 prose names them for AT) */}
          <Reveal inView>
            <p className="founding-pillars journey-static">
              {pillars.join("   ·   ")}
            </p>
          </Reveal>
          <Reveal inView>
            <p className="font-poetic name-word-text">{t("b2")}</p>
          </Reveal>
        </div>

        {/* Beat 3 — The purpose: the dominant line over the breathing mark */}
        <div className="origin-beat origin-beat--hold page-x">
          <Reveal inView>
            <p className="font-poetic origin-statement">{t("b3")}</p>
          </Reveal>
        </div>

        {/* Beat 4 — The evolution: the mark multiplies (the ecosystem echo) */}
        <div className="origin-beat page-x">
          <Reveal inView>
            <p className="font-poetic origin-coda">{t("b4")}</p>
          </Reveal>
        </div>

        {/* Beat 5 — Resolution: the liquid drains; particles assemble the
            wordmark; closing line + the single dim grace note (S8.5) */}
        <div className="origin-beat origin-beat--resolve page-x">
          <Reveal inView className="origin-wordmark-wrap">
            <OriginWordmark text={t("wordmark")} />
          </Reveal>
          <Reveal inView>
            <p className="font-poetic origin-closing">{t("closing")}</p>
          </Reveal>
          <Reveal inView>
            <p className="font-poetic origin-grace">{t("graceNote")}</p>
          </Reveal>
        </div>
      </div>

      {/* Manifesto coda — tight sequence, after the resolution */}
      <div className="manifesto page-x mt-24 pb-28 md:mt-32 md:pb-40">
        {manifesto.map((line, i) => (
          <Reveal inView key={i} delay={i * 0.1}>
            <p className="manifesto-line">{line}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
