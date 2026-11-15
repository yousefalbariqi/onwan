# Phase two — live template selection

final result: blocked

## Source visual truth

User-supplied Linktree theme-picker screenshots in this conversation, plus the supplied Arabic brief and `/Users/yousefalbariqi/Downloads/Linktree 3.mhtml`. The MHTML was parsed without running scripts. Screenshot widths include 580 and 626 image pixels; density and CSS viewport are unspecified.

## Implementation and intended states

- `/signup?step=templates`: initial, alternate template selected, alternate category, and storage failure.
- `/signup?step=edit`: trial content editing and preview.
- Mobile targets: 390 × 844 and 320 × 568 CSS pixels. Desktop: 1440 × 900 CSS pixels.
- Intentional adaptations required by the user: Onwan branding, Cairo shell typography, orange progress and selection state, Arabic names, three category groups, and a neutral shell instead of a full-screen template background.

## Capture evidence and blocker

Implementation screenshot path: unavailable. Actual viewport, CSS size and density: not verified.

The in-app browser host is unavailable. Native Chrome fallback opened a separate tab, but user-activity guards rejected subsequent input and another navigation attempt timed out. No effort was made to force control of the user's active Linktree tab. No implementation screenshot or console inspection was obtained.

Full-view comparison evidence: blocked. Focused-region comparison evidence: blocked. No visual comparison pass or visual-fidelity finding is asserted from code alone.

## Required fidelity surfaces

- Typography: pending rendered comparison; shell uses existing Cairo, while design typography changes within page previews.
- Spacing and layout: pending rendered comparison at both mobile heights and desktop; short-screen grid scrolling requires actual device confirmation.
- Colors and tokens: pending rendered comparison; shell tokens remain Onwan's existing neutral/orange palette.
- Assets: previews reuse the actual page renderer and existing sample mark; no Linktree raster assets or logos were imported into the product.
- Copy: Arabic copy implemented from the brief; visual wrapping remains unverified.

## Functional checks

Production build passed. 30 tests passed, including selection changes without navigation, design/content separation, storage-failure handling, existing template library behavior, and registration-free entry. These checks do not substitute for visual QA.

## Comparison history

Initial attempt: browser-host unavailable. Native fallback: concurrent-user action guard and navigation timeout. No same-viewport comparison could be produced.

## Remaining checklist

1. Capture both mobile sizes and desktop in initial and selected states.
2. Compare reference and implementation together, including typography, thumbnail proportions and footer reachability.
3. Test grid scrolling, live-preview updates, editing/back navigation and browser console.
4. Fix any P0–P2 visual findings and repeat before declaring passed.

## Earlier reports

The first-stage report is preserved in `docs/creation-start-design-qa.md`. The earlier nonprofit report is preserved in `docs/nonprofit-onboarding-design-qa.md`.

## Search addition

Source: the user's attached cropped bottom-sheet search reference in the latest message. Search belongs between the existing sheet heading and the category buttons. A neutral input, matching existing tokens, is implemented without changing the preview stage. New states: query input, ranked matches, no matches, clear action, and selected template excluded by the query. Browser capture of these additions is still unavailable; final result remains blocked. The text-and-synonym search is covered by automated tests, not a substitute for visual confirmation.
