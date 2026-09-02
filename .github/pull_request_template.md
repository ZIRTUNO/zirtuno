<!--
Keep the summary about intent. The diff already says what changed; this should
say why, and what would prove it wrong.
-->

## What this changes

## Why

## Verification

<!-- Tick what you actually ran. An unticked box is information, not a failure. -->

- [ ] `npx tsc --noEmit`
- [ ] `npx eslint . --max-warnings 0`
- [ ] `npm run build`
- [ ] Feature gates under `scripts/verify/` — list which:
- [ ] Checked in both locales (`/pt` and `/en`)
- [ ] Checked at the reduced and static rendering tiers

## Evidence

<!--
Capture sheets, filmstrips, or measured numbers for anything visual or timed.
Screenshots carry ~1% churn noise, so state the measurement, not just the image,
when the claim is about a small delta.
-->

## Notes for review

<!--
Anything deliberately left out of scope, an assumption you made, or a place you
would like a second opinion.
-->
