import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/hero/LogoMark";
import { ManifestoQuote } from "@/components/chapters/ManifestoQuote";

type Idea = { kicker: string; word: string; gloss: string; line: string };
type Coda = { latin: string; quote: string; attribution: string; source: string };

/** S7's full reading path is authored HTML. GSAP and the shared liquid stage
 * enhance these five beats; no canvas contains the meaning of the chapter. */
export function ChapterName() {
  const t = useTranslations("name");
  const ideas = t.raw("ideas") as Idea[];
  const tension = t.raw("tension") as string[];
  const pillars = t.raw("pillars") as string[];
  const coda = t.raw("manifesto") as Coda;
  return (
    <section id="name" data-chapter className="relative" aria-labelledby="name-title">
      <header className="origin-open-block page-x">
        <p className="chapter-label">{t("chapterLabel")}</p>
        <h2 id="name-title" className="origin-headline font-grotesk">{t("headline")}</h2>
        <p className="origin-open">{t("open")}</p>
      </header>
      <div className="origin-journey">
        <div className="origin-stage">
          {ideas.map((idea, i) => (
            <article className={`origin-beat origin-beat--${i === 0 ? "force" : "direction"} page-x`} key={idea.word}>
              <div className="origin-frame origin-copy origin-idea-composition">
                <div className="origin-idea-heading">
                  <p className="origin-idea-kicker origin-type origin-type--label">{idea.kicker}</p>
                  <h3 className="origin-idea-word origin-type origin-type--name">{idea.word}</h3>
                  <p className="origin-idea-gloss font-poetic origin-type origin-type--gloss">{idea.gloss}</p>
                </div>
                <p className="origin-idea-line origin-type origin-type--detail">{idea.line}</p>
              </div>
            </article>
          ))}
          <div className="origin-beat origin-beat--convergence page-x">
            <div className="origin-frame origin-copy">
              <p className="origin-tension font-poetic">
                {tension.map((line, i) => <span className={`origin-type origin-type--clause-${i}`} key={line}>{line}</span>)}
              </p>
              <p className="origin-convergence origin-type origin-type--detail">{t("convergence")}</p>
            </div>
          </div>
          <div className="origin-beat origin-beat--identity page-x">
            <div className="origin-frame origin-copy">
              <div className="origin-static-mark journey-static"><LogoMark /></div>
              <p className="origin-name font-grotesk origin-type origin-type--identity">{t("wordmark")}</p>
              <div className="origin-identity-notes">
                <p className="origin-fusion origin-type origin-type--gloss">{t("fusion")}</p>
                <div className="origin-founding origin-type origin-type--detail">
                  <p className="origin-pillars-lead">{t("pillarsLead")}</p>
                  <ul className="founding-pillars">
                    {pillars.map((pillar) => <li key={pillar} className="founding-pillar">{pillar}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="origin-beat origin-beat--continuation page-x">
            <div className="origin-frame origin-copy origin-purpose-copy">
              <p className="origin-idea-kicker origin-type origin-type--label">{t("echo")}</p>
              <p className="origin-statement font-grotesk origin-type origin-type--name">{t("purpose")}</p>
              <p className="origin-closing font-poetic origin-type origin-type--detail">{t("closing")}</p>
            </div>
          </div>
        </div>
      </div>
      <ManifestoQuote
        latin={coda.latin}
        quote={coda.quote}
        attribution={coda.attribution}
        source={coda.source}
      />
    </section>
  );
}
