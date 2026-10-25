import { HttpError } from './http.js';
import { pool } from './db.js';
import { REFERENCED_SQL, SAVED_SQL } from './mediaReferences.js';
import type { PoolClient } from 'pg';

// Owner clarification: 200 MiB is the TOTAL ceiling; temporary uploads are
// capped at 30 MiB within it. Old files count until physically deleted.
export const STORAGE_QUOTA_BYTES = 200 * 1024 * 1024;
export const TEMP_QUOTA_BYTES = 30 * 1024 * 1024;
type Listing = { objects: { key: string; size: number }[]; truncated: boolean; cursor?: string };
type Listable = { list?: (options: { prefix: string; cursor?: string }) => Promise<Listing> };

export async function listOwnerFiles(media: Listable, ownerId: string) {
  if (typeof media.list !== 'function') throw new HttpError(503, 'تعذر التحقق من مساحة الملفات. حاول لاحقًا.');
  const files: { key: string; size: number }[] = [];
  for (const prefix of [`files/${ownerId}/`, `wallpapers/${ownerId}/`]) {
    let cursor: string | undefined;
    do {
      const page = await media.list({ prefix, cursor });
      for (const file of page.objects) {
        if (!Number.isSafeInteger(file.size) || file.size < 0) throw new HttpError(503, 'تعذر التحقق من حجم الملفات.');
        files.push(file);
      }
      if (page.truncated && (!page.cursor || page.cursor === cursor)) throw new HttpError(503, 'تعذر إكمال فحص مساحة الملفات.');
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return files;
}
export async function storageUsed(media: Listable, ownerId: string) {
  return (await listOwnerFiles(media, ownerId)).reduce((sum, file) => sum + file.size, 0);
}
export async function assertStorageRoom(media: Listable, ownerId: string, incoming: number, db: Pick<PoolClient, 'query'> = pool) {
  const files = await listOwnerFiles(media, ownerId);
  const used = files.reduce((sum, file) => sum + file.size, 0);
  if (used + incoming > STORAGE_QUOTA_BYTES) throw new HttpError(413, 'امتلأت مساحة حسابك (200 MB)، وتشمل الملفات القديمة حتى حذفها.', 'storage_quota');
  const referenced = await db.query<{ key: string }>(REFERENCED_SQL);
  const saved = await db.query<{ key: string }>(SAVED_SQL);
  const permanent = new Set([...referenced.rows, ...saved.rows].map(row => row.key));
  const temporary = files.filter(file => !permanent.has(file.key)).reduce((sum, file) => sum + file.size, 0);
  if (temporary + incoming > TEMP_QUOTA_BYTES) throw new HttpError(413, 'امتلأت مساحة الرفع المؤقت (30 MB). احفظ الملفات الحالية أو انتظر تنظيف الرفع المهجور.', 'temporary_quota');
}
