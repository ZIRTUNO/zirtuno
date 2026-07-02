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
- Raw WebGL2 + OGL (the unified liquid field — one engine for every visual)
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
```

Visual QA harnesses (dev server must be running; `LOCALE=pt` for the PT pass):

```bash
npm run forms:rest      # rest exactness sheet (every form vs its reference SVG)
npm run forms:melts     # §3.3 bridge mid-frames + melt fps + keyboard smoke
npm run forms:cursor    # cursor goo sheet (bulge → neck → merge)
npm run chapters:sheet  # S3/S4/S5/S8/S10 × ftier full/lite/none
npm run endpoints       # re-pack the 48-droplet morph endpoints from the SVGs
```

## Current State

- The site builds on Next.js 16.2.7 with Turbopack.
- **The hero is the owner's EXACT vector forms as living liquid glass, with a
  gooey cursor** (`metaball-morph-spec.md` v1.7, default since R0): one unified
  field (`FieldMorphHero` + `sdf-glass-shader.mjs`) sums each form's
  signed-distance field with metaball droplets before a shared iso-surface,
  through the locked glass shading. At rest the form is pixel-exact by
  construction (`captures/rest-forms-sheet.png`) and alive (domain warp,
  breath); the react-bits-style cursor droplet chain necks into and merges
  with the liquid (`captures/cursor-merge-sheet.png`) — bounded influence,
  detaches cleanly, off on touch. Melts are the v1.2 ball-bridge: the form
  granulates into 48 traveling droplets (min-travel matching, stagger,
  radius-leads) that fuse into the next exact form — one iso-surface, no
  crossfade (`captures/morph-frames-sheet.png`). Tiers come from a runtime
  probe (`lib/webgl/field-tier.ts`) with an FPS watchdog that downshifts
  instead of freezing; reduced motion gets the static mark, no cursor. Hero QA
  params: `?fstate=N` · `?fpair=a-b-m` · `?fcursor=x,y` · `?fcycle=1` ·
  `?fflat=1` · `?ftier=`.
- Intent CTAs on the homepage smooth-scroll to `#contact` via Lenis and set the
  intent with `history.replaceState` (no router navigation); cross-page CTAs
  keep the routed path. The labeled contact submit is canonical; the metaball
  exhale is decorative.
- **One engine everywhere (R1 done):** every chapter visual is a driver on the
  same unified field (`components/field/FieldStage` + `lib/webgl/field-drivers`).
  Tiered by the field probe: full = glass, lite = flat cyan at dpr 1 (mobile
  gets LIVE liquid), none = static SVG. The legacy raymarch/mesh engines, their
  gating (`gpu-tier`, `can-run-glass`, `?glass=`) and their capture scripts are
  DELETED (three.js/@react-three removed); sheets:
  `captures/chapters-sheet-{en,pt}.png`.
- **S3 + S4 are full-bleed liquid stages (the remake):** The Problem is a
  FRACTURE FIELD — a sticky full-viewport layer where the mark (offset right)
  breaks one notch per symptom while its grey fragments drift across the whole
  field; the symptoms float as offset shards (`FractureField` +
  `ChapterProblem`). The Ecosystem is the ORGANISM — a pinned full-viewport
  converge that resolves into the breathing mark, whose droplets then become
  liquid TENDRILS pulsing outward to ten irregularly-orbiting capability
  labels (`OrganismField`; the SVG spoke diagram is deleted; mobile keeps the
  vertical stack). QA: `?feco=c` freezes the S4 choreography
  (`captures/converge-sheet.png`, `remake-s3-*.png`, `remake-s4-organism.png`).
  The unified shader gained form-domain staging (aspect-normalised uv,
  `iFormOff`, `iFormScale`) — identical output on square stages.
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
