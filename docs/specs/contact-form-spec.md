# Contact form — one card, three tracks

The September 2026 form redesign is owner-authorized and owner-directed: the
composition is taken from a reference contact page the owner chose, and the
brief was to match it gesture for gesture in this site's own material. It
replaces the three-stage guided brief on `/pt/contact` and `/en/contact`. The
Companion's behaviour, moods and geometry are unchanged; only the selectors it
reads were re-pointed, because the DOM under it moved. The homepage renderer and
the form endpoints are unchanged.

## Composition

A statement column and an instrument column, both inside `.page-x`, so they line
up on the top bar's edge like every other block on the site. The statement
carries the chapter label and the Companion, the display headline, the lead, a
direct line for anyone who would rather talk than type, one line naming what the
studio connects, the response/location rail, and the channel row.

The instrument is a single card holding:

1. **A segmented switch** — a labelled radio group on a recessed bar, with one
   travelling pill.
2. **A window** — `overflow: clip`, holding a track of full-width panels.
3. **One form per track**, each with its own fields, validation, submission id
   and honeypot.

Three tracks are offered. `project` asks what the work is, at what stage, for
what investment and by when. `advisory` asks for a role, an organisation type
and a format. `other` asks nothing beyond the core. A `careers` arrival adds a
fourth track that asks for a role and a link and does not ask for a company; it
is never offered to a commercial arrival.

The core of every track is first name, last name, email, an optional company and
a message whose label and prompt are the track's own. Every qualifier is
optional and every closed list is a native `<select>`.

## Behaviour

**Switching** does two things on one `500ms cubic-bezier(.4, 0, .2, 1)`: the
track translates by exactly one panel width, and the window animates its height
to the incoming panel's. Nothing fades. The pill travels on the same curve and
the labels change colour over the same half-second.

**The switch is CSS.** `:has(input:checked)` drives the translate, the pill's
seat and which panel is visible, so the card works before hydration and with
JavaScript off — a native click re-renders the page and the correct panel is
showing. JavaScript adds one thing: the measured height. Without it the window
is `auto`, which is the tallest panel.

**The window clips; it does not scroll.** `overflow: clip` rather than
`hidden`, because `hidden` makes a scroll container that merely has no
scrollbar — and the browser will scroll one to reveal a focused control. The
window is also one `--slot-pad` larger than the card's content box on every
side, with each panel padding that straight back off, so the clip boundary
falls outside the controls instead of flush against them; padding the panel
alone cannot do it, since that moves the content in by exactly as much as it
moves the boundary out.

**Nothing complains until you try to send.** Validation is `onSubmit` with
`reValidateMode: onChange`. It was `onTouched`, which validates a field as
focus leaves it — so a visitor who tabbed through to see what was being asked,
typing nothing, collected three red refusals and watched the card grow 235px
under them.

**Off stage is hidden, not absent.** A panel that is not showing keeps its box —
the window's height is measured from it and the track needs three panels to have
anything to slide — and is hidden with `visibility`, which removes it from the
tab order and from the accessibility tree. The zero-duration `visibility`
transition is delayed by the slide so the outgoing panel stays on screen for the
whole journey out; the active rule clears the delay so the incoming one is there
from the first frame.

**Delivery** keeps the existing contract. Accepted/pending is distinguished from
confirmed/delivered. A retry of identical data reuses its submission id. Errors
preserve every entry. Busy and pending lock editing and resubmission. A refusal
focuses a linked error summary; correcting one field clears its error without
moving focus. Delivery replaces the card with the receipt and focuses it.

**The name is two fields on screen and one on the wire.** The client joins them
before sending; the API route performs the identical join for a native POST, so
nothing downstream learned a new shape. Qualifiers travel as `details`, keyed by
a closed list, and reach the delivery email as a labelled block that is omitted
entirely when nobody answered any.

**The arriving tab.** `?intent=` still selects the track — `analysis` and
`structure` open `project`, `talk` opens `advisory`, `general` opens `other`,
`careers` adds and opens its own. An ABSENT parameter opens `project` rather
than `other`: "general" is the right default for a tag and the wrong one for a
tab. Within `project`, the `focus` qualifier resolves back to `analysis` or
`structure`, which is where the old chip group's only real distinction went.

## Material

`ContactGlass.tsx` lays three optical planes behind every live control and
behind the travelling pill: real backdrop transmission, a shallow rolled bevel,
and internal edge light. `lib/forms/glass-map.ts` generates the rounded lens's
normal field only on resize, as an uncompressed BMP with no canvas and no
dependency. An SVG `feDisplacementMap` samples it to refract the actual
environment at the rim; the centre stays neutral. The input and its text are
never part of the filter.

The filter and image use explicit pixel dimensions; percentage dimensions on an
`feImage` in a zero-sized definitions SVG sample an empty image in Chromium and
shift the whole surface. Image decoding completes before the enhancement is
enabled. Unsupported filters or a failed optional import retain the layered CSS
surface and the clear native borders. Reduced transparency uses an opaque
surface; forced colors use system borders and a visible selected outline.

The card is a lit surface over ink, not the reference's white panel — a white
card here would be the brightest thing on the site and the headline beside it
would stop being the subject. The tab bar inverts the reference the same way: a
trough DARKER than the card with a pill lighter than both, because what carries
"this one is selected" is which of the two surfaces is nearer the light.

**The lit edge is a loop, and it is even.** Two gradient shapes were tried
before the third worked, and the failures are properties of the gradient rather
than of the values. A LINEAR gradient runs across the box, so each edge gets a
different slice of it and the bright stop ends wherever the angle puts it —
halfway along the top edge, on a 225x53 control at 115deg. A CONIC gradient
runs around the box and does close, but spaces its stops by angle from the
centre: on a 4:1 control the short ends subtend ~26deg against ~154deg for each
long edge, so the loop shut and the ends went nearly black. The rim is now a
VERTICAL ramp — the whole top edge at one end of it, the whole bottom edge at
the other — which makes every edge uniform along its length with nothing
angularly compressed and no stop transparent. The travelling highlight is the
one conic, emitted three times (at the travel position and one turn either
side) so the band crosses the seam instead of being clipped at it.

The rim also sits at `inset: -1px`. `inset` resolves against the PADDING box,
so the moment the border moved onto `.contact-control` the rim was pushed a
pixel inside the hairline it was supposed to be lighting — two concentric
edges a pixel apart whose corner arcs did not even share a centre.

**One border, on the element that hosts the glass.** The card first shipped
with three outline systems on every control — the input's own `1px solid`, the
laminate's gradient rim, and a live Bézier contour that `FieldLiquid` drew in
place of the border — and every field came out doubled and seamed. A spline
through ring vertices cannot sit exactly on a CSS rounded rectangle, and the
kernel's corner radius (10) disagreed with the stylesheet's (14) besides. The
vector layer and its travelling drop were retired on owner instruction; the
border now lives on `.contact-control` alongside the glass, so the hairline,
the rim gradient, the radius and the focus ring are one box with one radius.

The drop is worth a note because its removal fixed more than it looked like it
would. It rode a control's LEFT edge, so on the right-hand column of a paired
row half its 22px body hung over the field beside it. Its `wet` state lit one
arbitrary control brighter than the rest on a clock no reader could perceive.
And its travel needed 96px of drawing surface bleeding past the form, which
counted toward the scrollable overflow of the card's window — so tabbing to the
submit button scrolled the panel 110px inside its own frame, with no scrollbar
and no gesture that could put it back. The membrane belongs on the CTAs, where
the whole button is the membrane and nothing rigid is left behind by it.

Labels are set in the body face at full strength rather than in the site's mono
overline: above a control, an uppercase mono label reads as a heading for a
section rather than as the name of the box under it. The mono voice stays where
it belongs on this page — the chapter label, the receipt, the numbered steps.

## Verification

- `node scripts/verify/contact-journey.mjs`: arrival track, one panel on stage,
  measured window, seated pill, keyboard and pointer switching, the drained
  bead, focused refusal, the joined name, the resolved intent, the answered
  qualifiers, sending lock, rate limits, idempotent retries, pending versus
  delivered, the careers track, four viewports across both locales under reduced
  motion, and a real no-JS switch and POST.
- `node scripts/verify/contact-optics.mjs`: injects a temporary calibration
  pattern in the test browser and compares displaced against neutral backdrop
  pixels. Distortion must be present at the bevel and quiet in the centre.
- `node scripts/verify/a11y.mjs`: exactly one track exposed, every control
  labelled, a labelled radio group, the honeypot out of the tab order, a native
  POST, and the intent handshake.
- `node scripts/verify/companion.mjs` and `node scripts/capture/companion-page.mjs`:
  the Companion's full mood vocabulary still reachable through the card's events.
  The Companion itself is unchanged; it reads `.contact-slot[data-active]` to
  know which of the three forms the visitor is in.

Captures and reports live under `captures/contact-*`. Emulation establishes the
regression floor; real Safari optics, mobile keyboard and URL-bar behaviour, and
the owner's material judgment still need hardware review.

Technical references: [SVG displacement](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap),
[backdrop filtering](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)
and [`checkVisibility`](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility).
