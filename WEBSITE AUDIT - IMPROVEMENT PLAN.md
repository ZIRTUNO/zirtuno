# Zirtuno Website — Updated Audit & Improvement Plan

**Update date:** 10 July 2026  
**Previous audit:** 9 July 2026  
**Current delivery state:** R5-A, R5-B, R5-C, and R5-D complete; R5-E remains  
**Review type:** targeted change review, not a complete re-audit

---

## 1. Purpose of this update

This document updates the previous full website audit to reflect the work completed after that review. It focuses only on areas that materially changed, reclassifies findings where the implementation now provides stronger evidence, and preserves unresolved launch risks that remain present in the current code.

The principal change is the completion of **R5-D — the cinematic cut**. The site now has seven coordinated liquid scenes, scene-authored light scoring, fixed cinematic veils, dedicated Work/Studio/Footer behavior, two controlled act fades, and one conductor-latched Origin flash.

The update does **not** repeat the full competitor, industry, content, SEO, and UX research from the original audit. Findings that were not affected by R5-D remain valid unless explicitly reclassified below.

---

## 2. Updated executive verdict

Zirtuno has moved from an ambitious but visibly incomplete continuous-liquid prototype into a technically coherent cinematic system.

R5-D resolves one of the previous audit’s largest implementation gaps: the liquid no longer disappears across Work, Studio, Contact, and Footer. The five-act story now has explicit scene behavior and light motivation from Hero to the true page bottom.

The strongest improvements are:

1. Work now inherits Método’s satellites as a slow current and supports a hovered-card meniscus.
2. Origin now owns a single controlled fusion flash and afterglow.
3. Studio carries sparse echo orbits instead of becoming a liquid-free chapter.
4. Contact gathers the surviving droplets back into the mark.
5. Footer completes the story with a release past the true page bottom.
6. Cinematic exposure, vignette, flash, reduced-motion behavior, and bypass behavior are machine-verified.
7. The original forms remain byte-exact despite the new optics and cinematic layers.

These changes materially improve visual continuity, brand distinctiveness, and the credibility of the underlying technical architecture.

They do **not** make the website launch-ready by themselves. The earlier high-risk conversion and content-truth issues remain:

- the contact form can still report success when no message was delivered;
- seed portfolio projects can still be published as proof;
- mobile navigation still lacks complete modal behavior and its previous layout defect has not been addressed in the component;
- the static/no-WebGL label and pacing concerns remain structurally present;
- real production contact details and portfolio content are still open owner inputs.

### Updated quality estimate

**Overall current quality: approximately 6.8/10**  
**Visual-system maturity: approximately 8/10**  
**Launch readiness: approximately 4.5/10**  
**Potential after R5-E and real content: 9/10**

The quality increase comes from real cinematic and continuity work. Launch readiness rises only slightly because the remaining blockers affect leads, truth, accessibility, and production reliability rather than visual polish.

---

## 3. What changed since the previous audit

### 3.1 R5-D cinematic cut is complete

The previous audit treated R5-D as planned work. It is now implemented.

The current homepage includes:

- seven scene modules: `site`, `method`, `work`, `origin`, `studio`, `contact`, and `footer`;
- a fixed `CinematicVeils` page-light layer;
- scene-authored exposure, key, vignette, and flash scores;
- the R5-C liquid grade and R5-D page veils as deliberately separate consumers;
- exactly two act-boundary fades:
  - Método → Work;
  - Origin → Studio;
- exactly one Origin flash per page load;
- a flash envelope capped below 400 ms and disabled under reduced motion;
- `Reveal variant="blur"` for the Soul and Invitation copy;
- `?fcine=0` as the exact cinematic bypass;
- Work current and hovered-card meniscus;
- Studio echo orbits;
- Contact gather;
- Footer release beyond the page bottom.

### 3.2 Work, Studio, Contact, and Footer are no longer liquid-dead zones

This was a major weakness in the earlier state. It is now resolved at the architecture and machine-verification levels.

#### Step 1 — Work current

**Health: Improved; visual tuning still recommended**

![R5-D Work current](captures/cinematics/alive-work.png)

The same liquid now remains alive behind the portfolio grid. This strengthens the one-system claim and prevents the proof chapter from feeling disconnected from the homepage experience.

The remaining visual concern is restraint: several droplets pass through dense card-copy regions. The automated transient-contrast gate passes, but owner taste review should still decide whether the current feels quiet enough during sustained reading.

#### Step 2 — Studio echoes

**Health: Improved**

![R5-D Studio echoes](captures/cinematics/alive-studio.png)

The Studio chapter now inherits sparse Origin echoes. This creates a meaningful afterglow instead of introducing a new unrelated form or an empty black chapter.

The anonymous role grid remains a strategic credibility limitation, but it is no longer a liquid-continuity defect.

#### Step 3 — Contact gather and Footer release

**Health: Cinematic continuity improved; conversion risk unresolved**

![R5-D Footer release path](captures/cinematics/alive-footer-release.png)

Contact gathers the field into the mark and Footer releases the final droplet beyond the true bottom. The canonical labeled submit remains visible and is not replaced by the liquid response.

The visual narrative is now correct. The email-delivery semantics in the API are not.

### 3.3 R5-C and exact-form protections remain intact

The new R5-D work did not break the completed R5-C optics system:

- selective bloom remains active on the full tier;
- blue-noise dither and luminance-gated grain remain bounded;
- depth bands, internal absorption, exposure, and key boost remain identity-gated;
- `?fgrade=0` still provides the exact optics bypass;
- the runtime ladder still demotes from full → full-nofx → lite;
- the idle governor still reduces cadence to approximately 30 Hz and wakes on interaction;
- all eight rest states remain byte-identical.

### 3.4 Bind handoff continuity was hardened

The R5-B compatibility path received an additional continuity fix. Both hidden branches are rebased during bind handoff, reducing the risk of a visible jump when the legacy exact path and full-physics path exchange ownership.

This is an internal quality improvement, but it supports a smoother visual narrative and protects the signed-off resting footprints.

---

## 4. Updated scorecard

| Area | Previous | Updated | Reason for change |
|---|---:|---:|---|
| Strategic positioning | 7.5/10 | 7.5/10 | No material content change |
| Information architecture | 8/10 | 8/10 | Nine chapters and five acts remain correct |
| Brand distinctiveness | 8.5/10 | 9/10 | The continuous cinematic system is now substantially more ownable |
| Content quality | 7/10 | 7/10 | Core copy unchanged; proof remains thin |
| Visual execution | 6/10 | 7.5/10 | Optics and cinematic continuity now implemented |
| Motion narrative | 5/10 | 8/10 | Work current, Origin flash, Studio echoes, Contact gather, Footer release complete |
| Portfolio credibility | 2.5/10 | 2.5/10 | Seed prototypes and silent CMS fallback remain |
| Conversion design | 5/10 | 5/10 | CTA routing passes; delivery semantics remain unsafe |
| Mobile experience | 3.5/10 | 3.5/10 | R5-D does not resolve the mobile-menu defect |
| Accessibility readiness | 5/10 | 5.5/10 | Cinematic reduced-motion and contrast gates improved; broader hardening remains |
| Performance engineering | 7/10 | 8/10 | Post chain, full-nofx rung, governor, and cinematic gates pass |
| Technical architecture | 8/10 | 9/10 | Seven scenes preserve one conductor and one persistent canvas |
| CMS/content scalability | 5/10 | 5/10 | Production content behavior unchanged |
| Launch readiness | 4/10 | 4.5/10 | Visual system advanced; five launch blockers remain |

---

## 5. Previous findings — updated status

| Previous finding | Current status | Updated assessment |
|---|---|---|
| Work, Studio, Contact, and Footer become liquid-dead zones | **Resolved** | Dedicated R5-D scenes keep the field alive through the page bottom |
| R5-D cinematic scoring was only planned | **Resolved** | Score consumers, veils, fades, flash, and bypass are implemented |
| Origin had no controlled cinematic peak | **Resolved technically** | One flash is conductor-latched, bounded, and removed under reduced motion |
| Footer did not complete the liquid story | **Resolved** | Footer scene releases the lowest droplet past the true bottom |
| Contact visuals were strong but isolated | **Improved** | Studio now hands surviving droplets into Contact gather |
| Mobile navigation was clipped and incomplete | **Unresolved** | Component and CSS have not received the required responsive/modal rework |
| Contact can claim success without delivery | **Unresolved — P0** | API still returns `{ ok: true, delivered: false }`; client checks only `json.ok` |
| Prototype work can be mistaken for commissioned work | **Unresolved — P0** | All six seeds remain `prototype: true`; narrative prototypes still lack a persistent prototype label |
| Sanity failure silently falls back to seed proof | **Unresolved — P0** | Data layer still catches failures and returns `SEED_PROJECTS` |
| Static/no-WebGL path contains misplaced labels and excess runway | **Unresolved — P0** | Static branch still activates shared label state globally rather than isolating chapter presentation |
| Production contact and social identity contain placeholders | **Unresolved — P0** | Real domain email, WhatsApp, site URL, and social handles remain open decisions |
| Ecosystem does not clearly prove system connectivity | **Unresolved — P1** | R5-D adds cinematic continuity but does not redesign the Ecosystem information model |
| Origin contains long low-information intervals | **Partially improved** | Fusion now has stronger cinematic purpose, but the blank reading interval remains visible |
| Studio is visually disconnected | **Resolved visually** | Echoes connect Origin to Studio |
| Studio lacks human proof | **Unresolved — P1** | Anonymous role grid remains the default pending owner content/assets |
| Production Core Web Vitals are unknown | **Unresolved — R5-E** | Engineering controls exist, but field data and device soaks are not complete |

---

## 6. Current strengths

### 6.1 One liquid is now a complete architectural fact

The same canonical 48 droplets travel from Hero through Footer. Work, Studio, Contact, and Footer no longer require a second renderer or simulated handoff. This is the website’s strongest technical and creative achievement.

### 6.2 The cinematic layer preserves separation of concerns

The implementation avoids placing every effect inside the shader:

- the R5-C post chain grades the liquid;
- `CinematicVeils` grades the page;
- scenes emit score targets;
- the conductor owns damping and the one-flash latch;
- chapter copy remains semantic HTML.

This separation is maintainable and protects accessibility, deterministic QA, and future tuning.

### 6.3 The flash and fades have enforceable limits

The cinematic gate confirms:

- one Origin flash per page load;
- no re-fire on a second traversal;
- no flash under reduced motion;
- no flash when `?fcine=0` is active;
- exactly two act fades;
- fade peak within the locked range;
- full veil release at standing reading positions;
- transient text contrast above the project’s 3.5:1 cinematic floor.

### 6.4 Performance fallbacks reduce cost without freezing identity

The full-nofx rung, lite demotion, bounded post-processing, and idle cadence governor preserve motion instead of freezing the liquid. This is better aligned with the brand invariant and avoids a visibly broken fallback state.

### 6.5 Conversion copy remains server-rendered

The new cinematic layer does not become the sole carrier of meaning. Problem, Ecosystem, Services, Method, Work, Origin, Studio, and Contact continue to render as semantic content.

---

## 7. Current priority problems

## P0 — Launch blockers

### P0.1 Contact success can still be false

The API intentionally accepts a valid request when `RESEND_API_KEY` is missing and responds with:

```json
{ "ok": true, "delivered": false }
```

The client treats any successful HTTP response with `json.ok` as a completed lead, resets the form, and shows success.

#### Required fix

- In production, missing Resend configuration must return a non-success status.
- Client success must require `json.ok === true && json.delivered === true`.
- Failed submissions must preserve entered values.
- Add delivery logging and alerting.
- Add a deployment readiness gate for the verified sender and recipient.

### P0.2 Prototype portfolio truth remains unsafe

All six local projects still have `prototype: true`.

Four architecture-type projects show “Arquitetura selecionada,” which is good. Two narrative-type prototypes render qualitative outcomes without a persistent prototype/architecture label, even though they remain scaffolding.

The homepage also says “Estruturas reais,” creating a direct credibility conflict while seed data is active.

#### Required fix

Choose one launch mode:

1. **Real-work mode:** require verified Sanity content and fail closed when it is absent; or
2. **Selected-architecture mode:** label every prototype card and case consistently and remove copy that implies commissioned real work.

Production CMS errors must never silently publish seed proof.

### P0.3 Mobile navigation remains incomplete

The component still:

- keeps the hidden dialog mounted;
- uses `aria-hidden` without `inert` or conditional unmounting;
- provides no focus trap;
- provides no initial-focus placement;
- provides no Escape close behavior;
- provides no focus restoration;
- vertically centers nine links while pinning a footer absolutely, which caused clipping in the previous 390×844 capture.

R5-D did not modify `MobileMenu.tsx` or its layout rules.

#### Required fix

- Use a full-viewport top-level overlay.
- Make the chapter list scrollable on short screens.
- Keep the close control visible.
- Implement initial focus, focus containment, Escape, and return focus.
- Unmount the closed menu or make it fully inert.
- Verify 320×568, 360×640, 390×844, 430px widths, and landscape.

### P0.4 Static/no-WebGL reading path is not yet isolated

The shared page layer still contains global Ecosystem and Origin labels. On the static branch, the Ecosystem label state is forced to its completed position while the animated scene isolation is absent. This is consistent with the previously observed label leakage.

#### Required fix

- Scope static labels to their semantic chapter.
- Collapse long pinned animation runways in the static path.
- Ensure Origin, Studio, Contact, and Footer remain complete without live WebGL.
- Verify actual `prefers-reduced-motion`, initial no-WebGL, and context-loss recovery separately.

### P0.5 Production identity remains incomplete

The real WhatsApp number, domain email, canonical site URL, and social handles remain open owner decisions. The email route still defaults to a Gmail recipient and `onboarding@resend.dev` sender.

Launch must use a verified Zirtuno-owned domain and a reply-capable sender.

---

## P1 — High-impact experience work

### P1.1 Ecosystem still needs stronger explanatory proof

R5-D improves continuity around the chapter but does not change the fundamental five-second-comprehension problem. The visual must make the core, nodes, connections, and business flow unmistakable.

### P1.2 Work current needs owner taste review

The scene is technically alive and contrast-gated. The current capture still places several bright droplets through copy-heavy regions. Tune existing activity, orbit, and depth constants before creating any new effect family.

### P1.3 Origin pacing remains long

The fusion now has a clear cinematic purpose, but one stable captured point still presents a large visual-only interval. Confirm whether this pause feels intentional on real hardware or delays the true company story.

### P1.4 Studio needs proof, not only atmosphere

Echoes improve continuity, but the studio still needs evidence of accountability: named founders or leadership if approved, verifiable experience, operating model, or a clear senior-core/specialist-network explanation.

### P1.5 Form accessibility remains incomplete

`aria-invalid` is present, but validation messages are not connected to their inputs with `aria-describedby`. The submit failure has `role="alert"`, while field-level errors still need programmatic association.

### P1.6 Measurement and production observability are missing

Add privacy-conscious analytics for CTA intent, contact starts, validation failures, submit delivery, direct-channel clicks, case openings, and locale switching. Production monitoring must distinguish API acceptance from actual email delivery.

---

## P2 — Documentation and scalability

### P2.1 `build-spec.md` status labels are stale

The current `AGENTS.md`, `README.md`, and liquid spec correctly identify R5-D as complete. `build-spec.md` still states near its opening that R5-C and R5-D remain delivery work and retains several “TARGET R5-D” labels.

Because `build-spec.md` owns detailed product and acceptance requirements, this mismatch can mislead future agents.

#### Required fix

During the R5-E documentation sweep:

- mark R5-C and R5-D as current implementation;
- preserve target language only for genuinely unfinished acceptance work;
- move R5-E launch truth to the active delivery section;
- keep the exact verification and rollback contracts intact.

### P2.2 Production CMS behavior should fail closed

Sanity errors are swallowed and converted into local seed content. Use seed fallback only in explicit development/demo mode. Production should log and surface the content failure or publish a truthful empty state.

### P2.3 Localized accessibility labels need cleanup

The side index still exposes `aria-label="Chapters"` on the PT route. Use the authored locale files for accessible navigation labels and confirm the document locale is represented precisely.

### P2.4 Dynamic rendering should be intentional

The production build still classifies localized homepage, work index, and case-study routes as dynamic. Confirm that the caching and revalidation behavior is intentional for the Sanity strategy.

---

## 8. Updated improvement plan

R5-D is complete and is no longer an improvement-plan phase. The remaining work should be executed as **R5-E hardening and launch truth**.

## R5-E.1 — Conversion safety and production truth

### Work

1. Correct contact delivery semantics.
2. Configure and verify the Zirtuno sending domain.
3. Add form abuse controls and delivery observability.
4. Replace all placeholder contact and social details.
5. Choose real-work or selected-architecture launch mode.
6. Prevent seed fallback in production.

### Acceptance criteria

- A visitor never receives a false success state.
- Every successful form submission has a confirmed delivery result.
- Missing production configuration blocks readiness.
- No seed project is presented as commissioned work.
- Homepage, work index, cases, sitemap, and metadata contain only approved content.

## R5-E.2 — Mobile and responsive hardening

### Work

1. Rebuild mobile-menu layout and dialog behavior.
2. Verify iOS sticky and `svh` behavior.
3. Verify Android lite-live behavior.
4. Protect all copy regions from high-activity droplets.
5. Shorten mobile pinned journeys where reading value does not change.
6. Test landscape and short-screen layouts.

### Acceptance criteria

- All nine menu links and the CTA remain available at 320×568.
- Keyboard focus cannot leave the open dialog.
- Escape closes the menu and restores focus.
- No liquid obscures essential copy or controls.
- The site remains live on capable mobile without thermal runaway.

## R5-E.3 — Reduced motion, no-WebGL, and context loss

### Work

1. Isolate all static chapter labels.
2. Collapse animation-only runways.
3. Verify complete PT/EN semantic reading paths.
4. Run the context-loss drill.
5. Confirm restoration resumes the current measured scene rather than the top.
6. Confirm no flash, blur scrub, decorative release dependency, or autocycle under reduced motion.

### Acceptance criteria

- Every chapter remains complete without WebGL.
- No labels leak between chapters.
- Reduced motion communicates the same business argument.
- Context recovery does not create a second canvas or reset the journey.

## R5-E.4 — Accessibility regression

### Work

1. Complete keyboard-only navigation.
2. Run PT/EN screen-reader checks.
3. Associate field errors programmatically.
4. Audit focus visibility and focus obscuring.
5. Verify all interactive targets against the 24×24 CSS-pixel minimum or a documented exception.
6. Review every use of the 42%, 30%, and 10% paper tokens.
7. Confirm the single flash remains inside the agreed WCAG-safe envelope.

### Acceptance criteria

- No keyboard trap exists outside the intentional modal containment.
- Focus is always visible and not obscured.
- Forms announce invalid fields and submission state.
- Essential normal-size copy meets AA contrast.
- Flash count and reduced-motion gates continue to pass.

## R5-E.5 — Performance and device hardening

### Work

1. Test desktop full, full-nofx, lite, and half tiers.
2. Complete a 30-minute battery and thermal soak.
3. Add field Core Web Vitals measurement.
4. Verify idle cadence and instant wake behavior.
5. Measure memory through a complete forward/reverse journey.
6. Confirm scene target loops remain allocation-safe.

### Acceptance criteria

- LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1 at the 75th percentile once field data is available.
- No runaway cadence or thermal growth occurs.
- The watchdog never freezes the liquid.
- Exactly one liquid canvas remains mounted.
- No growing heap appears across repeated traversals.

## R5-E.6 — Final content, documentation, and owner review

### Work

1. Resolve the five open owner decisions.
2. Align `build-spec.md` with the completed R5-C/R5-D state.
3. Complete PT/EN content parity and truth review.
4. Remove dead code and unused assets.
5. Conduct owner review of Work current, Origin fusion/flash, Studio echoes, Contact gather, and Footer release on real hardware.
6. Freeze the launch checklist and rollback paths.

### Acceptance criteria

- No documentation describes completed work as planned.
- Every public claim is approved and verifiable.
- Every signature moment has owner taste sign-off.
- Physics, optics, and cinematics remain independently reversible through their documented QA flags.

---

## 9. Verification completed for this update

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| Production routes | Built successfully; localized core routes remain dynamic |
| `verify-conductor.mjs` | Passed — 48 droplets, 0 invariant failures |
| `verify-postfx.mjs` | Passed — optics bypass, banding, full-nofx, lite demotion, and governor green |
| `verify-rest-exact.mjs` | Passed — all eight rest states byte-identical |
| `verify-cinematics.mjs` | Passed — one flash, two fades, no dead zones, reduced-motion and bypass green |
| Cinematic transient contrast | Passed — worst measured 4.03:1 at the automated peak check |
| `verify-canvas-count.mjs` | Passed — one liquid canvas from load to page end |
| `verify-cta.mjs` | Passed — CTA intent routing and same-page behavior green |
| Targeted desktop captures | Reviewed — Work, Origin, Studio, Contact, and Footer |
| Browser warnings/errors during targeted review | None observed |
| Mobile visual re-capture | Not completed in this update; the in-app viewport override did not apply reliably |
| Physical-device owner review | Still required |
| Production Core Web Vitals | Still not measured |
| 30-minute battery soak | Still required |

### Evidence limit

The current desktop screenshots confirm the new scene continuity and stable visual states. They do not replace real-hardware judgment of motion feel, flash perception, hover meniscus quality, mobile thermal behavior, keyboard navigation, or assistive-technology behavior.

The mobile-menu risk is retained from the previous visual finding and confirmed by the unchanged current component/CSS structure; it was not re-captured at a mobile viewport during this targeted update.

---

## 10. Updated launch order

The correct remaining order is:

1. Fix the five P0 launch blockers.
2. Resolve real portfolio and contact owner inputs.
3. Complete mobile, reduced-motion, no-WebGL, and context-loss hardening.
4. Complete screen-reader, keyboard, contrast, and locale regression.
5. Complete device, battery, memory, and field-performance validation.
6. Align all documentation with the completed R5-D state.
7. Run final owner taste review on real hardware.
8. Freeze launch content, environment variables, analytics, and rollback procedures.

The final phase should not introduce another visual engine or new effect family. R5-E should tune and harden the current system.

---

## 11. Updated definition of done

The website is ready only when:

- the same liquid remains coherent from Hero through Footer;
- exact forms and morph contracts remain protected;
- the five-act cinematic cut passes its machine gates and owner review;
- a visitor immediately understands the offer;
- Ecosystem visually proves connection;
- Work contains honest approved proof;
- the real Origin story remains primary;
- mobile navigation is complete and accessible;
- reduced-motion and no-WebGL paths preserve all meaning;
- the contact action reliably delivers a lead;
- every CTA carries the correct intent;
- PT-BR and EN are accurate and complete;
- production field performance and device stability are demonstrated;
- documentation describes the implementation truth without stale phase labels.

**Current conclusion:** R5-D successfully completes the cinematic system. R5-E must now prioritize conversion safety, content truth, responsive accessibility, fallback completeness, production observability, and real-device proof.
