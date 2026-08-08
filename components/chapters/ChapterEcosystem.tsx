import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { LogoMark } from "@/components/hero/LogoMark";
import { CtaStructure, CtaPortfolio } from "@/components/chrome/CtaButton";

type Node = { name: string; tooltip: string };

/**
 * S3 · THE GATHERING — the ecosystem as a convergence in depth.
 *
 * The Problem leaves the liquid fractured and scattered. This chapter is the
 * answer, and it is told by the liquid rather than beside it: the same
 * fragments are drawn forward out of the dark, arrive in their three systems,
 * and fuse into one body. Nothing is drawn between them — the claim is that
 * they stop being separate, and a diagram of boxes and lines would quietly
 * argue the opposite.
 *
 * The chapter contributes: the opening claim, the RUNWAY (the scroll distance
 * the gathering is scrubbed across — no pins), a closing line that only makes
 * sense once the body is whole, and the semantic capability stack for narrow
 * viewports, assistive tech and static tiers. Copy is server-rendered (RSC).
 *
 * The live capability names and system markers are portalled into the sticky
 * layer by PageStage, so they can ride the liquid masses in its pixel space.
 */
export function ChapterEcosystem({ hasWork }: { hasWork: boolean }) {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as Node[];

  return (
    <section id="ecosystem" data-chapter className="relative">
      {/* The claim sits ABOVE the runway and stays short. The long form of
          this argument is the gathering itself; repeating it in a paragraph
          beside the liquid would make the liquid decoration. */}
      <div className="page-x gather-intro">
        <Reveal inView as="p" className="chapter-label">
          {t("chapterLabel")}
        </Reveal>

        <Reveal inView delay={0.05}>
          <h2 className="type-section-title gather-claim">{t("headline")}</h2>
        </Reveal>
      </div>

      {/* The runway — the scroll distance the gathering plays across. The
          sticky liquid layer owns everything visible here; static tiers get
          the resolved mark instead. */}
      <div className="eco-runway" data-organism>
        {/* PageStage portals the live capability names and system markers
            here so their keyboard order remains Problem → capabilities →
            Ecosystem CTAs. */}
        <div
          id="ecosystem-interactions-host"
          className="ecosystem-interactions-host"
        />
        <div className="journey-static organism-fallback">
          <LogoMark ariaLabel={t("centerLabel")} />
        </div>
      </div>

      {/* The resolution. This line is the payoff of the fuse and is placed to
          be read at the moment the body is whole. */}
      <div className="page-x gather-outro">
        <Reveal inView>
          <p className="type-lead-copy gather-lead">{t("lead")}</p>
        </Reveal>

        {/* the capabilities as a connected stack — narrow viewports, static
            tiers and assistive tech (the live names are lg+ and visual) */}
        <ul className="eco-stack" aria-label={t("headline")}>
          <li className="eco-stack-center">{t("centerLabel")}</li>
          {nodes.map((n, i) => (
            <li key={i} className="eco-stack-item">
              <span className="eco-stack-name">{n.name}</span>
              <span className="eco-stack-cap">{n.tooltip}</span>
            </li>
          ))}
        </ul>

        <Reveal
          inView
          className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4"
        >
          <CtaStructure placement="ecosystem" />
          {/* the portfolio link only exists while there is a portfolio */}
          {hasWork && <CtaPortfolio placement="ecosystem" />}
        </Reveal>
      </div>
    </section>
  );
}
