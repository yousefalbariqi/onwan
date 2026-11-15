import { pool } from './db.js';
import { getBearerToken, verifySessionToken } from './auth.js';
import { HttpError } from './http.js';
import { MAX_DRAFT_CHARS } from './pageDraft.js';

export async function requireCreationDraft(req: any, options: { allowCompleted?: boolean } = {}) {
  const session = verifySessionToken(getBearerToken(req));
  if (!session || session.kind !== 'creation') throw new HttpError(401, 'تحقق من بريدك لفتح مسودة الصفحة.', 'creation_session_required');
  const result = await pool.query('select id,email,revision,page_json,updated_at,account_user_id,terms_accepted_at,terms_version from creation_email_drafts where id=$1 and email=$2 and revoked_at is null', [session.userId, session.email]);
  const draft = result.rows[0];
  if (!draft) throw new HttpError(401, 'انتهت صلاحية الوصول للمسودة. تحقق من بريدك مجددًا.', 'creation_session_required');
  if (draft.account_user_id && !options.allowCompleted) throw new HttpError(409, 'تم حفظ المسودة في حسابك. سجّل الدخول للمتابعة.', 'creation_completed');
  return draft;
}
export function validateCreationPayload(data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.name !== 'string' || !Array.isArray(data.links) || data.links.length > 30 || JSON.stringify(data).length > MAX_DRAFT_CHARS) {
    throw new HttpError(400, 'المسودة غير صالحة أو أكبر من الحد المسموح.');
  }
  if (/data:[^"\s]*;base64,/i.test(JSON.stringify(data))) throw new HttpError(400, 'ارفع ملفات المسودة قبل حفظها.', 'media_inline_forbidden');
}
export async function saveCreationCloudDraft(id: string, body: any) {
  validateCreationPayload(body.pageData);
  if (!Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.operationId !== 'string' || !body.operationId || body.operationId.length > 100) throw new HttpError(409, 'حدّث المسودة قبل الحفظ.', 'creation_conflict');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query('select revision,last_operation from creation_email_drafts where id=$1 and revoked_at is null and account_user_id is null for update', [id]);
    const row = result.rows[0];
    if (!row) throw new HttpError(401, 'أعد التحقق من البريد لفتح المسودة.');
    let revision = Number(row.revision);
    if (row.last_operation !== body.operationId) {
      if (revision !== body.revision) throw new HttpError(409, 'توجد نسخة أحدث من مسودتك. احتفظنا بتعديلات هذا الجهاز؛ أعد فتح المسودة قبل المتابعة.', 'creation_conflict');
      revision = Number((await client.query('update creation_email_drafts set page_json=$2::jsonb,revision=revision+1,last_operation=$3,updated_at=now() where id=$1 returning revision', [id, JSON.stringify(body.pageData), body.operationId])).rows[0].revision);
    }
    await client.query('commit');
    return { revision };
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
