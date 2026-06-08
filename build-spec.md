# ZIRTUNO Website — Build Specification (v0.2)

> An executable script. Read top-to-bottom, build section-by-section.
> **v0.2 rebalances the architecture toward business clarity and conversion while preserving the award-level artistic execution.**
> Target balance: **70% strategic clarity · 30% poetic brand atmosphere.**

---

## WHAT CHANGED FROM v0.1

1. **New information architecture (business-first).** New flow: Hero → Problem → Ecosystem → Services → Method → Work → The Name (story) → Studio → Contact.
2. **Hero is clearer.** Leads with a direct positioning headline; poetic line becomes a supporting eyebrow. Primary + secondary CTAs added.
3. **New chapter: The Problem** (fragmented digital structure narrative).
4. **New chapter: The Ecosystem** ("Criamos ecossistemas digitais, não peças soltas") — the conceptual centerpiece.
5. **Services rewritten commercially** — each pillar states what it is, what it solves, what value it creates. Poetic descriptors retained as accents.
6. **Process replaced by Método Zirtuno** — Diagnóstico → Estrutura → Construção → Integração → Evolução.
7. **Portfolio strengthened** to a primary credibility section with full card anatomy. No invented metrics.
8. **CTA system added** with a clear hierarchy across the page.
9. **The Name (etymology) moved later** — lands after the business case as the emotional peak before contact. The old Philosophy chapter folds into it as a coda.
10. **The metaball narrative now carries business meaning**: fragments scatter (Problem) and converge into one connected organism (Ecosystem).

This supersedes v0.1 and the IA in `zirtuno-roadmap.md`. The roadmap's brand intent still holds.

---

## HOW TO USE THIS DOCUMENT

1. Build `S0` (Setup) and `S1` (Globals) first.
2. Build chapters in order `S2` → `S10`.
3. All copy is provided in **PT-BR (primary)** and **EN (secondary)**. Both ship.
4. Animation timings/easings are in `S1.4`. Don't improvise.
5. Cross-references use IDs (e.g. "see S1.6"). Always check them.
6. Acceptance criteria conclude each section and are non-negotiable.
7. **The CTA hierarchy (S1.15) is load-bearing for conversion.** Place CTAs exactly where specified.

---

## S0 · SETUP

### S0.1 Tech Stack (locked)

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 16** (App Router) | SSR for SEO, RSC, image optimization, Turbopack default |
| Language | TypeScript | type safety across a motion-heavy codebase |
| Styling | **Tailwind CSS v4** + CSS variables | utility-first + theming |
| 3D / WebGL | **Three.js** + **@react-three/fiber** + **@react-three/drei** | metaballs, particles, ecosystem diagram |
| Animation | **GSAP** (+ ScrollTrigger) + **Motion** | scroll-bound and component motion |
| Smooth scroll | **Lenis** | calm, tunable inertia |
| i18n | **next-intl** | PT-BR + EN |
| CMS | **Sanity** (v3) | structured bilingual content, portfolio |
| Forms | **react-hook-form** + zod + server actions | accessible form handling |
| Email | **Resend** | transactional |
| Analytics | **Vercel Analytics** + **Plausible** | privacy-first + conversion events |
| Hosting | **Vercel** | edge, previews, OG generation |

### S0.2 Dependencies
```bash
npx create-next-app@latest zirtuno --typescript --tailwind --app --no-src-dir
cd zirtuno
npm i three @react-three/fiber @react-three/drei
npm i gsap @gsap/react lenis motion
npm i next-intl @sanity/client @sanity/image-url
npm i react-hook-form zod @hookform/resolvers resend
npm i clsx tailwind-merge
npm i -D @types/three
```

### S0.3 File Structure
```
zirtuno/
├── app/[locale]/
│   ├── layout.tsx
│   ├── page.tsx                    # homepage: all chapters
│   ├── work/page.tsx               # full portfolio index
│   ├── work/[slug]/page.tsx        # case study
│   ├── not-found.tsx
│   └── loading.tsx
├── app/api/contact/route.ts
├── components/
│   ├── chrome/        (TopBar, SideIndex, CustomCursor, LoadingScreen, LanguageToggle, CtaButton)
│   ├── hero/          (Hero, MetaballCanvas, PillarIndicator)
│   ├── chapters/      (ChapterProblem, ChapterEcosystem, ChapterServices, ChapterMethod,
│   │                   ChapterWork, ChapterName, ChapterStudio, ChapterContact)
│   ├── ecosystem/     (EcosystemDiagram, EcosystemNode)
│   ├── shaders/       (metaball.frag/vert, breath.frag, particles.frag, fragments.frag)
│   ├── ui/            (BreathLayer, ChapterLabel, ScrollHint, SectionCta)
│   └── motion/        (LenisProvider, PageTransition)
├── lib/
│   ├── animation/     (easings.ts, durations.ts, reduced-motion.ts)
│   ├── webgl/         (states.ts, tier.ts)
│   ├── sanity/        (client.ts, queries.ts)
│   ├── content/       (services.ts, method.ts, ecosystem.ts, problem.ts)
│   └── i18n/          (config.ts, messages/pt.json, messages/en.json)
└── public/ (fonts/, og/)
```

### S0.4 Environment Variables
```
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=
RESEND_API_KEY=
CONTACT_EMAIL_TO=
NEXT_PUBLIC_WHATSAPP_URL=
```

### S0.5 Acceptance — S0 done when:
- [ ] `/pt` and `/en` routes respond
- [ ] All deps installed clean
- [ ] File structure scaffolded
- [ ] `.env.local.example` documented

---

## S1 · GLOBAL SYSTEMS

### S1.1 Color Tokens
```css
:root {
  --ink:#000000; --surface:#0A0A0C;
  --cyan:#00E3FE; --cyan-glow:#4DECFF; --cyan-deep:#00B6CC; /* real brand cyan (from zirtuno-logo-mark.svg); glow=L65 deep=L40, hue 186° */
  --paper:#F2F0EB; --paper-mute:rgba(242,240,235,0.5);
  --paper-dim:rgba(242,240,235,0.25); --paper-faint:rgba(242,240,235,0.1);
  --warn:#FF6B5C; /* form errors only */
}
```

### S1.2 Typography Tokens
Self-host fonts. `--font-display:'Instrument Serif'`, `--font-sans:'Bricolage Grotesque'`, `--font-mono:'JetBrains Mono'`.

Type scale (mobile / desktop):
| Token | Mobile | Desktop | Usage |
|---|---|---|---|
| `--text-hero` | 2.25rem | 3.75rem | Hero positioning headline (sans, tight) |
| `--text-display-xl` | 3rem | 7rem | Etymology reveal words |
| `--text-display-l` | 2rem | 3.25rem | Chapter headlines (Problem, Ecosystem, etc.) |
| `--text-display-m` | 1.5rem | 2.25rem | Pillar names, method phases |
| `--text-poetic` | 1.125rem | 1.5rem | Poetic eyebrows & descriptors (serif italic) |
| `--text-body-l` | 1.125rem | 1.25rem | Lead paragraphs |
| `--text-body` | 1rem | 1rem | Body |
| `--text-mono` | 0.75rem | 0.75rem | Labels, numbers, CTAs |
| `--text-mono-sm` | 0.6875rem | 0.6875rem | Captions |

**Critical typographic rule (v0.2):** Business headlines (Problem, Ecosystem, Services, Method) use **Bricolage Grotesque (sans)**. The **serif italic is reserved for poetic accents only** (hero eyebrow, pillar descriptors, etymology chapter, manifesto coda). This split is how the 70/30 balance stays legible: **sans = business, serif italic = soul.**

### S1.3 Spacing & Layout
```css
:root { --page-padding-mobile:1.5rem; --page-padding-desktop:3rem; --section-gap:8rem; --chapter-min-h:100svh; }
```
Grid: 12 cols desktop, 4 mobile, gutter 1.5rem.

### S1.4 Easings & Durations
```ts
EASINGS = { calm:'cubic-bezier(0.65,0,0.35,1)', arrive:'cubic-bezier(0.22,1,0.36,1)',
            depart:'cubic-bezier(0.64,0,0.78,0)', breath:'cubic-bezier(0.45,0.05,0.55,0.95)' }
DURATIONS = { micro:200, short:400, medium:700, long:1200, breath:8000, autocycle:9000, morph:1400 }
```

### S1.5–S1.14 (Cursor, Lenis, Breath layer, Type breathing, Page transitions, Loading, 404, Audio-deferred, Reduced motion)
*Unchanged from v0.1 (see v0.1 S1.5–S1.13).* Retained behaviors: two-layer cyan cursor; Lenis calm scroll synced to ScrollTrigger; breath noise field ≤4% opacity; 8s type breathing on serif display only; cyan diagonal page transition (~700ms); loading wordmark assembly (~1.5s, skip on return); lone-metaball 404; reduced-motion disables motion systems and swaps metaball → static SVG.

### S1.15 CTA SYSTEM (load-bearing for conversion)
Component `components/chrome/CtaButton.tsx`. Variants:
- **Primary**: cyan 1px border, transparent fill, paper text, mono uppercase, pad 1rem 2rem. Hover: cyan fill sweeps L→R (200ms arrive), text→ink, glow. `data-cursor="hover"`.
- **Secondary**: text + trailing `→`, paper. Hover: arrow +6px, underline draws.
- **Ghost**: small mono link, paper-mute + arrow. Hover → cyan.

**Four canonical CTAs** (i18n keys, reuse everywhere):
| Key | PT-BR | EN | Variant | Action |
|---|---|---|---|---|
| `cta.analysis` | Solicitar análise inicial | Request initial analysis | primary | → contact, tag "analysis" |
| `cta.portfolio` | Ver portfólio | See portfolio | secondary | → /work |
| `cta.structure` | Estruturar meu digital | Structure my digital | primary | → contact, tag "structure" |
| `cta.talk` | Falar com a Zirtuno | Talk to Zirtuno | primary/ghost | → contact / WhatsApp |

**Placement map (implement exactly):**
- TopBar (persistent): `cta.talk` (ghost).
- Hero: `cta.analysis` (primary) + `cta.portfolio` (secondary).
- Problem end: `cta.structure` (primary).
- Ecosystem end: `cta.structure` (primary) + `cta.portfolio` (secondary).
- Services: each pillar `cta.portfolio` filtered to category (ghost); section end `cta.analysis` (primary).
- Method end: `cta.analysis` (primary) + `cta.talk` (secondary).
- Work: each card "Ver projeto" (ghost); section end `cta.portfolio` (secondary).
- Studio end: `cta.talk` (secondary).
- Contact: the conversion endpoint (S10).

Pre-tags ("analysis"/"structure") pre-fill a hidden intent field at contact so the team sees entry intent.

### S1.16 Acceptance — S1 done when:
- [ ] Tokens applied; business headlines sans, poetic accents serif italic
- [ ] Cursor, Lenis, breath, type breathing, transitions, loading, 404 working
- [ ] Reduced-motion fallbacks verified
- [ ] CtaButton renders all variants; four canonical CTAs wired with correct actions + pre-tags

---

## S2 · CHAPTER 1 · HERO (OVERTURE)

> Still cinematic. Now states the offer within the first 3 seconds of reading.

### S2.1 Layout
Desktop: 2-col grid (1fr 1fr), `100svh`, padding 8rem/4rem/3rem. Left: text stack (eyebrow→headline→subline→CTAs), max-w 38rem, centered. Right: MetaballCanvas, aspect 1:1, max 640px, right-anchored. Mobile: single column; order = headline, subline, CTAs, canvas; eyebrow as small line above headline.

### S2.2 Elements (left column, top→bottom)
1. **Chapter label**: `[cyan line] 01 — Zirtuno` (mono, paper-mute).
2. **Poetic eyebrow** (serif italic, `--text-poetic`, paper-mute, `.type-breathe`):
   - PT: *Algumas forças não precisam ser barulhentas para transformar.*
   - EN: *Some forces don't need to be loud to transform.*
3. **Positioning headline** (sans, `--text-hero`, weight 500, lh 1.08, ls -0.02em, paper):
   - PT: **Criamos ecossistemas digitais completos.**
   - EN: **We build complete digital ecosystems.**
4. **Subline** (sans, `--text-body-l`, paper-mute, max-w 32rem):
   - PT: Software, IA, automação, dados, branding e marketing — conectados em uma só estrutura, feita para o seu negócio crescer.
   - EN: Software, AI, automation, data, branding and marketing — connected into one structure, built for your business to grow.
5. **CTA row**: `cta.analysis` (primary) + `cta.portfolio` (secondary), gap 1.5rem.

### S2.3 MetaballCanvas
3D-shaded metaball field with 7 pillar states, hover physics, morphing, keyboard nav. Pillar indicator (bottom) retained; doubles as a fast visual index of the seven services.

**Resting state = the real logo, traced from `public/brand/zirtuno-logo-mark.svg` (NOT the old ~10-sphere approximation).** Build it so the fluid form resolves into an exact replica of the mark at rest:
1. Rasterize the two cyan paths to an offscreen canvas at the mark's native aspect (2950×3200), via `Path2D` + the group transform `translate(-1050 -850)`.
2. Sample interior points; weight each sphere's radius by a distance-transform of the silhouette (bigger spheres in thick regions) so few spheres reconstruct the ribbon cleanly.
3. Center / normalize the points (preserve the 2950:3200 aspect, flip Y) and use them to place the metaball spheres. (Generating an SDF from the silhouette is an acceptable alternative.)
4. Render the smooth-union of those spheres in brand cyan `#00E3FE`; it should read as the exact mark, breathing (~8s) at rest.

This **traced resting state is the single shared "unified" state**: hero (here), the morph base for Services (S5), the ecosystem core (S4), **and S8 Beat 2** (the moment the three forms land as the Zirtuno mark). Export it from `lib/webgl/states.ts` so every chapter resolves to the *same* geometry.

Trace pipeline is client-only; **`prefers-reduced-motion` / no-WebGL fallback is the static SVG mark itself** (`zirtuno-logo-mark.svg`), which is already the exact target image.

> Build & ship the resting state first (breathing mark, correct cyan, static-SVG fallback) and get a screenshot sign-off **before** layering the 7 pillar states + morph + hover + keyboard on top.

### S2.4 Reveal sequence
| Element | Delay | Animation | Dur | Easing |
|---|---|---|---|---|
| Chapter label | 0 | fade+slide-up 12px | 1000 | arrive |
| Eyebrow | 200 | fade in | 800 | calm |
| Headline | 400 | mask reveal+slide-up 16px | 1100 | arrive |
| Subline | 800 | fade in | 800 | calm |
| CTA row | 1100 | fade+slide-up 12px | 700 | arrive |
| Canvas | 600 | opacity 0→1 | 1400 | arrive |
| Pillar indicator | 1400 | fade in | 600 | calm |

### S2.5 Acceptance — S2 done when:
- [ ] A first-time visitor understands the offer from headline + subline alone
- [ ] Primary + secondary CTAs present and functional
- [ ] Metaball 60fps, 7 states, hover physics, keyboard nav
- [ ] Poetic eyebrow reads as accent, not main message
- [ ] Mobile stacks cleanly; CTAs near top

---

## S3 · CHAPTER 2 · THE PROBLEM

> Names the pain: most businesses think they have a marketing problem; they have a structure problem. Creates tension the Ecosystem chapter resolves.

### S3.1 Layout
Pinned, ~200vh. Centered headline; seven "symptoms" reveal on scroll; a fractured metaball drifts apart behind.

### S3.2 Visual — Fractured Metaball
New metaball state `Fractured`: three forms broken into scattered, **desaturated** fragments (toward paper-dim / muted cyan), drifting apart, no rotation, low blend-K (fragments read as disconnected). Each symptom reveal pushes one fragment further from center.

### S3.3 Copy
**Headline** (sans, `--text-display-l`):
- PT: A maioria das empresas não tem um problema de marketing. Tem um problema de estrutura.
- EN: Most companies don't have a marketing problem. They have a structure problem.

**Lead** (body-l, paper-mute):
- PT: Cada peça funciona sozinha — e nenhuma funciona junta. Site de um lado, dados de outro, atendimento no improviso, processos no manual. O resultado é esforço sem escala.
- EN: Each piece works alone — and none work together. The site on one side, data on another, support improvised, processes manual. The result is effort without scale.

**Seven symptoms** (reveal on scroll; mono label + one-line plain description):
| # | PT label | EN label | PT | EN |
|---|---|---|---|---|
| 1 | Site fraco | Weak website | Bonito, mas não converte. | Pretty, but it doesn't convert. |
| 2 | Processos manuais | Manual processes | Tarefas repetitivas consomem o time. | Repetitive tasks drain the team. |
| 3 | Ferramentas desconectadas | Disconnected tools | Sistemas que não se falam. | Systems that don't talk to each other. |
| 4 | Atendimento lento | Slow service | Oportunidades perdidas fora do horário. | Opportunities lost after hours. |
| 5 | Dados espalhados | Scattered data | Decisões tomadas no escuro. | Decisions made in the dark. |
| 6 | Posicionamento frágil | Weak positioning | Uma marca que não é lembrada. | A brand that isn't remembered. |
| 7 | Sem ecossistema | No ecosystem | Nada cresce de forma integrada. | Nothing grows in an integrated way. |

### S3.4 Transition out
End on unresolved tension — fragments scattered, dim, waiting. **Do not resolve the fracture here** (S4 resolves it). CTA before transition: `cta.structure` (primary).

### S3.5 Acceptance — S3 done when:
- [ ] Headline communicates the core insight immediately
- [ ] All 7 symptoms reveal with fracture visual responding
- [ ] Fractured metaball clearly reads "disconnected" (contrast with hero unity)
- [ ] Ends on unresolved tension + structure CTA
- [ ] Mobile: symptoms vertical list; fracture simplified

---

## S4 · CHAPTER 3 · THE ECOSYSTEM (CONCEPTUAL CENTERPIECE)

> The differentiator. Zirtuno builds connected digital organisms, not isolated services. The most important business chapter.

### S4.1 Layout
Pinned, ~250vh. Centered interactive **Ecosystem Diagram**; headline above; CTA below.

### S4.2 Narrative payoff
The fractured fragments from S3 **fly inward and connect** — the metaball reunifies into the resting logo at the diagram's center. Visually proves "from dispersed to connected." The single most important transition on the site; give it weight.

### S4.3 Copy
**Headline** (sans, `--text-display-l`):
- PT: Criamos ecossistemas digitais, não peças soltas.
- EN: We build digital ecosystems, not loose pieces.

**Lead** (body-l, paper-mute):
- PT: Tudo conectado em torno do seu negócio. Cada parte fortalece as outras: a marca alimenta o site, o site alimenta o tráfego, o tráfego alimenta o CRM, a IA acelera o atendimento, a automação conecta os processos e os dashboards mostram tudo em tempo real.
- EN: Everything connected around your business. Each part strengthens the others: the brand feeds the site, the site feeds traffic, traffic feeds the CRM, AI accelerates service, automation connects processes, and dashboards show it all in real time.

### S4.4 Ecosystem Diagram — Spec
`components/ecosystem/EcosystemDiagram.tsx`. **Center**: client business — glowing core (unified metaball + small label `SEU NEGÓCIO / YOUR BUSINESS`). **10 orbiting nodes**, each connected to center by an animated line:
| # | PT | EN |
|---|---|---|
| 1 | Marca | Brand |
| 2 | Site | Website |
| 3 | Tráfego | Traffic |
| 4 | CRM | CRM |
| 5 | IA | AI |
| 6 | Automação | Automation |
| 7 | Dashboards | Dashboards |
| 8 | Sistemas internos | Internal systems |
| 9 | Atendimento | Service |
| 10 | Conteúdo | Content |

**Behavior**: on enter, fragments converge → center forms → lines draw outward sequentially (80ms stagger) with traveling pulses (data flow). Hover a node: it + its line brighten, tooltip explains role, adjacent connections faintly highlight. Whole diagram rotates very slowly (~60s/rev). Lines carry continuous subtle pulses.

**Node tooltips** (PT / EN):
- Marca: A base de tudo — como o negócio é percebido. / The base of everything — how the business is perceived.
- Site: O centro da presença digital. / The center of the digital presence.
- Tráfego: O fluxo de novas oportunidades. / The flow of new opportunities.
- CRM: A memória de cada relacionamento. / The memory of every relationship.
- IA: Inteligência que atende e acelera. / Intelligence that serves and accelerates.
- Automação: O trabalho que acontece sozinho. / The work that happens on its own.
- Dashboards: A visão clara dos números. / The clear view of the numbers.
- Sistemas internos: A operação que sustenta o negócio. / The operation that sustains the business.
- Atendimento: A experiência em cada contato. / The experience in every contact.
- Conteúdo: A voz que mantém a marca presente. / The voice that keeps the brand present.

### S4.5 CTA
End: `cta.structure` (primary) + `cta.portfolio` (secondary).

### S4.6 Acceptance — S4 done when:
- [ ] Fragments from S3 visibly converge into the unified center
- [ ] All 10 nodes render, connect, carry pulses
- [ ] Hover reveals node role + connections
- [ ] Reads as "integrated organism," not "service list"
- [ ] Mobile: vertical connected stack or simplified radial; tooltips become captions

---

## S5 · CHAPTER 4 · THE SERVICES (PILLARS)

> Keep 7 pillars + poetic descriptors as accents — but every pillar states what it is, the problem it solves, the value it creates.

### S5.1 Layout
Pinned MetaballCanvas (alternating L/R); 7 pillar entries scroll past; metaball morphs per pillar. ~700vh.

### S5.2 Pillar entry anatomy
```
[number watermark, mono]            01 / 07
[poetic descriptor, serif italic]   A superfície onde o sopro pousa.
[name, sans, --text-display-m]      Web Design & Experiência Digital
[O QUE É — cyan label + 1 sentence]
[O QUE RESOLVE — cyan label + 1 sentence]
[O QUE GERA — cyan label + 1 sentence]
[capabilities, mono small, · sep]
[ghost CTA]                         Ver projetos de [categoria]
```
Labels `O QUE É / O QUE RESOLVE / O QUE GERA` (EN: `WHAT IT IS / WHAT IT SOLVES / WHAT IT CREATES`) are mono uppercase, cyan, tiny. This three-line block is the commercial core — never omit.

### S5.3 The Seven Pillars — Full Copy

**01 · Web Design & Digital Experience** → state 0
- Accent: *A superfície onde o sopro pousa.* / *The surface where the breath lands.*
- Name: Web Design & Experiência Digital / Web Design & Digital Experience
- É: Sites institucionais, landing pages e interfaces focadas em conversão. / Institutional sites, landing pages, and interfaces focused on conversion.
- RESOLVE: Sites bonitos que não convertem e estruturas confusas que afastam clientes. / Beautiful sites that don't convert and confusing structures that drive clients away.
- GERA: Uma presença que comunica com clareza, gera confiança e transforma visitantes em clientes. / A presence that communicates clearly, builds trust, and turns visitors into clients.
- Caps: Landing pages · Sites institucionais · Design de interface · Usabilidade · Responsividade · Conversão.

**02 · Software & App Development** → state 1
- Accent: *Forma para a função.* / *Form for the function.*
- Name: Desenvolvimento de Software & Apps / Software & App Development
- É: Plataformas sob medida, sistemas internos, dashboards e aplicativos. / Custom platforms, internal systems, dashboards, and apps.
- RESOLVE: Processos manuais, planilhas soltas e ferramentas que não conversam. / Manual processes, loose spreadsheets, and tools that don't talk.
- GERA: Operações mais rápidas, organizadas e escaláveis, com tecnologia feita para o negócio. / Faster, organized, scalable operations, with technology built for the business.
- Caps: Plataformas web · Sistemas internos · Dashboards · Apps mobile · Multiplataforma.

**03 · Artificial Intelligence** → state 2
- Accent: *A inteligência que não dorme.* / *The intelligence that does not sleep.*
- Name: Inteligência Artificial / Artificial Intelligence
- É: Agentes de IA, chatbots, automações inteligentes e atendimento automatizado. / AI agents, chatbots, intelligent automations, and automated service.
- RESOLVE: Atendimento lento, equipe sobrecarregada e oportunidades perdidas fora do horário. / Slow service, overloaded teams, and opportunities lost after hours.
- GERA: Atendimento e operações que funcionam 24/7, com inteligência que escala. / Service and operations running 24/7, with intelligence that scales.
- Caps: Agentes de IA · Chatbots · Automações inteligentes · Atendimento 24/7 · Modelos para negócios.

**04 · Automation & Integrations** → state 3
- Accent: *Movimento que não exige presença.* / *Movement that requires no presence.*
- Name: Automação & Integrações / Automation & Integrations
- É: Automação de processos, integrações com CRM e conexão entre ferramentas. / Process automation, CRM integrations, and tool connection.
- RESOLVE: Tarefas repetitivas, retrabalho e dados que se perdem entre sistemas. / Repetitive tasks, rework, and data lost between systems.
- GERA: Um fluxo conectado onde a informação circula sozinha e nada se perde. / A connected flow where information moves on its own and nothing is lost.
- Caps: Automação de processos · Integrações CRM · Conexão de ferramentas · Fluxos automáticos · APIs.

**05 · Data & Dashboards** → state 4
- Accent: *O caos lido em silêncio.* / *Chaos read in silence.*
- Name: Dados & Dashboards / Data & Dashboards
- É: Organização de dados, BI, relatórios e dashboards de decisão. / Data organization, BI, reports, and decision dashboards.
- RESOLVE: Decisões no escuro, dados espalhados e falta de visão dos números. / Decisions in the dark, scattered data, and no view of the numbers.
- GERA: Visão clara e em tempo real para decidir com dados, não com achismo. / A clear, real-time view to decide with data, not guesswork.
- Caps: Organização de dados · Business intelligence · Relatórios · Dashboards · Métricas em tempo real.

**06 · Branding & Positioning** → state 5
- Accent: *A presença que se reconhece de longe.* / *Presence recognized from afar.*
- Name: Branding & Posicionamento / Branding & Positioning
- É: Identidade visual, estratégia de marca, comunicação e posicionamento. / Visual identity, brand strategy, communication, and positioning.
- RESOLVE: Marca genérica, sem diferenciação, que não é lembrada. / A generic brand, undifferentiated, that isn't remembered.
- GERA: Uma marca forte, coerente e memorável que constrói autoridade. / A strong, coherent, memorable brand that builds authority.
- Caps: Identidade visual · Estratégia de marca · Comunicação · Storytelling · Autoridade digital.

**07 · Marketing & Growth** → state 6
- Accent: *Alcance sem barulho.* / *Reach without noise.*
- Name: Marketing & Crescimento / Marketing & Growth
- É: Tráfego pago, estratégia de conteúdo, campanhas e performance. / Paid traffic, content strategy, campaigns, and performance.
- RESOLVE: Investimento sem retorno claro e crescimento estagnado. / Investment with no clear return and stagnant growth.
- GERA: Crescimento previsível e mensurável, conectado a toda a estrutura. / Predictable, measurable growth, connected to the whole structure.
- Caps: Tráfego pago · Estratégia de conteúdo · Campanhas · Estratégia digital · Performance.

### S5.4 Animations
Metaball morphs on 50%-enter. Text stagger: descriptor(0)→name(150)→três linhas O QUE(300/420/540)→caps(700)→CTA(850). Watermark number behind text at paper-dim.

### S5.5 CTA
Each pillar: ghost → `/work?category=[pillar]`. Section end: `cta.analysis` (primary).

### S5.6 Acceptance — S5 done when:
- [ ] Every pillar shows is/solves/creates clearly
- [ ] Poetic descriptor present but visually secondary (italic)
- [ ] Metaball morphs in sync per pillar
- [ ] Per-pillar portfolio CTA + section analysis CTA wired
- [ ] Mobile: stacked, metaball above each block

---

## S6 · CHAPTER 5 · MÉTODO ZIRTUNO

> Strategic, premium, methodical. Shows Zirtuno diagnoses and structures — not just makes pretty things.

### S6.1 Layout
Horizontal stepped sequence (desktop) / vertical (mobile). Five phases linked by a continuous line that draws on scroll. Small metaball gesture per phase.

### S6.2 The Five Phases
Headline (sans, `--text-display-l`): O Método Zirtuno. / The Zirtuno Method.
Lead (body-l): Não começamos pelo que é bonito. Começamos pelo que está quebrado. / We don't start with what's beautiful. We start with what's broken.

| # | PT | EN | PT desc | EN desc |
|---|---|---|---|---|
| 01 | Diagnóstico | Diagnosis | Entendemos o negócio, mapeamos a estrutura atual e identificamos o que está fragmentado, manual ou ausente. | We understand the business, map the current structure, identify what's fragmented, manual, or missing. |
| 02 | Estrutura | Structure | Desenhamos a arquitetura do ecossistema: o que construir, em que ordem e como tudo se conecta. | We design the ecosystem architecture: what to build, in what order, how it connects. |
| 03 | Construção | Construction | Desenvolvemos cada peça com padrão premium — site, software, marca, automações. | We build each piece at a premium standard — site, software, brand, automations. |
| 04 | Integração | Integration | Conectamos tudo: CRM, IA, automações, dados e sistemas operam como um organismo único. | We connect everything: CRM, AI, automations, data, systems operating as one organism. |
| 05 | Evolução | Evolution | Medimos, otimizamos e expandimos. O ecossistema cresce junto com o negócio. | We measure, optimize, expand. The ecosystem grows with the business. |

### S6.3 Animations
Connector line draws phase-to-phase (scrub). Each phase: number+name+desc fade/slide on enter (120ms stagger). Metaball gesture per phase: 01 scanning, 02 outline grid, 03 solid fill, 04 connect nodes, 05 pulse/expand.

### S6.4 CTA
End: `cta.analysis` (primary) + `cta.talk` (secondary).

### S6.5 Acceptance — S6 done when:
- [ ] Five phases in order with drawing connector line
- [ ] Reads strategic, not decorative
- [ ] Metaball gesture differs per phase
- [ ] CTAs wired
- [ ] Mobile: vertical timeline

---

## S7 · CHAPTER 6 · SELECTED WORK (PORTFOLIO)

> A primary credibility section, not a hidden gallery. **Never invent metrics.** Use honest narratives or "selected architectures."

### S7.1 Layout
Homepage: curated strip of 3–5 featured projects (horizontal desktop / vertical mobile), ending with `cta.portfolio` → `/work`. Full `/work` holds the complete grid with category filters.

### S7.2 Project card anatomy
```
[visual preview — image or muted autoplay video]
[category, mono uppercase cyan]              SOFTWARE · IA · AUTOMAÇÃO
[project name, sans, --text-display-m]
[challenge, body — 1 sentence]
[what was built, body-l — 1–2 sentences]
[services involved, mono small, · sep]
[outcome/impact — honest narrative OR metric]
[ghost CTA]                                  Ver projeto / See project
```
**Outcome rule:** verified metrics only if real (e.g. "atendimento de 24h para 2min"). Otherwise honest narrative ("Centralizou cinco ferramentas em um só painel" / "Unified five tools into one dashboard") or label **Arquitetura selecionada / Selected architecture**. No fabricated percentages, ever.

### S7.3 Case study page (`/work/[slug]`)
Header (name, category, services, hero media) → O Desafio / The Challenge → A Estrutura Criada / The Architecture Built (media) → O Resultado / The Outcome (honest) → Créditos / Credits → Próximo projeto / Next project. Cyan sweep transition (S1.9).

### S7.4 CMS schema — `project`
```
title, slug, category[] (7 pillars enum), servicesInvolved[],
challenge, built, outcome (all localized),
outcomeType (metric|narrative|architecture),
previewMedia, gallery[], credits, liveUrl, featured (bool), order
```

### S7.5 CTA
Card: ghost "Ver projeto". Section end: `cta.portfolio`. `/work`: category filter chips.

### S7.6 Acceptance — S7 done when:
- [ ] Featured strip: 3–5 cards, full anatomy
- [ ] Full `/work` index with filters
- [ ] Case study template from CMS
- [ ] No invented metrics; architecture/narrative fallbacks present
- [ ] ≥3 honest entries ship for launch
- [ ] Mobile horizontal→vertical clean

---

## S8 · CHAPTER 7 · A ORIGEM / THE ORIGIN + MANIFESTO CODA

> The emotional peak — *after* the business case, where it deepens trust right before contact. The concentrated **30% poetic**, now in service of a true story: two brothers, three founding pillars (social, health, finance), and a purpose — to build what doesn't yet exist. (Replaces the former "The Name / Etymology" chapter.)

### S8.1 Placement & role
Chapter 7, after Selected Work, before Studio. Answers "why does this company exist?" at the moment the visitor is ready to be moved. Chapter label: **A Origem / The Origin** (was "The Name"). The visual narrative is tied directly to the logo: **two brothers (two forms) → a shared vision crystallizes into three pillars (the three forms of the mark) → the mark expands into the full ecosystem.** The birth of the mark is the birth of the company.

### S8.2 Layout
Pinned scroll section (~600vh scroll length, pinned to 100vh). Five beats on GSAP ScrollTrigger scrub, reusing the metaball + particle systems. Mobile: one beat per scroll-snap section, no scrub.

### S8.3 The Five Beats
**Beat 1 (0–18%) — Two brothers.** Two fluid forms enter from opposite sides and drift toward each other — drawn, not colliding. Quiet.
- PT: *Tudo começou com dois irmãos e uma mesma inquietação: e se construíssemos o que ainda não existe?*
- EN: *It began with two brothers and a single restlessness: what if we built what doesn't exist yet?*

**Beat 2 (18–42%) — Three pillars, one mark.** From the meeting of the two forms a third emerges; the three settle into rotation — **this is the moment the Zirtuno logo forms on screen, and it must resolve to the SVG-traced resting geometry (S2.3).** Three quiet labels fade in, one per form: `Social · Saúde · Finanças` (EN `Social · Health · Finance`).
- PT: *De uma só visão nasceram três pilares — social, saúde e finanças. As forças que movem cada negócio e cada vida.*
- EN: *From one vision, three pillars were born — social, health, and finance. The forces that move every business and every life.*

**Beat 3 (42–62%) — The purpose.** The logo holds, breathing. Text takes the foreground.
- PT: *A Zirtuno nasceu para transformar ideias em estrutura. Para dar forma a sistemas, soluções e tecnologias que ainda esperavam para existir.*
- EN: *Zirtuno was born to turn ideas into structure — to give form to the systems, solutions, and technologies still waiting to exist.*

**Beat 4 (62–82%) — The evolution.** The three forms multiply and connect, echoing the Ecosystem chapter — the mark expanding into capability.
- PT: *De dois irmãos a um estúdio digital completo. De uma ideia a um ecossistema — software, IA, automação, branding e estratégia.*
- EN: *From two brothers to a complete digital studio. From an idea to an ecosystem — software, AI, automation, branding, and strategy.*

**Beat 5 (82–100%) — Resolution.** The expanded forms condense back into the **ZIRTUNO wordmark** (particle convergence). Below it, the closing line:
- PT: **Construímos o que ainda não existe.**
- EN: **We build what doesn't exist yet.**

Grace note (per S8.5 default): one dim line beneath the closing line — PT *"ZIRTUNO — o sopro que dá forma."* / EN *"ZIRTUNO — the breath that gives shape."*

### S8.4 Manifesto coda
After Beat 5, the four principles follow as a tight scrolling sequence (unchanged):
*Movimento sem ruído.* · *Forma para o que estava disperso.* · *Direção, não apenas execução.* · *Discreto. Preciso. Transformador.*
(EN: Movement without noise · Form for what was dispersed · Direction, not just execution · Discreet. Precise. Transformative.)

### S8.5 Decisions (defaults applied — `TODO(decision)` to revisit)
- **Zéfiro + Ventura etymology** — kept ONLY as the single dim grace note in Beat 5 (option b). `TODO(decision)`: drop entirely, or restore as a short opening layer before Beat 1?
- **Brothers** — anonymous, consistent with the Studio chapter (no names, no portrait). `TODO(decision)`: name them + add a portrait moment in Beat 1?
- **Meaning of the three pillars** — framed as "as forças que movem cada negócio e cada vida / the forces that move every business and every life" (works for any reading). `TODO(decision)`: confirm whether social/health/finance are impact sectors, founding values, or target markets, so the line can sharpen.

### S8.6 Critical distinction — two different "pillars"
The **three founding pillars (social · health · finance)** are the **WHY** (this chapter, the origin). The **seven service pillars** (S5, the metaball's 7 states) are the **HOW** (what Zirtuno builds). They must stay visually and verbally distinct — three understated mono labels beside the forms here, never styled or counted like the seven services. Do not blur them.

### S8.7 Visual notes
- Reuse the metaball for the two→three form transition (Beats 1–2) and the particle system for the wordmark convergence (Beat 5).
- Beat 2 must visibly land as the Zirtuno mark — use the **exact SVG-traced resting geometry from S2.3** so it resolves precisely.
- Keep the three pillar labels understated (small mono, fading in beside each form). The forms are the hero; the labels are annotation.

### S8.8 Acceptance — revised S8 done when:
- [ ] Reads as Zirtuno's true origin (two brothers, three founding pillars, the purpose), not borrowed mythology
- [ ] Beat 2 visibly forms the Zirtuno mark from two→three forms (SVG-traced geometry), with pillar labels
- [ ] Closing lands on *Construímos o que ainda não existe / We build what doesn't exist yet*
- [ ] Grace note present as a single dim line (per S8.5)
- [ ] Manifesto coda follows
- [ ] Three founding pillars stay distinct from the seven service pillars (S8.6)
- [ ] Chapter sits after Selected Work, before Studio
- [ ] Both languages; mobile + reduced-motion stills of each beat

---

## S9 · CHAPTER 8 · THE STUDIO (ABOUT)

Sub-sections: **Where** (Curitiba, coordinates), **Who** (anonymous role grid default; portraits optional), **Why** (closing line). *How* now lives in Método (S6), so Studio drops the process block.

Closing line (sans statement + serif italic final clause):
- PT: Não somos sobre aparecer. Somos sobre ser sentidos, lembrados e conduzidos adiante.
- EN: We are not about appearing. We are about being felt, remembered, and carried forward.

CTA end: `cta.talk` (secondary).
Acceptance: [ ] Where/Who/Why present · [ ] no duplicate process content · [ ] talk CTA wired.

---

## S10 · CHAPTER 9 · THE BEGINNING (CONTACT)

> Artistic, but unmistakably usable. Submit is clear; symbolism enhances, never hides it.

### S10.1 Layout
Centered. Resting metaball (320px) above. Prompt → form → clear submit → secondary paths.

### S10.2 Copy
Prompt (serif italic, `--text-display-l`):
- PT: Vamos estruturar o seu digital?
- EN: Shall we structure your digital?

Sub-prompt (body, paper-mute):
- PT: Conte onde você está hoje. Devolvemos uma primeira leitura da sua estrutura digital.
- EN: Tell us where you are today. We'll send back a first read of your digital structure.

### S10.3 Fields
1. Nome / Name · 2. Email · 3. Empresa / Company (optional) · 4. Conte o que quer estruturar ou resolver. / Tell us what you want to structure or solve. (textarea) · 5. Hidden: entry intent (from CTA pre-tag). Field styling per v0.1 S8.1.

### S10.4 Submit — clear, then artistic
**A real, labeled submit button always present**: `cta.analysis` styling, label **Solicitar análise inicial / Request initial analysis**. Canonical, unambiguous action. **Artistic layer additive**: once valid, the metaball also becomes clickable and "exhales" on submit — but the labeled button is the canonical path. (Directly addresses "don't hide submit behind symbolism.")

Success replaces form:
- PT: Recebemos. Em breve devolvemos uma primeira leitura da sua estrutura.
- EN: Received. We'll send back a first read of your structure soon.

### S10.5 Secondary paths
WhatsApp (`cta.talk` → env URL, Brazil-first) · email link · social icons.

### S10.6 Submission
`POST /api/contact`: zod validate → Resend (include intent) → optional Sanity store → JSON. Graceful error + retained form + toast.

### S10.7 Acceptance — S10 done when:
- [ ] Labeled, obvious submit button works
- [ ] Metaball-exhale additive, not the only path
- [ ] Entry-intent captured from CTA pre-tags
- [ ] Test email received with intent tag
- [ ] WhatsApp + email + social present
- [ ] Mobile clean; validation accessible

---

## S11 · FOOTER
Minimal, every page. Left `Zirtuno © 2026` · center language toggle · right social + `cta.talk` (ghost). Border-top paper-faint.

## S12 · NAVIGATION
TopBar (persistent): wordmark · language toggle · location · `cta.talk` (ghost).
Side index (chapter 2+), new 9-chapter order:
`01 Zirtuno · 02 Problema · 03 Ecossistema · 04 Serviços · 05 Método · 06 Projetos · 07 Nome · 08 Studio · 09 Contato`.
Mobile: burger → full-screen menu + `cta.analysis` (primary) pinned at bottom.

## S13 · RESPONSIVE
Per v0.1 S11. Mobile metaball tiers down; ecosystem diagram → vertical connected stack; horizontal scroll sections → vertical.

## S14 · PERFORMANCE
Per v0.1 S12. Device-tier detection; lazy-load non-hero canvases (IntersectionObserver rootMargin 100%); font preload; `next/image`. Ecosystem diagram + etymology particles are heaviest — lazy-load both.

## S15 · SEO & METADATA
Per v0.1 S13. Add `Service` schema ×7 + `Organization`. **Ensure Problem/Ecosystem/Services copy is server-rendered** (keyword-rich, conversion-relevant — must be crawlable). Per-project metadata on `/work`.

---

## S16 · BUILD ORDER (v0.2)

1. S0 Setup
2. S1.1–S1.4 Tokens + easings
3. S1.5–S1.6 Cursor + Lenis
4. **S1.15 CTA system** (build early — used everywhere)
5. S2 Hero (layout + copy + CTAs; metaball resting → 7 states + morphing + hover + keyboard)
6. S1.7–S1.8 Breath layer + type breathing
7. S3 The Problem (fractured metaball state)
8. S4 The Ecosystem (diagram — centerpiece; reuse converge transition from S3)
9. S5 The Services (reuse hero metaball; commercial copy structure)
10. S6 Método Zirtuno
11. S7 Selected Work (cards + `/work` + case study + Sanity schema)
12. S8 The Name (etymology particles — hardest visual; build after simpler chapters)
13. S9 Studio
14. S10 Contact (labeled submit first, artistic exhale second)
15. S1.9–S1.11 Page transitions + loading + 404
16. S11–S12 Footer + navigation (9-chapter index)
17. S13–S15 Responsive + performance + SEO
18. S1.12 Audio (only if scoped)
19. Final QA vs acceptance + **conversion-path test** (every CTA reaches contact with correct intent tag)

---

## S17 · OPEN DECISIONS

- [ ] Ecosystem center: metaball core (recommended) vs literal `SEU NEGÓCIO` node?
- [ ] Portfolio launch content: how many real projects? Narrative vs "selected architecture" for those without metrics?
- [ ] Studio — anonymous (A, default) or portraits (B)?
- [ ] WhatsApp number (env).
- [ ] Contact email + domain.
- [ ] Social handles.
- [ ] Audio in/out for v1 (default out).
- [ ] Which projects can show verified metrics?

---

*Build with care. 70% clareza estratégica, 30% atmosfera. Discreto. Preciso. Transformador. — e comercialmente forte.*
