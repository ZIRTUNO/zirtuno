import { useTranslations } from "next-intl";
import { Disclose } from "./Disclose";
import type { PillarKey } from "@/lib/content/services";

/**
 * One of the seven forms (S4).
 *
 * TWO COLUMNS, and they never meet: the copy owns the left, the liquid owns the
 * right and holds it for the whole pillar. The form used to be centred over the
 * full width with type composed above and below it, which meant every melt
 * played out on top of the headline and the instrument band — the transitions
 * were unreadable not because the liquid was wrong but because it was on the
 * words. A locked column also makes the melt legible as a CHANGE OF SHAPE:
 * nothing travels, so the only thing the eye has to follow is the silhouette.
 *
 * R6 · TWO LAYERS. The entry used to stand at ~60 words: a counter, a name, a
 * serif aside, three labelled paragraphs and six capability chips, all at once,
 * seven times over — 40% of the homepage's entire word count. Reading it was
 * work, and nothing in it was ranked.
 *
 * It now resolves in one beat — number, name, and ONE concrete promise — with
 * the commercial substance one intentional click below. Nothing was deleted:
 * is/solves/creates and the capability set are the reason a buyer chooses an
 * agency, so they stay in the DOM, stay indexed, stay keyboard-reachable, and
 * stay out of the standing read until asked for.
 */
export function PillarEntry({
  index,
  pillarKey,
}: {
  index: number;
  pillarKey: PillarKey;
  category: string;
  /** While the portfolio is empty the category link is a dead end — the entry
   *  offers the conversation instead, still tagged with its entry intent. */
  hasWork: boolean;
}) {
  const t = useTranslations("services");
  const base = `pillars.${pillarKey}`;
  const num = String(index + 1).padStart(2, "0");
  const caps = t.raw(`${base}.caps`) as string[];
  const name = t(`${base}.name`);

  return (
    <article className="pillar" data-pillar={index}>
      {/* ── the copy column: everything readable lives here, and only here ── */}
      <div className="pillar-copy">
        {/* ── layer one: what resolves in a single glance ─────────────────── */}
        <header className="pillar-head">
          <p className="pillar-counter">{t("counter", { n: num })}</p>
          <h3 className="pillar-name type-feature-title">{name}</h3>
          <p className="pillar-promise">{t(`${base}.promise`)}</p>
        </header>

        {/* ── layer two: the instrument band, on intent ──────────────────────
            <Disclose> is a client shell around a native <details>; everything
            inside it is still this server component's output, so the
            commercial substance stays in the RSC HTML (rule 12) and the only
            thing that ships to the browser is the choreography. The accessible
            name repeats the pillar name because a screen reader hears
            summaries out of context in a rotor listing, where seven identical
            "Details" toggles would be unusable.

            Every [data-disclose-lines] block is split into its real line
            boxes when the panel opens, and those lines — not the blocks — are
            the beats of the stagger: label, answer, label, answer, the
            capability set, then the brand's own voice last, poured in reading
            order. [data-disclose-row] stays as the fallback unit for the case
            where nothing splits. */}
        <Disclose
          className="pillar-detail"
          label={t("detailsLabel")}
          summaryLabel={`${t("detailsLabel")}: ${name}`}
        >
          <dl className="pillar-blocks">
            <div className="pillar-block" data-disclose-row>
              <dt className="pillar-label" data-disclose-lines>
                {t("labelIs")}
              </dt>
              <dd data-disclose-lines>{t(`${base}.is`)}</dd>
            </div>
            <div className="pillar-block" data-disclose-row>
              <dt className="pillar-label" data-disclose-lines>
                {t("labelSolves")}
              </dt>
              <dd data-disclose-lines>{t(`${base}.solves`)}</dd>
            </div>
            <div className="pillar-block" data-disclose-row>
              <dt className="pillar-label" data-disclose-lines>
                {t("labelCreates")}
              </dt>
              <dd data-disclose-lines>{t(`${base}.creates`)}</dd>
            </div>
          </dl>

          <p className="pillar-caps" data-disclose-row data-disclose-lines>
            {caps.map((c, i) => (
              // inline-block: the capability and its ::after separator wrap as
              // ONE unit — the trailing dot can no longer hang past the
              // viewport edge on narrow stages (the 390px 4px-overflow drill).
              //
              // The LAST chip is marked here rather than left to :last-child,
              // because the disclosure's line split moves these spans into one
              // wrapper per rendered line: :last-child would then match the
              // last chip on EVERY line, and three separators would vanish the
              // moment the panel started opening.
              <span
                key={c}
                className={`pillar-cap inline-block${
                  i === caps.length - 1 ? " pillar-cap-last" : ""
                }`}
              >
                {c}
              </span>
            ))}
          </p>

          {/* the brand's own voice — kept, but as the closing note of the
              detail rather than a second grey line competing with the promise */}
          <p className="font-poetic pillar-accent" data-disclose-row data-disclose-lines>
            {t(`${base}.accent`)}
          </p>
        </Disclose>

      </div>

      {/* The form's own column. Empty by design and never collapsed: it is what
          gives the liquid a place to be the subject rather than a backdrop. */}
      <div className="pillar-stage -order-1 min-[60rem]:order-none" aria-hidden="true" />
    </article>
  );
}
