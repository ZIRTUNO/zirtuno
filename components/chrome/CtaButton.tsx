import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
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
  className?: string;
};

/**
 * Every intent CTA reaches the contact form with its tag pre-filled via the
 * `intent` query param (read by the contact form in S10). Conversion-path
 * test in S19 verifies this for every placement.
 */
export function CtaButton({
  variant = "primary",
  intent,
  href,
  labelKey,
  label,
  className,
}: CtaButtonProps) {
  const t = useTranslations("cta");
  const text = label ?? (labelKey ? t(labelKey) : "");
  const destination = href ?? (intent ? `/?intent=${intent}#contact` : "/");
  const showArrow = variant !== "primary";

  return (
    <Link
      href={destination}
      data-cursor="hover"
      className={cn(VARIANT_CLASS[variant], className)}
    >
      {variant === "primary" && <span className="cta-fill" aria-hidden="true" />}
      <span className="cta-label">{text}</span>
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
  className,
}: {
  variant?: CtaVariant;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="analysis"
      labelKey="analysis"
      className={className}
    />
  );
}

export function CtaPortfolio({
  variant = "secondary",
  href = "/work",
  className,
}: {
  variant?: CtaVariant;
  href?: string;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      href={href}
      labelKey="portfolio"
      className={className}
    />
  );
}

export function CtaStructure({
  variant = "primary",
  className,
}: {
  variant?: CtaVariant;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="structure"
      labelKey="structure"
      className={className}
    />
  );
}

export function CtaTalk({
  variant = "primary",
  className,
}: {
  variant?: CtaVariant;
  className?: string;
}) {
  return (
    <CtaButton
      variant={variant}
      intent="talk"
      labelKey="talk"
      className={className}
    />
  );
}
