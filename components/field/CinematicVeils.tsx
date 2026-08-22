/**
 * CinematicVeils (R5-D) — the page-light layer of the cinematic cut (§10.3).
 *
 * Two fixed, pointer-transparent sheets driven ONLY by the conductor's
 * merged light score, which PageStage writes as CSS vars once per frame:
 *
 *   --cine-veil   black exposure veil — the two act-boundary fades
 *                 (Método → Work, Origin → Studio), scroll-scrubbed
 *   --cine-vig    vignette — quiet framing through Problem and the Soul act
 *
 * Both default to 0 = fully transparent. The component mounts only on
 * the live cinematic path: never under reduced motion, static tiers, hero QA
 * stills, or `?fcine=0` — so every deterministic surface renders without it.
 *
 * Responsibility split (spec §10.3): the post chain grades the LIQUID; these
 * veils grade the PAGE. z-20 sits above chapter copy (z-10) and below all
 * chrome (side index 40, nav 50) — an act fade dims the story, never the
 * controls.
 */
export function CinematicVeils() {
  return (
    <div className="cine-veils" aria-hidden="true">
      <div className="cine-veil" />
      <div className="cine-vignette" />
    </div>
  );
}
