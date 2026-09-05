# 0003 — Retire the slide-and-scale page transition for THE VEIL

- **Status:** accepted
- **Date:** 2026-09-05
- **Supersedes:** `components/motion/PageTransition.tsx` (S1.9), and the flat
  cyan `.page-wipe` that preceded it

## Context

The route transition was a port of a GSAP + React Router reference
(stackblitz `react-6rzfpp`): the incoming page was set to
`{autoAlpha: 0, scale: .8, xPercent: -100}` and tweened in, the outgoing page
was tweened to `scale: .8` and then off to `xPercent: 100`. It worked, and the
port was faithful.

Its problem was structural rather than aesthetic. The reference animates three
viewport-sized demo routes; this site's homepage runs to roughly 27 000 px and
the page wrapper contains the site's own fixed chrome. **A standing transform
re-parents every `position: fixed` descendant of the element it is on**
(AGENTS.md §7), and a transform on a 27 000 px element scales about a point
thirteen thousand pixels off screen. Making the reference survive that took
five separate compensations, every one of them written after the corresponding
bug shipped:

1. a `transform-origin` recomputed per run to the middle of the viewport,
   because scaling about the element's own centre threw the visible content
   clean out of the viewport from a scrolled position (a black screen with a
   perfectly healthy `opacity: 1`);
2. a `clearProps` on arrival, because a lingering transform made the chapter
   rail measure the DOCUMENT's height and lay every mark out below the fold;
3. `overflow-x: clip` on the root, because a ±100% slide is real overflow, the
   document grows, and the fixed top bar inflates to match;
4. a `ScrollTrigger.refresh()` after every enter, because reveals mounted
   against an ancestor that was translated a viewport and scaled to 0.8;
5. `visibility: hidden` on `.cine-veils`, because a `position: fixed; inset: 0`
   layer inside the wrapper stops being full-viewport at `scale(0.8)` and its
   edge becomes a visible rectangle.

Five workarounds, one root cause: the transition was moving the page.

## Decision

The route transition is now **THE VEIL** — a curtain painted OVER the page,
which never transforms it.

It is ported from GSAP's Dynamic Morphing demo
(`demos.gsap.com/demo/dynamic-morphing` → CodePen `GreenSock/qBedXpg`, itself a
fork of Blake Bowen's `osublake/BYwgBg` "SVG Shape Overlays"): a fixed
`0 0 100 100` SVG with `preserveAspectRatio="none"`, whose columns each climb
from the bottom edge to the top on their own delay while a smooth polybezier is
rebuilt through them every frame.

| | |
| --- | --- |
| geometry | `lib/motion/veil.mjs` — DOM-free, seeded, deterministic |
| types | `lib/motion/veil.d.mts` |
| runtime | `components/motion/PageVeil.tsx` — mounted once in the locale layout |
| routing | `lib/animation/transition-context.tsx` |
| paint | the `.page-veil` block at the foot of `app/globals.css` |
| gates | `npm run veil` (node) · `npm run veil:sheet` (live) |

Three things are ours rather than the reference's, and each one is a
requirement the demo does not have:

- **A third, opaque sheet.** The reference's two translucent overlays decorate a
  page that never leaves. Ours has to hide a route swap, so the sheet that
  arrives last is fully opaque and is the only one with a contract. The other
  two could fail to paint and the transition would still be correct.
- **A seeded delay stream.** `Math.random()` cannot be reviewed twice, captured
  twice, or regression-tested. `?fveil=<n>` reproduces one exact wave.
- **The cover path starts on its first column.** The reference opens
  `M 0 0 V y₀ C …`; that prefix encloses no area, but it pins the path's
  bounding box to the top of the viewport, which turns an `objectBoundingBox`
  gradient into a screen-fixed one. See the note in `veil.mjs`.

### What this buys, beyond the paint

- Every one of the five compensations above is deleted rather than ported.
- The route now commits behind an opaque screen instead of behind a page that
  is still visible at `scale(0.8)`, so a slow route reads as a held beat rather
  than as a stutter.
- `template.tsx` renders no wrapper at all. It remounts — the one signal the
  App Router gives that a navigation committed — and hands that to the
  provider.

### What is knowingly given up

A back/forward arrives with the page already changed, so there is nothing to
cover for and covering would hide what the visitor came back to see. Those get
the **wash**: the crest sheet alone crossing the viewport, hiding nothing. It
is the same current and the same light, and it is not the same transition as a
link click. That is a deliberate asymmetry, not an oversight.

## Consequences

- Removed from the application tree, per [0001](0001-dead-code-quarantine.md) —
  git history is the recovery path, not a folder:
  - `components/motion/PageTransition.tsx`
  - the `html[data-page-transition]` rules in `globals.css` (all three)
  - `.page-wipe` in `globals.css` — already orphaned. It belonged to the
    transition *before* the slide-and-scale and no component had rendered it
    for some time; `scripts/verify/a11y.mjs` was still asserting on it and now
    asserts on `.page-veil` instead.
  - `completed` / `toggleCompleted` on the transition context — the reference's
    "enter has finished" flag, which never acquired a consumer here.
  - `ExitRunner` / `registerExit`, replaced by `VeilRunner` / `registerVeil`.
- `PageVeil` is mounted in `app/[locale]/layout.tsx`, NOT in `template.tsx`. A
  curtain that unmounts halfway through the navigation it is covering is not a
  curtain.
- The veil sits at `z-index: 1100` — above the nav sheet and the bar and burger
  that morph over it (1000/1001/1002), below the cursor (9999).
- Reduced motion renders no veil element at all and the provider stops
  intercepting clicks, so `<Link>` routes exactly as it always has. Forced
  colours and no-JS get the same hard cut.

## See also

[0001 — Retire the dead-code quarantine folder](0001-dead-code-quarantine.md) ·
[0002 — Repository layout](0002-repository-layout.md)
