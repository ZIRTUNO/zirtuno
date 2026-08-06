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
