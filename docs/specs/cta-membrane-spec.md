# docs/specs/cta-membrane-spec.md — The Membrane

The site's buttons run the same two forces the homepage liquid runs: a
volume-conserving displacement **well** and a travelling pressure **strike**,
lifted out of `lib/webgl/fluid-core.mjs` and evaluated on a vector contour
instead of on 48 droplets. This file is the behaviour contract and the working
guide. `AGENTS.md` and `docs/specs/build-spec.md §7.2` still own CTA hierarchy, intent
tags and placement; none of that changed.

---

## 1. What a visitor sees

### Primary (`.cta-primary`) — the full membrane

| State | Trigger | What happens | Numbers |
|---|---|---|---|
| **Idle** | nothing near it | Displacements snap to zero, the simulation **sleeps**, the emitted path is byte-identical to the authored rectangle. Visually indistinguishable from the old CSS button. | 0 frames |
| **Aware** | pointer within 340 px | The interior *wets* — a faint cyan wash rises. Nothing moves. The element never shifts position. | wash 1.5% → 10% |
| **Hover** | pointer over/near it | The displacement well deforms the outline **toward** the cursor, with a meniscus dimple either side. Area is conserved, so it cannot reach for you without drawing in elsewhere. | ≈3.6 px bulge, area within 0.4% |
| **Press** | pointerdown / Enter / Space | A travelling ring from the exact press point: crest out, trough back at 52%, per-vertex arrival jitter. Cyan **floods** from the same point; the label flips paper→ink along the curved front. | crest ≈3.5 px, recoil 35%, front 560 px/s |
| **Release** | pointerup | Flood drains back toward its entry point. The surface returns through exactly **one** soft overshoot. | ζ = 0.55, settles ≈700 ms |
| **Focus** | keyboard only (`:focus-visible`) | A second contour offset 4.5 px along the ring's own normals, so it deforms with the surface. | opacity 0.7 |

### Secondary (`.cta-secondary`) — the thread

The rule under the label is a filled ribbon, not a stroke, so its **thickness**
can taper. It **pours from wherever the pointer crossed in** — not always from
the left — with the front running ahead of the body. A press sends the same
crest-then-trough pulse along it.

Resting 0 px · poured 2.3 px · press crest 3.7 px · press trough 1.8 px.

### Hero (`.lab-cta`) — the same membrane over live liquid

The hero CTA is a separate component from the CTA system (its own class, its own
sheen, a trailing arrow) and it carries the full membrane, with two differences
that the site's own hierarchy asks for:

- Its edge keeps the hero's dimmer weight — `cyan 55%` at rest, full cyan on
  hover, exactly what `border-color` did. The membrane inherits the hierarchy;
  it does not flatten it.
- It is the only CTA sitting over the **live liquid stream**, which is why
  `.mem-back` exists (see below). Both the label *and* the arrow have ink copies,
  so the whole button flips along the flood front.

What it loses when the membrane mounts: the sheen sweep, the `translateY(-1px)`
lift and the cyan box-shadow. Those are the three things the membrane exists
instead of — nothing moves the element under the reader's eye any more, the
surface answers.

### Ghost (`.cta-ghost`) — untouched, deliberately

The 12 px muted mono links in the top bar and footer keep their existing hover.
*Discreto* — chrome that ripples is chrome asking for attention it was designed
not to want. This is an art-direction decision, not an omission.

---

## 2. Touch devices — the tide

Phones and tablets have no hover, so awareness, the well and the cursor-following
meniscus are all unreachable there. Left at that, a mobile CTA would be the only
inert thing on a page whose whole argument is that it is liquid.

So on any device without hover the membranes run **autonomously**:

- **Arrival** — as the CTA scrolls into view, one wave passes through it from
  the edge the reader is travelling toward. Struck at 0.55 strength, so it is
  plainly gentler than a real press.
- **Tide** — a slow swell travels along the button's long axis, ~5.2 s per
  crossing. Indexed by **x**, not by ring position: the crest pushes both long
  edges outward together, so the button breathes in height as if the page's
  liquid were running through it. Indexed by ring position it would sway, which
  reads as a wobble rather than as flow.
- **Scroll** — the swell grows and quickens with the reader's scroll speed and
  settles back when the page stops. `fluid-core` already couples scroll into the
  field for the same reason; the buttons are in that fluid. A timer alone is an
  animation playing *at* someone — scroll makes it an answer to what the reader
  is doing, and on a phone scrolling **is** the interaction.
- **Resting wash** — the interior sits at ~6.5% instead of the 1.5% floor, since
  there is no approach to signal interactivity with.
- **Tap** — still fires the real strike and the real flood, and is always the
  louder event: ≈4.5 px against a 1.7 px tide.

Amplitude is 1.9 px by design. Below ~1 px, motion on a 1 px hairline reads as
unstable antialiasing rather than as life (see §5). Above ~3 px it starts to
rival a deliberate press, and autonomous motion must never be mistakable for a
response to touch.

**Cost.** An autonomous membrane never sleeps while on screen, so the budget
comes from cadence and viewport gating instead: only membranes actually in view
run, they step at ~30 Hz (matching the site's own idle governor), and a
membrane scrolled out of view fades its tide and returns to exact rest within
~1.4 s. A **direct** response — press, release, key — lifts the throttle for
900 ms, because a wave integrated at 30 Hz comes out at roughly half amplitude.

---

## 2b. The backing plate (`.mem-back`)

Any CTA that needs to stay legible over the liquid carries a semi-opaque black
behind its label. As a CSS `background` that plate is a **rectangle** — so the
moment the membrane bulges, the bulge shows raw liquid while the rest of the
button still sits on black, and the seam traces exactly the border box the
deformation was supposed to escape. Over a black page nobody sees it; over the
hero's stream it is obvious.

`.mem-back` is drawn from the same path as the outline, so the plate deforms
with the surface. It is transparent by default; a caller fills it and clears the
element's own background:

```css
.your-cta[data-membrane] { background: transparent; }
.your-cta[data-membrane] .mem-back { fill: rgb(0 0 0 / 0.68); }
```

Both `.liquid-journey .cta-primary` and `.lab-cta` do this.

## 3. Guarantees

1. **Exact rest.** With nothing touching it and no tide, every displacement
   snaps to zero and `path()` returns the authored string character-for-
   character. The tide *suspends* this, never breaks it.
2. **Volume.** The hand's normal acceleration is mean-removed around the ring,
   weighted by involvement, so ∮a·n ds = 0. The strike is deliberately exempt —
   a hand is a lateral displacement inside the plane, an impact is not.
3. **It is additive.** The membrane sets `data-membrane` on its host only after
   it has mounted and drawn. Every CSS rule that changes the button is gated on
   that attribute, so reduced motion, no-JS, pre-hydration and any mount failure
   all fall through to the original CSS button, complete and usable.
4. **It never intercepts.** All SVG layers and the ink label are
   `pointer-events: none`; every listener is passive. Clicks navigate exactly as
   before.
5. **Accessibility.** The ink copy of the label is `aria-hidden`, so the
   accessible name is not duplicated. `:focus-visible` gets the offset contour;
   the native outline is only suppressed once that contour exists.

---

## 4. Working on it

### Files

```
lib/motion/membrane.mjs          the kernel — DOM-free, deterministic
lib/motion/membrane.d.mts        its types (keep in sync by hand)
lib/motion/membrane-runtime.ts   one rAF, one pointer listener, one scroll listener
components/chrome/Membrane.tsx   the primary's SVG + input wiring
components/chrome/Thread.tsx     the secondary's ribbon
components/hero/Hero.tsx         the hero CTA (and components/lab/LabHero.tsx)
app/globals.css                  everything under "THE MEMBRANE"
app/lab.css                      the hero CTA's membrane rules
```

### Adding it to a new button

Render `<Membrane filled />` as a **direct child** of the control (it finds its
host via `parentElement`), and add an `aria-hidden` ink copy of the label
carrying both `cta-label` and `cta-label-ink`:

```tsx
<button className="cta cta-primary">
  <span className="cta-fill" aria-hidden="true" />   {/* no-JS fallback */}
  <Membrane filled />
  <span className="cta-label cta-label-ink" aria-hidden="true">{text}</span>
  <span className="cta-label">{text}</span>
</button>
```

For a text CTA use `<Thread />` instead, after the label.

### Tuning

Every constant lives in `MEM` / `THREAD` in the kernel with the reasoning beside
it. The ones worth touching:

| Constant | Effect |
|---|---|
| `HAND_PUSH` | how far the surface bulges toward the cursor |
| `HAND_R_K` | how local the meniscus is (× the button's short side) |
| `SHOCK_A` | click crest |
| `SHOCK_RECOIL` | how far the trough pulls back through rest |
| `ZETA` | damping — 1.0 is rubber, below ~0.45 rings |
| `K_TEN` | surface tension: how far a dent spreads |
| `TIDE_A` / `TIDE_MS` | the mobile swell's size and pace |
| `AWARE_R` | how early the surface notices an approach |

### Gates — run these after any change

```bash
node scripts/verify/membrane.mjs
```

Physics, in plain node: volume, exact rest, recoil ratio, travel, boundedness,
frame cost, tide legibility.

```bash
BASE=http://localhost:3021 node scripts/verify/membrane-mobile.mjs
```

The autonomous half in real device profiles: enters `auto`, animates untouched,
scroll reaches it, tap outranks the tide, stops off-screen, reduced motion off.

```bash
BASE=http://localhost:3021 node scripts/capture/membrane.mjs
ONLY=hero BASE=http://localhost:3021 node scripts/capture/membrane.mjs
```

State stills of all four surfaces — primary, thread, hero, reduced motion.
`ONLY=cta|thread|hero|rm` shoots one of them. Uses a **virtual clock** — rAF and `performance.now`
are replaced after the page settles, so a frame labelled "140 ms after the
press" was taken at exactly that age. Note that CSS transitions still run on the
browser's own clock, which is why `frame()` also waits in real time.

---

## 5. Findings worth not relearning

- **Sub-pixel motion on a 1 px hairline is a bug, not life.** A physically
  correct 0.5 px pressurised bow, and a 0.42 px idle breath, both rendered as
  uneven antialiasing — a shaky hand-drawn line. Both are off by default
  (`BOW`, `BREATH_A`). Anything under ~1 px belongs in the *fill*, not the
  outline: a filled area carries fractional opacity cleanly.
- **The hand and the strike need different physics.** The hand is a displacement
  (has direction → project onto the normal, conserve volume). The strike is a
  pressure (a scalar → push the boundary along its own normal at full strength,
  volume leaves through the third dimension). Projecting the strike made a
  271 px CTA nearly immune to its own clicks.
- **The recoil dies silently.** Widen the wave or damp it slightly and the
  trough drops to a few hundredths of a pixel while every other test still
  passes. `verify/membrane.mjs §4` pins the ratio for that reason.
- **Saturation must not be spent by the page.** `SHOCK_SATURATE` exists to stop
  *mashing* compounding. Autonomous arrivals used to charge it, so scrolling a
  CTA in and out of view attenuated the reader's own tap. Ambient strikes are
  now exempt in both directions.
- **`MAX_SUB` is a click-quality constant.** The strike's envelope advances on
  wall time while the surface integrates in clamped chunks; too low a ceiling
  leaves the integrator behind on slow frames and the click feedback weakens on
  exactly the devices that need it.
- **Cascade collisions.** The ink label carries `.cta-label` so it inherits the
  type — which means every `.cta-primary .cta-label` rule hits it too. That
  caused a double-width button and a white-on-cyan label. Selectors around it
  are deliberate.
- **A backing `background` is a rectangle.** See §2b. This is invisible on a
  black page and obvious over the liquid, so it hid until the hero got a
  membrane.
- **The hero rides a 3-D plane, so a rect is not a target.** `.lab-plane` is
  tilted from the pointer, and `getBoundingClientRect()` returns the
  axis-aligned bounding box of a rotated quad — a point 26% across that box can
  land *outside* the quad. In `capture/membrane.mjs` the synthetic `pointerdown`
  fired at exactly the computed coordinate and hit `DIV.lab-plane`, never
  reaching the button, while `elementFromPoint` insisted the point was inside
  (the tilt keeps moving between probe and press). Drive that button through
  Playwright **locator** actions, which re-resolve and hit-test the element.
- **A CSS transition needs REAL time.** The capture harness freezes rAF, but
  `.mem-focus`'s opacity transition runs on the browser's clock — and the
  keypress that starts it can lag on a heavy page. Sampling too early reported a
  working focus ring as a missing accessibility indicator, twice.
