# Contact Companion Spec (S10)

> Owns the droplet that watches a visitor fill in the contact form.
> `lib/motion/companion.mjs` is the kernel, `components/contact/Companion.tsx`
> is the shell, `app/contact.css` owns placement and material.
> `AGENTS.md` wins on any conflict.

## 1. What it is

One lobed droplet with two pupils cut into it, in the statement column of
`/[locale]/contact`, on the chapter label's line and directly above the display
type. It reacts to where the visitor points, clicks and writes, and to what the
form says about what they wrote.

It is **not** a mascot. There is no head, no eyebrow, no mouth, no limb and no
outline that is not liquid. AGENTS.md §4.16 makes Contact a signature surface;
the restraint is the reason this is allowed on one.

The reference the owner brought — `smontlouis/bible-strong-avatar-lab` — is a
**vocabulary reference, not a dependency**. What was taken from it is its model:
procedural SVG geometry, expressions as named presets over one parameter vector,
animation as interpolation between them. No code, no `.avatar.json`, no package.
Nothing was added to `package.json` for this feature.

**The lab's whole vocabulary is carried**, both halves of it. Its LIFE CYCLE
(sleeping, waking, idle, listening, thinking, searching, working) and its
REACTIONS (excited, bored, suspicious, angry, drowsy, happy, curious, confused,
surprised, proud, shy, sad, laughing, scared, playful, celebrate) all resolve —
**33 presets plus 4 aliases**, asserted as a list by `verify/companion.mjs §4i`
rather than left to a reviewer counting panels. Four of the lab's names are this
site's own poses under a different word and resolve through `ALIASES`
(`idle`→`rest`, `listening`→`attend`, `thinking`→`ponder`, `waiting`→`hold`);
shipping duplicates would give the shell two ways to say one thing and no way to
tell which is current.

Its grid of **eye presets** is carried too, but not as art: `wide`, `iris`,
`slant` and `lift` are four more channels on the same vector, so a round eye, a
tall bar, a flat dash and a tilted slash are points in one continuous space and
a pose can sit half way between any two of them.

## 1b. The surface is the CTAs' surface

The droplet does not imitate the button behaviour — it **runs it**.

- `companion.mjs` calls `makeMembrane` from `lib/motion/membrane.mjs` on the
  droplet's own ring, so the hand-well, the travelling shock, the proximity
  wake, the tension/viscosity operators and the autonomous tide are the same
  kernel every CTA on the site runs, on a different contour.
- `Companion.tsx` registers with `membrane-runtime` as a `Driven`, so the shared
  scheduler owns the pointer, the per-frame hand feed, the visibility observer,
  the tide on touch devices and the scroll geometry. Registering **deleted** the
  component's own rAF loop, IntersectionObserver and visibilitychange handler.
- **The rest ring is a perfect circle.** The lobe stays in the kernel so
  `tension` can still smooth it out as a mood; baking the irregularity into the
  membrane's rest would freeze it and a furious droplet could no longer go taut.
- `handR` and `maxN` are set explicitly in **viewBox units**, not left to the
  defaults, which are scaled off a button's short side and far too tight on a
  body this small. `maxN: R * 0.26` is the single knob for how far the hand
  pulls the body toward the cursor — if the teardrop under a hover ever reads as
  too much, that is the number to trim.

## 1c. It follows you

The **slot** stays in the flow at full size; the **carrier** detaches to
`position: fixed` once `[data-companion]` is set, and springs between two
targets:

- **docked** — the slot's position, on the statement's label line;
- **parked** — the shell gutter at 62% of the viewport height, once the slot has
  scrolled away. The gutter (`--page-padding`) is the one strip of the viewport
  nothing is ever laid out in, so a persistent floating object can live there
  without covering copy. Where the gutter cannot hold the droplet (narrow
  viewports) it keeps its column position instead.

No scroll listener and no `scrollHeight` read: `Driven.travel()` hands over the
scroll geometry the runtime already took in its read phase. That is also why it
never has to know about Lenis, whose native scroll events arrive about twice per
900px and hundreds of pixels stale.

The slot's **document** position is cached and refreshed by a ResizeObserver
rather than read per frame — a rect read inside the runtime's write phase forces
a synchronous layout.

## 1d. It answers being touched

`.cp-body` is the **only** element with `pointer-events`, so the reactive area is
the droplet's silhouette and not its box. The slot and carrier stay `none`, and
the gate asserts it: once the droplet became deliberately clickable, the risk
stopped being "can it be touched" and became "is a 108px rectangle now sitting
over the page".

- **hover** → `curious`: wide, lifted, one brow up, leaning **into** the hand,
  plus the membrane's displacement well pulling the body toward the cursor.
- **click** → `startled` for 720 ms: a `mem.strike()` from the struck point (the
  same wave a pressed CTA runs) plus a whole-body recoil, which a button does
  not do because a button is not a body.

`dodge` is what a cursor passing *close by* earns; `curious` is what deliberate
contact earns. Approaching makes it shy, touching makes it curious.

It stays `aria-hidden` and unfocusable. Nothing here is an action, so there is
nothing a keyboard user is being denied.

## 2. Non-negotiables

1. **It is additive, and the form is untouched.** `ContactForm.tsx` has no edit
   from this feature. The companion reads DOM the form already publishes for
   accessibility reasons. If the form is refactored, the worst case is a
   companion that stops reacting — never a form that stops submitting.
2. **It never fades.** The rest pose is computed at module scope and ships in
   the server HTML, so there is no arrival to catch. No opacity is animated
   anywhere, in CSS or in JS.
3. **It never leaves the cyan family.** There are exactly **two hue channels
   and both are cold**: `chill` runs `--color-cyan` → `--color-cyan-deep` and
   `glow` runs it → `--color-cyan-glow`. They are the two ends of one axis, so
   a mood can be bright without any warm token existing — that is a **light**
   change inside the brand's own three cyans, not a hue leaving them. A third,
   `lumen`, is not a hue at all: it is how much of itself the droplet is
   spending, and it is what carries sleep and celebration.

   Every one of those tokens is in AGENTS.md §6. The kernel contains **no colour
   literal at all**, asserted against its own source text — it emits numbers and
   `app/contact.css` owns the tokens. `--color-warn` belongs to the form's error
   copy and is not the companion's to spend.

   *(This widens the single sentence AGENTS.md §4.10 shipped with, which named
   only `chill`. The prohibition it exists for — no warm token, no off-brand
   hue, no colour literal in the kernel — is unchanged and still gated.)*
4. **Anger is geometry.** The mood must be legible in a black-and-white
   screenshot: a flatter crown, a tauter surface, a dropped inner brow. Colour
   only agrees with a change that has already happened in the shape. Every
   expression added since is held to the same test by the contact sheet, which
   is rendered without any colour channel applied at all.
5. **The pupils never leave the body.** At any expression, any gaze angle, under
   any strike.
6. **Nothing leaves the viewBox.** A liquid with a straight edge cut across it
   is a rendering bug that looks like a design decision.
7. **It carries nothing.** `aria-hidden="true"`, nothing focusable inside it, no
   copy — so no i18n surface and no translation debt. It *is* deliberately
   touchable, but only `.cp-body` may ever carry `pointer-events`: the reactive
   area is the silhouette, never the box. Nothing it does is an action, so a
   keyboard user is denied nothing by not being able to reach it.
8. **It costs one screen, and the runtime owns that.** Registering with
   `membrane-runtime` hands over the visibility observer, the pointer and the
   frame loop; this component must never grow its own again. Reduced motion
   turns it off entirely — the carrier stays in the flow and the still droplet
   already in the markup is the whole feature.

## 3. The parameter vector

Every expression is a point in this space. Adding a state means adding a preset,
never a new code path.

| channel | meaning |
|---|---|
| `open` | pupil aperture. 1 wide, 0 shut. |
| `squint` | the lower lid. Positive rises through the middle (scrutiny); negative bows it down, which with a low `open` is the crescent of a contented shut eye. |
| `brow` | the upper lid's **angle**. Positive drops the inner corner (anger); negative drops the outer and lifts the inner (sorrow). |
| `askew` | the **difference** between the two eyes: positive lifts the left brow and narrows the right. A face whose halves agree perfectly reads as a diagram; one raised brow is the whole of skepticism, and it is the cheapest expressiveness in the file. |
| `crest` | the crown's flatness. Positive flattens the top of the body, negative rounds it up. |
| `tension` | surface tautness. Smooths the lobes toward a circle. |
| `swell` | overall scale. |
| `lean` | how far the crown leads toward the gaze. Negative leans away. |
| `tilt` | whole-body rotation. |
| `jitter` | tremor amplitude. |
| `sag` | deflation: the base pools and the body drops. |
| `spread` | pupil separation. |
| `gaze` | how much of the gaze vector the pupils spend. |
| `pulse` | breath **amplitude** — how deep. |

### The eye style — the lab's grid of eye presets, as channels

| channel | meaning |
|---|---|
| `wide` | pupil **width**. 1 is the round aperture this shipped with; under 1 is a tall bar, over 1 the flat dash a closed or amused eye needs. With a low `open` it is the whole difference between *asleep* and *squinting*. |
| `iris` | pupil **size**. A small pupil in a wide aperture is the oldest fear cue there is, and it costs one channel — it is what makes `scared` read as fear rather than as a second `startled`. |
| `slant` | pupil rotation, **mirrored** between the two eyes: positive is the inward-down slash of a glare, negative the outward-up tilt of mischief. Mirroring is what keeps it a face rather than a pair of parallel typographic marks. |
| `lift` | pupil **home height**. Positive drops both eyes, which under a lifted brow is how *downcast* reads without moving the gaze. |

### Presence

| channel | meaning |
|---|---|
| `chill` | cyan → **cyan-deep**. Cold. |
| `glow` | cyan → **cyan-glow**. Bright. The other end of `chill`'s axis. |
| `lumen` | how much of itself the droplet is spending — the hairline's weight and the pupils' solidity. Below 1 it recedes (sleep, boredom, sorrow); above 1 it burns (the confirmed send). **Not a reveal**: rest is exactly 1 and nothing ever fades in. |
| `rate` | breath **frequency**. `pulse` says how deep, this says how fast, and the two together are the difference between sleeping and panic. Integrated as a phase, so it can change mid-breath without the chest jumping a beat. |

**The two hue channels must not both be spent hard.** `chill` pulls toward
cyan-deep and `glow` toward cyan-glow; a pose that spends heavily on both mixes
its way back to plain cyan having paid twice for no change. A little of each is
legitimate — `searching` is bright and slightly cold. The gate refuses anything
over 0.3 on both.

**`brow` and `crest` are separate on purpose.** The first build folded them into
one scalar and `fail` came out with no sad brow at all — one signed channel
cannot both drop the inner corner and lift it.

**The expression spring is underdamped** (`ZETA_E` 0.74). At 1.0 every pose
arrived dead, slid into place and stopped — correct arithmetic, lifeless
animation. The few percent of overshoot is what gives the droplet mass.

**The gaze wanders when nothing is aiming it.** Two octaves at mutually
irrational periods, so the path never repeats — the same trick `aura-gl` uses to
keep a background from reading as a loop. A droplet holding a dead-ahead stare
whenever the pointer is elsewhere reads as switched off. `aim()` overrides it
completely and `release()` hands it back.

**Narrowing is not closing.** The first build spent anger on `open`, which
shortens the pupil vertically. A pupil that shortens reads as a closing eyelid,
so `angry`, `effort` and `fail` all came out **drowsy**. An angry eye stays open;
what changes is the angle of the lid above it.

**The aperture is built at the origin and then placed.** `pupilPath` assembles
the eye's shape around (0,0), measures the largest radius it actually found, and
only then clamps that into the body. The old call passed the pupil's *nominal*
radius, which was only ever right for a round eye — `wide` can stretch one
half again, `open` can stretch it vertically, and a bowed `squint` drops its
floor further still. Measuring instead of modelling is exact for any shape the
file can draw, and it fixed a pre-existing case on the way: `startled`
(`open` 1.45) was being clamped as though its eye were a third shorter than it
is.

## 3b. Gestures are not expressions

A pose is a place in the vector; a **gesture** is a decaying impulse on top of
wherever the vector currently is.

| gesture | what it is |
|---|---|
| `shake(a)` | a refusal — a decaying oscillation on `tilt`. Rotation cannot move a contained point out of its container, so this is the one gesture safe to spend on the geometry. |
| `hop(a)` | a bounce. Read back through **`offset`**, in viewBox units, for the caller to add to its own transform. |
| `laugh(a)` | mirth. Drives the chest, the eye-squeeze and part of the bounce **on one oscillator**, so a laughing body and a laughing face are in phase — a body that shakes while its eyes stay wide reads as shivering. |
| `wink(side)` | one lid, deliberately slower and deeper than a blink. At `BLINK_MS` nobody catches which eye it was, and a wink nobody can identify is a glitch. |

Three properties, all gated:

- **They compose.** A gesture survives an expression change mid-flight — a
  laughing droplet made angry stops laughing because the mirth *drains*, not
  because a state machine cut it off.
- **They top up rather than restart.** Re-triggering raises the envelope and
  leaves the phase alone, so a second poke during a bounce makes it bounce
  *higher* instead of snapping back to the floor to replay.
- **They leave.** Every one decays to exactly zero, and `settled` is false while
  any of them is running.

**`hop` never touches the ring.** `COMP.VIEW` is sized for the widest *shape*
the kernel can reach; spending that margin on a translation is how a liquid ends
up with a straight edge cut across it. So the bounce is exposed as `offset` and
`Companion.tsx` folds it into the travel spring's own `translate3d` — one
transform on the element, not two.

## 4. The expressions, and what triggers each

Priority runs top-down; the first match wins. Everything is DOM-observed and
nothing is added to the form for it.

### The outcome, which outranks everything

| expression | trigger |
|---|---|
| `celebrate` | `.contact-success` appeared — held 2.3 s, with a `hop` and a `laugh` |
| `delivered` | …and then it settles here. A droplet that celebrates indefinitely reads as stuck, not pleased |
| `fail` | `.contact-error[role=alert]` |
| `sad` | …and the same alert still on screen after 9 s. An error that old is not news, and holding the flinch reads as a stuck animation |
| `hold` | `.contact-pending` |
| `effort` | `form[aria-busy="true"]` |

### Reactions — a window, then gone

These share one slot (`beatUntil` / `beatAs`) rather than a flag each: six
booleans with six expiries are six chances for two to be true at once and no
rule about which wins, and the **last** thing to happen to the droplet is by
definition the thing it should be answering.

| expression | trigger |
|---|---|
| `startled` | the droplet was clicked — the **first** time (720 ms) |
| `playful` | clicked **again** inside 2.8 s, plus a `hop` (1.5 s) |
| `laughing` | clicked a **third** time and beyond, plus a `laugh` and a `hop` (2.3 s) |
| `scared` | the pointer **closed on it** faster than 1900 px/s, plus a `shake`. Closing speed, not raw speed: something crossing the screen fast is not coming for him |
| `surprised` | a **paste** into the form, plus a `hop`. A thing appearing, where `startled` is a thing being done to him |
| `confused` | one input event removed 14+ characters — a select-all-and-delete — plus a `shake` |
| `angry` / `doubt` | see the anger policy below. `angry` also fires a `shake` |
| `approve` | a control's `aria-invalid` cleared, plus a small `hop` |
| `waking` | any activity after the ladder went under (950 ms), plus a blink and a stretch |

### Moods

| expression | trigger |
|---|---|
| `shy` | the pointer has been **on** the droplet for over 3 s. Attention held too long stops being flattering |
| `curious` | the pointer is **on** the droplet's silhouette |
| `excited` | the pointer is over the **submit button**. It knows what that button does |
| `doubt` | the focused control is `aria-invalid`, **or** an email past four characters with no `@` |
| `ponder` | typing in the textarea, past 90 characters |
| `working` | typing **uninterrupted for over 2.6 s** — somebody who knows what they want to say |
| `read` | a keystroke within the last 1.1 s |
| `attend` | a field has focus |
| `suspicious` | the pointer has been **within 104 px** for over 2.2 s without touching. Circling him earns a stare, where a fourth identical `dodge` earns nothing |
| `dodge` | the pointer came within 104 px |
| `searching` | the page is moving faster than 1100 px/s (650 ms after it stops) |
| `proud` | **every field is filled and none is flagged**. The one piece of anticipation it has: it looks pleased at a finished form a beat before the visitor sends it |
| `notice` | the pointer moved within the last 2.6 s |

### The life cycle, once nothing above has anything to say

| expression | after |
|---|---|
| `rest` | — |
| `bored` | 15 s with no activity |
| `drowsy` | 32 s |
| `sleeping` | 58 s |

**The ladder is deliberately slow.** A droplet that yawns after four seconds is
commenting on how long you are taking to fill in a form, and nobody asked it to.
These numbers are long enough that a visitor who is actually working never sees
past `rest`, and only somebody who has genuinely walked away does.

**It is built from timestamps, not timers.** The component may not grow a
`setTimeout`, an `IntersectionObserver` or a `visibilitychange` handler — it gave
all three up when it registered with `membrane-runtime`. A droplet falling asleep
on a timer would go on falling asleep in a tab nobody is looking at and would
wake mid-doze when the reader came back; comparing timestamps inside the draw
callback means time only passes while the page is actually being drawn.

**Boredom and sleep release the gaze.** Those poses cannot be held while the
eyes stay locked on the last place the cursor was — that reads as a stare, which
is the opposite of both. `comp.release()` hands the gaze back to the kernel's own
wander, so the eyes drift off first and only then do the lids come down.

### The rejection edge

**Not** the error summary appearing. `ContactForm` keeps that node mounted while
the errors persist, so the second refusal mutates nothing and the companion
never escalates. The signal is the summary **taking focus** — which the form
does on every `submitCount` change so a screen reader hears the complete error
state as one event. One `focusin`, one refusal, no bookkeeping, and it rides an
accessibility behaviour that cannot be dropped without a regression.

### The anger policy

`angerPolicy()` in `Companion.tsx` is the one piece of taste in the shell and is
deliberately isolated so it can be retuned without touching anything else.

- first refusal → `doubt`, held 2.4 s. Everyone mistypes an email once.
- second and later → `angry`, held 2.6 s + 0.9 s per further refusal, to 6 s.
- **it forgives.** Any control clearing `aria-invalid` cancels the scowl
  immediately, and a confirmed send resets the count to zero.

### Validity is polled in the loop, not in the handler

`aria-invalid` is React state. At the moment an `input` event fires, the
re-render that will clear it has not happened, so a handler reads the old value
and the true → false edge is invisible. The companion went on scowling at
somebody who had already fixed their email. The rAF loop is a frame behind the
event, which is exactly the vantage point needed.

## 5. Gates

```bash
npm run companion         # scripts/verify/companion.mjs — the kernel, in node
npm run companion:sheet   # scripts/capture/companion.mjs — geometry at 4x
npm run companion:page    # scripts/capture/companion-page.mjs — the real page
```

`npm run companion` is **89 checks in about 15 seconds** and pins: path
validity, determinism, 60 Hz/120 Hz cadence agreement, **pupil containment**
across every expression × 24 gaze angles with a **hand pressed into the surface**
and a strike travelling, **viewBox containment** with its remaining margin,
anger's crown flatness and surface tautness, the absence of any colour literal in
the kernel, that the **membrane is real** (a hand deforms the contour, the wake
rises and falls, a strike charges and drains, `asleep` is always false), that the
**two eyes can disagree**, the **idle wander** and its override, reachability and
interruptibility of every expression pair, blink/breath/sleep, and allocation
discipline — plus:

- **§4e the eye styles.** Each of `wide`, `iris`, `slant` and `lift` has to move
  the aperture measurably, a flat dash has to be measurably wider than tall and
  a bar taller than wide, `slant` has to be **mirrored** between the eyes, and
  each channel has to be spent by at least three presets. A channel that reads
  nothing is a channel a later taste pass quietly zeroes.
- **§4f the light.** Both hue channels inside 0..1, `lumen` inside 0.2..1.6, no
  pose spending hard on both ends of the axis, the **sleep ladder dimming
  monotonically** (rest → bored → drowsy → sleeping), sleep breathing slower and
  deeper, and the confirmed send being the brightest and fastest thing it does.
- **§4g the gestures.** A wink closes one eye and leaves the other
  byte-identical; the bounce moves `offset` and leaves the **ring untouched**; a
  second push mid-swing bounces higher; a shake decays back to byte-identical
  with a twin that never shook; mirth moves the chest and the eyes together; a
  gesture survives an expression change and keeps `settled` false.
- **§4h the breath.** A celebrating chest measurably beats faster than a
  sleeping one, and a sleeping one is still beating.
- **§4i the vocabulary.** All 23 of the reference's expressions resolve, every
  alias resolves to its pose rather than falling through to `rest`, and all 33
  presets draw a **distinct** silhouette. Two names that settle to the same pose
  are one pose with a spare label, and a contact sheet cannot tell a reviewer
  that.
- **§4j the overshoot.** The expression spring is deliberately underdamped, so
  every channel overshoots on the way in and the widest aperture the droplet
  ever draws **appears in no preset**. Containment is therefore swept
  mid-transition too, over the 20 pairs with the largest eye-geometry gap. This
  did not matter while the eye was always the same round shape; with `wide`,
  `iris` and `open` all live it is exactly where a pupil would escape.

**Containment is measured against the drawn contour, not a model of it.** Once
the membrane could dent the surface by up to `maxN`, an analytic radius stopped
being the truth about where the edge is — `containPupil` takes the companion's
own `radiusAt`, built in the same `step` that built the ring.

`npm run companion:page` needs a dev server and **stubs `/api/contact`** with
`page.route`, so no mail is ever sent. It also gates the travel (docked ->
parked in the gutter -> re-docked to the pixel), the hover and click reactions,
and that the carrier's box corner is **not** a hit target. It is the only artefact that can catch
wiring failures — the two bugs that shipped past the geometry sheet (the
rejection edge that fired once, and the forgiveness that never fired) were both
invisible to it and to a page still.

Run alongside the standing baseline: `npx tsc --noEmit`, `npm run lint`,
`npm run build`, and `npm run legal` / `verify/a11y.mjs` for the contact route.

## 6. Review checklist

At 4x on the geometry sheet, in order:

- every expression is distinct from its neighbours at a glance
- `angry` reads as anger and not as sleep — the tell is the flat crown and the
  dropped inner corners, not narrowed lids on their own
- `doubt` is milder than `angry` by an obvious margin
- `fail` reads as sorrow, not fury — the blame for a 500 is not the visitor's
- `delivered` reads as content, not as unconscious
- no pupil touches the body's edge in any panel
- nothing squares off, kinks or grows a cone anywhere in the sweep

**The closed-eye family is where this goes wrong**, and the sheet is the only
thing that catches it. Eleven of the 33 poses draw some kind of dash, and the
gate's byte-distinctness check passes happily on two that a reader cannot tell
apart. Three were caught and retuned this way and the reasons are worth keeping:

- **`proud` read as `drowsy`.** A low `open` paired with a wide aperture is the
  recipe for sleep. Satisfaction narrows an eye *vertically* while it stays
  round; the pride belongs in the body — the biggest `swell` short of
  celebration, the chin tilted back, the eyes lifted to look past the reader.
- **`waking` read as `bored`.** They were within a hair on every channel. Fixed
  by `askew`: one eye comes up first, which is both true and instantly legible.
- **`sad` read as `fail`**, and they sit next to each other in the trigger
  table. `fail` is a flinch and keeps a rounder eye; sorrow is a long flat one,
  dropped.

## 7. Open

- **The seed is 1.** The lobe is seeded and four seeds are on the sheet; the
  choice between them is a taste call nobody has made.
- **The hover well is strong.** At `maxN: R * 0.26` a held hover pulls the body
  into a teardrop pointing at the cursor. That is the membrane doing its job and
  it reads as the liquid reaching, but it is the loudest thing the companion
  does; trim that constant if it is too much.
- **Mobile runs it.** `membraneMode()` returns `auto` without hover, so `notice`
  and `dodge` rarely fire there and the companion is driven by focus, typing and
  refusals alone. Whether it should idle differently on a phone is open.
