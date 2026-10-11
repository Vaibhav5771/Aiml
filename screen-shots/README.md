# Screenshots: superseded, kept as history

The three screenshots in this folder show the **warm eco direction** (paper
tones, soft greens) that Recyclens no longer uses. They are not a reference
for anything you are building today.

## What replaced them, and when

Spec [0002](../docs/specs/0002-design-system-ui-foundation/index.md), on
2026-10-11, replaced that direction with the Apple inspired system that now
lives in `src/global.css` and is documented in [`docs/design.md`](../docs/design.md).

## Why it changed

The warm palette was chosen before any of it was on a screen. Measured against
WCAG AA, every one of its text colours fell short of the 4.5:1 bar that small
text needs, and the product's whole claim is that you can read and trust what
it tells you. The direction was reset around values that pass measurement
rather than values that look good in a mockup.

## What they are still good for

The **composition** largely survived the change: the verdict first, then what
the app saw, then the rule it applied. If you are building a screen on the
scan to verdict path, these are a reasonable reference for what goes where.
They are not a reference for a single colour, type size, radius or spacing
value. Take every one of those from `src/global.css`.
