# Media limits — owner decisions, 25 Oct 2026

Run `database/phase22-media-controls.sql` in the existing PostgreSQL database **before deploying the matching Worker**. It depends on phases 19 (cleanup) and 20 (drafts), and does not migrate files or publish anything. The SQL is rerunnable. Keep existing application database permissions; new tables have RLS enabled and must not be accessible to browser clients.

- REQ-005: withdrawn by owner. No six-PDF limit; the 30-element page limit still applies.
- REQ-007: 200 MiB total physical storage per account, including hidden, old and unused files until physically deleted. Both R2 prefixes are counted. Uploads are serialized per account in PostgreSQL so concurrent requests cannot exceed this ceiling. Missing storage-list support fails closed.
- REQ-008: at most 30 MiB temporary files **within**, not above, the 200 MiB total (latest owner instruction). Files referenced in published pages, drafts, archived links or open partner orders, or included in a published review snapshot, are excluded from the temporary subtotal. Large new batches may need saving in smaller groups.
- REQ-009: never-saved abandoned files become eligible 24 hours after R2 upload time, and are removed on the next hourly sweep. If an old object's timestamp is unavailable, use first detection. Previously published files retain the existing 30-day recovery window, counted from first detection as unused. Anything still referenced remains protected.
- REQ-010: reference-writing database triggers and uploads share a lock; cleanup holds the exclusive lock through deletion. Before deleting from R2, it durably records a deletion fence on a separate database connection. This protects against concurrent saves, overlapping cleanup and partial deletion failures. Interrupted deletion is retried; deleted URLs must be uploaded again before use.
- REQ-011: database triggers also reject inline Base64 in page/draft/order/archive writes. Existing inline records are not automatically migrated.
- REQ-012: 50 admitted upload attempts and 500 MiB per account per Riyadh calendar day. Reservations are made before reading the body. Failed attempts retain their reservation to prevent abuse; successful attempts are adjusted to actual bytes. Repeated content consumes an attempt/transfer allowance, but adds no storage. Successful browser uploads are cached briefly across save retries.
- REQ-013: five admitted upload starts in a rolling minute, including across midnight.
- REQ-014: 20 changes to existing media slots per account per Riyadh day, enforced transactionally on saved pages, drafts and partner orders. Profile, background, poster, attachment, custom image icon and card image are independent slots. Publishing an identical draft does not count twice. Emptying a slot does not reset its history; removal alone does not count. A new link ID is a new slot. The upload attempt/byte limits still apply to all actual uploads.

The existing 10 MiB PDF, 1,000,000-byte stored image, 20 MiB background-video and 30-element limits remain. Partner uploads are charged to the partner account that owns their R2 folder, including designs for multiple customers; transferring ownership is not part of this change.

The SQL takes global shared/exclusive locks for deletion safety; cleanup can briefly delay writes. R2 listing and reference queries are currently used for accounting rather than an eventually consistent cached total. Monitor query cost before increasing upload traffic.

## Verification

`npm run check:worker`

`node --test tests/page-content.test.cjs tests/pdf-upload.test.cjs`

`npm run test:worker`

`npm run build`

`tests/media-controls.integration.cjs` uses real PostgreSQL and is explicitly opt-in with `MEDIA_TEST_DATABASE_URL`. **Only use an isolated disposable test database** with the minimal tables required by the test: the test truncates its tables. It exercises concurrent admission, daily limits, temporary/total quotas, deduplication, replacement enforcement, Base64 rejection, cleanup/save concurrency and partial R2 failure recovery. Never point it at development or production data.
