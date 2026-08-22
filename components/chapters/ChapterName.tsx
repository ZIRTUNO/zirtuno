import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/hero/LogoMark";
import { OriginWordmark } from "./OriginWordmark";

type Idea = { kicker: string; word: string; gloss: string; line: string };

/**
 * S7 · Chapter 7 — A Origem / The Origin (+ manifesto coda). The emotional
 * peak, AFTER the business case.
 *
 * THE STORY IS TWO IDEAS, not two people. Zirtuno is Zéfiro — the west wind,
 * the quiet force that changes the shape of what it touches — joined to
 * Ventura: direction, and the courage to take it. Two NAMED ideas can be
 * shown: each one is put beside the mass that stands for it, the reader learns
 * what each is missing on its own, and the fusion the liquid was already
 * performing becomes the chapter's argument rather than its decoration.
 *
 * ── THE DAWN (this pass) ────────────────────────────────────────────────────
 * The chapter was rebuilt around two failures that photographs made obvious
 * (captures/origin/before-*.png):
 *
 *  1. COPY STOOD ON THE MARK. Every beat centred its column and the liquid
 *     parks at uv (0.5, 0.5 + ORIGIN_OY) — so the fusion line ran straight
 *     across the logo and the resolution copy wore droplets. The chapter's
 *     answer had been to punch black apertures behind the words, which is the
 *     panel-on-top-of-the-field look those apertures were meant to avoid.
 *     Now the beat is a TWO-BAND grid: the upper band is the stage and holds
 *     no type at all, the lower band is the copy. Nothing overlaps, so nothing
 *     needs a box. The two idea plates sit in that lower band around an empty
 *     gutter while the masses cross ABOVE them, and at the fusion the two
 *     plates become one spine — the setting performs the argument.
 *
 *  2. THIRTEEN INDEPENDENT FADE-UPS. Every block was a `Reveal variant="blur"`
 *     firing on its own ScrollTrigger at `top 88%`, unrelated to the liquid it
 *     describes — the "generic repeated fade-ups" build-spec §4.4 rules out.
 *     They are gone. All S7 copy is now scrubbed from ONE clock: `--origin-p`,
 *     the scene's own p, written once per frame by PageStage (the pattern
 *     `--method-flow` already established). Each beat derives its arrival in
 *     pure CSS and RESOLVES — it never fades back out. The gesture is a
 *     horizon wipe: a soft mask edge rising through the type, the same light
 *     that is coming up behind the stage.
 *
 * The five beats stay FIVE and stay SCRUBBED: the scene's envelopes are keyed
 * to a p that runs evenly across this runway — beat 1 rides the two masses
 * travelling in (q1 ≤ 0.17), beat 2 their collision (q2 0.19–0.41), beat 3 the
 * resolved mark and the founding-pillar labels, beat 4 the ecosystem echo
 * (q4 0.62), beat 5 the drain under the assembling wordmark (q5 0.84). Adding
 * beats would silently slide the copy off the liquid it is describing, and the
 * `--from` windows below are keyed to those same numbers.
 *
 * The opening (label · headline · lead) moved OUT of the runway and above it.
 * Inside beat 1 it was centred in a sticky-stage viewport and the topbar sliced
 * the headline in half at every capture; as normal flow it simply reads.
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
      {/* The opening reads BEFORE the runway starts — normal flow, full
          measure, never under the sticky stage or the topbar. */}
      <header className="origin-open-block page-x">
        <p className="chapter-label">{t("chapterLabel")}</p>
        <h2 id="name-title" className="origin-headline font-grotesk">
          {t("headline")}
        </h2>
        <p className="origin-open">{t("open")}</p>
      </header>

      <div className="origin-journey">
        {/* Beat 1 — TWO IDEAS, APART. The masses are travelling in from
            opposite sides across the STAGE band above; the two plates sit in
            the copy band beneath them, composed around an empty gutter. The
            gutter is the space the masses are about to meet in. */}
        <div className="origin-beat origin-beat--ideas page-x">
          <div className="origin-frame">
            {/* unordered: the two ideas are peers, and the chapter's whole claim
                is that neither one comes first */}
            <ul className="origin-ideas origin-copy">
              {ideas.map((idea) => (
                <li key={idea.word}>
                  <article className="origin-idea">
                    <p className="origin-idea-kicker">{idea.kicker}</p>
                    <p className="origin-idea-word">
                      {idea.word}
                      <span className="origin-idea-gloss">{idea.gloss}</span>
                    </p>
                    <p className="origin-idea-line">{idea.line}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Beat 2 — THE TENSION. The masses close and collide on the stage
            above; the two clauses are set as two lines so the symmetry of the
            argument is visible rather than merely stated. */}
        <div className="origin-beat origin-beat--tension page-x">
          <div className="origin-frame">
            <p className="origin-tension origin-copy">
              {tension.map((clause, i) => (
                <span className="origin-tension-line" key={i}>
                  {clause}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Beat 3 — THE FUSION. One mark on the stage, and the three founding
            pillars (the WHY — never the seven services) as a COMPOSED triptych
            beneath the line that introduces them. The two plates of beat 1
            have become one spine: same band, same measure, one column. */}
        <div className="origin-beat origin-beat--mark page-x">
          <div className="origin-frame">
            {/* the static path's stand-in for the live mark — hidden the
                moment the field paints, via the shared .journey-static rule */}
            <div className="journey-static origin-static-mark">
              <LogoMark />
            </div>
            <div className="origin-copy">
              <p className="origin-fusion">{t("fusion")}</p>
              <div className="origin-founding">
                <p className="origin-pillars-lead">{t("pillarsLead")}</p>
                <ul className="founding-pillars">
                  {pillars.map((p) => (
                    <li key={p} className="founding-pillar">
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Beat 4 — THE PURPOSE: the dominant line, under the echo fanning out
            across the stage. This is the chapter's brightest ground. */}
        <div className="origin-beat origin-beat--hold page-x">
          <div className="origin-frame">
            <p className="origin-statement origin-copy">{t("purpose")}</p>
          </div>
        </div>

        {/* Beat 5 — RESOLUTION: the liquid drains from the stage; particles
            assemble the wordmark in the copy band; the closing line lands
            under it as the dawn settles back to ink. */}
        <div className="origin-beat origin-beat--resolve page-x">
          <div className="origin-frame">
            <div className="origin-copy origin-resolve">
              <p className="origin-coda">{t("echo")}</p>
              <div className="origin-wordmark-wrap">
                <OriginWordmark text={t("wordmark")} />
              </div>
              <p className="font-poetic origin-closing">{t("closing")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manifesto coda — the ground is ink again by here; the lines arrive on
          the same horizon wipe, staggered by index rather than by a timer. */}
      <div className="manifesto page-x">
        {manifesto.map((line, i) => (
          <p
            className="manifesto-line"
            key={i}
            style={{ "--i": i } as React.CSSProperties}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
