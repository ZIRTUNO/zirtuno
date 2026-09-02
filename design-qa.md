# Hero motion design QA

## Comparison target

- Source visual truth: `C:/Users/pedro/Desktop/04_Repositorios_Sites/REPOSITORIOS/ZIRTUNO WEBSITE/artifacts/hero-motion-audit/04-reference-stable.png`
- Source motion sequence: `C:/Users/pedro/Desktop/04_Repositorios_Sites/REPOSITORIOS/ZIRTUNO WEBSITE/artifacts/hero-motion-audit/reference-contact-sheet.png`
- Implementation screenshot: `C:/Users/pedro/Desktop/04_Repositorios_Sites/REPOSITORIOS/ZIRTUNO WEBSITE/artifacts/hero-motion-audit/02-refined-stable.png`
- Full-view comparison: `C:/Users/pedro/Desktop/04_Repositorios_Sites/REPOSITORIOS/ZIRTUNO WEBSITE/artifacts/hero-motion-audit/05-reference-vs-zirtuno.png`
- Focused text comparison: `C:/Users/pedro/Desktop/04_Repositorios_Sites/REPOSITORIOS/ZIRTUNO WEBSITE/artifacts/hero-motion-audit/09-text-focus-comparison.png`
- Route: `http://127.0.0.1:3000/pt?faudit=1`
- State: desktop, dark theme, initial word (`future` / `futuro`), proof row before its sequential resolution.
- CSS viewport: 1268 x 714 px.
- Source pixels: 1268 x 714. Implementation pixels: 1268 x 714. Device density was normalized by capturing both in the same in-app browser viewport; no resampling was used for the full-view comparison.

## Findings

No actionable P0, P1, or P2 mismatch remains in the refined Hero.

- Typography: the source's quiet-light sentence, bold rotating noun, deliberate two-line break, and stronger second-line phrase are preserved with Bricolage Grotesque and the locked display tokens. The implementation avoids the previous oversized ticker treatment and keeps the baseline stable during the exchange.
- Spacing and layout: headline, supporting copy, proof callouts, and action form a clear centered stack with comparable density to the reference. The CTA is an intentional Zirtuno conversion requirement and remains above the fold.
- Colors and tokens: paper-on-black hierarchy and cyan interaction accents use the locked Zirtuno palette. The reference's rainbow material is intentionally not copied.
- Image and liquid fidelity: the reference ribbon informed the silhouette and low-stage placement. Production renders the band with the existing persistent 48-droplet field rather than a copied marketplace asset or a second canvas.
- Copy and content: all visible claims are authored Zirtuno PT-BR/EN copy. The reference wording and product claims were not copied.
- Interaction and polish: letters depart right-to-left and arrive left-to-right; line width recentres with the same authored ease; proof rings, ticks, labels, and rules share one three-second cycle; camera movement is frame-rate-independent and parks at rest.
- Responsiveness and accessibility: the device matrix reports no overflow at 390 x 844 or 412 x 915, reduced motion keeps a complete static reading path, the page preserves one semantic h1, and the no-JavaScript route is visible.

## Full-view comparison evidence

The combined capture shows that both designs establish the same visual order: mixed-weight two-line headline, restrained explanatory line, small sequential proof row, then the lower visual/action zone. Zirtuno's top chrome, chapter rail, CTA, and cyan-only material are intentional product constraints rather than fidelity drift.

## Focused region comparison evidence

The text crop confirms comparable headline scale, line count, weight contrast, supporting-copy measure, and proof-row span. Focused evidence was necessary because the full-view comparison makes the small callout hierarchy difficult to judge.

## Comparison history

### Audit pass 0 — blocked

- P1: production mounted `HeroRibbon` in addition to the persistent homepage field, breaking the one-canvas identity.
- P1: cold-load content could remain at opacity zero when the page transition did not advance.
- P2: the changing word moved as a whole by 88% with a 9 px blur, creating a ticker-like mechanical exchange rather than the reference's per-letter baseline choreography.
- P2: headline wrapping was uncontrolled and the production Hero exposed a lab/test badge.

### Fixes applied

- Removed the production `HeroRibbon`; the existing site scene now authors the Hero band with the canonical 48 droplets.
- Made the page-transition content visible on a document's first paint and kept the wipe for client navigation only.
- Rebuilt the word exchange per character with restrained travel, directional stagger, measured width easing, and one shared three-second cycle.
- Rebuilt proof callouts on that same cycle and replaced the free wrap with two deliberate headline lines plus a tablet/mobile wrap boundary.
- Removed the test badge from production while keeping it in the isolated lab.

### Post-fix evidence

- Visual: `05-reference-vs-zirtuno.png` and `09-text-focus-comparison.png`.
- One-canvas gate: one liquid canvas on load and after scrolling to the end.
- Device gate: live iPhone-class and Android-lite paths, no horizontal overflow, and one live canvas.
- Accessibility gate: PT/EN semantics, keyboard, contrast, reduced motion, and no-JavaScript path all green.
- Cinematic gate: two act fades, one Origin flash, living Work/Studio/Footer liquid, and transient contrast all green.

## Open questions

- None blocking. The level-at-rest text plane and cyan-only liquid are intentional Zirtuno adaptations; the reference's permanent mockup skew and rainbow material are not reproduced.

## Implementation checklist

- [x] Match mixed-weight hierarchy and deliberate line breaks.
- [x] Match directional per-letter word exchange and recentering.
- [x] Synchronize proof callouts to the word cycle.
- [x] Preserve one persistent liquid canvas and canonical droplets.
- [x] Preserve CTA intent, locale parity, reduced motion, and no-JavaScript reading.
- [x] Verify build, lint, types, devices, canvas count, conductor, cinematics, CTA, and accessibility.

## Follow-up polish

- P3: owner taste review on a real high-refresh display can still tune the final 40-80 ms of letter stagger and the band amplitude without changing the motion model.

final result: passed

---

# S7 Origin design QA

## Comparison target

- Source opening: `C:/Users/pedro/.codex/generated_images/01a034d8-7713-7733-b511-81c51d209a22/exec-c5ac92f9-d70a-4b8c-bfda-f29288822125.png`
- Source two-idea state: `C:/Users/pedro/.codex/generated_images/01a034d8-7713-7733-b511-81c51d209a22/exec-876d5f7d-5ab8-4536-8385-b0b0d5466909.png`
- Source purpose state: `C:/Users/pedro/.codex/generated_images/01a034d8-7713-7733-b511-81c51d209a22/exec-4313b7cb-fa72-4f52-bdc7-8eb1c4457aa6.png`
- Implementation opening: `C:/Users/pedro/AppData/Local/Temp/zirtuno-origin-design-qa/implementation-opening-1487x1058-pass3.png`
- Implementation two-idea state: `C:/Users/pedro/AppData/Local/Temp/zirtuno-origin-design-qa/implementation-ideas-1487x1058.png`
- Implementation purpose state: `C:/Users/pedro/AppData/Local/Temp/zirtuno-origin-design-qa/implementation-purpose-1487x1058-pass5.png`
- Supplemental mobile purpose state: `C:/Users/pedro/AppData/Local/Temp/zirtuno-origin-design-qa/implementation-purpose-mobile-390x844.png`
- Route: `http://127.0.0.1:3000/en?ftier=full#name`
- Desktop CSS viewport and image pixels: 1487 x 1058 at density 1. Source and implementation states were compared without resampling.
- Mobile CSS viewport and image pixels: 390 x 844 at density 1.

## Final findings

No actionable P0, P1, or P2 mismatch remains in S7.

- Composition: the rejected dossier, giant chapter number, HUD labels, gauges, ruled panels, ladder, and card-like frames no longer render. The chapter is an unframed editorial sequence.
- Story: the protected five-beat Origin sequence remains exact: two ideas, tension and fusion, exact mark with the three pillars, purpose, then the wordmark resolution.
- Brand fidelity: the liquid remains the canonical cyan-on-black 48-droplet field, the traced mark endpoint remains exact, and the chapter uses the locked Zirtuno type roles. No purple, rainbow material, marketplace pattern, or full-page fusion flash was introduced.
- Typography: large Bricolage display text is plain paper rather than a generic glow-gradient treatment; Instrument Serif appears only in the poetic echo; mono is limited to structural labels and the three-pillar line.
- Motion: the same liquid shifts left during the purpose beat while the copy resolves on the right. Echo droplets are fewer and tighter, and the dawn exposure is restrained so the effect supports the argument instead of becoming a decorative spectacle.
- Responsiveness: the ideas and tension beats stack cleanly on 390 px, the purpose beat becomes mark-above-copy, and the S7 copy remains within the viewport. A separate inherited Contact `fl-svg` extends the document scroll width outside S7; it was not changed in this bounded Origin revamp.
- Accessibility and semantics: the complete story remains server-rendered, headings and landmark order remain valid in PT/EN, keyboard and reduced-motion paths pass, and the one-canvas contract remains intact.

## Full-view and focused comparison evidence

The opening comparison now matches the reference's reduced density: one small chapter cue, one headline, one short lead, and a quiet field with no supporting interface chrome. The two-idea comparison preserves the reference's balanced tension but uses Zirtuno's authored left-aligned editorial reading instead of centered generated-mockup copy. The purpose comparison matches the asymmetric mark-left / statement-right composition while retaining the protected three-pillar beat immediately before it.

The 1487 x 1058 full states were sufficient to judge the headline measure, idea balance, mark scale, liquid/copy separation, and purpose baseline. The 390 x 844 supplemental capture verifies the authored mobile reflow rather than attempting to crop the desktop reference into a false mobile target.

## Comparison history

### Initial audit

- P1: mobile idea content inherited a desktop three-column source order and rendered off-screen.
- P1: the mobile tension clauses collapsed into a narrow column.
- P2: the opening sat too low and retained generic cyan horizon/glass-gradient cues.
- P2: the purpose copy sat below the liquid instead of forming the required asymmetric cut.
- P2: the original S7 dossier/HUD vocabulary overwhelmed the Origin argument and read as a generated interface theme rather than Zirtuno.

### Fixes and re-checks

- Rebuilt S7 as five semantic beats with no rejected interface scaffolding.
- Added explicit mobile grid order and full-width clause rules.
- Moved the opening upward, removed the S7 display gradient, and reduced the dawn wash.
- Tightened the echo orbit and shifted the exact mark field left during Beat 4 while keeping the mobile stage centered.
- Re-captured and compared the final purpose state after the last scene shift.

## Verification evidence

- TypeScript: passed.
- Targeted ESLint: passed.
- Full lint: passed with one pre-existing warning in `scripts/verify-cinematics.mjs` and no errors.
- Production build: passed.
- Conductor: 48 droplets, 0 failures.
- Cinematics: passed; exactly two act fades, flash-free Origin, contrast floor preserved.
- Canvas count: exactly one liquid canvas.
- Accessibility: PT/EN parity, semantics, keyboard, contrast, reduced motion, and no-JavaScript paths passed.
- Origin band probes: desktop 1440 x 900 and mobile 390 x 844 passed.
- Local preview: HTTP 200 at `/en?ftier=full`.

## Intentional differences from the generated references

- Plain paper display type replaces the reference's cyan text gradient to keep the chapter discreet and recognizably Zirtuno.
- The three business pillars stay in their protected Beat 3 instead of being repeated beneath the purpose statement.
- The idea descriptions are left-aligned for a calmer editorial read.
- Existing site chrome and the chapter rail remain because they are shared navigation, not part of the retired S7 HUD.

final result: passed

---

# Footer Design QA

## Evidence

- Visual truth: `C:/Users/pedro/AppData/Local/Temp/codex-clipboard-4540765a-ada3-435a-aece-6782666cadbd.png`
- Initial implementation: `C:/Users/pedro/AppData/Local/Temp/codex-clipboard-596225f7-be95-41ed-b0a3-451f0d645fbe.png`
- Rejected first pass: `artifacts/footer-design-qa/implementation-en-1513x527.png`
- Final implementation: `artifacts/footer-design-qa/implementation-en-1513x527-round2-final.png`
- Full-view comparison: `artifacts/footer-design-qa/reference-vs-implementation-round2-final.png`
- Focused footer comparison: `artifacts/footer-design-qa/reference-vs-implementation-round2-final-focused.png`
- Supplemental desktop: `artifacts/footer-design-qa/implementation-en-1790x760-round2-final.png`
- Supplemental mobile: `artifacts/footer-design-qa/implementation-pt-390x844-round2-final.png`
- Source viewport: 1513 x 527 px after excluding the 30 px Windows taskbar from the supplied screenshot.
- Implementation viewport: 1514 x 527 CSS px at density 1. The in-app browser's content screenshot was 1503 x 524 px after its scrollbar/chrome exclusion and was normalized to 1513 x 527 for the comparison board.
- State: English homepage footer coda, panel top aligned to 50 px, floating top bar parked above the viewport, persistent liquid release present, and environment-approved Instagram and WhatsApp links rendered.

## Comparison history

1. Baseline: the panel was too wide, too tall, too rounded, and too close to the viewport edges; its internal padding, wordmark, headings, rows, divider, copyright, and social marks all used materially different dimensions from the reference.
2. Rejected first pass: raw offsets matched at 1513 px, but the footer became too short and sat too low at the owner's 1790 x 760 review size; the fixed top bar also remained visibly layered over the coda.
3. Responsive-frame fix: restored the reference's proportions with a viewport-aware panel height, width-scaled inner padding, a local text size bounded by the existing body tiers, and a wordmark/mark relationship that holds at both desktop widths.
4. Coda-chrome fix: the floating top bar now parks above the viewport when at least 24% of the footer is visible and returns through `:focus-within`, removing the visible overlay without making keyboard navigation an invisible stop.
5. Final pixel pass: panel x/y is 85.1/50.2 versus 85/50; brand x/y is 160.1/140 versus 159/139; wordmark y is 208.3 versus 208; tagline y is 286.8 versus 285; rule y is 380.5 versus 380; copyright y is 438.7 versus 439; social-row y is 432.5 versus 432.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none actionable. Remaining visible differences are required product constraints: Zirtuno branding/copy and cyan-on-black palette, the authored Work with us route, environment-gated social links, and the persistent release droplet/chapter rail/cursor.
- Typography: the final wordmark, headings, links, tagline, and copyright now match the target's optical scale while staying inside the locked Bricolage/Geist role system.
- Layout: panel inset, radius, top padding, columns, 32 px row cadence at the source width, rule, base row, and social edge align within 0.2-3 px of the measured target.
- Colors/assets: the cream palette and UpSunday assets remain intentionally replaced by Zirtuno's locked cyan-on-black tokens and supplied brand mark; no substitute artwork was fabricated.
- Copy/content: the English comparison preserves the target hierarchy; the additional Work with us link remains because it is a required Zirtuno route.
- Responsive/accessibility: no footer element overflows at 390 x 844, social targets remain 44 px, PT legal copy wraps cleanly, and the a11y/CTA suites pass keyboard, locale, reduced-motion, no-JS, and contact semantics.
- Verification: TypeScript passed; lint passed with five pre-existing warnings and zero errors; the isolated production build passed; HTTP returned 200. The cinematic gate confirms the footer release remains alive (`delta=48622`); its full run still reports the pre-existing transient `cta-label-ink` contrast failure outside the footer.

final result: passed
