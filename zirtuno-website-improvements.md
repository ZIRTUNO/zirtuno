# Zirtuno Website Improvements

Date: 2026-06-04  
Scope: professional audit and improvement backlog based on `AGENTS.md`, `CLAUDE.md`, `build-spec.md`, `references.md`, `zirtuno-state-analysis.md`, the critical review brief, current source code, and saved captures.

## Executive Verdict

The website has strong foundations and a clear, premium direction, but it is not yet at the Awwwards / top-1% bar. The biggest gap is no longer basic implementation. The app structure, bilingual copy, CTA mechanics, Motion integration, Lenis/GSAP setup, Sanity fallback, contact form, and WebGL architecture are mostly in place.

The remaining work is concentrated in five areas:

1. Prove the signature glass experience is safe and visible on real hardware.
2. Convert the key narrative chapters from good static sections into true scroll-choreographed moments.
3. Finish the visual art direction of the metaball states and morphs.
4. Replace placeholder portfolio/contact content with real launch content.
5. Polish bilingual, mobile, reduced-motion, and utility UI details until nothing feels like a skeleton.

The site is currently a high-quality prototype with some genuinely premium pieces. It should not be treated as launch-ready until the P0/P1 items below are resolved.

## What Is Working Well

### 1. Strategic Positioning

The site now leads with a clear business offer: Zirtuno builds complete digital ecosystems. This matches the v0.2 spec and keeps the 70% strategic clarity / 30% poetic atmosphere balance mostly intact.

Strong points:

- The hero headline and subline communicate the offer immediately.
- The Problem -> Ecosystem -> Services order is correct.
- The Services copy is commercially useful: what it is, what it solves, what it creates.
- The CTA system supports conversion instead of hiding the action behind symbolism.

### 2. Typography System

The sans/serif split is mostly respected:

- Business copy and most headings use Bricolage Grotesque.
- Instrument Serif italic is reserved mainly for poetic accents.
- JetBrains Mono supports labels, CTAs, numbers, and interface details.

This typography split is one of the strongest brand mechanisms in the site. Keep it strict.

### 3. Motion Package Integration

Motion is already installed correctly:

- `package.json` includes `motion`.
- Components import from `motion/react`, which is the modern Motion import path.
- `Reveal.tsx` uses Motion for scroll-triggered UI reveals.
- `app/[locale]/template.tsx` uses Motion for route transitions.

Do not add a direct `framer-motion` dependency or switch imports to `framer-motion`. The correct library is the `motion` package.

### 4. WebGL Architecture

The metaball system is much more mature than a normal website flourish:

- The same `MetaballScene` is reused across hero, problem, ecosystem, services, origin, and contact.
- The resting mark is traced from the real SVG.
- The shader includes IOR tuning, clearcoat highlights, environment-map support, fracture desaturation, and adaptive DPR.
- GPU tiering now exists through `lib/webgl/gpu-tier.ts`.

This is a real signature system, not just decoration.

### 5. Conversion Mechanics

The CTA/contact mechanics are strong:

- Canonical CTAs route to contact or work.
- Intent tags reach the contact form.
- The submit button is visible and labeled.
- The metaball exhale is additive, not the only submit mechanism.
- The API validates with zod and sends through Resend when configured.

The contact section needs content/env completion, not a new interaction model.

## Priority Backlog

## P0 - Must Fix Before Any Launch Decision

### 1. Prove The Glass Works On Real Hardware

Current state:

- The older analysis found that Intel UHD was blocked or froze when forced.
- The current repo has a newer GPU tier system that tries to provide full/lite/none tiers.
- The code is better than the older analysis, but real-device proof is still missing.
- Browser automation hung during forced/default local audit attempts, which means the live path still deserves suspicion.

Why it matters:

The metaball is the core visual identity. If it silently falls back to a flat SVG, hangs Chrome, or performs poorly on common business laptops, the signature device becomes a liability.

Required improvements:

- Test on the owner's Intel UHD machine with:
  - default URL
  - `?perf=1`
  - `?glass=lite&perf=1`
  - `?glass=full&perf=1`
  - `?state=0`
  - `?state=1`
  - `?pair=0-1-0.5`
- Test on at least one discrete GPU.
- Record FPS, DPR, canvas resolution, console errors, and whether any freeze occurs.
- Add a watchdog that safely demotes to SVG or a pre-rendered asset if frame time stays bad.
- Consider a pre-rendered glass loop for weak GPUs if live lite still hangs.

Acceptance:

- Default route never freezes.
- Intel UHD gets either stable lite glass or a deliberate premium fallback.
- Discrete GPU gets full live glass.
- `?perf=1` clearly reports tier, FPS, DPR, and canvas resolution.
- No forced mode can hang the browser indefinitely.

### 2. Stop Treating Placeholder Content As Launch Content

Current state:

- `lib/content/projects.ts` says all six projects are prototype entries.
- Several cards have no real preview media.
- Contact details are TODO defaults.
- Resend env configuration still needs production values.

Required improvements:

- Replace seed projects with real launch projects or clearly labeled selected architectures.
- Add real preview images/videos for every featured project.
- Confirm which projects can show verified metrics.
- Keep "Arquitetura selecionada / Selected architecture" where numbers are not verified.
- Replace contact placeholders:
  - WhatsApp URL
  - contact email and domain
  - Instagram/social links
  - `RESEND_API_KEY`
  - `CONTACT_EMAIL_TO`
  - `CONTACT_EMAIL_FROM`

Acceptance:

- At least three honest projects ship.
- No fake metrics.
- Every project has credible visual/media support.
- Contact links and email delivery are real.
- Test email includes the CTA intent tag.

## P1 - Core Quality Improvements

### 3. Rebuild S3 Problem As A True Pinned Narrative

Current state:

The Problem section is structurally clear but behaves like a normal content section with a sticky visual. The spec asks for a pinned, scroll-driven tension chapter.

Required improvements:

- Make S3 a pinned desktop section around 200vh.
- Let symptoms reveal one by one as scroll progresses.
- Tie each symptom to a subtle fracture displacement or dimming change.
- End with the mark visibly unresolved and dispersed.
- Keep mobile as a clean vertical list with simplified static/delayed fracture.

Visual direction:

- The fracture should feel like digital fragmentation, not just sliced glass.
- More real black gaps.
- Less centered crowded slicing.
- Colder, quieter, more lifeless than the hero.

Acceptance:

- Visitor feels a real problem before S4 resolves it.
- S3 and S4 create a readable broken -> connected arc.
- Reduced motion shows the fractured state statically.

### 4. Strengthen S4 Ecosystem As The Conceptual Centerpiece

Current state:

The Ecosystem diagram is one of the stronger body moments, but the visual weight still feels thinner than the concept deserves.

Required improvements:

- Keep the 10-node diagram.
- Strengthen connector visibility.
- Make traveling pulses clearer but still quiet.
- Improve hover/focus states so node, line, tooltip, and nearby system response feel alive.
- Ensure the center core reads as "your business" and not just another decorative mark.
- Verify the scroll-scrub convergence lands smoothly after S3.

Acceptance:

- The diagram reads as a connected organism.
- All 10 nodes are legible.
- Hover/focus has a clear but restrained effect.
- The S3 -> S4 transition is a payoff, not a gimmick.

### 5. Convert S8 Origin From Skeleton To Emotional Peak

Current state:

`ChapterName.tsx` still describes itself as a skeleton. The section visually reads as a centered poetic text stack with a metaball moment, not yet the pinned five-beat origin chapter in the spec.

Required improvements:

- Build the pinned ~600vh desktop sequence.
- Use GSAP ScrollTrigger for beat progress, not plain reveal stacking.
- Beat 1: two forms, two brothers, quiet tension.
- Beat 2: two forms become three and resolve into the exact Zirtuno mark.
- Beat 3: purpose line takes foreground.
- Beat 4: evolution into ecosystem capability.
- Beat 5: particles resolve into the ZIRTUNO wordmark.
- Follow with manifesto coda.
- Keep mobile as scroll-snap or clean stacked beats.

Typography improvements:

- Do not stack multiple same-sized centered serif paragraphs.
- Let one line dominate per beat.
- Use mono labels for the three founding pillars.
- Keep the three founding pillars distinct from the seven service pillars.

Acceptance:

- S8 feels like the emotional peak before Studio/Contact.
- It reads as a true origin story, not borrowed mythology.
- It does not become too poetic or vague.

### 6. Finish The Seven Service Forms

Current state:

The forms are improved versus the older review. Data and Marketing are more abstract now. Web, Software, and Automation still carry recognizable icon-pack logic.

Required improvements:

- Rework Web Design away from a literal window/portal rectangle.
- Rework Software away from stacked panels plus code glyph.
- Rework Automation away from gears unless they become much more brand-native.
- Review AI so it does not read as a generic network icon.
- Keep all forms in the same molten, plump, SDF family.
- Preserve state indices and Services mapping.

Visual direction:

- The forms should feel like "the same living organism in different states," not a set of glass icons.
- Each state must still be distinguishable at a glance.
- Avoid overly literal symbols.

Acceptance:

- Full contact sheet of all 8 states is approved.
- The set feels bespoke.
- None of the states feel like a stock icon rendered in cyan glass.

### 7. Tune Mid-Morph Frames

Current state:

The mid-morph frames are better than before, but several still become swollen, busy, and indistinct. The transition sometimes looks like two shapes averaged into a blob rather than a deliberate liquid bridge.

Required improvements:

- Tune `K_MORPH`, `K_MID`, `BRIDGE`, and `INFLATE`.
- Capture and review:
  - `?pair=0-1-0.5`
  - `?pair=0-3-0.5`
  - `?pair=3-4-0.5`
  - `?pair=6-7-0.5`
- Preserve endpoints exactly.
- Keep the body connected but avoid a single over-inflated lump.

Acceptance:

- Mid-morph looks like mercury necking between states.
- It feels alive, not broken or muddy.
- No morph destroys service legibility for too long.

### 8. Localize Portfolio Service Tags

Current state:

Project service tags are stored as `servicesInvolved: string[]`, currently in Portuguese. On the EN page, cards can still show Portuguese phrases like "Integrações CRM" and "Automação".

Required improvements:

- Change `servicesInvolved` to localized values, or store service keys and translate via i18n.
- Update Sanity schema/types accordingly.
- Update ProjectCard and case-study pages.

Acceptance:

- EN pages have no Portuguese service tags.
- PT pages preserve the correct Portuguese tags.
- Sanity schema supports bilingual project service metadata.

## P2 - Premium Polish

### 9. Fix Strategic Copy Set In Serif

Current issue:

The Method lead uses `font-poetic`, but the text is strategic process copy. It should be sans.

Required improvement:

- Change Method lead styling from serif italic to Bricolage/sans body or body-large.
- Keep the section strategic, precise, and business-first.

Acceptance:

- Business/process copy does not use Instrument Serif.
- Serif remains a poetic accent only.

### 10. Improve Work Section Visual Credibility

Current state:

The Work layout is clean but generic. Empty preview blocks make it feel like a placeholder grid.

Required improvements:

- Add real preview media or deliberately designed architecture visuals.
- Use subtle Motion hover interactions:
  - preview media lift
  - cyan edge sweep
  - text shift
  - no generic card glow
- Consider horizontal featured strip on desktop, as specified, instead of a basic grid.
- Make `/work` filters feel native and premium.

Acceptance:

- Work becomes a credibility section, not filler.
- A visitor can understand proof of capability without opening every case.

### 11. Make Contact Feel Finished Without Reducing Usability

Current state:

The form is functional and clear. The exhale visual is promising, but the section still needs final content and a more resolved success/error experience.

Required improvements:

- Confirm real secondary contact paths.
- Improve success state with a concise, premium response.
- Add accessible toast or inline confirmation.
- Add subtle Motion transitions to form status changes.
- Ensure the exhale never triggers before valid submit.
- Verify keyboard and screen-reader behavior.

Acceptance:

- Submit remains unmistakable.
- Success/error states feel designed.
- Contact details are real.

### 12. Mobile Pass

Current state:

Mobile fallbacks exist, but the signature experience is mostly simplified. That is acceptable, but the mobile result still needs visual QA.

Required improvements:

- Check every section at 360, 390, 430, 768 widths.
- Verify no text overflow in PT or EN.
- Ensure hero CTAs appear before visual complexity.
- Convert pinned desktop experiences into intentional mobile equivalents.
- Make ecosystem diagram vertical stack feel designed, not downgraded.
- Ensure Work cards and Contact form spacing are clean.

Acceptance:

- Mobile reads as deliberate.
- No major section feels like a broken desktop compromise.

### 13. Reduced-Motion Pass

Current state:

Reduced-motion checks exist and WebGL falls back to static marks. This is good, but static states must still feel premium.

Required improvements:

- Verify `prefers-reduced-motion` for:
  - hero
  - problem
  - ecosystem
  - services
  - origin
  - contact
  - page transition
  - cursor
  - Lenis
- Improve static fallback compositions where they feel too flat.
- Ensure no content is hidden behind motion.

Acceptance:

- Reduced-motion experience is not a second-class site.
- Static SVG fallbacks communicate the same narrative.

### 14. Page Transition And Loading Polish

Current state:

Motion route transition exists. Loading screen is still a simple pulse according to comments.

Required improvements:

- Improve loading wordmark assembly per spec.
- Keep transition fast and quiet.
- Do not overuse cyan wipe.
- Ensure reduced motion skips transition.
- Use Design Spells as taste reference for small moments, not as a copy source.

Acceptance:

- Loading and route changes feel premium but not theatrical.

### 15. Cursor Polish

Current state:

Custom cursor exists and respects reduced motion/coarse pointer.

Required improvements:

- Verify hover states across all CTAs, form fields, project cards, diagram nodes.
- Keep cursor subtle.
- Avoid fighting native text selection in forms.

Acceptance:

- Cursor adds tactility without becoming a gimmick.

## P3 - Technical And Operational Improvements

### 16. Strengthen QA Scripts

Current state:

There are many verification scripts. They are useful, but some depend on browser/GL conditions that can hang or produce stale captures.

Required improvements:

- Add a safe timeout wrapper around glass capture scripts.
- Add a script that reports GPU tier without mounting the heavy shader.
- Add real-device manual QA checklist to `scripts/` or docs.
- Keep captures dated or clearly overwritten.

Acceptance:

- QA can be run without risking an indefinite browser hang.
- Capture outputs are trustworthy and easy to compare.

### 17. Update README

Current state:

README still looks like the default create-next-app README.

Required improvements:

- Replace with project-specific docs:
  - how to run dev/build
  - env variables
  - capture scripts
  - GPU testing modes
  - content/CMS flow
  - deployment notes
  - locked stack reminder

Acceptance:

- A new collaborator can run and verify the project without reading the whole spec first.

### 18. Sanity Studio / CMS Completion

Current state:

Sanity schema/client/query files exist, but editable content flow is not fully productionized.

Required improvements:

- Confirm whether Sanity Studio should be mounted in this repo.
- Finish project schema for localized service tags/media/gallery.
- Add validation rules preventing fake metrics.
- Add preview support if useful.

Acceptance:

- Portfolio content can be managed safely without code edits.

### 19. Analytics And Conversion Events

Current state:

Analytics are mentioned in the spec but not fully assessed here.

Required improvements:

- Add Vercel Analytics and Plausible if not already configured.
- Track:
  - CTA clicks by intent
  - contact submit attempt
  - contact success
  - portfolio card clicks
  - language switch
  - work filter usage
- Do not track sensitive form content.

Acceptance:

- Zirtuno can see which CTAs and sections drive inquiries.

### 20. SEO And Metadata Final Pass

Current state:

Metadata, sitemap, robots, Organization JSON-LD, and Service JSON-LD exist.

Required improvements:

- Confirm titles/descriptions in PT and EN.
- Add per-project OG images if real media exists.
- Ensure `/work` filters do not create duplicate-index issues.
- Confirm canonical/alternate locale links.
- Validate JSON-LD.

Acceptance:

- SEO basics are production-ready in both languages.

## Reference Guardrails

Use the references like this:

- Motion: DOM micro-interactions, page transitions, hover/tap/focus, small layout transitions.
- GSAP ScrollTrigger: pinned chapters, scrubbed timelines, scroll-bound shader choreography.
- Lenis: smooth scroll foundation, synced with ScrollTrigger.
- 21st.dev: utility UI only, such as tooltips, form primitives, dialogs, toasts. Never signature sections.
- Design Spells: taste reference for small interaction details. Study principles, do not copy effects.
- React Bits: animation/code reference for secondary polish. Do not paste components into signature sections.
- Codrops / Three / R3F / Inigo Quilez: shader and particle technique references.

Forbidden:

- Marketplace components in hero, ecosystem, metaball, services visual, Origin, or contact exhale.
- Generic AI aesthetic.
- Purple/green palettes.
- Fake portfolio metrics.
- Business headlines in serif.
- Hiding contact submit behind symbolism.

## Recommended Build Sequence

1. Real GPU testing and tier hardening.
2. Portfolio/contact content decisions.
3. S3 pinned Problem rebuild.
4. S4 Ecosystem payoff polish.
5. S8 pinned Origin rebuild.
6. Service form and mid-morph visual iteration.
7. Work media and localization fixes.
8. Typography correction and Motion micro-interaction polish.
9. Mobile and reduced-motion pass.
10. SEO, analytics, README, final QA.

## Ready-To-Use Implementation Prompt

```text
Improve the Zirtuno website using build-spec.md, AGENTS.md, references.md, and
zirtuno-website-improvements.md as the source of truth.

Do not change the locked stack. Keep copy in i18n files. Keep business headings
in Bricolage Grotesque and serif italic only for poetic accents. Never invent
portfolio metrics.

Start with P0:
1. Verify the glass system on real hardware with ?perf=1, default, ?glass=lite,
   ?glass=full, ?state=N, and ?pair=A-B-0.5. If live lite can still hang on Intel
   UHD, add a safe demotion or pre-rendered premium fallback.
2. Replace prototype portfolio/contact content with real launch content or
   clearly marked selected architecture entries.

Then complete the core narrative:
3. Rebuild S3 as a pinned Problem chapter where symptoms drive the fracture.
4. Strengthen S4 so the broken -> connected payoff is unmistakable.
5. Rebuild S8 as a pinned five-beat Origin chapter, not a static text stack.

Then polish:
6. Rework remaining icon-like service forms into bespoke brand-native SDF states.
7. Tune mid-morph frames so transitions read as deliberate liquid mercury.
8. Localize project service tags and add real media.
9. Correct strategic copy that uses serif incorrectly.
10. Run full desktop, mobile, reduced-motion, CTA, build, lint, and type checks.

Use Motion from motion/react for DOM micro-interactions. Use GSAP ScrollTrigger
for scroll-bound choreography. Use Lenis as the scroll foundation. Use 21st.dev,
Design Spells, and React Bits only as references/utility sources, never as
drop-in signature-section components.
```

## Definition Of Done For This Improvement Pass

The next major pass is done when:

- The site never freezes on common hardware.
- The hero, Problem, Ecosystem, Services, Origin, and Contact feel like one visual system.
- A first-time visitor understands the offer before any poetic chapter.
- The S3 -> S4 broken-to-connected arc is obvious.
- The Origin chapter lands emotionally without becoming vague.
- Portfolio content is real or honestly labeled.
- Contact details and email delivery are production-ready.
- PT and EN are equally polished.
- Mobile and reduced-motion are deliberate.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, and conversion-path QA pass.

