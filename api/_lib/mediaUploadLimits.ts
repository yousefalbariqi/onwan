import { pool } from './db.js';
import { HttpError } from './http.js';
import type { PoolClient } from 'pg';
import type { MediaBucket } from '../video-upload.js';
import { assertStorageRoom } from './storageQuota.js';

export const DAILY_UPLOADS = 50;
export const DAILY_UPLOAD_BYTES = 500 * 1024 * 1024;
export const MINUTE_UPLOADS = 5;

// Both locks in one round trip: each query to the database costs ~0.4 s.
async function lock(client: PoolClient, owner: string) {
  await client.query("select pg_advisory_xact_lock_shared(732022::bigint), pg_advisory_xact_lock(hashtextextended('media:' || $1, 0))", [owner]);
}

// Reserve before reading the body. Failed uploads consume the reservation too,
// so failures cannot be used to evade the daily or minute limits.
export async function beginMediaUpload(owner: string, bytes: number): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lock(client, owner);
    // One query: the last minute (also across the Riyadh midnight boundary) and today.
    const { rows } = await client.query<{ minute: number; day: number; bytes: string }>(
      `with today as (select ((clock_timestamp() at time zone 'Asia/Riyadh')::date::timestamp at time zone 'Asia/Riyadh') as start)
       select count(*) filter (where started_at > clock_timestamp() - interval '1 minute')::int as minute,
       count(*) filter (where started_at >= today.start)::int as day,
       coalesce(sum(reserved_bytes) filter (where started_at >= today.start),0)::text as bytes
       from media_upload_events, today where owner_id = $1
       and started_at >= least(today.start, clock_timestamp() - interval '1 minute')`, [owner]);
    if (rows[0].minute >= MINUTE_UPLOADS) throw new HttpError(429, 'الحد 5 عمليات بدء رفع في الدقيقة. انتظر قليلًا ثم حاول.', 'upload_rate');
    if (rows[0].day >= DAILY_UPLOADS || Number(rows[0].bytes) + bytes > DAILY_UPLOAD_BYTES) {
      throw new HttpError(429, 'وصلت إلى حصة الرفع اليومية: 50 عملية أو 500 MB. حاول غدًا.', 'upload_daily');
    }
    const event = await client.query<{ id: string }>('insert into media_upload_events(owner_id, reserved_bytes) values ($1,$2) returning id::text', [owner, bytes]);
    await client.query('commit');
    return event.rows[0].id;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

export async function storeLimitedUpload(media: MediaBucket, owner: string, key: string, body: ArrayBuffer, type: string, eventId: string) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lock(client, owner);
    const event = await client.query<{ reserved_bytes: string; deleting: boolean | null }>(
      `select e.reserved_bytes::text, (select d.deleting from media_deleted_keys d where d.key = $3) as deleting
       from media_upload_events e where e.id = $1 and e.owner_id = $2 for update`, [eventId, owner, key]);
    if (event.rows[0]?.deleting) throw new HttpError(409, 'هذا الملف قيد التنظيف. حاول رفعه لاحقًا.', 'media_deleting');
    if (!event.rows[0] || body.byteLength > Number(event.rows[0].reserved_bytes)) throw new HttpError(413, 'حجم الرفع يتجاوز الحجم المحجوز. أعد المحاولة.');
    if (!(await media.head(key))) {
      await assertStorageRoom(media, owner, body.byteLength, client);
      await media.put(key, body, { httpMetadata: { contentType: type } });
    }
    await client.query('with gone as (delete from media_deleted_keys where key = $3) update media_upload_events set reserved_bytes = $2 where id = $1', [eventId, body.byteLength, key]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
