# Zirtuno Website — State Analysis & Improvement Backlog

> Reviewed against `build-spec.md` (v0.2), `CLAUDE.md`, `references.md`, and `zirtuno-critical-review-brief.md`.
> Method: read the full source tree (`app/`, `components/`, `lib/`), the metaball shader, both i18n bundles, the seed content, and every render in `captures/` (hero contact-sheet, states, fractured, eco-core, section verifies, fallbacks). Typecheck run clean (`tsc --noEmit` → exit 0).
> Date: 2026-06-03.

---

## 0. One-line verdict

**Promising, not yet at the top-1% / Awwwards bar — and there's now a bigger problem than any visual nitpick: the signature glass hero does not render on the owner's own machine, or on the large share of the audience using Intel integrated graphics.** See §0.5 — this was found on the live build and outranks everything else. Beyond that, the resting glass mark and the engineering underneath are genuinely strong; what holds the *design* back is concentrated and fixable (pillar forms read as a premium glass icon pack, two signature transitions don't fully land, Origin + real content still thin). This is still "polish before launch," not "rebuild" — but the device-reach issue (§0.5) is now the first thing to solve.

---

## 0.5. ⭐ LIVE GPU REVIEW — critical finding (added 2026-06-03)

Opened the running dev build (`localhost:3000`) in the owner's actual Chrome on the real GPU. The single most important discovery is not visible in any static capture:

**The glass hero is gated OFF on the owner's machine — and freezes if forced on.**

- The machine's GPU reports as **`ANGLE (Intel, Intel(R) UHD Graphics … D3D11)`**. That exact string (`intel(r) uhd graphics`) is on the hard **blocklist** in `lib/webgl/can-run-glass.ts`, so `canRunGlass()` returns `false`. Live DOM confirms it: **`canvases: 0`** on the hero — the WebGL scene never mounts. The owner has been seeing the **flat SVG fallback** the whole time, never the molten glass.
- Forcing it on with the built-in override (`?glass=force`) **froze the renderer** — the page went unresponsive and the CDP bridge timed out after 45s. So on this exact hardware there is *no good state*: gated = flat fallback, forced = freeze. The raymarch (56 steps × per-pixel normals × thickness loop, full-canvas) is simply too heavy for this GPU class even after the earlier "trim."

**Why this is the #1 issue.** Intel UHD/HD integrated graphics are in a huge proportion of business laptops — i.e. exactly the SMB decision-makers Zirtuno sells to. For a site whose entire identity *is* the metaball, having the signature device silently fall back to a flat shape (or risk a freeze) for that audience is a bigger problem than whether the pillar forms look bespoke. It also means **every one of the ~10 hero iteration rounds was judged on software-rendered captures, not the live GPU result** — the team has been art-directing something most of its visitors never see.

**What the live fallback actually looks like (the real experience on this hardware):**

- **Hero:** clean and bold. Strong Bricolage headline, correct serif-italic eyebrow, good hierarchy, working CTAs. The flat cyan mark is a handsome brand mark — but it is a flat fill, not glass. Acceptable, not signature.
- **The Problem:** the fallback is a **static, flat fractured cyan shape** — sparse, lots of dead black, not dramatic. The "broken" feeling barely lands without the live shards + drift.
- **The Ecosystem:** the diagram renders fully (it's DOM/SVG, not WebGL) and is the **strongest body moment live** — labeled radial nodes (Marca, Conteúdo, Site, Atendimento, Tráfego…) with clean connector lines to the core. More elegant in motion than the static `eco-core.png` suggested; struts are a touch thin but it reads as an organism.
- Reveal/scroll animations and Lenis all work; no console errors observed on load.

**This reframes recommendation 5.1.** "Elevate the material / raise DPR" (richer reflections, clearcoat, `dpr` up to 2) would make the freeze *worse* on integrated GPUs. There is now an explicit tension: richer glass ⟷ broader reach. The device-tier strategy below (§5.0) must be settled *before* investing more in material fidelity.

---

## 1. The hero decision (settle it now)

The brief's central unresolved fork is **Option A (real-time WebGL) vs Option B (image-based exact icons) vs Option C (Blender sequences)**. Reading the actual shader changes the framing of that decision.

**What the code actually does:** the 7 pillar forms in `components/hero/MetaballScene.tsx` are *literal iconographic SDF constructions*, not abstract liquid forms:

- `sdfWeb` → a browser window (slab + header bar + 3 traffic-light dots + sidebar block + 3 content lines + 3 buttons)
- `sdfSoftware` → stacked panels + a `</>` glyph
- `sdfAI` → a hub + hexagon ring of nodes joined by thin struts
- `sdfAutomation` → two meshing gears
- `sdfData` → four ascending bars on a base
- `sdfBranding` → a center orb + 8 satellite dots
- `sdfMarketing` → concentric target rings

So the problem the brief calls "almost-glass icon" is not mainly a *renderer* problem — it's a *concept* problem. A browser window is the single most clichéd "web design" icon that exists; a bar chart for data and a target for marketing are the same. **Switching to Option B (pre-rendered images) would make these sharper icons, but they would still be generic icons.** The icon-ness is in the chosen forms, not in the shader.

**Recommendation: keep real-time WebGL (Option A), and fix it on two axes instead of switching renderers.**

1. The genuinely bespoke, un-stealable value of the hero is the *liquid morph* between forms and the *fracture → converge* narrative across S3→S4. Images (Option B) and pre-baked Blender (Option C) both kill the true 3D melt and the live hover — they trade your one differentiator for sharper clichés. Don't.
2. Close the gap on the two things that actually read as "almost": (a) the **material** (it's a hand-rolled 3-light specular, no real environment map, no clearcoat — see §5.1), and (b) the **forms themselves** — abstract the 3–4 most clichéd ones toward brand-native shapes (see §5.2).

If, after elevating the material and abstracting the forms, the pillar set still doesn't clear the bar on screen, *then* the fallback is Option B for those specific forms only — not a wholesale switch.

---

## 2. Corrected build state

The brief's maturity table is slightly pessimistic. Actual state from the source:

| Area | Spec | Actual state | Grade |
|---|---|---|---|
| Hero resting mark | S2.3 | SDF traced from brand SVG; molten, vivid, dimensional | **Premium** |
| 7 pillar forms | S2.3 | Built, distinct, but iconographic clichés in glass | **Weak (concept)** |
| Morph / autocycle | S2.4 | Connected smin-bridge morph; mid-frame is a busy lump | Acceptable |
| S3 Problem (fracture) | S3.2 | Shards displace correctly but are **not desaturated** | Acceptable→Weak |
| S4 Ecosystem | S4.4 | Converge + scroll-scrub + 10-node diagram built; struts read thin | Acceptable |
| S5 Services | S5 | Full O QUE É/RESOLVE/GERA copy, pinned morph, per-pillar CTAs | Acceptable→Good |
| S6 Método | S6 | 5 phases + scroll-drawn connector + per-phase gesture | Acceptable |
| S7 Work | S7 | Grid + `/work` + case template + Sanity schema; **6 prototype projects, empty media** | Layout done, content placeholder |
| S8 Origin | S8 | All 5 beats + CPU-particle wordmark; reads thin / dead space | **Weak (impact)** |
| S9 Studio | S9 | Where/Who/Why, anonymous role grid | Acceptable |
| S10 Contact | S10 | Labeled submit + exhale + intent capture + Resend route; **contact details are placeholders** | Build done, content placeholder |
| Globals | S1 | Cursor, Lenis, breath, transitions, loading, 404 present | Good |
| Fallbacks / perf / a11y | S13–15 | GPU gate, off-screen pause, static-SVG fallback, keyboard nav, aria-live | **Strong** |
| Build health | — | `tsc --noEmit` clean; disciplined spec-keyed commit history | **Strong** |

---

## 3. The three buckets

**Genuinely premium (clears the bar):**

- The **resting glass mark** — molten, glossy, vivid `#00E3FE`, convincing speculars. This is the signature asset and it works.
- The **engineering**: `can-run-glass.ts` gates weak GPUs to the static SVG; `frameloop` pauses off-screen; reduced-motion / no-WebGL / mobile all fall back to the exact SVG mark; the S8 wordmark is CPU Canvas-2D particles to respect the GPU budget; keyboard nav + `aria-live` on the hero. Professional-grade and largely invisible — which is the point.
- The **copy**: complete and genuinely well-written in *both* PT and EN (not auto-translated), the 70/30 balance mostly holds, and the portfolio honestly uses "Arquitetura selecionada / Selected architecture" with zero invented metrics — exactly per rule #3.
- The **404** ("Esta página se dispersou / This page has dispersed").

**Merely acceptable (works, looks ordinary — would need elevation):**

- Método, Studio, and the Work grid — clean, finished, but standard layouts (5 text columns + dots; a role grid; a card grid). Nothing wrong, nothing signature.
- The Ecosystem diagram — strong concept, but the radial struts read thin/faint in the capture; confirm on the live GPU build.
- The fallbacks — deliberate and decent, not cheap, but obviously the "lite" path.

**Actively weak (liabilities, priority order):**

1. The 7 pillar forms reading as a glass *icon pack* (§5.2).
2. The fracture isn't desaturated, so S3→S4 loses its emotional arc (§5.3).
3. The material ceiling — "almost-glass" on the structured forms (§5.1).
4. The mid-morph frame is a busy, holey lump (§5.4).
5. S8 Origin feels thin/underwhelming next to the hero (§5.5).

---

## 4. Direct answers to the brief's 10 questions

1. **Premium or approximate? Awwwards-tier?** The *resting mark* is premium. The *7 pillar forms* are approximate-feeling because they're literal icons; not yet Awwwards-tier as a set.
2. **Which pillar forms are weak? Are Web/AI/Automation now good?** Weakest: **Web Design** (browser window — the worst offender), **Data** (bar chart), **Marketing** (target rings), **Branding** (dot burst). **AI** is no longer broken but the struts read thin/wireframe. **Automation** (gears) is dimensional but a cliché. They *are* distinct from one another (the near-duplicate-rectangles risk was avoided) — but distinct *icons*.
3. **Do morphs flow like liquid?** The connected smin-bridge keeps the body as one mass (good), but the mid-morph frame is a dense lump with holes rather than an elegant mercury bridge. Needs tuning + screenshot iteration.
4. **Switch to image-based?** For the *aesthetic* question, still no — the melt + fracture→converge is the only un-stealable part. **But the live finding (§0.5) adds a reach argument the static review missed:** because the live shader is blocked-or-freezes on integrated GPUs, a pre-rendered glass *loop* as the universal default (with live WebGL as enhancement on capable GPUs) is now a legitimate option — not for "exact look," but so the signature is actually seen and never freezes. Decide this in §5.0 first.
5. **Is fracture→converge a payoff or a gimmick?** The structure is a real payoff, but it's undercut because the shards stay vivid instead of going lifeless — the "problem" doesn't *feel* like a problem. Fix the desaturation and it lands.
6. **Which sections feel templated/skeletal?** Método, Studio, Work grid feel templated (acceptable, not signature). Work + Contact are content-placeholder. S8 Origin feels thin.
7. **Typography hierarchy — premium or serif-overused?** The split is correctly implemented (sans for business, serif italic for accents). Risk is *concentration*: S8 stacks several centered serif-italic paragraphs, which flirts with the "overwrought" failure mode. Tighten S8's art direction.
8. **Performance jank/freezes?** Confirmed live: forcing the glass on the owner's Intel UHD **still freezes the renderer** (CDP timeout). The earlier "fix" didn't make the shader run on integrated GPUs — it just *hid* it behind the blocklist (flat fallback). So the freeze risk is real and unsolved for that GPU class; the gate masks it rather than fixing it. This is exactly what §5.0 addresses. On the fallback path itself there was no jank and no console errors.
9. **Both languages + mobile/reduced-motion polished?** Languages: yes, full parity and quality. Mobile/reduced-motion: deliberate and functional, but the "lite" CSS fallbacks are a clear step below the live build — fine for accessibility, don't expect signature.
10. **Overall — is it good?** Good bones, genuinely premium hero mark and engineering, held back by iconographic pillar forms, two half-landed transitions, and placeholder content. Promising; not yet at the bar.

---

## 5. Improvement backlog (ranked, each with a ready-to-use prompt)

Each item: the problem, why it matters, the files, and a prompt you can paste straight into a working session. Signature-visual items (5.1–5.5) **require screenshot iteration** — expect 3–6 rounds; do not accept the first shader. **Do §5.0 first — it gates the others.**

### 5.0 — Fix device reach: the glass must work (or degrade well) on integrated GPUs · P0

**Problem.** On Intel UHD (the owner's GPU, and a huge share of the audience) the glass is hard-blocked → flat fallback; forcing it → renderer freeze (§0.5). The blocklist in `can-run-glass.ts` is a blunt instrument: it disables the signature device for most real visitors, and the shader is too heavy to simply un-block.

**Why it matters.** The site's entire identity is the metaball. If most visitors (and the owner) never see it, the effort/impact ratio collapses. This must be settled before any further material work.

**Files.** `lib/webgl/can-run-glass.ts`, `components/hero/MetaballScene.tsx` (`STEPS`, `TSTEPS`, `dpr`, canvas resolution), `components/hero/MetaballCanvas.tsx`.

**Decision to make (pick one, then implement):**
- **A — Quality tiers, not a blocklist.** Keep WebGL but add a "lite" tier for integrated GPUs: lower internal resolution, fewer raymarch steps (e.g. 32), simpler normals, capped canvas size, and an FPS watchdog that downshifts or bails to the SVG if frames drop. Goal: Intel UHD runs a *lighter* glass at a stable framerate instead of being blocked or frozen.
- **B — Image/video hero for broad reach.** Ship a pre-rendered glass loop (the exact look) as the default hero for all devices, and run live WebGL only as a progressive enhancement on GPUs that pass a real perf probe. Maximizes reach + guarantees the intended look; loses live hover for most.
- Either way: **replace the name-string blocklist with an actual runtime perf probe** (render a few frames offscreen, measure frame time, decide), since GPU strings are an unreliable proxy.

**Prompt.**
```
On Intel UHD Graphics the hero glass is hard-blocked by the name-string blocklist
in lib/webgl/can-run-glass.ts (canRunGlass()→false, flat SVG fallback), and
forcing it via ?glass=force freezes the renderer — the full-canvas raymarch
(STEPS=56, per-pixel normals, thickness loop) is too heavy for integrated GPUs.
Most of our audience is on this hardware, so today most visitors never see the
signature metaball.

Implement a device-tier system instead of a hard block:
1. Replace the renderer-string blocklist with a runtime perf probe: mount the
   shader offscreen at small size for ~10 frames, measure frame time, and choose a
   tier (full / lite / none) from the measurement, not the GPU name.
2. Add a "lite" tier for weak GPUs: lower internal render resolution (e.g. 0.6x),
   STEPS≈32, cheaper normals, capped canvas px, dpr=1. It must hold ~50-60fps on
   Intel UHD WITHOUT freezing.
3. Add an FPS watchdog at runtime that downshifts tier (or falls back to the SVG)
   if frame time stays bad, so we never freeze.
4. Verify on the owner's Intel UHD that the hero now shows *some* live glass at a
   stable framerate, and that ?glass=force no longer hangs.
If a stable lite tier isn't achievable, fall back to Decision B (pre-rendered
glass video hero + WebGL only as enhancement) and tell me.
```

### 5.1 — Elevate the glass material (close the "almost-glass" gap) · P1 *(do AFTER 5.0 — richer material worsens the integrated-GPU freeze; tune it only within the perf budget 5.0 establishes)*

**Problem.** `MetaballScene.tsx` lights the glass with `envColor()`, a hand-rolled sum of three `smoothstep` speculars — there is no real environment map (the `public/hdri/` folder exists but is unused), no clearcoat lobe, and `IOR` is `1.4` (spec wants ~1.34). `dpr={1}` on the `<Canvas>` means the hero renders at 1× on Retina/4K, so edges read soft. Together these are most of why the structured forms look "CGI-cheap / almost" rather than molten.

**Why it matters.** The material is the one lever that lifts *every* form at once, including the clichéd ones. A real reflective environment + clearcoat is the difference between "glass icon" and "molten brand object."

**Files.** `components/hero/MetaballScene.tsx` (fragment shader `envColor`, `IOR`, the `<Canvas dpr>`), `public/hdri/`.

**Prompt.**
```
In components/hero/MetaballScene.tsx, raise the glass material toward a molten
liquid-glass reference (think Active Theory / Studio Freight glass), WITHOUT
breaking the GPU gate or the off-screen pause.

1. Replace the procedural envColor() with sampling a real equirectangular
   environment map from public/hdri/ (load via THREE.DataTexture / RGBELoader,
   pass as a uniform). Keep a cheap procedural fallback if the HDRI fails to load.
2. Add a clearcoat-style second specular lobe (sharp, high-frequency) on top of
   the body reflection so highlights read wet and glossy, not matte.
3. Set IOR to 1.34 per spec; re-check the refraction/thickness tint still reads
   vivid cyan (#00E3FE), not grey.
4. Make dpr adaptive: dpr={[1, 2]} on GPUs that pass canRunGlass(), but keep an
   FPS guard that drops back to 1 if frame time climbs. Do not regress the freeze
   fix.

Then render the resting mark and the Web/AI/Automation forms with
?state=0/1/3/4 and show me before/after screenshots. Iterate on saturation and
specular sharpness from there.
```

### 5.2 — Abstract the 3–4 most clichéd pillar forms · P1

**Problem.** The pillar SDFs are literal stock iconography (browser window, bar chart, target, dot burst). This is the single biggest reason the hero reads "templated."

**Why it matters.** This is the difference between "an icon pack rendered in glass" and "a bespoke brand form language." It's the explicit bar in the brief.

**Files.** `components/hero/MetaballScene.tsx` (`sdfWeb`, `sdfData`, `sdfMarketing`, `sdfBranding`, and the `sdfForState` switch).

**Prompt.**
```
The 7 pillar forms in MetaballScene.tsx currently read as generic glass icons
(Web = a literal browser window, Data = a bar chart, Marketing = a target,
Branding = a dot burst). Redesign the 3-4 most clichéd ones as ABSTRACT,
brand-native glass forms that still read as their service at a glance but stop
looking like an icon pack. Keep them recognizable as a related family (same
plump, molten, smin-joined glass language as the resting mark) and keep each
clearly distinct from the others.

Constraints: stay within the existing SDF approach so the connected liquid morph
still works; preserve the AI=state 3 indexing; no new textures. Propose 2-3
directions per form in a short note FIRST (describe the shape language), then
implement one. After building, give me ?state=N contact-sheet screenshots of all
8 forms together so I can judge them as a set. Expect several iteration rounds.
```

### 5.3 — Desaturate the fracture so the Problem *feels* broken · P1

**Problem.** `shatter()` only displaces geometry; the shards keep the full vivid body color. Spec S3.2 explicitly wants the fragments "desaturated (toward paper-dim / muted cyan), drifting apart." Confirmed in the `fractured.png` capture — the shards look like a shattered *glossy* logo, not a lifeless one.

**Why it matters.** The whole S3→S4 arc depends on contrast: dim/broken → vivid/unified. Without desaturation, the convergence has nothing to resolve *from*.

**Files.** `components/hero/MetaballScene.tsx` (pass `uFracture` into the color stage; the `body`/`col` block in `main()`), `components/hero/FracturedMetaball.tsx`.

**Prompt.**
```
In MetaballScene.tsx, drive the SHADING (not just the geometry) from uFracture so
the fractured Problem state reads as lifeless per spec S3.2. As uFracture goes
0→1: desaturate the cyan toward a muted grey-cyan, drop luminance/specular
intensity, and slightly reduce the through-glow, so dispersed shards look dim and
dead. As S4 converges (uFracture 1→0) the color must bloom back to full vivid
#00E3FE — making the broken→unified contrast the emotional payoff. Keep the
resting/hero states (uFracture=0) visually identical to now. Show me the fractured
state and 3 frames of the converge with before/after.
```

### 5.4 — Tune the mid-morph so it bridges like mercury · P2

**Problem.** At `uMorph≈0.5` the lerp-through-`smin` union (`K_MORPH=0.22`, `BRIDGE=0.8`) produces a dense, holey lump (see `hero-morph.png`) instead of an elegant liquid bridge.

**Why it matters.** The morph is on screen ~13% of every autocycle and on every hover step; an ugly mid-frame cheapens the whole device.

**Files.** `components/hero/MetaballScene.tsx` (`map()` morph block, `K_MORPH`, `BRIDGE`, `TRANS`).

**Prompt.**
```
The mid-morph frame (uMorph≈0.5) in MetaballScene.tsx reads as a busy holey lump
rather than a smooth liquid bridge. Improve the A→B transition so the intermediate
looks like mercury necking between two forms: experiment with K_MORPH, the sine
BRIDGE strength/curve, and optionally a slight volume-preservation or extra
smoothing pass at mid-morph. It must stay one connected mass (no detaching blobs)
and the endpoints (uMorph 0 and 1) must be unchanged. Capture ?pair=0-1-0.5,
?pair=0-3-0.5, ?pair=3-4-0.5 before/after.
```

### 5.5 — Give S8 Origin a real moment · P2

**Problem.** The Origin renders as a stack of centered serif-italic paragraphs around a small, busy metaball with large dead space (see `section-name.png`). It's the section most likely to feel underwhelming right after the hero, and the serif concentration risks the "overwrought" failure mode (brief §8 / Q7).

**Why it matters.** S8 is the emotional peak before contact — the concentrated 30% poetry. If it reads thin, the site's most human moment is its weakest.

**Files.** `components/chapters/ChapterName.tsx`, `components/chapters/OriginMark.tsx`, `components/chapters/OriginWordmark.tsx`, `app/globals.css` (origin section).

**Prompt.**
```
Strengthen the S8 Origin chapter (ChapterName.tsx + OriginMark/OriginWordmark)
so it lands as the emotional peak, not a thin text wall. Goals: (1) make the
central metaball moment larger and more deliberate at the "two forms become three
= the mark" beat (Beat 2), using the SVG-traced resting geometry; (2) tighten the
typography — vary scale/rhythm and don't stack multiple centered serif-italic
paragraphs identically; let one line dominate per beat; (3) reduce dead vertical
space or use it intentionally with scroll pacing. Keep both languages and the
reduced-motion stills. Show me full-section screenshots (PT and EN) before/after.
Do not touch the seven-service pillars — the three founding pillars must stay
visually distinct (spec S8.6).
```

### 5.6 — Verify the Ecosystem diagram reads as an organism · P2

**Problem.** In `eco-core.png` the radial struts look thin and faint and the 10 nodes aren't clearly resolved; the centerpiece's elegance is unconfirmed on a real GPU.

**Why it matters.** S4 is the conceptual centerpiece of the whole pitch ("ecossistemas, não peças soltas").

**Files.** `components/ecosystem/EcosystemDiagram.tsx`, `EcosystemNode.tsx`, `EcosystemCore.tsx`.

**Prompt.**
```
Audit the S4 Ecosystem diagram on the live GPU build at desktop and 1440px.
Confirm: all 10 nodes render and are legible; the connector lines carry the
traveling data-flow pulses described in spec S4.4; hover brightens a node + its
line + tooltip; the slow rotation is present; and the contrast with the fractured
S3 state is strong (dim/broken → vivid/connected). Fix any strut that reads too
thin to feel like a living connection. Send screenshots of the converged state
and one hover state.
```

### 5.7 — Reduce the `states.ts` architectural debt · P3

**Problem.** Spec S2.3 wants the shared states exported from `lib/webgl/states.ts` so hero/services/ecosystem/S8 resolve to the *same* geometry. In reality `states.ts` is a stub with a stale `TODO(phase2)` and the 7 states live hardcoded in the shader. Reuse works in practice (other chapters import `MetaballScene`), so this is debt, not a bug.

**Why it matters.** Low user-visible impact; matters for maintainability as the forms get iterated in 5.2.

**Files.** `lib/webgl/states.ts`, `components/hero/MetaballScene.tsx`.

**Prompt.**
```
Refactor so the 7 pillar state definitions are described/exported from
lib/webgl/states.ts (constants the shader consumes) instead of being hardcoded
and undocumented in MetaballScene.tsx, and delete the stale TODO(phase2) comment.
Pure refactor — no visual change. Confirm hero, services, ecosystem, and S8 still
render identically (tsc clean + screenshots).
```

---

## 6. Launch-blocking content (not build defects — but the site can't ship without them)

These are flagged in-code as placeholders and gated behind open decisions in `build-spec.md` §S17:

- **Real portfolio.** `lib/content/projects.ts` has 6 *prototype* projects (correctly framed as "architecture/narrative," no fake metrics — keep that discipline) but **no real verified work and empty preview media** (the dark boxes in `section-work.png`). Spec S7.6 requires ≥3 honest entries to ship. Decide which real projects exist and what each can claim (verified metric vs narrative vs selected architecture).
- **Contact details.** `components/chapters/ChapterContact.tsx` carries a `TODO(content)`: WhatsApp number, email, and social handles are placeholders. Needed for S10.5 + the footer, and the Resend route needs `CONTACT_EMAIL_TO` / `RESEND_API_KEY` set.
- **Open decisions still on defaults** (`build-spec.md` §S17 / `CLAUDE.md`): the meaning of the three founding pillars (social/health/finance), whether the brothers are named, and confirming the ecosystem center (currently a metaball core *plus* a "Seu negócio" label — a reasonable hybrid, just confirm it's intended).

---

## 7. Recommendation

**Polish specific items before launch — do not rebuild, and do not switch the hero off real-time WebGL.**

Sequence:

1. **Device reach (5.0) — FIRST.** Settle the tier strategy so the hero actually renders (lite tier) or degrades to a pre-rendered glass loop on integrated GPUs. Nothing else about the hero matters if most visitors (and you) can't see it. This also sets the perf budget that constrains 5.1.
2. **Material pass (5.1)** — within that budget; lifts every form at once.
3. **Fracture desaturation (5.3)** — small, high-impact, makes the S3→S4 arc actually work.
4. **Abstract the clichéd forms (5.2)** — the big design one; budget real iteration time.
5. **Mid-morph (5.4) + Ecosystem polish (5.6) + S8 (5.5)** — remaining signature polish.
6. In parallel, unblock **content (§6)** — real projects + contact details — since those gate launch regardless of the shader work.

The foundations are good: the architecture, the copy, the accessibility, and the resting mark are real assets. But the live review changed the priority order — the first job is making the signature device reachable on the hardware your audience actually uses (§0.5 / §5.0). After that it's a focused visual pass plus real content, not a redesign.

---

*Live-review note (2026-06-03): findings in §0.5 and §5.0 were gathered on the running build on the owner's Intel UHD machine. The glass forms themselves still could not be seen on true high-end GPU hardware — neither the owner's machine (freezes) nor software-rendered captures show the real thing. Confirming the glass look on a discrete-GPU device remains an open item.*
