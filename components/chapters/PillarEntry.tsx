import { useTranslations } from "next-intl";
import { CtaButton } from "@/components/chrome/CtaButton";
import type { PillarKey } from "@/lib/content/services";

/**
 * One of the seven forms (S4).
 *
 * The liquid holds the CENTRE of the stage and this type frames it: the name
 * across the top, an instrument band across the bottom. Nothing sits in the
 * middle, because the middle is where the form lives — that hole is the
 * composition, not a gap in it.
 *
 * The is/solves/creates block is the commercial core and is never omitted; it
 * is set as three labelled columns rather than a stacked definition list, so
 * it reads as one instrument panel under the form instead of a card of body
 * copy. The serif-italic accent stays a secondary poetic note.
 */
export function PillarEntry({
  index,
  pillarKey,
  category,
  hasWork,
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
  const categoryLabel = t(`${base}.categoryLabel`);

  return (
    <article className="pillar" data-pillar={index}>
      {/* ── the head: the form rises into this ─────────────────────────────── */}
      <header className="pillar-head">
        <p className="pillar-counter">{t("counter", { n: num })}</p>
        <h3 className="pillar-name type-feature-title">{t(`${base}.name`)}</h3>
        <p className="font-poetic pillar-accent">{t(`${base}.accent`)}</p>
      </header>

      {/* The form's own space. Empty by design and never collapsed: it is what
          gives the liquid a place to be the subject rather than a backdrop. */}
      <div className="pillar-stage" aria-hidden="true" />

      {/* ── the instrument band ────────────────────────────────────────────── */}
      <div className="pillar-foot">
        <dl className="pillar-blocks">
          <div className="pillar-block">
            <dt className="pillar-label">{t("labelIs")}</dt>
            <dd>{t(`${base}.is`)}</dd>
          </div>
          <div className="pillar-block">
            <dt className="pillar-label">{t("labelSolves")}</dt>
            <dd>{t(`${base}.solves`)}</dd>
          </div>
          <div className="pillar-block">
            <dt className="pillar-label">{t("labelCreates")}</dt>
            <dd>{t(`${base}.creates`)}</dd>
          </div>
        </dl>

        <div className="pillar-foot-row">
          <p className="pillar-caps">
            {caps.map((c) => (
              // inline-block: the capability and its ::after separator wrap as
              // ONE unit — the trailing dot can no longer hang past the
              // viewport edge on narrow stages (the 390px 4px-overflow drill)
              <span key={c} className="pillar-cap inline-block">
                {c}
              </span>
            ))}
          </p>

          {hasWork ? (
            <CtaButton
              variant="ghost"
              href={`/work?category=${category}`}
              label={t("pillarCta", { category: categoryLabel })}
              placement={`service_${pillarKey}`}
            />
          ) : (
            <CtaButton
              variant="ghost"
              intent="structure"
              label={t("pillarCtaTalk", { category: categoryLabel })}
              placement={`service_${pillarKey}`}
            />
          )}
        </div>
      </div>
    </article>
  );
}
