"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { HeroRibbon } from "@/components/hero/HeroRibbon";
import { ProofRow } from "@/components/hero/ProofRow";
import { WordCycle } from "@/components/hero/WordCycle";
import {
  useCinematicCamera,
  useCinematicCycle,
} from "@/components/hero/useCinematicHero";
import { Membrane } from "@/components/chrome/Membrane";
import { useCtaIntent } from "@/components/chrome/CtaButton";
import { Link } from "@/lib/i18n/config";

/** Isolated visual lab. The extra ribbon canvas is intentionally lab-only. */
export function LabHero() {
  const t = useTranslations("lab");
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  const words = t.raw("words") as string[];
  const proof = t.raw("proof") as string[];
  const cycle = useCinematicCycle(words.length, reduced, sectionRef);
  const index = words.length > 0 ? cycle % words.length : 0;
  useCinematicCamera(sectionRef, planeRef, reduced);

  const headline = `${t("headlineBefore")} ${words[0] ?? ""} ${t("headlineMid")} ${t("headlineBold")} ${t("headlineTail")}`;

  const cta = useCtaIntent({ intent: "analysis", placement: "lab_hero" });
  // One copy of the skin for both branches — the inert button and the live
  // link have to stay pixel-identical, and two copies is how they stop being.
  const ctaSkin = (
    <>
      <span className="lab-cta-sheen" aria-hidden="true" />
      <Membrane filled />
      <span className="lab-cta-label">{t("cta")}</span>
      <span className="lab-cta-arrow" aria-hidden="true">
        →
      </span>
      {/* The ink copy, clipped to the flood front. Last in the DOM so it
          paints over the paper label and arrow without a z-index race. */}
      <span className="lab-cta-ink cta-label-ink" aria-hidden="true">
        <span className="lab-cta-label">{t("cta")}</span>
        <span className="lab-cta-arrow">→</span>
      </span>
    </>
  );

  return (
    <section className="lab-hero" ref={sectionRef}>
      <div className="lab-mesh" aria-hidden="true">
        <span className="lab-mesh-a" />
        <span className="lab-mesh-b" />
      </div>

      <HeroRibbon />

      <div className="lab-perspective">
        <div className="lab-plane" ref={planeRef}>
          <p className="lab-badge">
            <span className="lab-badge-dot" aria-hidden="true" />
            {t("badge")}
          </p>

          <h1 className="lab-headline">
            <span className="sr-only">{headline}</span>
            <span className="lab-headline-visual" aria-hidden="true">
              <span className="lab-headline-line">
                <span className="lab-light">{t("headlineBefore")}</span>{" "}
                <WordCycle words={words} index={index} />{" "}
                <span className="lab-light">{t("headlineMid")}</span>
              </span>
              <span className="lab-headline-line">
                <span className="lab-strong">{t("headlineBold")}</span>{" "}
                <span className="lab-light">{t("headlineTail")}</span>
              </span>
            </span>
          </h1>

          <p className="lab-sub">{t("subline")}</p>
          <ProofRow items={proof} />

          <div className="lab-actions">
            {/* The skin is hand-rolled (this CTA carries a sheen and an arrow
                the membrane buttons do not), but the BEHAVIOUR now comes from
                `useCtaIntent` like every other placement. It used to be a
                hard-coded inert button precisely so `INTENT_DESTINATION_READY`
                could not reach it — which is how it became the one element on
                the site still linking to `/?intent=analysis#contact` after S10
                was quarantined, and had to be turned off by hand. Reading the
                hook means it can never fall out of step with the other nine
                again, in either direction. */}
            {cta.pending ? (
              <button type="button" aria-disabled="true" data-cta-pending="" className="lab-cta">
                {ctaSkin}
              </button>
            ) : (
              <Link
                href={cta.href}
                className="lab-cta"
                data-cursor="hover"
                {...cta.analytics}
                onClick={cta.onClick}
              >
                {ctaSkin}
              </Link>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}
