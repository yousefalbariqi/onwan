# Theme library — first review round

## Implemented foundation

Composition lives in `buttonStyle.composition`, so existing design storage and
revision-aware draft saving carry it without a database migration. All fields
are optional; old pages retain their existing layout. Server normalization
accepts only the documented enum choices.

- Identity alignment: centered or reading-start (RTL/LTR aware).
- Content width: narrow, balanced, wide; constrained to the actual viewport.
- Content surface: open, soft panel, framed.
- Page insets: compact or airy.
- Decorative backgrounds: none, grid, halos, arches; derived from theme text
  color, with low opacity. No external image ownership or font-upload coupling.
- Content treatment: plain, tiles, ruled; no changes to ordering or destinations.

## Eight review designs

The first batch belongs to البر والتكافل الاجتماعي and explores eight distinct
combinations: رواق، أثر، مدار، نسيج، فسحة، ميزان، ودّ، منارة.
They are available in Theme Builder as built-in previews, with normal, long-name,
and minimal/no-logo content, at 320, 390, and 430 CSS pixels.

The manager can open a design directly or use “إضافة الثيمات الثمانية إلى المكتبة
كمسودات”. The manager-only import is transactional and idempotent by design id;
it does not overwrite edited templates and does not publish them. There is no
automatic data mutation on opening the page.

## Verification

- Server normalization retains supported composition values and rejects others.
- Every pilot has a distinct composition, independent of palette.
- Import twice creates only eight drafts and preserves manager edits.
- Applying and autosaving a composition preserves organization content/contacts.
- Frontend build and Worker type check.

Actual browser/device visual review is still required, especially with an
organization's own artwork and media. Preview width controls exercise the
composition's width; they do not emulate a complete device/browser environment.

## Next steps after owner review

1. Refine these eight based on the owner's visual feedback.
2. Extend the foundation only for concrete gaps discovered in that review.
3. Design eight candidates for each remaining category (88 more).
4. Review long content, media, contrast, RTL/LTR, and phone layouts per batch.
5. Show approved templates to associations through the existing visibility flow.

No changes to membership/purchase pricing, Wallet passes, or existing saved
organization content are part of this work.


## Full library release — 9 November 2026

Owner approved the first eight and requested all 96 to be published. The full
catalog is in shared/themeLibrary.ts: twelve categories, eight designs each.
The original eight ids/designs are retained. All 96 are stored as visible, with
an exact per-category count verified transactionally. Existing owner edits are
preserved. New generated designs have tested page/button contrast of at least
4.5:1 at their default colors.

The manager can resume publication through publishThemeLibrary (bounded API
concurrency, stable ids, verification); scripts/publish-theme-library.cjs is the
transactional CLI for the configured database. It supports a read-only default
and explicit --publish. --repair-contrast only repairs failing new-library button
palettes when their original background is retained; it skips pilot designs.

Remaining work is visual refinement from owner feedback, not automatic
publication of any additional unreviewed batches. Individual theme visibility
continues to be managed from Theme Builder.
