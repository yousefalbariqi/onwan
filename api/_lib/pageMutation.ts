import { pool } from './db.js';
import { HttpError } from './http.js';
import { countSave, MAX_DRAFT_CHARS } from './pageDraft.js';
import { getPageDataByUserId, savePageData } from './page.js';

// One locked revision covers both drafts and publication. Every page UPDATE,
// including staff edits, advances it through phase30's trigger.
export async function mutatePage(userId: string, body: any, options: { staffName?: string } = {}) {
  if (!Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.operationId !== 'string' || body.operationId.length > 100 || !body.operationId) {
    throw new HttpError(409, 'حدّث المحرر قبل الحفظ. نسختك المحلية لم تُحذف.', 'page_conflict');
  }
  const client = await pool.connect();
  let revision: number;
  let pageData: any;
  try {
    await client.query('begin');
    const result = await client.query('select edit_revision,last_edit_operation,draft_json from pages where user_id=$1 for update', [userId]);
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'الصفحة غير موجودة.');
    if (row.last_edit_operation === body.operationId) {
      revision = Number(row.edit_revision);
    } else {
      if (Number(row.edit_revision) !== body.revision) throw new HttpError(409, 'توجد نسخة أحدث من جهاز أو تبويب آخر. احتفظنا بتعديلاتك؛ راجع النسختين قبل المتابعة.', 'page_conflict');
      if (body.draft === true) {
        const data = body.pageData;
        if (data !== null && (!data || typeof data !== 'object' || JSON.stringify(data).length > MAX_DRAFT_CHARS)) throw new HttpError(400, 'مسودة غير صالحة أو كبيرة جدًا.');
        // Identical retries and unchanged content do not consume the save quota.
        const equal = (await client.query('select $1::jsonb is not distinct from $2::jsonb as equal', [JSON.stringify(row.draft_json), JSON.stringify(data)])).rows[0].equal;
        if (!equal) {
          if (data !== null) await countSave(userId, client);
          await client.query('update pages set draft_json=$2::jsonb,draft_base_revision=case when $2::jsonb is null then null else published_revision end,draft_saved_at=case when $2::jsonb is null then null else now() end,last_edit_operation=$3 where user_id=$1', [userId, JSON.stringify(data), body.operationId]);
        }
      } else {
        if (body.pageData?.editorForm) throw new HttpError(400, 'يوجد عنصر غير مكتمل؛ طبّقه قبل نشر الصفحة.');
        if (!options.staffName) await countSave(userId, client);
        await savePageData(userId, body.pageData ?? {}, { client, staffName: options.staffName });
        await client.query(options.staffName
          ? 'update pages set last_edit_operation=$2 where user_id=$1'
          : 'update pages set draft_json=null,draft_saved_at=null,draft_base_revision=null,last_edit_operation=$2 where user_id=$1', [userId, body.operationId]);
      }
      revision = Number((await client.query('select edit_revision from pages where user_id=$1', [userId])).rows[0].edit_revision);
    }
    if (!body.draft) pageData = await getPageDataByUserId(userId, client);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
  return body.draft ? { revision, savedAt: body.pageData === null ? null : new Date().toISOString() } : { revision, pageData };
}
