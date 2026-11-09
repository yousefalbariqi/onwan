# Revision-safe editor saves

Apply `database/phase30-page-revisions.sql` to the application database **before** deploying the matching API and frontend. Phase20 must already be installed. The phase30 migration is re-runnable. No application database was migrated by this implementation; all SQL validation used disposable local PostgreSQL databases.

The authenticated page API and staff content editor now require a revision and operation id. Old open tabs receive a conflict instead of overwriting newer work; retain/export their local changes before refreshing. Deploy API and frontend assets together after the migration. `dist/index.html` and `dist/assets` must come from the same build.

## Storage and ordering

- Approved/public content remains in `pages` and `page_links`. `pages.status` still controls visibility; saving never activates an association.
- The private draft remains in `pages.draft_json`. It includes unfinished content forms, raw link text, and the form's initial state. Inline media is uploaded before sending drafts; large local file forms are also backed up using account/tab-specific IndexedDB entries. localStorage remains a debounced fallback.
- `edit_revision` advances for all page updates, including staff/status changes. `published_revision` advances only for approved-content changes. `draft_base_revision` identifies the approved content underlying a draft. Timestamps are not used to choose a winner. Local backups use a monotonic sequence; IndexedDB rejects a delayed older backup write. A duplicated tab gets a new backup key so it cannot overwrite the original tab’s recovery slot.
- Draft updates and publication lock the page row, check the expected edit revision, and execute inside a transaction. Publication, content reviews, save quota and removal of the accepted draft commit together.
- Staff publication preserves a user's existing draft. If approved content changed, the draft is returned as a conflict. Activation/suspension changes do not delete a draft.
- The latest operation id supports retrying a lost response without another publication. Intervening page updates invalidate that id and cause a conflict rather than silently accepting an outdated retry.
- Cache invalidation follows a successful commit. A cache failure cannot roll back committed content or turn the confirmed data write into a reported publication failure. Existing cache expiry still bounds propagation.

## User behavior

Edits preview locally. Unfinished content forms remain draft-only and must be applied or explicitly discarded before publication. Closing an association panel keeps its work; it no longer publishes implicitly. Changes made during an outstanding publication remain unpublished.

Before activation, the main action saves the approved private design and opens the existing quotation flow. After activation it publishes without opening quotations. Suspended pages stay suspended. Quotation submission checks the saved revision and snapshots the approved design with the same database client/lock. Payment and activation rules are unchanged.

Conflicting local changes are retained; the user can download them and explicitly choose the server version. Before replacing local state, the editor archives it in IndexedDB. A conflicting server draft is archived before an explicit conditional clear. Storage failures are reported; refresh/closure cannot be guaranteed safe when both local persistence and server saves fail.

Autosave still runs after an editing pause. Identical draft payloads do not write again. Failed drafts retry with backoff and on reconnect; conflicts stop automatic writes. The existing 200-save daily policy remains shared between draft saves and explicit publication; this change does not remove it. Local recovery remains available when that limit is reached.

Unchanged page links are untouched. Content edits delete only removed links, archive deletions, and upsert only changed/new rows; link ids and order are retained.

## Verification

- `npm run test:editor-persistence`: deterministic tests against the actual PageProvider for delayed acknowledgements, typing during publication, unfinished forms, lost responses, conflicts, recovery, and reverting to approved content; preview overlays are also tested.
- `PAGE_REVISION_TEST_DATABASE_URL=... npm run test:page-revisions`: requires a disposable **local** database named `onwan_test_*`; destroys its public schema. Tests real SQL locks, triggers, migrations, concurrent writes, rollback, idempotency, differential link writes, draft conflicts and activation preservation. It skips if the variable is absent.
- Existing content, Worker, nonprofit request, payment/activation and workflow suites remain applicable.
- Worker typecheck and Vite build are separate checks. In-app browser access is unavailable in this session; desktop/mobile visual and IndexedDB browser QA are still required before production rollout.
