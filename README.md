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
- **THE WHOLE PAGE IS ONE LIQUID (R5-A, the conductor):** every chapter visual
  renders on a single persistent page-wide canvas —
  `components/field/PageStage` (one sticky layer, one rAF measurement loop)
  conducting four SCENES (`lib/webgl/scenes/{site,method,origin,contact}`)
  through `lib/webgl/conductor.mjs`. The conductor owns everything between
  scenes: per-channel damping (the PHYS taus), presence weighting, per-droplet
  target blending across handoffs, the form-slot ARBITER (the shader's two
  form slots NEVER crossfade — ownership transfers only through droplet-only
  states, machine-checked by `scripts/verify-conductor.mjs`), the shared
  12-droplet ambient family, integration (per-droplet TAUP inertia — Phase B
  replaces this block with real physics) and the light-score merge (Phase D).
  The 48 droplets keep ONE identity from the hero's resting mark to the
  contact form; scene handoffs complete off-screen (presence curves + entry/
  exit envelopes author invisibility that canvas mounting used to imply). The
  pure kernel (CLOUDS, PHYS, TAUP, scatter/orbital vocabulary) lives in
  `lib/webgl/phys.mjs` — node-runnable, the sdf-core convention — and
  `lib/webgl/field-drivers.ts` keeps the §3.3 melt implementation + the
  FieldStage contract + the 404's `makeLoneDropDriver`. The 8 chapter
  hairlines are gone (separation = liquid + spacing); the Footer renders
  inside the page (the liquid reaches the true bottom). Colour is brand cyan
  EVERYWHERE; the FPS watchdog only ever lowers resolution: the liquid never
  freezes. QA: `?feco=c` freezes the S4 choreography; hero stills
  (`?fstate`/`?fpair`/`?fcursor`) render on the standalone frozen path (rest
  sheets stay byte-exact); `window.__scenes` exposes the live channels;
  diagnostics: `scripts/capture-transition-diagnostics.mjs` (six
  section-anchored ranges, filmstrips) → `captures/diagnostics-after/`.
- **S8 The Origin is the five scrubbed beats (R2, build-spec S8.3)** on the
  page fluid (`lib/webgl/scenes/origin` since R5-A):
  two brother-masses drift in from opposite sides, fuse into the EXACT mark
  (three founding-pillar labels float beside its lobes — mono, muted, never
  styled like the seven services), the mark holds breathing under the purpose
  line, multiplies outward as the ecosystem echo, then drains while the CPU
  particle wordmark assembles (shared engine:
  `lib/animation/wordmark-particles`). Static tiers/reduced motion collapse
  the runway to the plain reading column with the crisp mark.
- **The loading moment (R2, S1.10) is the brand assembling:** `EntryVeil` in
  the locale layout plays the wordmark particle convergence (~1.5 s) on the
  FIRST visit of a session, then releases; return visits skip with no flash
  (pre-paint script + `html[data-zveil]`), reduced motion and `?f*` QA
  contexts never see it, and a hard cap guarantees it can never strand the
  page (`scripts/verify-entry-veil.mjs` guards all three behaviors). The
  route-segment pulse remains for in-app navigations.
- **S6 Método is the liquid REHEARSING the client's transformation** (remake):
  five phase states of the same 48 droplets on the page fluid
  (`lib/webgl/scenes/method` since R5-A) — the fragmented
  cloud examined by a sweeping probe droplet (Diagnóstico) → a jittered
  liquid lattice (Estrutura) → three accreting masses (Construção) → the
  EXACT mark resolves ("one organism" — Integração) → the mark grows and
  sheds orbital satellites (Evolução). One phase per viewport, copy right /
  liquid left on wide stages, the old drawn connector reborn as a vertical
  thread that fills with progress; the line icons and the horizontal
  timeline are deleted. Exit drain before the unstick. Diagnostics range:
  `method-phases`. The shader's coverage AA is now CLAMPED
  (`min(fwidth(d), 0.02)`) — unclamped, the reversed smoothstep degenerated
  at every ball's bounded-influence edge and painted phantom ~0.5-alpha
  discs (a dark film around dense droplet fields), site-wide fix.
- **R3 polish (round 1):** work-card previews render the category's baked
  SDF-glass form still (`scripts/build-form-stills.mjs` →
  `public/brand/stills/`, mapped in `lib/content/form-stills.ts`) as
  placeholder art until real media arrives; the 404 is a LIVE lone dispersed
  droplet (`makeLoneDropDriver` + `LoneDroplet`, fractured-mark fallback);
  the scrollbar wears the brand (thin, cyan-whisper on hover). The remaining
  R3 rounds — morph feel, fracture readability, converge weight, origin
  pacing — are owner-taste iterations on real hardware.
- **Typography is a four-role system (R4 reform).** DISPLAY headlines (the hero
  headline + every section `h2`) ride **Bricolage Grotesque** via `font-grotesk`
  (`--font-grotesk`); **body, UI, nav, subheads, leads and forms ride Geist**
  (`--font-sans`, the readable workhorse — a display/text split in the mould of
  Google Sans vs Google Sans Text); **Instrument Serif italic** stays poetry-only
  (eyebrow, pillar accents, Origin, Contact prompt, manifesto); **JetBrains Mono**
  carries labels/numbers/counters/CTAs. One disciplined `--text-*` scale in
  `globals.css` — display / title / lead / body / mono tiers, fluid clamps, tuned
  tracking + leading per tier — and lifted secondary-text contrast
  (`--color-paper-mute` 0.5 → 0.62). Fonts self-host via `next/font/google`.
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
