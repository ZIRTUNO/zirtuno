"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/config";
import { Membrane } from "@/components/chrome/Membrane";
import { cn } from "@/lib/utils";

// build-spec S1.15 — the load-bearing CTA system.
export type CtaIntent = "analysis" | "structure" | "talk" | "careers";

/**
 * Does an intent CTA have somewhere to land?
 *
 * YES, since 2026-09-05: `/contact` (`app/[locale]/contact/page.tsx`).
 *
 * S10 was quarantined on 2026-09-04 and this flag went false, which rendered
 * all nine intent placements as inert `aria-disabled` buttons at once. The
 * replacement destination is now a ROUTE rather than a homepage anchor, so the
 * flag is back on and every placement re-armed together — which was the whole
 * reason it existed: nine CTAs turned off one by one would have come back on
 * one by one, and one of them would have been missed.
 *
 * It stays as a switch rather than being deleted. It is the kill switch for
 * the entire conversion path, and the one thing worth being able to do in a
 * single edit if the endpoint ever has to come down again.
 */
const INTENT_DESTINATION_READY = true;

/** Where an intent CTA lands. Locale-relative — `Link` adds the prefix. */
const INTENT_DESTINATION = "/contact";

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
 * contact form, the same held-back `pending` state and the same conversion
 * tagging on an element that is a rounded
 * 8vw slab — geometry the membrane cannot follow without the drawn outline
 * drifting off the box it is drawing. So the card gets its own skin and takes
 * the behaviour from here; a second copy of the destination and the tagging is
 * how two conversion paths quietly stop agreeing about where they go.
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
  // An explicit `href` is never part of the contact handshake ("/work" and
  // friends still route normally); only the intent path is held back.
  const pending = !href && !!intent && !INTENT_DESTINATION_READY;
  const destination =
    href ?? (intent ? `${INTENT_DESTINATION}?intent=${intent}` : "/");

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (pending) e.preventDefault();
  };

  return {
    href: destination,
    pending,
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
 * `intent` query param, which `/contact` reads on the SERVER and turns into a
 * pre-selected chip in a visible chooser. Conversion-path test in S19 verified
 * the handshake for every placement.
 *
 * THE SAME-PAGE PATH IS GONE, and it is gone rather than disabled. While
 * contact was the homepage's last chapter, an intent CTA pressed ON the
 * homepage did not route: it rewrote the query with `history.replaceState`,
 * announced the change on a custom event the mounted form listened for, and
 * smooth-scrolled to `#contact` through Lenis — with a second corrective
 * scroll because late-streamed sections could grow the layout mid-flight.
 * Every line of that existed to avoid a navigation that is now the correct
 * behaviour: `#contact` is not on the homepage any more, so the branch could
 * only ever fall through to the routed href it was written to avoid. Keeping
 * it would have meant maintaining a Lenis dependency, a custom event and a
 * layout-growth workaround for a code path with no way to execute.
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
  const { href: destination, pending, onClick, analytics } = useCtaIntent({
    intent,
    href,
    placement,
  });

  // The skin is identical in both states on purpose: an intent CTA waiting on
  // its destination is UNFINISHED, not disabled, and dressing it as disabled
  // would claim a permanence the flag above does not have.
  const skin = (
    <>
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
    </>
  );

  // No destination → no link. A `<Link>` whose href cannot be honoured still
  // offers "open in new tab" and still announces as a link; a button that
  // reports itself unavailable tells the truth to the pointer, the keyboard
  // and the screen reader at once. `aria-disabled` rather than `disabled`
  // keeps it focusable and keeps `.cta:disabled`'s grey-out off it.
  if (pending) {
    return (
      <button
        type="button"
        aria-disabled="true"
        data-cta-pending=""
        data-cursor="hover"
        {...analytics}
        className={cn("cta cta-primary", className)}
      >
        {skin}
      </button>
    );
  }

  return (
    <Link
      href={destination}
      data-cursor="hover"
      {...analytics}
      onClick={onClick}
      className={cn("cta cta-primary", className)}
    >
      {skin}
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
