"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { ProofRow } from "./ProofRow";
import { WordCycle } from "./WordCycle";
import { HeroRibbon } from "./HeroRibbon";
import {
  useCinematicCamera,
  useCinematicCycle,
} from "./useCinematicHero";
import "@/app/lab.css";

/**
 * The reference's hierarchy rebuilt as a native Zirtuno hero: a quiet two-line
 * sentence, one bold changing word, a stronger business phrase, then a proof
 * sequence. The lab stream supplies the ribbon beneath it.
 */
export function Hero() {
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

  return (
    <section id="hero" className="lab-hero" ref={sectionRef}>
      <div className="lab-mesh" aria-hidden="true">
        <span className="lab-mesh-a" />
        <span className="lab-mesh-b" />
      </div>

      <HeroRibbon />

      <div className="lab-perspective">
        <div className="lab-plane" ref={planeRef}>
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
            <Link
              href="/?intent=analysis#contact"
              className="lab-cta"
              data-cursor="hover"
              data-analytics-event="cta_intent"
              data-analytics-intent="analysis"
              data-analytics-placement="hero"
            >
              <span className="lab-cta-sheen" aria-hidden="true" />
              <span className="lab-cta-label">{t("cta")}</span>
              <span className="lab-cta-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>

      <p className="lab-scroll" aria-hidden="true">
        {t("scroll")}
      </p>
    </section>
  );
}
