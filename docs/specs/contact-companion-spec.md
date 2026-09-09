# Contact Companion Spec

> `companion.mjs` owns the geometry and spring clock;
> `companion-expressions.mjs` owns poses and scores;
> `companion-behavior.mjs` owns event priorities;
> `Companion.tsx` observes the page; `contact.css` owns the material.

## September 2026 avatar expansion

The owner requested the full expression range, redesigned eyes, emotion-driven
colour and substantially richer interaction. This supersedes the former
cyan-only companion palette and 15-state vocabulary. The exception is confined
to this avatar; the rest of the website retains its cyan-on-black discipline.

The [Bible Strong Avatar Lab](https://github.com/smontlouis/bible-strong-avatar-lab)
is a vocabulary reference. Its 27 semantic eye styles and 23 named animations
are independently authored here for Zirtuno's existing droplet geometry. No
upstream source, exported avatar data, runtime package or dependency is shipped.
The subsequent owner request adds 13 original special eye styles and 18 moods,
bringing the collection to 40 eye styles and 41 moods.

## Shape and animation

One closed liquid body and two eyes remain the complete character. Each eye
has independent width, height and rotation; eye offset, spacing and curvature
complete the vocabulary. A continuous capsule contour spans upright pills,
circles, unequal pupils, horizontal lids, winks and angled brows. Special weights
morph that same contour into hearts, pointed four-tip sparkles and diamonds.
The eyes can also form smiling arches, dreamy lids and a single peeking eye.
No new canvas,
eyebrow element, mouth, raster effect or second liquid engine is introduced.

`EYE_POSES` contains all 40 named presets. `MOOD_SCORES` composes them into the
41 moods below. Every pose participates in a live score. Scores are held poses
joined by the existing underdamped springs; `play()` keeps its phase when called
again with the same mood. `express()` pins a pose for deterministic inspection.
Legacy form-expression names remain supported by the kernel.

The fixed 120 Hz integration clock drives pose transitions, small body bobs,
rocking, breathing and gaze. Body and eyes receive the same final transform,
so animation cannot separate the eyes from the liquid. A held touch can squash
the body and eyes together, then release them through the same springs.
Containment uses the
actual membrane-deformed contour, including presses and travelling strikes.

## Moods and events

| Mood | Live trigger |
|---|---|
| sleeping | More than 45 seconds without activity, focus or hover |
| waking | Initial greeting or activity after a long absence |
| idle | Quiet, with drifting gaze and breathing |
| listening | Recently focused control |
| thinking | A longer message being typed; a slow request |
| searching | A short idle glance around; an accepted but unconfirmed request |
| working | Typing a short value; an in-flight request |
| excited | Changing the form's selected track |
| bored | More than 18 seconds of inactivity |
| suspicious | Typing into a control currently marked invalid |
| angry | Repeated rejected submits, bounded in duration |
| drowsy | More than 30 seconds of inactivity |
| happy | Gentle attention; after relief; settling after confirmed delivery |
| curious | Hover; recent pointer movement |
| confused | First rejected submit; focused invalid control |
| surprised | First direct tap |
| proud | First keyboard or pointer selection of a direction; success tail |
| shy | Close approach; sustained attention; release after a held touch |
| sad | A delivery error, yielding when the reader starts editing again |
| laughing | Three taps close together or brisk petting |
| scared | A rapid approach or a touch held beyond 850 ms |
| playful | Double tap; sustained hover |
| celebrate | Confirmed delivery only, then proud, then happy |
| wink | Tail of a double tap, repeated play or a return greeting |
| affectionate | Gentle strokes across the liquid silhouette |
| starstruck | Fourth tap in a close sequence |
| dizzy | Fifth tap in a close sequence |
| mischievous | Sixth tap; laughter tail |
| embarrassed | Release after a touch held beyond 1.8 seconds; dizziness tail |
| determined | Sustained typing; fourth direction choice; message milestone tail |
| relieved | Correcting an invalid control; recovery after a long press |
| hopeful | Second direction choice; accepted delivery still awaiting confirmation |
| patient | Long unconfirmed delivery or a quietly focused field |
| sleepy-wink | Brief peek between 38 and 42 seconds of inactivity |
| smitten | Heart wink following gentle attention |
| eureka | First message beyond 160 characters; third direction choice |
| squished | A direct touch held beyond 1.4 seconds |
| peekaboo | Window regains focus after an absence |
| focused | More than 2.8 seconds of continuous typing |
| dreaming | More than 70 seconds of inactivity |
| mesmerized | Sustained hover, alternating with ordinary attention |

Form outcomes outrank play. Pending is never celebrated as delivered. A first
refusal earns confusion; subsequent refusals escalate to a brief scowl, with a
six-second ceiling. Correcting any invalid control immediately forgives it.
The rejection signal is the accessible error summary taking focus. Validity is
read after React publishes `aria-invalid`, not inside the input event.

The form validates on blur, which can move its submit control. The browser
gate settles that layout before testing an actual rejected submit; the avatar
does not interpret blur-only validation as an attempted send.

## Emotion colour

CSS mixes cyan with scoped ice-blue, coral, honey-gold and blush colours;
`glow` adds a restrained share of paper. The spring vector carries normalized
`chill`, `cool`, `warm`, `gold`, `blush` and `glow` weights. Geometry remains
expressive without colour. The kernel contains no colour literal, and the
avatar never takes the form's `--color-warn` token.

The body has a 6.5% fill and a 1.15px outline; the eyes carry the same colour.
Colour changes interpolate through the springs. No opacity animation or glow
filter is involved.

## Placement, input and fallback

- The slot always preserves its layout space. On desktop with a sufficiently
  wide shell gutter, the carrier follows the reader and parks at 62% of the
  viewport height. Position integrates elapsed time in bounded substeps, so
  30/60/120 Hz callers do not change travel speed.
- Without a wide enough gutter, the carrier stays in normal document flow.
  It cannot float over the mobile form. Scrolling back restores visibility
  through the same runtime observer.
- `membrane-runtime` owns the frame loop, visibility, geometry and touch tide.
  The adapter parks integration while offscreen. There is no companion rAF or
  scroll listener. The surface runs the same membrane kernel as the CTAs.
- Only the liquid silhouette takes pointer input. The surrounding rectangle,
  eyes and slot remain pointer-transparent. Pointer cancellation and window
  blur release a held press.
- The companion is decorative: `aria-hidden`, no text, no focusable action.
  Keyboard form actions also drive its reactions; form meaning never depends
  on observing the character.
- The deterministic rest pose ships in server HTML. No JS and reduced motion
  retain that complete still pose. A live OS preference change unregisters the
  animation, restores all three paths and clears the emotion colours. Re-enabling
  motion creates a fresh, working registration.
- The form components are not edited for the companion. Their accessible DOM,
  selected track, native events and outcome nodes are read-only signals.
  Typing and milestone reactions use timing and text length; the companion
  never stores or transmits field contents.

## Verification and review

- `npm run companion`: all expressions and eye presets under 24 gaze angles,
  hand pressure and strikes; viewBox margin; cadence and determinism; animated
  score containment; complete 40-pose coverage and 41-mood event reachability;
  interruption, forgiveness, cancellation and truthful outcome priority.
- `npm run companion:sheet`: geometry, eyes and actual CSS palette rendered
  from the kernels. `Z=4` is the default detail review.
- `npm run companion:page`: the current three-track form, real hover and tap
  sequences, star and heart eyes, held squash, keyboard choices, message
  milestones, typing, validation, corrected fields, busy,
  failure, retry, confirmed and pending outcomes; 320/390/768px PT/EN flows;
  no JS and live reduced-motion switching. `/api/contact` is always intercepted.
- `node scripts/capture/companion-review.mjs`: a standalone offline HTML review
  with all moods, all eye presets, live interaction and pause controls. It
  embeds the shipped kernels and extracts the palette from `contact.css`.

The review file is local QA, not a public route or a new step in the user flow.
Browser emulation and geometry gates do not replace owner review on real hardware.
