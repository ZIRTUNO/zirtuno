"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { WordCycle } from "./WordCycle";
import { HeroRibbon } from "./HeroRibbon";
import {
  useCinematicCamera,
  useCinematicCycle,
} from "./useCinematicHero";
import "@/app/lab.css";

/**
 * THE HERO IS THE SENTENCE.
 *
 * A quiet two-line claim, one bold changing word, a stronger business phrase,
 * and the lab stream running underneath it. Nothing else stands on this
 * screen, and that is the composition rather than an absence in it: the first
 * thing the page says is now the only thing competing to be read.
 *
 * Two things used to live under the subline and neither is coming back here:
 *
 *   the proof row   four callouts ticked off by a travelling light. It said
 *                   the same thing four times before the reader had finished
 *                   the sentence above it. Still built, still authored
 *                   (`lab.proof`), and still runs in the isolated lab.
 *
 *   the sphere      a dot cloud that condensed into a body. It is parked, not
 *                   deleted — components/lab/HeroSphere.tsx, on its own route
 *                   at /lab/sphere with the entry it ran here preserved.
 *
 * So the Hero's own layout is now ONLY the shell and the stream: the copy sits
 * in the bar's column (`--page-padding`, R7) and clear of the ribbon's rise.
 * See `.lab-hero` in app/lab.css — the vertical is the load-bearing part.
 */
export function Hero() {
  const t = useTranslations("lab");
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  const words = t.raw("words") as string[];
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
        </div>
      </div>

    </section>
  );
}
