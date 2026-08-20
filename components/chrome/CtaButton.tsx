"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/config";
import { getLenis } from "@/lib/animation/lenis-store";
import { Membrane } from "@/components/chrome/Membrane";
import { Thread } from "@/components/chrome/Thread";
import { cn } from "@/lib/utils";

// build-spec S1.15 — the load-bearing CTA system.
export type CtaVariant = "primary" | "secondary" | "ghost";
export type CtaIntent = "analysis" | "structure" | "talk";

const VARIANT_CLASS: Record<CtaVariant, string> = {
  primary: "cta cta-primary",
  secondary: "cta cta-secondary",
  ghost: "cta cta-ghost",
};

type CtaButtonProps = {
  variant?: CtaVariant;
  /** Routes to the contact form carrying this entry-intent tag (S1.15). */
  intent?: CtaIntent;
  /** Explicit destination (locale-relative), e.g. "/work" or "/work?category=ai". */
  href?: string;
  /** i18n key under the `cta` namespace. */
  labelKey?: "analysis" | "portfolio" | "structure" | "talk";
  /** Literal label override (skips i18n). */
  label?: string;
  /** Privacy-safe source label for conversion attribution. */
  placement?: string;
  className?: string;
};

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
  variant = "primary",
  intent,
  href,
  labelKey,
  label,
  placement,
  className,
}: CtaButtonProps) {
  const t = useTranslations("cta");
  const pathname = usePathname(); // locale-stripped ("/" on the homepage)
  const text = label ?? (labelKey ? t(labelKey) : "");
  const destination = href ?? (intent ? `/?intent=${intent}#contact` : "/");
  const showArrow = variant !== "primary";

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

  return (
    <Link
      href={destination}
      data-cursor="hover"
      data-analytics-event={intent ? "cta_intent" : "cta_navigation"}
      data-analytics-intent={intent}
      data-analytics-placement={placement ?? pathname}
      onClick={onClick}
      className={cn(VARIANT_CLASS[variant], className)}
    >
      {variant === "primary" && (
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
        </>
      )}
      <span className="cta-label">{text}</span>
      {variant === "secondary" && <Thread />}
      {showArrow && (
        <span className="cta-arrow" aria-hidden="true">
          →
        </span>
      )}
    </Link>
  );
}

// ── Canonical preset CTAs (placement map, S1.15). Variant overridable. ──

export function CtaAnalysis({
  variant = "primary",
  placement,
  className,
}: {
  variant?: CtaVariant;
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="analysis"
      labelKey="analysis"
      placement={placement}
      className={className}
    />
  );
}

export function CtaPortfolio({
  variant = "secondary",
  href = "/work",
  placement,
  className,
}: {
  variant?: CtaVariant;
  href?: string;
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      href={href}
      labelKey="portfolio"
      placement={placement}
      className={className}
    />
  );
}

export function CtaStructure({
  variant = "primary",
  placement,
  className,
}: {
  variant?: CtaVariant;
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="structure"
      labelKey="structure"
      placement={placement}
      className={className}
    />
  );
}

export function CtaTalk({
  variant = "primary",
  placement,
  className,
}: {
  variant?: CtaVariant;
  placement?: string;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="talk"
      labelKey="talk"
      placement={placement}
      className={className}
    />
  );
}
