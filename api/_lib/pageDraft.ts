import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { HttpError } from './http.js';

// REQ-015: at most this many saves a day per account (drafts and publishing).
export const DAILY_SAVE_LIMIT = 600;
// A draft is the editor's state as is; this only bounds its size (files are
// stored in R2 before a draft is sent, so the JSON itself stays small).
export const MAX_DRAFT_CHARS = 2_000_000;

// Counts one save and refuses it past the limit. One atomic statement, so
// simultaneous requests cannot slip past it. Before phase20 runs: no limit.
export async function countSave(userId: string, client?: PoolClient) {
  const result = await (client ?? pool).query<{ saves: number }>(
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

// Draft lifecycle is controlled by atomic publication, not updated_at (which
// is also changed by the legacy pages timestamp trigger).
export async function loadDraft(userId: string, client?: PoolClient) {
  const result = await (client ?? pool).query<{ draft: any; saved_at: string | null; conflict: boolean }>(
    `select to_jsonb(p)->'draft_json' as draft, to_jsonb(p)->>'draft_saved_at' as saved_at,
       coalesce((to_jsonb(p)->>'draft_base_revision')::bigint <> (to_jsonb(p)->>'published_revision')::bigint,false) as conflict
     from pages p where p.user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row?.draft ? { pageData: row.draft, savedAt: row.saved_at, conflict: row.conflict } : null;
}
