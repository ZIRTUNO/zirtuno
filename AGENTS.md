# AGENTS.md — Zirtuno Website

> Read this at the start of every session. It is the source of truth for how to build, what to never break, and how to behave. The full spec lives at `build-spec.md`. When in doubt, that spec wins on detail; this file wins on rules and taste.

---

## THE PROJECT

Zirtuno is a Brazilian digital studio that builds **complete digital ecosystems** — software, AI, automation, data, branding, and marketing — connected into one structure. We are building their website. The goal is an **Awwwards-level** site that is also a **serious, conversion-focused business site**. Balance target: **70% strategic clarity · 30% poetic brand atmosphere.** Never let it drift to all-poetry or all-corporate.

Primary language **PT-BR**, secondary **EN**. Both ship. Copy is written, not auto-translated — preserve the spirit in each.

---

## BRAND ESSENCE (informs every taste decision)

Zirtuno = the breath of **Zéfiro** (the gentle Greek west wind that transforms without violence) + **Ventura** (path, destiny, courage). The brand is: **quiet but powerful, transformation without noise, form given to what was dispersed.** The logo is three fluid metaball forms — they are the breath made visible.

Tone in three words: **Discreto. Preciso. Transformador.** Plus, for v0.2: **Clear. Strategic. Commercially strong.**

---

## NON-NEGOTIABLE RULES

1. **Typography = a four-role system (display / text / serif / mono).** DISPLAY headlines — the hero headline and every section `h2` — use **Bricolage Grotesque** via the `font-grotesk` utility (`--font-grotesk`). **BODY, UI, nav, subheads, leads and forms use Geist** (`--font-sans`, the workhorse text face). **Serif italic (Instrument Serif) is for poetic accents ONLY** — hero eyebrow, pillar descriptors, the Origin chapter, the Contact prompt, the manifesto coda. **JetBrains Mono** carries labels, numbers, counters and CTAs. Reserve Bricolage for display-scale headlines (never mid-titles or body); never set a business headline or body/UI in the serif. The scale lives as `--text-*` tokens in `globals.css` (display / title / lead / body / mono tiers) — compose type from those tiers, don't hardcode sizes.
2. **The metaball narrative carries business meaning.** Fragments scatter in The Problem (S3) and converge into one connected organism in The Ecosystem (S4). This is the visual proof of the whole pitch. Do not break the dispersed→connected arc.
3. **NEVER invent metrics.** Portfolio outcomes are real verified numbers, honest narratives, or labeled "Arquitetura selecionada / Selected architecture." No fabricated percentages, ever.
4. **The contact submit must be obvious.** A real labeled button (`Solicitar análise inicial`) is always the canonical action. The metaball "exhale" is additive decoration, never the only way to submit.
5. **CTA hierarchy is load-bearing.** Place the four canonical CTAs exactly per the spec's placement map (S1.15). Every CTA carries an entry-intent tag that reaches the contact form.
6. **Color discipline.** Cyan on black only. No purples, greens, or gradients beyond cyan→deeper-cyan. The palette in "Design Tokens" below is the entire palette.
7. **Accessibility is not optional.** Every WebGL moment has a `prefers-reduced-motion` fallback (static SVG). Keyboard nav works. Contrast passes WCAG AA.
8. **Avoid the generic AI aesthetic.** No Inter/Roboto/Poppins/Space Grotesk. No default shadcn look on signature sections. No marketplace components in the hero, ecosystem, etymology, or metaball. Those four are bespoke, always.

---

## TECH STACK (locked — do not substitute without asking)

- **Next.js 16** (App Router, RSC, Turbopack default), **TypeScript**
- **Tailwind CSS v4** + CSS variables for theming
- **Raw WebGL2 + OGL** — the unified liquid field (metaballs, all chapter visuals; replaced Three.js/R3F in R1)
- **GSAP** + **ScrollTrigger** (scroll choreography) · **Motion** (DOM micro-interactions)
- **Lenis** (smooth scroll, tuned calm)
- **next-intl** (PT-BR + EN)
- **Sanity v3** (CMS — portfolio + editable content)
- **react-hook-form** + **zod** + server actions (forms) · **Resend** (email)
- **Vercel** (hosting, OG generation) · **Vercel Analytics** + **Plausible**

---

## DESIGN TOKENS (quick reference — full set in build-spec S1)

```css
--ink:#000000; --surface:#0A0A0C;
--cyan:#00E3FE; --cyan-glow:#4DECFF; --cyan-deep:#00B6CC; /* real brand cyan */
--paper:#F2F0EB; --paper-mute:rgba(242,240,235,0.5);
--paper-dim:rgba(242,240,235,0.25); --paper-faint:rgba(242,240,235,0.1);
--warn:#FF6B5C; /* form errors only */
--font-grotesk:'Bricolage Grotesque'; /* DISPLAY headlines only (hero + section h2) */
--font-sans:'Geist';                  /* body, UI, nav, subheads, leads, forms */
--font-display:'Instrument Serif';    /* SERIF ITALIC = poetry accents only */
--font-mono:'JetBrains Mono';         /* labels, numbers, counters, CTAs */
```

Easings: `calm cubic-bezier(0.65,0,0.35,1)`, `arrive cubic-bezier(0.22,1,0.36,1)`, `depart cubic-bezier(0.64,0,0.78,0)`.
Durations (ms): micro 200, short 400, medium 700, long 1200, morph 1400, autocycle 9000, breath 8000.

Fonts are self-hosted at build time by `next/font/google` (no runtime third-party
requests): Geist (text), Bricolage Grotesque (display), Instrument Serif (poetry),
JetBrains Mono (labels).

---

## SITE ARCHITECTURE (9 chapters, business-first order)

```
01 Hero (Overture)      — positioning + offer + primary CTA
02 The Problem          — fragmented digital structure (metaball fractures)
03 The Ecosystem        — "ecossistemas, não peças soltas" (fragments converge) ← centerpiece
04 The Services         — 7 pillars, each: what-it-is / solves / creates
05 Método Zirtuno       — Diagnóstico→Estrutura→Construção→Integração→Evolução
06 Selected Work        — portfolio, primary credibility, honest outcomes
07 The Name             — Zéfiro+Ventura etymology reveal + manifesto coda (the 30% poetry)
08 The Studio           — where / who / why
09 Contact              — clear labeled submit + artistic exhale
```

The 7 metaball pillar states (S2.3) are SHARED: the hero cycles them, the services chapter morphs to them, the problem chapter uses a `Fractured` variant, the ecosystem uses the unified resting state as its core. Build the metaball as one reusable component with exported state definitions in `lib/webgl/symbols.ts` (the registry; drivers in `lib/webgl/field-drivers.ts`).

---

## SIGNATURE MOMENTS NEED VISUAL ITERATION (read this carefully)

You cannot see what your shaders render. These four moments WILL require human screenshot feedback, 3–6 rounds each:
- **Metaball** (S2.3) — size, morph easing, color saturation, hover physics feel
- **Fractured metaball** (S3.2) — must read as clearly "disconnected"
- **Ecosystem converge + diagram** (S4) — the fragments→organism transition
- **Etymology particles** (S8) — text→particles→text legibility

For these: build a first version from the spec + the references in `references.md`, then STOP and ask the user to run it and share a screenshot before iterating. Do not assume your first shader looks right. For everything else (structure, layout, copy, forms, CMS, CTAs), proceed normally.

When working on shaders, consult `references.md` first — especially Three.js, Inigo Quilez SDF articles, and the mapped Codrops tutorials.

---

## BUILD ORDER (follow this sequence)

1. Setup + dependencies (spec S0)
2. Tokens, easings, reduced-motion utility (S1.1–1.4, S1.13)
3. Custom cursor + Lenis (S1.5–1.6)
4. **CTA system (S1.15) — build early, used everywhere**
5. Hero: layout + copy + CTAs first, then metaball resting state, then 7 states + morph + hover + keyboard (S2)
6. Breath layer + type breathing (S1.7–1.8)
7. The Problem — fractured state (S3)
8. The Ecosystem — diagram + converge transition (S4) ← reuse S3 fragments
9. The Services — reuse metaball + commercial copy (S5)
10. Método Zirtuno (S6)
11. Selected Work — cards + /work + case study + Sanity schema (S7)
12. The Name — etymology particles, hardest visual, build after simpler chapters (S8)
13. Studio (S9)
14. Contact — labeled submit first, exhale second (S10)
15. Page transitions + loading + 404 (S1.9–1.11)
16. Footer + navigation, 9-chapter index (S11–S12)
17. Responsive + performance + SEO passes (S13–S15)
18. Audio only if explicitly scoped (S1.12)
19. Final QA + conversion-path test (every CTA → contact with correct intent tag)

Build a deployable skeleton (everything except the four signature WebGL moments) FIRST. It's a fast win and gives the user something to react to.

---

## WORKING CONVENTIONS

- **Work incrementally.** One section per logical unit of work. Commit with clear messages referencing the spec ID (e.g. `feat(S4): ecosystem diagram nodes`).
- **Ask before:** changing the locked stack, adding a dependency not in the spec, deviating from the IA, using a marketplace component on a signature section, or inventing portfolio content.
- **Confirm acceptance criteria** (each spec section has them) before considering a section done.
- **Server-render conversion copy.** The Problem/Ecosystem/Services text must be crawlable (RSC), not client-only.
- **Mobile and reduced-motion are part of "done,"** not a later pass — at minimum stub the fallback when you build each section.
- **Don't gold-plate the skeleton.** Get structure deployable, then pour craft into the signature moments.
- **Keep copy in i18n files** (`lib/i18n/messages/pt.json`, `en.json`), never hard-coded in components.

---

## OPEN DECISIONS (block the relevant section until the user answers)

- Ecosystem center: unified metaball core (recommended) vs literal `SEU NEGÓCIO` node?
- Portfolio: how many real projects exist? Which can show verified metrics vs. need narrative/"selected architecture"?
- Studio: anonymous role grid (default) vs portraits?
- WhatsApp number, contact email + domain, social handles (needed for contact + footer).
- Audio in or out for v1 (default: out).

If you hit one of these and the user hasn't answered, implement the recommended default, leave a `// TODO(decision):` comment, and flag it.

---

## DEFINITION OF DONE (whole site)

A first-time visitor can, without scrolling past poetry first: understand what Zirtuno sells, feel the problem it solves, see the ecosystem concept, review the services and method, see real proof of work, be moved by the brand story, and contact Zirtuno through an obvious CTA — at 60fps on desktop, gracefully degraded on mobile and reduced-motion, in both PT-BR and EN, with every CTA reaching the contact form tagged by intent.

*Discreto. Preciso. Transformador. — e comercialmente forte.*
