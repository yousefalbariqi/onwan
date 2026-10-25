import { pool } from './db.js';
import { REFERENCED_SQL, SAVED_SQL } from './mediaReferences.js';

// Owner decision (25 Oct 2026): a stored file nothing uses any more is deleted
// after a grace period counted from when the daily run first finds it unused:
//   • 30 days if it was ever part of a saved design (so «الأشكال السابقة»
//     keeps its images for a month);
//   • 24 hours from upload if it was never saved (a background video picked, then not saved
//     — images are only stored at save time, so they are never in this case).
// «Used» = referenced by a page (or its unpublished draft), a button, an archived (restorable) button or
// an open partner order. «Saved» = present in any save's review snapshot.
// Runs hourly. Locks + persistent tombstones protect concurrent saves.
export const SAVED_GRACE_DAYS = 30;
export const UNSAVED_GRACE_DAYS = 1;

type Listed = { objects: { key: string; uploaded?: Date | string }[]; truncated: boolean; cursor?: string };
export type MediaStore = {
  list(options: { prefix: string; cursor?: string }): Promise<Listed>;
  delete(keys: string[]): Promise<void>;
};

// Every /media/... key mentioned anywhere it can still be needed.
const DAY = 86_400_000;

export async function runMediaCleanup(store: MediaStore, now = new Date()) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
  await client.query('begin');
  transactionOpen = true;
  // Reference-writing triggers and uploads take the shared form.
  await client.query('select pg_advisory_xact_lock(732022::bigint)');
  const referenced = new Set((await client.query<{ key: string }>(REFERENCED_SQL)).rows.map((row) => row.key));
  const saved = new Set((await client.query<{ key: string }>(SAVED_SQL)).rows.map((row) => row.key));

  const stored: string[] = [];
  const uploaded = new Map<string, Date>();
  for (const prefix of ['files/', 'wallpapers/']) {
    let cursor: string | undefined;
    do {
      const page = await store.list({ prefix, cursor });
      stored.push(...page.objects.map((object) => object.key));
      for (const object of page.objects) {
        if (object.uploaded) uploaded.set(object.key, new Date(object.uploaded));
      }
      if (page.truncated && (!page.cursor || page.cursor === cursor)) throw new Error('Incomplete media listing');
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }

  const unused = stored.filter((key) => !referenced.has(key));
  // A file in use again is no longer counted as unused.
  await client.query('delete from media_orphans where not (key = any($1::text[]))', [unused]);
  if (unused.length) {
    await client.query('insert into media_orphans (key, first_seen) select unnest($1::text[]), $2 on conflict (key) do nothing', [unused, now]);
  }

  const orphans = await client.query<{ key: string; first_seen: string }>('select key, first_seen from media_orphans');
  const due = { rows: orphans.rows.filter((row) => !referenced.has(row.key) && now.getTime() - (saved.has(row.key) ? new Date(row.first_seen).getTime() : (uploaded.get(row.key) ?? new Date(row.first_seen)).getTime()) >= (saved.has(row.key) ? SAVED_GRACE_DAYS : UNSAVED_GRACE_DAYS) * DAY) };
  const pending = await client.query<{ key: string }>('select key from media_deleted_keys where deleting = true');
  const keys = [...new Set([...due.rows.map(row => row.key), ...pending.rows.map(row => row.key)])].filter(key => !referenced.has(key));
  if (keys.length) await pool.query('insert into media_deleted_keys(key) select unnest($1::text[]) on conflict (key) do update set deleting = true', [keys]);
  // Fence is committed on a separate connection BEFORE touching R2.
  // This transaction keeps the exclusive lock through deletion, preventing
  // overlapping cleaners and reuploads. Even rollback cannot lose the fence.
  for (let index = 0; index < keys.length; index += 500) await store.delete(keys.slice(index, index + 500));
  if (keys.length) {
    await client.query('update media_deleted_keys set deleting = false where key = any($1::text[])', [keys]);
    await client.query(
      'insert into media_cleanup_log (key, unused_since) select k, f from unnest($1::text[], $2::timestamptz[]) as t(k, f)',
      [keys, keys.map(key => due.rows.find(row => row.key === key)?.first_seen ?? now.toISOString())],
    );
    await client.query('delete from media_orphans where key = any($1::text[])', [keys]);
  }

  await client.query("delete from media_upload_events where started_at < clock_timestamp() - interval '2 days'");
  await client.query('commit');
  return { stored: stored.length, unused: unused.length, deleted: keys.length };
  } catch (error) {
    if (transactionOpen) await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
