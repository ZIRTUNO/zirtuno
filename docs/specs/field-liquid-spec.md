# docs/specs/field-liquid-spec.md — Coalescence on the form

The contact form's controls run the same vector liquid the site's buttons run
(`docs/specs/cta-membrane-spec.md`), plus the one thing a membrane never had: a **second
body** that can arrive at a surface, fuse with it, and be pulled off it on a
filament that stretches, thins and breaks. This file is the behaviour contract
and the working guide. `AGENTS.md` still owns CTA hierarchy, conversion copy and
the accessibility requirements; none of that changed.

---

## 1. What a visitor sees

### Soft to soft

The controls are rounded (`COAL.FIELD_R`, 10 px) and so is everything that
touches them. That is a change of surface, not only of silhouette: `buildRest`
with a radius emits a ring with **no cusps**, and a cusp is a hard stop for the
tension operator. Rounded, a wave launched on one edge carries the whole way
round instead of dying in the first corner it reaches. Most of what reads as
softness is that continuity.

### The controls answer

Every `input` and the `textarea` carry a membrane: hovering deforms the outline
toward the cursor, clicking into one sends a travelling wave across it from the
point that was struck, approaching one wets its interior. Same kernel, same
constants as the CTAs. Nothing about the form's layout, colour, type or
validation changed.

### The drop travels, and the bridge stretches

One drop rides the **left edge** of whichever control the reader is in.

| State | What happens |
|---|---|
| **Tour** | Nobody using the form: the drop walks the fields in reading order, settling into each and moving on. The form is never a still picture. |
| **Gather** | The drop arrives from above the form — the direction the contact mark sits in. |
| **Fused** | It sits absorbed in the edge, in a wetted foot ~16 px across and ~11 px proud. |
| **Stretch** | Move focus and the drop's own speed throws it off the rail. The bridge follows: the foot narrows, a throat forms mid-neck and thins, and a filament runs out behind the drop for up to 42 px. |
| **Break** | Foot and throat reach nothing together and the surface is flat again. The drop flies on as a free body, drawn out along its travel. |
| **Lean** | Every OTHER field on the board leans toward the drop as it passes — a shallow bulge, no bridge. The whole form answers, not just the two fields involved. |
| **Wobble** | Fusing and letting go are both impacts. Each fires a strike into the surface, so it rings and settles rather than snapping to its new shape. |
| **Fuse** | It settles into the wetted foot and STAYS VISIBLE — a bead half-submerged in its own meniscus, not a shape that switches off. |
| **Yield** | Focus or hover a control and the tour stops. The drop goes where the reader is and stays there. |
| **Wet** | The field holding the drop lights to `--color-cyan-deep`. Dim → lit → focused stays a hierarchy; focus is still the brightest thing on the form. |
| **Drain** | Scroll the form off screen and the drop loses its mass in place; the loop sleeps. |

Focus outranks hover, hover outranks the tour. Focus is where the reader
actually *is* — the same for a mouse, a keyboard and a screen reader — and it
survives the pointer wandering off. See §5.

---

## 2. The bridge is authored, not derived

This is the load-bearing decision in the whole feature.

**A smooth-minimum cannot make a neck.** The first working version of this
kernel was one — the vector half of what `sdf-glass-shader.mjs` runs on the GPU
— and it merged two bodies correctly. But a smooth-min's bridge is always fat,
and it does not thin as the bodies separate: it stands at full width until the
barrier between them fails and then vanishes in one frame. That is a property of
the blend function, not a tuning failure. It is why the first version of this
feature had a hard pinch and no stretch at all.

Real necks come from surface tension. So the bridge is traced as a graph over
the **neck axis** — the line from the surface's anchor to the drop's centre —
and its profile is authored:

```
foot ──── throat ──────────── bulb ─ tip
 a=0                          a=L    a=L+R
```

| Piece | What sets it |
|---|---|
| **wetting fillet** | a `sqrt` term over the first `0.22 R`, giving `dh/da → −∞` at the wall so the bank leaves tangentially |
| **horn** | falls from the shoulder to the throat over the neck's length, convexity from `HORN_P` |
| **throat** | `WAIST × (1 − t)^1.9`, and it only exists once the drop is CLEAR of the wall |
| **bulb** | the drop, as a circle about the axis at `a = L` |
| **smoothing** | three passes of a 3-tap kernel — this IS the gooey fillet, and it costs nothing |

Extension `t = L / BREAK` drives all of it. Both the foot and the throat reach
zero at `t = 1`, so the connection does not snap out of existence — it thins to
nothing and the surface is already flat when it lets go. The throat thins faster
than the foot (1.9 against 0.55), which is what leaves a visible thread hanging
on well after the bulge has flattened.

In that frame the silhouette is single-valued from foot to tip no matter how far
the drop has travelled. **There is no topology to switch on and no limit on how
long the filament can get** — which is exactly what the graph-over-the-edge
approach it replaced could not do.

---

## 3. The pinch is emergent, and the arrival is not the departure

Nothing schedules a separation. A drop running along a wall cannot wet it while
it is moving, so **speed** pushes it outward (`LIFT`), and when the axis grows
past `BREAK` the bridge is gone. The same rule read backwards is what fuses it
to the next control. `LIFT_MAX` (54 px) is set past `BREAK` (42 px) so an
ordinary focus move detaches fully rather than smearing.

**The lift is asymmetric**, and that is the whole feel of the arrival. Liquid
runs when it is let go and is drawn back slowly. Departure rides
`LIFT_TAU_OUT` (70 ms); the return rides `LIFT_TAU_IN` (240 ms). The stretch is
split the same way.

**The target is smoothed before the spring ever sees it**, and this is what
makes the motion read as smooth rather than merely slow. A spring chasing a
STEP target has its maximum acceleration at t = 0: on a 120 px hop that was
0 → 300 px/s inside one frame, 18 750 px/s² from a standing start, with the
jerk undefined. The drop was not easing into motion, it was being kicked into
it — and softening the spring cannot fix that, because however low ω goes the
acceleration still steps discontinuously from zero to ω²Δ the moment the target
moves. `TARGET_TAU` (135 ms) puts a first-order lag in front of the spring, so
acceleration starts at zero, rises and falls:

| | before | after |
|---|---|---|
| peak acceleration | 18 750 px/s² | **2 957 px/s²** |
| peak jerk | 1 171 875 px/s³ | **184 806 px/s³** |
| velocity, first frame | 300 px/s | **47 px/s** |

Timing of one focus move, measured:

| | |
|---|---|
| bridge breaks | ~120 ms |
| drop at full reach (54 px) | 336 ms |
| touching down | ~1.2 s |
| settled into the wetted foot | ~2.1 s |

---

## 4. The tour

When nobody is using the form the drop walks the fields in reading order,
arrives at each, dwells, and moves on. A full lap of four fields takes about
**6.0 s** — a stop every 1.5 s. The instant the reader engages, it yields.

**Self-paced, not metronomic.** It advances when the drop has arrived plus
`DWELL`, so a long hop takes as long as it takes and the pause afterwards is
the same wherever it lands. A fixed period would have to be set for the worst
case and would leave every short hop waiting. `CAP` (5.2 s) is the ceiling in
case a hop never arrives; in practice nothing reaches it.

**It paces off `arrived`, not `settled`,** and the two are deliberately
different signals. `settled` is arithmetic — everything spent, the next step
snaps to exact rest, the loop may sleep. `arrived` is geometric: the lift under
`ARRIVE_LIFT`, which is R, the lift at which the drop's near face is exactly on
the edge. It is touching.

That matters because **656 ms of a 1392 ms stop is the last 26 px of the return
drawing itself in** on `LIFT_TAU_IN`. A tour that waits for all of it stands
still through most of its own cycle. Moving on while the tail finishes
underneath is what lets the walk quicken without the travel being rushed —
which is the distinction the whole of §3 exists to protect.

**The tour brushes; focus fuses.** Stop for a field and the drop settles all the
way into the wetted foot. Pass by on the tour and it does not, and the walk
flows instead of going hop, stop, hop.

**It is not the tide.** `membrane-runtime` offers touch devices an autonomous
swell that makes every CTA breathe at once, and this spec used to say the form
must not have it — a form whose four fields all shimmer while somebody is
typing into one of them looks unstable. That still holds. The tour is a
different thing: it moves ONE drop, and it gets out of the way the moment the
reader arrives.

**RESUME** (1.6 s) is the grace after the reader lets go. Without it, tabbing
through the form would send the drop wandering between keystrokes.

**It stops costing when nobody can see it.** The tour reads `handle.visible`,
which the runtime writes from its IntersectionObserver; off-screen the drop
drains and the loop sleeps. `ONLY=tour` asserts all three behaviours — that
every field gets a turn, that focus holds it still, and that an unseen form is
quiet.

---

## 5. The outline stays on

The drop is drawn for as long as it has mass, merged or not. When a field
claims it, the field's contour grows the bridge *around* it and the drop's own
circle simply stays — a bead resting half-submerged in its own meniscus, its
outline visible through the surface.

**This replaced a cross-fade, and the story is worth keeping.** The drop used to
be hidden the moment a field claimed it, on the reasoning that it and the
bridge's bulb are the same circle and drawing both would double-strike one
shape. That is true. It is also why hiding it needed a cross-fade (a hard swap
read as a light going off, because the drop is full cyan and an unfocused
contour is `--color-paper-faint`); why the cross-fade needed a *dissolve* on
smootherstep (an exponential lag ramps correctly and still reads as a cut); and
why the dissolve needed a `DWELL` long enough to play in (a fade longer than the
state it belongs to never finishes, and pinned the drop at 0.35 forever).

Three rounds of machinery to make a disappearance acceptable — and not
disappearing turned out to be better. **When a feature keeps needing more
apparatus to feel right, the thing it is compensating for is worth questioning
before the apparatus is.**

What survives from that work is the **wet** state, which is independently good:
the field holding the drop lights to `--color-cyan-deep`, so the liquid has
somewhere lit to arrive rather than landing on a dim grey hairline. Dim → lit →
focused is still a hierarchy, and focus is still the brightest thing on the
form. `data-fl="wet"` flips the moment the bridge forms — 42 px out — so the
field brightens as the drop approaches rather than when it lands.

### The drop wears its host's material

Keeping the outline on is not enough on its own. While the bridge is formed the
field's contour draws the **bulb** and the drop draws **itself** — two
coincident circles. Identical, that is indistinguishable from one. Different, it
is a blink with no fade anywhere in it: the outline went bolder and brighter on
landing (full cyan over cyan-deep, two strokes) and thinner on leaving.

So the drop's stroke is **copied from the host contour's computed value**, once
per drawn frame. Mirroring its *state* was not enough — a field's stroke eases
over 200 ms and the drop's does not, because the drop never leaves the wet state
(it always has an owner), so every time a field lit up there was a window where
a rest-coloured circle sat under a wet-coloured one. Taking the computed value
removes the class of problem: whatever the contour shows this frame, transitions
included, is what the drop shows.

The bridge also only ever attaches to the **two ends of the current hop** —
where the drop left and where it is going. Picking the nearest field outright
let it grab fields it was merely flying past on the long return leg, and a field
that becomes owner and merged in the same frame has not started its transition
yet. A filament trails from where it left and reaches to where it is going; it
does not catch on the scenery.

`ONLY=tourfade` guards both: that once the drop has mass its outline is on for
every frame of the tour, and that the drop and the contour drawing the same
circle are never distinguishable.

---

## 6. Guarantees

1. **Exact rest.** With no drop in reach, every contour emits the string
   `mem.path()` would have emitted, character for character. Everything the
   layer does is render-only for that reason — the merge goes through the
   membrane's `push` channel and a spliced point list, never through its
   integrator.
2. **The corners are sacred.** The rule survived the move to soft; it is now
   about arcs rather than cusps. The bridge grows out of the **straight run** of
   an edge or not at all, and no reachable drop position touches a corner arc.
   The foot is capped to the room actually available rather than the anchor
   being moved, because moving the anchor tilts the axis along the wall and
   folds the banks through the field.
3. **It is additive, and that is enforced rather than asserted.**
   `data-fieldliquid` goes on the `<form>` only after the layer has mounted AND
   drawn, and every CSS rule that changes a field is gated on it. The merge
   kernel is imported **dynamically, inside the effect, behind a `try`** — a
   static import puts it on the form's critical path, where a module that fails
   to evaluate takes the whole contact form down with it under a
   perfectly healthy server-rendered heading. That is not hypothetical; a stale
   dev chunk did exactly that. `ONLY=broken` blocks the kernel's chunk and
   asserts what is left.
4. **It never intercepts.** `pointer-events: none`, every listener passive, and
   it draws *behind* the controls so no fill can sit over text being typed.
5. **It carries nothing.** Labels, values, validation, the error summary, the
   `:focus-visible` outline and the submit button are exactly where they were.
   The contour mirrors rest / focus / invalid through a `data-fl` attribute;
   the colours stay in `globals.css`. The CSS `border-radius` matches
   `FIELD_R` so the no-JS form is the same shape as the enhanced one.
6. **One loop.** The whole form registers as ONE handle on the shared membrane
   runtime — the fields and the drop are coupled, so they cannot be separate
   handles the scheduler sleeps independently.
7. **One owner.** Exactly one field may hold the drop, or two would each draw
   the bulb. It is the one whose edge the drop is nearest, recomputed each
   frame, so ownership changes on the same frame the bridge does.

---

## 7. Working on it

### Files

```
lib/motion/coalesce.mjs          the merge kernel — DOM-free, deterministic
lib/motion/coalesce.d.mts        its types (keep in sync by hand)
lib/motion/membrane.mjs          `buildRest({radius})`, `splinePath`, `points`
components/chapters/FieldLiquid.tsx   the overlay, the slots, the drop's wiring
app/globals.css                  everything under "THE FORM'S LIQUID"
```

### Gates

```bash
npm run liquid:form          # node scripts/verify/coalesce.mjs
npm run liquid:form:sheet    # the bridge at 5x, straight from the kernel
Z=9 COLS=4 STOPS=0,8,16,26 npm run liquid:form:sheet   # one band, close up
```

`verify/coalesce.mjs` proves the geometry in plain node: exact rest, the
bridge's foot/throat/bulb, the thinning order, the break, no pinch while the
drop overlaps the wall, a simple closed curve at every position, a smooth
silhouette across the whole travel, the lean, mass under stretch, emergent
pinch, the corner arcs, and cost.

**Review the kernel sheet before the page stills.** A 16 px detail on a 576 px
form is not judgeable at 1x, and this feature has twice shipped a defect that
survived rounds of full-form screenshots.

> **Quarantined 2026-09-04.** S10 was removed from the site, so
> `FieldLiquid.tsx` has no form to dress and this page harness has no page to
> shoot. Both are preserved — the component at
> `Dead Code/components/chapters/FieldLiquid.tsx`, the harness at
> `Dead Code/scripts/obsolete/capture-field-liquid.mjs` — and the commands
> below work again once the chapter is remounted. The KERNEL half of this spec
> is unaffected: `lib/motion/coalesce.mjs` is still active and still gated by
> `npm run liquid:form` and `npm run liquid:form:sheet`, both DOM-free.

```bash
NEXT_DIST_DIR=.next-forms PORT=3071 npm run dev
BASE=http://localhost:3071 node scripts/capture/field-liquid.mjs
ONLY=travel  BASE=http://localhost:3071 node scripts/capture/field-liquid.mjs
ONLY=broken  BASE=http://localhost:3071 node scripts/capture/field-liquid.mjs
```

Every page state: rest, fused, the five travel ages, the hold at the submit
button, **the tour** (a full lap, then yielding to focus, then going quiet
off-screen), hover, invalid, **broken** and reduced motion. Virtual-clock
driven.

Run it on its **own** `NEXT_DIST_DIR`, never the shared `.next`. Turbopack's
cache does not reliably invalidate across the dev/build boundary, and the
failure mode is not a stale style: adding an export to a shared module and
importing it from a new one gave a cached chunk with the importer but not the
export, and the whole contact form rendered as empty space. **If a component
VANISHES rather than merely looks wrong, suspect the cache before the code.**

Because the layer takes over the controls' border, a change here is also an
accessibility and CTA change: run `verify/a11y.mjs`, and `verify/cta.mjs`
once it is restored alongside the chapter.

---

## 8. Findings worth not relearning

- **A smooth-min cannot make a thin neck.** §2. Two rounds went into tuning one
  before it became clear the shape was not reachable from that function at all.

- **Sample where the curvature is.** The profile is a graph over the axis and is
  at its steepest exactly where the surface turns to face along it — at the foot
  (a wetting meniscus leaves the wall almost parallel to it) and at the tip (a
  circle's pole has infinite slope in this parameterisation). Uniform spacing
  put a notch at the foot; squaring the parameter fixed the foot and starved the
  tip, and the drop drew as a pointed leaf. One cosine gives both, which is what
  Chebyshev spacing is for.

- **The profile and the banks must read the same spacing.** For a while they did
  not — `neckA` in one loop and `i/N` in the other — so the two halves of the
  same curve were describing different shapes. Both go through `neckA` now.

- **A throat needs somewhere to be.** With the drop still overlapping the wall
  there is no bridge to thin, and pulling the profile down to a waist invents a
  pinch in what should be a wetted bulge. Worse, an early version put the throat
  0.8 px from the wall out of an 8 px neck — and every other check in the
  harness passed.

- **Cap the foot, do not move the anchor.** The foot has to fit inside the
  straight run. Clamping the ANCHOR to make room tilts the axis along the wall,
  and a bridge whose axis runs parallel to the surface has its banks pointing
  into the field, which folds the contour through itself.

- **The foot cannot be narrower than the drop's cross-section at the wall.**
  Capped below that, the profile steps outward between sample 0 and sample 1 and
  the contour folds. The cap yields to the geometry, not the other way round.

- **Zero-length segments have no orientation.** Cosine spacing crowds samples
  inside the 0.1 px the path is rounded to, so a self-intersection check
  reported a fold that existed in neither the geometry nor the output.
  Coincident points are dropped at emission — fewer path bytes, and no
  degenerate edges for anything downstream to reason about.

- **One fact, one place.** `PAD` lived in both the component (driving the
  viewBox) and the stylesheet (driving the element's box), and nothing forced
  them to agree — so a hot reload that updated one and not the other slid the
  whole liquid layer 52 px off its own form. The component writes both now.
  The same bug in a different costume: writing each path's `transform` inside
  the `d !== lastD` guard froze the layer's POSITION at first paint, and when
  the mono label font swapped, every contour stayed 25 px above the control it
  belonged to.

- **Lenis will not be argued with from inside the page.** It caches a scroll
  limit computed before the page finishes growing — 15000 on a 15971 px range —
  so `window.scrollTo` and `scrollIntoView` are both swallowed and the form
  parks 1000 px below the fold while the diagnostics report correct geometry.
  Playwright's `scrollIntoViewIfNeeded` goes through CDP and lands, but Lenis
  restores its own position on the next frame — so it has to come AFTER the
  virtual clock is installed, when there is no next frame to restore on.

- **A decorative layer must not be able to delete the form.** The additive
  contract was written before it was true: every rule was correctly gated and
  the attribute correctly set last, and none of it mattered, because a static
  `import` of the kernel meant a module that failed to evaluate took the whole
  client component with it. A contract that lives in a comment is a wish;
  `ONLY=broken` is the contract.

- **A fade must spend its brightness evenly.** An exponential is not a fade. It
  passes every "did the opacity ramp" test — attribute, computed style, no
  frame losing more than half — and still reads as a snap, because a third of
  the brightness goes in the first tenth of a second and the rest of the curve
  is invisible. `ONLY=fade` therefore checks the SHAPE: the biggest step
  between 80 ms samples must stay under 0.42, which an exponential's opening
  step (~0.37 plus a dead tail) cannot satisfy in a way that reads.

- **Measure what renders, not what you set.** Three probes in a row reported a
  perfect fade while measuring the wrong thing: a window the drop leaves faster
  than it fades, the submit button's own cyan membrane sitting in frame, and
  the programmatic `:focus-visible` ring pinning every sample at 227. Hide what
  you are not asking about, and check the crop actually contains the subject.

- **A merge between two surfaces drawn in different VALUES is a light switch.**
  The material matched — same stroke, same fill, same width — and the code said
  so in a comment. What did not match was the value: cyan against paper-faint,
  swapped in one frame. Geometry being continuous is not enough; everything the
  eye uses to tell one shape from another has to be continuous too. The **wet**
  state is what fixed that; the cross-fade was treating the symptom.

- **A fade cannot be longer than the state it lives in.** The dissolve ran
  inside a tour hop, and at 760 ms each way neither direction finished before
  the state flipped back — the opacity oscillated in a band and sat pinned at
  0.35 across 5.4 s of touring. A permanent half-transparent ghost, with every
  other check in the harness passing, and lengthening the fade would only have
  narrowed the band. Kept here because the same trap waits for any autonomous
  animation whose transitions are timed independently of its cycle.

- **Two coincident strokes are one stroke only if they are identical.** The
  blink that survived removing the fade was not opacity at all — it was the
  drop and the bridge's bulb drawing the same circle in different colours and
  therefore different weights. Anything drawn twice in the same place has to
  match in every channel, or the duplication IS the artefact.

- **Do not widen a tolerance until a check passes.** The material comparison
  kept failing on alpha mid-transition, and the honest reading was that the
  virtual clock inflates it — rAF frozen while CSS transitions run on the real
  clock. The fix was to switch the transition off for that measurement, not to
  loosen the threshold until the noise fitted under it.

- **When a feature keeps needing more apparatus to feel right, question the
  thing it is compensating for.** Hiding the drop on merge needed a cross-fade,
  which needed a dissolve, which needed a dwell to play in. Not hiding it
  needed nothing, and the owner preferred it. Three rounds of machinery came
  out in one edit.

- **Nothing on the outline may be sub-pixel.** `docs/specs/cta-membrane-spec.md §5`
  settled this for the buttons — "sub-pixel motion on a 1 px hairline is a bug,
  not life… it renders as uneven antialiasing, a shaky hand-drawn line", which
  is why `BOW` and `BREATH_A` are off. The drop reintroduced it twice: a 3.5%
  rest lobe worth 0.77 px peak-to-peak, and a pinch kick worth 0.51 px. Both
  read as a wobbly circle rather than as a body. The lobe is now zero — making
  it legible on an 11 px drop would need ≥ 9%, which is a blob — and the kick
  was raised until it clears a pixel (1.37 px). §12 is the guard.

- **`still` has to test what is DRAWN.** The drop renders at `x + ox * lift`,
  so a settled `x` with a lift still out is a drop still visibly off the edge.
  Testing only the spring's own position meant the rest-snap fired mid-return
  and zeroed the remaining lift in a single frame — the arrival ended early and
  read as a cut. Whatever the reader can still see counts as movement.

- **The tide is deliberately not forwarded.** The autonomous swell exists so a
  CTA on a touch device is not the only inert thing on a liquid page. Four form
  fields breathing on their own would be a form that looks unstable while
  somebody is trying to type into it. On touch the drop still follows focus,
  which is the behaviour that carries meaning.
