import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The real Zirtuno mark (public/brand/zirtuno-logo-mark.svg) rendered as a
 * background image — cyan is baked into the asset. Server-safe and decorative
 * by default. Used as the metaball's reduced-motion / no-WebGL / pre-paint
 * fallback (it IS the exact target image) and as the static mark in S8 Beat 2.
 */
export function LogoMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={cn("logo-mark", className)} style={style} aria-hidden="true" />;
}
