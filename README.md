# Zirtuno Website

Business-first, visually distinctive website for Zirtuno, a Brazilian digital
studio that builds connected ecosystems across software, AI, automation, data,
branding, and marketing.

Primary language: PT-BR. Secondary language: EN. Both are authored, shipped,
and verified independently.

> Documentation and implementation status snapshot: 2026-07-10. Structural
> unification (R5-A), fluid physics (R5-B), optics (R5-C), and the cinematic
> cut (R5-D) are complete. Final hardening (R5-E) is still a delivery phase,
> not a shipped claim.

## Read First: Documentation Authority

Read these sources in order:

1. `AGENTS.md` — mandatory rules, taste constraints, current priorities, and
   the working/verification protocol for every agent session.
2. `build-spec.md` — the complete v0.3 product, experience, chapter,
   architecture, delivery, and acceptance specification.
3. `metaball-morph-spec.md` — the focused v2 contract for the continuous
   liquid, exact forms, conductor, physics, renderer, optics, and QA controls.
4. `references.md` — approved technical and visual references mapped to the
   v0.3 spec and R5 phases.
5. `lib/i18n/messages/pt.json` and `lib/i18n/messages/en.json` — the only
   source of shipped interface and conversion copy.

When sources appear to conflict, use the most specific source above, but never
override a non-negotiable in `AGENTS.md`. Code describes what exists today;
the specs describe both the current baseline and the explicitly labeled target.

One-off audits and redevelopment plans do not remain as parallel authorities.
The decisions from `improvement-plan.md` and
`tingly-frolicking-stream.md` were consolidated into the v0.3 documentation;
Git history retains their historical context. New durable decisions must be
folded into the authoritative files above rather than added as another root plan.

## Product North Star

Zirtuno must feel award-level without becoming an art piece that hides the
offer. The balance is:

- 70% strategic clarity and commercial strength.
- 30% poetic brand atmosphere.

The visitor must understand the offer before the poetic peak, see honest proof,
and reach an obvious contact action. The liquid is not decoration: it proves the
business argument by turning fragmentation into one body.

## The New Experience: Five Acts, One Liquid

One persistent page-wide liquid runs from the first hero pixel through the
footer. The canonical 48 droplets keep their identity across the whole journey.
Chapter separation comes from choreography, spacing, and light—not repeated
canvases or chapter hairlines.

| Act            | Chapters                     | Liquid narrative                                                                                | Light narrative                                             |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| I — Signal     | Entry veil, Hero             | wordmark assembly hands off to the living mark and seven forms                                  | black, then the first cyan presence                         |
| II — Argument  | Problem, Ecosystem, Services | pour → fracture → THE GATHERING (ten capability masses drawn forward out of depth, arriving in three systems, fusing into the mark) → AS SETE FORMAS (one body taking each service's exact form) | exposure falls through the problem and rises at the fuse |
| III — Practice | Método, Work                 | the liquid rehearses the client transformation, then becomes a quiet current behind honest work | neutral and workmanlike, with an act boundary before Work   |
| IV — Soul      | Origin, Studio               | two brother-masses fuse into the mark; one controlled flash; echoes continue behind the studio  | emotional peak, afterglow, then settle                      |
| V — Invitation | Contact, Footer              | every droplet gathers into the mark; submit exhales; one droplet releases beyond the footer     | calm return to black                                        |

The ten named transitions are `assembly`, `pour`, `fracture`, `seek`,
`bloom`, `rehearse`, `current`, `fuse + flash`, `gather`, and
`release`. They are handoffs of one liquid, never visual swaps.

## Implementation Status

### Complete and protected

- The nine-chapter business-first IA, bilingual copy, CTA intent system,
  contact plumbing, portfolio routes, SEO/RSC foundation, static fallbacks,
  and four-role typography.
- Exact owner-traced mark plus seven form SVGs and their SDF/48-droplet
  endpoints.
- One WebGL2/OGL field engine everywhere; the Three.js/R3F raymarch and mesh
  engines are retired and must not return.
- R5-A: one `PageStage` canvas, one measurement loop, conductor-owned scene
  blending, a form-slot arbiter, persistent droplet identity, footer inside the
  homepage stage, and machine-checked handoff invariants.
- R5-B: velocity-based fluid core with fixed substeps, goal-seek, repulsion,
  cohesion, analytic curl drift, page-wide cursor forces, pinch-off satellites,
  and the `bind` contract. `?fphys=0` preserves the legacy integrator for A/B
  and rollback.
- R5-C: the optics chain. An offscreen scene target (RGBA16F where the
  context renders it, RGBA8 fallback) feeds a half-res bright pass,
  separable gaussian ping-pong, and an opaque ink-black composite with
  selective bloom, interleaved-gradient-noise dither (kills 8-bit banding in
  the dark gradients), and luminance-gated film grain ≤2.5% — both noise
  terms gated off flat black so empty canvas stays bit-zero against the
  page. In the scene shader, identity-gated grade controls: `iExpo`/`iKey`
  (light-score driven), `iAbsorb`
  (internal absorption — thick cores read dense), and `iBallZ[80]` +
  `iDepthFx` depth bands (the ambient family packs at depth 0.62 and reads
  as a dim sub-surface). All grade uniforms default to 0 = exact identity;
  `?fgrade=0` bypasses everything, verified statistically against the
  recorded pre-C baseline and byte-exactly via settled stills
  (`verify-rest-exact.mjs`). The watchdog gains the `full-nofx` rung
  (glass, no post), and the energy governor floors a truly idle page at
  ~30 Hz draws — display-rate agnostic, waking within one vsync on any
  input or scene activity (`?fgov=0` disables).
- R5-D: the cinematic cut. Seven scene modules —
  `site · method · work · origin · studio · contact · footer` — cover the
  page with no liquid-dead bands: Método's evolution satellites become the
  quiet work CURRENT (a slow gyre behind the grid, plus a five-droplet
  meniscus that docks along the hovered project card's bottom edge), the
  origin echo survives as sparse STUDIO orbits, Contact GATHERS whatever
  still swims into the resting mark, and one droplet — the mark's lowest
  point, the 404's lone-drop identity — RELEASES past the footer at the
  page's true bottom. Scenes author the light score (act II exposure dip
  through the fracture, first light-rise + key at convergence, origin
  fusion key + afterglow, calm act V), consumed twice: in the liquid via the
  R5-C grade, and on the page via `CinematicVeils` (black exposure veil,
  vignette, flash; CSS-var driven at z-20 — above copy, below all chrome).
  Exactly two act-boundary fades exist (Método→Work, Origin→Studio; peak
  capped at 0.4, contrast-audited) and exactly ONE cyan-white Origin flash —
  latched in the conductor once per page load, ≤400 ms by construction,
  absent under reduced motion. `Reveal variant="blur"` gives the
  Soul/Invitation copy its defocus reveal. `?fcine=0` disables the entire
  cinematic layer; `verify-cinematics.mjs` is its machine gate.

### Next, in this order

1. **R5-E — Hardening:** device/battery/context-loss testing, full a11y and
   i18n regression, conversion-path verification, dead-code sweep, and launch
   content truth.

### External launch blockers

- Replace prototype portfolio entries with at least three real projects, or
  explicitly launch them as “Arquitetura selecionada / Selected architecture.”
- Confirm verified outcomes; never invent metrics.
- Confirm WhatsApp, domain email, site URL, and social handles.
- Decide whether Studio remains an anonymous role grid or gains portraits.
- Audio remains out of v1 unless explicitly scoped.

## Locked Stack

- Next.js 16 App Router, React 19, TypeScript, Turbopack
- Tailwind CSS v4 with CSS variables
- Raw WebGL2 + OGL for the unified field and post-processing
- GSAP + ScrollTrigger for scroll choreography
- Motion for DOM micro-interactions
- Lenis for calm smooth scrolling
- next-intl for PT-BR and EN
- Sanity for projects/editable content
- react-hook-form + zod + Resend for contact
- Vercel hosting/OG plus Vercel Analytics and Plausible as launch integrations

Changing the stack, adding an unlisted dependency, or introducing a second
homepage rendering engine requires owner approval.

## Runtime Architecture

```text
RSC chapter copy and semantic DOM
        │ measured anchors
        ▼
PageStage — one sticky page-wide canvas and one measurement loop
        │
        ▼
Conductor — damping, presence, droplet handoffs, form arbiter, score
        │
        ├── scene targets + light scores (site / método / work / origin /
        │                                  studio / contact / footer)
        ├── fluid-core (physics; ?fphys=0 legacy bypass)
        └── shared 48-droplet identity + ambient/extras
        │
        ▼
FieldStage + sdf-glass shader (identity-gated grade: expo/key/absorb/depth)
        │
        ├── post-chain (R5-C): bright pass → bloom → opaque composite
        │   (dither + grain) · full-nofx rung · ~30 Hz idle governor
        │
        └── CinematicVeils (R5-D): score → CSS vars → exposure veil ·
            vignette · the ONE conductor-latched Origin flash (?fcine=0 off)
```

Content remains server-rendered and crawlable. WebGL, measurements, and motion
are client enhancements. Reduced motion, no-WebGL, and “none” tier paths keep
the complete story and conversion path usable without the canvas.

## Project Layout

- `app/[locale]/` — locale routes, page composition, work pages, metadata,
  loading, 404, sitemap/robots integration.
- `components/chapters/` — semantic chapter UI and contact/project surfaces.
- `components/field/` — `PageStage` conductor shell and `FieldStage` renderer.
- `components/hero/` — hero shell and deterministic form/morph QA renderers.
- `components/chrome/` — navigation, CTAs, cursor, entry veil, footer, 404.
- `lib/webgl/` — exact SDFs, symbols, driver kernel, conductor, physics,
  renderer shaders, tiers, and scene modules.
- `lib/i18n/messages/` — authoritative PT-BR and EN copy.
- `lib/content/` and `lib/sanity/` — project sources and CMS integration.
- `public/brand/` — runtime mark, seven form SVGs, and baked form stills.
- `references/morphs/` — owner originals, traced endpoints, previews, manifest.
- `scripts/` — deterministic capture and machine-verification harnesses.

Generated `.next/`, `captures/`, `artifacts/`, `node_modules/`, and
`*.tsbuildinfo` are disposable local outputs unless a task explicitly asks to
preserve review evidence.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm run verify:production # launch env, CMS, contact, identity, analytics gate
```

The visual harnesses launch or reuse a dev server:

```bash
npm run forms:rest       # exact form endpoints against owner SVG references
npm run forms:melts      # bridge frames, melt fps, keyboard smoke
npm run forms:cursor     # cursor bulge → neck → merge
npm run chapters:sheet   # chapter sheet across field tiers/locales
npm run endpoints        # regenerate registered 48-droplet endpoints

node scripts/verify-conductor.mjs
node scripts/verify-canvas-count.mjs
node scripts/verify-cta.mjs
node scripts/verify-entry-veil.mjs
node scripts/verify-perf.mjs
node scripts/verify-postfx.mjs        # optics gate (vs scripts/postfx-baseline.json)
node scripts/verify-rest-exact.mjs    # settled-still byte gate (vs scripts/rest-exact.json)
node scripts/verify-cinematics.mjs    # R5-D gate: one flash, two fades, no dead zones
node scripts/verify-deformation.mjs   # deformable-material gate: the velocity field
                                      # linked, iBallShape/iStrain driven, ambient
                                      # current running, nothing teleports
node scripts/verify-ecosystem.mjs     # THE GATHERING: names, three beats, collisions, response
node scripts/verify-boundaries.mjs    # no dead band / no teleport across acts II-III
node scripts/capture-transition-diagnostics.mjs
node scripts/record-liquid-motion.mjs # video + per-draw iBalls trace recordings
```

Use `LOCALE=pt` or `LOCALE=en` where a harness supports locale selection.
Run browser-based capture scripts against a live dev server and review their
images; a green process exit does not replace visual judgment.

### Current QA parameters

- `?fstate=N` — deterministic rest form.
- `?fpair=a-b-m` — deterministic melt frame.
- `?fcursor=x,y` — deterministic cursor merge.
- `?fcycle=1` — shortened hero dwell.
- `?fflat=1` — flat field/debug path.
- `?ftier=full|lite|none` — tier override.
- `?feco=c` — freeze ecosystem choreography at `c ∈ [0,1]`.
- `?fphys=0` — bypass fluid physics through the legacy low-pass.
- `?fphysv3=0` — roll back the area-weighted/viscous physics (default ON).
- `?fobstacles=0` — roll back cached typography/form avoidance (default ON).
- `?fglass=1` — restore the liquid-glass MATERIAL (default OFF). The shading is
  off site-wide by owner decision: the liquid renders through the shader's flat
  branch, a solid brand-cyan silhouette. Nothing was deleted — this flag is the
  whole difference between the two looks, and the optics gates ask for it.
- `?fshape=0` — roll back velocity-aligned deformation and its glass optics (default ON).
- `?fgrade=0` — bypass the optics chain and grade (exact pre-optics output).
- `?fgov=0` — disable the idle-cadence governor.
- `?fcine=0` — disable the cinematic layer (neutral score, no veils/flash).
- `window.__scenes` — live scene channels for diagnostics.
- `window.__optics` — live optics/shape state: post/fmt/tier/frames/gov +
  `demote()` for watchdog-rung drills.
- `window.__cine` — the merged light score + `stats.flashes` (the
  one-flash gate reads it).

## Content and Environment

Copy belongs only in the two locale message files. Do not hard-code shipped
text in components. Local concept studies are available only when
`PORTFOLIO_DEMO_MODE=true` in a non-production environment. Missing or failed
Sanity access in production fails closed to an honest empty portfolio; it
never falls back to prototype proof. Contact reports success only after Resend
confirms delivery. A case study may optionally author a Sanity-hosted `.riv`
file, localized semantic description, and real poster; the lazy Rive canvas is
supplemental and never replaces the written case or its static fallback.
Safe retries reuse a stable per-submission identity and
byte-equivalent provider payload; accepted-but-unconfirmed mail keeps the form
intact and is tracked to a signature-verified webhook for final delivery/bounce
alerts. Both public contact endpoints enforce actual streamed-body ceilings.
Vercel production builds run the readiness gate automatically and cannot ship
with placeholder contact identity, an unverified delivery path, or an
unattested rate-limit/firewall rule. Plausible is optional while developing,
but the production gate requires its approved domain/script so CTA, contact,
case, locale, and field Web Vitals events are observable without submitted
content.

See `.env.local.example` for the current variables. Treat its local demo mode
as a review convenience, never as approved production proof.

## Cleanup and Decision Policy

- Keep durable source, specs, references, scripts, and shipped assets.
- Delete generated captures after review; summarize durable visual findings in
  an authoritative document or code constant.
- Keep historical experiments in Git history, not as competing root specs.
- Record unresolved owner choices as `TODO(decision)` at the relevant code
  boundary and in `build-spec.md`.
- If a change affects exact forms, the one-canvas invariant, the form arbiter,
  CTA intent, reduced motion, or honest portfolio proof, stop and re-run the
  associated gate before proceeding.

_Discreto. Preciso. Transformador. — e comercialmente forte._
