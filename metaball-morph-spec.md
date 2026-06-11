# Zirtuno Metaball Morph System — Build Spec & Roadmap (v1)

> **Supersedes the raymarched-SDF hero** (build-spec.md S2.3, and the metaball parts of S3/S4/S5/S8). The 3D glass raymarch is retired: it froze on Intel UHD and never matched the reference.
> **New engine:** the react-bits **OGL 2D metaball field** (inverse-square scalar field, screen-space) — the look you approved as "really good and visually strong."
> **Decisions locked (2026-06-03):** v1 visual bar = **liquid glass, NO glow halo**; the **forms match images 2 & 3 exactly**; this document is **spec + roadmap only** (no code until approved).
> **Scope of this doc:** how to author the forms as metaball clouds, how to morph them fluidly, how to shade them as liquid glass without glow, how to wire them into every chapter, and the order to build it.

> ### Update v1.1 (2026-06-07) — after Phases 0–2 reviewed on the real GPU
> Engine + liquid-glass shading are **signed off and locked** (`field-shader.mjs`, `MetaballField.tsx`) — smooth body, dome, specular, fresnel rim, no glow, ~145 fps on Intel UHD. Two decisions follow from reviewing the authored forms against the real brand mark:
> 1. **The resting brand mark is the real SVG, NOT an auto-packed metaball.** The additive field at a smoothness-friendly iso *fills thin negative space and erases fine internal structure* — and the Zirtuno mark is **defined** by thin negative space (three spiralling inter-arm channels + a central eye with a pupil). Auto-packing collapsed the triskelion to a 2-lobe blob and could not hold the pupil. The mark is the one form that must be exact, and the medium is worst at it → **render the SVG at rest; use metaballs only for the morph** (mechanics in §6.1).
> 2. **All 7 pillars get a tight authoring pass to images 2/3** via **structural hand-authoring** (explicit discs/strokes/arcs/panels, not blind distance-transform packing), with deliberately enlarged gaps so fine negative space survives **in glass** (§2.2). ai (fissure + two lobes) and software (two bracket chevrons + nodes) failed as blobs and are the priority; web/automation/data/branding/marketing read acceptably and are refined to match the reference.
> **Root-cause rule (applies everywhere below):** the field is excellent for chunky/organic forms with big gaps and poor at fine detail/thin channels. Author *to the medium* — bigger gaps, fewer-but-deliberate features — rather than fighting it. Where a design truly needs fine structure that won't survive glass, simplify the design, don't lower the (shared) iso.

> ### Update v1.2 (2026-06-07) — crisp glass forms at rest; metaball for the morph ONLY
> Two authoring passes confirmed the additive field cannot reach images 2/3's polish (ai/software especially read as blobs). Owner decision: **generalize the mark hybrid to all 8 forms.**
> - **At rest, every form is a crisp vector (SVG) matching images 2/3, GLASS-SHADED.** Render it by feeding the SVG's **signed-distance field (SDF)** into the SAME locked glass shading math (dome + specular + sheen + fresnel rim) instead of the metaball sum. Silhouette and holes are **exact** (from the SVG); the material matches image 3. This is the resting/static look everywhere (hero, services, converge target, S8, fallbacks).
> - **The metaball field is used ONLY for the liquid morph** between forms. The rough metaball ball-clouds already in `symbols.data.mjs` are sufficient as ~1 s inbetweens — **stop polishing them; they never display at rest.**
> - **Morph = crossfade through the liquid bridge:** glass-SDF(A) → metaball field (melting A-blob→B-blob) → glass-SDF(B). The crisp SVGs are the exact endpoints; the metaball provides the melt.
> - **Shader:** gains a second field source (sample an SDF texture) but the shading model is unchanged — same dome/normal/specular/fresnel, so rest and morph look identical in material.
> **NEW CRITICAL-PATH DEPENDENCY:** 8 clean **SVGs** of the images-2/3 forms, with real holes (counter, fissure, brackets, window interior, rings, column gaps). Source = owner-provided vectors if they exist, else vectorize images 2/3 (trace the flat silhouettes, clean up). Nothing downstream can start without these.
> **Supersedes below:** §10 (forms are SVG sources, not hand-packed metaballs), §5 (shader fed metaball OR SDF), §6.1 (now all 8 forms), §3 (morph = crossfade-through-bridge). Engine + glass shading stay locked.

> ### Update v1.3 (2026-06-10) — v1.2 implemented + hardening pass (what actually shipped)
> **SDF-glass rest is built and verified** (sheet + live, all 8 forms). The as-built file map (supersedes §9's plan):
> - `public/brand/forms/{key}.svg` — the 7 owner-traced form SVGs (runtime); mark = `public/brand/zirtuno-logo-mark.svg`. Reference originals + per-category SVGs + previews live in **`references/morphs/`** (NOT in `public/` — never deployed). Regenerate via `scripts/prepare-morph-assets.mjs`.
> - `lib/webgl/sdf-glass-shader.mjs` — SDF-fed glass fragment shader; the lighting mirrors the LOCKED `field-shader.mjs` glass branch byte-for-byte (keep in sync). Also exports the shared rest constants `SDF_RES / SDF_DRAW / SDF_BLUR / SDF_THICK` so the capture sheet renders exactly what ships.
> - `lib/webgl/sdf-core.mjs` — the single exact-EDT + blur implementation (pure functions; the harness injects this source). `lib/webgl/sdf.ts` — browser rasterise/bbox-normalise → `buildSdf()`.
> - `components/hero/SdfGlassField.tsx` — the live rest renderer (one static draw; CSS breathing; SDF cached per URL). Hardened: `OES_texture_float_linear` fallback to NEAREST, and `webglcontextlost/restored` recovery (fallback logo re-shows via `onContextLost`, rebuild on restore). `components/hero/MetaballField.tsx` gets the same context-loss recovery.
> - `scripts/capture-sdf.mjs` (8-form glass sheet) + `scripts/capture-field-live.mjs` (live in-app shots).
> - Gating: `?hero=field` previews the new hero; the deterministic capture params (`?state/?capture/?pair`) take precedence over it, and keyboard/aria stepping is suppressed in field mode until Phase 3 wires states.
> - **Legacy decoupled:** the retiring raymarch/mesh paths now read a FROZEN snapshot (`lib/webgl/symbols-legacy.data.mjs` via `symbols.ts`); `symbols.data.mjs` is free to evolve as the field morph endpoints. Retired/removed: `trace-icons.mjs`, `capture-symbols.mjs`, `author-mark/forms.mjs`, `symbols.generated.json`.
> **Phase 3 prep (pending owner go-ahead):** regenerate the morph ball-clouds FROM the form SDFs so endpoints register with the rest SVGs (the current clouds predate the owner SVGs and will pop at the crossfade); move SDF building off the main thread (worker or build-time bake — 8 forms × ~100 ms EDT); integrate field-hero gating with `gpu-tier` when it becomes the default.

> ### Update v1.4 (2026-06-10) — Phase 3 built (the morph)
> `components/hero/FieldMorphHero.tsx` — the morphing field hero behind `?hero=field`:
> - **Rest** = the current form's SDF-glass (one static draw, CSS breath ±2 %); **morph** = the metaball melt (§3.3: min-travel greedy matching cached per transition, left-to-right stagger 0.25, radius-leads 1.18, `arrive` ease, `DURATIONS.morph` 1.4 s); **crossfades** (`DURATIONS.micro` 200 ms) at the melt edges per v1.2 — two stacked WebGL2 canvases sharing one breathing/leaning wrapper so registration holds through the breath.
> - **State machine** (§4): autocycle `DURATIONS.autocycle` dwell, pauses off-screen (`play`) + on hover; pointer lean ≤4 %; keyboard via the shell's `manualState` (retargets mid-melt from live droplet positions); `onActiveChange` drives the PillarIndicator; reduced-motion gets the static SDF mark (no autocycle, §8).
> - **Determinism for QA:** `?fstate=N` (one rest form) · `?fpair=a-b-m` (one frozen melt frame) · `?fcycle=1` (short dwell). Harness: `scripts/capture-morph-frames.mjs` (mid-frame grid of all 8 transitions + melt-fps + keyboard smoke test; pre-seeds the gpu-tier cache so the probe can't pollute readings — note headless Chrome rasterises WebGL in software, run `HEADLESS=false` for real-GPU numbers).
> - **Checkpoint measured:** all 24 mid-frames read as connected liquid (no pops); melt ≈ **101 fps on the Intel UHD**; keyboard announces + melts. Remaining for the hero milestone: owner motion sign-off, then Phase 4 (probe/tiers/watchdog) and the default-hero flip.

> ### Update v1.5 (2026-06-11) — the liquid never freezes (owner correction at the R0 sign-off run)
> Seeing v1.2's SVG-at-rest hybrid live, the owner rejected the handoff: *"the animation just suddenly becomes the SVG image — the SVGs are a reference so you can match the metaballs."* **Supersedes v1.2's rest mechanics:**
> - **The metaball field IS the hero at all times.** One always-visible field layer; REST holds the current form's ball-cloud **alive** — per-droplet low-frequency micro-jitter (§4, amp 0.005, ramped in over ~1.5 s after arrival), the CSS breath, the pointer lean. Melts start from the droplets' LIVE positions → rest → melt → rest is one continuous liquid with **no crossfade, no sharpening handoff, no SDF layer**.
> - **The owner form SVGs are the FIDELITY REFERENCE** the 48-ball clouds are generated from (`generate-morph-endpoints.mjs`) and iterated against (`capture-rest-forms.mjs` renders every resting metaball form beside its reference SVG). Form fidelity is the active art-direction workstream — screenshot rounds per AGENTS.
> - **SDF-glass survives only as the reduced-motion static mark** in the hero (AGENTS rule 7) and remains available to R1 chapter work. `?fstate=N` now freezes the **metaball** rest form (was the SVG-glass still).
> - Rest now renders per-frame (same draw cost as the melt — ~101 fps measured on the Intel UHD); the §7 watchdog samples continuously and downshifts full → lite → still-frame. The v1.4 crossfade double-exposure item is **obsolete** (no crossfade exists).

> ### Update v1.6 (2026-06-11) — EXACT forms, living liquid (owner: "needs to be exact like the symbols I sent")
> v1.5's metaball rest registered with the references but read blobbier; the owner requires the forms **exact**. A 48-ball additive field cannot be pixel-exact (three generations of evidence) — so the hero's liquid is now the **vector forms themselves**:
> - **Field source = the owner SVGs' signed-distance fields** (the existing worker-built R32F pipeline), rendered through the LOCKED glass lighting. `sdf-glass-shader.mjs` gained field-source-only uniforms (lighting byte-identical): a second SDF sampler + `iMix` (the melt blends the two distance fields), a slow procedural **domain warp** (`iTime`/`iWarp` — the liquid is alive at rest, agitated mid-melt), and a mid-melt **pinch** (`iPinch` — thin connections snap into droplets and reform). All default to 0 → the v1.2 static renderer and its harnesses are unchanged.
> - **Rest is pixel-exact by construction** (warp ≈2 px of living wobble; `?fstate` stills render at zero warp — see `captures/rest-forms-sheet.png`, every form beside its reference). **Melts are exact-to-exact**: organic level-set dissolves with droplet pinch-off (`captures/morph-frames-sheet.png`). The form-fidelity workstream is CLOSED — there is nothing left to approximate.
> - `FieldMorphHero` machine: same state machine/keyboard/hover/watchdog; mid-melt retargets are QUEUED to arrival (no snaps). Lite tier = resolution only (the SDF renderer is ~10× cheaper than the 48-ball loop). Mid-frames m∈{0.25,0.5,0.75} verified for all 8 transitions.
> - The 48-ball metaball system (`field-shader.mjs`, `MetaballField`, `symbols.data.mjs`) is **no longer in the hero's live path** — it remains for `?fflat=1` debug and the R1 chapter drivers (scatter/converge/exhale), which are its native strength and don't need exact forms.

---

## 0. Why the last attempt didn't land (diagnosis)

Two different engines were built; understanding both is why this spec exists.

1. **`scripts/trace-icons.mjs` — SDF capsules + smooth-min.** Signed-distance lines fused with `smin`. This is why **image 1 looks rigid** — capsules have straight sides and hard logic; even with a fillet it reads as a flat icon set, not liquid. *Retire this for the hero forms.*
2. **`lib/webgl/symbols.data.mjs` — inverse-square ball clouds (ISO 2.2).** This is the *right* engine (same family as react-bits) and the right instinct. But it falls short of images 2/3 for three concrete reasons:
   - **No morph correspondence.** Every form has a *different ball count* and no mapping between forms (mark ≈ 14 balls, web ≈ 30+, ai = 10, automation ≈ 20…). Interpolating between mismatched lists makes balls teleport, pop, and scramble — **this is the "morphs are not good" problem.**
   - **Lumpiness.** Several forms use few large `disc()`s (e.g. AI = 10 discs). At ISO 2.2 individual balls read as scallops/bumps, not the smooth confident liquid of images 2/3.
   - **Not matched to the reference.** The shapes are *conceptually* right but not authored to the exact image-2/3 designs (proportions, stroke weights, gaps).

**The fix, in one sentence:** make every form a rearrangement of the **same fixed set of N balls** (so morphs are pure position+radius lerps with no popping), author them densely enough to read as smooth liquid, match them to images 2/3, and shade the field as liquid glass.

---

## 1. The engine (react-bits OGL MetaBalls — what to keep, what to change)

**Keep:** OGL renderer, the inverse-square field `total = Σ rᵢ²/|p−cᵢ|²`, the full-screen triangle, `fwidth`-based anti-aliasing, the optional cursor ball, the `WEBGL_lose_context` cleanup, `dpr` handling.

**Change / add:**

| Area | react-bits default | Zirtuno requirement |
|---|---|---|
| Ball source | procedural orbits (`cos/sin` per ball) | **driven by the symbol system** (target positions per state, lerped for morph) |
| Ball budget | `iMetaBalls[50]`, loop `i<50` | **fixed budget `N` (see §3); raise array + loop to N** |
| Iso level | `1.3` (too blobby, fills gaps) | **`2.2`** (matches `symbols.data.mjs`; preserves the brain's folds, the window interior, the mark's counter). The shader iso **must** equal the authoring iso. |
| Coordinate space | world ±`animationSize/2` | **symbol space `[-0.5, 0.5]`, +y up** (authoring space), mapped to the field by one `uScale`. All symbol data lives here. |
| Color stage | flat color × `f` | **liquid-glass shading, no glow (§5)** |
| Motion | constant orbit | **state machine: rest → morph → rest, + idle breathing + hover (§4, §6)** |

> The cursor "ball" from react-bits is **not** used to deform the forms (it would smear the symbols). Repurpose it only as an optional Contact-chapter "exhale" accent, off by default elsewhere.

---

## 2. Authoring model — forms as clouds of balls

A **ball** is `[x, y, r]` in symbol space `[-0.5, 0.5]`. A **form** is an array of balls. Keep the existing authoring helpers from `symbols.data.mjs` — they are good — but treat their output as an *intermediate*, then resample to the canonical budget (§3):

- `disc(x,y,r)` — a single bulb.
- `stroke(x1,y1,x2,y2,r,spacing)` — a chain of bulbs along a line (a fluid stroke).
- `taper(...r1,r2)` — a chain that swells/thins (megaphone horn, mark uprights).
- `arc(cx,cy,R,r,a0,a1,spacing)` — bulbs along an arc (loops, waves, orbits).
- `panel(...)` — a filled rounded rectangle (window thumbnail).
- `column(...)` — a vertical necked bar (data).

### 2.1 Calibration constants (grounded in the field math, ISO = 2.2)

A lone ball of radius `r` renders at visible radius ≈ `r/√ISO ≈ 0.674·r`. Two balls merge while centres are within ≈ `1.9·r`. Use these spacings (× `r`):

| Intent | Centre spacing | Notes |
|---|---|---|
| **Smooth stroke** (no scallops) | **≤ 1.25·r** | the default for any line that must read as one liquid tube |
| **Visible neck** (mercury pinch) | **≈ 1.6·r** | for the "running droplets" look between bulbs |
| **Deliberate gap** (sulcus, counter, window interior) | **≥ 2.2·r** | balls must NOT bridge — this is how holes survive an additive field |
| **Keep a ring open** (automation/branding) | ring radius `R` with `n` balls of radius `r`: keep **`n·r²/R² < ISO`** | so opposite sides don't fill the centre |

**Smoothness rule for v1:** any visible stroke uses spacing ≤ 1.25·r and `r ≥ 0.045` in symbol space (sub-0.03 strokes break up at ISO 2.2 and read as dotted — this is part of why the current `web` frame is fragile). Raise ball counts to hit smoothness; the budget (§3) is large enough.

### 2.2 Holes & straight edges (the two hard cases)

- **Holes** (automation loop, brain fissure, window screen, mark counter, branding orbit): never "subtract." Author the *outline* as a ball chain and keep the interior **empty**, with opposite walls ≥ 2.2·r apart so the field dips below ISO between them. Verify each hole in the capture sheet.
- **Straight edges** (window frame, code brackets): a ball chain approximates a line with a faint waviness. **That waviness is on-brand** — image 2's window and brackets are gooey-edged, not CAD-straight. Embrace it; don't fight for perfectly straight lines.

---

## 3. The morph system (the core fix)

**Principle: one canonical ball budget, every form is the SAME balls rearranged.** No appearing/disappearing balls in the common case → no popping → true liquid morph (mercury flowing from one shape to the next).

### 3.1 Canonical budget

- Choose **N = 48** balls (tunable 40–64). 48 is plenty for the densest form (web), trivial for the GPU even on Intel UHD (48 inverse-square terms/pixel).
- **Every state is exactly N balls**, in a **fixed index order**. Ball `i` is the *same droplet* in every form; morphing is `pos_i = lerp(A_i, B_i, t)`, `r_i = lerp(rA_i, rB_i, t)`.

### 3.2 Resampler (authoring → canonical N)

Author each form freely with the §2 helpers, then run a build-time **resampler** that maps the authored balls onto the N canonical indices:

1. If a form has **> N** balls, merge nearest pairs until N.
2. If a form has **< N** balls, split the largest balls (place children along their local stroke direction) until N.
3. **Assignment between forms:** bake a stable index correspondence by **min-travel matching** (greedy nearest-neighbour, or Hungarian) so droplets that are near each other in form A map to near positions in form B. Bake this per transition in the autocycle and for hover.
4. **Dormant droplets:** where a form genuinely needs fewer features, park surplus balls *inside* a thick region at small `r` (≈0.02) so they read as part of the mass, never as stray dots. They still lerp (they don't pop).

> Output: `lib/webgl/symbols.generated.json` — `{ iso: 2.2, n: 48, scale, states: { mark:[[x,y,r]×48], web:[…], … }, transitions: { "mark->web":[…idx map…], … } }`. This becomes the single source of truth the hero shader reads.

### 3.3 Morph dynamics (the liquid feel)

- **Duration** ≈ 1.2–1.4 s (reuse `DURATIONS.morph`). Ease with `arrive` (`cubic-bezier(0.22,1,0.36,1)`).
- **Regional stagger:** offset each droplet's `t` by a small amount based on its position (e.g., left-to-right or centre-out), so the form necks and flows rather than snapping uniformly — this is what sells "mercury."
- **Radius-leads-position** for splitting features: a droplet that must separate grows/shrinks its `r` slightly ahead of moving, so features bud off the mass instead of sliding rigidly.
- **No path arcs needed** — straight lerp + stagger + the field's own merging reads as liquid. Add a subtle sinusoidal lateral wobble (≤0.01) only if a transition feels too linear.

### 3.4 Acceptance for morph

- [ ] No droplet ever pops in/out (radius starts/ends ≥ 0 and changes continuously).
- [ ] Mid-morph (t≈0.5) reads as a connected liquid, not a scatter of dots or a dense lump.
- [ ] Every pillar→pillar and mark↔pillar transition is smooth at 60 fps on Intel UHD.

---

## 4. State machine

States (index order, matches `METABALL_STATES`): **0 mark · 1 web · 2 software · 3 ai · 4 automation · 5 data · 6 branding · 7 marketing.**

- **Rest:** hold a state with **idle breathing** — global scale ±2% over ~8 s, plus per-droplet micro-jitter (≤0.006, low-freq noise) so the liquid is alive at rest.
- **Autocycle (hero):** `mark → web → software → … → marketing → mark`, dwell ~9 s, morph ~1.3 s. Pauses on hover/focus and off-screen.
- **Hover (hero):** pointer leans the whole field ≤0.04 toward the cursor (parallax), and can scrub to the nearest pillar; release returns to autocycle.
- **Keyboard:** ←/→ step states, Home=mark, End=marketing (reuse existing `MetaballCanvas` a11y: `role=img`, `aria-live` announcing the pillar name).
- **Scrubbed (Services/S8):** state is driven by scroll progress, not a timer (§6).

---

## 5. Liquid-glass shading — NO glow (v1 look)

Render the field as glossy liquid glass on pure black, **without** the outer bloom halo. Start from the `iGlass` branch already in `scripts/trace-icons.mjs` (it's most of the way there) and **remove the glow term**.

**Pipeline (fragment shader, per pixel):**

1. **Coverage:** `fill = smoothstep(aa, -aa, ISO - total)` with `aa = fwidth(total)` (crisp anti-aliased edge). Outside `fill`, output **pure black** (no halo — this is the "no glow" decision).
2. **Dome height (fake volume):** map field strength above iso to a rounded cross-section — `t = clamp((total-ISO)/THICK, 0,1)`, `curv = sqrt(1-(1-t)²)`; thick centres dome up, thin necks stay low. Gives the tube-of-liquid roundness.
3. **Normal:** from the screen-space gradient of `total` (central differences, the `field(q±e)` trick) combined with the dome slope → `n = normalize(vec3(gdir*slope, 1.0))`.
4. **Lighting (cyan glass):**
   - body gradient `mix(#00B6CC → #4DECFF)` by wrapped diffuse (one key light, upper-left);
   - **tight specular** `pow(spec, ~26)` (the wet highlight);
   - **broad sheen** `pow(spec, ~4)·0.2`;
   - **fresnel rim** `pow(1-n.z, ~2.6)·0.5` — the bright glassy edge that gives depth **without** a glow halo.
5. **Vivid cyan discipline:** base `#00E3FE`, deep `#00B6CC`, highlight `#4DECFF`. No tone-mapping. Keep it saturated.

> **"No glow" = drop the `glow = exp(-d*7)` outer term and any additive bloom.** The form is defined strictly by `fill`; all richness comes from internal shading + the fresnel rim, so edges stay crisp against black.

**Reduced-motion / lite tier** may render flat cyan (`fill` × `#00E3FE`) instead of the glass shading — acceptable and cheap.

---

## 6. Integration with the chapters (one system, reused)

All of these read the **same `symbols.generated.json`** and the **same shader** — only the driver differs.

- **S2 Hero:** rest on the **SVG mark** (see §6.1), autocycle the 7 pillars as metaballs, hover-lean, keyboard.

### 6.1 The SVG-hybrid resting mark (v1.1)

The brand mark is too fine-structured for the additive field (§ Update v1.1), so it is **never auto-packed**. Instead:

- **At rest:** display the real `public/brand/zirtuno-logo-mark.svg` (crisp, pixel-perfect — every channel + the pupil exact), crossfaded *on top of* the OGL canvas. This is also already the reduced-motion / no-WebGL fallback, so rest is identical everywhere.
- **A rough metaball "mark-form"** still exists in the symbol set as the **morph endpoint only** — it does *not* have to pass as the logo. It is seen for ~1 s mid-transition.
- **Morph out (mark → pillar):** the SVG fades out (≤200 ms) as the field fades in already morphing from the mark-form toward the target pillar. **Morph in (pillar → mark):** the field morphs back to the mark-form, then the SVG fades in on top to "sharpen" to the exact logo.
- The metaball mark-form should *roughly* register with the SVG (same centre, similar mass) so the crossfade reads as the liquid resolving into the crisp mark, not a cut.

Net: the logo is exact in every resting/static state (hero, converge target, S8 landing, fallbacks); metaballs carry only the motion, which is what they're good at.
- **S5 Services (pinned):** state is **scroll-scrubbed** — each pillar entry maps to its form; scrolling morphs pillar→pillar in lockstep with the copy (O QUE É / RESOLVE / GERA).
- **S3 The Problem (fracture):** reuse the SAME N balls — **scatter** them outward (per-ball radial offset + desaturate toward muted grey-cyan + lower iso so they read as *disconnected* droplets) to mean "fragmented." Drift slowly.
- **S4 The Ecosystem (converge):** the scattered balls **fly back** and re-form the `mark` (scrub-bound), then the 10 node labels + connector lines draw around it. The broken→unified payoff = balls regrouping + colour blooming back to vivid.
- **S8 Origin:** two clusters of the N balls drift together and resolve into the `mark` (the "two brothers → three pillars → the mark" beat). Reuse the converge logic.

> Because every chapter is the same 48 balls, the narrative ("scatter → regroup → become the mark → bloom into services") is literally one continuous liquid the whole site long. This is the strongest version of the brand idea and it's only possible with the canonical-budget model (§3).

---

## 7. Performance & device tiers (the Intel UHD win)

The 2D field is ~**48 inverse-square terms per pixel** — orders of magnitude cheaper than the retired raymarch (which did per-pixel sphere-tracing + normals + thickness). It runs on Intel UHD.

- **Replace the name-string blocklist** in `lib/webgl/can-run-glass.ts` with a **runtime perf probe** (render a few frames offscreen, measure frame time, pick a tier). GPU strings are an unreliable proxy.
- **Tiers:**
  - *Full:* N=48, glass shading, `dpr` up to 2.
  - *Lite (integrated GPUs):* N≈36, flat-cyan shading, `dpr` 1, internal render scale 0.75. Must hold ~60 fps on Intel UHD.
  - *None:* static fallback (§8).
- **FPS watchdog:** if frame time degrades at runtime, downshift tier (never freeze).
- Single shared canvas where possible; pause `requestAnimationFrame` off-screen (already done in `MetaballCanvas`).

**Target:** the hero shows *live liquid metaballs* on the owner's Intel UHD at 60 fps — the thing that does not happen today.

---

## 8. Fallbacks (reduced-motion / no-WebGL / mobile)

- Pre-render each of the 8 forms (and a couple of morph mid-frames) to **static cyan PN/WebP or SVG** via the capture harness (`scripts/capture-symbols.mjs` already exists — extend it).
- Reduced-motion: show the resting `mark` still; no autocycle.
- No-WebGL / lite-fail: the static `mark`.
- Mobile: static form per section (or lite tier if the probe passes); morphs optional.
- These stills double as OG/social images.

---

## 9. File & architecture plan

```
lib/webgl/
  symbols.data.mjs        # KEEP — authored forms (helpers + the 8 designs). Refine to match images 2/3 (§10).
  symbols.generated.json  # NEW — resampler output: N=48 canonical states + baked transitions (§3.2). Source of truth at runtime.
  symbols.ts              # NEW — typed loader for the JSON (states, transitions, iso, scale).
  resampler.mjs           # NEW — authored → canonical N (merge/split/assign). Build step.
  perf-probe.ts           # NEW — replaces the can-run-glass blocklist (§7).
components/hero/
  MetaballField.tsx       # NEW — OGL metaball component (adapted react-bits): reads symbols.ts, runs the state machine, glass shader.
  MetaballCanvas.tsx      # KEEP shell — swap MetaballScene → MetaballField; keep a11y/keyboard/fallback wiring.
  MetaballScene.tsx       # RETIRE (old raymarch) once MetaballField is in.
scripts/
  capture-symbols.mjs     # KEEP/extend — capture sheet of all 8 + morph mid-frames (QA + fallbacks).
  trace-icons.mjs         # ARCHIVE — superseded for the hero (capsule/smin look).
```

Old: `MetaballScene.tsx` (692-line raymarch) and the `getRestingState`/SDF trace path are deprecated by this spec.

---

## 10. The 8 forms — lock to images 2 & 3

Author all to the smoothness rule (§2.1) and resample to N≤48. **Author structurally** (explicit discs/strokes/arcs/panels per design), not by blind distance-transform packing — packing fills the intended gaps. **Verify every gap in the GLASS render, not just flat** (flat lies; glass is what ships). Where the reference packs detail tightly (software's brackets, ai's folds), **space it wider than the literal reference** so it survives at iso 2.2 — a recognizable fluid cousin of images 2/3, not a pixel replica. Per-form notes:

1. **mark / logo — SVG at rest, NOT auto-packed (v1.1, §6.1).** The resting hero shows the exact `zirtuno-logo-mark.svg`. The symbol set keeps only a *rough* metaball mark-form as the morph endpoint (centre + mass roughly registering with the SVG); it is never expected to read as the logo on its own.
2. **web** — gooey browser window: rounded frame, 3 control bulbs, one filled content panel, 2–3 text lines. Frame strokes `r≈0.05`, spacing ≤1.25 (thicker than current 0.03 so it doesn't break up); interior open.
3. **software** — two big nodes bridged (dumbbell) + a third node + a `<>` glyph, per image 2. **PRIORITY FIX (was a blob+chevron):** draw the `<` and `>` as two clearly separate chevrons, spaced wider than the reference so both bracket gaps survive in glass; keep the node masses distinct, not fused into one lump.
4. **ai** — brain, per image 2. **PRIORITY FIX (was a featureless blob):** build two distinct lobe-masses with a *real* central fissure channel — make the fissure as wide as automation's ring gap so it survives glass — plus a few "firing" droplets below. Two clear lobes + an open fissure beats a smooth blob with implied folds.
5. **automation** — single fluid cycle loop (~288°) with an open gap + a fatter arrowhead bulb. Keep centre hollow (§2.1 ring rule).
6. **data** — four necked columns of growing height, well separated (gaps ≥2.2·r so columns stay distinct).
7. **branding** — organic core + necked orbit arcs + 2–3 satellites (image-2 branding). Keep orbit open around the core.
8. **marketing** — megaphone horn (taper) + 2 necked signal-wave arcs + stray broadcast droplets, per image 2.

Each must pass: **reads as the service at a glance**, **smooth (no scallops)**, **gaps intact**, and **same 48 balls as every other form**.

---

## 11. Acceptance criteria (v1)

- [ ] Resting mark = exact **SVG** (§6.1); the 7 pillars render as **smooth liquid glass (no glow)** matching images 2/3, on black, vivid `#00E3FE`, gaps verified in the glass render.
- [ ] Forms are the **same 48 balls**; every autocycle + hover transition morphs with **no popping**, elegant mid-frames, 60 fps on Intel UHD.
- [ ] Hero: rest on mark, autocycle, hover-lean, keyboard, a11y intact.
- [ ] The blocklist is replaced by a perf probe; Intel UHD gets **live** metaballs (lite tier), never a freeze.
- [ ] Fracture (S3) and converge (S4) reuse the same balls; converge re-forms the mark and blooms to vivid.
- [ ] Services scrub morphs pillar-by-pillar with the copy.
- [ ] Static fallbacks exist for all 8 forms (reduced-motion / no-WebGL / mobile).
- [ ] Both PT and EN unaffected (forms are language-agnostic).

---

## 12. Roadmap (phased, with screenshot checkpoints)

Each phase ends with a capture sheet for sign-off **before** moving on — the lesson from the last iteration loop.

**Phase 0 — Foundations (engine + one form)**
1. Add `ogl`; build `MetaballField.tsx` from the react-bits component; render react-bits' default balls to confirm the engine + OGL pipeline work in Next 15.
2. Switch the field to read **static positions**; render the **mark** at ISO 2.2 in flat cyan. ✅ *Checkpoint: mark matches image-2 "logo."*

**Phase 1 — Liquid-glass shading (no glow)**
3. Port the `iGlass` shading from `trace-icons.mjs`, **remove the glow term**, retune for crisp edges + fresnel rim on black. ✅ *Checkpoint: mark looks like image 3 minus the halo.*

**Phase 2 — crisp glass forms at rest** *(rewritten v1.2)*
4. **Assets:** obtain the 8 form SVGs matching images 2/3 (owner vectors, or vectorize the references), each with its real holes. *Critical path — blocks 5–6.*
5. **Glass-SDF rest renderer:** extend the field shader with an SDF source — rasterize each SVG → signed-distance field → feed the existing dome/specular/fresnel math. Render every form crisp + glass-shaded (image-3 look), holes exact.
6. Render the **static sheet (glass) of all 8 from SVG** + confirm live in-app. ✅ *Checkpoint: each form is the exact images-2/3 silhouette, glass-shaded, holes perfect. (No more metaball-fidelity gating — the SVG guarantees the shape.)* Keep the rough metaball ball-clouds as morph endpoints; do not polish them.

**Phase 3 — The morph (the deliverable)** *(rewritten v1.2)*
6. **Crossfade-through-bridge:** glass-SDF(A) → metaball field (melting A-blob→B-blob, §3.3 lerp + regional stagger) → glass-SDF(B). Crisp SVGs are the exact endpoints; the metaball is only the ~1 s liquid bridge. Tune the SDF↔metaball handoff so it reads as the crisp form *liquefying*, not a cut.
7. Wire autocycle + hover + keyboard. ✅ *Checkpoint: mark→web, web→software, software→ai, … each starts/ends on the exact glass SVG, melts through a clean bridge, no pops, 60 fps on Intel UHD.*

**Phase 4 — Performance & reach**
8. Replace the blocklist with the perf probe; add lite tier + FPS watchdog (§7). ✅ *Checkpoint: 60 fps live on the owner's Intel UHD; `?glass=force` never freezes.*

**Phase 5 — Chapter integration**
9. Services scrub-morph; S3 fracture (scatter+desaturate); S4 converge (regroup→mark→bloom); S8 two→three→mark — all reusing the 48 balls.
10. Static fallbacks for all forms; retire `MetaballScene.tsx`. ✅ *Checkpoint: full-site scroll-through, both locales.*

**Suggested sequencing:** Phases 0–3 are the heart (a working, beautiful, morphing hero). 4 unlocks reach. 5 spreads it across the site. Ship 0–4 as the hero milestone; 5 follows.

---

## 13. Open decisions

- [ ] **N** = 48 (vs 40 / 64) — confirm after Phase 2 (depends on web's density).
- [ ] **Autocycle order** — mark→web→…→marketing→mark (default) vs mark between each pillar.
- [ ] **Cursor ball** — keep react-bits' interactive ball as a Contact-only "exhale," or drop entirely.
- [ ] **Fracture colour** — how desaturated/dark the S3 shards go (needs a visual call).
- [ ] **Mobile** — lite tier live, or static stills only (battery/heat).
- [ ] Confirm `symbols.data.mjs` space (`[-0.42,0.42]`) → standardize to `[-0.5,0.5]` or keep.

---

*North star: one continuous liquid — the brand mark — that scatters into the problem, regroups into the ecosystem, and flows through the seven services as glass. Cheap enough to run everywhere, fluid enough to feel alive, and locked to the look in images 2 & 3.*
