"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether a ref'd element is in (or near) the viewport. Used to pause
 * heavy WebGL canvases when off-screen and to trigger one-shot reveals.
 */
export function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false); // latches true once first in view (lazy-mount)

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, inView, seen] as const;
}
