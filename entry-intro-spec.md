# entry-intro-spec.md — S1.10, "Two Ideas, One Form"

> Owns the opening sequence: the loading moment before the site opens.
> `AGENTS.md` remains the authority for taste and protected invariants; where
> this document and that one disagree, that one wins.
>
> Code: `lib/animation/intro-sequence.ts` (choreography),
> `components/chrome/EntryVeil.tsx` (lifecycle),
> `components/chrome/IntroRive.tsx` + `IntroRiveRuntime.tsx` (the Rive slot),
> `lib/animation/intro-trace.data.mjs` (generated geometry),
> `scripts/generate-intro-trace.mjs` (the generator),
> `scripts/verify-entry-veil.mjs` (the gate),
> `scripts/capture-intro.mjs` (the contact sheet).

---

## 1. The argument

The site's first frame is its Origin story told in motion. Zéfiro is force,
Ventura is direction, and neither is the studio alone — *force without direction
is only weather* (AGENTS.md §2). The mark obliges: it is two interlocking lobes
joined into one continuous ribbon.

So the intro draws it as **two lines that meet**, and only then does it become a
body. That is the whole idea, and every technical decision below exists to serve
it.

This replaces the wordmark particle assembly that used to occupy S1.10. That
engine (`lib/animation/wordmark-particles.ts`) is untouched and still carries
S8 Beat 5, where the brand NAME resolving is the point. Here the MARK is.

---

## 2. The score

Absolute seconds, not relative offsets — the beats overlap on purpose and a
chain of `+=` makes an overlapping score unreadable. Source of truth is
`SCORE` in `lib/animation/intro-sequence.ts`.

| t (s) | beat | what happens |
|---|---|---|
| 0.00 | SEED | a droplet crosses the black; horizontal carry bleeds off (`power1.out`) while the fall accumulates (`power2.in`) |
| 0.55 | IMPACT | it meets the contour. The kernel takes a `strike`; a lobed ring opens and dissipates by losing stroke width |
| 0.60 | TRACE | two heads run from the impact in opposite directions, on curvature-derived paces (§4) |
| 1.83 | MEET | the heads close on the far terminal. Second strike, larger ring, dash pattern cleared |
| 1.86 | FLOOD | the silhouette fills from the meeting point outward through an expanding lobed mask (0.60 s) |
| 2.18 | DOT | the mark's own counter-dot falls and lands (0.30 s), ringing the surface with the hardest strike of the three |
| 2.30 | DROPLETS | three satellites leave the sharpest OUTER turns along their normals and are drawn back |
| 2.46 | BREATH | the autonomous tide comes up — the surface is alive before it leaves |
| 2.72 | DRAIN | the mark falls (`power3.in`) and the black sheet follows 0.06 s behind (`power2.in`) |
| 3.42 | END | the veil unmounts |

Skip control becomes available at 1.00 s. Hard cap releases at 4.62 s.

### Two rules the score obeys

**No fades.** Nothing animates `opacity`. Every appearance is a move, a draw, a
flood or a thinning; the veil leaves by travelling. This is an owner taste rule,
and `verify-entry-veil.mjs §3` walks the held clock reading computed opacity off
every layer rather than trusting the comment.

**One clock.** The GSAP timeline is the only clock. DrawSVG's two heads are
driven from a single proxy so they cannot drift; the vector-liquid kernel is
stepped on GSAP's ticker and its impulses fire from timeline callbacks; Rive is
scrubbed by timeline progress. A layer running its own loop beside a sequence is
what makes a composition read as "several effects at once" instead of one move.

---

## 3. Geometry — generated, never drawn

`node scripts/generate-intro-trace.mjs` (`npm run intro:trace`) derives
everything from `public/brand/zirtuno-logo-mark.svg` and writes
`lib/animation/intro-trace.data.mjs`. Re-run it whenever the mark changes; never
hand-edit the output.

The mark is an **owner-traced form** and AGENTS.md §4.3 makes it sacred, so the
paths are baked by exact affine transform (the source uses only absolute
`M`/`C`/`z`, which makes `translate(-1050,-850)` plus a uniform fit lossless —
the generator asserts this and throws if a re-export introduces other commands).

### Why the contour and not a centreline

The obvious reading of "draw the logo" is to animate a stroke along the form's
spine. It does not work here. The mark is a FILLED outline, so there is no
stroke to offset; and its medial axis, recovered by Zhang–Suen thinning over the
exact EDT in `lib/webgl/sdf-core.mjs`, is not a single open curve — the form has
two counters, so the axis contains loops and a Y-junction. A pen following it
would visibly branch and backtrack.

Tracing the true contour, seeded so two heads spread and meet, reads as ink
finding a form rather than a cursor running a lap, and it uses the canonical
path verbatim.

### Why the ring is rotated

DrawSVG works on dash offsets along `[0, L]`; it cannot wrap a closed path's
seam. Two heads spreading from a seed at fraction *f* always finish at 0% and
100% — the seam — and only arrive TOGETHER if *f* is exactly 50%. The generator
therefore rotates the ring so vertex 0 is the MEETING point, which puts the seed
at *n*/2 by construction and makes the tween a plain `"50% 50%" → "0% 100%"`.

Which two points? On a ribbon outline, the arc-length antipode of one terminal
tip IS the other terminal tip — out along one bank and back along the other is
the same length twice. The generator picks the antipodal pair furthest apart in
space; on this mark they are 669 units apart in a 1000-unit box.

### Why normals come from the distance field

The fill has two holes, which a *simple* closed curve cannot produce under the
nonzero rule — so the contour crosses itself, and "outward" is not recoverable
from winding order. Rotating the tangent silently flips sign somewhere in the
middle of the ribbon. Inside the fill, −∇d of the EDT points at the nearest edge,
so it IS the outward normal everywhere, self-intersection or not.

### Droplet launch points

Sharp turns, spaced apart, that pass BOTH counter tests: a MARCH along the
outward normal that must not re-enter the fill within 260 units (the widest void
measured along a normal, not across it), and a FACING test against the centroid.
A tip on a counter's boundary is still a sharp outward turn with a correct
normal — it points into the hole, and a droplet launched there reads as a
rendering artefact. Measured on this mark, outer tips run +0.41…+0.93 and
counter tips −0.55/−0.98. The generator throws if fewer than three survive.

---

## 4. The pace of the line

A constant-speed head reads as a plotter. Rather than tune an ease until it
"feels drawn", the generator gives every vertex an effort cost of
`1 + 2.6·|turn|`, accumulates it along each head's half of the contour, and
inverts. Uniform time then spends uniform effort, so the head's speed is
inversely proportional to how hard the contour is turning — and the two halves
get genuinely different curves, because the mark's two lobes are different
shapes. Emitted as `TRACE.easeA` / `TRACE.easeB`, CustomEase path strings the
runtime reads directly.

---

## 5. The liquid is the CTA's liquid

The body is deformed by `lib/motion/membrane.mjs` — the same kernel, the same
character constants, that every CTA on the site answers with. Not a lookalike.

Two additive changes made that possible, both defaulting to the existing
behaviour so `verify-membrane.mjs` and the CTA are byte-identical:

- **`ringRest(pts)`** — the rest contract built from an arbitrary closed ring
  instead of a rectangle. Everything downstream of `rest` was already
  shape-agnostic; `buildRest` held the only rectangle knowledge in the file.
  Requires uniform arc spacing (`K_TEN` is an index-space Laplacian, so equal
  index steps must mean equal rest lengths) and true outward normals — both of
  which the generator guarantees.
- **`opts.maxN` / `opts.handR`** — per-instance clamps. A button may move 9 px;
  a 520 px logo needs more to read as liquid and much more to read as broken.

**The kernel runs in real pixels.** `membrane.mjs` is tuned in px/ms from top to
bottom (`SHOCK_SPEED: 560` px/s, `MAX_N: 9` px, `HAND_PUSH: 4400` px/s²). The
ring is scaled to the stage's CSS px at mount, not left in viewBox units; the
static paths get an SVG transform instead. Handing it a 1000-unit ring mis-scales
every force at once — measured, that produced 2.02 units of displacement, about
1 px on screen.

Measured behaviour at a 520 px stage: peak displacement 12.2 px (2.4% of the
mark) just after the dot lands, mean 2.2 px, back to exact rest afterwards.

---

## 6. The exit

The black plane is a fixed div, taller than the viewport by the leading wave's
full swing, whose leading edge is a `clip-path: path()` written ONCE. Only
`transform` animates.

Re-generating the clip every frame so the front ripples repaints the whole
viewport on every frame of the exit, on top of the hero's WebGL, at the single
moment the page is doing its first real work. The life comes from the shape and
the easing instead: a flat front with three narrow raised-cosine tongues of
different width and weight over a slight lean. Summed sines were the first
attempt and read as a TILT — over 1440 px, harmonics of comparable width average
into one gentle slope. A draining sheet stays close to level and CLINGS in a few
places, and the clinging is what makes it liquid.

The plane rests at `translateY(-2·amp)`, not `-amp`: the edge occupies
`y ∈ [0, 2·amp]` inside its box, so resting at `-amp` leaves an uncovered strip
along the top of the viewport.

The mark is a SIBLING of the plane, not a child — unclipped, with its own fall
curve, leading the sheet out over the revealed page. Underneath, the hero's cyan
ribbon has been running the whole time, so the liquid the visitor watches leave
hands off to liquid that is already there.

---

## 7. The Rive layer — authoring contract

The layer is OPTIONAL and TIMELINE-DRIVEN. Unset `NEXT_PUBLIC_INTRO_RIVE` — the
shipped default — and neither the chunk nor the request exists; the sequence
plays complete without it. Set it to a public path and the layer mounts.

Rive is the right tool for authored vector expression that would be tedious or
dishonest to fake in code — ink bleed at the meeting point, hand-drawn grain on
the flood front, character in the droplets. What it must not be is a second
clock.

**The file must provide:**

| | |
|---|---|
| artboard | `Intro` |
| state machine | `Intro` |
| number input | `progress`, 0 → 100 |

**And must obey:**

1. Every visual is a function of `progress` alone, through a **1-D blend state**.
   No self-advancing timeline states, no loops, no triggers, no time-based
   transitions. If the artboard can move while `progress` is held still, it is a
   second clock and a skip will tear it.
2. Compose against the same square design box the SVG uses (`INTRO_VIEW`,
   1000×1000, artwork at 0.78 of the longest side). The artboard is laid over the
   mark's stage with `Fit.Contain`, centred, so a mark-relative effect lands
   where the mark actually is.
3. No audio. The runtime sets `volume = 0` regardless, including audio embedded
   in a file.
4. The layer is decorative and `aria-hidden`. It may never be the only carrier
   of anything (AGENTS.md §4.12).

Beat times to compose against are in §2. `progress` maps linearly onto the whole
3.42 s score, so beat *t* is at `progress = t / 3.42 × 100`.

Failure paths are silent by construction: a missing input, a load error or a
runtime throw leaves the sequence exactly as it plays today.

---

## 8. Gates

```bash
npx tsc --noEmit
node scripts/verify-entry-veil.mjs      # BASE_URL=… — the stop-the-line gate
node scripts/verify-membrane.mjs        # the kernel change must stay additive
npm run intro:sheet                     # the contact sheet, for owner review
```

`verify-entry-veil.mjs` asserts: the sequence is up at load and releases in
≤ 5 s; a same-session reload never paints it; reduced motion never paints it;
**no layer's opacity ever leaves 1**; the drawn line and the liquid body render
the same path data; the score fits its 4 s budget; and the skip is a real,
focusable, labelled button whose exit is driven by the skip and NOT by the hard
cap — bounded on both sides, because "it went away eventually" passes just as
well when the skip is broken. It did, once.

`scripts/capture-intro.mjs` drives `?zintro=hold`, which builds the timeline
paused and runs the liquid off the PLAYHEAD instead of the wall clock, so every
frame is a pure function of its timestamp and reruns are comparable. Seeks must
be monotonic — the strikes are timeline callbacks and have to be crossed, each
at its own `now()`, or every impulse in the sequence lands with one timestamp.
To rewind, reload.

`?zintro=hold` is deliberately NOT an `?f*` flag: those disable the veil
outright, which is the repo-wide capture convention, and this one needs it to
exist.

---

## 9. Notes for whoever changes this next

- **The play guard must stay idempotent.** It mutates the thing it tests —
  playing marks the document as seen — and React Strict Mode invokes effects
  twice on the same instance in development. The decision is cached in a ref for
  that reason. A guard that re-reads `data-zveil` cancels the sequence on the
  second run and the intro never plays in dev, which is exactly when it is being
  designed.
- **`data-zveil` is set on RELEASE, not on start.** `globals.css` hides
  `.entry-veil` on that attribute, so setting it up front collapses the element
  the effect is about to measure and the stage reads 0 px wide.
- **React owns the tree; GSAP and the kernel own the numbers.** No animated
  attribute (`viewBox`, `d`, `r`, `cx`, `width`) appears as a JSX prop. The skip
  control flips a state a second into the sequence, and a render that reconciled
  those attributes back to their authored values would reset the animation
  mid-flight.
- **Fill colour is the locked key light**, `normalize(-0.42, 0.72, 0.55)`, upper
  left (`sdf-glass-shader.mjs §L`), expressed in the two brand cyans. A flat
  520 px field of one cyan reads as a sticker. Do not introduce a hue to fix it.
- **The impact rings are lobed contours, not circles.** A perfect circle was the
  one piece of generic-loader geometry in an otherwise entirely organic
  composition and read as exactly that.
