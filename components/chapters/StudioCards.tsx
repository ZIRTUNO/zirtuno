"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * S8 · WHAT THE STUDIO DELIVERS — three cards, one row.
 *
 * S8 answers where / who / why. "Who" used to be a bordered list of six role
 * names, which stated the team's shape without ever SHOWING the work it
 * produces: a visitor read "Design" and "Engenharia" and had to take both on
 * faith. These cards keep the same claim — a small multidisciplinary team
 * organised by function — and make it visible, by putting the artefact of each
 * function inside its own card. The six functions survive in the subtitles.
 *
 * The anatomy is deliberately the reference's (upsunday.co §services): a
 * 415.814/520 card, a 3-up row at the shell width, and the caption block at
 * 75.385%/10.341% of the card carrying a 5.374cqw title over a 4.741cqw line.
 * Every proportion below is that measurement, so the row reads at the scale
 * the owner set as the bar (`--shell-w` is already the reference's `--site-w`).
 * What is NOT borrowed is the colour: the reference runs three pastel grounds,
 * and this brand has one hue. The cards are ink lit by cyan at three different
 * depths — light from the top edge, from behind the frames, from under the
 * fan — so they separate by the direction of their light rather than by hue.
 * Mood rides form here, never a second colour channel.
 *
 * The stack fan is the one documented exception, by owner instruction
 * (2026-09-10): its brand marks keep their own colours, because a recoloured
 * trademark is both less recognisable and less correct, and recognisability is
 * the only reason to show a mark at all. Those tiles take a NEUTRAL ground
 * rather than the card's cyan glass so five palettes have somewhere quiet to
 * sit — and the single cyan tile left in the fan is the companion's, which is
 * what makes him the one the eye finds first.
 *
 * Each card is a container (`container-type: inline-size`), so everything
 * inside is expressed in cqw and the whole composition scales with the card
 * instead of breaking at arbitrary widths.
 */

/**
 * ms between web-shot advances. Long enough to read the shot in the slot,
 * short enough that twelve surfaces are a rotation rather than a queue: at the
 * 3.6 s the stage ran with six, twelve would take 43 s to come round.
 */
const SHOT_INTERVAL = 2900;

type UiFace =
  | "saas"
  | "shop"
  | "landing"
  | "editorial"
  | "portfolio"
  | "docs";

type Shot =
  | {
      kind: "image";
      src: string;
      altKey:
        | "shotJuliana"
        | "shotDiego"
        | "shotZirtuno"
        | "shotZirtunoWork"
        | "shotZirtunoCase"
        | "shotZirtunoContact";
    }
  | { kind: "ui"; face: UiFace };

/**
 * TWELVE surfaces on one stage, alternating real and drawn.
 *
 * SIX are PROOF, every one of them public and checkable by opening its URL:
 * the two live client sites the gallery presents (`lib/content/portfolio.ts`),
 * and four pages of this studio's own site — the hero, the work index, a case
 * page and the contact form. Four pages rather than four crops of one, because
 * a hero, an index, a case and a form are four different jobs and the stage is
 * meant to show a RANGE. They are shot flat by
 * `scripts/capture/studio-cards.mjs`, because the gallery's square lifestyle
 * renders of a laptop on a table are illegible at ~190px: the laptop wins and
 * the site disappears.
 *
 * SIX are INTERFACE VIGNETTES drawn in CSS — a product dashboard, a store, a
 * launch page, an editorial, a portfolio, a documentation site. Each carries no
 * client, no logo, no name and no number, so it shows a shape of web work
 * without being mistakable for a case study. They are drawn rather than
 * photographed so they stay sharp at every viewport and cost the page nothing.
 *
 * Award-gallery screenshots are the obvious way to add more, and they are
 * exactly what this card must not contain. On a card headed "Design e
 * engenharia: sites e sistemas construídos para converter", inside the chapter
 * that answers who this studio IS, another studio's work reads as this
 * studio's work — and it redistributes their copyrighted design commercially.
 * Rule #9 bans inventing proof; borrowing someone else's is the same claim by
 * another route. The honest way to grow this list is more delivered client
 * work: each one is a single line here plus a line in the shot script.
 */
const SHOTS: Shot[] = [
  { kind: "image", src: "/studio/site-juliana.jpg", altKey: "shotJuliana" },
  { kind: "ui", face: "saas" },
  { kind: "image", src: "/studio/site-diego.jpg", altKey: "shotDiego" },
  { kind: "ui", face: "shop" },
  { kind: "image", src: "/studio/site-zirtuno.jpg", altKey: "shotZirtuno" },
  { kind: "ui", face: "editorial" },
  {
    kind: "image",
    src: "/studio/site-zirtuno-work.jpg",
    altKey: "shotZirtunoWork",
  },
  { kind: "ui", face: "landing" },
  {
    kind: "image",
    src: "/studio/site-zirtuno-case.jpg",
    altKey: "shotZirtunoCase",
  },
  { kind: "ui", face: "portfolio" },
  {
    kind: "image",
    src: "/studio/site-zirtuno-contact.jpg",
    altKey: "shotZirtunoContact",
  },
  { kind: "ui", face: "docs" },
];

/**
 * Where a frame sits, by its distance behind the active one.
 *
 * Three slots are on stage — left, centre, right — and the rest wait off it.
 * A frame that has just left the LEFT slot parks at `is-exit` (off to the
 * left, transparent) and the next advance sends it to `is-enter` (off to the
 * right, transparent) to come round again. That jump crosses the whole card,
 * so `is-enter` deliberately transitions opacity ONLY: the frame teleports to
 * the staging point instead of sliding across behind the visible three.
 */
function slotFor(distance: number, total: number): string {
  if (distance === 0) return "is-centre";
  if (distance === 1) return "is-right";
  if (distance === total - 1) return "is-left";
  if (distance === total - 2) return "is-exit";
  return "is-enter";
}

/**
 * True while the element is anywhere near the viewport.
 *
 * Both moving cards cost something every frame — two compositor marquees and a
 * 3.6 s interval — and this page already spends its frame budget on a
 * full-viewport WebGL field. So neither runs until the card is actually in
 * front of someone. Scroll here is Lenis-driven and its scroll events are both
 * sparse and stale, so the signal has to come from an IntersectionObserver
 * rather than from measuring on scroll.
 */
function useOnScreen<T extends HTMLElement>(margin = "25%") {
  const ref = useRef<T>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setLive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setLive(entry.isIntersecting),
      { rootMargin: `${margin} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, live };
}

export function StudioCards() {
  const t = useTranslations("studio.cards");

  return (
    <div className="studio-cards">
      <CardBrand
        title={t("brand.title")}
        sub={t("brand.sub")}
        markAlt={t("brand.markAlt")}
      />
      <CardBuild title={t("build.title")} sub={t("build.sub")} />
      <CardIntel title={t("intel.title")} sub={t("intel.sub")} />
    </div>
  );
}

/* ── Card caption ────────────────────────────────────────────────────────── */

function Caption({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="studio-card__text">
      <p className="studio-card__title">{title}</p>
      <p className="studio-card__sub">{sub}</p>
    </div>
  );
}

/* ── 01 · Marca ──────────────────────────────────────────────────────────────
   Two brand-sheet marquees running against each other, with the mark's badge
   pinned over the seam. Every plate is DRAWN, not photographed — a type
   specimen, the palette, a colour swatch, a layout grid, a voice page, a spec
   page, the app icon, the wordmark, a motion beat, a card. Nothing here is a
   stock mockup: each one is a page of this brand's own book, which is the only
   honest way for a studio to show branding it has not been cleared to publish,
   and the only way for the page to stay vector at every viewport. */

/**
 * Twelve pages of this brand's own book, split into two DISJOINT rows.
 *
 * Disjoint is the whole point. Both rows drew from one seven-page set for two
 * passes, and the failure was the same every time: only four or five pages fit
 * across a card, so the same page kept landing directly above itself — two
 * colour-chip sheets, then two "Aa" sheets, perfectly aligned. At marquee
 * speed that does not read as a book with repeating pages, it reads as a
 * rendering bug. Reversing the row, changing its length and detuning the
 * durations all only made the collision rarer, never impossible.
 *
 * With no page in both rows it cannot happen at all, and the book doubles in
 * apparent depth for free.
 *
 * Each row then STRICTLY alternates paper and black, seam included — six
 * paper pages and six black ones, three of each per row. Grouping by kind
 * instead (all the paper pages in one row) left a quadrant of the card as an
 * unbroken dark void every time three black plates drifted past together.
 *
 * The seven liquid FORMS were in this set for one pass and came out: at plate
 * scale a morph silhouette is an ink splat with no caption to explain it, and
 * it made the strip read as clip art beside the sheets. The forms already own
 * S4, where they are large enough to be forms.
 */
const BRAND_PLATES_UPPER = [
  "type", // paper
  "mark", // black
  "grid", // paper
  "motion", // black
  "palette", // paper
  "card", // black
] as const;

const BRAND_PLATES_LOWER = [
  "logo", // paper
  "icon", // black
  "voice", // paper
  "wordmark", // black
  "swatch", // paper
  "spec", // black
] as const;

type PlateKind =
  | (typeof BRAND_PLATES_UPPER)[number]
  | (typeof BRAND_PLATES_LOWER)[number];

function CardBrand({
  title,
  sub,
  markAlt,
}: {
  title: string;
  sub: string;
  markAlt: string;
}) {
  const { ref, live } = useOnScreen<HTMLElement>();

  return (
    <article
      ref={ref}
      className="studio-card studio-card--brand"
      data-live={live}
    >
      <div className="brand-row brand-row--top">
        <div className="brand-track brand-track--ltr" aria-hidden="true">
          {/* Twice, so translating the track by exactly -50% is seamless. */}
          {[0, 1].map((pass) =>
            BRAND_PLATES_UPPER.map((plate) => (
              <BrandPlate key={`${pass}-${plate}`} kind={plate} />
            )),
          )}
        </div>
      </div>

      <div className="brand-row brand-row--bottom">
        <div className="brand-track brand-track--rtl" aria-hidden="true">
          {[0, 1].map((pass) =>
            BRAND_PLATES_LOWER.map((plate) => (
              <BrandPlate key={`${pass}-${plate}`} kind={plate} />
            )),
          )}
        </div>
      </div>

      <div className="brand-badge" role="img" aria-label={markAlt}>
        <span className="brand-badge__mark" />
      </div>

      <Caption title={title} sub={sub} />
    </article>
  );
}

function BrandPlate({ kind }: { kind: PlateKind }) {
  return (
    <span className={`bplate bplate--${kind}`}>
      <PlateFace kind={kind} />
    </span>
  );
}

function PlateFace({ kind }: { kind: PlateKind }) {
  switch (kind) {
    /* ── upper row ─────────────────────────────────────────────────────── */
    case "type":
      return (
        <>
          <span className="bplate__aa">Aa</span>
          <span className="bplate__meta">Bricolage · Rounded</span>
        </>
      );
    case "palette":
      return (
        <span className="bplate__chips">
          <i className="bplate__chip bplate__chip--ink" />
          <i className="bplate__chip bplate__chip--cyan" />
          <i className="bplate__chip bplate__chip--paper" />
        </span>
      );
    case "mark":
      return <span className="bplate__mark" />;
    case "voice":
      return (
        <span className="bplate__lines">
          <i style={{ width: "88%" }} />
          <i style={{ width: "72%" }} />
          <i style={{ width: "80%" }} />
          <i style={{ width: "46%" }} />
        </span>
      );
    /* A layout page, not a clearspace page: clearspace put a third mark on the
       strip and the row read as one repeated sheet. Column rules carry a
       texture nothing else here has. */
    case "grid":
      return (
        <span className="bplate__grid">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      );
    case "swatch":
      return (
        <>
          <span className="bplate__swatch" />
          <span className="bplate__meta">#00E3FE</span>
        </>
      );

    /* ── lower row ─────────────────────────────────────────────────────── */
    case "logo":
      return (
        <>
          <span className="bplate__mark" />
          <span className="bplate__wordmark">Zirtuno</span>
        </>
      );
    case "spec":
      return (
        <span className="bplate__spec">
          <i>
            <b />
            <u style={{ width: "54%" }} />
          </i>
          <i>
            <b />
            <u style={{ width: "76%" }} />
          </i>
          <i>
            <b />
            <u style={{ width: "40%" }} />
          </i>
        </span>
      );
    /* The inverse of `mark`: the app icon, cyan ground with the glyph knocked
       out of it. The two are never on screen together — different rows. */
    case "icon":
      return <span className="bplate__icon" />;
    case "wordmark":
      return <span className="bplate__wordmark">Zirtuno</span>;
    case "motion":
      return (
        <span className="bplate__motion">
          <i />
          <i />
          <i />
        </span>
      );
    case "card":
      return (
        <span className="bplate__card">
          <b />
          <u />
        </span>
      );
  }
}

/* ── 02 · Web & Software ─────────────────────────────────────────────────────
   Three frames on one stage. The slot a frame holds — centre, right, left —
   is state, and the transform for each slot lives in the stylesheet, so the
   travel between them is one CSS transition rather than a JS-driven tween.
   That keeps the whole rotation off the main thread and lets reduced motion
   turn it off by simply never advancing. */

function CardBuild({ title, sub }: { title: string; sub: string }) {
  const t = useTranslations("studio.cards.build");
  const reduced = useReducedMotion();
  const { ref, live } = useOnScreen<HTMLElement>();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced || !live) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % SHOTS.length),
      SHOT_INTERVAL,
    );
    return () => window.clearInterval(id);
  }, [reduced, live]);

  return (
    <article ref={ref} className="studio-card studio-card--build">
      <div className="build-stage" aria-hidden="true">
        {SHOTS.map((shot, i) => {
          const slot = slotFor(
            (i - active + SHOTS.length) % SHOTS.length,
            SHOTS.length,
          );
          return (
            <figure
              key={shot.kind === "image" ? shot.src : shot.face}
              className={`build-shot ${slot}`}
            >
              <span className="build-shot__chrome">
                <i />
                <i />
                <i />
              </span>
              {shot.kind === "image" ? (
                <Image
                  className="build-shot__img"
                  src={shot.src}
                  alt={t(shot.altKey)}
                  width={1600}
                  height={900}
                  sizes="(max-width: 768px) 60vw, 25vw"
                  /* Six frames, three of them off stage and transparent: only
                     the centre one is ever worth blocking paint for. */
                  loading={i === 0 ? "eager" : "lazy"}
                />
              ) : (
                <UiVignette face={shot.face} />
              )}
            </figure>
          );
        })}
      </div>

      {/* The reference softens the frames into the card on all four sides: a
          left/right edge wash and a bottom fade that hands the stage over to
          the caption. Same job here, in this card's own light. */}
      <div className="build-edges" aria-hidden="true" />
      <div className="build-fade" aria-hidden="true" />

      <Caption title={title} sub={sub} />
    </article>
  );
}

/**
 * The three DRAWN surfaces — a product dashboard, a store, a launch page.
 *
 * Deliberately anonymous: no name, no logo, no metric, nothing that could be
 * read back as a client. They are here to show three shapes of interface work
 * at a glance, and they are drawn rather than photographed so they stay sharp
 * at every viewport and cost the page nothing to download.
 */
function UiVignette({ face }: { face: UiFace }) {
  if (face === "saas") {
    return (
      <span className="ui ui--saas">
        <span className="ui__rail">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="ui__body">
          <span className="ui__bar" />
          <span className="ui__chart">
            {[38, 62, 47, 78, 55, 92, 70].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </span>
          <span className="ui__rows">
            <i />
            <i />
            <i />
          </span>
        </span>
      </span>
    );
  }

  if (face === "shop") {
    return (
      <span className="ui ui--shop">
        <span className="ui__top">
          <i className="ui__brand" />
          <span className="ui__nav">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="ui__split">
          <span className="ui__hero" />
          <span className="ui__detail">
            <i className="ui__title" />
            <i className="ui__price" />
            <i className="ui__meta" />
            <span className="ui__buy" />
            <span className="ui__thumbs">
              <i />
              <i />
              <i />
            </span>
          </span>
        </span>
      </span>
    );
  }

  if (face === "editorial") {
    return (
      <span className="ui ui--editorial">
        <span className="ui__masthead">
          <i className="ui__brand" />
          <span className="ui__nav">
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="ui__lede">
          <i className="ui__kicker" />
          <i className="ui__headline" />
          <i className="ui__headline ui__headline--short" />
        </span>
        <span className="ui__columns">
          <span className="ui__col">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ui__plate" />
          <span className="ui__col">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
      </span>
    );
  }

  if (face === "portfolio") {
    return (
      <span className="ui ui--portfolio">
        <span className="ui__top">
          <i className="ui__brand" />
          <span className="ui__nav">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="ui__wordmark" />
        <span className="ui__grid">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  }

  if (face === "docs") {
    return (
      <span className="ui ui--docs">
        <span className="ui__side">
          <i className="ui__side-head" />
          <i />
          <i />
          <i className="is-on" />
          <i />
          <i />
        </span>
        <span className="ui__page">
          <i className="ui__title" />
          <i className="ui__line" />
          <i className="ui__line ui__line--short" />
          <span className="ui__code">
            <i />
            <i />
            <i />
          </span>
          <i className="ui__line" />
          <i className="ui__line ui__line--short" />
        </span>
      </span>
    );
  }

  return (
    <span className="ui ui--landing">
      <span className="ui__top">
        <i className="ui__brand" />
        <span className="ui__nav">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="ui__stage">
        <i className="ui__eyebrow" />
        <i className="ui__head" />
        <i className="ui__head ui__head--short" />
        <span className="ui__cta" />
      </span>
      <span className="ui__glow" />
    </span>
  );
}

/* ── 03 · IA, Automação & Dados ──────────────────────────────────────────────
   A fan of six tiles carrying the STACK — the platforms this domain is built
   on, and the studio's own agent standing in front of them. The reference fans
   the Adobe suite on its Motion card and it is the right move: a tool mark says
   in one glance what a paragraph of capability copy cannot.

   Two rules keep it honest. These are TOOLS, never clients and never work —
   the caption reads "agentes e painéis", and the work lives on the card beside
   it. And every mark keeps its OWN colour, unaltered: recolouring a trademark
   makes it both less recognisable and less correct, and recognisability is the
   whole reason the fan exists. Provenance, the colour decision and the swap
   procedure are in `public/brand/stack/README.md`. */

/**
 * Six tiles, ordered left to right along the arc.
 *
 * The COMPANION sits at slot d, one step right of the arc's midpoint, with the
 * top z-index and the only lit ground — the studio's own agent in front of the
 * toolkit it is built on, flanked by the two models it actually thinks with.
 * A six-tile arc has no true centre, so he leads by depth and by light rather
 * than by position; that is the same argument the centre tile made when the
 * fan was five, where the reference's arc GROWS outward and the middle tile is
 * the smallest one.
 *
 * `tint` is the tile's ground. Every brand tile is NEUTRAL near-black, not the
 * cyan-tinted glass the rest of the card uses: five brand palettes need
 * something quiet to sit on, and the one cyan ground left in the fan is the
 * companion's, which makes him the tile the eye finds first.
 *
 * Set by owner instruction (2026-09-10).
 */
const STACK = [
  { slot: "a", file: "figma", name: "Figma", tint: "brand" },
  { slot: "b", file: "blender", name: "Blender", tint: "brand" },
  { slot: "c", file: "openai", name: "OpenAI", tint: "brand" },
  { slot: "d", file: "avatar", name: "Zirtuno", tint: "self" },
  { slot: "e", file: "claude", name: "Claude", tint: "brand" },
  { slot: "f", file: "n8n", name: "n8n", tint: "brand" },
] as const;

/** The companion is ours and lives beside the site shots, not with the marks. */
function markSrc(file: string): string {
  return file === "avatar"
    ? "/studio/avatar.svg"
    : `/brand/stack/${file}.svg`;
}

function CardIntel({ title, sub }: { title: string; sub: string }) {
  return (
    <article className="studio-card studio-card--intel">
      <div className="fan">
        {STACK.map((tool) => (
          <span
            key={tool.file}
            className={`ftile ftile--${tool.slot} ftile--${tool.tint}`}
          >
            {/* The face carries the paint and the hover travel; the tile
                carries only the position and rotation. That split is what lets
                ONE hover rule lift all six along their own axes — a fanned
                card pulled forward — instead of six rules each having to
                restate its own translate and angle. */}
            <span className="ftile__face">
              <span
                className="ftile__logo"
                role="img"
                aria-label={tool.name}
                style={{
                  ["--stack-mark" as string]: `url("${markSrc(tool.file)}")`,
                }}
              />
            </span>
          </span>
        ))}
      </div>
      <Caption title={title} sub={sub} />
    </article>
  );
}
