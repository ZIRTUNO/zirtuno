# AGENTS.md — Zirtuno Website

> Read this at the start of every session. This file is the authority for
> behavior, taste, protected invariants, and delivery order. `docs/specs/build-spec.md`
> owns detailed product and acceptance requirements.
> `docs/specs/metaball-morph-spec.md` owns liquid-engine mechanics.
> `docs/specs/cta-membrane-spec.md` owns the CTA membrane — the vector half of the same
> liquid, and `docs/specs/field-liquid-spec.md` owns the form's half of it, where two
> vector bodies can finally meet. `docs/specs/entry-intro-spec.md` owns S1.10, the opening
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
  tiers (`?fshape=0` rolls back). `verify/deformation.mjs` is the machine gate;
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
  droplets'; `verify/strike.mjs` is the wiring gate beside the conductor
  harness's force gate.
- **R5-C is complete:** the framebuffer post chain (selective bloom, blue-noise
  dither, luminance-gated grain), identity-gated in-shader grade (exposure,
  key boost, internal absorption, `iBallZ` depth bands), the `full-nofx`
  watchdog rung, and the ~30 Hz idle energy governor. `?fgrade=0` is the exact
  optics bypass; `?fgov=0` disables the governor; `verify/postfx.mjs` and the
  `verify/rest-exact.mjs` byte gate protect it.
- **R5-D is complete:** the cinematic cut. Seven scene modules
  (site · método · work · origin · studio · contact · footer) leave no
  liquid-dead band: the work CURRENT (Método's next-scale cells as a slow gyre
  behind the grid + the hovered-card meniscus), the studio ECHO orbits, the
  contact GATHER, and the footer RELEASE (the mark's lowest droplet exits
  past the page bottom). Scenes author the light score; it drives the R5-C
  in-liquid grade AND `CinematicVeils` (exposure veil, vignette).
  Exactly two act-boundary fades (Método→Work, Origin→Studio; peak ≤ 0.4,
  contrast-audited). The former full-page Origin flash is removed; fusion light
  now comes only from the continuously scored liquid material and afterglow.
  `Reveal variant="blur"` carries the Soul/Invitation copy. `?fcine=0` is
  the cinematic escape hatch; `verify/cinematics.mjs` is the machine gate.
- **R5-E closes:** device, battery, context-loss, accessibility, locale,
  content-truth, conversion, and final regression hardening.
- **R6 is complete:** the liquid stops being 48 choreographed droplets and
  becomes a population. Three changes, each independently reversible.

  **The renderer is TILE-BINNED.** The shipped shader evaluated every droplet
  at every fragment with no spatial culling, so ~95% of the frame was the ball
  loop and the population could not grow: measured at 1.13 Mpx, 0 balls cost
  0.80 ms and 80 balls cost 19.1 ms. Droplet data now lives in an RGBA32F
  texture (row 0 = x, y, r, density · row 1 = depth, velocity) and a CPU
  prepass bins droplet indices into 20 px screen tiles, so a fragment walks
  only the droplets that can reach it. Per-fragment work tracks LOCAL density
  instead of the global count. Measured on the production build at 1.9 Mpx,
  p90 frame time — which is what reads as stutter — went from 30.1 ms to
  10.1 ms *while* the population rose 6.6×. `?ftile=0` rolls back to the
  uniform-array path, which stays the automatic fallback for any driver that
  refuses the integer samplers. `SDF_BALL_MAX = 80` still bounds that path;
  the tiled path is bounded by `SDF_BALL_CAP_TILED = 512`.

  **48 is the AUTHORED population, not the system's.** It is what
  generate-morph-endpoints packs every form SVG to, so morphs stay pure lerps —
  that contract is untouched. Above it sit MOTES (lib/webgl/motes.mjs):
  ordinary simulated droplets whose targets are DERIVED from a host's
  (i % 48) rather than authored, so every composition, morph, handoff and
  cluster carries the whole crowd without a scene knowing it exists. They are
  in the physics arrays — they repel, cohere, feel the curl, the scroll, the
  hand and the strike. Their field density scales by (1 − hostBind), so during
  the §3.3 melt sequence they are absent and the morph is exactly what it was.
  `?fmotes=<ranks>` sets the population (1 = none).

  **Droplets have TEMPERAMENT** (lib/webgl/temperament.mjs). Before, every
  droplet sampled the same three gyres at the same gain and differed only in
  TAUP — they differed in response, never in intent, which is why a free body
  read as one mass being carried. Each now has a leash share, a curl gain, a
  signed orbital tendency about its own target, its own drift clock, and a
  sociability multiplier on cohesion — all multipliers on forces that already
  scale by (1 − bind), so the bind contract is untouched. The distribution is
  SKEWED (owner decision): most droplets calmer, a short lively tail.
  `?ftemper=0` restores pre-R6 character.

  **A FREE DROPLET IS NOT SPRUNG TO A POINT — it is contained in a
  NEIGHBOURHOOD of one.** This is R6-B, and without it none of the above could
  be seen. The goal-seek was om² · (T − x) with om = OMEGA_K / TAUP, so ω² sat
  between 77 and 343; equilibrium displacement under a steady force is F/ω², and
  the entire ambient current is 0.29 uv/s². Measured, that was 0.4 to 4.2 PIXELS
  of wander on a droplet 20 px across — every environmental force in the core
  was a whisper against that spring, and per-droplet character only varied which
  whisper a droplet got. Inside the leash (FLUID.LEASH_R × its radius × roam ×
  (1 − bind)) there is now no restoring force and a tenth of the damping, so the
  flow genuinely ADVECTS the droplet; outside, a full spring returns it to the
  nearest point on the leash — never to the centre, which would be a bouncing
  ball rather than contained liquid. The curl field's octaves were also
  re-clocked: they drifted at 57-140 SECOND periods, which is a frozen vector
  field over any watch a visitor gives it, and free droplets simply settled into
  it. They now turn over in 3-16 s, fine structure faster than coarse.

  **THE FLOW IS CURL NOISE, AND THE LEASH BREATHES.** Freeing the droplets was
  not enough on its own, because the field carrying them was four sinusoid
  octaves whose finest wavelength was 0.36 uv while neighbouring droplets sit
  ~0.07 uv apart. Every droplet in a body was inside one eddy and got the same
  push, so bodies translated as rigid pieces — measured, the velocity directions
  of droplets within three radii correlated at 0.51, and a body that moves as
  one piece reads as choreography whatever its parts may do. The potential is
  now value-noise fBm and the flow is its curl (lib/webgl/noise.mjs) —
  divergence-free by identity, rough at every scale, aperiodic, with an octave
  ladder reaching down to 0.085 uv so neighbours can finally disagree. Each
  droplet's own drift is fBm in time rather than a sine, which retraced its path
  exactly. And `roam` breathes on its own aperiodic clock (FLUID.EXCURSION), so
  at any moment most of the body is on a short tether and a few droplets are on
  a long one — they break away, cross the composition and are drawn back. That
  is intermittency, which is what liquid actually does.

  Measured on a still composition at bind 0, across the three changes:

  | | offset (radii) | travel /10 s | neighbour coherence | revisits |
  |---|---|---|---|---|
  | pre-R6-B | 0.19 | 1.6 | — | — |
  | + leash | 2.80 | 11.5 | 0.51 | 17% |
  | + curl noise | 3.03 | 9.8 | 0.18 | 28% |
  | + excursions | 2.43 (p90 5.25) | 10.5 | 0.16 | 16% |

  …while the body's own radius of gyration moves 1.3%. The macro composition is
  preserved; its parts are not. `?fleash=0` restores the point-spring exactly.
  Pinch-off measures strain PAST the leash — distance from target is no longer
  strain, and left uncorrected the field sheds spray continuously and never
  reports idle. `verify/conductor.mjs` gates both halves (free liquid must
  travel, the body must not) and `probe/wander.mjs` is the harness; its
  coherence and revival columns are the numbers for "does this look
  choreographed", which nothing else here can see.

  The pair force gains a uniform grid above 96 droplets (below it every pair is
  tested in the original order, bit-identical). `verify/conductor.mjs` gates
  the population, the bind gate, grid/all-pairs agreement, the binner against
  brute force, and the freedom/containment pair; `probe/ball-budget.mjs` is the
  cost harness and `probe/wander.mjs` is the freedom harness.

## 4. Non-Negotiable Rules

1. **One liquid means one persistent homepage canvas.** The same canonical 48
   AUTHORED droplets travel from Hero to Footer, now carrying a mote population
   derived from them (R6). Do not add per-chapter canvases,
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
   `docs/specs/metaball-morph-spec.md`.
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
    The FORM's liquid (`docs/specs/field-liquid-spec.md`) is additive on the same terms:
    it draws outlines and nothing else. `data-fieldliquid` is set only after the
    layer has mounted AND drawn, every rule that changes a field is gated on it,
    and labels, values, validation, the error summary and the focus outline stay
    exactly where they were. Reduced motion, no-JS and any mount failure fall
    through to the bordered form, complete and usable.
11. **CTA hierarchy and intent are load-bearing.** Keep the placement map in
    `docs/specs/build-spec.md §7.2`. Every contact CTA carries its entry-intent tag.
    Homepage CTAs use Lenis smooth-scroll plus `history.replaceState`; cross-page
    CTAs keep routed navigation.
    The CTA surface itself is the MEMBRANE (`docs/specs/cta-membrane-spec.md`): the field's
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

**Chapter copy arrives on THE WETTING EDGE, not on a fade.** A reading front
travels through a block as it crosses the viewport — dry paper ahead of it, the
type role's own resting colour behind it, brand cyan and a share of the liquid's
bloom on the front itself. It is scrubbed from geometry and reversible; nothing
fades, translates or blurs. `lib/motion/wet-edge.ts` writes one number per block
per frame (`--wet-p`) from ONE rAF and ONE IntersectionObserver for the whole
page; `components/ui/WetType.tsx` splits the words at render time; the
stylesheet derives everything else. It fails safe on `data-wet` exactly as
`--origin-scrub` does, so reduced motion, no-JS, pre-hydration and static tiers
get full-strength copy. It runs on chapter headlines and the copy under them in
two PAINTS: `ink` moves the word's own colour, and `glass` lays a veil over
Bricolage display type — whose glyphs are cut out of `--liquid-glass-fill` by
the block's `background-clip: text`, so a word there has no ink to move and a
colour would paint flat over the signature surface. Unlit glass, lit by the
front. That glass now applies at EVERY width (the mobile aperture its ≥768px
gate protected against no longer exists), and the dry state keeps more presence
below 768px because a phone shows far more of a block at once. S7 is excluded
from both the front and the glass: it has its own horizon wipe, and its display
statements have a documented opt-out from the fill — ungating one without the
other silently hands S7 the treatment it refuses. The
pace is measured off the reference rather than guessed — a reading line at
0.48 vh with the window straddling it symmetrically, so half-reveal lands on
the line for a block of any height. `npm run wet` is the gate;
`npm run wet:sheet` is the filmstrip. See build-spec §4.4.

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
  (`scripts/tools/generate-intro-trace.mjs` → `lib/animation/intro-trace.data.mjs`);
  do not hand-author paths for it.
- `lib/motion/coalesce.mjs` is the merge kernel: the drop that rides S10's form,
  the wetted foot it sits in, and the filament it is pulled off on. Crisp
  geometry, never a `feGaussianBlur` goo filter — a blurred hairline is a glow,
  and a raster pass on a live surface is the second visual engine §4.15 forbids.
  THE BRIDGE IS AUTHORED, not derived (`docs/specs/field-liquid-spec.md §2`). A
  smooth-minimum — the vector half of what `sdf-glass-shader.mjs` runs on the
  GPU — merges two bodies correctly but CANNOT make a neck: its bridge is always
  fat and vanishes in one frame rather than thinning. So the profile is traced
  as a graph over the NECK AXIS with an authored foot, throat and bulb, which is
  what lets the filament stretch 42 px and break by thinning to nothing.
  SOFT TO SOFT: the fields are rounded (`FIELD_R`), which removes every cusp
  from the ring and lets tension carry around the corners instead of dying in
  them. The corner rule survives in that form — the bridge grows out of the
  STRAIGHT run of an edge or not at all, and never reaches an arc.
  Motion smoothness comes from smoothing the TARGET, not the response: a spring
  chasing a step target has its peak acceleration at t=0, so every hop began
  with an 18 750 px/s² kick that no amount of softening ω could remove.
  `TARGET_TAU` cut peak jerk 6.3x. An idle form runs the TOUR: the drop walks
  the fields on its own, ~6.0 s a lap, self-paced off `bead.arrived` (geometric
  — the drop is touching) rather than `bead.settled` (arithmetic, and 656 ms of
  every stop is its sub-pixel tail). The tour BRUSHES, focus FUSES. The drop
  The drop's OUTLINE STAYS ON, merged or not — it sits half-submerged in its
  own meniscus rather than being hidden and cross-faded. Its stroke is COPIED
  from the host contour's computed value each frame: while the bridge is formed
  the two draw the same circle, and two coincident strokes are one stroke only
  if they are identical. Different colours there read as a blink with no fade
  in it. Hiding it needed a
  cross-fade, which needed a dissolve, which needed a dwell long enough to play
  in; not hiding it needed nothing. The `wet` state survives from that work and
  is independently right: the field holding the drop lights to cyan-deep, so the
  liquid lands on something lit instead of a dim grey hairline.
  It YIELDS the moment focus or hover arrives. It is not the
  runtime's tide — that makes every CTA breathe at once, which on a form
  somebody is typing into reads as instability. One drop, and it gets out of
  the way. It reads `handle.visible` so an unseen form costs nothing.
- `lib/motion/membrane.mjs` is the vector liquid's kernel: DOM-free and
  deterministic like the `.mjs` field kernels, so `verify/membrane.mjs` runs it
  in plain node. `lib/motion/membrane-runtime.ts` owns the ONE rAF, the one
  pointer listener and the one scroll listener that every vector-liquid surface
  on a page shares — do not give a button its own loop.
  Gates: `verify/membrane.mjs` (physics), `verify/membrane-mobile.mjs` (the
  autonomous half, in real device profiles), `capture/membrane.mjs` (state
  stills, virtual-clock driven).
- **There is deliberately no `app/[locale]/loading.tsx`.** Its Suspense boundary
  flushed the document shell — and a 200 status — before `notFound()` could run,
  so every unmatched path answered as a soft 404. Route transitions are covered
  by the cyan wipe in `template.tsx`, which now plays only on client navigation
  (a document's first paint has nothing to transition from). The localized 404's
  head comes from the sibling layouts at `[locale]/[...rest]` and
  `[locale]/work/[slug]`: a `not-found` boundary cannot export
  `generateMetadata`, but a layout that never throws can.
- `lib/motion/rail.mjs` is THE WATERLINE — the chapter rail, and the third
  member of the vector-liquid family beside the membrane and the coalescing
  drop. The rail is no longer nine numbers in a column; it is the page's own
  edge seen from the side: a dotted line the height of the viewport in which
  the LIT RUN is the part of the document on screen (a real proportional thumb,
  floored at `MIN_RUN` because 29 000 px of homepage against a 900 px viewport
  makes an honest thumb two dots), the MARKS are the nine chapters at their
  TRUE document positions rather than at nine equal steps, and the SWELL is the
  hand. A dot and a dash are one primitive at two extensions.
  Its contract is the membrane's, in one dimension: DISPLACEMENT, NOT
  INFLATION. Each lobe is mean-removed against its own involvement window, so
  the extensions sum to zero and the swell is paid for by the tautening beside
  it — a rail that only bulges is a dock magnifier in the site's palette.
  Two rules keep it legible rather than merely correct. The epsilon snap is
  taken on the WHOLE rail, never dot by dot, because zeroing individual dots
  puts material back into a sum that is supposed to be exact. And a READING
  (a mark, the lit run, the live chapter) rides the swell but never renders the
  withdrawal — the surface deforms both ways, the things painted on it do not.
  Extension is feedback, cyan is information, and the two channels stay
  separate: that is what lets one object be the scrollbar and the chapter index
  without either half reading as decoration.
  **NO NAME TAG.** The rail is a map, not a menu — a map does not label the
  ground under your finger. An earlier cut opened a chapter's name beside the
  cursor and it was the one loud thing left on a surface whose whole argument
  is quiet. The name survives in `sr-only` (always) and on `:focus-visible`
  only, where a sighted keyboard reader lands on a deliberately invisible dot
  and a ring alone cannot say which of nine it is. A pointer never sees it, and
  `capture/rail.mjs` fails if one ever appears under a hand.
  It is STRICTLY ADDITIVE. `data-rail` is set only after the kernel has mounted
  AND drawn, every rule that changes the rail is gated on it, and reduced
  motion, no-JS, no fine pointer and any mount failure keep the numbered column
  it replaced — complete and keyboard-navigable. The rail still rests inside
  `--rail-safe`; only the two homepage blocks that reach the page's right edge
  (the Studio role grid and the Work strip) claim that column, and `PageStage`
  measures the rail rather than hardcoding it. `MAX_EXT` is chosen so the swell
  cannot reach past it into the copy.
  Scroll geometry arrives through `travel` on the shared membrane runtime, not
  through a listener of the rail's own: `scrollHeight` inside the write phase
  is a forced synchronous layout once a frame, with Lenis moving the page
  underneath it.
  **FIXED CHROME MUST NOT TRUST ITS OWN HEIGHT DURING A ROUTE CHANGE.**
  `position: fixed` resolves against the nearest ancestor carrying a transform,
  and `template.tsx` animates `y` on a wrapper around the whole page for half a
  second of every client-side navigation. Measured in that window the rail's
  box is the DOCUMENT's height — it came back ~29 000 px, and because the dots
  keep their pitch the visible top of the rail still looked correct while every
  mark, the lit run and the live chapter were laid out below the fold. It read
  as a decorative dotted line that had stopped working, after a round trip to a
  legal page. The span is therefore clamped to the viewport, and the rail
  observes its OWN box as well as the document's — the document has stopped
  resizing by the time the transform is removed, so only the second observation
  ends the stale layout. Anything else that CACHES a measurement of fixed
  chrome has the same exposure.
  Gates: `verify/rail.mjs` (physics, in plain node), `capture/rail.mjs` (state
  stills — and it must scroll with the WHEEL, because Lenis eases a native
  `scrollTo` straight back out and the stills then lie about where the page
  was).

## 8. Working Conventions

- Inspect the worktree before editing. Preserve user changes and unrelated work.
- When dead, obsolete, or unused code is confirmed, move the file or module to
  the repository-root `Dead Code/` folder instead of leaving it in an active
  source directory or permanently deleting it. Preserve the original relative
  path where practical, record the move and evidence in `Dead Code/README.md`,
  remove every active import/script/config reference, and keep `Dead Code/`
  excluded from builds, type checks, lint, and deployment. Restore code only by
  moving it back into the active tree and re-running the relevant gates.
  - This convention is AUTHORITATIVE and supersedes
    `docs/decisions/0001-dead-code-quarantine.md`, which proposed retiring the
    folder and was never enacted here. That decision is marked superseded and
    kept for the 2026-08-31 audit reasoning it records.
  - **`/Dead Code/` is listed in `.gitignore`, so quarantining has a trap.**
    `git mv` on an already-tracked file keeps it tracked as a rename, so moves
    look fine. A file you CREATE under `Dead Code/` — extracted CSS, a split
    module, a note — is silently invisible to git and will not survive a
    clone, and it will not appear in `git status` to warn you. Finish every
    quarantine with `git add -f "Dead Code/<new file>"` and then confirm the
    whole bundle with `git ls-files --error-unmatch` on each path. The
    2026-09-03 and 2026-09-04 removals both hit this.
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
- Contact gather/exhale and Footer release;
- the chapter rail's swell, tautening and lit run — the one piece of chrome
  that answers a hand, and the only surface a reader touches while reading.

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
  `node scripts/verify/conductor.mjs` and transition diagnostics.
- Homepage canvas change: `node scripts/verify/canvas-count.mjs` must report
  exactly one liquid canvas.
- CTA/navigation change: the conversion-path gate `verify/cta.mjs` was
  quarantined on 2026-09-04 with S10 (`Dead Code/README.md`) — its entire
  subject was the contact form. Until an intent destination exists again,
  `verify/a11y.mjs` is the standing navigation gate.
- Form-liquid change (`coalesce.mjs`, `FieldLiquid.tsx`, the S10 controls).
  S10 WAS QUARANTINED on 2026-09-04: `FieldLiquid.tsx` now lives in
  `Dead Code/components/chapters/` and there is no form on the site for it to
  dress. `lib/motion/coalesce.mjs` deliberately stayed active — it is DOM-free,
  and the two node gates below still exercise the kernel directly, which is
  what keeps a restore cheap. The page-level contact sheet went with the form.
  `node scripts/verify/coalesce.mjs` (`npm run liquid:form`) — smin exactness,
  byte-exact rest, the reach, the handover silhouette, a simple closed curve,
  the bead's travel and mass, cost, corner clearance, and the squared-off guard.
  `npm run liquid:form:sheet` renders the bridge at 5x straight from the kernel:
  REVIEW THAT BEFORE the page stills, because a 16 px detail on a 576 px form is
  not judgeable at 1x — this surface has twice shipped a defect that survived
  rounds of full-form screenshots. The page contact sheet
  (`capture/field-liquid.mjs`: rest · fused · four travel ages · the hold at the
  submit button · hover · invalid · BROKEN · reduced motion) needs a mounted
  form, so it moved to `Dead Code/scripts/obsolete/capture-field-liquid.mjs`
  with it. Restore both together: its `ONLY=broken` pass blocks the kernel's
  chunk and asserts the form survives it — the merge kernel is imported
  dynamically inside the effect precisely so a bad module cannot take the
  contact form down with it, and that guard is only meaningful on a real page.
- Disclosure change (S4 instrument band): `node scripts/verify/disclose.mjs` —
  the additive `data-disclose` contract, an open that ramps and lands exactly
  on the slab, a close that starts moving on the first frame and is NOT the
  open mirrored (the easeReverse gate: ~25% of slab at the midpoint, where a
  mirrored entry would be ~97%), content that outlives the exit, an
  interrupted open that collapses from where it was, find-in-page taking the
  state without the choreography, and reduced-motion / no-JS falling back to a
  plain instant `<details>`. It also gates THE PIN: the pillar name must hold
  its line to under 2px on every frame of both directions, because the stage
  centres its copy column and an uncompensated open levers the headline
  165.7px upward. `node scripts/capture/disclose.mjs` is the review contact
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
- Entry-intro change: `node scripts/verify/entry-veil.mjs` — plays on EVERY
  document load (a reload replays it; a locale switch and any other same-document
  remount are suppressed), releases inside its budget, never paints under `?f*`
  or reduced motion, NEVER animates opacity on any layer, renders the drawn line
  and the liquid body from one path, and the skip drives its own exit rather
  than letting the hard cap do it. `npm run intro:sheet` is the review contact
  sheet; `npm run intro:trace` regenerates the geometry from the mark and MUST
  be re-run if `public/brand/zirtuno-logo-mark.svg` ever changes.
- Performance/tier change: chapter sheets plus `verify/perf.mjs` on relevant
  hardware.
- Optics/grade change: `node scripts/verify/postfx.mjs` (statistical `?fgrade=0`
  equivalence, banding, seam, full-nofx drill, governor cadence) and
  `node scripts/verify/rest-exact.mjs` (settled-still byte gate — the machine
  teeth behind "rest must remain exact"; conscious re-baselines rerun its
  `--baseline` and commit `scripts/fixtures/rest-exact.json`).
- Cinematic/scene/score change: `node scripts/verify/cinematics.mjs` —
  no Origin flash surface or score channel, exactly two act-fade bands on their
  seams (peak ≤ 0.41, released at every reading rest), living liquid over Work/Studio/
  the footer release, meniscus wiring, and the transient-contrast floor
  (≥ 3.5:1 under the fade peak; standing reads are veil-free).
- Tier/viewport/renderer-lifecycle change (R5-E hardening gates):
  `node scripts/verify/devices.mjs` (emulated matrix: iPhone-class live +
  static, Android-class lite-must-be-live, full-nofx rung, no horizontal
  overflow, stage == 100svh), `node scripts/verify/context-loss.mjs`
  (§12.5: the loop parks on loss, restore resumes mid-page state), and —
  for battery/cadence claims — `SOAK_MIN=30 node scripts/verify/soak.mjs`
  against a production build (governor holds idle, no idle demotion, flat
  heap, never frozen).
- Hero headline change (`WordCycle.tsx`, `.lab-word*` in `lab.css`, the
  `lab.words` set, or anything that measures inside `.lab-plane`):
  `node scripts/verify/hero-word.mjs` (`npm run hero:word`) — the rotating
  noun fits the slot measured for it and clears the fixed words either side,
  on a cold load AND on arrival from another route. That second case is the
  point: `PageTransition` holds the arriving page at `scale(.8)`, so anything
  measured with `getBoundingClientRect()` on mount is measured at 80% and
  stays there — layout never changes, so no ResizeObserver ever corrects it.
  Measure with the used `width` (or `offsetWidth`), never with a painted rect.
- Copy/semantics/locale/chrome change: `node scripts/verify/a11y.mjs`
  (landmarks, one h1, labels, skip link, keyboard menu, focus visibility,
  effective-background contrast, pt/en key parity, reduced-motion story).
- Ecosystem gathering change (`gathering.mjs`, the S3 scene block, the
  capability names, system markers, or the column): `node
  scripts/verify/ecosystem.mjs` — ten names and three system markers drawn,
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
