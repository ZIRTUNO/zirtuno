"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/config";
import { getLenis } from "@/lib/animation/lenis-store";
import { Membrane } from "@/components/chrome/Membrane";
import { cn } from "@/lib/utils";

// build-spec S1.15 — the load-bearing CTA system.
export type CtaIntent = "analysis" | "structure" | "talk" | "careers";

type CtaButtonProps = {
  /** Routes to the contact form carrying this entry-intent tag (S1.15). */
  intent?: CtaIntent;
  /** Explicit destination (locale-relative), e.g. "/work" or "/work?category=ai". */
  href?: string;
  /**
   * i18n key under the `cta` namespace.
   *
   * `talkShort` is the same INTENT as `talk` with a compact label, for chrome
   * that cannot spend the width — the top bar's chip is sized off the bar and a
   * fifteen-character uppercase mono label made it 1.64x the reference button
   * it is drawn from. Callers pass `intent="talk"` alongside it, so the
   * placement map in build-spec §7.2 and the conversion tagging are unchanged.
   */
  labelKey?: "analysis" | "structure" | "talk" | "talkShort";
  /** Literal label override (skips i18n). */
  label?: string;
  /** Privacy-safe source label for conversion attribution. */
  placement?: string;
  className?: string;
};

/**
 * The intent CTA's BEHAVIOUR, lifted out of its skin.
 *
 * `CtaButton` is a MEMBRANE button: a sharp engineered rectangle whose vector
 * outline traces its own CSS box (see `Membrane`). The mobile nav sheet's third
 * card needs the same destination, the same `?intent=` handshake with the
 * contact form and the same conversion tagging on an element that is a rounded
 * 8vw slab — geometry the membrane cannot follow without the drawn outline
 * drifting off the box it is drawing. So the card gets its own skin and takes
 * the behaviour from here; copying the same-page scroll dance into a second
 * component is how two conversion paths quietly stop agreeing.
 */
export function useCtaIntent({
  intent,
  href,
  placement,
}: {
  intent?: CtaIntent;
  href?: string;
  placement?: string;
}) {
  const pathname = usePathname(); // locale-stripped ("/" on the homepage)
  const destination = href ?? (intent ? `/?intent=${intent}#contact` : "/");

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!intent || href || pathname !== "/") return; // routed path
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    const target = document.getElementById("contact");
    if (!target) return; // fall through to the routed navigation
    e.preventDefault();
    window.history.replaceState(null, "", `?intent=${intent}#contact`);
    window.dispatchEvent(
      new CustomEvent("zirtuno:intent", { detail: { intent } }),
    );
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(target, {
        offset: 0,
        onComplete: () => {
          // late-streamed sections can grow the layout mid-scroll, leaving the
          // landing short — correct once against the element's final position
          if (Math.abs(target.getBoundingClientRect().top) > 4)
            lenis.scrollTo(target, { offset: 0 });
        },
      });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return {
    href: destination,
    onClick,
    analytics: {
      "data-analytics-event": intent ? "cta_intent" : "cta_navigation",
      "data-analytics-intent": intent,
      "data-analytics-placement": placement ?? pathname,
    } as const,
  };
}

/**
 * Every intent CTA reaches the contact form with its tag pre-filled via the
 * `intent` query param (read by the contact form in S10). Conversion-path
 * test in S19 verifies this for every placement.
 *
 * Same-page path (R0): on the homepage an intent CTA does NOT route — it sets
 * the intent via history.replaceState (Next syncs useSearchParams, so the
 * ContactForm picks it up) and smooth-scrolls to #contact through Lenis.
 * Cross-page CTAs (e.g. from /work) keep the routed href. Modifier/middle
 * clicks always fall through to the link (new tab keeps working).
 */
export function CtaButton({
  intent,
  href,
  labelKey,
  label,
  placement,
  className,
}: CtaButtonProps) {
  const t = useTranslations("cta");
  const text = label ?? (labelKey ? t(labelKey) : "");
  const { href: destination, onClick, analytics } = useCtaIntent({
    intent,
    href,
    placement,
  });

  return (
    <Link
      href={destination}
      data-cursor="hover"
      {...analytics}
      onClick={onClick}
      className={cn("cta cta-primary", className)}
    >
      {/* The CSS sweep stays as the no-JS / reduced-motion state. The
          membrane hides it when it mounts (see globals.css). */}
      <span className="cta-fill" aria-hidden="true" />
      <Membrane filled />
      {/* The ink copy of the label, clipped to the flood front so the
          words flip along a curved liquid edge. Hidden from the a11y tree
          and from selection — the real label is the sibling above. */}
      <span className="cta-label cta-label-ink" aria-hidden="true">
        {text}
      </span>
      <span className="cta-label">{text}</span>
    </Link>
  );
}

// ── Canonical primary CTAs (placement map, S1.15). ──

export function CtaAnalysis({
  placement,
  className,
}: {
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      intent="analysis"
      labelKey="analysis"
      placement={placement}
      className={className}
    />
  );
}

export function CtaStructure({
  placement,
  className,
}: {
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      intent="structure"
      labelKey="structure"
      placement={placement}
      className={className}
    />
  );
}

export function CtaTalk({
  placement,
  className,
}: {
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      intent="talk"
      labelKey="talk"
      placement={placement}
      className={className}
    />
  );
}
