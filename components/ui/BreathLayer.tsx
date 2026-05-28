/**
 * Breath layer (S1.7) — a near-subliminal fractal-noise field (≤4% opacity)
 * that breathes over ~8s. Atmosphere, not decoration you should notice.
 * pointer-events:none so it never blocks interaction; static under reduced
 * motion (the global media query neutralizes the animation).
 */
export function BreathLayer() {
  return <div className="breath-layer" aria-hidden="true" />;
}
