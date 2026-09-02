import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { ConfluenceMark } from "@/components/chapters/ConfluenceMark";
import { CtaStructure, CtaPortfolio } from "@/components/chrome/CtaButton";
import { GATHER_SYSTEMS } from "@/lib/webgl/gathering.mjs";

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
 * What the gathering RESOLVES INTO is THE CONFLUENCE (lib/webgl/confluence.mjs)
 * — three arms of liquid running in from the three systems and merging into one
 * core, made of the same 48 droplets that carried them. It is not the Zirtuno
 * mark and there is no vector behind it; the static fallback below draws the
 * same stations rather than a different symbol.
 *
 * The live capability names and system markers are portalled into the sticky
 * layer by PageStage, so they can ride the liquid masses in its pixel space.
 */
export function ChapterEcosystem({ hasWork }: { hasWork: boolean }) {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as Node[];
  const systems = t.raw("systems") as Record<string, string>;

  return (
    <section id="ecosystem" data-chapter className="relative">
      {/* A plain-language opening. The business relationship comes first; the
          runway then lets the liquid demonstrate it without a diagram or an
          invented layer of system notation. */}
      <div className="page-x gather-intro">
        <div className="gather-intro-composition">
          <Reveal inView as="p" className="chapter-label gather-eyebrow">
            {t("chapterLabel")}
          </Reveal>

          <Reveal inView delay={0.05} className="gather-intro-copy">
            <h2 className="type-section-title gather-claim">{t("headline")}</h2>
          </Reveal>

          <Reveal inView delay={0.12} className="gather-intro-lead-wrap">
            <p className="type-lead-copy gather-intro-lead">{t("lead")}</p>
          </Reveal>
        </div>
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
        {/* Static / reduced-motion / no-WebGL: the same symbol the liquid
            resolves into, drawn from the same station table. */}
        <div className="journey-static organism-fallback">
          <ConfluenceMark ariaLabel={t("centerLabel")} />
        </div>
      </div>

      {/* The liquid has done the joining. Close with the operational result,
          then the two existing conversion routes. */}
      <div className="page-x gather-outro">
        <Reveal inView className="gather-resolution">
          <p className="gather-resolution-line">{t("resolution")}</p>
        </Reveal>

        {/* Narrow and static tiers keep the same authored groupings as the
            live gathering, in a readable document rather than a faux circuit. */}
        <div className="eco-stack" aria-label={t("headline")}>
          {GATHER_SYSTEMS.map((system) => (
            <section className="eco-stack-group" key={system.id}>
              <h3 className="eco-stack-system">
                {systems[system.id] ?? system.id}
              </h3>
              <ul className="eco-stack-items">
                {system.nodes.map((slot) => {
                  const node = nodes[slot];
                  return node ? (
                    <li key={node.name} className="eco-stack-item">
                      <span className="eco-stack-name">{node.name}</span>
                      <span className="eco-stack-cap">{node.tooltip}</span>
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          ))}
          <p className="eco-stack-center">{t("centerLabel")}</p>
        </div>

        <Reveal
          inView
          className="gather-actions"
        >
          <CtaStructure placement="ecosystem" />
          {/* the portfolio link only exists while there is a portfolio */}
          {hasWork && <CtaPortfolio placement="ecosystem" />}
        </Reveal>
      </div>
    </section>
  );
}
