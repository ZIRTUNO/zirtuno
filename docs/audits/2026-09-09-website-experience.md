# Website experience audit — September 8–9, 2026

The audit corrected mobile overflow, an inaccessible small-phone project viewer,
repeated animation layout work, and atmospheric lifecycle failures. The follow-up
enlarged the seven Services forms and separated portrait reading stops from morph
transitions. The local production preview is at http://localhost:3000/pt.

## 1. Browse the homepage and Services — improved

The original mobile Services scale drew the first form about 100px wide at
320×568. Its scale now grows with the available width, with a height limit for
short phones and portrait tablets. At 320×568 it increases 82%; at 390×844 and
430×932 it increases 95%. This applies to the form and its droplet bridge together.
The SVG endpoints, material, correspondence and desktop scale are unchanged.

Landscape screens at least 640px wide and no more than 512px tall use two columns,
keeping the larger liquid beside the text. Portrait copy clears as it leaves the
reading stop, so it no longer travels through the larger morph. Focused controls
and open details remain visible. Reduced motion, no-JS and no-WebGL retain the
complete static reading path. Unsupported scroll timelines keep the normal copy.
The enhancement uses the browser's [view progress timeline](https://www.w3.org/TR/scroll-animations-1/#view-timelines),
without adding a per-frame JavaScript scroll listener.

Before and after at the same 320×568 service stop:

![Before: small form](../../captures/audit-2026-09-08/morphs-before/320x568-01-rest.png)
![After: larger form and clear reading stop](../../captures/audit-2026-09-08/morphs-final/320x568-01-rest.png)

[All seven forms and six bridges, small phone](../../captures/audit-2026-09-08/morphs-final/320x568-sheet.png)
· [Large phone](../../captures/audit-2026-09-08/morphs-final/430x932-sheet.png)
· [Tablet](../../captures/audit-2026-09-08/morphs-final/768x1024-sheet.png)
· [Landscape phone](../../captures/audit-2026-09-08/morphs-final/844x390-sheet.png).

The broader audit also removed two sources of document overflow: oversized
decorative CTA SVG layout boxes, and the invisible Portuguese headline measuring
rig. The membrane still has room to deform and draw its focus contour.

## 2. Open and close a project — corrected

At 320×568 the close control originally extended below the viewport, and the copy
could lose its beginning. The panel now reserves the complete 44px close target
and bottom gutter. The text pane scrolls natively while the background is locked;
both project links can be reached. Escape restores focus to the source card.

![Project links and close control remain reachable](../../captures/audit-2026-09-08/work-after/320-links.png)

The gallery no longer clears and restores the source card's styles every frame.
The measured opening previously caused 264–448 source-card style mutations across
the five tested viewports; the corrected version causes zero. This removes a
specific forced-layout cost without changing the gallery's visual transition.

## 3. Contact — interface passes; delivery configuration remains a launch requirement

The contact journey checks passed for the three tracks, responsive controls,
validation, pending/error/delivered distinctions, and the no-JS form path. The
visible fields use 16px input text at phone widths. No form redesign was introduced
by this audit.

![Mobile contact fields and visible focus](../../captures/audit-2026-09-08/03-contact-fields.png)

The local endpoint reports missing delivery configuration. Before a launch,
configure `RESEND_API_KEY` (provider authentication), `CONTACT_EMAIL_FROM` (verified
sender), `CONTACT_EMAIL_TO` (the receiving team), and `CONTACT_DELIVERY_READY`
(the application's readiness gate). These come from the existing delivery code
and environment verification script. Keep credentials private. The interface
tests do not establish successful email delivery.

## 4. Navigation, remaining routes, and animation recovery — verified

The route audit covered PT and EN homepages, project listings, both case studies,
careers, contact, privacy, terms, cookies, and missing-page handling at 320×568,
390×844, 844×390, 768×1024, and 1440×900: 100 combinations, with zero document
overflow, clipped inspected content, page errors, or unexpected status codes in
the final route matrix. This matrix preceded the additional Services-only changes;
those received the separate 91-state review described below.

The atmosphere now rebinds its hero gate after client navigation, rebuilds after
WebGL context restoration, and responds to live reduced-motion changes. Its idle
layout reads fell from 50 in the 2.1-second probe to zero. It retains resizing and
the original particle material. The liquid context-loss drill also passed.

## Verification and evidence limits

| Check | Result | Evidence |
|---|---|---|
| Public routes and responsive content | 100 combinations passed | `site-final.log`, `after/report.json` |
| Services, PT | 78 states across six viewports passed; every rest fully readable | `morphs-final.log`, `morphs-final/report.json` |
| Services, EN | 13 states passed; focus, open details, reduced motion, no-JS and no-WebGL passed | `morphs-en.log` |
| Gallery | Five viewports; native scrolling, links, close geometry and focus passed | `work-final.log` |
| Atmosphere | Seven lifecycle/layout checks passed | `aura-after/report.json` |
| Accessibility and device matrix | Passed after the Services changes | `a11y-mobile.log`, `devices-mobile.log` |
| Conductor contracts | Passed | `conductor-mobile.log` |
| Rotating headline | Passed | `hero-word-complete.log` |
| Production build, TypeScript, ESLint | Passed | `build-mobile-final.log`, `types-mobile.log`, `lint-mobile.log` |
| Exact resting forms | All eight states byte-identical to the same-machine audit comparison | `rest-mobile.log` |

Logs and screenshots are under `captures/audit-2026-09-08/`. The older committed
rest fixture did not match the starting workspace. It was not replaced: an
isolated production build of the audit's intake code established the comparison,
and all eight before/after images matched byte-for-byte. The later mobile staging
change also matches those eight deterministic rest images.

This is browser/emulation verification on the local production build. It does
not establish real iOS URL-bar/keyboard behavior, sustained phone GPU performance,
battery use, or thermal stability. No universal FPS claim is made. Actual email
delivery and those hardware checks remain separate launch requirements.
