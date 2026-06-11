# ZIRTUNO Website — Full Review & Strategic Improvement Plan (v1)

> Date: 2026-06-10 · Inputs: `build-spec.md` (v0.2), `metaball-morph-spec.md` (v1–v1.4), `AGENTS.md`, `references.md`, `README.md`, the full source tree, git history, and the capture sheets in `captures/`.
> Scope: review only — no code changes were made. Once approved, this plan supersedes the build order in `build-spec.md` S16 and the roadmap in `metaball-morph-spec.md` §12, the same way those documents superseded their predecessors. The core Zirtuno concept is **not** in question and is preserved in full.

---

## 1. Verdict

The project is not failing for lack of vision, copy, or even technology. The spec is unusually good, the information architecture is right, the copy is finished in both languages, and the newest WebGL engine (the SDF-glass + field-morph system, behind `?hero=field`) is the best visual work in the repository — signed off at ~101–145 fps on the worst target GPU.

The site is in a poor state because **the production page is still assembled from the two rendering engines the project already decided to retire, and the experiential layer that makes the spec special was never built.** What renders today is, roughly: finished copy in well-structured but conventionally static sections, decorated by obsolete blob visuals on strong GPUs and by static SVG logos everywhere else. The "high-end, artistic, fluid, futuristic" experience exists in the documents and in one flagged-off hero — not on the page.

Three numbers tell the story:

| Layer | State |
|---|---|
| Content / IA / CTA / i18n / SEO / a11y | ~90% done, genuinely solid |
| Signature visuals (the brand's liquid) | Best version built and verified, but **0% of it is live by default** |
| Scroll choreography (pins, scrubs, the continuous narrative) | ~15% built — almost every chapter is a static section with fade-in reveals |

The remake is therefore not a teardown. It is a **consolidation** (one engine everywhere, delete two), a **choreography build-out** (the pinned, scrubbed, continuous-liquid experience the spec describes), and a **truth pass** (portfolio and contact content). The wrong move would be another visual rewrite; the fourth engine would die like the second and third. Everything needed already exists in the repo — it has just never been assembled into one experience.

---

## 2. What is already strong — preserve, do not rebuild

These parts are at or near spec quality. The remake must treat them as fixed assets:

1. **The documents themselves.** `build-spec.md` v0.2 (70/30 balance, 9-chapter IA, CTA placement map, no-invented-metrics rule) and `metaball-morph-spec.md` v1.2–v1.4 (SVG-at-rest + metaball-melt hybrid) are correct and current. The failure is execution lag, not direction.
2. **Copy and i18n.** All 9 chapters written in PT-BR and EN, 179 keys, perfect parity between locales, no hard-coded strings. The is/solves/creates pillar anatomy, the seven symptoms, the Método phases, the Origin beats — all present in `lib/i18n/messages/`.
3. **The new field engine.** `SdfGlassField` (crisp SVG-exact glass rest forms — see `captures/sdf-glass-sheet.png`, which is excellent), `MetaballField` + `field-shader.mjs` (locked glass shading), and `FieldMorphHero` (rest → melt → rest with min-travel matching, stagger, crossfade; all 24 mid-frames verified connected; ~101 fps on Intel UHD). This is the brand made visible, and it finally runs on weak GPUs.
4. **The 7 owner-traced form SVGs** in `public/brand/forms/` — recognizable, on-brand, with real negative space. The single biggest visual asset after the mark itself.
5. **Structure and plumbing.** CTA system with intent tags reaching the contact form; contact form + zod + Resend route with graceful no-key fallback; `/work` index with filters + case-study template + Sanity schema with seed fallback; sitemap/robots/JSON-LD/OG image; skip link, `aria-live` announcements, keyboard stepping, reduced-motion fallbacks on every canvas. `tsc --noEmit` is clean.
6. **Typography discipline.** The sans=business / serif-italic=poetry split is correctly enforced in the components. Tokens match the spec.
7. **Método (S6)** is the one chapter close to its spec: scroll-drawn connector line, per-phase gestures, clean layout. It proves the team can do choreography — it just wasn't done elsewhere.

---

## 3. The Review

### 3.1 Root problem — one site, three rendering engines, and the best one is turned off

The repository currently contains three complete generations of the metaball:

| Engine | Files (approx.) | Spec status | Production status |
|---|---|---|---|
| Raymarched SDF glass | `MetaballScene.tsx` (869 lines), `states.ts`, `trace-logo.ts`, `env-map.ts` | **Retired** by morph-spec v1 ("froze on Intel UHD and never matched the reference") | **Still the default** for the hero on "full"-tier GPUs, and the only live visual for S3 fracture, S4 converge, S8 origin, S10 contact |
| Mesh + matcap | `MeshMetaballScene.tsx` (334), `mesh-states.ts`, `mesh-matcap.ts` | Stopgap; README: "reads too much like generic blobs/faceted shells" | Default hero + services + contact on "lite" tier (i.e., most laptops and all mobile) |
| Field system (SDF-glass rest + metaball melt) | `FieldMorphHero`, `SdfGlassField`, `MetaballField`, `sdf-*.mjs`, `field-shader.mjs`, `symbols.data.mjs` | **The approved direction**, v1.2–v1.4, sign-off recorded | **Behind `?hero=field` only.** Zero public surface |

The consequences compound:

- **Visual inconsistency is structural, not accidental.** Compare `captures/contact-sheet.png` (production forms: Web Design is a scalloped donut, Software a lumpy slab, AI a star-shaped blob) against `captures/sdf-glass-sheet.png` (the field forms: instantly legible browser window, brackets, brain, loop, columns, orbit, megaphone). Two visitors on two machines see two different brands; one scroll on one machine mixes both languages.
- **Maintenance is triple.** Every form tweak now has three homes (`states.ts`, `mesh-states.ts`, `symbols.data.mjs` + SVGs), and `sdf-glass-shader.mjs` must mirror `field-shader.mjs` "byte-for-byte, by hand". This is how the repo accumulated ~2,000 lines of retired-but-shipped WebGL.
- **Two gating systems coexist.** `gpu-tier.ts` (name blocklist + probe, three tiers) and the `can-run-glass.ts` wrapper used by the non-hero sections, which only returns true for the raymarch tier. The morph spec ordered the blocklist replaced by a runtime probe; that landed only partially (the probe merely upgrades to raymarch).

### 3.2 What most visitors actually see (the device-tier reality)

Because S3/S4/S8/S10's only live path is the retired raymarch, and that path is gated to discrete-GPU desktops:

| Audience | Hero | Problem fracture | Ecosystem converge | Services morph | Origin mark | Contact |
|---|---|---|---|---|---|---|
| Discrete-GPU desktop (minority) | Raymarch blobs (off-reference) | Raymarch shards | Raymarch converge (small core only) | Raymarch old forms | Raymarch converge | Raymarch + exhale |
| Integrated-GPU desktop — including the owner's machine | Mesh "generic blobs" | **Static SVG** | **Static SVG** | Mesh blobs | **Static SVG** | Mesh blob |
| Mobile (likely the majority for a BR business audience) | Mesh blob | Static SVG | Static list | Static SVG logo | Static SVG | Static SVG |

The site's entire visual argument — *fragments scatter, then converge into one organism* — is **invisible to the majority of visitors**, including the owner. Meanwhile the field engine, which runs at 100+ fps on exactly those machines, sits behind a query parameter. This is the single highest-leverage fact in the whole review.

### 3.3 The experience layer is a skeleton — chapter-by-chapter against spec

| Chapter | Spec calls for | What is built | Gap |
|---|---|---|---|
| S2 Hero | 2-col layout, reveal sequence, metaball w/ 7 states, autocycle, hover, keyboard | Layout/copy/CTAs/reveals ✔; legacy engines default; field hero flagged off | Flip the default |
| S3 Problem | **Pinned ~200vh**; each of 7 symptoms pushes a fragment further out; ends unresolved | Static section; symptoms = a plain list with 0.04s stagger; fracture canvas sits at a constant 0.9, desktop-raymarch only | The drama is missing entirely |
| S4 Ecosystem | **Pinned ~250vh**; S3's fragments **fly inward and connect**; lines draw sequentially (80ms stagger) w/ pulses; "the single most important transition on the site" | Diagram = flat CSS dots + static 1px lines + looping CSS pulses; converge happens only inside the small core circle, raymarch tier only; S3 and S4 use **separate canvases**, so nothing actually travels | The centerpiece payoff doesn't exist as choreographed |
| S5 Services | Pinned ~700vh, morph locked to each pillar's copy | Sticky aside + IntersectionObserver swapping `manualState` — a fair approximation — but morphing between the **old unrecognizable forms**; mobile gets a static logo | Engine swap + form legibility |
| S6 Método | Stepped sequence, drawing connector, per-phase gesture | Built ✔ (closest to spec) | Minor polish only |
| S7 Work | Featured strip w/ full card anatomy + media | Anatomy ✔, `/work` + filters + case template ✔; **all 6 projects are prototypes, zero media** — preview boxes render a category word | Credibility section currently *reduces* credibility |
| S8 Origin | **Pinned ~600vh, five scrubbed beats**: two forms drift together → the mark forms w/ pillar labels → purpose → multiplication → particle wordmark | Static stacked paragraphs with fade-ins; its own code comment admits "Skeleton render… PHASE 2 turns this into the pinned scrub"; mark-forming visible on raymarch tier only | The emotional peak is a text column |
| S9 Studio | Where/Who/Why | Built ✔ | — |
| S10 Contact | Labeled submit + additive exhale | Built ✔ (exhale raymarch/desktop only) | Engine swap |
| S1 systems | Cursor, Lenis, breath, type-breathe, page wipe, 404 ✔; **loading = wordmark assembly ~1.5s** | All present except loading is a pulsing word, and it only covers route loads, not first paint | Small |

The pattern: wherever the spec says *pinned / scrub / converge / travel*, the implementation says *fade in on view*. The site reads as a well-organized landing page, not as the continuous cinematic experience both specs describe. That is the difference the user feels as "poor state."

### 3.4 The narrative arc is broken into islands

The morph spec's strongest idea (§6): *"every chapter is the same 48 balls… the narrative — scatter → regroup → become the mark → bloom into services — is literally one continuous liquid the whole site long."* Today there are **six independent canvases** (hero, fracture, eco-core, services, origin, contact), each mounting its own scene instance with no shared state. Even on the strongest GPU, the fracture in S3 and the converge in S4 are different objects — the visitor never sees the *same* liquid break and heal. Continuity is the concept; the architecture currently forbids it.

### 3.5 Visual consistency and premium-feel issues beyond the engines

1. **Weight mismatch in the Ecosystem diagram.** A rich 3D-glass core (when it renders at all) sits inside a flat constellation of 6px CSS dots and hairlines. It reads like a slide-deck diagram, not a "living organism." Nodes don't draw in on entry; the rotation is a faint ring, not the diagram.
2. **The portfolio strip undermines premium positioning.** Six text-only cards on dark panels, several labeled with the same "Arquitetura selecionada" badge, no imagery at all. Honest (good) but visually it is the emptiest moment on a site whose pitch is visual excellence.
3. **Placeholder business facts are baked in as defaults**: a `wa.me` number, `zirtuno@gmail.com`, an Instagram URL — shipped in code as fallbacks. A premium studio site pointing at a Gmail address is a positioning leak.
4. **Loading and transitions are serviceable, not signature.** The cyan wipe exists; the loading moment (first brand touch!) is a pulsing word.
5. Minor: `README.md` still describes the mesh path as the current hero plan, while `metaball-morph-spec.md` v1.3–v1.4 has moved on — the documents disagree about the present.

### 3.6 Conversion-path friction

The CTA system is correctly wired for *intent*, but the primary action is mechanically rough: every intent CTA navigates to `/?intent=…#contact`. From the homepage — where almost all of them live — clicking "Solicitar análise inicial" triggers a router navigation to the same page: scroll position jumps via hash (bypassing Lenis's smooth scroll), the URL mutates, and on slower devices the page visibly re-settles. From `/work`, it additionally replays the full page wipe and re-mounts the hero behind your back. The spec treats the CTA path as load-bearing; it should feel like silk — a smooth Lenis scroll-to-contact with the intent set in state — not a page reload impression.

### 3.7 Content truth gaps (launch blockers, independent of code)

Per `AGENTS.md` rule 3 and the spec's own acceptance: ≥3 honest portfolio entries must ship; currently zero real projects exist (all six carry `prototype: true`). WhatsApp/email/domain/social remain unconfirmed (`TODO(content)` in `ChapterContact`). Sanity is wired but unconfigured. None of this is a build problem — it is a decision-and-assets problem that no amount of code will fix, and it gates several acceptance boxes.

### 3.8 Technical debt and risk register

- **GPU budget on "full" tier:** up to five raymarch instances can be mounted across one homepage scroll (hero, fracture, eco, services, contact — six with origin). They pause off-screen, but sticky/pinned layouts keep two alive simultaneously. This is the heaviest possible engine multiplied, on the only tier that gets visuals at all.
- **Dead code on retirement row:** `MetaballScene` (869), `MeshMetaballScene` (334), `mesh-states`/`mesh-matcap`/`trace-logo`/`env-map`/`symbols-legacy` (~900 more) — all still shipped and importable, all still drift-prone.
- **Manual shader synchronization** between `field-shader.mjs` and `sdf-glass-shader.mjs` is an invitation for the rest look and the morph look to diverge.
- **Morph endpoint registration:** v1.3 flagged that ball-clouds predating the owner SVGs "will pop at the crossfade"; ba78383 regenerated them, but `captures/melt-live-frame.png` still shows a visible double-exposure at the handoff — the crossfade window needs an art-direction pass on real hardware.
- **The capture/verify tooling (20+ scripts) is a genuine asset** — keep it, but it currently targets all three engines; consolidation will let half of it be deleted.
- Hygiene: `tsconfig.tsbuildinfo` (530KB) and `dev-server.log` are tracked at root despite the README's own cleanup policy; `proxy.ts` + `app/[locale]/[...rest]` are fine.

### 3.9 Why it got here (process diagnosis — matters for the plan)

Reading git history start-to-finish: the team built breadth-first to a deployable skeleton (correct, per AGENTS.md), then spent nearly the whole iteration budget on **four successive visual engines** for the hero (capsule-SDF → raymarch → mesh → field), each time discovering on real hardware what the spec now records as doctrine ("author to the medium", "the field is excellent for chunky forms and poor at fine detail", "the mark must be the real SVG"). Meanwhile the choreography that makes chapters feel premium — which is GSAP/ScrollTrigger work, *engine-independent* — was deferred as "Phase 2" in five different files and never reached. The new plan must therefore invert the habit: **lock the engine (it is locked — v1.2 says so), forbid further engine work, and spend the budget on assembly and choreography.** Each phase below ends with a screenshot/scroll-capture checkpoint precisely because that discipline is what finally produced the one good engine.

---

## 4. Strategy for the remake

**The concept does not change.** Cyan liquid glass on black; quiet, precise, transformative; 70% strategic clarity / 30% poetic atmosphere; the 9-chapter business-first arc; the liquid as the narrative spine. Every decision below serves the original vision — the change is that the site must finally *execute* it.

Three governing principles for everything that follows:

**P1 — One engine, everywhere, no exceptions.** The field system (SDF-glass rest + metaball melt) becomes the only renderer. The raymarch and mesh paths are deleted, not deprecated. Every chapter visual — hero, fracture, converge, services morph, origin beats, contact exhale — is a *driver* feeding the same `MetaballField`/`SdfGlassField` pair with different ball positions and scrub inputs. This is what morph-spec §6 always intended ("one system, reused — only the driver differs"). It simultaneously fixes: visual consistency, the integrated-GPU blackout, mobile reach, the triple-maintenance tax, and ~2,000 lines of debt.

**P2 — The liquid is one continuous character.** Within the homepage, adjacent liquid moments share state so the story physically connects: the hero's mark is the thing that shatters in The Problem, and those same droplets regroup in The Ecosystem. Concretely: a single field canvas spanning S3→S4 (scroll-scrubbed scatter→converge of the same N balls), the services canvas resting on whatever form the narrative left behind, the origin reusing the converge driver. If a literal single site-long canvas proves heavy, the fallback is *handoff continuity* (each canvas begins exactly where the previous one ended, same geometry, same shading) — the visitor cannot tell the difference; the architecture stays simple.

**P3 — Choreography before decoration.** The remaining experience budget goes to ScrollTrigger pins and scrubs (S3, S4, S8), the loading moment, and CTA smoothness — not to new visual media. The field engine is good enough today; what's missing is *staging*.

---

## 5. The New Plan — phases R0–R5

Each phase ends with a capture checkpoint (the existing `scripts/` harness, extended) and an explicit owner sign-off before the next begins. Estimated weights are relative, not calendar promises.

### R0 · Flip the switch (small, do first)
Goal: the approved engine becomes the public site; the bleeding stops.
- Promote `?hero=field` to the default hero path. Wire `gpu-tier` for it per morph-spec Phase 4: probe-first tiers (full glass / flat-cyan lite / static SVG), FPS watchdog that downshifts instead of freezing, `can-run-glass.ts` removed.
- Owner motion sign-off on the live morph (the one open checkpoint from v1.4), including the crossfade double-exposure visible in `melt-live-frame.png`.
- Fix the same-page CTA path: intent CTAs on the homepage smooth-scroll via Lenis and set intent in state/sessionStorage (URL update via `history.replaceState`, no router navigation); cross-page CTAs keep the routed path.
- Hygiene: untrack `tsconfig.tsbuildinfo` / stray logs; update `README.md` to describe reality.
- Acceptance: a first-time visitor on the owner's Intel UHD sees the live liquid hero at 60fps with the SDF-glass mark at rest; every CTA reaches contact with its tag, with zero visible page re-load on the homepage.

### R1 · One engine everywhere (the consolidation — the heart of the remake)
Goal: every chapter visual runs on the field system; the legacy engines are deleted.
- Build the four drivers on the shared field components: **scatter** (S3: per-ball radial offsets + desaturation toward `paper-dim`, scrub input 0→1), **converge** (S4 + S8 Beat 2: scatter run backwards ending on the SDF mark, colour blooming back to vivid cyan), **scrub-morph** (S5: pillar index → melt, replacing the IntersectionObserver `manualState` swap with progress-locked melts), **impulse** (S10: the exhale as a one-shot scatter-and-return pulse).
- Replace each chapter's `MetaballScene`/`MeshMetaballScene` mounts with the corresponding driver. Enforce a **canvas budget: at most 2 field canvases live at any scroll position** (they are cheap, but discipline keeps mobile safe).
- Mobile and lite tier now get **live liquid** (flat-cyan shading where the probe demands) instead of static SVGs; "none" tier keeps the SVG stills, which are already exact.
- Delete: `MetaballScene.tsx`, `MeshMetaballScene.tsx`, `mesh-states.ts`, `mesh-matcap.ts`, `trace-logo.ts`, `env-map.ts`, `symbols-legacy.data.mjs`, `can-run-glass.ts`, and the capture scripts that exist only for them. Single shading source for `field-shader`/`sdf-glass-shader` (shared GLSL chunk, not manual sync).
- Acceptance: capture sheet of every chapter visual on full + lite + none tiers, both locales; no import of a deleted engine anywhere; repo sheds ~2,000 lines.

### R2 · The choreography build-out (the "fluid, futuristic" layer)
Goal: the three skeleton chapters become the experiences the spec describes. All of it is GSAP/ScrollTrigger + the R1 drivers — no new rendering tech permitted.
- **S3 The Problem:** pin (~200vh). Symptoms reveal one-per-scroll-step; each reveal advances the scatter driver one notch, pushing fragments outward; chapter exits unresolved (fragments dim, drifting) into the structure CTA.
- **S4 The Ecosystem:** pin (~250vh). Entry state = S3's exit state (P2 continuity). Scrub: fragments fly inward → SDF mark resolves at center → node connectors **draw outward sequentially** (80ms stagger) with traveling pulses → labels fade in. Diagram upgrade rides along: nodes become small glass dots (CSS, not canvas), hairlines gain the draw-on animation, whole constellation rotates ~60s/rev. Mobile keeps the vertical stack but gains the converge moment above it.
- **S8 The Origin:** pin (~600vh), five scrubbed beats per spec S8.3: two clusters drift together (Beat 1) → converge driver resolves the mark + three pillar labels (Beat 2) → text-forward hold (Beat 3) → multiplication echo (Beat 4) → the existing CPU particle wordmark (Beat 5, already built) + closing line + grace note. Mobile: scroll-snap beats, no scrub (per spec).
- **Loading (S1.10):** the wordmark assembly moment (~1.5s, skip on return visit) — the first brand touch should be the brand.
- Acceptance: full-page scroll capture (desktop + mobile emulation, PT + EN, reduced-motion pass) reviewed by the owner; the scatter→converge arc is visible on an integrated GPU.

### R3 · Premium polish pass (art direction, 3–6 screenshot rounds budgeted)
Goal: close the gap between "implemented" and "Awwwards-level."
- The four signature moments get their iteration rounds on real hardware (per AGENTS.md): morph feel/timing, fracture readability, converge weight, origin beats pacing.
- Selected Work cards get real visual presence even before real projects exist: each card's preview renders its category's SDF-glass form as placeholder art (consistent, on-brand, replaces the text-in-a-box), swapped for real media as it arrives.
- Micro-detail sweep guided by Design Spells references: form focus states, success state, 404 lone-droplet, footer, scrollbar, selection colour.
- Acceptance: side-by-side sheet vs. the image-2/3 references; owner taste sign-off.

### R4 · Content truth + launch readiness
Goal: remove every invented or placeholder fact; pass the spec's own launch gates.
- Portfolio: owner supplies ≥3 real projects (or the section is re-scoped to "Selected architectures" explicitly until they exist — the honest fallback the spec already defines). Load via Sanity; delete `prototype` seeds from the shipped bundle.
- Confirm WhatsApp, contact email on the real domain, social handles; remove code-level fallbacks (env-only, build fails loudly if missing in production).
- Decide the remaining `TODO(decision)` items (S8.5 pillar meaning, studio portraits, audio out).
- Final QA matrix: conversion-path test (already scripted), Lighthouse/CWV on mid-range mobile, WCAG AA contrast, both locales, reduced-motion, `?fstate/?fpair` deterministic captures archived.

### R5 · Post-launch evolution (parking lot, explicitly out of scope now)
Case-study media system, OG-per-project images using the glass renders, optional audio layer, Plausible event wiring, CMS-driven copy editing.

---

## 6. Explicit deletions (so the next session doesn't "improve" them)

`MetaballScene.tsx` · `MeshMetaballScene.tsx` · `mesh-states.ts` · `mesh-matcap.ts` · `trace-logo.ts` · `env-map.ts` · `symbols-legacy.data.mjs` · `can-run-glass.ts` · `states.ts` (fold the state registry into `symbols.ts`) · legacy-only capture scripts (`capture-mesh`, `capture-fractured`, `capture-hero` raymarch paths, `verify-mesh-metaball`, …) · the `?glass=` query API (replaced by `?hero/?fstate/?fpair/?fcycle`). History preserves them; the working tree must not.

## 7. Risks & mitigations

- **Risk: the field engine can't express scatter/converge as well as the raymarch did.** Mitigation: it expresses them *better* — scatter/converge are pure ball-position drivers, the field's native strength (morph-spec §6 designed them). Prototype the S3↔S4 scrub first in R1; checkpoint before deleting the raymarch.
- **Risk: pinned sections fight Lenis/ScrollTrigger on mobile.** Mitigation: the spec already prescribes the fallback (scroll-snap beats, vertical stacks); build mobile variants alongside, not after (AGENTS.md rule).
- **Risk: another engine detour.** Mitigation: P1 is a hard rule in this document; any proposal to touch shading/geometry beyond tuning requires a written owner decision first.
- **Risk: content (R4) never arrives and blocks launch.** Mitigation: R4's fallback states are defined now (placeholder-art cards + "selected architectures" label), so the site is launchable at the end of R3 without lying.

## 8. Decisions needed from the owner (blocking)

1. Approve this plan as the successor to build-spec S16 / morph-spec §12 sequencing.
2. R0 motion sign-off session (15 min on your machine: live morph + crossfade).
3. Portfolio: which real projects exist, which can show verified outcomes (gates R4, can start gathering during R1).
4. Real WhatsApp / email / domain / social handles.
5. Confirm: single continuous S3→S4 canvas (recommended) vs. handoff continuity if perf demands.

## 9. Immediate next step

R0 is one focused session: flip the field hero default, finish the tier probe + watchdog, smooth the same-page CTA scroll, and book the sign-off. Everything else hangs off that switch — it is the moment the site the visitors see becomes the site the documents describe.

---

*One liquid, one engine, one continuous story: scatter → regroup → become the mark → bloom into services. Discreto. Preciso. Transformador. — e finalmente visível.*
