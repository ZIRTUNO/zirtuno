# AGENTS.md — Zirtuno Website

> Read this at the start of every session. This file is the authority for
> behavior, taste, protected invariants, and delivery order. `build-spec.md`
> owns detailed product and acceptance requirements.
> `metaball-morph-spec.md` owns liquid-engine mechanics.
> `cta-membrane-spec.md` owns the CTA membrane — the vector half of the same
> liquid, and `field-liquid-spec.md` owns the form's half of it, where two
> vector bodies can finally meet. `entry-intro-spec.md` owns S1.10, the opening
> sequence.
> If detail conflicts with a rule here, this file wins.

## 1. The Project

Zirtuno is a Brazilian digital studio that builds complete digital ecosystems:
software, AI, automation, data, branding, and marketing connected into one
structure.

The website must be both:

- an award-level, cinematic expression of the brand; and
- a serious conversion-focused business site.

The target balance is **70% strategic clarity · 30% poetic atmosphere**.
A visitor must understand what Zirtuno sells before reaching the poetic peak.

PT-BR is primary and EN is secondary. Both ship as authored copy, not literal
automatic translations. Shipped copy lives only in
`lib/i18n/messages/pt.json` and `lib/i18n/messages/en.json`.

## 2. Brand Essence

Zirtuno joins the quiet transforming force of Zéfiro with the direction and
courage of Ventura. That join IS the Origin story (S7): TWO IDEAS, not two
people. Force without direction is only weather; direction without force is
only a map. The three founding pillars and the drive to build what does not yet
exist follow from the fusion — they are not a second origin beside it.

The brand is quiet but powerful: transformation without noise, structure given
to what was dispersed.

**Discreto. Preciso. Transformador. Claro. Estratégico. Comercialmente forte.**

## 3. Current Redevelopment State

The site is in R5, “One Continuous Liquid.”

- **R5-A is complete:** one persistent homepage canvas, one measurement loop,
  the conductor, continuous 48-droplet identity, form-slot arbitration, scene
  handoffs, footer inside the page stage, and one-canvas verification.
- **R5-B is complete:** velocity state, fixed-step fluid physics, repulsion,
  cohesion, curl drift, page-wide cursor forces, pinch-off satellites, and the
  `bind` compatibility contract. `?fphys=0` is the rollback/A-B path.
  The v3 forces (area-weighted mass, local viscosity, the cohesive band that
  stands in for surface tension, cluster-footprint preservation) and cached
  typography-aware flow are now the DEFAULT material, not review paths;
  `?fphysv3=0` / `?fobstacles=0` roll them back. Scroll is coupled into
  `fluid-core` as a body force scaled by (1 − bind), and velocity-aligned
  deformation with strain-driven glass optics is the default renderer on glass
  tiers (`?fshape=0` rolls back). `verify-deformation.mjs` is the machine gate;
  the conductor harness asserts bind=1 parity *under scroll*.
  Interaction is now the whole field. The hand is a volume-conserving
  DISPLACEMENT well with a velocity-signed wake — not the monotone repulsion
  that used to evacuate its own neighbourhood — a click or tap is a travelling
  STRIKE (crest out, trough back, per-body arrival jitter, a crown of spray
  thrown only from liquid that was actually there), a held pointer is a press
  gain, and the ambient family and the spray answer the same forces through one
  shared definition. Every term scales by (1 − bind), so melts and exact rest
  are untouched. And the FORMS answer as well: the eight owner-traced SVGs
  render from SDF textures and never entered the droplet buffer, so no force
  could reach them — the most prominent liquid on the page was the only part of
  it that ignored a hand. They now take the same hand and the same waves as a
  DOMAIN DISPLACEMENT, which moves the surface with its normals intact so the
  bulge lights itself, and the BOUND droplets beside them take the same
  displacement at render time — without that a morph is dead to the pointer,
  because mid-melt the stage is nothing but bound droplets. That is the bind
  contract's one interaction exception: render-only, zero when nothing is
  touching, and byte-identical to the legacy trajectory again the moment the
  hand leaves (§8.3). The shader half lives in a separate compile variant,
  which is what
  keeps `SDF_GLASS_FRAG` — the source the deterministic rest stills compile —
  byte-identical, so the exact-rest contract stays a claim about unchanged code
  rather than about floating point. `?fstrike=0` rolls back the click and keeps
  the hand; `?fformtouch=0` rolls back the forms' answer and keeps the
  droplets'; `verify-strike.mjs` is the wiring gate beside the conductor
  harness's force gate.
- **R5-C is complete:** the framebuffer post chain (selective bloom, blue-noise
  dither, luminance-gated grain), identity-gated in-shader grade (exposure,
  key boost, internal absorption, `iBallZ` depth bands), the `full-nofx`
  watchdog rung, and the ~30 Hz idle energy governor. `?fgrade=0` is the exact
  optics bypass; `?fgov=0` disables the governor; `verify-postfx.mjs` and the
  `verify-rest-exact.mjs` byte gate protect it.
- **R5-D is complete:** the cinematic cut. Seven scene modules
  (site · método · work · origin · studio · contact · footer) leave no
  liquid-dead band: the work CURRENT (Método's satellites as a slow gyre
  behind the grid + the hovered-card meniscus), the studio ECHO orbits, the
  contact GATHER, and the footer RELEASE (the mark's lowest droplet exits
  past the page bottom). Scenes author the light score; it drives the R5-C
  in-liquid grade AND `CinematicVeils` (exposure veil, vignette).
  Exactly two act-boundary fades (Método→Work, Origin→Studio; peak ≤ 0.4,
  contrast-audited). The former full-page Origin flash is removed; fusion light
  now comes only from the continuously scored liquid material and afterglow.
  `Reveal variant="blur"` carries the Soul/Invitation copy. `?fcine=0` is
  the cinematic escape hatch; `verify-cinematics.mjs` is the machine gate.
- **R5-E closes:** device, battery, context-loss, accessibility, locale,
  content-truth, conversion, and final regression hardening.

## 4. Non-Negotiable Rules

1. **One liquid means one persistent homepage canvas.** The same canonical 48
   droplets travel from Hero to Footer. Do not add per-chapter canvases,
   remount the liquid between sections, or simulate continuity with a swap.
   Deterministic hero QA renderers and separate non-homepage surfaces are the
   only narrow exceptions.
2. **The liquid carries the business argument.** The mark pours and fractures
   in Problem, seeks and reconnects in Ecosystem, then blooms through the
   service forms. Work, Studio, Contact, and Footer must not become liquid-free
   dead zones in the final cut.
3. **Exact form endpoints are sacred.** The owner-traced mark and seven SVGs
   are the canonical forms. Rest renders through their SDFs using the locked
   glass model. `forms:rest` must remain byte-exact whenever shader, SDF,
   renderer, post, or form code changes.
4. **Morphs are one in-field liquid bridge, never a crossfade.** Preserve the
   48-droplet §3.3 bridge, min-travel correspondence, regional stagger,
   radius-leading motion, exact form endpoints, and shared iso-surface. See
   `metaball-morph-spec.md`.
5. **Preserve the conductor contracts.** Scenes emit targets; the conductor
   owns damping, presence, target blending, integration, packing, and score.
   Scenes never allocate per droplet per frame and write every output field.
   A new scene may receive the two form slots only after the current holder’s
   total form weight is below `EPS_FORM`. Forms never crossfade between scenes.
6. **Preserve the bind contract.** `bind=1` reproduces the signed-off legacy
   low-pass exactly for resting footprints and melts. `bind=0` allows full
   physics for pours, scatters, currents, and echoes. Do not “improve” exact
   choreography by bypassing bind.
7. **Typography is a four-role system.** Hero headline and every section
   `h2` use Bricolage Grotesque (`font-grotesk`). Body, UI, navigation,
   subheads, leads, forms, and mid-titles use Geist (`font-sans`). Instrument
   Serif italic is poetry-only. JetBrains Mono carries labels, numbers,
   counters, and CTAs. Use the `--text-*` tiers in `globals.css`; do not
   hardcode type sizes.
8. **Color discipline is cyan on black.** No purple, green, rainbow
   iridescence, or off-brand gradients. Use only the tokens in §6. Bloom,
   exposure, and depth may change light—not the brand hue. Do not reintroduce a
   full-page white/cyan-white flash at Origin fusion.
9. **Never invent proof.** Portfolio outcomes are verified metrics, honest
   narratives, or explicitly labeled “Arquitetura selecionada / Selected
   architecture.” Prototype data is local scaffolding, not launch proof.
10. **The contact submit stays obvious.** The real labeled
    “Solicitar análise inicial / Request initial analysis” button is canonical.
    The metaball exhale is additive feedback, never the only submit control.
    The FORM's liquid (`field-liquid-spec.md`) is additive on the same terms:
    it draws outlines and nothing else. `data-fieldliquid` is set only after the
    layer has mounted AND drawn, every rule that changes a field is gated on it,
    and labels, values, validation, the error summary and the focus outline stay
    exactly where they were. Reduced motion, no-JS and any mount failure fall
    through to the bordered form, complete and usable.
11. **CTA hierarchy and intent are load-bearing.** Keep the placement map in
    `build-spec.md §7.2`. Every contact CTA carries its entry-intent tag.
    Homepage CTAs use Lenis smooth-scroll plus `history.replaceState`; cross-page
    CTAs keep routed navigation.
    The CTA surface itself is the MEMBRANE (`cta-membrane-spec.md`): the field's
    hand and strike run on a vector contour, with the same character constants.
    It is strictly ADDITIVE — `data-membrane` is set only after it mounts and
    draws, and every rule that changes the button is gated on that attribute, so
    reduced motion, no-JS and pre-hydration keep the original CSS button. Do not
    move button state out of `globals.css` and into the membrane. Devices
    without hover run the autonomous TIDE; it suspends exact rest while a CTA is
    on screen and must never rival a deliberate press.
12. **Conversion copy stays server-rendered.** Problem, Ecosystem, Services,
    Method, Work, Origin, Studio, and Contact meaning must remain in semantic
    RSC/HTML. WebGL is enhancement, never the only carrier of information.
13. **Accessibility is part of the feature.** Keyboard navigation, visible
    focus, semantic controls, AA contrast, error announcements, static
    fallbacks, and complete reduced-motion reading paths are required.
14. **The liquid never freezes as a performance fallback.** The watchdog lowers
    effects, cadence, or resolution. Full → full-nofx → lite → half is the
    shipped ladder, and the idle governor floors at ~30 Hz — never zero.
    “None” is an initial no-WebGL/probe fallback, not a watchdog freeze.
15. **Do not reintroduce retired architecture.** No Three.js, R3F, Drei,
    raymarch hero, mesh metaballs, `can-run-glass`, GPU-name blocklist,
    `?glass=` API, or manually synchronized second visual engine.
16. **Signature surfaces are bespoke.** No marketplace/default-shadcn visual in
    Hero, Problem, Ecosystem, Services liquid, Método liquid, Origin, Contact
    liquid, or the cinematic layer. Utility primitives may be used only with
    explicit approval and complete Zirtuno restyling.

## 5. Experience Architecture

The nine chapters retain their business-first order but are now composed as
five acts:

| Act | Chapters | Required liquid transition |
|---|---|---|
| I — Signal | Entry intro → Hero | draw · meet · flood · drain |
| II — Argument | Problem → Ecosystem → Services | pour → fracture → seek → bloom |
| III — Practice | Método → Work | rehearse → current |
| IV — Soul | Origin → Studio | fuse + afterglow |
| V — Invitation | Contact → Footer | gather → release |

The liquid and light motivate transitions. Repeated chapter border lines do
not. The Footer belongs inside `PageStage` on homepage routes so the release
can reach the true bottom.

Chapter order:

```text
01 Hero
02 The Problem
03 The Ecosystem
04 The Services
05 Método Zirtuno
06 Selected Work
07 The Origin
08 The Studio
09 Contact
Footer coda
```

## 6. Locked Design and Technology

### Palette

```css
--color-ink:#000000;
--color-surface:#0A0A0C;
--color-cyan:#00E3FE;
--color-cyan-glow:#4DECFF;
--color-cyan-deep:#00B6CC;
--color-paper:#F2F0EB;
--color-paper-mute:rgba(242,240,235,0.56);
--color-paper-soft:rgba(242,240,235,0.42);
--color-paper-dim:rgba(242,240,235,0.30);
--color-paper-faint:rgba(242,240,235,0.10);
--color-warn:#FF6B5C; /* form errors only */
```

Treat `globals.css` as the executable token source if opacity values evolve
through approved contrast/taste rounds.

### Type roles

```css
--font-grotesk:'Bricolage Grotesque'; /* display headlines */
--font-sans:'Geist';                  /* text and UI */
--font-display:'Instrument Serif';    /* poetic italic only */
--font-mono:'JetBrains Mono';         /* labels, numbers, CTAs */
```

Fonts are self-hosted at build time through `next/font/google`. No runtime
third-party font requests.

### Motion language

- calm: `cubic-bezier(0.65,0,0.35,1)`
- arrive: `cubic-bezier(0.22,1,0.36,1)`
- depart: `cubic-bezier(0.64,0,0.78,0)`
- standard durations: micro 200 ms, short 400 ms, medium 700 ms, long
  1200 ms, morph 1400 ms, autocycle 9000 ms, breath 8000 ms.

GSAP/ScrollTrigger owns scroll choreography. Motion owns DOM micro-interactions.
Lenis owns smooth scrolling. Do not make two systems fight over the same value.

### Stack

- Next.js 16 App Router, React 19, TypeScript, Turbopack
- Tailwind CSS v4 + CSS variables
- Raw WebGL2 + OGL
- GSAP + ScrollTrigger, Motion, Lenis
- next-intl
- Sanity
- react-hook-form + zod + Resend
- Vercel hosting/OG, Vercel Analytics, Plausible

Ask before adding any dependency or substituting any layer.

## 7. Architecture Boundaries

- `app/[locale]/page.tsx` composes semantic RSC chapters and places Footer
  inside `PageStage`.
- `components/field/PageStage.tsx` owns DOM measurement, global input, live
  labels, the one canvas shell, and scene assembly. It does not own chapter copy.
- `lib/webgl/conductor.mjs` owns all between-scene state and invariants.
- `lib/webgl/scenes/*.ts` translates measured geometry into scene targets,
  form claims, extras, activity, and light score.
- `lib/webgl/fluid-core.mjs` owns velocity and environmental forces.
- `components/field/FieldStage.tsx` owns WebGL resources and drawing.
- `lib/webgl/sdf-glass-shader.mjs` owns the unified field and locked glass.
- `lib/webgl/post-chain.ts` + `post-shaders.mjs` (R5-C) own the framebuffer
  pipeline beside the renderer; every grade control defaults to identity.
- `components/field/CinematicVeils.tsx` (R5-D) owns the page-light layer:
  score-driven CSS-var veils at z-20 — above chapter copy, below all chrome.
  The post chain grades the liquid; the veils grade the page. Keep the split.
- `lib/webgl/field-drivers.ts` remains the shared §3.3 melt kernel, deterministic
  harness contract, and special-page driver home—not a second homepage brain.
- `lib/animation/intro-sequence.ts` owns the S1.10 score and is the sequence's
  ONE clock: DrawSVG, the vector-liquid kernel and the optional Rive layer are
  all readers of that timeline, never independent loops.
  `components/chrome/EntryVeil.tsx` owns only what a timeline cannot — whether
  the intro may play, the DOM it plays on, and the guarantee that it can never
  strand the page. Geometry is GENERATED from the mark
  (`scripts/generate-intro-trace.mjs` → `lib/animation/intro-trace.data.mjs`);
  do not hand-author paths for it.
- `lib/motion/coalesce.mjs` is the merge kernel — the same smooth-minimum
  `sdf-glass-shader.mjs` runs on the GPU, evaluated on a contour instead of per
  pixel, so two vector bodies can fuse and pinch apart as crisp geometry rather
  than as a blurred goo filter. It is what gives S10's form its travelling bead.
  `R` and `K` are ONE decision, not two (`field-liquid-spec.md §2`): the corners
  fix `R + K`, and the requirement that the union stay a graph over the edge
  fixes `K/2 = R`. Change either alone and the merge squares off into a
  rectangular tab that every other check still passes.
  When liquid meets structure here the LIQUID gives up its shape — a field's
  rectangle never rounds and never loses a corner.
- `lib/motion/membrane.mjs` is the vector liquid's kernel: DOM-free and
  deterministic like the `.mjs` field kernels, so `verify-membrane.mjs` runs it
  in plain node. `lib/motion/membrane-runtime.ts` owns the ONE rAF, the one
  pointer listener and the one scroll listener that every membrane and thread on
  a page shares — do not give a button its own loop.
  Gates: `verify-membrane.mjs` (physics), `verify-membrane-mobile.mjs` (the
  autonomous half, in real device profiles), `capture-membrane.mjs` (state
  stills, virtual-clock driven).
- **There is deliberately no `app/[locale]/loading.tsx`.** Its Suspense boundary
  flushed the document shell — and a 200 status — before `notFound()` could run,
  so every unmatched path answered as a soft 404. Route transitions are covered
  by the cyan wipe in `template.tsx`, which now plays only on client navigation
  (a document's first paint has nothing to transition from). The localized 404's
  head comes from the sibling layouts at `[locale]/[...rest]` and
  `[locale]/work/[slug]`: a `not-found` boundary cannot export
  `generateMetadata`, but a layout that never throws can.
- The chapter rail rests at its numbers-only width and reserves `--rail-safe`;
  only the two homepage blocks that reach the page's right edge (the Studio role
  grid and the Work strip) claim it. `PageStage` measures the rail rather than
  hardcoding its column.

## 8. Working Conventions

- Inspect the worktree before editing. Preserve user changes and unrelated work.
- Work one R5 phase or one bounded chapter concern at a time.
- Use clear commits that identify the phase/spec, for example
  `feat(R5-C): add identity-safe bright pass`.
- Keep browser-only visual code out of RSC copy components.
- Keep `.mjs` simulation kernels DOM-free and deterministic so Node harnesses
  can run them.
- Avoid per-frame object/array allocation in scene target loops.
- Preserve measurement selectors used by diagnostics:
  `.method-journey`, `.origin-journey`, and `[data-organism]` unless the
  harness and documentation are intentionally migrated together.
- Build mobile, reduced-motion, no-WebGL, and context-loss behavior with the
  feature—not as cleanup.
- Do not keep dated audit Markdown at repo root. Fold durable decisions into
  README, this file, build spec, or the liquid spec.

Ask before:

- changing the stack or adding a dependency;
- changing the nine-chapter IA or five-act arc;
- weakening the one-canvas or same-droplet guarantee;
- re-baselining exact forms or the locked key-light direction;
- using a marketplace component on a signature surface;
- inventing or materially reframing portfolio/company facts;
- enabling audio.

## 9. Current Delivery Order

The old skeleton and R0–R4 build orders are complete or superseded, and
R5-A/B/C have landed. Continue in this order:

1. **R5-E Hardening**
   - iOS sticky/svh, Android lite-live, desktop full/full-nofx;
   - 30-minute battery soak and telemetry;
   - context-loss drill;
   - PT/EN, keyboard, screen-reader, reduced-motion, contrast regression;
   - real portfolio/contact content and production environment;
   - dead-code and documentation sweep.

Each phase is **build → verify → commit → owner review pause**. Do not silently
continue past a signature visual checkpoint.

## 10. Visual Review Protocol

These moments require capture review and owner taste feedback, normally 3–6
rounds:

- exact form material and §3.3 morph feel;
- pour/fracture readability and seek/converge weight;
- page-wide physics feel, including cursor and pinch-off;
- R5-C bloom, depth, banding, exposure, and grain;
- Origin fusion, flash-free afterglow, and pacing;
- Contact gather/exhale and Footer release.

For each:

1. Read the relevant build spec, liquid spec, and mapped references.
2. Build the smallest reviewable version.
3. Run deterministic captures and inspect them before presenting.
4. Stop for owner review on real hardware.
5. Tune existing constants before inventing a new renderer or effect family.

## 11. Verification Is Part of the Change

Baseline for every implementation phase:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Additional stop-the-line gates:

- Shader/SDF/post change: `npm run forms:rest` must remain exact.
- Morph/form change: `npm run forms:melts` and `npm run forms:cursor`.
- Scene/conductor/physics change:
  `node scripts/verify-conductor.mjs` and transition diagnostics.
- Homepage canvas change: `node scripts/verify-canvas-count.mjs` must report
  exactly one liquid canvas.
- CTA/navigation/form change: `node scripts/verify-cta.mjs`.
- Form-liquid change (`coalesce.mjs`, `FieldLiquid.tsx`, the S10 controls):
  `node scripts/verify-coalesce.mjs` (`npm run liquid:form`) — smin exactness,
  byte-exact rest, the reach, the handover silhouette, a simple closed curve,
  the bead's travel and mass, cost, corner clearance, and the squared-off guard.
  `npm run liquid:form:sheet` renders the merge at 5x straight from the kernel:
  REVIEW THAT BEFORE the page stills, because a 16 px detail on a 576 px form is
  not judgeable at 1x — a squared-off tab survived two rounds of full-form
  screenshots. `BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs`
  is the page contact sheet (rest · fused · four travel ages · the hold at the
  submit button · hover · invalid · BROKEN · reduced motion). `ONLY=broken`
  blocks the kernel's chunk and asserts the form survives it — the merge kernel
  is imported dynamically inside the effect precisely so a bad module cannot
  take the contact form down with it. Because the layer takes over the controls' BORDER, a change
  here is also an a11y and CTA change: run `verify-a11y.mjs` and `verify-cta.mjs`.
- Disclosure change (S4 instrument band): `node scripts/verify-disclose.mjs` —
  the additive `data-disclose` contract, an open that ramps and lands exactly
  on the slab, a close that starts moving on the first frame and is NOT the
  open mirrored (the easeReverse gate: ~25% of slab at the midpoint, where a
  mirrored entry would be ~97%), content that outlives the exit, an
  interrupted open that collapses from where it was, find-in-page taking the
  state without the choreography, and reduced-motion / no-JS falling back to a
  plain instant `<details>`. It also gates THE PIN: the pillar name must hold
  its line to under 2px on every frame of both directions, because the stage
  centres its copy column and an uncompensated open levers the headline
  165.7px upward. `node scripts/capture-disclose.mjs` is the review contact
  sheet; it slows GSAP's clock (which reads `Date.now`, not `performance.now`)
  so a Playwright burst can actually resolve the curves, and it reports the
  390px excursion because the single-column stage centres differently.
  Three traps this suite was built around, all of which produced confident
  wrong numbers first:
  · once `open` is dropped the pane sits under `content-visibility: hidden`
    and Chrome keeps serving its LAST rect — measure heights only on frames
    where `open` is still true, or a closed panel reads as full height;
  · measure the pin against the PILLAR, not the viewport: an unsettled scroll
    from earlier cycles shows up as 32px of phantom pin error;
  · budget the timing checks in FRAMES, not milliseconds. The liquid starves
    rAF on this page and a single dropped frame blew a 50ms budget to 73ms
    while the animation itself was fine.
- Entry-intro change: `node scripts/verify-entry-veil.mjs` — plays on EVERY
  document load (a reload replays it; a locale switch and any other same-document
  remount are suppressed), releases inside its budget, never paints under `?f*`
  or reduced motion, NEVER animates opacity on any layer, renders the drawn line
  and the liquid body from one path, and the skip drives its own exit rather
  than letting the hard cap do it. `npm run intro:sheet` is the review contact
  sheet; `npm run intro:trace` regenerates the geometry from the mark and MUST
  be re-run if `public/brand/zirtuno-logo-mark.svg` ever changes.
- Performance/tier change: chapter sheets plus `verify-perf.mjs` on relevant
  hardware.
- Optics/grade change: `node scripts/verify-postfx.mjs` (statistical `?fgrade=0`
  equivalence, banding, seam, full-nofx drill, governor cadence) and
  `node scripts/verify-rest-exact.mjs` (settled-still byte gate — the machine
  teeth behind "rest must remain exact"; conscious re-baselines rerun its
  `--baseline` and commit `scripts/rest-exact.json`).
- Cinematic/scene/score change: `node scripts/verify-cinematics.mjs` —
  no Origin flash surface or score channel, exactly two act-fade bands on their
  seams (peak ≤ 0.41, released at every reading rest), living liquid over Work/Studio/
  the footer release, meniscus wiring, and the transient-contrast floor
  (≥ 3.5:1 under the fade peak; standing reads are veil-free).
- Tier/viewport/renderer-lifecycle change (R5-E hardening gates):
  `node scripts/verify-devices.mjs` (emulated matrix: iPhone-class live +
  static, Android-class lite-must-be-live, full-nofx rung, no horizontal
  overflow, stage == 100svh), `node scripts/verify-context-loss.mjs`
  (§12.5: the loop parks on loss, restore resumes mid-page state), and —
  for battery/cadence claims — `SOAK_MIN=30 node scripts/verify-soak.mjs`
  against a production build (governor holds idle, no idle demotion, flat
  heap, never frozen).
- Copy/semantics/locale/chrome change: `node scripts/verify-a11y.mjs`
  (landmarks, one h1, labels, skip link, keyboard menu, focus visibility,
  effective-background contrast, pt/en key parity, reduced-motion story).
- Ecosystem gathering change (`gathering.mjs`, the S3 scene block, the
  capability names, system markers, or the column): `node
  scripts/verify-ecosystem.mjs` — ten names and three system markers drawn,
  clear of the chapter-index rail and of each other, **all type on ONE vertical
  axis**, the column fits the stage at full extension and visibly accumulates
  between beats, no leaders or plate frame remain, hover AND keyboard raise the
  same system-staggered pulse plus the liquid's rack focus (`hov` channel), the
  readout follows, and reduced motion keeps the eco-stack story.
  S3 is a two-part composition: the liquid owns a FIELD and the type owns a
  COLUMN in the page gutter. `FIELD_MIN_W` in `gathering.mjs` and the
  `min-width: 1024px` guard on `.gather-col` are the SAME breakpoint — if one
  moves, move the other, or the liquid composes itself for a column that is not
  there (or centres itself under one that is).
- Emulation is the regression floor, not the sign-off: iOS URL-bar collapse,
  real GPU probes, and thermal behavior still require the owner's hardware.

A harness exit code does not sign off taste. A screenshot does not replace
keyboard, locale, or machine verification.

## 12. Open Owner Decisions

Use the recommended default, leave `TODO(decision)` at the relevant boundary,
and flag it:

- Ecosystem center: unified mark/core plus small “Seu negócio / Your business”
  label is the current default.
- Portfolio: real projects and which outcomes are verifiable.
- Studio: anonymous role grid is the default; portraits require supplied assets.
- Origin: confirm the precise meaning of social/health/finance. The founders'
  anonymity is no longer a blocker — the chapter's subject is the two ideas
  (Zéfiro · Ventura), so there is no founder beat to name.
- Contact/footer: real WhatsApp, domain email, site URL, and social handles.
- Audio: out for v1.

Do not let these choices block unrelated implementation. They do block launch
claims and the relevant final acceptance boxes.

## 13. Definition of Done

A first-time visitor can understand the offer immediately, feel fragmentation,
watch the same liquid reconnect into an ecosystem, understand seven services
and the five-phase method, see honest work, experience the true Origin story,
understand the studio, and contact Zirtuno through an obvious labeled action.

The experience remains coherent from Hero through Footer on desktop, live but
appropriately reduced on capable mobile, semantically complete without WebGL,
calm under reduced motion, accessible by keyboard, accurate in PT-BR and EN,
honest in every claim, and independently reversible at the physics and optics
layers without breaking exact form output.

*One liquid. One system. One motivated story.*
