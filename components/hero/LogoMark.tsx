import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Variant = "unified" | "fractured";

/**
 * The real Zirtuno mark (public/brand/zirtuno-logo-mark.svg) — cyan baked into
 * the asset, server-safe, decorative by default. It IS the exact target image,
 * so it doubles as every metaball's reduced-motion / no-WebGL / no-GPU / pre-
 * paint fallback and the static mark in S8 Beat 2.
 *
 *   - "unified"   → the whole connected mark (hero · ecosystem · services · contact).
 *   - "fractured" → the same mark split into displaced glass shards, reading as
 *     clearly "disconnected" for The Problem (S3) and the 404. Pure CSS clip-path,
 *     so the no-glass path still shows the high-fidelity brand form, not a blob.
 *
 * Pass `ariaLabel` to expose an accessible name; omit it when a parent already
 * labels the region (then the mark is purely decorative).
 */
export function LogoMark({
  className,
  style,
  variant = "unified",
  ariaLabel,
}: {
  className?: string;
  style?: CSSProperties;
  variant?: Variant;
  ariaLabel?: string;
}) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  if (variant === "fractured") {
    return (
      <div className={cn("logo-mark-fractured", className)} style={style} {...a11y}>
        <span className="logo-shard logo-shard-1" />
        <span className="logo-shard logo-shard-2" />
        <span className="logo-shard logo-shard-3" />
      </div>
    );
  }

  return <div className={cn("logo-mark", className)} style={style} {...a11y} />;
}
