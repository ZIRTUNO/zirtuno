# Zirtuno Continuous Liquid System — Technical Contract v2

> Focused authority for exact forms, the unified field, the §3.3 morph bridge,
> continuous droplet identity, conductor contracts, fluid physics, rendering,
> optics, tiers, fallbacks, and visual QA.
>
> Version date: 2026-07-09.
>
> Current baseline: R5-A structural unification, R5-B physics, R5-C optics,
> and R5-D cinematics/scene completion are complete. R5-E hardening is the
> approved target.

## 0. Scope and Authority

`AGENTS.md` owns project-wide non-negotiables.
`build-spec.md` owns the visitor experience and chapter acceptance.
This file owns how the liquid works.

The old morph document recorded many sequential experiments—ball-only rest,
SVG overlays, SDF crossfades, SDF blends, raymarch and mesh fallbacks. Those
chronological updates are removed here. This contract describes the one
approved system:

- owner SVGs define exact form endpoints;
- SDFs render those endpoints through the locked liquid-glass material;
- 48 canonical droplets form a real in-field bridge between endpoints;
- form fields and droplets are summed before one iso-surface;
- the same 48 droplet identities persist through the entire homepage;
- a conductor owns scene handoffs and the fluid core owns dynamics;
- no visual layer crossfades one engine or scene into another.

## 1. Locked Invariants

1. One persistent homepage canvas from Hero through Footer.
2. One canonical set of 48 droplets with continuous identity.
3. Eight exact owner-traced form endpoints: mark plus seven services.
4. Exact form rest output protected by `forms:rest`.
5. One unified scalar field and one shared iso-surface.
6. One §3.3 bridge implementation shared by live scenes and deterministic QA.
7. No rest/morph crossfade and no cross-scene form crossfade.
8. Two shader form slots arbitrated centrally.
9. `bind=1` preserves signed-off exact dynamics; `bind=0` exposes physics.
10. Full, lite, static, and reduced-motion paths keep the same meaning.
11. Watchdogs lower cost; they do not freeze a live liquid.
12. Physics and optics remain independently bypassable during R5 hardening.

Breaking any invariant requires an owner decision, a new baseline, and updated
machine plus visual gates.

## 2. Canonical Forms and Assets

### 2.1 State registry

`lib/webgl/symbols.ts` is the ordered runtime registry:

| State | Key | Meaning | Runtime endpoint |
|---|---|---|---|
| 0 | `mark` | Zirtuno mark | `public/brand/zirtuno-logo-mark.svg` |
| 1 | `web` | Web Design & Digital Experience | `public/brand/forms/web.svg` |
| 2 | `software` | Software & App Development | `public/brand/forms/software.svg` |
| 3 | `ai` | Artificial Intelligence | `public/brand/forms/ai.svg` |
| 4 | `automation` | Automation & Integrations | `public/brand/forms/automation.svg` |
| 5 | `data` | Data & Dashboards | `public/brand/forms/data.svg` |
| 6 | `branding` | Branding & Positioning | `public/brand/forms/branding.svg` |
| 7 | `marketing` | Marketing & Growth | `public/brand/forms/marketing.svg` |

Every consumer—the hero machine, pillar indicator, Services, captures, stills,
and scene targets—uses this order. Do not duplicate the state list.

### 2.2 Source and runtime assets

- `references/morphs/` contains owner originals, traced SVG endpoints,
  previews, and `manifest.json`. It is reference material, not deployed.
- `public/brand/` contains the approved runtime endpoints.
- `lib/webgl/symbols.data.mjs` contains canonical 48-droplet endpoint clouds
  registered to the SVGs.
- `public/brand/stills/` contains baked form art for project placeholders and
  static supporting surfaces.

Regenerate endpoints with:

```bash
npm run endpoints
```

Regeneration is not sign-off. Always run the rest and morph sheets afterward.

### 2.3 SDF construction

`lib/webgl/sdf.ts` rasterizes and bounds the SVG, then
`lib/webgl/sdf-core.mjs` builds the exact signed-distance texture. Current
constants are shared between live rendering and captures:

- resolution: `SDF_RES = 512`;
- form draw scale: `SDF_DRAW = 0.82`;
- smoothing: `SDF_BLUR = 3`;
- glass bevel band: `SDF_THICK = 0.1`.

The SDF contains negative distance inside, positive distance outside and in
holes. This is why negative space remains exact.

## 3. Unified Field

### 3.1 Field equation

The shader combines two form fields and all droplets before surface extraction:

```text
T(p) = formA · S(dA) + formB · S(dB)
       + Σ bounded( radius² / |p - center|² )

S(d) = (1 + d / GOO)^-2
d'   = GOO · (T^-1/2 - 1)
surface: d' = 0
```

Current constants:

- `SDF_GOO = 0.35`;
- `SDF_BALL_REACH = 7.0 × radius`;
- maximum packed balls: `SDF_BALL_MAX = 80`.

Mapping form distance into the same inverse-square profile allows a cursor or
bridge droplet to bulge, neck into, and merge with an exact form. Inverting the
field back to pseudo-distance makes the form-only path return its original
distance exactly. With identity uniforms and no nearby balls, the rest endpoint
is exact by construction.

### 3.2 Bounded influence

Each droplet field fades to zero beyond its reach. A buried droplet is shielded
from embossing circular normals inside a solid form. Consequences:

- a droplet can pull/bulge a nearby edge outward;
- it cannot globally inflate the entire mark;
- it cannot erode a form;
- the exact form recovers when the droplet leaves;
- cursor influence remains local and detachable.

### 3.3 Coverage and holes

Coverage derives from pseudo-distance with clamped `fwidth` anti-aliasing. The
clamp prevents the bounded-field cutoff from painting phantom half-alpha discs.
Outside the fill and inside SVG holes, the current renderer outputs transparent
black. R5-C composites to an opaque ink-black final target.

## 4. Exact Rest, Living Material

At rest:

- the active SDF form has full field weight;
- erosion is zero;
- bridge droplets have zero radius/not present;
- the form uses the locked internal glass branch on full tier;
- a slow domain warp keeps the liquid alive.

Current tuning:

- rest warp: `SDF_WARP_REST = 0.0055`;
- peak morph warp: `SDF_WARP_MORPH = 0.012`;
- melt erosion depth: `SDF_MELT_ERODE = 0.085`.

Deterministic rest captures set warp/time so comparisons remain stable. The
production rest may move by a few pixels but must preserve the owner silhouette,
holes, proportions, and material.

The reduced-motion/no-WebGL Hero uses the static mark SVG. Static chapter paths
use exact SVGs or approved form stills; they do not use rough ball-cloud
approximations.

## 5. §3.3 Liquid Bridge

The bridge is implemented once in `lib/webgl/field-drivers.ts` and reused by
hero QA, the live hero scene, Services, and any scene that transitions exact
forms.

### 5.1 Canonical mapping

Each state has exactly 48 droplets. For a transition A → B:

1. compute a stable greedy min-travel assignment;
2. cache the permutation for the session;
3. keep droplet identity stable for every repeated A → B transition.

Droplets never pop in or out. Radius may continuously shrink to zero at bridge
edges, but identity and arrays remain stable.

### 5.2 Timing and shape

Locked constants:

- duration: `DURATIONS.morph = 1400 ms`;
- easing: `arrive = cubic-bezier(0.22,1,0.36,1)`;
- regional stagger: `STAGGER = 0.25`;
- radius lead: `RADIUS_LEAD = 1.18`;
- form/droplet handoff window: `BRIDGE = 0.38`.

The position stagger sweeps by each endpoint’s baked spatial order. Radius
arrives about 18% ahead of position so features bud, neck, and fuse instead of
sliding as rigid discs.

### 5.3 Handoff sequence

1. Form A begins eroding from thin structure inward.
2. Its field weight drains only after erosion has made the boundary disappear
   organically.
3. The 48 droplets condense on A’s footprint and grow through the bridge
   envelope.
4. Droplets travel through min-distance matches with stagger and radius lead.
5. Form B emerges from its skeleton through reverse erosion.
6. Bridge radii drain before B is fully solid.
7. Form B lands at exact full weight and zero erosion.

Form A, droplets, and Form B are all contributors to the same field during the
handoff. There are not two stacked canvases and no opacity crossfade.

### 5.4 Retargeting

The live hero may queue or retarget only through continuous state. It cannot
teleport endpoints or restart from a stale cloud. Keyboard state changes and
autocycle use the same bridge path and accessibility announcement.

### 5.5 Bridge acceptance

- endpoints match the owner SVGs;
- no double exposure or sharpening cut;
- no popping radius/position;
- mid-frames read as one connected liquid rather than dots or a dense blob;
- all eight cycle transitions land correctly;
- bind=1 parity keeps the live conductor bridge identical to the signed-off
  low-pass behavior.

## 6. Persistent Droplet Identity and Budget

### 6.1 Canonical family

`lib/webgl/phys.mjs` owns:

- `N = 48` canonical droplets;
- the eight endpoint clouds;
- stable per-droplet variation and `TAUP` mass/lag identity;
- scatter, cluster, orbital, and ecosystem target vocabulary;
- a 12-droplet ambient family.

Droplet `i` is the same conceptual droplet in Hero, Problem, Ecosystem,
Services, Método, Work, Origin, Studio, Contact, and Footer. Scene handoffs
blend the target of that identity; they do not replace the array.

### 6.2 Packed budget

The shader loop supports 80 balls:

| Family | Maximum/purpose |
|---|---|
| Canonical | 48 persistent journey droplets |
| Ambient | 12 site-wide slow droplets |
| Physics satellites | 14 pinch-off droplets |
| Hero cursor | lead + 2 trail droplets where active |
| Scene extras | probe/margin within the remaining budget |

The conductor enforces the total. A scene may not silently exceed the pack
budget. If a new extra needs capacity, prove its value and rebalance explicitly.

### 6.3 Ambient family

Ambient droplets are conductor-owned, not scene-owned background particles.
Scenes may scale their presence but not create another unrelated ambient
system. They reinforce one atmosphere across dead gaps and handoffs.

## 7. Scene and Conductor Contract

### 7.1 Current architecture

`PageStage` measures page geometry and feeds scene channels. The conductor
turns scene targets into one field driver. Current aggregate scenes:

- `site` — Hero, pour, Problem, Ecosystem, Services;
- `method`;
- `origin`;
- `contact`.

R5-D added the three chapter scenes — `work`, `studio`, `footer` — beside
them (droplet-only: they never claim the form slots). The remaining site
aggregate stays deliberately unsplit: its hero→services choreography is
signed off and byte-gated, and splitting it would risk the equivalence gates
for zero behavioral benefit.

### 7.2 Per-droplet output

Every scene target call writes:

```ts
{
  x: number;
  y: number;
  r: number;
  bind: number;    // 0 free physics → 1 exact legacy shadow
  cluster: number; // cohesion group, -1 for none
  z: number;       // 0 near → 1 far, consumed by R5-C
}
```

No field is optional. The conductor does not reset the scratch object.

### 7.3 Presence handoff

Each scene computes presence in [0,1]. The conductor normalizes active
presences and blends targets for the same droplet identities across explicit
overlap windows. When no scene is active, the last valid weights stay sticky so
the liquid can drain without snapping to zero.

### 7.4 Form-slot arbiter

The shader has two slots because a §3.3 bridge needs form A and form B. These
are not one slot per scene.

Rules:

- only one scene owns the slots;
- a non-holder claim is ignored while the holder renders;
- the holder must reach `fa + fb < EPS_FORM` before transfer;
- transfer occurs in a droplet-only state;
- violations increment diagnostics and fail the simulation harness.

This invariant prevents form-to-form crossfades at scene boundaries.

### 7.5 Score and energy

The conductor already merges optional scene values:

- light score: exposure product; veil/flash/vignette maximum;
- energy: scene activity plus scroll velocity;
- stats: current form holder, active count, violations.

These are CURRENT data surfaces. R5-C consumes energy for cadence/effects.
R5-D consumes score twice: exposure/key in the liquid grade, and
veil/vignette/flash on the `CinematicVeils` page layer. The conductor also
OWNS the flash: scenes only raise the raw channel; the first rising edge
latches for the page load and plays a fixed 70 ms attack + 310 ms decay
(≤400 ms total) with a ~900 ms exposure afterglow. `stats.flashes` counts
latches (≤1 by construction) and `?fcine=0` (`opts.cine=false`) keeps the
whole score neutral.

## 8. Fluid Physics v2 — CURRENT R5-B

### 8.1 State and integration

`lib/webgl/fluid-core.mjs` is DOM-free, deterministic, and Node-runnable. It
holds physics positions, legacy-shadow positions, velocities, clusters, and a
fixed satellite pool. It advances at fixed 8 ms substeps with an accumulator
and bounded frame delta.

### 8.2 Forces

- **Goal seek:** near-critically damped spring to scene targets. Stiffness
  derives from the same `TAUP` identity that made heavy droplets lag before.
- **Repulsion:** short-range soft-core separation based on combined radii.
- **Cohesion:** droplets with the same cluster ID pull toward their centroid.
- **Curl drift:** analytic divergence-free gyres create organic free motion.
- **Cursor field:** radial push, tangential vortex, and pointer-velocity drag
  across the page on fine pointers.
- **Pinch-off:** sufficiently strained, loosely bound droplets shed one or two
  inherited-velocity micro-droplets that shrink over a TTL.

Velocities, forces, distances, spawn rates, and pool sizes are clamped. Retuning
belongs in the exported `FLUID` table and requires diagnostics plus owner feel
review.

### 8.3 Bind compatibility

The core advances both a physical body and a byte-exact legacy-shadow body:

```text
environmental_forces *= (1 - bind)
output = mix(physics_body, legacy_shadow, bind)
```

Use:

- exact forms and §3.3 melts: bind 1;
- free pour/fracture/current/echo: bind 0;
- transitions: continuous intermediate bind.

Do not set everything to bind 0 to make it “more fluid.” That destroys exact
choreography. Do not set everything to bind 1 to stabilize it. That returns the
site to target chasing.

### 8.4 Rollback and parity

`?fphys=0` makes the conductor bypass `fluid-core` and use the original
per-droplet low-pass. Keep the bypass until R5-E. The conductor harness checks:

- bind=1 parity;
- settle behavior;
- finite state over long simulation;
- satellite budget;
- arbiter invariants.

## 9. Interaction

### 9.1 Hero machine

- order: mark → seven services → mark;
- dwell: about 9s; bridge: 1.4s;
- pause while off-screen and during pointer/focus interaction;
- Arrow Left/Right steps; Home returns to mark; End reaches Marketing;
- active service drives the indicator and restrained live announcement;
- touch keeps the form machine but disables fine-pointer goo.

### 9.2 Gooey cursor

The hero’s cursor is a field participant, not a canvas tilt:

- lead radius: `CURSOR_R = 0.046`;
- two smaller trailing droplets;
- frame-rate-corrected spring smoothing: `CURSOR_SMOOTH = 0.1`;
- mark influence scale: `CURSOR_INFLUENCE_MARK = 0.72`;
- bounded merge reach;
- radius eases to zero on detach within roughly 300 ms;
- disabled for touch and reduced motion.

The page-wide physics cursor is a different layer of interaction: it stirs free
droplets through forces. It must not distort bound exact forms or replace the
hero merge behavior.

### 9.3 Contact exhale

Contact submit dispatches one semantic exhale event to the contact scene. The
event provides visual feedback after valid submission; it is not form control
logic. Reduced-motion and static paths submit without requiring animation.

## 10. Rendering and Optics

### 10.1 Current renderer

`FieldStage` owns the WebGL2 context, SDF textures, uniform updates, field
draw, resize, context-loss recovery, tier resolution, and watchdog.

The current internal glass:

- rounded dome from distance;
- wrapped diffuse with a fixed upper-left key;
- tight wet specular;
- broad sheen;
- Fresnel rim;
- cyan-deep to cyan-glow internal range;
- no external glow halo in the base pass.

Lite renders flat brand cyan. Problem may use controlled desaturation through
`iMute` to communicate fragmentation.

### 10.2 Optics v2 — R5-C (current)

The chain (post-chain.ts + post-shaders.mjs, full tier only):

1. offscreen scene target, RGBA16F where supported and RGBA8 fallback;
2. half-resolution bright pass;
3. separable Gaussian blur ping-pong;
4. final opaque composite with selective bloom;
5. blue-noise dither;
6. luminance-gated grain at or below 2.5%;
7. depth bands and exposure/absorption controls.

Identity requirements:

- default new uniforms produce the current output;
- `?fgrade=0` bypasses post/grade and is readPixels-identical;
- deterministic rest harness bypasses time and risky effects;
- the locked key direction is modulated only by additive `iKeyBoost`;
- a light re-aim requires owner-approved re-baseline.

Depth contract:

- scene targets already emit `z ∈ [0,1]`;
- `iBallZ[80]` carries packed depth;
- `iDepthFx=0` is identity;
- far droplets become dimmer sub-surface material, not a new hue;
- depth cannot reduce legibility or make exact endpoints appear doubled.

### 10.3 Cinematic consumer — CURRENT R5-D

The field does not directly paint page-wide white/black veils. Scene light
scores feed `CinematicVeils` via CSS vars PageStage writes once per frame
(`--cine-veil` / `--cine-vig` / `--cine-flash`, wrap-scoped):

- black exposure veil — ONLY the two act-boundary fades (Método→Work,
  Origin→Studio), scroll-scrubbed `sin(π·bp)`, peak `VEIL_ACT = 0.4`
  (contrast-audited: standing reads are veil-free; every visible text node
  clears 3.5:1 under the transient peak);
- one cyan-white Origin flash — the conductor-latched envelope, rendered at
  ≈85% peak luminance inside the brand cyan family;
- vignette — a whisper (≤0.3) through Problem and the Soul act;
- mounted only on the live path: never under reduced motion, static tiers,
  deterministic QA holds, or `?fcine=0`; z-20 (above copy, below chrome).

The post chain handles liquid optics. Cinematic veils handle page exposure and
act boundaries. Keep those responsibilities separate.

## 11. Journey State Map

| Transition/chapter | Form use | Droplet behavior | Bind tendency | Physics/optics note |
|---|---|---|---|---|
| Assembly/Hero | exact mark and seven forms | §3.3 bridges + cursor extras | high for forms/bridge | exact material first |
| Pour | form drains | canonical droplets spill into page | high → low | scroll shear may stir |
| Problem/Fracture | no solid form at exit | seven coherent chunks separate | mostly low | muted, volumetric |
| Seek/Ecosystem | mark emerges | cohesion pulls fragments inward | low → high | first exposure rise |
| Services/Bloom | seven exact forms | scrubbed §3.3 bridges | high | no physics drift at endpoints |
| Método/Rehearse | exact mark only at Integration | probe, lattice, clusters, satellites | phase-specific | three masses use cohesion |
| Work/Current | no dominant form | Método's satellites become the gyre (i%3=0) + 5-droplet meniscus at the hovered card | low (0.12; meniscus 0.4) | CURRENT R5-D · z 0.55 sub-surface · act fade III |
| Origin/Fuse | exact mark at fusion | two clusters → mark → echo | low → high → low | flash external to field |
| Studio | no dominant form | origin echo survives as sparse orbits (i%6=0) | low (0.08) | CURRENT R5-D · z 0.6 · act fade IV |
| Contact/Gather | exact mark | all droplets gather; submit exhale | low → high → low | labeled submit remains canonical |
| Footer/Release | no form | the mark's lowest droplet detaches and sinks out (overshot targets vs contact's held 50% blend) | low | CURRENT R5-D · ends at true page bottom |

## 12. Performance, Tiers, and Fallbacks

### 12.1 Probe

`field-tier.ts` renders the actual field workload, forces completion, measures
median frame cost, and caches a session tier. GPU strings are not a proxy.
`?ftier=` overrides for QA only.

### 12.2 Tier behavior (current)

- full: glass, post chain, grade/depth, DPR up to 2;
- full-nofx: glass, no post chain (runtime watchdog rung — not persisted, a
  fresh session retries full; also the behavior when no offscreen color
  format renders);
- lite: flat cyan, DPR 1;
- half: flat cyan, DPR 0.5;
- none: initial no-WebGL/probe fallback, never a runtime freeze target;
- watchdog: full → full-nofx → lite → half after sustained slow frames; good
  frames pay down the slow counter; intentionally governed frames never count.

### 12.3 Energy governor (current)

A truly idle liquid draws at a ~30 Hz floor on any display refresh rate —
never zero. Entry requires SUSTAINED low conductor energy (scene activity,
scroll velocity, pointer velocity, live spray all near zero) AND no human
input for over a second; any input event or energy rise restores active
cadence within one vsync. Wall-clock dt integration keeps governed motion
identical in trajectory. `?fgov=0` disables the governor for QA.

### 12.4 Static/reduced motion

- exact mark in Hero and Contact;
- chapter-appropriate exact form/still where helpful;
- full semantic copy and DOM diagrams;
- no autocycle, cursor merge, scrub, flash, or exhale dependency;
- no blank reserved canvas area that harms reading;
- 404 may use a still fractured/lone-drop fallback.

### 12.5 Context loss

The renderer:

- prevents default loss handling;
- reveals the static fallback;
- rebuilds textures, buffers, framebuffers, and post resources on restore;
- resumes the current measured scene state, not the top of the page;
- never strands navigation or contact.

## 13. File Ownership

| File | Responsibility |
|---|---|
| `lib/webgl/symbols.ts` | ordered eight-state registry and runtime SVG URLs |
| `lib/webgl/symbols.data.mjs` | registered 48-droplet endpoint clouds |
| `lib/webgl/sdf-core.mjs` | deterministic EDT/blur |
| `lib/webgl/sdf.ts` | browser SVG rasterization/SDF build |
| `lib/webgl/sdf-gl.ts` | WebGL layer and SDF texture utilities |
| `lib/webgl/sdf-glass-shader.mjs` | unified field, exact glass, shared constants |
| `lib/webgl/field-drivers.ts` | §3.3 bridge, driver contract, 404 lone-drop driver |
| `lib/webgl/phys.mjs` | canonical identities, targets, physics tables, ambient family |
| `lib/webgl/fluid-core.mjs` | R5-B dynamics and satellite pool |
| `lib/webgl/conductor.mjs` | scene state, handoffs, arbiter, integration, score, energy |
| `lib/webgl/scenes/*.ts` | geometry-to-target choreography |
| `components/field/PageStage.tsx` | measurements, inputs, scene assembly, one canvas |
| `components/field/FieldStage.tsx` | WebGL resource lifecycle and draw loop |
| `components/hero/FieldMorphHero.tsx` | deterministic standalone hero QA path |
| `lib/webgl/post-chain.ts` | R5-C framebuffer pipeline (scene target, bloom, composite) |
| `lib/webgl/post-shaders.mjs` | R5-C bright/blur/composite shaders + POST dial-in |
| `components/field/CinematicVeils.tsx` | R5-D page-light layer (veil/vignette/flash via CSS vars) |

Retired architecture is not an alternate path. Do not create:

- `MetaballScene` raymarch;
- mesh metaball renderer;
- `states.ts` duplicate registry;
- `symbols-legacy`;
- `can-run-glass`;
- per-chapter homepage stage.

## 14. QA Contract

### 14.1 Deterministic controls

| Control | Contract |
|---|---|
| `?fstate=N` | freeze exact form state |
| `?fpair=a-b-m` | freeze bridge A → B at progress m |
| `?fcursor=x,y` | freeze cursor merge at coordinates |
| `?fcycle=1` | shorten hero dwell |
| `?fflat=1` | flat/debug output |
| `?ftier=full|lite|none` | tier override |
| `?feco=c` | ecosystem choreography progress |
| `?fphys=0` | legacy integrator bypass |
| `?fgrade=0` | exact optics bypass (no post, grade uniforms at 0 identity) |
| `?fgov=0` | idle-cadence governor bypass |
| `?fcine=0` | cinematic bypass (neutral score, no veils, flash cannot latch) |

### 14.2 Required harnesses

```bash
npm run forms:rest
npm run forms:melts
npm run forms:cursor
npm run chapters:sheet
npm run endpoints

node scripts/verify-conductor.mjs
node scripts/verify-canvas-count.mjs
node scripts/verify-perf.mjs
node scripts/verify-postfx.mjs
node scripts/verify-rest-exact.mjs
node scripts/verify-cinematics.mjs
node scripts/verify-devices.mjs
node scripts/verify-context-loss.mjs
node scripts/verify-a11y.mjs
SOAK_MIN=30 BASE_URL=http://localhost:3001 node scripts/verify-soak.mjs
node scripts/capture-transition-diagnostics.mjs
```

`verify-rest-exact.mjs` is the byte gate behind the exact-rest stop-the-line
rule: it hides animated overlays, polls each `?fstate` still until two
consecutive element screenshots are byte-equal (the settled frame), and
compares SHA-256 against `scripts/rest-exact.json`. `forms:rest` remains the
human fidelity sheet; it is not run-reproducible (the breath overlay pulses
above the canvas) and must not be hash-compared. The diagnostics ranges now
cover the full page (`work-current`, `studio-echoes`,
`contact-gather-release` beside the six originals), and
`verify-cinematics.mjs` is the R5-D machine gate: one flash per page load
(held across a second traversal; zero under reduced motion and `?fcine=0`),
exactly two act-fade bands on their seams with full release at reading
rests, living liquid over Work/Studio/the release, meniscus wiring, and the
transient contrast floor. `verify-postfx.mjs` runs its URLs with `fcine=0`
so the optics chain stays measured in isolation against its pre-C baseline.

The R5-E hardening gates: `verify-devices.mjs` is the emulated device matrix
(iPhone-class live + static story, Android-class lite-MUST-be-live, the
full-nofx rung, no horizontal overflow, sticky stage == 100svh == layout
viewport); `verify-context-loss.mjs` drills §12.5 (the draw loop parks on a
lost context — no zombie GL — and a restore rebuilds the stage and resumes
the mid-page scene state); `verify-soak.mjs` measures the battery posture
against a production build (the governor owns true idle, the watchdog never
demotes a calm page, draws never stall, the heap stays flat);
`verify-a11y.mjs` is the semantic/keyboard/contrast/locale floor. Emulation
is the regression floor, not the sign-off — iOS URL-bar collapse, real GPU
probes, and thermal behavior are validated on owner hardware.

### 14.3 Stop-the-line rules

- Any exact rest delta after a supposedly identity change: stop.
- Any form-arbiter violation: stop.
- More than one homepage liquid canvas: stop.
- Any NaN/Infinity or runaway velocity in long simulation: stop.
- A frozen watchdog fallback where WebGL remains viable: stop.
- Melt landing changes at bind=1: stop.
- R5-C bypass differs from pre-C pixels: stop.
- Origin flash repeats or appears under reduced motion: stop.

## 15. Visual Iteration Protocol

Machine gates prove invariants; they do not prove taste.

Budget 3–6 owner review rounds on real hardware for:

- exact material, morph pacing, and cursor merge;
- Problem fracture readability;
- Ecosystem seek and convergence weight;
- physics feel in free pours/currents;
- R5-C bloom, absorption, depth, dither, and grain;
- Origin fusion/flash/afterglow;
- Contact gather/exhale and Footer release.

Tune constants in the existing system first. A new engine, new field family, or
new color language is not a tuning solution.

## 16. Whole-System Acceptance

The liquid system is complete when:

- exact mark and seven forms pass deterministic comparison;
- every form transition is one continuous in-field bridge;
- the same 48 identities traverse all five acts;
- scene handoffs are invisible and arbiter-safe;
- physics makes free liquid alive while bound choreography remains exact;
- pointer, touch, keyboard, reduced-motion, no-WebGL, and context-loss paths
  remain coherent;
- R5-C adds depth without moving the baseline or dropping below performance
  gates;
- R5-D uses one safe flash and motivated light changes;
- full, full-nofx, lite, half, and static behavior communicate one brand;
- all review captures and owner taste checkpoints are complete.

*The liquid is the proof: what was dispersed becomes one connected organism.*
