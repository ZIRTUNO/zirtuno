# Zirtuno Website

Business-first, visually distinctive website for Zirtuno, a Brazilian digital
studio building connected digital ecosystems across software, AI, automation,
data, branding, and marketing.

Primary language: PT-BR. Secondary language: EN.

## Source Of Truth

- `AGENTS.md` - project rules, taste constraints, build order, and non-negotiables.
- `build-spec.md` - full section-by-section product and design specification.
- `references.md` - shader, animation, design, and technical references.
- `lib/i18n/messages/pt.json` and `lib/i18n/messages/en.json` - shipped copy.

Old one-off audits and outdated planning notes should not live at the repo root.
Fold durable decisions into this README, `AGENTS.md`, or `build-spec.md`.

## Current Stack

- Next.js 16 App Router, TypeScript, Turbopack default
- Tailwind CSS v4 with CSS variables
- Three.js, React Three Fiber, Drei
- GSAP ScrollTrigger, Motion, Lenis
- next-intl, Sanity, react-hook-form, zod, Resend

## Project Layout

- `app/` - routes, layouts, API route, metadata, sitemap, robots, proxy target pages.
- `components/` - chapter UI, chrome, hero/WebGL, ecosystem, motion helpers.
- `lib/` - animation utilities, i18n, content, forms, Sanity, WebGL state/render helpers.
- `public/brand/` - deployed Zirtuno SVG assets used by the site.
- `scripts/` - screenshot and verification scripts for visual/WebGL iteration.
- `proxy.ts` - Next 16 proxy convention for locale routing.
- `MORPHS_Blender_Reference/` - ignored local Blender reference kept for the
  unresolved metaball form/morph redesign.

Ignored/generated folders such as `.next/`, `node_modules/`, `captures/`, and
`*.tsbuildinfo` are disposable. The screenshot scripts recreate `captures/`.

## Commands

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm run mesh:check
```

Useful visual iteration scripts:

```bash
npm run contact:sheet
npm run morphs:check
node scripts/capture-mesh.mjs
```

## Current State

- The site builds on Next.js 16.2.7 with Turbopack.
- **The FIELD system is the default hero** (R0 of `improvement-plan.md`, per
  `metaball-morph-spec.md` v1.2–v1.4): each form rests as its crisp SVG shaded
  as liquid glass (`SdfGlassField`) and melts between forms through the 48-ball
  metaball field (`FieldMorphHero`). Tiers come from a runtime probe
  (`lib/webgl/field-tier.ts` — full glass / flat-cyan lite / static-SVG none)
  with an FPS watchdog that downshifts instead of freezing. Hero QA params:
  `?fstate=N` · `?fpair=a-b-m` · `?fcycle=1` · `?fflat=1` · `?ftier=`.
- Intent CTAs on the homepage smooth-scroll to `#contact` via Lenis and set the
  intent with `history.replaceState` (no router navigation); cross-page CTAs
  keep the routed path. The labeled contact submit is canonical; the metaball
  exhale is decorative.
- The legacy raymarch (`MetaballScene`) and mesh (`MeshMetaballScene`) engines
  no longer mount in the hero but still back the other chapter visuals
  (fracture / ecosystem / services / origin / contact) until R1 replaces them
  with field drivers and deletes them.
- Portfolio seed projects are prototypes only. Do not add fabricated metrics.

## Open Decisions

- Portfolio: replace prototype projects with real projects and verified outcomes.
- Contact/footer: confirm WhatsApp URL, email, domain, and social handles.
- Studio: keep anonymous role grid or add portraits.
- Ecosystem center: confirm unified metaball core plus label remains the final call.
- Audio: default out for v1 unless explicitly scoped.

## Cleanup Policy

Keep only durable source, specs, references, scripts, and shipped assets in the
repo. Delete generated captures and local experiment outputs after they have been
reviewed. If a visual insight matters, summarize it in this README, `build-spec.md`,
or `AGENTS.md` rather than keeping dated audit files.
