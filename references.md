# references.md — Zirtuno Website

> Curated references mapped to the sections they help with. Animation and WebGL libraries change APIs; consult the current docs here rather than relying on memory. **Use these surgically** — pull the doc for the task at hand, don't dump everything into context.

---

## HOW TO USE

- Before building any **shader / WebGL** moment, read the WebGL block below first.
- Before building any **scroll-pinned chapter**, read the Scroll block.
- For a **specific effect**, check the Effect Tutorials block — Codrops likely has a near-exact demo.
- The **Section → References** table at the bottom tells you which links matter for each spec ID.
- **21st.dev is for utility UI only** — never for the four signature moments. See note in that block.

---

## WEBGL / SHADERS  (for S2 metaball, S3 fractured, S4 ecosystem, S8 particles)

These are the most important references in this project. The metaball math (signed distance fields + smooth-minimum blending) comes directly from this lineage.

- **Three.js docs** — https://threejs.org/docs — core API, materials, render targets, OrthographicCamera, ShaderMaterial.
- **Three.js examples** — https://threejs.org/examples — working reference for points systems, GPGPU, raymarching.
- **React Three Fiber docs** — https://r3f.docs.pmnd.rs — bridging Three.js into React; `useFrame`, `useThree`, uniforms.
- **Drei** — https://github.com/pmndrs/drei — helpers (shaderMaterial, Points, useTexture). Use `drei`'s `shaderMaterial` for clean uniform typing.
- **Inigo Quilez — Distance Functions** — https://iquilezles.org/articles/distfunctions — the canonical SDF reference; sphere SDF, the `smin` smooth-minimum used for the metaballs.
- **Inigo Quilez — smin** — https://iquilezles.org/articles/smin — exact smooth-minimum variants; pick the polynomial smin for the logo blend.
- **The Book of Shaders** — https://thebookofshaders.com — GLSL fundamentals, noise, shaping functions (for the breath layer and organic wobble).
- **GPGPU particles reference** — Three.js `GPUComputationRenderer` example — for the S8 etymology particle system if 2000+ particles need GPU position updates.

Note on text→particles (S8): rasterize each word to an offscreen HTML canvas, sample non-transparent pixels at intervals to get target positions, feed those as particle targets. This is standard; Codrops has demos (see Effect Tutorials).

---

## SCROLL CHOREOGRAPHY  (for all pinned chapters: S3, S4, S5, S6, S8)

- **GSAP docs** — https://gsap.com/docs/v3 — core tweens/timelines.
- **ScrollTrigger** — https://gsap.com/docs/v3/Plugins/ScrollTrigger — pinning, scrub, progress-driven timelines. This drives the etymology beats, the ecosystem reveal, the pillar morphs, the method connector line.
- **Lenis** — https://github.com/darkroomengineering/lenis — smooth scroll; see README for the GSAP/ScrollTrigger integration snippet (sync `lenis.raf` to `gsap.ticker`).
- **@gsap/react** — https://gsap.com/resources/React — `useGSAP()` hook for clean React integration and cleanup.

Integration rule: Lenis drives scroll, ScrollTrigger reads it. Wire `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add(t => lenis.raf(t*1000))`. Disable Lenis under `prefers-reduced-motion`.

---

## DOM MICRO-INTERACTIONS  (for cursor, CTA hovers, small reveals)

- **Motion (motion.dev)** — https://motion.dev/docs — the renamed Framer Motion. Use for component-level enter/exit, hover/tap states, `AnimatePresence` for page transitions. **Scope:** DOM only. GSAP handles all scroll-bound work; don't duplicate.

Implementation note: install/use the modern `motion` package and import React APIs
from `motion/react`. Do not add direct `framer-motion` imports unless a future
Motion release explicitly changes the import path. In this project, Motion owns
declarative UI micro-interactions, route/page transitions, hover/tap/focus states,
and small layout transitions. Scroll-pinned chapters and shader choreography stay
with GSAP + ScrollTrigger.

---

## EFFECT TUTORIALS  (closest thing to giving the agent "eyes")

- **Codrops** — https://tympanus.net/codrops — search their archive for: "WebGL particles text", "metaball", "fluid distortion", "scroll pinned reveal", "image to particles". They publish full source for nearly every effect in this spec. When building a signature moment, find the relevant Codrops demo and adapt its technique to our tokens.
- **Codrops "On-Scroll Animation" collections** — reference for the chapter reveal pacing.
- **Awwwards** — https://www.awwwards.com — for benchmarking feel and finding live sites to study (Active Theory, Studio Freight, Resn, Unseen Studio). Study, don't copy.

---

## FRAMEWORK / i18n / CMS / EMAIL  (structural — Claude Code handles these well, docs prevent stale APIs)

- **Next.js 16 docs** — https://nextjs.org/docs — App Router, RSC, server actions, metadata, `generateMetadata`, dynamic OG, proxy convention, Turbopack defaults.
- **next-intl** — https://next-intl.dev — locale routing (`/pt`, `/en`), message files, server + client usage.
- **Sanity docs** — https://www.sanity.io/docs — schema types, GROQ queries, localized fields, `@sanity/client`, image URL builder.
- **Resend** — https://resend.com/docs — transactional email from the contact server action.
- **Tailwind CSS v4** — https://tailwindcss.com/docs — v4 config differs from v3 (CSS-first config). Confirm v4 syntax for the theme block.
- **react-hook-form** — https://react-hook-form.com — form state; pair with **zod** (https://zod.dev) via `@hookform/resolvers`.
- **Vercel OG** — https://vercel.com/docs/og-image-generation — dynamic OG images embedding the metaball per project.

---

## UTILITY UI ONLY  (21st.dev — use surgically, never on signature sections)

- **21st.dev** — https://21st.dev — community registry of shadcn/ui-based React + Tailwind + Radix components, installable via `npx shadcn`, with an MCP for AI IDEs. **Allowed uses:** form inputs, dropdown/mobile menu, toast/notification, accordion, tooltip primitives — the plumbing. **Forbidden uses:** hero, ecosystem diagram, etymology reveal, metaball, any pillar visual, the contact metaball. Those are bespoke. A marketplace component in a signature section reintroduces exactly the generic look we're avoiding. Always restyle anything pulled from 21st.dev to the Zirtuno tokens (cyan/black, the two fonts) before shipping.
- **shadcn/ui** — https://ui.shadcn.com — base primitives 21st.dev builds on, if pulling directly.

## INTERACTION INSPIRATION ONLY  (study, don't paste)

- **Design Spells** — https://designspells.com — a catalog of polished product
  details, interaction moments, transitions, 404 ideas, buttons, and delightful
  motion. Use it as a taste benchmark for small moments: loading, page transition,
  empty/error states, form feedback, cursor behavior, and contact success. Do not
  copy a recognizable effect; translate the underlying interaction principle into
  the Zirtuno language: discreet, precise, cyan-on-black, business-first.
- **React Bits** — https://reactbits.dev — animated React components and effects.
  Use only as a code/interaction reference for secondary UI polish, such as text
  reveal patterns, button feedback, menus, or small background treatments. Never
  import a React Bits component wholesale into the hero, ecosystem, metaball,
  services pillar visual, Origin, or contact exhale. If a pattern is borrowed,
  re-implement it with the locked stack (`motion/react`, GSAP, R3F, Lenis) and
  Zirtuno tokens.

---

## SECTION → REFERENCES MAP

| Spec section | Primary references |
|---|---|
| S0 Setup | Next.js, Tailwind v4 |
| S1 Globals (cursor, Lenis, breath, transitions) | Lenis, GSAP, Motion, Book of Shaders (breath layer) |
| S1.15 CTA system | Motion (hover states), next-intl (labels) |
| S2 Hero metaball | Three.js, R3F, Drei, iquilez (SDF + smin), Book of Shaders |
| S3 The Problem (fractured) | same as S2 (fractured = low-blend variant of the metaball) |
| S4 The Ecosystem | Three.js, GSAP ScrollTrigger (converge), Codrops (node/connection demos) |
| S5 The Services | reuse S2 metaball; GSAP ScrollTrigger (per-pillar morph trigger) |
| S6 Método Zirtuno | GSAP ScrollTrigger (connector line draw) |
| S7 Selected Work | Next.js (routing), Sanity (project schema), Motion (card hover), GSAP (horizontal scroll) |
| S8 The Name (etymology) | Three.js GPGPU/Points, Codrops (text→particles), GSAP ScrollTrigger (6-beat scrub) |
| S9 Studio | Next.js, Motion |
| S10 Contact | react-hook-form, zod, Resend, Next.js server actions; S2 metaball (exhale) |
| S11–S12 Footer/Nav | Motion, next-intl |
| S13–S15 Responsive/Perf/SEO | Next.js (metadata, image), Vercel OG |

---

## STALE-API GUARD

If you find yourself writing: Framer Motion imports from `framer-motion` (now `motion/react`), Tailwind v3 `tailwind.config.js` JS-object theme (v4 is CSS-first), Three.js `THREE.Geometry` (removed; use `BufferGeometry`), or any `next/legacy` API — stop and check the current docs above. These are the most common stale patterns for this stack.
