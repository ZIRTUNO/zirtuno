import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/hero/LogoMark";
import { OriginWordmark } from "./OriginWordmark";

type Idea = { kicker: string; word: string; gloss: string; line: string };

/**
 * S7 · A Origem / The Origin.
 *
 * The chapter is the story of TWO IDEAS, not two people. The five scene beats
 * remain keyed to the same persistent liquid clock; this component only gives
 * them a quieter reading path. There is no parallel progress UI or decorative
 * frame. Motion is authored by the liquid itself:
 *
 *   enter apart -> name the ideas -> collide -> hold the exact mark ->
 *   make room for the purpose -> drain into the wordmark.
 *
 * `.origin-journey` remains the WebGL measurement anchor. All copy is semantic
 * and server-rendered, and the static/reduced-motion path collapses the runway
 * into the same complete reading order.
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
      <header className="origin-open-block page-x">
        <p className="chapter-label">{t("chapterLabel")}</p>
        <h2 id="name-title" className="origin-headline font-grotesk">
          {t("headline")}
        </h2>
        <p className="origin-open">{t("open")}</p>
      </header>

      <div className="origin-journey">
        {/* Beat 1 — the two ideas enter as peers. The liquid owns the upper
            field; the names hold one baseline below it. */}
        <div className="origin-beat origin-beat--ideas page-x">
          <div className="origin-frame">
            <ul className="origin-ideas origin-copy">
              {ideas.map((idea) => (
                <li key={idea.word}>
                  <article className="origin-idea">
                    <p className="origin-idea-kicker">{idea.kicker}</p>
                    <p className="origin-idea-word">{idea.word}</p>
                    <p className="origin-idea-gloss">{idea.gloss}</p>
                    <p className="origin-idea-line">{idea.line}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Beat 2 — two clauses, two sides, no diagram between them. Their
            empty gap is the tension the liquid is closing above. */}
        <div className="origin-beat origin-beat--tension page-x">
          <div className="origin-frame">
            <p className="origin-tension origin-copy">
              <span className="origin-tension-line">{tension[0]}</span>
              <span className="origin-tension-line">{tension[1]}</span>
            </p>
          </div>
        </div>

        {/* Beat 3 — the exact owner-traced mark holds in the stage. The WHY
            reads as one quiet baseline, not another service menu. */}
        <div className="origin-beat origin-beat--mark page-x">
          <div className="origin-frame">
            <div className="journey-static origin-static-mark">
              <LogoMark />
            </div>
            <div className="origin-copy origin-fusion-copy">
              <p className="origin-fusion font-grotesk">{t("fusion")}</p>
              <div className="origin-founding">
                <p className="origin-pillars-lead">{t("pillarsLead")}</p>
                <ul className="founding-pillars" aria-label={t("pillarsLead")}>
                  {pillars.map((pillar) => (
                    <li key={pillar} className="founding-pillar">
                      {pillar}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Beat 4 — once the mark exists it moves left, leaving the right half
            to the chapter's purpose. The shift is performed by the scene, not
            by a second visual engine. */}
        <div className="origin-beat origin-beat--hold page-x">
          <div className="origin-frame origin-purpose-frame">
            <div className="origin-purpose-copy origin-copy">
              <p className="origin-statement font-grotesk">{t("purpose")}</p>
              <p className="origin-purpose-echo font-poetic">{t("echo")}</p>
            </div>
          </div>
        </div>

        {/* Beat 5 — the field drains and the name is the only thing left. */}
        <div className="origin-beat origin-beat--resolve page-x">
          <div className="origin-frame">
            <div className="origin-copy origin-resolve">
              <div className="origin-wordmark-wrap">
                <OriginWordmark text={t("wordmark")} />
              </div>
              <p className="font-poetic origin-closing">{t("closing")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="manifesto page-x">
        <div className="manifesto-stream">
          {manifesto.map((line) => (
            <p className="manifesto-line" key={line}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
