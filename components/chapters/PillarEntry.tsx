import { useTranslations } from "next-intl";
import { CtaButton } from "@/components/chrome/CtaButton";
import type { PillarKey } from "@/lib/content/services";

/**
 * One service pillar (S5.2). The is/solves/creates block is the commercial
 * core — never omitted. The serif-italic accent is a secondary poetic note.
 */
export function PillarEntry({
  index,
  pillarKey,
  category,
}: {
  index: number;
  pillarKey: PillarKey;
  category: string;
}) {
  const t = useTranslations("services");
  const base = `pillars.${pillarKey}`;
  const num = String(index + 1).padStart(2, "0");
  const caps = t.raw(`${base}.caps`) as string[];
  const categoryLabel = t(`${base}.categoryLabel`);

  return (
    <article className="pillar" data-pillar={index}>
      <span className="pillar-watermark" aria-hidden="true">
        {num}
      </span>

      <p className="pillar-counter">{t("counter", { n: num })}</p>
      <p className="font-poetic pillar-accent">{t(`${base}.accent`)}</p>
      <h3 className="pillar-name text-display-m">{t(`${base}.name`)}</h3>

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

      <p className="pillar-caps">
        {caps.map((c) => (
          // inline-block: the capability and its ::after separator wrap as
          // ONE unit — the trailing dot can no longer hang past the viewport
          // edge on narrow stages (the 390px 4px-overflow drill, R5-E)
          <span key={c} className="pillar-cap inline-block">
            {c}
          </span>
        ))}
      </p>

      <div className="mt-5">
        <CtaButton
          variant="ghost"
          href={`/work?category=${category}`}
          label={t("pillarCta", { category: categoryLabel })}
          placement={`service_${pillarKey}`}
        />
      </div>
    </article>
  );
}
