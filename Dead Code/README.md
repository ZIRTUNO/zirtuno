# Dead Code quarantine

This folder preserves code removed from the active Zirtuno application. Files
here are intentionally excluded from TypeScript, ESLint, Next.js routing, and
deployment. Nothing in the active app may import from `Dead Code/`.

## 2026-09-03 secondary CTA removal

- `components/chrome/Thread.tsx` — the animated underline used only by the
  removed text-and-arrow secondary CTA family. Its `makeThread` kernel and
  declarations were removed from `lib/motion/membrane.mjs` and
  `lib/motion/membrane.d.mts`; restore all three parts together if this visual
  family is ever deliberately reintroduced.

## 2026-08-31 full audit

Evidence used before quarantine:

- a static import/re-export/dynamic-import reachability graph rooted at every
  Next.js route and application entry point;
- package-script and specification references for standalone tools;
- explicit replacement notes in the source; and
- pre-cleanup TypeScript, dependency, selector, and package-usage checks.

### Runtime modules

- `components/chapters/ProjectCard.tsx` and `ProjectCard.css` — replaced by the
  live `components/work/WorkGallery.tsx` `.zw-*` gallery.
- `components/hero/MetaballCanvas.tsx`, `MetaballField.tsx`,
  `SdfGlassField.tsx`, `PerfOverlay.tsx`, `PillarIndicator.tsx`, and
  `legacy-hero-shell.css` — the former hero shell was no longer mounted after
  the cinematic ribbon became the live Hero.
- `components/field/hero-liquid-context.ts` — its only consumer was the removed
  hero shell; the provider and unused scene controls were removed together.
- `lib/webgl/scenes/stream.ts` — an unregistered experimental conductor scene;
  production uses `HeroRibbon`.
- `lib/sanity/schema.ts` — a future Studio schema with no Sanity Studio config
  or active import. Runtime content queries and types remain active.

The exact form renderer was not discarded. It moved from
`components/hero/FieldMorphHero.tsx` to the active
`components/lab/FormStillRenderer.tsx` and is mounted only at the no-index
`/[locale]/lab/forms` QA route.

### Obsolete verification and capture tools

- `capture-morph-frames.mjs` — self-declared dead homepage morph harness;
  `capture-morph-scrub.mjs` now captures the live Services morph.
- `capture-field-live.mjs`, `verify-autocycle.mjs`, and `verify-live.mjs` —
  depended on the removed interactive metaball hero shell.
- `capture-converge.mjs` and `capture-eco-pulse.mjs` — described the retired
  mark-convergence/HUD presentation; the confluence and gathering gates replace
  them.
- `verify-baseline.mjs` — measured a retired raymarch-era performance premise.
- `verify-responsive.mjs` — superseded by the R5-E `verify-devices.mjs` matrix.
- `verify-site.mjs` — asserted retired hero and organism selectors.

### One-off scratch diagnostics

Unreferenced `_cmp-*`, `_film-*`, `_mark-*`, `_probe-*`, `_ref-*`, `_ring-*`,
`_sheet-*`, `_shot-*`, `_spray-*`, `_strip*`, and `_sweep-*` files were moved to
`scripts/scratch/`. Named production gates, generators, reusable capture tools,
and helper modules with incoming imports remain active.

## Restore procedure

1. Move the required file back to its original active path.
2. Reconnect imports, package scripts, selectors, or route registration.
3. Remove or update its entry above.
4. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and every mapped
   feature gate before treating the code as active again.
