# S7 — Force finds direction

Implemented 2026-09-05. This replaces the two idea-clouds, the page-wide dawn,
and the separate particle wordmark. Owner taste review on real hardware remains
the signature checkpoint in AGENTS.md §10.

## The experience

Zéfiro is the force; Ventura is the direction. They act on the same substance.
The opening introduces that argument in authored PT/EN, then the liquid already
travelling through Work spreads across the Origin field. Three irregular seed
bodies establish a centre without a disk, orbit, star field or drawn force lines.

| Beat | Scroll interval | Liquid | Typography |
| --- | --- | --- | --- |
| Force | 0–.18 | Broad, independently moving catchments | Oversized Zéfiro at the left; its meaning balances the opposite side |
| Direction | .18–.36 | The pressure basin strengthens; opposing shear and curl interrupt straight inward travel | Ventura anchors the right; the supporting sentence holds the left |
| Convergence | .36–.56 | Catchments tighten into three uneven tributaries and the mark's footprint | Two large poetic clauses reveal from opposite directions |
| Identity | .56–.76 | The owner-traced SDF resolves; a sparse outer population stays alive | Zirtuno opens outward from its centre; fusion and founding pillars share a quieter baseline |
| Continuation | .76–1 | The mark moves left on wide stages, erodes, and releases the same bodies toward Studio | A large purpose statement takes the right column; portrait layouts stack it below the liquid |

The manifesto follows in document flow. Origin's presence begins across the
opening and extends beyond the runway; the conductor blends the surviving
population into Studio's existing echo. There is no drain-to-black interlude,
second wordmark engine, sound, or full-page flash.

The five beats share one 700svh runway and one sticky viewport. Type is stationary
inside animated crops. The label, name, gloss and explanation arrive at distinct
points of the same GSAP score. The two tension clauses crop inward from opposed
sides; the identity crops outward from its centre. Their containing beat carries
the common upward exit. No opacity animation, layout-moving tracking animation,
blur reveal, or independent text clock is involved.

Desktop compositions use the site's shell gutters on both sides and reserve the
rail. Portrait composition mirrors the name alignment and stacks the detail;
the convergence clauses keep their opposing alignment. On viewports shorter
than 600px, the entire reading sequence is in normal flow. The liquid remains
live. Static tiers, reduced motion and no-JS expose the complete semantic story
and an SVG mark. All shipped text remains in the two locale JSON files.

## Ownership and mechanics

- `lib/animation/origin-score.ts` owns the paused GSAP timeline, labels and
  progression channels. PageStage samples it using its existing geometry read;
  introducing another ScrollTrigger scroll reader would duplicate ownership.
  The score writes force, capture, sealing, release and focus controls as well
  as `--origin-p` for the type crops.
- `lib/webgl/origin-field.mjs` owns precomputed identity data, composition and
  the finite pressure law. Its 512-entry table is allocated once. It emits
  targets and never integrates, respawns or resets a body.
- `lib/webgl/scenes/origin.ts` claims only the canonical mark form, supplies
  light, targets and pressure parameters, and projects the field into the
  shared shader's coordinate system: both axes use the smaller viewport side.
  Portrait width is therefore one unit, not the width/height aspect ratio.
- The conductor blends an optional scene `population` target for motes after
  deriving their ordinary host targets. An optional `dynamics` hook supplies a
  presence-weighted pressure basin to the shared environment. Other scenes
  have neither hook and retain their existing path.
- `fluid-core.mjs` applies that basin alongside the existing curl-noise fBm,
  repulsion, cohesion, viscosity, temperament, scroll, pointer and strike
  forces. Its pressure is softened at the centre; opposing shear interrupts
  radial symmetry. The leash opens and its outer spring weakens during capture,
  so the force can produce visible velocity instead of fighting a point spring.
  Every new force still scales by `(1 - bind)`.
- The 48 canonical identities and their mote ranks retain the conductor's
  position/velocity arrays throughout entrance, hold, reverse scroll and exit.
  Full tier starts with the existing 384 simulated bodies; the renderer's
  existing budget can reduce what is drawn. Population is not advertised as
  millions, and no GPGPU or new particle renderer was added.
- Fusion uses the existing form-presence/erosion kernel and owner-traced mark
  footprint in the same iso-surface. The form shader, locked optics, other
  form morphs and form assets are unchanged. The exact mark can hold while its
  outer catchment continues moving.

`?foriginforce=0` removes the new basin and leash relaxation for an A/B view of
the force contribution. `?fphys=0`, `?fmotes=1`, `?fcine=0` and the existing
renderer rollback paths retain their meanings. The new scene does not bypass
the governor or watchdog. It supplies low ongoing activity rather than a freeze.

## References and decisions

The research informed implementation mechanics and timing, not the site's
palette, assets, identity, or page composition.

- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): scroll
  progress can seek an authored timeline. Here the existing shared measurement
  loop provides that progress, and GSAP controls the score rather than particle
  positions. Stopping scroll therefore does not stop simulation time.
- [Three.js compute attractors](https://threejs.org/examples/webgpu_tsl_compute_attractors_particles.html)
  and its [source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_compute_attractors_particles.html):
  persistent position/velocity state, force integration, damping and bounded
  speed are useful references. Its spinning attractors and visual language are
  deliberately not reproduced. The existing tiled WebGL engine handles this
  site's population without replacing the stack.
- [Codrops: Dreamy particles with GPGPU](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)
  and [Aether-1](https://tympanus.net/codrops/2025/08/06/building-aether-1-sound-without-boundaries/):
  feedback state and evolving flow fields provide continuous motion independently
  of chapter progress. Zirtuno already has fixed-step state and curl-noise fBm;
  this work gives those forces more compositional freedom during Origin.
- [React Three Fiber performance guidance](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx):
  keep frame work imperative, use delta time, avoid React state and object churn
  inside frame loops. Those principles are applied inside the existing raw
  engine; R3F is not introduced.
- [Awwwards: NARS The O Experience](https://www.awwwards.com/nars-the-o-experience.html):
  the makers' cinematic case study informed the use of authored visual beats
  and deliberate mobile composition. It is an art-direction reference, not a
  performance benchmark or a template.
- [Rive state machines](https://rive.app/docs/editor/state-machine/state-machine):
  suitable for a small symbolic layer driven by inputs. No extra symbolic layer
  justified its cost here: the actual Zirtuno mark is already the resolution.

## Verification and review record

`node scripts/verify/origin.mjs` exercises the real scene, conductor and core:
384 identities, a broad opening, contraction under capture, motion while held,
an exact-form hold with living satellites, release, finite reversal, portrait
and ultrawide inputs, bounded centre forces, and byte-identical bind=1 behavior.
In the deterministic desktop run the authored width contracts from 1.317 to
0.717 field units; the mean held travel is 0.0347 units over three seconds.
These are behavior measurements, not frame-rate or battery claims.

`node scripts/probe/origin-bands.mjs` drives the real wheel through Lenis. It
checks visible beats, copy clearances, motion during a stopped score, reversible
type crops, and static, reduced, no-JS and short-viewport reading order. `W`,
`H`, `LOC` and `BASE` select the matrix. `scripts/capture/origin.mjs` captures
the same measured stops and reports actual canvas/population counts and S7
overflow. Evidence is under `captures/origin-rebuild/` (local, not shipped).

The implementation was also checked with the conductor, cinematic, canvas-count,
context-loss and accessibility gates, plus the rest, cursor and Services melt
capture suites. TypeScript, ESLint and the production build run with bundled
Node 24.19.0: the system Node 26.2.0 compiles and generates pages but crashes in
Windows libuv during shutdown. No dependency or lockfile change was needed.

The repository's stored rest hashes differ on the current browser. An isolated
unchanged checkout at `64548c6` supplied a temporary same-browser reference;
all eight states in this change are byte-identical to it. The committed signed
reference was not replaced. The cinematic contrast check was corrected to omit
the clipped decorative CTA ink duplicate and require glass text to retain its
fill; the keyboard-menu check now follows `aria-controls` to the current sheet.

The existing device matrix reports the same two failures in `64548c6` and this
revision: 5px full-page mobile overflow and a retired `heroCursorOn` channel.
S7 itself has no horizontal overflow in the reviewed 390×844, 1280×720 and
1440×900 views. The live, lite, full-nofx and context-restoration checks pass.
Real iOS bar behavior, thermals and the owner's motion/taste review remain
outside browser emulation. No 30-minute battery claim is made.
