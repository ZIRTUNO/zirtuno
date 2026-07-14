# Zirtuno Website — Build Specification v0.3

> Product, experience, architecture, and delivery specification for the
> redeveloped “One Continuous Liquid” website.
>
> Version date: 2026-07-10.
>
> Current implementation baseline: R5-A, R5-B, R5-C, and R5-D are complete.
> R5-E hardening and launch truth remain active delivery work. This document
> describes both the protected implementation and unfinished acceptance work.

## 0. How to Use This Document

Read `AGENTS.md` first. It owns non-negotiable behavior and taste. Use this
document to understand what to build and how completion is judged. Use
`metaball-morph-spec.md` for exact liquid mechanics and `references.md` for
task-specific technical sources.

Labels used here:

- **LOCKED** — approved requirement; changing it requires owner approval.
- **CURRENT** — implemented in the repository and protected by existing tests.
- **TARGET** — approved R5 requirement that is not complete yet.
- **OPEN** — owner decision still required; use the documented default and add
  `TODO(decision)` at the relevant implementation boundary.

The shipped copy source is
`lib/i18n/messages/pt.json` and `lib/i18n/messages/en.json`. This spec defines
the content job, hierarchy, and required ideas; it does not duplicate all 179
locale keys. If prose here and a message file diverge, reconcile the message
files intentionally rather than hard-coding a third version in a component.

### 0.1 Supersession

This v0.3 specification replaces:

- the v0.2 build order and multi-canvas WebGL assumptions;
- the R0–R4 sequence in `improvement-plan.md`;
- the standalone R5 plan in `tingly-frolicking-stream.md`;
- chronological/contradictory engine generations in the old morph roadmap.

The durable decisions from those sources are integrated here and in
`metaball-morph-spec.md`. Git history retains the discarded implementation
history. Do not restore a retired file or technique merely because an old commit
or comment mentions it.

## 1. Redevelopment Contract

### 1.1 What is preserved

| Area                    | Preserved contract                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Brand                   | pure black, Zirtuno cyan family, exact owner-traced mark and seven forms, liquid-glass material |
| Business                | complete digital ecosystems across software, AI, automation, data, branding, and marketing      |
| IA                      | nine business-first chapters, with the poetic Origin after proof and before Contact             |
| Content                 | authored PT-BR/EN copy, seven service pillars, five method phases, CTA/intent system            |
| Truth                   | no fabricated metrics; verified outcome, honest narrative, or selected architecture             |
| Platform                | Next.js RSC/SEO, Sanity, Resend, accessibility, reduced-motion and static fallbacks             |
| Visual substrate        | SDF pipeline, unified field shader, exact form assets, §3.3 liquid bridge, runtime tier probe   |
| Choreography vocabulary | assembly, pour, fracture, seek, bloom, rehearse, current, fuse, gather, release                 |
| QA                      | deterministic forms, melts, cursor, chapter sheets, conductor simulation, CTA and canvas checks |

### 1.2 What is rebuilt

The site is no longer a set of independent liquid scenes. One page-wide
conductor owns the same droplets from Hero through Footer. The visual system
gains real fluid dynamics, then R5-C optics and R5-D cinematic scoring.

The old `LiquidSite`, `MethodFlow`, `OriginFlow`, and contact canvas model is
retired. Seven coordinated scene modules now carry the choreography through
the true page bottom inside the conductor.

### 1.3 What is discarded

- Three.js, React Three Fiber, Drei, raymarched and mesh metaball engines.
- Per-chapter homepage canvases and canvas mount/unmount as transition logic.
- GPU-name blocklists, `can-run-glass`, and the old `?glass=` API.
- SDF-to-metaball or SVG-to-canvas crossfades as morphs.
- First-order target chasing as the only liquid motion.
- Liquid-free Work and Studio spans in the final target.
- Horizontal/icon-led Método and generic fade-up-only choreography.
- Repeated chapter hairlines as the primary separator.
- The former mythology-led “The Name” chapter.
- Text-box portfolio placeholders without visual presence.
- Hidden/symbol-only contact submission.
- Any metric, client fact, or contact detail invented for completeness.

## 2. Product and Brand Specification

### 2.1 Positioning

Zirtuno builds complete digital ecosystems, not isolated deliverables. The
website must make this legible within the first hero reading:

1. what the studio builds;
2. which disciplines are connected;
3. why connection matters for growth; and
4. what the visitor should do next.

### 2.2 Strategic/poetic balance

The page is **70% strategic clarity and 30% poetic brand atmosphere**.

- Hero, Problem, Ecosystem, Services, Método, Work, and Contact lead with
  business meaning.
- Poetic language is an accent in the Hero eyebrow, service descriptors,
  Origin, Contact prompt, and manifesto coda.
- Origin is the emotional peak because the commercial case has already been
  established.
- Visual spectacle may deepen meaning but may not obscure offer, proof, or
  action.

### 2.3 Brand meaning

The liquid is the breath made visible: quiet force that gives form to dispersed
parts. Zéfiro + Ventura remains a subtle grace note. The main Origin is the true
story of two brothers, three founding pillars, and a shared drive to build what
does not yet exist.

### 2.4 Voice

- Discreet, precise, transformative.
- Clear, strategic, commercially strong.
- Confident without hype.
- Poetic without vagueness.
- Technical without jargon dumping.
- Honest about outcomes and project status.

### 2.5 Primary success path

A first-time visitor should be able to:

1. understand the offer in Hero;
2. recognize the fragmentation problem;
3. see connection as the differentiator;
4. understand services and method;
5. evaluate honest work;
6. connect emotionally with the Origin;
7. understand who/where/why the studio is; and
8. request an initial analysis through an obvious labeled action.

## 3. Experience Architecture: Five Acts

One `PageStage` canvas extends from Hero through the Footer. The canonical 48
droplets retain identity throughout. Sections remain semantic DOM chapters;
the liquid and light compose them into acts.

| Act            | Chapter span                   | Business job                                            | Liquid behavior                                                                                     | Light behavior                                                |
| -------------- | ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| I — Signal     | Entry veil → Hero              | establish the brand and offer immediately               | particles assemble the wordmark, hand off to the mark, then cycle the seven forms                   | black field, first cyan bloom                                 |
| II — Argument  | Problem → Ecosystem → Services | name fragmentation, prove connection, show capabilities | mark pours, fractures by symptom, seeks itself, reunifies, blooms through the seven forms           | slow dip through Problem, rise at convergence                 |
| III — Practice | Método → Work                  | show strategic process and proof                        | five rehearsal states become a quiet current behind the work grid; hovered card receives a meniscus | neutral/workmanlike; fade-to-black boundary before Work       |
| IV — Soul      | Origin → Studio                | reveal the true origin and human reason                 | two brother-masses fuse into the exact mark, echo into satellites, remain behind the role grid      | one cyan-white flash, afterglow, settle; boundary into Studio |
| V — Invitation | Contact → Footer               | convert and close the narrative                         | all droplets gather into the mark, submit exhales, one droplet releases beyond the footer           | calm and final return to black                                |

### 3.1 Named transitions

These names are part of the implementation vocabulary:

1. **Assembly** — entry wordmark particles converge and release the first mark.
2. **Pour** — the unified hero form loses rigidity and flows into Problem.
3. **Fracture** — seven symptoms progressively separate coherent liquid chunks.
4. **Seek** — free fragments attract, align, and begin reconnecting.
5. **Bloom** — the exact mark expands through the seven service form states.
6. **Rehearse** — the liquid performs Diagnosis through Evolution.
7. **Current** — Evolution satellites drain into a calm Work backdrop and card
   meniscus.
8. **Fuse + flash** — two Origin masses form the exact mark and trigger the
   site’s only flash.
9. **Gather** — echoes and free droplets return to the Contact mark.
10. **Release** — submit exhale and the final lone droplet leave the page.

Every transition is a handoff of the same droplets. A visual swap, opacity cut
between engines, or remounted canvas does not satisfy this requirement.

### 3.2 Section boundaries

Act and chapter transitions use:

- liquid state and direction;
- exposure/veil/vignette score;
- deliberate empty space;
- typography and content pacing.

Do not restore eight repeated top borders. Hairlines may remain inside cards,
forms, timelines, or case-study UI where they express structure rather than
separating the cinematic page.

## 4. Design and Motion System

### 4.1 Color tokens

```css
--color-ink: #000000;
--color-surface: #0a0a0c;
--color-cyan: #00e3fe;
--color-cyan-glow: #4decff;
--color-cyan-deep: #00b6cc;
--color-paper: #f2f0eb;
--color-paper-mute: rgba(242, 240, 235, 0.56);
--color-paper-soft: rgba(242, 240, 235, 0.42);
--color-paper-dim: rgba(242, 240, 235, 0.3);
--color-paper-faint: rgba(242, 240, 235, 0.1);
--color-warn: #ff6b5c;
```

`globals.css` is the executable token source. The cyan family is the entire
brand color range. `--color-warn` is for form errors only.

R5-C light effects may alter intensity, absorbance, exposure, and depth. They
may not introduce new hues. Bloom is an internal cyan highlight, not a
permanent outer neon halo around every form.

### 4.2 Typography

| Role    | Family/utility                           | Required use                                                 |
| ------- | ---------------------------------------- | ------------------------------------------------------------ |
| Display | Bricolage Grotesque / `font-grotesk`     | hero headline and every chapter `h2`                         |
| Text    | Geist / `font-sans`                      | body, UI, nav, leads, subheads, forms, card and phase titles |
| Poetry  | Instrument Serif italic / `font-display` | approved poetic accents only                                 |
| System  | JetBrains Mono / `font-mono`             | labels, counters, numbers, CTA text, metadata                |

Use the fluid `--text-*` tiers in `globals.css`:

- display: `hero`, `display-xl`, `display-l`, `display-m`;
- title: `title`;
- text: `poetic`, `lead`, `body-l`, `body`, `body-s`;
- mono: `mono`, `mono-sm`.

The executable system also binds those tiers into semantic roles:

- `type-hero-title`: the commercial hero statement, Bricolage 600;
- `type-section-title` / `type-page-title`: chapter and route-level display;
- `type-feature-title`: high-emphasis Geist statements and phase/service names;
- `type-card-title`: constrained card and next-project titles;
- `type-lead-copy`: the shared lead measure and reading rhythm;
- `type-poetic-title`: the narrow exception for genuinely poetic titles.

Display tiers use compressed desktop leading and optical negative tracking;
mobile leading opens slightly for stacked PT-BR copy and accented capitals.
Hero, display, editorial, lead, and reading measures are character-based tokens,
not arbitrary per-component widths. Card titles never inherit the feature tier,
and scene/chrome labels remain on the compact mono tiers.

Business headlines never use the serif. Bricolage is not body or mid-title text.
Instrument Serif is not a general “premium” decoration.

### 4.3 Layout

- 12-column desktop grid, 4-column mobile grid.
- Mobile page padding: 1.5rem.
- Desktop page padding: 3rem.
- Baseline chapter minimum: 100svh.
- Scroll runways may exceed one viewport where the chapter choreography needs
  distinct beats.
- Liquid is full-bleed beneath semantic content.
- Copy keeps deliberate readable line lengths; the canvas does not dictate text
  width.

### 4.4 Motion language

```text
calm   cubic-bezier(0.65,0,0.35,1)
arrive cubic-bezier(0.22,1,0.36,1)
depart cubic-bezier(0.64,0,0.78,0)
breath cubic-bezier(0.45,0.05,0.55,0.95)

micro 200ms · short 400ms · medium 700ms · long 1200ms
morph 1400ms · autocycle 9000ms · breath 8000ms
```

- GSAP/ScrollTrigger: scroll progress, pins, scrubbed scene/DOM choreography.
- Motion: component entrances, hover/tap/focus, layout and route UI.
- Lenis: smooth scrolling and homepage CTA scroll-to-contact.
- WebGL/conductor: liquid simulation and visual state.

Only one owner controls a property. Generic repeated fade-ups are not the
cinematic language. R5-D’s `Reveal variant="blur"` is reserved for Soul and
Invitation copy; it fades opacity, translates gently, and resolves blur
8px → 0. Reduced motion removes transform, blur, scrub, and flash.

### 4.5 Cinematic light score — CURRENT R5-D

The conductor merges scene contributions into:

- `exposure` — multiplicative, neutral at 1;
- `veil` — maximum black veil;
- `flash` — maximum white/cyan-white flash;
- `vignette` — maximum edge darkening.

`CinematicVeils` is a fixed, pointer-transparent overlay stack. It consumes
score through CSS variables written once per frame by the page shell.

Rules:

- one flash in the entire site, at Origin fusion;
- no flash on reduced motion;
- duration at most 400 ms;
- cyan-white, approximately 85% luminance, no saturated red;
- no more than three flashes in any one-second period—the design uses one;
- act-boundary fades occur at Método → Work and Origin → Studio;
- the page returns to black after the flash; white is a moment, not a theme.

## 5. Technical Architecture

### 5.1 Locked stack

| Layer               | Choice                                                     |
| ------------------- | ---------------------------------------------------------- |
| Framework           | Next.js 16 App Router, React 19, RSC, Turbopack            |
| Language            | TypeScript                                                 |
| Styling             | Tailwind CSS v4, CSS variables                             |
| Field/rendering     | raw WebGL2 + OGL                                           |
| Scroll motion       | GSAP + ScrollTrigger                                       |
| DOM motion          | Motion                                                     |
| Smooth scroll       | Lenis                                                      |
| i18n                | next-intl                                                  |
| CMS                 | Sanity                                                     |
| Forms/email         | react-hook-form, zod, server route/action boundary, Resend |
| Hosting/measurement | Vercel, Vercel Analytics, Plausible                        |

### 5.2 Server/client boundary

Server-render:

- all chapter headlines, leads, service value anatomy, method descriptions,
  project proof, Origin story, studio information, contact copy, navigation,
  metadata, JSON-LD, sitemap, and robots;
- Sanity/project data and locale selection where possible.

Client-enhance:

- WebGL field and post chain;
- DOM measurement and scroll progress;
- Lenis/GSAP/Motion;
- cursor physics and visual labels;
- contact form state and artistic feedback.

The no-JavaScript/no-WebGL reading order must still communicate the complete
offer and expose usable links/form actions as supported by the platform.

### 5.3 PageStage — CURRENT R5-A

`PageStage` wraps Hero through Footer and owns:

- one sticky `journey-layer`;
- one `FieldStage` canvas;
- one requestAnimationFrame measurement loop;
- scene-anchor geometry caching and measurement;
- page-wide pointer and scroll-velocity inputs;
- live DOM annotations for Ecosystem, Método, and Origin;
- scene construction and diagnostic surfaces;
- reduced-motion/no-WebGL/static tier selection.

The layout Footer remains outside `app/[locale]/layout.tsx` and inside each
page. On the homepage it must remain inside `PageStage`.

### 5.4 Scene contract — CURRENT R5-A

A scene module declares:

- stable numeric channels and per-channel damping;
- selectors for single and list anchors;
- a pure `read(geometry, channels)` function;
- `presence(context)`;
- `target(index, context, out)` writing x, y, radius, bind, cluster, z;
- `form(context)` or null;
- optional ambient, extras, activity, score, tick, and form-ready hooks.

Scene rules:

- no DOM access outside `read` and the shell-provided geometry;
- no per-frame allocations in the droplet loop;
- every target field is written on every call;
- scenes describe desired behavior; they do not integrate motion;
- adjacent scenes overlap only through explicit presence windows;
- scene form claims honor the arbiter instead of assuming availability.

**CURRENT modules:** `site`, `method`, `work`, `origin`, `studio`, `contact`,
and `footer`. The aggregate `site` scene owns Hero through Services; dedicated
modules take over where the later acts need independent geometry and score.
This split is behavior-led rather than chapter-count-led and is protected by
the conductor and cinematic verification harnesses.

### 5.5 Conductor — CURRENT R5-A

The conductor owns:

- raw and damped scene channels;
- normalized presence weights;
- per-droplet target blending across handoff windows;
- continuous position/radius identity;
- the two-form-slot arbiter;
- the shared 12-droplet ambient family;
- physics or the legacy integrator;
- extras and the 80-ball budget;
- merged light score;
- energy/activity telemetry;
- stable diagnostics.

**Form invariant:** the current holder must drain to
`fa + fb < EPS_FORM` before another scene receives the form slots. Ownership
passes through a droplet-only state. Cross-scene form crossfades are forbidden.
`scripts/verify-conductor.mjs` must report zero violations.

### 5.6 Fluid physics — CURRENT R5-B

`fluid-core.mjs` uses deterministic state and fixed 8 ms substeps:

- near-critically damped goal-seek with per-droplet mass identity inherited from
  `TAUP`;
- soft-core pairwise repulsion;
- cluster-centroid cohesion;
- analytic divergence-free curl drift;
- page-wide pointer pressure, vortex, and velocity drag;
- pinch-off micro-satellites with inherited velocity and TTL shrink-out;
- velocity clamp and deterministic seeding.

The **bind contract** preserves signed-off choreography:

```text
environmental forces scale by (1 - bind)
output = mix(physics_body, byte_exact_legacy_shadow, bind)
```

- `bind=1`: exact rest footprints and §3.3 melts.
- `bind=0`: pours, scatters, currents, echoes, and other free liquid.
- intermediate bind: continuous blend, never a jump.

`?fphys=0` bypasses the core and runs the pure Phase-A low-pass. Keep it until
R5-E regression sign-off.

The approved Physics-v3 study is reviewable with `?fphysv3=1`. It adds
area-weighted pair response, a bounded attraction/viscosity band, and
cluster-footprint correction without changing the default R5-B path. Add
`?fobstacles=1` to let free droplets deflect around a cached, fixed-budget set
of essential headings and conversion surfaces. Both switches are off by
default until owner capture review; both preserve the exact bind=1 output, and
`?fphys=0` remains the master rollback.

### 5.7 Field renderer — CURRENT R5-A/B

The renderer combines exact SDF form fields and bounded inverse-square
droplets into one iso-surface, then applies the locked internal cyan-glass
lighting. It supports:

- two exact form textures;
- up to 80 balls;
- form erosion/weight/offset/scale/warp;
- glass or flat cyan branch;
- context-loss recovery;
- runtime resolution downshift;
- transparent canvas over the ink-black page.

`?fshape=1` compiles a separate full-tier review shader that gives free
droplets a bounded, area-preserving velocity stretch. It is suppressed under
reduced motion, watchdog demotion, exact forms, and staged §3.3 bridges. The
default/lite shaders keep their original uniform budget and circular field
math. Stable canonical ids carry velocity history; satellites, ambience, and
scene extras remain circular so packed-slot changes cannot create false motion.

The exact math, state registry, bridge behavior, and assets live in
`metaball-morph-spec.md`.

### 5.8 Optics v2 — CURRENT R5-C

The renderer includes a post chain beside the direct path:

```text
scene → RGBA16F when supported, otherwise RGBA8
      → half-resolution bright pass
      → separable Gaussian ping-pong
      → opaque composite: cyan bloom + blue-noise dither + restrained grain
```

Requirements:

- default identity: the current rest output remains exact;
- `?fgrade=0` produces the pre-R5-C readPixels output exactly;
- bloom is selective and restrained, not a permanent neon halo;
- blue-noise dither removes black/exposure banding;
- film grain is luminance-gated and at most 2.5%;
- output is opaque over ink black;
- all framebuffer resources recover after context loss;
- unsupported float targets fall back cleanly to RGBA8.

New shader controls, identity by default:

- `iAbsorb` — Beer-Lambert-inspired internal absorption;
- `iExposure` — global exposure;
- `iKeyBoost` — additive modulation of the locked key light, never re-aimed;
- `iBallZ[80]` and `iDepthFx` — near/far bands and sub-surface depth.

A true key-light re-aim requires an explicit owner decision and new exact visual
baseline.

### 5.9 Tiers and energy — CURRENT R5-C

**Current ladder:**

- full: glass + post + depth;
- full-nofx: glass without post;
- lite: flat cyan, DPR 1, no post;
- half: flat cyan, DPR 0.5, live floor;
- none: initial static fallback only.

The runtime probe measures the actual field workload and is cached per session.
Do not use GPU-name heuristics.

The energy governor may render at 30 Hz when the page is idle and no scene has
meaningful activity. Pointer input, scrolling, scene progress, or liquid energy
restores active cadence. The liquid does not freeze as a watchdog response.

## 6. Chapter Specifications

All chapters keep semantic copy above the visual layer and work in PT-BR/EN.
The copy files define exact strings.

### 6.1 Chapter 01 — Hero / Overture

**Business job:** state the complete-ecosystem offer in the first reading and
offer two clear next actions.

**Content hierarchy:**

1. chapter label;
2. poetic eyebrow;
3. Bricolage positioning headline;
4. Geist subline naming connected disciplines and growth value;
5. `cta.analysis` and `cta.portfolio`;
6. living mark and seven-form indicator.

**Liquid:** entry wordmark assembly hands off to the exact mark. The hero
autocycles mark → web → software → AI → automation → data → branding →
marketing → mark. Gooey cursor interaction merges into the field on fine
pointers. Keyboard users can step states; `aria-live` announces them.

**Acceptance:**

- the offer is understandable without the canvas;
- the primary CTA is above the fold on common sizes;
- exact rest and §3.3 morph gates pass;
- autocycle pauses on focus/hover and when appropriate;
- keyboard, reduced-motion static mark, touch, and no-WebGL paths work;
- assembly does not delay access or strand the page.

### 6.2 Chapter 02 — The Problem

**Business job:** show that disconnected structure—not merely marketing—is the
root problem.

**Content:** headline, lead, seven concrete symptoms, structure CTA.

**Liquid:** the hero mark pours into the chapter, then fractures one step per
symptom. Fragments form readable coherent chunks, become quieter/dimmer, and
remain unresolved at exit. Physics may make free fragments alive; it must not
turn “disconnected” into random confetti.

**Acceptance:**

- each symptom advances the fracture visibly;
- the exit remains unresolved;
- the same droplets continue into Ecosystem seek;
- copy remains server-rendered;
- mobile presents a legible vertical symptom sequence with a simplified live or
  static visual;
- `cta.structure` carries intent `structure`.

### 6.3 Chapter 03 — The Ecosystem

**Business job:** prove “ecosystems, not loose pieces.”

**Content:** commercial headline and lead explaining how brand, site, traffic,
CRM, AI, automation, dashboards, internal systems, service, and content
strengthen one another.

**Liquid:** Problem fragments seek one another, converge into the exact unified
mark, regain vivid cyan, and become the organism’s core. Lines and node labels
grow after—not before—the convergence.

**Diagram:**

- exact mark/unified core with small “Seu negócio / Your business” label;
- ten semantic DOM nodes;
- sequential connection draw with traveling pulses;
- hover/focus highlights node, connection, and explanation;
- very slow whole-organism drift/rotation only if it remains calm;
- mobile becomes a connected vertical stack while keeping the convergence.

**Acceptance:**

- the Problem → Ecosystem continuity is unmistakable;
- all nodes and explanations are accessible without hover;
- it reads as a connected organism, not a list around a logo;
- no literal separate canvas/core swap;
- end CTAs: `cta.structure` and `cta.portfolio`.

### 6.4 Chapter 04 — The Services

**Business job:** explain the seven capabilities commercially.

Each pillar includes:

- index;
- poetic descriptor as a small Instrument Serif accent;
- Geist service name/mid-title;
- “O que é / What it is”;
- “O que resolve / What it solves”;
- “O que gera / What it creates”;
- capability list;
- filtered Work CTA.

Seven pillars/forms:

1. Web Design & Digital Experience;
2. Software & App Development;
3. Artificial Intelligence;
4. Automation & Integrations;
5. Data & Dashboards;
6. Branding & Positioning;
7. Marketing & Growth.

**Liquid:** the unified mark blooms through each exact service form using the
shared bridge. Scroll progress, not a loose IntersectionObserver swap, locks the
active form to the active copy. The final state drains naturally into Método.

**Acceptance:**

- every pillar communicates is/solves/creates;
- poetic language remains visually secondary;
- each form is recognizable and registered to the owner SVG;
- melts track scroll without popping or a crossfade;
- filtered project CTA is correct;
- section-end `cta.analysis` carries intent.

### 6.5 Chapter 05 — Método Zirtuno

**Business job:** show that Zirtuno diagnoses and structures before building.

Phases:

1. Diagnóstico / Diagnosis;
2. Estrutura / Structure;
3. Construção / Construction;
4. Integração / Integration;
5. Evolução / Evolution.

**Layout:** one phase per viewport in the pinned journey. On wide screens,
liquid left and copy right; on mobile, a vertical readable sequence. A vertical
thread fills with progress. The old icon row/horizontal timeline is discarded.

**Liquid rehearsal:**

1. fragmented cloud inspected by a probe droplet;
2. jittered liquid lattice;
3. three masses accrete;
4. exact mark resolves as one organism;
5. mark grows and sheds evolution satellites.

Exit satellites become the Work current.

**Acceptance:**

- phase order and descriptions are complete in both locales;
- the visual state explains each phase rather than decorating it;
- exact Integration mark uses bind;
- exit drains before unstick without a flash or snap;
- end CTAs: `cta.analysis` and `cta.talk`.

### 6.6 Chapter 06 — Selected Work

**Business job:** provide honest primary credibility.

Homepage cards include:

- media or category form still;
- category;
- project name;
- challenge;
- what was built;
- services;
- verified metric, honest narrative, or selected-architecture label;
- project CTA.

Full `/work` provides category filters. `/work/[slug]` includes Challenge,
Architecture Built, Outcome, Credits, and Next Project.

**Liquid — CURRENT R5-D:** evolution satellites become a quiet current behind
the grid. Hover/focus pulls a restrained meniscus toward the active card.
The liquid presents the work; it never replaces crawlable cards or media.

**Content status:** current seed projects are selected-architecture concept
studies available only through explicit non-production demo mode. Every seed
surface carries the persistent concept label. Production never falls back to
them: missing or failed Sanity content yields a truthful empty state. Baked
form stills remain approved placeholder art only for the labeled demo set.

**Acceptance:**

- no fabricated claims;
- at least three real/approved entries for launch, or the whole set is clearly
  framed as selected architectures;
- filters, routes, locale metadata, keyboard focus, and media fallbacks work;
- current remains subtle enough for card reading;
- section-end `cta.portfolio`.

### 6.7 Chapter 07 — The Origin

**Business job:** reveal why Zirtuno exists after the business case is proven.

Five scrubbed beats:

1. two brother-masses enter from opposite sides;
2. they fuse and a third form resolves into the exact Zirtuno mark; small mono
   labels identify Social · Saúde · Finanças / Social · Health · Finance;
3. the mark holds and breathes under the purpose statement;
4. the mark multiplies into an ecosystem echo;
5. droplets drain as CPU wordmark particles assemble ZIRTUNO, followed by
   “Construímos o que ainda não existe / We build what doesn’t exist yet.”

Then the manifesto coda:

- Movimento sem ruído.
- Forma para o que estava disperso.
- Direção, não apenas execução.
- Discreto. Preciso. Transformador.

The Zéfiro/Ventura etymology remains a single dim grace note unless the owner
chooses otherwise. Three founding pillars are the WHY; seven services are the
HOW. Never style or count them as the same system.

**Flash — CURRENT R5-D:** exact mark fusion triggers the site’s one controlled
cyan-white flash, then afterglow. It fires once per traversal and never under
reduced motion.

**Acceptance:**

- the story reads as the true Origin, not borrowed mythology;
- two → three → exact mark is visually legible;
- pillar labels remain understated and distinct from services;
- wordmark particles resolve legibly in both locales;
- static/reduced-motion mode presents all beats as a plain reading sequence;
- flash and blur-reveal gates pass.

### 6.8 Chapter 08 — The Studio

**Business job:** answer where, who, and why without repeating Método.

Sections:

- Where: Curitiba/location;
- Who: anonymous role grid by default;
- Why: closing purpose line;
- CTA: `cta.talk`.

**Liquid — CURRENT R5-D:** Origin echo satellites persist behind the roles grid,
settling from afterglow into quiet presence. Copy stays dominant.

**Acceptance:**

- Where/Who/Why are present;
- no duplicate process block;
- role grid works without portraits;
- echoes do not reduce contrast or create an unmotivated new form;
- Talk CTA works.

### 6.9 Chapter 09 — Contact / The Beginning

**Business job:** convert with clarity and a calm final invitation.

Content:

- poetic prompt;
- plain-language explanation of the initial analysis;
- name, email, optional company, problem/structure textarea;
- hidden entry intent;
- obvious labeled submit;
- WhatsApp, domain email, and approved social paths.

**Liquid:** every surviving droplet gathers into the exact resting mark above
the form. Confirmed delivery emits the exhale as additive success feedback.
R5-D completes the gather from Studio; the Footer release sends one droplet
beyond the page, sharing identity with the 404’s lone drop.

**Submission:** validate with zod, bound the streamed body, rate-limit and
idempotently send with a stable per-submission ID, confirm delivery before
success, retain form state on error or accepted/pending delivery, verify final
provider webhooks, announce every state accessibly, include intent.

**Acceptance:**

- labeled submit is always present and canonical;
- entry intent is correct from every CTA;
- email is received with the intent in production QA;
- exhale is not required to submit and is absent/reduced appropriately;
- secondary paths are real and approved;
- success and error states remain readable and keyboard accessible.

### 6.10 Footer Coda

Footer content remains minimal: Zirtuno/copyright, language, approved social
paths, and Talk CTA.

On homepage routes the Footer is inside `PageStage`. It does not use a repeated
chapter border as its primary entrance. The release transition carries the last
droplet past the footer and completes the page fade to black.

## 7. Conversion, Content, and Data

### 7.1 Canonical CTA set

| Key             | PT-BR                     | EN                       | Variant         | Action/intent                |
| --------------- | ------------------------- | ------------------------ | --------------- | ---------------------------- |
| `cta.analysis`  | Solicitar análise inicial | Request initial analysis | primary         | Contact, `analysis`          |
| `cta.portfolio` | Ver portfólio             | See portfolio            | secondary       | `/work`                      |
| `cta.structure` | Estruturar meu digital    | Structure my digital     | primary         | Contact, `structure`         |
| `cta.talk`      | Falar com a Zirtuno       | Talk to Zirtuno          | ghost/secondary | Contact or approved WhatsApp |

### 7.2 CTA placement map — LOCKED

- TopBar: Talk.
- Hero: Analysis + Portfolio.
- Problem end: Structure.
- Ecosystem end: Structure + Portfolio.
- Each Service: filtered Work link; Services end: Analysis.
- Método end: Analysis + Talk.
- Each Work card: project link; Work end: Portfolio.
- Studio end: Talk.
- Contact: labeled Analysis submit plus approved secondary contact paths.
- Mobile menu: Analysis pinned as primary action.

Homepage contact CTAs smooth-scroll with Lenis and update intent using
`history.replaceState` without a same-page router navigation. Cross-page CTAs
route back to Contact with the intent encoded and recoverable.

### 7.3 Portfolio truth model

Sanity project fields:

```text
title, slug, localized challenge/built/outcome,
category[], servicesInvolved[], outcomeType,
previewMedia, gallery[], credits, liveUrl,
featured, order
```

`outcomeType` is one of:

- `metric` — verified number with source/owner confirmation;
- `narrative` — factual qualitative impact;
- `architecture` — explicit selected architecture/prototype framing.

Never upgrade a narrative to a metric for visual impact.

### 7.4 Contact and environment truth

Local development may omit launch integrations and may enable the explicit
portfolio demo source. Production has no prototype/contact fallbacks and
requires:

- real Sanity project configuration or approved static real content;
- verified Resend sender and delivery address;
- approved WhatsApp URL;
- domain email;
- canonical site URL;
- approved social handles.

Placeholder Gmail/phone/social defaults are not brand-approved launch content.

## 8. Responsive, Accessibility, Performance, and SEO

### 8.1 Responsive

- Desktop/full: complete five-act choreography where the probe permits.
- Integrated desktop: live field at appropriate tier; do not replace a capable
  device with a static logo solely by GPU name.
- Mobile: live lite field when probe/thermal behavior permits; vertical chapter
  structures; no fine-pointer cursor chain; simplified labels and diagram.
- Reduced motion: static exact forms, plain reading sequence, no scrub, no
  autocycle, no type breathing, no flash, no decorative release dependency.
- No WebGL/context failure: static SVG/form stills with the complete semantic
  page and conversion path.

Use `svh` carefully and validate sticky behavior on iOS. Avoid horizontal
overflow from full-bleed layers and long localized copy.

### 8.2 Accessibility

- WCAG AA contrast for text and controls.
- Skip link, semantic headings/regions, keyboard navigation, visible focus.
- Hero form states announced without excessive live-region chatter.
- Ecosystem explanations available to focus/touch, not hover-only.
- Contact validation and status announced and associated with fields.
- Animations never carry the only information.
- One Origin flash stays under WCAG thresholds and is absent for reduced motion.
- Touch targets and mobile menu remain usable at 200% zoom.

### 8.3 Performance

- One homepage liquid canvas.
- One measurement loop and cached selector sets.
- No per-droplet allocations.
- Actual workload probe; no GPU-name blocklist.
- Resolution/effects/cadence degrade before liveness.
- Fixed-step physics remains NaN-free and bounded.
- Post chain uses half-resolution bloom and cleans every GL resource.
- Font loading uses `next/font`; images use responsive optimization.
- Work media is lazy and non-blocking.
- Context loss restores the field without stranding content.

Targets/gates:

- full tier at least 55 fps on owner hardware after R5-C;
- physics settles within 1.5s where a scene expects rest;
- 10,000-frame simulation remains finite;
- Work/Studio performance remains within the agreed phase baseline;
- 30-minute battery soak in R5-E produces no runaway cadence/thermal behavior.

### 8.4 SEO and analytics

- Locale metadata, canonical/hreflang, sitemap, robots, OG, Organization and
  Service structured data.
- Per-project metadata and share images.
- Problem/Ecosystem/Services/Method/Work copy remains crawlable.
- Analytics events preserve privacy and cover canonical CTA intent/conversion.
- Vercel Analytics/Plausible are launch integrations; do not claim them live
  until configured and verified.

## 9. Delivery Plan and Gates

Each phase follows **build → verify → commit → owner review pause**.

### R5-A — Structural unification — COMPLETE

Delivered:

- conductor and scene contract;
- one `PageStage` and one homepage liquid canvas;
- current four-scene port of existing choreography;
- continuous 48-droplet identity and ambient family;
- form-slot arbiter;
- Footer inside the page stage;
- transition diagnostics and one-canvas verification.

Protected gates:

- `forms:rest` exact;
- `verify-conductor` zero violations;
- `verify-canvas-count` exactly one;
- six diagnostic ranges retain continuity.

### R5-B — Fluid physics — COMPLETE

Delivered:

- fluid core and fixed substeps;
- bind/cluster/z targets;
- goal-seek, repulsion, cohesion, curl, cursor field;
- pinch-off satellite pool;
- 80-ball capacity;
- `?fphys=0` bypass;
- simulation and parity tests in the conductor harness.

Protected gates:

- bind=1 parity;
- melts land identically;
- no oscillatory non-settle where rest is required;
- NaN-free long simulation;
- owner feel review remains the authority for future tuning.

### R5-C — Optics v2 — COMPLETE

Delivered:

- framebuffer/post infrastructure;
- bright pass, separable bloom, composite;
- dither, grain, absorption, exposure, key boost, depth bands;
- full-nofx tier;
- energy governor;
- `?fgrade=0`;
- `verify-postfx.mjs`.

Protected gates:

- `forms:rest` exact; stop immediately if it moves;
- `?fgrade=0` readPixels-identical to the pre-C renderer;
- full tier at least 55 fps on owner hardware;
- no visible banding in exposure captures;
- float and RGBA8 paths verified;
- context-loss recovery verified;
- 3–6 owner screenshot rounds for bloom/depth/grain.

### R5-D — Cinematic Cut and New Scenes — COMPLETE

Delivered:

- `CinematicVeils` and light-score application;
- dedicated act/chapter scene behavior where needed;
- Work current + card meniscus;
- Origin flash + afterglow;
- Studio echo;
- Contact gather and Footer release;
- blur reveal;
- act-boundary fades;
- full-page diagnostic coverage.

Protected gates:

- exactly one flash per normal traversal;
- zero flash under reduced motion;
- no lost text contrast across exposure states;
- static/no-WebGL story complete;
- CTA verification green;
- same-droplet continuity across all ten transitions;
- owner sign-off of the complete cut.

### R5-E — Hardening and Launch Truth

Build/verify:

- iOS sticky/svh and Android lite-live matrix;
- desktop full/full-nofx/lite matrix;
- 30-minute battery soak and HUD/telemetry review;
- WebGL context-loss drill;
- PT/EN, keyboard, screen-reader, zoom, reduced-motion, contrast regression;
- real portfolio/contact/social/environment values;
- final dead-code and stale-comment sweep;
- final docs/code alignment.

Gates:

- all technical harnesses green;
- all chapter acceptance boxes satisfied;
- all prototype/placeholder facts removed or explicitly framed;
- production contact delivery verified;
- every CTA reaches Contact with correct intent;
- no retired engine/dependency/API in source or docs.

## 10. Verification and Debug Contract

### 10.1 Baseline commands

```bash
npx tsc --noEmit
npm run lint
npm run build
```

### 10.2 Visual and machine harnesses

```bash
npm run forms:rest
npm run forms:melts
npm run forms:cursor
npm run chapters:sheet
npm run endpoints

node scripts/verify-conductor.mjs
node scripts/verify-canvas-count.mjs
node scripts/verify-cta.mjs
node scripts/verify-entry-veil.mjs
node scripts/verify-perf.mjs
node scripts/capture-transition-diagnostics.mjs
```

R5-C is protected by `verify-postfx.mjs` and `verify-rest-exact.mjs`. R5-D is
protected by `verify-cinematics.mjs` and the full-page transition diagnostics.

### 10.3 Current query API

| Parameter                 | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `?fstate=N`               | deterministic rest form                                     |
| `?fpair=a-b-m`            | deterministic §3.3 bridge frame                             |
| `?fcursor=x,y`            | deterministic cursor merge                                  |
| `?fcycle=1`               | short hero dwell                                            |
| `?fflat=1`                | flat/debug field                                            |
| `?ftier=full\|lite\|none` | tier override                                               |
| `?feco=c`                 | freeze ecosystem progress `c ∈ [0,1]`                       |
| `?fphys=0`                | legacy integrator bypass                                    |
| `?fphysv3=1`              | opt-in area/viscosity/footprint physics review              |
| `?fobstacles=1`           | opt-in cached type/form avoidance; requires Physics v3      |
| `?fshape=1`               | opt-in full-tier velocity-aligned free-droplet shape review |
| `?fgrade=0`               | exact optics/grade bypass                                   |
| `?fgov=0`                 | disable the idle energy governor for QA                     |
| `?fcine=0`                | disable cinematic scoring, veils, and flash                 |

`window.__liquid` exposes current site channels and `window.__scenes` exposes
all live scene channels for diagnostics.

`?fgrade=0` must bypass all grade/post changes exactly. The post-effects
harness drills full-nofx demotion deterministically through its diagnostics.

## 11. File Architecture

### 11.1 Current source layout

```text
app/[locale]/
  page.tsx                 semantic chapter composition + PageStage + Footer
  work/                    portfolio index and cases

components/
  chapters/                RSC/DOM chapter surfaces and contact/project UI
  chrome/                  nav, CTA, entry veil, cursor, footer, 404
  field/
    PageStage.tsx          conductor shell, geometry, inputs, one canvas
    FieldStage.tsx         WebGL renderer
    CinematicVeils.tsx     fixed R5-D page-light consumers
  hero/                    hero shell + deterministic QA renderers

lib/
  i18n/messages/           authoritative PT-BR/EN copy
  webgl/
    conductor.mjs          cross-scene state and arbiter
    fluid-core.mjs         R5-B physics
    phys.mjs               canonical droplet identity/targets/constants
    field-drivers.ts       §3.3 bridge + harness/special-page drivers
    sdf-*.{ts,mjs}         exact SDF and unified glass field
    symbols.{ts,data.mjs}  exact form registry and endpoints
    field-tier.ts          runtime probe/session tier
    post-chain.ts          R5-C framebuffer lifecycle and passes
    post-shaders.mjs       R5-C bright/blur/composite shaders
    scenes/
      site.ts
      method.ts
      work.ts
      origin.ts
      studio.ts
      contact.ts
      footer.ts
      types.ts
      geom.ts

public/brand/              runtime SVGs and form stills
references/morphs/         owner sources, traced endpoints, manifest
scripts/                   capture and verification harnesses
```

### 11.2 R5-E additions/reorganization

R5-E may add bounded production-readiness helpers, tests, and telemetry beside
the current architecture. It does not require a finer per-chapter scene split,
a second visual engine, or a replacement renderer.

## 12. Open Decisions and Defaults

| Decision               | Current default                                                                        | Blocks                      |
| ---------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Ecosystem center       | unified mark/core + small business label                                               | final S4 taste sign-off     |
| Portfolio content      | form-still placeholders in dev; real work or explicit selected architectures at launch | launch credibility          |
| Verified outcomes      | use narrative until source/owner verifies a metric                                     | metric claims               |
| Studio people          | anonymous role grid                                                                    | portrait production         |
| Origin founders        | anonymous brothers                                                                     | names/portrait beat         |
| Three founding pillars | broad “forces that move business and life” framing                                     | sharper Origin copy         |
| Contact/footer facts   | environment-backed real values required                                                | production launch           |
| Audio                  | out                                                                                    | any audio design/dependency |

## 13. Whole-Site Definition of Done

The redeveloped site is done when:

- the offer and primary action are clear in Hero;
- the same visible liquid fragments, reconnects, rehearses, presents, fuses,
  gathers, and releases across all five acts;
- exact forms and signed-off morphs remain intact;
- real physics adds life without destabilizing bound choreography;
- optics add depth without changing the baseline or destroying performance;
- the cinematic layer has one safe flash and motivated act boundaries;
- every chapter remains semantic, crawlable, bilingual, keyboard usable, and
  complete under reduced motion/no WebGL;
- portfolio and contact facts are real or explicitly framed;
- every CTA arrives with the correct intent;
- desktop, mobile, integrated GPU, context-loss, and battery gates pass;
- no obsolete engine, plan, or contradictory instruction remains in the
  working documentation.

_Discreto. Preciso. Transformador. — one liquid, one system, one story._
