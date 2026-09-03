import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/hero/LogoMark";
import { Reveal } from "@/components/ui/Reveal";
import { OriginWordmark } from "./OriginWordmark";
import { OriginDirector } from "./OriginDirector";
import { OriginRive } from "./OriginRive";

type Idea = { kicker: string; word: string; gloss: string; line: string };

/**
 * S7 · A Origem / The Origin — THE CONVERGENCE (R7).
 *
 * The chapter is the story of TWO IDEAS, not two people, told by the liquid at
 * a new scale: the liquid lets go and boils off into a field of vapour that
 * fills the stage, and the whole chapter is that field being drawn back in —
 * onto two poles, onto one point, into the exact mark, out again under the
 * thesis, and finally onto the letters of the name. The scene
 * (lib/webgl/scenes/origin.ts) and the mist (lib/webgl/mist.mjs) own that
 * motion; the DIRECTOR (OriginDirector.tsx) choreographs this copy on the
 * same clock with GSAP. Five bands, one runway, one p:
 *
 *   ideas → tension → mark → purpose → the name
 *
 * `.origin-journey` remains the WebGL measurement anchor; `.origin-copy` marks
 * the blocks the horizon wipe arrives and releases; `data-origin` marks the
 * elements the director moves; `.origin-wordmark-glyphs` is the box the vapour
 * spells into. All copy is semantic and server-rendered, and the
 * static/reduced-motion path collapses the runway into the same complete
 * reading order with nothing hidden.
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
      {/* THE ENTRANCE. The opening reads in normal flow while the liquid
          disperses and boils off behind it — label, headline, one line. The
          Soul act's own arrival (the blur reveal) carries the three. */}
      <header className="origin-open-block page-x">
        <Reveal inView variant="blur" as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>
        <Reveal inView variant="blur" delay={0.05} as="h2" className="origin-headline font-grotesk">
          <span id="name-title">{t("headline")}</span>
        </Reveal>
        <Reveal inView variant="blur" delay={0.1} as="p" className="origin-open">
          {t("open")}
        </Reveal>
      </header>

      <div className="origin-journey">
        <OriginDirector />

        {/* Beat 1 — the two ideas condense at their poles. Their names hold one
            baseline below the field; each letter arrives from its idea's side
            of the world. */}
        <div className="origin-beat origin-beat--ideas page-x">
          <div className="origin-frame">
            <ul className="origin-ideas origin-copy" data-beat="ideas">
              {ideas.map((idea, i) => (
                <li key={idea.word}>
                  <article className="origin-idea">
                    <OriginRive idea={i === 0 ? 0 : 1} />
                    <p className="origin-idea-kicker">{idea.kicker}</p>
                    <p
                      className="origin-idea-word"
                      data-origin="word"
                      data-side={i === 0 ? "a" : "b"}
                    >
                      {idea.word}
                    </p>
                    <p className="origin-idea-gloss">{idea.gloss}</p>
                    <p className="origin-idea-line">{idea.line}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Beat 2 — two clauses, two sides, nothing between them. Their empty
            gap is the tension the field is closing above. */}
        <div className="origin-beat origin-beat--tension page-x">
          <div className="origin-frame">
            <p className="origin-tension origin-copy" data-beat="tension">
              <span className="origin-tension-line" data-origin="clause">
                {tension[0]}
              </span>
              <span className="origin-tension-line" data-origin="clause">
                {tension[1]}
              </span>
            </p>
          </div>
        </div>

        {/* Beat 3 — the exact owner-traced mark holds in the stage, made of
            what it collected. The WHY reads as one quiet baseline. */}
        <div className="origin-beat origin-beat--mark page-x">
          <div className="origin-frame">
            <div className="journey-static origin-static-mark">
              <LogoMark />
            </div>
            <div className="origin-copy origin-fusion-copy" data-beat="mark">
              <p className="origin-fusion font-grotesk" data-origin="fusion">
                {t("fusion")}
              </p>
              <div className="origin-founding">
                <p className="origin-pillars-lead">{t("pillarsLead")}</p>
                <ul className="founding-pillars" aria-label={t("pillarsLead")}>
                  {pillars.map((pillar) => (
                    <li key={pillar} className="founding-pillar" data-origin="pillar">
                      {pillar}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Beat 4 — the mark moves left and breathes out; the right half is
            the chapter's purpose. The shift is performed by the scene. */}
        <div className="origin-beat origin-beat--hold page-x">
          <div className="origin-frame origin-purpose-frame">
            <div className="origin-purpose-copy origin-copy" data-beat="hold">
              <p className="origin-statement font-grotesk" data-origin="statement">
                {t("purpose")}
              </p>
              <p className="origin-purpose-echo font-poetic" data-origin="echo">
                {t("echo")}
              </p>
            </div>
          </div>
        </div>

        {/* Beat 5 — the vapour spells the name; the type takes over. */}
        <div className="origin-beat origin-beat--resolve page-x">
          <div className="origin-frame">
            <div className="origin-copy origin-resolve" data-beat="resolve">
              <div className="origin-wordmark-wrap">
                <OriginWordmark text={t("wordmark")} />
              </div>
              <p className="font-poetic origin-closing" data-origin="closing">
                {t("closing")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* THE EXIT — the creed, on a stage that has returned to ink. */}
      <div className="manifesto page-x">
        <div className="manifesto-stream">
          {manifesto.map((line, i) => (
            <p
              className="manifesto-line"
              key={line}
              style={{ "--i": i } as React.CSSProperties}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
