import { pool } from './db.js';
import { HttpError } from './http.js';

// REQ-015: at most this many saves a day per account (drafts and publishing).
export const DAILY_SAVE_LIMIT = 200;
// A draft is the editor's state as is; this only bounds its size (files are
// stored in R2 before a draft is sent, so the JSON itself stays small).
const MAX_DRAFT_CHARS = 2_000_000;

// Counts one save and refuses it past the limit. One atomic statement, so
// simultaneous requests cannot slip past it. Before phase20 runs: no limit.
export async function countSave(userId: string) {
  const result = await pool.query<{ saves: number }>(
    `insert into page_save_counts (user_id, day, saves) values ($1, current_date, 1)
     on conflict (user_id, day) do update set saves = page_save_counts.saves + 1
     returning saves`,
    [userId],
  ).catch((error: any) => {
    if (error?.code === '42P01') return null;
    throw error;
  });
  if (result?.rows[0] && result.rows[0].saves > DAILY_SAVE_LIMIT) {
    throw new HttpError(429, `وصلت للحد اليومي (${DAILY_SAVE_LIMIT} حفظة). تعديلاتك باقية في هذا الجهاز؛ تابع غدًا.`, 'save_limit');
  }
}

export async function saveDraft(userId: string, pageData: unknown) {
  if (!pageData || typeof pageData !== 'object') throw new HttpError(400, 'مسودة غير صالحة.');
  const json = JSON.stringify(pageData);
  if (json.length > MAX_DRAFT_CHARS) throw new HttpError(413, 'المسودة كبيرة جدًا.');
  const result = await pool.query(
    'update pages set draft_json = $2::jsonb, draft_saved_at = now() where user_id = $1 returning draft_saved_at',
    [userId, json],
  ).catch((error: any) => {
    if (error?.code === '42703') throw new HttpError(503, 'يلزم تشغيل ملف قاعدة البيانات phase20-drafts-and-save-limit.sql.');
    throw error;
  });
  return { savedAt: result.rows[0]?.draft_saved_at ?? null };
}

// The unpublished draft, when it is newer than what was published.
export async function loadDraft(userId: string) {
  const result = await pool.query<{ draft: any; saved_at: string | null; newer: boolean }>(
    `select to_jsonb(p)->'draft_json' as draft, to_jsonb(p)->>'draft_saved_at' as saved_at,
            coalesce((to_jsonb(p)->>'draft_saved_at')::timestamptz > p.updated_at, false) as newer
     from pages p where p.user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row?.draft && row.newer ? { pageData: row.draft, savedAt: row.saved_at } : null;
}

// Publishing makes the draft the page itself.
export async function clearDraft(userId: string) {
  await pool.query("update pages set draft_json = null, draft_saved_at = null where user_id = $1 and to_jsonb(pages) ? 'draft_json'", [userId])
    .catch(() => undefined);
}
