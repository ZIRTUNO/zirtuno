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

| State | Key          | Meaning                         | Runtime endpoint                     |
| ----- | ------------ | ------------------------------- | ------------------------------------ |
| 0     | `mark`       | Zirtuno mark                    | `public/brand/zirtuno-logo-mark.svg` |
| 1     | `web`        | Web Design & Digital Experience | `public/brand/forms/web.svg`         |
| 2     | `software`   | Software & App Development      | `public/brand/forms/software.svg`    |
| 3     | `ai`         | Artificial Intelligence         | `public/brand/forms/ai.svg`          |
| 4     | `automation` | Automation & Integrations       | `public/brand/forms/automation.svg`  |
| 5     | `data`       | Data & Dashboards               | `public/brand/forms/data.svg`        |
| 6     | `branding`   | Branding & Positioning          | `public/brand/forms/branding.svg`    |
| 7     | `marketing`  | Marketing & Growth              | `public/brand/forms/marketing.svg`   |

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

- rest warp: `SDF_WARP_REST = 0.0082`;
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
2. relax it toward a **continuous** displacement field (§5.6);
3. cache the permutation for the session;
4. keep droplet identity stable for every repeated A → B transition.

Droplets never pop in or out. Radius may continuously shrink to zero at bridge
edges, but identity and arrays remain stable.

### 5.2 Timing and shape

Locked constants:

- duration: `DURATIONS.morph = 1400 ms`;
- transport easing: `flow = calm = cubic-bezier(0.65,0,0.35,1)`;
- radius lead: `RADIUS_LEAD = 1.18`;
- form/droplet handoff window: `BRIDGE = 0.38`;
- transport schedule: `WIN_SPAN 0.76`, `WIN_MIN 0.72`, `WIN_POW 0.5`,
  `WAVE 0.7`, `MASS_LAG 0.18`, `WAVE_JITTER 0.07`.

Transport must be IN PHASE with the cloud's own visibility. Position rode
`arrive` (a hard ease-out) until it was measured against `bridgePresence` and
found to be in anti-phase: 67% of every journey completed by p = 0.2, while the
cloud was still under 27% present, leaving 8% of the motion for the half of the
timeline the droplets actually carry alone. Every melt therefore played as
appear → hold still → snap. `flow` is the symmetric in-out, so peak speed now
lands at mid-melt where presence is 1. This also brings the droplets over
`SHAPE_SPEED_MIN` while they are on screen, so §11's velocity-aligned
deformation engages during the melt instead of before it.

Each droplet then gets its own window `[start, start + win]` instead of one
shared stagger: `win` scales mildly with travel, and `start` is a wave sweeping
along that melt's own net transport direction — so the seven melts no longer
share a single left→right wipe, and the leading edge reaches before the body
follows. `start ≥ 0` and `start + win ≤ 1` hold by construction, which is what
keeps both endpoints exact for any tuning of the constants above.

Radius arrives about 18% ahead of position so features bud, neck, and fuse
instead of sliding as rigid discs.

`STAGGER = 0.25` is retained as an export for the legacy left→right key but no
longer drives the schedule; it survives only as the degenerate-case fallback
when two forms sit on top of each other and the transport axis is meaningless.

### 5.6 Correspondence continuity

Min-travel alone is a shuffle, not a deformation. It minimises total distance
and says nothing about whether NEIGHBOURS agree, so it routinely sends two
droplets on the same lobe to targets pointing in opposite directions. Measured
across the seven melts, the roughness of the displacement field — each
droplet's displacement against the mean of its own neighbourhood, over the mean
displacement — was 0.94, and the rendered cloud's velocity coherence was the
same number, 1.04. That is a ceiling: a liquid deformation is a continuous map,
and no easing, stagger or flow field can recover a property the correspondence
never had.

`matchClouds` therefore keeps the greedy result as a seed and relaxes it by
2-opt swaps against

```text
E = Σ |D_i|² + W · Σ_edges |D_i − D_j|²
```

on a symmetric k-nearest graph over the source cloud (`SMOOTH_K = 4`,
`SMOOTH_W = 2.4`, ≤ 24 passes). Deterministic iteration order, so §5.1's
stability guarantee is unchanged. Measured: map roughness 0.94 → 0.53, velocity
coherence 1.04 → 0.84, trajectory crossings 20 → 13. It costs travel and buys
continuity.

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
- scatter and cluster target vocabulary;
- a 12-droplet ambient family.

`lib/webgl/gathering.mjs` owns THE GATHERING (the S3 remake): the three
system lobes, the ten capability anchors, the per-capability `{d, w}` timings
and depth curve on the single `gather` clock, the closing fuse,
the loop-closure pulse, the bead allocation for droplets `i < 40` (10 docks ·
12 artery supply · 18 ring circulation), and the BFS response graph. The
canvas beads, the SVG veins, and the DOM labels all evaluate these same
functions — the liquid and the drawing cannot drift apart.

Droplet `i` is the same conceptual droplet in Hero, Problem, Ecosystem,
Services, Método, Work, Origin, Studio, Contact, and Footer. Scene handoffs
blend the target of that identity; they do not replace the array.

### 6.2 Packed budget

The shader loop supports 80 balls:

| Family             | Maximum/purpose                          |
| ------------------ | ---------------------------------------- |
| Canonical          | 48 persistent journey droplets           |
| Ambient            | 12 site-wide slow droplets               |
| Physics satellites | 14 pinch-off droplets                    |
| Hero cursor        | lead + 2 trail droplets where active     |
| Scene extras       | probe/margin within the remaining budget |

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
  bind: number; // 0 free physics → 1 exact legacy shadow
  cluster: number; // cohesion group, -1 for none
  z: number; // 0 near → 1 far, consumed by R5-C
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

- light score: exposure product; veil/vignette maximum;
- energy: scene activity plus scroll velocity;
- stats: current form holder, active count, violations.

These are CURRENT data surfaces. R5-C consumes energy for cadence/effects.
R5-D consumes score twice: exposure/key in the liquid grade, and veil/vignette
on the `CinematicVeils` page layer. Origin fusion has no flash channel or
full-page flash surface; its restrained afterglow is the scene-scored material
exposure/key lift. `?fcine=0` (`opts.cine=false`) keeps the whole score neutral.

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
- **Cursor field:** a volume-conserving displacement well — an outward lobe at
  q≈0.30 and a return lobe at q≈0.70 whose area-weighted integrals cancel —
  plus a velocity-signed wake and pointer-velocity drag. The whole field gains
  while the pointer is held down.
- **Strike:** a click or tap injects a travelling pressure ring: a crest that
  pushes outward, a trough behind it that pulls back into the cavity, a finite
  propagation speed, per-body arrival jitter and angular lobing so it never
  reads as a ring, geometric plus temporal decay, and a crown of spray thrown
  from liquid within `SHOCK_CROWN_R` of the impact.
- **Pinch-off:** sufficiently strained, loosely bound droplets shed one or two
  inherited-velocity micro-droplets that shrink over a TTL.
- **Mass response:** interaction forces divide by an area-derived mass, clamped
  either side, so small beads spray and heavy bodies shrug. Goal-seek,
  repulsion, cohesion, curl and scroll are unchanged.
- **Form displacement:** the hand and the strikes also reach the FORMS, as a
  displacement of the SDF sample domain rather than a force. A droplet
  integrates a force through a spring; a form is a static SDF with no velocity
  state, so it answers with that spring's equilibrium — the same spatial
  profile, taken as a displacement. See §10.4.

The interaction forces have ONE definition — `cursorAccel` and `shockAccel` —
reached from three places: the canonical 48 inside the substep loop, the
satellite pool, and, through the exported `probe()`, the conductor's analytic
ambient family, which gains a small damped displacement body around each anchor
rather than a change to its lava-lamp path. A second copy of what the hand does
to liquid is the failure mode that arrangement exists to prevent.

Absolute `performance.now()` timestamps in this core are Float64. A Float32
mantissa is exact only to ~16.7e6 ms, and rounding a double to the nearest float
can round UP — so `now − stored` came out slightly NEGATIVE on the same frame a
value was written. That is not a long-session hazard but an every-frame one, and
it is what swallowed the first strike's crown before the type changed.

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

**The one interaction exception.** Bound droplets take the FORM's displacement
at render time, scaled by `bind`, applied when the conductor packs the ball
buffer and nowhere else. Without it a morph is dead to the pointer: mid-melt the
stage is nothing but bound droplets, so switching every environmental force off
switched off the whole picture — and those droplets share one iso-surface with
form halves that were already being displaced at draw time, so leaving them
behind also pulled the one liquid apart. Scaling by `bind` keeps the total
response continuous across the blend, since free liquid already answers through
the physics and receives nothing here.

What it must never do is touch the choreography underneath, and
`verify-conductor.mjs` asserts all three parts of that:

- with nothing touching, bind = 1 is byte-identical to the legacy trajectory;
- under a hand and a strike it moves, but only within the form-displacement
  envelope — anything past that means a force has leaked into the body;
- once the hand leaves and the waves expire it is byte-identical again, which
  is what proves the offset never reached `P`, `XP` or `XL`.

### 8.4 Rollback and parity

`?fphys=0` makes the conductor bypass `fluid-core` and use the original
per-droplet low-pass. Keep the bypass until R5-E. The conductor harness checks:

- bind=1 parity;
- settle behavior;
- finite state over long simulation;
- satellite budget;
- arbiter invariants.

`?fstrike=0` removes the click — the strike wave, its crown and the press gain
— and keeps hover physics. `?fphys=0` removes both. The conductor drains its
strike queue on its own clock whether or not a core is listening, so the queue
cannot fill once and then swallow every later click.

Physics-v3 is now the DEFAULT material behaviour; `?fphysv3=0` is its rollback.
Its area-weighted response, local viscosity/attraction, and bounded
cluster-footprint correction still obey the same bind contract — the conductor
harness asserts bind=1 parity against the legacy trajectory *while a scroll body
force is applied*, since scroll is the newest force able to break it. Cached
typography avoidance is likewise on by default (`?fobstacles=0` rolls back), at
most twelve field-space reading bounds, and only free droplets respond. Exact
forms, §3.3 melts, and `?fphys=0` remain unchanged.

Scroll is coupled into `fluid-core` as a body force (`SCROLL_LEAN`,
`SCROLL_SHEAR`, `SCROLL_STIR`). Previously the conductor damped a scroll
velocity and handed it to the core, which never read it: scroll reached the
ambient beads and the cadence governor only. The goal-seek spring does lag
whenever a scene MOVES its targets, but most of the page holds its targets still
in viewport space, so between authored transitions scrolling produced no liquid
response at all. All three terms scale by (1 − bind).

The ambient curl amplitude is a FORCE competing with that spring, so what
matters is its ratio to ω² (= 48…400 from `OMEGA_K / TAUP`), not its own size.
At the original `CURL_V = 0.016` the resulting wander was 0.0035 uv on the
heaviest droplet and 0.0004 on the lightest — sub-pixel at any real canvas size,
which is why the liquid read as dead between transitions and why small increases
changed nothing.

Velocity-aligned deformation is the default renderer for glass tiers;
`?fshape=0` is its rollback. It compiles a separate shader variant, derives a
filtered velocity direction from the already packed droplet state, and preserves
projected area while stretching. Stable canonical ids — not packed slot
positions — own velocity history.

Two guards changed when it was promoted:

- It is no longer fenced to droplet-only frames. The shape branch rewrites the
  BALL metric only; every form silhouette comes from `formOnlyField()`, which it
  never touches, so a form cannot be disturbed by it. What keeps a resting stage
  exact is physical rather than administrative — stretch is gated on
  `SHAPE_SPEED_MIN`, and liquid at rest is below it. A §3.3 bridge's travelling
  droplets therefore deform while its endpoints stay put.
- It follows the GLASS, not the post chain. The first watchdog rung
  (full → full-nofx) sheds bloom/dither/grain and keeps the material; gating
  stretch on `full` made liquid revert to rigid discs the moment a machine
  dropped one rung. It now dies at lite/half, where the shader is flat cyan.

Because the variant costs ~40 extra uniform vectors on top of `iBalls` and
`iBallZ` — close to WebGL2's guaranteed 224 — `makeLayer` takes a PREFERENCE
LIST and asks the driver the real question by linking the real shader, falling
back to the plain field if it refuses. A refusal costs deformation, never the
canvas. Predicting this from `MAX_FRAGMENT_UNIFORM_VECTORS` would be the same
class of proxy the tier probe deliberately rejects.

`iStrain` carries the deformation OPTICS: anisotropic specular along the flow
axis, a brightened leading edge, reduced absorption where volume-preserving
stretch thins the body, and flow-advected internal striations. Every term is
exact identity at `iStrain = 0`, and the field-weighted velocity average is
diluted to zero by forms (which carry none), so solid liquid keeps the locked
material without a second guard. The plain shader source is byte-identical to
its pre-deformation form, which is what keeps `verify-rest-exact` sound:
`FieldMorphHero` — the only renderer that gate uses — compiles that source, at
`warp = 0`, and touches neither `fluid-core` nor the conductor.

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

### 9.4 The strike

A click or tap anywhere on the page starts one travelling wave. The whole
viewport is the one liquid, so there is no interactive region to be inside of.

- registered in field uv on `pointerdown`, queued, and applied on the
  conductor's next frame — the DOM clock and the render clock never have to
  agree;
- strength scales with pointer speed at the moment of contact;
- every listener is passive and none calls `preventDefault`: links, buttons,
  form fields, text selection and scrolling behave exactly as they did before;
- a held pointer is a PRESS — a damped gain on the whole cursor field, which is
  also what gives coarse pointers the drag-stir a mouse gets from hover;
- repeats inside `SHOCK_MERGE_MS` / `SHOCK_MERGE_R` deepen the live wave
  instead of starting a second front a few ms behind it; beyond that window,
  amplitude divides by a decaying strike load, so an agitated surface absorbs a
  blow the way a real one does;
- absent under reduced motion, on static tiers, and on `?fstrike=0`.

Spray must come from a body of liquid and never from empty space: a click on
bare page still sends the front outward, but throws nothing.

The forms are struck too — §10.4 — so a wave crossing a resting mark ripples it
on the way past, and so are the BOUND droplets beside them, which is what keeps
a morph from going dead under the hand. See §8.3.

## 10. Rendering and Optics

### 10.1 Current renderer

`FieldStage` owns the WebGL2 context, SDF textures, uniform updates, field
draw, resize, context-loss recovery, tier resolution, and watchdog.

The default material is clean brand cyan:

- `#00E3FE` is the colour anchor rather than one endpoint of a deep-to-glow
  range;
- one broad page-space key wash lets separated masses share the same light;
- the recovered May 30 soft-dome technique samples the unified field several
  texels apart before deriving its shallow normal, keeping the shadow smooth
  across field noise and droplet boundaries;
- no wet specular, broad sheen, Fresnel rim, or centre-weighted absorption;
- depth remains a lightweight motion cue, not a map of individual droplets;
- no external glow halo in the base pass.

`iGloss=1` / `?fgloss=1` restores the complete signed-off wet glass material
(rounded dome, wrapped diffuse, specular, sheen, Fresnel rim, cyan-deep to
cyan-glow range, and original absorption/depth strength) for owner comparison.
At `iGloss=0`, none of that shape-revealing stack leaks into the clean material.

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
7. depth bands, exposure/absorption controls, and the field-native volume
   shadow.

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

Dynamic shadow contract:

- `iShadow=0` is exact identity; `?fgrade=0` forces it to 0 and
  `?fshadow=0` isolates only this layer for A/B review;
- soft ambient occlusion follows pseudo-distance thickness and the locked key;
- intersection shadow comes from contributor concentration in the existing
  main field loop, so merges and splits respond without extra field samples;
- near/far contributor variance deepens layered intersections, while the
  velocity build adds a bounded trailing shadow that dissolves as motion rests;
- the result only multiplies luminance inside the cyan material. It cannot add
  a halo, a drop shadow, a new hue, or a second renderer.

### 10.3 Cinematic consumer — CURRENT R5-D

The field does not directly paint page-wide white/black veils. Scene light
scores feed `CinematicVeils` via CSS vars PageStage writes once per frame
(`--cine-veil` / `--cine-vig`, wrap-scoped):

- black exposure veil — ONLY the two act-boundary fades (Método→Work,
  Origin→Studio), scroll-scrubbed `sin(π·bp)`, peak `VEIL_ACT = 0.4`
  (contrast-audited: standing reads are veil-free; every visible text node
  clears 3.5:1 under the transient peak);
- vignette — a whisper (≤0.3) through Problem and the Soul act;
- no full-page white/cyan-white Origin flash surface or score channel;
- mounted only on the live path: never under reduced motion, static tiers,
  deterministic QA holds, or `?fcine=0`; z-20 (above copy, below chrome).

The post chain handles liquid optics. Cinematic veils handle page exposure and
act boundaries. Keep those responsibilities separate.

### 10.4 Forms answering the pointer

The eight owner-traced forms render from SDF textures. Nothing in `fluid-core`
could reach them, so until now the largest liquid on the page was the only part
of it that ignored a hand.

They answer through `formTouch()` in the fragment shader, which displaces the
SDF SAMPLE DOMAIN inside `formOnlyField()`:

```glsl
vec2 tw = formTouch(uv);          // displacement, field uv
if (tw != vec2(0.0)) fuv -= tw / fs;
```

Displacing the domain moves the surface with its normals intact, so the bulge
lights itself — there is no separate shading term, and the four gradient taps
pick it up for free because they run through the same function. Divided by
`iFormScale` because the displacement is authored in field uv while `fuv` is
form-local.

The split between CPU and shader is deliberate. Everything time-dependent — how
far each front has travelled, how much amplitude is left — is resolved in
`fluid-core.formUniforms()` against the same wave state the droplets read, and
arrives as `iTouch` (pointer xy, radius, gain) and `iShock[SDF_FORM_SHOCKS]`
(centre xy, front radius, amplitude). The shader evaluates only a spatial
profile, and the profile's constants are INJECTED into the GLSL source from the
`FLUID` table, so a physics retune cannot move the droplets and leave the forms
answering the old law. A spent slot carries amplitude 0, the shader's
exact-identity case.

Two naturality notes. The hand is the same displacement well the droplets feel,
so a form dents under the pointer and piles up at the rim rather than merely
retreating; `FORM_TOUCH` / `FORM_SHOCK` are smaller than the droplet response
because a form is a large body of liquid and a droplet is a bead. And a
continuous surface has no equivalent of the per-droplet arrival jitter that
keeps a strike from reading as a ring, so the form breaks its own circle with
angular harmonics seeded from the strike's position.

This is a SEPARATE COMPILE VARIANT. `makeGlassFrag(withShape, withTouch)`
produces four sources and `FieldStage` passes them to `makeLayer` as a
preference list, most capable first, so a driver that refuses the widest uniform
block still gets whichever half it can afford — and a refusal costs an
interaction, never the canvas. Keeping it out of `SDF_GLASS_FRAG` is what lets
the exact-rest contract stay a claim about UNCHANGED CODE: the source the
deterministic rest stills compile contains no `iTouch`, no `iShock` and no
`formTouch` at all, which `verify-strike.mjs` §0 asserts rather than assumes.

`fluid-core.formDisplace()` evaluates the same displacement at a single point
on the CPU, reading the very `touchU`/`shockU` arrays that were uploaded — so
the amplitudes are computed exactly once and the two evaluators cannot disagree
about how far along a wave is. Only the profile SHAPE is written twice, once per
language, and both take their constants from `FLUID`. (GLSL `fract()` is
`x - floor(x)`, which is not JS's `%` for negatives; the strike's angular seed
has to match or the form and the droplets beside it would finger in different
directions.) Its consumer is the bound liquid of §8.3.

The effect is gated per frame on the live watchdog rung (the same
`DEFORM_RUNGS` set deformation uses) and on reduced motion, and the stage
uploads zeroed arrays rather than skipping the upload — a stale `iTouch` would
leave a dent parked in the form after the pointer had gone.

`?fformtouch=0` is the rollback: the droplets keep answering the hand and the
forms stop. It is not `?fstrike=0`, which removes the click everywhere and
reaches the forms for free, since no shocks are ever registered.

## 11. Journey State Map

| Transition/chapter | Form use                       | Droplet behavior                                                                                | Bind tendency            | Physics/optics note                              |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------ |
| Assembly/Hero      | exact mark and seven forms     | §3.3 bridges + cursor extras                                                                    | high for forms/bridge    | exact material first                             |
| Pour               | form drains                    | canonical droplets spill into page                                                              | high → low               | scroll shear may stir                            |
| Problem/Fracture   | no solid form at exit          | seven coherent chunks separate                                                                  | mostly low               | muted, volumetric                                |
| Gathering/Ecosystem | mark emerges at the fuse      | ten capability masses come forward out of depth (z 1 → 0) on their own schedules, arrive in three system lobes, then fuse into the mark; nothing is drawn between them | low → high | first exposure rise · labels share gathering.mjs anchors · hover pulses the system first |
| Services/Bloom     | seven exact forms              | scrubbed §3.3 bridges                                                                           | high                     | no physics drift at endpoints                    |
| Método/Rehearse    | exact mark only at Integration | probe, lattice, clusters, satellites                                                            | phase-specific           | three masses use cohesion                        |
| Work/Current       | no dominant form               | Método's satellites become the gyre (i%3=0) + 5-droplet meniscus at the hovered card            | low (0.12; meniscus 0.4) | CURRENT R5-D · z 0.55 sub-surface · act fade III |
| Origin/Fuse        | exact mark at fusion           | two clusters → mark → echo                                                                      | low → high → low         | continuous material afterglow                    |
| Studio             | no dominant form               | origin echo survives as sparse orbits (i%6=0)                                                   | low (0.08)               | CURRENT R5-D · z 0.6 · act fade IV               |
| Contact/Gather     | exact mark                     | all droplets gather; submit exhale                                                              | low → high → low         | labeled submit remains canonical                 |
| Footer/Release     | no form                        | the mark's lowest droplet detaches and sinks out (overshot targets vs contact's held 50% blend) | low                      | CURRENT R5-D · ends at true page bottom          |

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

| File                                  | Responsibility                                                |
| ------------------------------------- | ------------------------------------------------------------- |
| `lib/webgl/symbols.ts`                | ordered eight-state registry and runtime SVG URLs             |
| `lib/webgl/symbols.data.mjs`          | registered 48-droplet endpoint clouds                         |
| `lib/webgl/sdf-core.mjs`              | deterministic EDT/blur                                        |
| `lib/webgl/sdf.ts`                    | browser SVG rasterization/SDF build                           |
| `lib/webgl/sdf-gl.ts`                 | WebGL layer and SDF texture utilities                         |
| `lib/webgl/sdf-glass-shader.mjs`      | unified field, exact glass, shared constants                  |
| `lib/webgl/field-drivers.ts`          | §3.3 bridge, driver contract, 404 lone-drop driver            |
| `lib/webgl/phys.mjs`                  | canonical identities, targets, physics tables, ambient family |
| `lib/webgl/fluid-core.mjs`            | R5-B dynamics and satellite pool                              |
| `lib/webgl/conductor.mjs`             | scene state, handoffs, arbiter, integration, score, energy    |
| `lib/webgl/scenes/*.ts`               | geometry-to-target choreography                               |
| `components/field/PageStage.tsx`      | measurements, inputs, scene assembly, one canvas              |
| `components/field/FieldStage.tsx`     | WebGL resource lifecycle and draw loop                        |
| `components/hero/FieldMorphHero.tsx`  | deterministic standalone hero QA path                         |
| `lib/webgl/post-chain.ts`             | R5-C framebuffer pipeline (scene target, bloom, composite)    |
| `lib/webgl/post-shaders.mjs`          | R5-C bright/blur/composite shaders + POST dial-in             |
| `components/field/CinematicVeils.tsx` | R5-D page-light layer (veil/vignette via CSS vars)            |

Retired architecture is not an alternate path. Do not create:

- `MetaballScene` raymarch;
- mesh metaball renderer;
- `states.ts` duplicate registry;
- `symbols-legacy`;
- `can-run-glass`;
- per-chapter homepage stage.

## 14. QA Contract

### 14.1 Deterministic controls

| Control                   | Contract                                                       |
| ------------------------- | -------------------------------------------------------------- |
| `?fstate=N`               | freeze exact form state                                        |
| `?fpair=a-b-m`            | freeze bridge A → B at progress m                              |
| `?fcursor=x,y`            | freeze cursor merge at coordinates                             |
| `?fcycle=1`               | shorten hero dwell                                             |
| `?fflat=1`                | flat/debug output                                              |
| `?ftier=full\|lite\|none` | tier override                                                  |
| `?feco=c`                 | ecosystem choreography progress                                |
| `?fphys=0`                | legacy integrator bypass                                       |
| `?fphysv3=0`              | roll back area/viscosity/footprint physics (default ON)        |
| `?fobstacles=0`           | roll back cached typography/form flow (default ON)             |
| `?fglass=0`               | drop the glass MATERIAL to the flat branch (default ON)        |
| `?fstrain=1`              | restore deformation-responsive optics (default OFF)            |
| `?fshape=0`               | roll back velocity-aligned deformation + optics (default ON)   |
| `?fgrade=0`               | exact optics bypass (no post, grade uniforms at 0 identity)    |
| `?fshadow=0`              | isolate dynamic volume-shadow rollback; the rest of grade stays |
| `?fgov=0`                 | idle-cadence governor bypass                                   |
| `?fcine=0`                | cinematic bypass (neutral score, no veils)                    |

### 14.2 Required harnesses

```bash
npm run forms:rest
npm run forms:melts
npm run forms:cursor
npm run chapters:sheet
npm run endpoints

node scripts/verify-conductor.mjs
node scripts/verify-strike.mjs
node scripts/verify-canvas-count.mjs
node scripts/verify-perf.mjs
node scripts/verify-postfx.mjs
node scripts/verify-rest-exact.mjs
node scripts/verify-cinematics.mjs
node scripts/verify-ecosystem.mjs
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
`verify-cinematics.mjs` is the R5-D machine gate: no Origin flash surface or
score channel, exactly two act-fade bands on their seams with full release at
reading rests, living liquid over Work/Studio/the release, meniscus wiring, and
the transient contrast floor. `verify-postfx.mjs` runs its URLs with `fcine=0`
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

`verify-ecosystem.mjs` is THE GATHERING's gate (the S3 remake): the gathered
body (ten capability names and three system markers visible, clear of the
chapter-index rail, and clear OF EACH OTHER — type riding moving liquid
collides in ways a static layout never does, so overlap is a machine check),
the three beats (only the first system has landed a third of the way in; the
body keeps accumulating through the middle), the system response (hover AND
keyboard raise `data-pulse`, the pulse reaches the touched capability's own
system before the rest of the body, the `hov` channel swells its mass, the HUD
reads index · name · system · capability), release on leave, and the reduced-
motion story (no live gathering; the eco-stack carries all ten capabilities).

`verify-strike.mjs` is the click gate's browser half. The conductor harness
proves the FORCE against the pure core (it travels, it is not a ring, the crown
has provenance, a mash saturates, bind=1 stays byte-exact, `?fstrike=0` rolls
back); this proves the WIRING that harness cannot see — a real pointer event
reaching the conductor, the liquid answering it, the press toggling, the field
settling afterwards, the click staying passive under a real control, and no
strike or press wiring at all under reduced motion.

It reads the GL BALL BUFFER, not pixels: an init script maps uniform locations
to names and snapshots `iBalls` / `iBallCount` on each `drawArrays`, so every
droplet's position is exact and per-frame. Screenshots cannot measure this — the
surface never stops moving, so two captures of the same build differ by ~1% of
pixels, the same order as the effect. Against the buffer the live page reports a
peak displacement of 0.045 uv where the node sim predicts 0.045, run to run,
which is what makes tight thresholds possible at all. Scroll is driven with
`page.mouse.wheel` because Lenis owns it and `scrollTo` injects its own jitter.
It also walks the whole Services morph asserting NO DEAD BAND — no scroll
position where liquid is on stage and a click does nothing, which is the
regression bound droplets were introduced to close (§8.3). That walk measures on
the ball buffer too: through a scroll-driven morph the COMPOSITION is moving, so
a pixel baseline is swamped by the choreography itself.

The viewport is deliberately small: a full-size field on a software rasteriser
trips the FPS watchdog, which would disable the code under test and then report
a pass.

`verify-boundaries.mjs` is the seam gate for acts II–III: no DEAD BAND (a
scroll position with neither droplets nor form on stage) and no centre-of-mass
teleport across the Problem→Ecosystem, Ecosystem→Services and Services→Método
handoffs. Mass counts droplets OR form weight — the two form slots render from
SDF textures and never appear in the ball buffer, so a droplet-only measure
reports an empty stage during exactly the passages a solid form is carrying.

### 14.3 Stop-the-line rules

- Any exact rest delta after a supposedly identity change: stop.
- Any form-arbiter violation: stop.
- More than one homepage liquid canvas: stop.
- Any NaN/Infinity or runaway velocity in long simulation: stop.
- A frozen watchdog fallback where WebGL remains viable: stop.
- Melt landing changes at bind=1: stop.
- R5-C bypass differs from pre-C pixels: stop.
- Any Origin flash surface or score channel reappears: stop.

## 15. Visual Iteration Protocol

Machine gates prove invariants; they do not prove taste.

Budget 3–6 owner review rounds on real hardware for:

- exact material, morph pacing, and cursor merge;
- Problem fracture readability;
- Ecosystem seek and convergence weight;
- physics feel in free pours/currents;
- R5-C bloom, absorption, dynamic volume shadow, depth, dither, and grain;
- Origin fusion/flash-free afterglow;
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
- R5-D keeps Origin flash-free and uses motivated light changes;
- full, full-nofx, lite, half, and static behavior communicate one brand;
- all review captures and owner taste checkpoints are complete.

_The liquid is the proof: what was dispersed becomes one connected organism._
