# Dead Code quarantine

This folder preserves code removed from the active Zirtuno application. Files
here are intentionally excluded from TypeScript, ESLint, Next.js routing, and
deployment. Nothing in the active app may import from `Dead Code/`.

## 2026-09-05 S10 contact RESTORED — as a route, not a chapter

The 2026-09-04 entry below said the replacement destination was under
development. It exists: `app/[locale]/contact/page.tsx`. The quarantine is
lifted, and the pieces of it that came back are recorded here so the entry
below is read as history rather than as current state.

### What came back, and where it went

- `components/chapters/FieldLiquid.tsx` → `components/contact/FieldLiquid.tsx`,
  unchanged. It finds its controls through `.field input, .field textarea`
  inside the closest `<form>`, so it transplanted without an edit. Verified
  live: `data-fieldliquid="full"`, four contours drawn, the CSS border handed
  over, and the bead detaching and re-fusing across a focus change.
- `app/contact-section.css` → `app/contact.css`, rewritten rather than pasted.
  The form, `.field`, error-summary and FieldLiquid blocks are carried over
  verbatim; the page's own layout (the split, the panel, the intent chips, the
  meta rail, the channels, the next-steps row) is new. It is imported by the
  contact page alone, the way `app/lab.css` is imported by the lab layout.
- `components/chapters/ContactForm.tsx` → `components/contact/ContactForm.tsx`.
  The delivery contract is the same file's: react-hook-form + the shared Zod
  schema, the honeypot, the aggregate error summary, the confirmed/pending/
  failed states, the native POST, the conversion tagging. Two changes — the
  intent is a VISIBLE radio group instead of a hidden input, and the
  `zirtuno:exhale` dispatch is gone because this page has no `PageStage` to
  receive it.

### What stayed quarantined, and why

- `ChapterContact.tsx` — a section shell for a homepage chapter. The page is
  its replacement, not its host.
- `ContactMetaball.tsx` and `lib/webgl/scenes/contact.ts` — both grip
  `.contact-metaball-stage`, a homepage stage box. The contact page runs no
  WebGL at all (see the header of `app/contact.css` for the reasoning), so
  neither has anything to attach to.
- `scripts/obsolete/verify-cta.mjs` and `capture-field-liquid.mjs` — both
  target `#contact` on the homepage. Their subjects are covered now by the
  restored contact assertions in `scripts/verify/a11y.mjs` and by the new
  `scripts/probe/contact.mjs`.

### What changed in the code that stayed

- `components/chrome/CtaButton.tsx` — `INTENT_DESTINATION_READY` is `true` and
  points at `/contact`. All nine intent placements re-armed at once, which is
  what the flag was for. **The same-page scroll path was DELETED**, not
  disabled: it existed to avoid a navigation on the homepage, and with
  `#contact` no longer on the homepage it could only fall through to the routed
  href it was written to avoid. Its Lenis dependency, its `zirtuno:intent`
  custom event and its layout-growth correction went with it.
- `components/lab/LabHero.tsx` — now reads `useCtaIntent` instead of being a
  hard-coded inert button. That hand-rolling is exactly why it was the one
  element still linking to `/?intent=analysis#contact` after the quarantine and
  had to be switched off separately.
- `app/api/contact/route.ts` — the no-JS 303 goes to `/{locale}/contact?contact=…`
  instead of `/{locale}?contact=…#contact`.
- `components/chrome/Footer.tsx` — the contact line is back in the company
  column, untagged.
- `app/sitemap.ts` — `/contact` listed at 0.8, without a query.
- `scripts/verify/a11y.mjs` — the form assertions are restored against the
  route and extended to cover the intent chooser. The redirect assertion pins
  the new target.
- `lib/i18n/messages/*.json` — the `contact` block gained the page-level keys.
  `fields.message` went from a sentence to "Mensagem"/"Message" (it was doing
  prompt duty for a chapter that had no form heading) and `intents.general`
  from "Contato"/"Contact" to "Outro assunto"/"Something else" (as a chip on
  the contact page, the old label named the page you were already on).

### Still true from the entry below

`lib/content/chapters.ts` deliberately still has eight entries and contact is
not among them. It is a route now; SideIndex and MobileMenu index homepage
chapters, and a mark pointing at a section that is not on the page would be the
same bug the removal fixed. `lib/webgl/scenes/footer.ts` still claims nothing —
its `.contact-metaball-stage` anchor stays null-safe and unreached, because the
held mark that note describes belonged to the chapter and did not come back.

## 2026-09-04 S10 contact removal (superseded by the entry above)

The contact chapter — the site's LAST section and its only form — was removed
at the owner's request and preserved here whole. This was not an audit finding:
the code is live, correct and passing; it is quarantined because the section is
being reconsidered, and the replacement destination is under development.

### What moved

- `components/chapters/ChapterContact.tsx` — the section shell (label, prompt,
  sub-prompt, metaball stage, form).
- `components/chapters/ContactForm.tsx` — the react-hook-form + Zod form, the
  honeypot, the intent handshake, the aggregate error summary, the success /
  pending / error states and the `zirtuno:exhale` dispatch.
- `components/chapters/ContactMetaball.tsx` — the stage box and static
  `LogoMark` fallback.
- `components/chapters/FieldLiquid.tsx` — the vector liquid over the controls.
  Its kernel, `lib/motion/coalesce.mjs`, deliberately STAYED ACTIVE: it is
  DOM-free and still gated by `npm run liquid:form` and
  `npm run liquid:form:sheet`, so the merge geometry cannot rot while the form
  it dresses is away.
- `lib/webgl/scenes/contact.ts` — the S10 liquid scene. It grips
  `.contact-metaball-stage`, so without the chapter it can never reach
  presence; it was unregistered from the journey in `PageStage.tsx` rather than
  left to sit at zero.
- `app/contact-section.css` — every rule the chapter owned, lifted out of
  `app/globals.css` in source order. Includes the generic `.field` control
  styles, which the contact form was the only consumer of.
- `scripts/obsolete/verify-cta.mjs` — the conversion-path gate. Its entire
  subject was the route INTO the form.
- `scripts/obsolete/capture-field-liquid.mjs` — the page contact sheet for
  FieldLiquid. Needs a mounted form to photograph.

### What deliberately did NOT move

- `app/api/contact/route.ts` and `app/api/contact/webhook/route.ts`, plus
  `lib/forms/contact.ts` (the Zod schema and intent resolver they share). The
  endpoint is intact and still verified: `verify/a11y.mjs` keeps asserting that
  a form-encoded POST returns a 303 to a localized status.
- The `contact` i18n block in `messages/*.json`. Nothing renders it; keeping the
  key trees identical keeps `verify/a11y.mjs`'s parity check meaningful and
  makes the restore a re-mount rather than a re-translation.
- `react-hook-form` and `@hookform/resolvers` in `package.json`. Now unused by
  active code, kept so a restore does not need an install.

### What changed in the code that stayed

- `app/[locale]/page.tsx` — chapter unmounted; the page now ends on Studio +
  Footer. Its `searchParams` prop went with the intent plumbing.
- `lib/content/chapters.ts` — `contact` dropped from the index, so SideIndex
  and MobileMenu stop offering a mark for a section that is not there.
- `components/field/PageStage.tsx` — contact scene unregistered, its two
  `FLOW_OBSTACLES` entries removed, the `zirtuno:exhale` listener removed.
- `components/chrome/Footer.tsx` — the `/#contact` column link removed.
- `components/chrome/CtaButton.tsx` — **the conversion path is switched off,
  not deleted.** `INTENT_DESTINATION_READY` is `false`, so the nine intent
  placements render as inert `<button aria-disabled>` instead of linking to a
  hash that no longer resolves. Every piece of the routing, the same-page Lenis
  scroll and the analytics tagging is untouched behind that flag. Flipping it
  back to `true` re-arms all nine at once.
- `components/chrome/MobileMenu.tsx` — the sheet's third card follows the same
  flag and does NOT close the sheet while inert. Card 2's mailto is untouched,
  so the sheet still offers a live direct line.
- `scripts/verify/a11y.mjs` — the form assertions (labelled fields, labelled
  submit, no-JS POST markup) removed; chapter counts now eight. Everything else
  the gate covers is unchanged.
- `components/lab/LabHero.tsx` — its CTA is hand-rolled rather than a
  `CtaButton`, so the flag above could not reach it and it was the one element
  still linking to `/?intent=analysis#contact`. Now an inert button like the
  rest; its now-unused `Link` import went with it.
- `scripts/verify/devices.mjs` — the "labeled contact submit is reachable"
  check removed; chapter count now eight.
- `scripts/capture/chapters.mjs` — the `S10 contact` capture row commented out
  (it targets `.contact-metaball-stage`), so `npm run chapters:sheet` still runs.
- `scripts/verify/a11y.mjs` — additionally, `#problem a.cta` became
  `#problem .cta`. An intent CTA is a `<button>` while it is inert, and the
  element-specific selector made the gate TIME OUT rather than fail a check.
- `scripts/probe/shot.mjs`, `scripts/capture/record-liquid-motion.mjs`,
  `scripts/capture/transition-diagnostics.mjs` — `#contact` targets dropped.
  The diagnostics range `contact-gather-release` was RETARGETED onto studio's
  bottom as `coda-release`: `anchors.contact` would otherwise have read 0 and
  silently scrubbed the whole document into 26 frames.

### One consequence worth knowing before restoring

`lib/webgl/scenes/footer.ts` was written as a coda that claims nothing
(`forms: []`, every target at radius 0) precisely BECAUSE contact held the
resting mark above the form all the way to the page's bottom. With S10 gone
there is no held mark, so the footer's only remaining contribution is the
closing exposure/vignette grade. Its `.contact-metaball-stage` anchor is
null-safe and was left declared, so restoring the chapter restores the held
mark with no edit there.

## 2026-09-03 secondary CTA removal

- `components/chrome/Thread.tsx` — the animated underline used only by the
  removed text-and-arrow secondary CTA family. Its `makeThread` kernel and
  declarations were removed from `lib/motion/membrane.mjs` and
  `lib/motion/membrane.d.mts`; restore all three parts together if this visual
  family is ever deliberately reintroduced.

## 2026-08-31 full audit

Evidence used before quarantine:

- a static import/re-export/dynamic-import reachability graph rooted at every
  Next.js route and application entry point;
- package-script and specification references for standalone tools;
- explicit replacement notes in the source; and
- pre-cleanup TypeScript, dependency, selector, and package-usage checks.

### Runtime modules

- `components/chapters/ProjectCard.tsx` and `ProjectCard.css` — replaced by the
  live `components/work/WorkGallery.tsx` `.zw-*` gallery.
- `components/hero/MetaballCanvas.tsx`, `MetaballField.tsx`,
  `SdfGlassField.tsx`, `PerfOverlay.tsx`, `PillarIndicator.tsx`, and
  `legacy-hero-shell.css` — the former hero shell was no longer mounted after
  the cinematic ribbon became the live Hero.
- `components/field/hero-liquid-context.ts` — its only consumer was the removed
  hero shell; the provider and unused scene controls were removed together.
- `lib/webgl/scenes/stream.ts` — an unregistered experimental conductor scene;
  production uses `HeroRibbon`.
- `lib/sanity/schema.ts` — a future Studio schema with no Sanity Studio config
  or active import. Runtime content queries and types remain active.

The exact form renderer was not discarded. It moved from
`components/hero/FieldMorphHero.tsx` to the active
`components/lab/FormStillRenderer.tsx` and is mounted only at the no-index
`/[locale]/lab/forms` QA route.

### Obsolete verification and capture tools

- `capture-morph-frames.mjs` — self-declared dead homepage morph harness;
  `capture-morph-scrub.mjs` now captures the live Services morph.
- `capture-field-live.mjs`, `verify-autocycle.mjs`, and `verify-live.mjs` —
  depended on the removed interactive metaball hero shell.
- `capture-converge.mjs` and `capture-eco-pulse.mjs` — described the retired
  mark-convergence/HUD presentation; the confluence and gathering gates replace
  them.
- `verify-baseline.mjs` — measured a retired raymarch-era performance premise.
- `verify-responsive.mjs` — superseded by the R5-E `verify-devices.mjs` matrix.
- `verify-site.mjs` — asserted retired hero and organism selectors.

### One-off scratch diagnostics

Unreferenced `_cmp-*`, `_film-*`, `_mark-*`, `_probe-*`, `_ref-*`, `_ring-*`,
`_sheet-*`, `_shot-*`, `_spray-*`, `_strip*`, and `_sweep-*` files were moved to
`scripts/scratch/`. Named production gates, generators, reusable capture tools,
and helper modules with incoming imports remain active.

## Restore procedure

1. Move the required file back to its original active path.
2. Reconnect imports, package scripts, selectors, or route registration.
3. Remove or update its entry above.
4. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and every mapped
   feature gate before treating the code as active again.
