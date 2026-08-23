# field-liquid-spec.md — Coalescence on the form

The contact form's controls run the same vector liquid the site's buttons run
(`cta-membrane-spec.md`), plus the one thing a membrane never had: a **second
body** that can arrive at a surface, fuse with it, and come apart again. This
file is the behaviour contract and the working guide. `AGENTS.md` still owns CTA
hierarchy, conversion copy and the accessibility requirements; none of that
changed.

---

## 1. What a visitor sees

### The controls answer

Every `input` and the `textarea` carry a membrane. Hovering deforms the outline
toward the cursor; clicking into one sends a travelling wave across it from the
point that was struck; approaching one wets its interior. Same kernel, same
constants, same displacement well and travelling strike as the CTAs.

Nothing about the form's layout, colour, type or validation changed.

### The bead travels

One droplet rides the **left edge** of whichever control the reader is in.

| State | What happens |
|---|---|
| **Idle** | Nothing. No bead, every contour is its authored rectangle, the layer sleeps. An untouched form is the plain bordered form. |
| **Gather** | The first focus draws the bead in from above the form — the direction the contact mark sits in — and fuses it to that control's left edge. |
| **Fused** | It sits absorbed in the edge: the outline swells into a lobe ~9 px proud. Quiet, and unmistakably *where you are*. |
| **Travel** | Move focus and the bead's own speed throws it off the rail, past the pinch threshold. It crosses the gap as a free body, drawn out along its direction of travel, and fuses with the next control as it settles. |
| **Drain** | Leave the form and it loses its mass in place. |

Focus outranks hover, in that order. Focus is where the reader actually *is* —
the same for a mouse, a keyboard and a screen reader — and it survives the
pointer wandering off. Hover only decides when nothing in the form has focus.

---

## 2. The one number everything follows from

`COAL.K`, the smooth-union blend radius, is not a taste number. Two constraints
fix it and together they leave exactly one answer on a 57 px field.

**The corners.** The deformation footprint is exact: a surface point at lateral
offset `u` is untouched once `hypot(u, p) ≥ R + K`, where `p` is the bead's
standoff from the edge. At `p = 0` that is `±(R + K) = ±24 px`, which fits inside
the 28.5 px half-edge with 2.5 px to spare. **The rectangle keeps its corners
because the arithmetic says so, not because anything is clamped.**

**The graph.** The contour is solved by casting one ray outward per point on the
edge, which can only describe a boundary with ONE crossing per ray. A bead held
*off* the edge breaks that: a ray reaches the bead only for `|u| < R`, but is
merged along it only where the local gap is under `K/2`, and everything between
is silently dropped — the bead loses its top and bottom and draws as a
rectangular tab. So the bead is only drawn as part of the field's contour while

```
p ≤ K/2
```

and past that it is drawn as its own body. For that handover to be seamless it
has to land exactly where the bead's near face touches the edge:

```
K/2 = R
```

`K = 16, R = 8` satisfies both. The silhouette is 16 px on both sides of the
handover, so the frame it separates on is not findable by eye — only the
junction changes, from a smooth fillet to a tangent point with a hairline break.

Three constants follow from the same reasoning:

| Constant | Value | Why |
|---|---|---|
| `R` | 8 px | pinned to `K/2` |
| `K` | 16 px | corner clearance + the graph condition |
| `LIFT_MAX` | 26 px | past `R + K = 24`, where the bodies are out of reach entirely |

---

## 3. The pinch is emergent

Nothing schedules a separation. A drop running along a wall cannot wet it while
it is moving, so **speed** pushes the bead outward (`LIFT`), and when the
standoff crosses `K/2` the union stops being one body. The same threshold,
crossed the other way as the bead settles, is what fuses it to the next control.
Detach and re-fuse are the same rule read in two directions.

Which is why there is a *break* rather than a fade. A liquid neck does not thin
to nothing, it goes unstable and snaps — and the same discontinuity run
backwards is what makes two drops join with a snap. `verify-coalesce.mjs §4`
pins the silhouette either side of it so the break stays a break and never
becomes a jump cut.

---

## 4. Guarantees

1. **Exact rest.** With no bead near it, every contour emits the string
   `mem.path()` would have emitted, character for character. This is a property
   of the arithmetic, not an epsilon: the polynomial smooth-min returns its left
   argument *exactly* when the other body is `K` or further, which is the whole
   reason for choosing it over the exponential one.
2. **The corners are sacred.** No reachable bead position deforms any of the
   four cusps. The liquid gives up its shape to the structure, never the
   reverse — that is the brand's own sentence written as a physics rule, and it
   is what keeps this from reading as a merge effect borrowed from somewhere
   softer.
3. **It is additive, and that is enforced rather than asserted.**
   `data-fieldliquid` is set on the `<form>` only after the layer has mounted
   AND drawn its first frame, and every CSS rule that changes a field is gated
   on it. Reduced motion, no-JS, pre-hydration and any mount failure all fall
   through to the original bordered form, complete and usable.

   The merge kernel is therefore imported **dynamically**, inside the effect,
   behind a `try`. A static import would put it on the form's critical path: if
   the module fails to evaluate, the whole client component fails with it and
   the reader gets an empty space where the contact form should be, while the
   server-rendered heading above it sits there looking fine. That is not
   hypothetical — a stale dev chunk produced exactly that, `coalesce.mjs`
   importing a `splinePath` that the cached copy of `membrane.mjs` did not
   export yet. A static import makes that failure unrecoverable; a dynamic one
   makes it catchable, which is the only way this guarantee can be true rather
   than merely intended. `capture-field-liquid.mjs ONLY=broken` blocks the
   kernel's chunk at the network layer and asserts what is left.
4. **It never intercepts.** The layer is `pointer-events: none` and every
   listener is passive. It draws *behind* the controls, so no fill can sit over
   text somebody is typing.
5. **It carries nothing.** Labels, values, validation, the error summary, the
   `:focus-visible` outline and the submit button are exactly where they were.
   The contour mirrors the border's rest / focus / invalid states through a
   `data-fl` attribute; the colours stay in `globals.css`.
6. **One loop.** The whole form registers as ONE handle on the shared membrane
   runtime — the fields and the bead are coupled (moving the bead changes a
   field's path even though that field never stepped), so they cannot be
   separate handles the scheduler sleeps independently.

---

## 5. Working on it

### Files

```
lib/motion/coalesce.mjs          the merge kernel — DOM-free, deterministic
lib/motion/coalesce.d.mts        its types (keep in sync by hand)
lib/motion/membrane.mjs          `splinePath` + `points` are shared with it
components/chapters/FieldLiquid.tsx   the overlay, the slots, the bead's wiring
app/globals.css                  everything under "THE FORM'S LIQUID"
```

### Gates

```bash
node scripts/verify-coalesce.mjs
```

The geometry, in plain node: smin exactness, exact rest, the reach, the
handover, the merged silhouette, self-intersection, the bead's travel, mass
conservation under stretch, cost, corner clearance, and the squared-off guard.

```bash
node scripts/capture-coalesce-sheet.mjs
Z=11 COLS=4 STOPS=7,8,9,11 node scripts/capture-coalesce-sheet.mjs
```

The merge at 5x, straight from the kernel — no dev server, no clock, no layout.
**Use this before the page stills.** The squared tab in §2 survived two rounds
of full-form screenshots because a 16 px detail on a 576 px form is not
reviewable at 1x.

```bash
NEXT_DIST_DIR=.next-forms PORT=3071 npm run dev      # its own cache, see below
BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs
ONLY=travel BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs
ONLY=broken BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs
```

Run it on its **own** `NEXT_DIST_DIR`, never the shared `.next`. Turbopack's cache
does not reliably invalidate across the dev/build boundary, and the failure mode
here is not a stale style — adding `splinePath` to `membrane.mjs` and importing
it from the new `coalesce.mjs` gave a cached chunk that had the importer but not
the export, so the whole contact form rendered as empty space under a
perfectly healthy server-rendered heading. If a component VANISHES rather than
merely looks wrong, suspect the cache before the code.

State stills of the real form: rest, fused, the four travel ages, the hold at
the submit button, hover, invalid, **broken** (the kernel's chunk blocked — the
additive contract under a real module failure) and reduced motion. Virtual-clock
driven, for the same reason `capture-membrane.mjs` is.

---

## 6. Findings worth not relearning

- **Not the goo filter.** The usual web answer is `feGaussianBlur` plus a steep
  `feColorMatrix` alpha ramp. It only reads on FILLED shapes — Zirtuno's fields
  are 1 px hairlines, and a blurred hairline is a glow, not an edge — and it is
  a raster pass on a live surface, which on a page already running a WebGL fluid
  is exactly the second unsynchronised visual engine AGENTS §4.15 forbids.
  Solving the iso-surface gives the same merge as GEOMETRY: one path, one
  stroke, no filter.

- **A merge needs something still outside it.** The first working version parked
  the bead centred on the edge, where it merged so completely that there was no
  bead left to see — the contour just swelled. The fix is not a bigger bead; it
  is that the *travel* has to carry it far enough out to be a body, which is
  what `LIFT` is for.

- **A standing-off bead cannot be drawn as a graph.** See §2. This is the whole
  reason `R` and `K` are one decision rather than two, and it is invisible to
  every other check in the harness: area, volume, corners, self-intersection and
  cost all passed with a rectangular tab on the edge. `verify-coalesce.mjs §12`
  exists so it can never come back quietly.

- **Two surfaces cannot both own the meniscus.** While the bodies are separate,
  the contact between them is ONE surface. Let both contours reach for it and
  both draw it, and it comes out as a doubled straight line across the middle of
  the drop; let only the field reach and it draws a cup around the drop instead.
  Neither is worth having, so neither reaches. The merge is carried by the
  fusion event, which is a real threshold with a real silhouette on both sides.

- **The order of the near-mode test is not subtle.** Tested before the crossing,
  the "stop at the other body" rule fires on every ray that will *eventually*
  reach the other body, so the surface traces the other body's near face instead
  of its own bulge — and the field's edge drew as a hard triangular cone
  pointing at the bead.

- **Position and shape are different state.** The first version wrote each
  path's `transform` inside the `d !== lastD` guard. At rest the path data never
  changes, so the position froze at first paint — then the mono label font
  swapped, every label grew 25 px, and all four contours stayed behind, drawn a
  label's height above the controls they belonged to. The measurement was
  correct the whole time; nothing was writing it. `place()` is write-only and
  separate for that reason.

- **`clip-path` is evaluated after the element's own `transform`.** In the
  contact sheet, a clip rect written in page coordinates landed somewhere else
  entirely: twelve of fourteen panels were clipped out of existence and the
  thirteenth had its bulge cropped off. The clip group has to be OUTSIDE the
  transform.

- **The browser pane does not run the rendering steps when it is not visible.**
  A ResizeObserver there never fires — not even its initial callback — so
  measurements taken through it can report a live observer as dead. Diagnose
  layout through Playwright, which actually renders.

- **The tide is deliberately not forwarded.** The autonomous swell exists so a
  CTA on a touch device is not the only inert thing on a liquid page. Four form
  fields breathing on their own would be a form that looks unstable while
  somebody is trying to type into it. On touch the bead still follows focus,
  which is the behaviour that carries meaning.

- **A decorative layer must not be able to delete the form.** The additive
  contract was written before it was true. Every CSS rule was correctly gated on
  `data-fieldliquid`, the attribute was correctly set last — and none of it
  mattered, because a static `import` of the kernel meant a module that failed
  to evaluate took the entire client component down with it, gates and all. The
  guarantee only became real when the import became dynamic and catchable.
  A contract that lives in a comment is a wish; `ONLY=broken` is the contract.
