"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Pre-rendered hero metaball morph loop (scripts/render-hero-film.mjs). This is
 * how the REAL glass animation reaches every device: a tiny looping video that
 * even integrated GPUs (Intel UHD) decode for free — no fullscreen raymarch, so
 * no freeze. On a capable GPU the live raymarch mounts on top of this and the
 * film fades out; here it is the animated base layer + the load/poster state.
 *
 * Pauses when it is not the visible layer (live glass took over) or off-screen.
 * Reduced motion → the static poster (the mark), no playback.
 */
export function HeroFilm({
  className,
  style,
  play = true,
}: {
  className?: string;
  style?: CSSProperties;
  play?: boolean;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    if (play) void v.play().catch(() => {});
    else v.pause();
  }, [play, reduced]);

  if (reduced) {
    return (
      <div
        className={cn("hero-film hero-film-poster", className)}
        style={style}
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      ref={ref}
      className={cn("hero-film", className)}
      style={style}
      loop
      muted
      playsInline
      preload="auto"
      poster="/hero/morph-poster.jpg"
      aria-hidden="true"
    >
      <source src="/hero/morph-loop.webm" type="video/webm" />
      <source src="/hero/morph-loop.mp4" type="video/mp4" />
    </video>
  );
}
