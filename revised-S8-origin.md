# Revised Section — S8 · CHAPTER 7 · THE ORIGIN

> Replaces the old "S8 · THE NAME (Etymology)" in `docs/build-spec.md`.
> Tell Claude Code: *"Replace S8 in docs/build-spec.md with this revised section and rebuild Chapter 7 accordingly."*

---

## What changed and why

The chapter previously told the Zéfiro + Ventura etymology. It now tells **Zirtuno's real origin**: two brothers, three founding pillars (social, health, finance), and a purpose — to build what doesn't yet exist. This is the emotional peak of the site, still placed *after* the business case (Problem → Ecosystem → Services → Method → Work), where it deepens trust right before contact. It remains the concentrated **30% poetic** moment, but the poetry now serves a true story.

The visual narrative is tied directly to the logo: **two brothers (two forms) → a shared vision crystallizes into three pillars (the three forms of the Zirtuno mark) → the logo expands into the full ecosystem.** The birth of the mark is the birth of the company.

---

## S8.1 Placement & role
Unchanged in placement — Chapter 7, after Selected Work, before Studio. It answers "why does this company exist?" at the moment the visitor is ready to be moved. Rename the chapter label from "The Name" to **A Origem / The Origin**.

## S8.2 Layout
Pinned scroll section (~600vh scroll length, pinned to 100vh). Five beats driven by GSAP ScrollTrigger scrub, same technical approach as the prior version (S8 v0.1 mechanics), reusing the metaball + particle systems already built. Mobile: one beat per scroll-snap section, no scrub.

## S8.3 The Five Beats

**Beat 1 (0–18%) — Two brothers.**
Two fluid forms enter from opposite sides and drift toward each other — drawn, not colliding. Quiet.
- PT: *Tudo começou com dois irmãos e uma mesma inquietação: e se construíssemos o que ainda não existe?*
- EN: *It began with two brothers and a single restlessness: what if we built what doesn't exist yet?*

**Beat 2 (18–42%) — Three pillars, one mark.**
From the meeting of the two forms, a third emerges. The three forms settle into rotation — **this is the moment the Zirtuno logo forms on screen.** As it resolves, three quiet labels fade in, one per form:
`Social · Saúde · Finanças` (EN: `Social · Health · Finance`).
- PT: *De uma só visão nasceram três pilares — social, saúde e finanças. As forças que movem cada negócio e cada vida.*
- EN: *From one vision, three pillars were born — social, health, and finance. The forces that move every business and every life.*

**Beat 3 (42–62%) — The purpose.**
The logo holds, breathing. Text takes the foreground.
- PT: *A Zirtuno nasceu para transformar ideias em estrutura. Para dar forma a sistemas, soluções e tecnologias que ainda esperavam para existir.*
- EN: *Zirtuno was born to turn ideas into structure — to give form to the systems, solutions, and technologies still waiting to exist.*

**Beat 4 (62–82%) — The evolution.**
The three forms begin to multiply and connect, echoing the Ecosystem chapter — the mark expanding into capability.
- PT: *De dois irmãos a um estúdio digital completo. De uma ideia a um ecossistema — software, IA, automação, branding e estratégia.*
- EN: *From two brothers to a complete digital studio. From an idea to an ecosystem — software, AI, automation, branding, and strategy.*

**Beat 5 (82–100%) — Resolution.**
The expanded forms condense back into the **ZIRTUNO wordmark** (particle convergence, as in the prior reveal). Below it, the closing line:
- PT: **Construímos o que ainda não existe.**
- EN: **We build what doesn't exist yet.**

*(Optional name grace note — see S8.5 decision. If kept, a single dim line beneath the closing line: PT "ZIRTUNO — o sopro que dá forma." / EN "ZIRTUNO — the breath that gives shape.")*

## S8.4 Manifesto coda
After Beat 5, the four principles follow as a tight scrolling sequence (unchanged):
*Movimento sem ruído.* · *Forma para o que estava disperso.* · *Direção, não apenas execução.* · *Discreto. Preciso. Transformador.*
(EN: Movement without noise · Form for what was dispersed · Direction, not just execution · Discreet. Precise. Transformative.)

## S8.5 Open decisions (flag for the user)
- **Zéfiro + Ventura etymology:** the name genuinely derives from Zéfiro (gentle west wind) + Ventura (path/destiny). Three options: (a) drop entirely — the brothers story stands alone; (b) keep as the single dim grace note in Beat 5 (recommended — honors the name's meaning without competing with the founding story); (c) restore as a short opening layer before Beat 1. **Default: (b).**
- **Meaning of the three pillars:** confirm what social / health / finance represent — impact sectors Zirtuno builds for, founding values, or target markets? The Beat 2 copy currently frames them as "the forces that move every business and every life," which works for any reading, but a confirmed meaning lets the line get sharper.
- **Brothers — named or not?** Anonymous (default, consistent with Studio chapter) or named with a portrait moment? If named, Beat 1 can carry their first names.

## S8.6 Visual notes
- Reuse the existing metaball component for the two→three form transition (Beats 1–2) and the particle system for the wordmark convergence (Beat 5).
- The three-form "logo forms" moment in Beat 2 must visibly land as **the Zirtuno mark** — if the SVG-traced resting state is implemented (see hero note), use that exact geometry here so the logo resolves precisely.
- Keep the three pillar labels (Social/Saúde/Finanças) understated — small mono, fading in beside each form, not large display type. The forms are the hero, the labels are the annotation.

## S8.7 Acceptance — revised S8 done when:
- [ ] Chapter reads as Zirtuno's true origin (two brothers, three pillars, the purpose), not borrowed mythology
- [ ] Beat 2 visibly forms the Zirtuno logo from two→three forms, with pillar labels
- [ ] Closing lands on "Construímos o que ainda não existe / We build what doesn't exist yet"
- [ ] Manifesto coda follows
- [ ] Chapter sits after Selected Work, before Studio
- [ ] Both languages; mobile + reduced-motion fallbacks (static stills of each beat)
- [ ] Etymology grace note present or absent per the S8.5 decision
