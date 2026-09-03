"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { EASE_POINTS } from "@/lib/animation/easings";
import { subscribeOriginClock } from "@/lib/animation/origin-clock";
import { ORIGIN_BEATS, ORIGIN_ARC } from "@/lib/webgl/origin-score.mjs";
import { driveOriginRive } from "./OriginRive";

/**
 * S7 · THE DIRECTOR (R7) — the chapter's GSAP master timeline.
 *
 * One timeline, positioned in the runway's own p, scrubbed by the clock
 * PageStage measures for the liquid (lib/animation/origin-clock.ts). GSAP
 * orchestrates the CINEMATIC layer — every arrival and release of the
 * chapter's copy, the letters of the two ideas condensing, the two clauses
 * leaning into the meeting, the thesis rising, the name's type taking over
 * from the vapour that spelled it — on the house eases, from the same beat map
 * the liquid and the mist read (lib/webgl/origin-score.mjs). It never touches
 * a droplet or a particle: the physics runs on its own clock and reads dials;
 * the director reads p and moves type. Two owners, one clock, no fight.
 *
 * ── the fail-safe ─────────────────────────────────────────────────────────
 * Nothing is hidden until the clock is LIVE. The server renders every block
 * visible; the CSS mask this drives (`--wipe-in` / `--wipe-out`) is registered
 * to resolve fully open; the timeline is built on the first tick and reverted
 * on unmount. Reduced motion, static tiers, the deterministic QA holds and
 * no-JS never receive a tick, so they never lose a word (AGENTS.md §4.13).
 *
 * ── why not ScrollTrigger ─────────────────────────────────────────────────
 * ScrollTrigger would be a second measurement of the same runway — a second
 * clock, disagreeing with the liquid by a frame under Lenis. `timeline.time(p)`
 * on a paused timeline renders exactly the scrubbed state, every frame, from
 * the number the liquid already runs on.
 */
export function OriginDirector() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const journey = document.querySelector<HTMLElement>("#name .origin-journey");
    if (!journey) return;
    gsap.registerPlugin(CustomEase, SplitText);
    const ease = (name: keyof typeof EASE_POINTS) => {
      const id = `origin-${name}`;
      if (!CustomEase.get(id)) CustomEase.create(id, EASE_POINTS[name].join(","));
      return id;
    };
    const ARRIVE = ease("arrive");
    const DEPART = ease("depart");
    const CALM = ease("calm");

    type Built = {
      tl: gsap.core.Timeline;
      splits: SplitText[];
      els: Element[];
      ideasFrom: number;
      ideasSpan: number;
    };
    let built: Built | null = null;
    let disposed = false;

    const build = (): Built | null => {
      const q = (sel: string) => Array.from(journey.querySelectorAll<HTMLElement>(sel));
      const one = (sel: string) => journey.querySelector<HTMLElement>(sel);
      const els: Element[] = [];
      const splits: SplitText[] = [];
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "none", immediateRender: false },
      });

      // ── THE WIPE — one rising light band arrives and releases every block ──
      // The stylesheet keeps the mask; the director now owns its two numbers,
      // so each edge travels on a house ease instead of a linear clamp.
      for (const beat of ORIGIN_BEATS) {
        const el = one(`[data-beat="${beat.id}"]`);
        if (!el) continue;
        els.push(el);
        gsap.set(el, { "--wipe-in": 0, "--wipe-out": 0 });
        tl.fromTo(
          el,
          { "--wipe-in": 0 },
          { "--wipe-in": 1, duration: beat.span, ease: ARRIVE },
          beat.from,
        );
        if (beat.until < 1)
          tl.fromTo(
            el,
            { "--wipe-out": 0 },
            { "--wipe-out": 1, duration: beat.exit, ease: DEPART },
            beat.until,
          );
      }

      // ── BEAT 1 · the two names CONDENSE ───────────────────────────────────
      // Zéfiro is the west wind: its letters arrive from the west, first
      // letter first. Ventura is what is to come: from ahead, last letter
      // first. Each letter blurs into focus as the vapour above condenses
      // onto its pole — the same motion at the scale of type.
      const ideas = ORIGIN_BEATS[0];
      const words: [HTMLElement | null, number][] = [
        [one('[data-origin="word"][data-side="a"]'), -1],
        [one('[data-origin="word"][data-side="b"]'), 1],
      ];
      for (const [el, side] of words) {
        if (!el) continue;
        const split = SplitText.create(el, {
          type: "chars",
          charsClass: "origin-char",
          aria: "auto",
        });
        splits.push(split);
        const from = { opacity: 0, x: `${side * 0.34}em`, filter: "blur(7px)" };
        gsap.set(split.chars, from);
        tl.fromTo(
          split.chars,
          from,
          {
            opacity: 1,
            x: "0em",
            filter: "blur(0px)",
            duration: 0.05,
            ease: ARRIVE,
            stagger: { each: 0.0045, from: side < 0 ? "start" : "end" },
          },
          ideas.from + 0.004,
        );
      }

      // ── BEAT 2 · the antithesis leans into the meeting ────────────────────
      // The two clauses stand apart, then move inward by the same small
      // distance as the two bodies close above them — and lean a little
      // further as the fusion completes, so the empty middle is seen closing.
      const clauses = q('[data-origin="clause"]');
      if (clauses.length === 2) {
        els.push(...clauses);
        gsap.set(clauses[0], { x: "-1.5rem" });
        gsap.set(clauses[1], { x: "1.5rem" });
        tl.fromTo(clauses[0], { x: "-1.5rem" }, { x: "0rem", duration: 0.12, ease: CALM }, ORIGIN_ARC.MEET[1] - 0.01);
        tl.fromTo(clauses[1], { x: "1.5rem" }, { x: "0rem", duration: 0.12, ease: CALM }, ORIGIN_ARC.MEET[1] - 0.01);
        tl.to(clauses[0], { x: "0.55rem", duration: 0.1, ease: CALM }, ORIGIN_ARC.FUSE[0] + 0.11);
        tl.to(clauses[1], { x: "-0.55rem", duration: 0.1, ease: CALM }, ORIGIN_ARC.FUSE[0] + 0.11);
      }

      // ── BEAT 3 · the answer, then the three grounds ───────────────────────
      const mark = ORIGIN_BEATS[2];
      const fusion = one('[data-origin="fusion"]');
      if (fusion) {
        els.push(fusion);
        gsap.set(fusion, { y: "0.35em", opacity: 0 });
        tl.fromTo(fusion, { y: "0.35em", opacity: 0 }, { y: "0em", opacity: 1, duration: 0.05, ease: ARRIVE }, mark.from + 0.008);
      }
      const pillars = q('[data-origin="pillar"]');
      if (pillars.length) {
        els.push(...pillars);
        gsap.set(pillars, { opacity: 0, y: "0.4em" });
        tl.fromTo(
          pillars,
          { opacity: 0, y: "0.4em" },
          { opacity: 1, y: "0em", duration: 0.04, ease: ARRIVE, stagger: 0.012 },
          mark.from + 0.05,
        );
      }

      // ── BEAT 4 · the thesis rises, word by word ───────────────────────────
      const hold = ORIGIN_BEATS[3];
      const statement = one('[data-origin="statement"]');
      if (statement) {
        const split = SplitText.create(statement, {
          type: "words",
          wordsClass: "origin-word",
          aria: "auto",
        });
        splits.push(split);
        const from = { opacity: 0, y: "0.28em", filter: "blur(5px)" };
        gsap.set(split.words, from);
        tl.fromTo(
          split.words,
          from,
          { opacity: 1, y: "0em", filter: "blur(0px)", duration: 0.055, ease: ARRIVE, stagger: 0.009 },
          hold.from + 0.006,
        );
      }
      const echo = one('[data-origin="echo"]');
      if (echo) {
        els.push(echo);
        gsap.set(echo, { opacity: 0, y: "0.3em" });
        tl.fromTo(echo, { opacity: 0, y: "0.3em" }, { opacity: 1, y: "0em", duration: 0.05, ease: ARRIVE }, hold.from + 0.07);
      }

      // ── BEAT 5 · the name ─────────────────────────────────────────────────
      // The band arrives empty and the vapour spells into it; the type fades
      // in over the finished letters as the vapour fades out (the mist's FADE
      // window), and the closing line lands under it.
      const resolve = ORIGIN_BEATS[4];
      const glyphs = one('[data-origin="wordmark"]');
      if (glyphs) {
        els.push(glyphs);
        gsap.set(glyphs, { opacity: 0 });
        const t0 = ORIGIN_ARC.SPELL[1] + 0.005;
        tl.fromTo(glyphs, { opacity: 0 }, { opacity: 1, duration: ORIGIN_ARC.FADE[1] - t0, ease: CALM }, t0);
      }
      const closing = one('[data-origin="closing"]');
      if (closing) {
        els.push(closing);
        gsap.set(closing, { opacity: 0, y: "0.25em" });
        tl.fromTo(closing, { opacity: 0, y: "0.25em" }, { opacity: 1, y: "0em", duration: 0.045, ease: ARRIVE }, resolve.from + 0.04);
      }

      return { tl, splits, els, ideasFrom: ideas.from, ideasSpan: ideas.until - ideas.from };
    };

    const unsub = subscribeOriginClock((p) => {
      if (disposed) return;
      if (!built) {
        built = build();
        if (!built) return;
      }
      built.tl.time(p, true);
      driveOriginRive((p - built.ideasFrom) / built.ideasSpan);
    });

    return () => {
      disposed = true;
      unsub();
      if (built) {
        built.tl.kill();
        for (const s of built.splits) s.revert();
        gsap.set(built.els, { clearProps: "all" });
        built = null;
      }
    };
  }, [reduced]);

  return null;
}
