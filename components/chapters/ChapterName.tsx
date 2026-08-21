import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/hero/LogoMark";
import { OriginWordmark } from "./OriginWordmark";

type Idea = { kicker: string; word: string; gloss: string; line: string };

/**
 * S8 · Chapter 7 — A Origem / The Origin (+ manifesto coda). The emotional
 * peak, AFTER the business case.
 *
 * THE STORY IS TWO IDEAS, not two people. Zirtuno is Zéfiro — the west wind,
 * the quiet force that changes the shape of what it touches — joined to
 * Ventura: direction, and the courage to take it. AGENTS.md §2 has always
 * carried that as the brand's own etymology; it was demoted to one dim grace
 * note while an anonymous "two brothers" line carried the chapter, which named
 * nobody, could not be verified by a reader, and left the two masses on the
 * stage as unlabelled blobs. Two NAMED ideas can be shown: each one is put
 * beside the mass that stands for it, the reader learns what each is missing
 * on its own, and the fusion the liquid was already performing becomes the
 * chapter's argument rather than its decoration. This also settles AGENTS.md
 * §12's open question about whether the founders stay anonymous — they are no
 * longer the subject.
 *
 * The five beats stay FIVE and stay SCRUBBED on the page fluid (PageStage's
 * origin scene), because the scene's envelopes are keyed to a p that runs
 * evenly across this runway: beat 1 rides the two masses travelling in
 * (q1 ≤ 0.17), beat 2 their collision (q2 0.19–0.41), beat 3 the resolved mark
 * and the three founding-pillar labels, beat 4 the ecosystem echo (q4 0.62),
 * beat 5 the drain under the assembling wordmark (q5 0.84). Adding beats would
 * silently slide the copy off the liquid it is describing.
 *
 * `.origin-journey` is the scene's measurement anchor. Copy is server-rendered
 * (RSC) for SEO; the static path (reduced motion / "none" tier) collapses the
 * runway to the plain column with the static mark. Anchor id stays `name`.
 */
export function ChapterName() {
  const t = useTranslations("name");
  const ideas = t.raw("ideas") as Idea[];
  const tension = t.raw("tension") as string[];
  const pillars = t.raw("pillars") as string[];
  const manifesto = t.raw("manifesto") as string[];

  return (
    <section
      id="name"
      data-chapter
      className="relative"
      aria-labelledby="name-title"
    >
      <div className="page-x pt-28 md:pt-40">
        <Reveal inView as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>
      </div>

      <div className="origin-journey">
        {/* Beat 1 — TWO IDEAS, APART. The two masses are still travelling in
            from opposite sides, so the type is composed as two columns around
            an empty centre: the gutter is the space they are about to meet in,
            and each plate sits over the mass it names. */}
        <div className="origin-beat origin-beat--ideas page-x">
          <div className="origin-intro">
            <Reveal inView variant="blur">
              <h2 id="name-title" className="origin-headline font-grotesk">
                {t("headline")}
              </h2>
            </Reveal>
            <Reveal inView variant="blur" delay={0.08}>
              <p className="origin-open">{t("open")}</p>
            </Reveal>
          </div>
          {/* unordered: the two ideas are peers, and the chapter's whole claim
              is that neither one comes first */}
          <ul className="origin-ideas">
            {ideas.map((idea, i) => (
              <li key={idea.word}>
                <Reveal inView variant="blur" delay={0.16 + i * 0.12}>
                  <article className="origin-idea">
                    <p className="origin-idea-kicker">{idea.kicker}</p>
                    <p className="origin-idea-word">
                      {idea.word}
                      <span className="origin-idea-gloss">{idea.gloss}</span>
                    </p>
                    <p className="origin-idea-line">{idea.line}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        {/* Beat 2 — THE TENSION. The masses close and fuse behind this; the
            two clauses are set as two lines so the symmetry of the argument is
            visible rather than merely stated. */}
        <div className="origin-beat origin-beat--tension page-x">
          <p className="origin-tension">
            {tension.map((clause, i) => (
              <Reveal inView key={i} variant="blur" delay={i * 0.12} as="span">
                <span className="origin-tension-line">{clause}</span>
              </Reveal>
            ))}
          </p>
        </div>

        {/* Beat 3 — THE FUSION. One mark on the stage, and the three founding
            pillars (the WHY — never the seven services) as a COMPOSED triptych
            beneath the line that introduces them.
            They used to be three labels floated at fixed anchors "beside the
            mark's lobes", positioned imperatively by PageStage. Photographed,
            they landed as debris: SOCIAL alone out at the left margin, HEALTH
            up in the top right, FINANCE orphaned near the bottom — three words
            in empty space with no relationship to the mark or to each other.
            Composed, they read as one set of three, which is the only thing the
            beat is claiming about them. */}
        <div className="origin-beat origin-beat--mark page-x">
          <div className="journey-static origin-static-mark" aria-hidden="true">
            <LogoMark />
          </div>
          <Reveal inView variant="blur">
            <p className="origin-fusion">{t("fusion")}</p>
          </Reveal>
          <div className="origin-founding">
            <Reveal inView delay={0.1}>
              <p className="origin-pillars-lead">{t("pillarsLead")}</p>
            </Reveal>
            <ul className="founding-pillars">
              {pillars.map((p, i) => (
                <li key={p} className="founding-pillar">
                  <Reveal inView delay={0.18 + i * 0.08}>
                    <span>{p}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Beat 4 — THE PURPOSE: the dominant line, over the echo fanning out */}
        <div className="origin-beat origin-beat--hold page-x">
          <Reveal inView variant="blur">
            <p className="origin-statement">{t("purpose")}</p>
          </Reveal>
        </div>

        {/* Beat 5 — RESOLUTION: the liquid drains; particles assemble the
            wordmark; the closing line lands under it */}
        <div className="origin-beat origin-beat--resolve page-x">
          <Reveal inView variant="blur">
            <p className="origin-coda">{t("echo")}</p>
          </Reveal>
          <Reveal inView className="origin-wordmark-wrap">
            <OriginWordmark text={t("wordmark")} />
          </Reveal>
          <Reveal inView variant="blur">
            <p className="font-poetic origin-closing">{t("closing")}</p>
          </Reveal>
        </div>
      </div>

      {/* Manifesto coda — tight sequence, after the resolution */}
      <div className="manifesto page-x mt-24 pb-28 md:mt-32 md:pb-40">
        {manifesto.map((line, i) => (
          <Reveal inView key={i} delay={i * 0.1} variant="blur">
            <p className="manifesto-line">{line}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
