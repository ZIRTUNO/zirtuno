# Zirtuno

The website of Zirtuno, a Brazilian digital studio. It is a bilingual
(PT-BR / EN) marketing site whose central idea is a single continuous liquid:
one WebGL body that runs from the first pixel of the hero through the footer,
taking a different form in each chapter, and never restarting.

The liquid is not an ornament. The studio's argument is that brand, software,
data, and operations are usually built as disconnected pieces, and that they
should instead be one connected system. The site makes that argument by
behaving the way it describes — the same droplets fracture, gather, resolve
into the studio's mark, and take the exact shape of each service, without a
single cut.

---

## The studio

Zirtuno builds complete digital ecosystems: software, AI, automation, data,
branding, and marketing, connected into one structure rather than commissioned
as separate projects.

The name joins two ideas rather than two people — the quiet transforming force
of *Zéfiro* with the direction and courage of *Ventura*. Force without direction
is only weather; direction without force is only a map. That fusion is the
origin story the site tells in its fourth act, and it is also the thesis behind
the whole design: structure given to what was dispersed.

The brand voice is deliberately restrained. *Discreto. Preciso. Transformador.
Claro. Estratégico. Comercialmente forte.*

## What the site is trying to do

The site targets a specific balance: **70% strategic clarity, 30% poetic
atmosphere.**

That ratio is a real constraint, not a slogan. A visitor has to understand what
Zirtuno sells *before* reaching the emotional peak, see honest proof of work,
and find an obvious way to make contact. Award-level craft is the goal, but a
beautiful page that hides the offer would be a failure. Every visual decision is
weighed against whether it still serves the commercial argument.

---

## The experience: five acts, one liquid

One page-wide canvas carries a shared population of droplets through the entire
journey. Chapter separation comes from choreography, spacing, and light — not
from multiple canvases or dividing rules.

| Act | Chapters | What the liquid does |
| --- | --- | --- |
| **I — Signal** | Entry veil, Hero | The wordmark assembles, then hands off to the living mark |
| **II — Argument** | Problem, Ecosystem, Services | Pours, fractures into scattered pieces, gathers capability masses out of depth into three systems, resolves into the mark, then takes the exact form of each service in turn |
| **III — Practice** | Método, Work | Rehearses the client transformation, then settles into a quiet current behind the case studies |
| **IV — Soul** | Origin, Studio | Two idea-masses fuse into the exact mark, echo into satellites, and continue behind the studio |
| **V — Invitation** | Contact, Footer | Every droplet gathers into the mark; submitting exhales; one droplet is released past the footer |

The transitions between these states are handoffs of the same body — `assembly`,
`pour`, `fracture`, `seek`, `bloom`, `rehearse`, `current`, `fuse`, `gather`,
and `release` — never a swap between two different effects.

Two details carry most of the weight:

- **The Confluence.** Where the gathering resolves into the studio's symbol, the
  mark is computed from the liquid's own field rather than rasterised from an
  SVG. Drawing a vector there would have contradicted the chapter's claim that
  nothing is placed between the two bodies — they simply stop being separate.
- **The seven forms.** Each service has an exact silhouette, and the liquid
  takes it precisely. The droplet count is fixed at 48 so that a morph between
  any two forms is a pure interpolation of position and radius, with nothing
  appearing or disappearing mid-transition.

---

## How it is built

### Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC), React 19, TypeScript, Turbopack |
| Styling | Tailwind CSS v4 with CSS custom properties as the token source |
| Graphics | Raw WebGL2 with OGL, custom SDF and metaball shaders |
| Scroll choreography | GSAP with ScrollTrigger |
| Micro-interaction | Motion |
| Scrolling | Lenis |
| Internationalisation | next-intl |
| Content | Sanity, with a committed fallback selection |
| Forms | react-hook-form, Zod, Resend |
| Hosting and analytics | Vercel, Plausible |

Node 26 is expected; the version is pinned in `.nvmrc`.

### Rendering pipeline

Chapter copy is server-rendered and fully crawlable. The canvas measures that
DOM and animates behind it — the visual layer is an enhancement over real
markup, never a replacement for it.

```text
RSC chapter copy and semantic DOM
        │ measured anchors
        ▼
PageStage — one sticky page-wide canvas, one measurement loop
        │
        ▼
Conductor — damping, presence, droplet handoffs, form arbiter, light score
        │
        ├── scene targets per chapter (site / método / work / origin /
        │                              studio / contact / footer)
        ├── fluid-core — velocity, goal-seek spring, repulsion, cohesion,
        │                curl drift, cursor forces, strikes, pinch-off
        ├── tile binning — droplets binned per tile so population is
        │                  close to free
        └── motes and temperament — a simulated population beyond the
                                    authored 48, each with its own character
        │
        ▼
FieldStage + SDF-glass shader (exposure, key, absorption, depth, shadow)
        │
        ├── post-chain — bright pass, bloom, opaque composite with
        │                dither and grain, idle governor near 30 Hz
        │
        └── CinematicVeils — light score driven into CSS variables for the
                             exposure veil and vignette
```

A performance note worth keeping in mind when working on this: the field is
**fill-rate bound**. Frame cost tracks buffer area far more than it tracks
shader features or CPU physics. Tile binning is what removed droplet count from
the cost equation, which is what made a larger simulated population affordable.

### Graceful degradation

The renderer detects a tier and adapts. The complete story and the full
conversion path stay usable at every level.

| Tier | Behaviour |
| --- | --- |
| `full` | The complete liquid, post-processing, and cinematic veils |
| `lite` | Reduced effects for integrated GPUs and constrained devices |
| `none` | No WebGL — static traced silhouettes stand in for the liquid |

`prefers-reduced-motion` is honoured throughout: transitions hand navigation
straight back to the router, and scroll-driven motion resolves to its end state
rather than animating.

The static tier does not fake the shapes. Silhouettes are traced from the same
field the GPU would evaluate, because thresholding a blurred set of circles
produces a visibly different outline than the real metaball field does.

---

## Internationalisation

Portuguese (BR) is primary, English secondary, and both are always prefixed —
`/pt/...` and `/en/...`. Neither is a machine translation of the other; both are
authored, and they are allowed to differ where a literal rendering would be
weaker.

All shipped interface and conversion copy lives in exactly two files:

```
lib/i18n/messages/pt.json
lib/i18n/messages/en.json
```

Text is never hard-coded into components. That constraint is what keeps the two
locales genuinely equal rather than leaving English as an afterthought.

Locale-aware navigation helpers are exported from `lib/i18n/config.ts`; use
those rather than `next/link` and `next/navigation` directly. Routing is handled
by `proxy.ts` at the repository root — Next.js 16 renamed what was previously
`middleware.ts`.

## Content

Case studies come from Sanity. If Sanity is unreachable or unconfigured in
production, the site fails closed to an honest, empty portfolio; it never
substitutes prototype or concept work as though it were client work. Local
concept studies are available only when `PORTFOLIO_DEMO_MODE=true` outside
production, and are strictly a review convenience.

A case may optionally carry a Rive animation with a localized description and a
real poster image. That canvas is supplemental — it never replaces the written
case or its static fallback.

## Contact

The contact form validates with Zod through react-hook-form and delivers via
Resend. It reports success only once Resend confirms delivery, rather than
optimistically on submit.

Retries reuse a stable per-submission identity and a byte-equivalent payload, so
a retry cannot silently become a second message. Mail that is accepted but not
yet confirmed keeps the form intact and is tracked to a signature-verified
webhook for final delivery or bounce handling. Both public endpoints enforce
streamed-body size ceilings.

Production builds run a readiness gate automatically and refuse to ship with
placeholder contact identity, an unverified delivery path, or an unattested
rate-limit rule.

---

## Project structure

```
app/[locale]/        locale routes, page composition, metadata, sitemap, robots
components/
  chapters/          semantic chapter UI and the contact surface
  chrome/            navigation, CTAs, cursor, footer, brand draw
  field/             PageStage conductor shell and FieldStage renderer
  motion/            scroll and page-transition providers
  work/              the case gallery and its Rive experience
  lab/               internal QA renderers
lib/
  webgl/             SDFs, symbols, conductor, physics, shaders, tiers, scenes
  animation/         easings, durations, traces, spine geometry
  i18n/messages/     the only source of shipped copy
  content/           portfolio and socials sources
  sanity/            CMS queries and types
public/brand/        runtime mark, service form SVGs, baked stills
references/morphs/   originals, traced endpoints, previews, manifest
scripts/             development and verification tooling
docs/                specifications, decisions, QA notes
```

Tooling under `scripts/` is grouped by verb, so the directory carries the verb
and the filename carries only the subject:

| Directory | Contents |
| --- | --- |
| `scripts/verify/` | Pass/fail gates |
| `scripts/capture/` | Screenshot and filmstrip harnesses |
| `scripts/probe/` | Diagnostics and investigations |
| `scripts/tools/` | Generators and asset pipelines |
| `scripts/support/` | Shared modules imported by the above |
| `scripts/fixtures/` | Committed baselines |

The shared directory is named `support/` rather than `lib/` deliberately.
Scripts reach the application engine through `../../lib/webgl/`, and a
`scripts/lib/` would let a stale `../lib/` reference resolve to the wrong real
directory instead of failing. The reasoning is recorded in
`docs/decisions/0002-repository-layout.md`.

---

## Getting started

Requires Node 26 and npm.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The site runs at `http://localhost:3000`, which redirects to `/pt`.

No environment variables are needed to render the site locally. Sanity, Resend,
and analytics keys are only required for the features that depend on them; see
`.env.local.example`, which documents every variable and what each production
readiness gate means.

### Everyday commands

```bash
npm run dev       # development server
npm run build     # production build
npm run start     # serve the production build
npm run lint      # ESLint
npx tsc --noEmit  # typecheck
```

Continuous integration runs the typecheck, ESLint at zero warnings, and a
production build on every push and pull request to `main`. Lint is a hard gate:
a new warning fails the build.

### Verification harnesses

Beyond CI, the repository carries a set of gates that drive a real browser
against a running server and assert measured properties of the rendered result —
frame cost, contrast, transition boundaries, canvas count, geometry, device
matrices, and so on. They are deliberately not part of CI, since they need a
live server and a GPU-backed browser; they are meant for deliberate runs while
working on the thing they measure.

```bash
npm run confluence         # the mark resolves correctly out of the field
npm run work               # the gallery's FLIP panel geometry
npm run liquid:form        # the coalesce merge
npm run rail               # the chapter index waterline
npm run verify:production  # the production readiness gate
```

Every gate under `scripts/verify/` can also be run directly with `node`.
Capture harnesses under `scripts/capture/` produce contact sheets and filmstrips
for visual review; their output goes to `captures/`, which is not tracked.

Two measurement cautions are worth knowing before trusting a result.
Screenshots carry roughly a **1% churn noise floor**, so a small pixel delta is
not automatically a regression. And under software rendering, the frame-rate
watchdog can quietly demote the very code being measured — shrink the viewport
and measure early rather than reading a full-page capture at face value.

### Debug flags

Runtime layers can be toggled by query string, which makes it possible to
bisect a visual problem to a specific system without editing code:

```
?fphys=0      bypass the fluid physics
?fcine=0      disable the cinematic veils
?fmotes=0     disable the simulated population beyond the authored droplets
?ftier=lite   force a rendering tier (full | lite | none)
```

Further flags exist for individual shader and physics layers; they follow the
same `f<layer>=0` pattern.

---

## Documentation

| Document | Contents |
| --- | --- |
| `AGENTS.md` | Working rules, taste constraints, and the verification protocol |
| `docs/specs/build-spec.md` | The complete product, experience, chapter, and acceptance specification |
| `docs/specs/metaball-morph-spec.md` | The liquid contract: exact forms, conductor, physics, renderer, optics |
| `docs/specs/field-liquid-spec.md` | The field's behaviour in detail |
| `docs/specs/cta-membrane-spec.md` | The CTA membrane |
| `docs/specs/entry-intro-spec.md` | The entry sequence |
| `docs/decisions/` | Architecture decision records |
| `docs/design-qa.md` | Design QA notes |
| `docs/references.md` | Approved technical and visual references |

Where sources disagree, prefer the most specific one, but never override a
non-negotiable in `AGENTS.md`. Code describes what exists today; the specs
describe both the current baseline and the intended target, and label which is
which.

---

## Licence

Copyright © 2026 Pedro Mautone and Jonathan Delmonte (Zirtuno). All rights
reserved.

This repository is public to read, but it is not open source. The brand assets,
the metaball and signed-distance-field engine, the shaders, and the studio copy
are not licensed for reuse. Dependencies keep their own licences. See
[LICENSE](LICENSE) for the full terms.
