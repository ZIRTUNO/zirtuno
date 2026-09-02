# 0001 — Retire the dead-code quarantine folder

- **Status:** accepted
- **Date:** 2026-09-02
- **Supersedes:** the `Dead Code/` folder introduced by the 2026-08-31 audit

## Context

The 2026-08-31 reachability audit removed a set of modules from the active
application and moved them into a root-level `Dead Code/` folder rather than
deleting them. The folder was excluded from TypeScript, ESLint, Next.js routing,
and deployment, and carried a README explaining each removal.

That was the right call at the time: the audit was large, and keeping the files
on disk made a mistaken removal cheap to undo.

It does not survive contact with a published repository. The folder duplicates
content that git already stores, and a tracked second copy invites the two to
drift — someone edits the quarantined file, and the "recovery path" now restores
something that was never shipped.

## Decision

The quarantined modules are gone from the application tree, and `/Dead Code/` is
git-ignored rather than tracked. Git history is the recovery path.

The folder may still exist on a given machine as a local convenience; it is
simply not part of the repository, so it cannot drift into a published state or
be mistaken for shipped source.

The audit's *reasoning* is the part worth keeping, so it is recorded below
rather than in a folder README.

## What was removed, and why

Evidence used before removal: a static import, re-export, and dynamic-import
reachability graph rooted at every Next.js route and application entry point;
package-script and specification references for standalone tools; explicit
replacement notes in the source; and a clean typecheck, lint, and build
afterwards.

### Runtime modules

| Module | Replaced by |
| --- | --- |
| `components/chapters/ProjectCard.tsx` (+ `.css`) | the `.zw-*` gallery in `components/work/WorkGallery.tsx` |
| `components/hero/MetaballCanvas.tsx`, `MetaballField.tsx`, `SdfGlassField.tsx`, `PerfOverlay.tsx`, `PillarIndicator.tsx`, `legacy-hero-shell.css` | the cinematic ribbon, which became the live Hero and left the shell unmounted |
| `components/field/hero-liquid-context.ts` | nothing — its only consumer was the removed shell |
| `lib/webgl/scenes/stream.ts` | `HeroRibbon`; the scene was never registered with the conductor |
| `lib/sanity/schema.ts` | nothing yet — a Studio schema with no Studio config and no importer. Runtime content queries and types remain active |

The exact form renderer was **not** discarded. It moved from
`components/hero/FieldMorphHero.tsx` to `components/lab/FormStillRenderer.tsx`
and mounts only at the no-index `/[locale]/lab/forms` QA route.

### Verification and capture tools

| Tool | Reason |
| --- | --- |
| `capture-field-live`, `verify-autocycle`, `verify-live` | drove the retired interactive hero shell |
| `capture-converge`, `capture-eco-pulse` | described the mark-convergence presentation the Confluence replaced |
| `capture-morph-frames` | a self-declared dead harness; `capture/morph-scrub.mjs` captures the live Services morph |
| `verify-baseline` | measured a raymarch-era performance premise that no longer holds |
| `verify-responsive` | superseded by the `verify/devices.mjs` matrix |
| `verify-site` | asserted retired hero and organism selectors |

Unreferenced one-off `_cmp-*`, `_film-*`, `_ref-*`, `_ring-*`, `_sheet-*`,
`_shot-*`, `_spray-*`, `_strip`, and `_sweep-*` diagnostics from finished
investigations were removed at the same time.

## Consequences

- Recovering a module means `git log --diff-filter=D --name-only` and a checkout
  from the commit before its removal, not a file move.
- The `Dead Code` entries in `tsconfig.json` and `eslint.config.mjs` are kept.
  They cost nothing and keep a local restore from being typechecked or linted
  by accident.
- Anything genuinely worth keeping should be a real module with a real consumer,
  or a documented decision here. A quarantine folder is neither.

## See also

[0002 — Repository layout](0002-repository-layout.md)
