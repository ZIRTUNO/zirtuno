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
3. **It never leaves cyan.** `chill` is the only colour channel and it runs
   `--color-cyan` → `--color-cyan-deep` — colder, never warmer. The kernel
   contains no colour literal at all, asserted against its own source text.
   `--color-warn` belongs to the form's error copy and is not the companion's
   to spend.
4. **Anger is geometry.** The mood must be legible in a black-and-white
   screenshot: a flatter crown, a tauter surface, a dropped inner brow. Colour
   only agrees with a change that has already happened in the form.
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
| `pulse` | breath amplitude. |
| `chill` | cyan → cyan-deep. The only colour channel, and it is cold. |

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

## 4. The expressions, and what triggers each

| expression | trigger (all DOM-observed) |
|---|---|
| `rest` | nothing happening |
| `notice` | the pointer moved within the last 2.6 s |
| `attend` | a field has focus |
| `read` | a keystroke within the last 1.1 s |
| `ponder` | as `read`, in the textarea, past 90 characters |
| `doubt` | the focused control is `aria-invalid`, **or** an email past four characters with no `@` — **or** the first rejected submit |
| `angry` | the second and every later rejected submit |
| `approve` | a control's `aria-invalid` cleared |
| `effort` | `form[aria-busy="true"]` |
| `hold` | `.contact-pending` |
| `fail` | `.contact-error[role=alert]` |
| `delivered` | `.contact-success` replaced the form |
| `curious` | the pointer is **on** the droplet's silhouette |
| `startled` | the droplet was **clicked** (720 ms) |
| `dodge` | the pointer came within 104 px of the droplet's centre |

Priority runs top-down from `delivered`; the first match wins.

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

`npm run companion` pins: path validity, determinism, 60 Hz/120 Hz cadence
agreement, **pupil containment** across every expression × 24 gaze angles with a
**hand pressed into the surface** and a strike travelling, **viewBox
containment** with its remaining margin, anger's crown flatness and surface
tautness, the absence of any colour literal in the kernel, that the **membrane
is real** (a hand deforms the contour, the wake rises and falls, a strike
charges and drains, `asleep` is always false), that the **two eyes can
disagree**, the **idle wander** and its override, reachability and
interruptibility of every expression pair, blink/breath/sleep, and allocation
discipline.

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
