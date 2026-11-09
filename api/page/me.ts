import { getAccountSummary } from '../_lib/account.js';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page.js';
import { loadDraft } from '../_lib/pageDraft.js';
import { purgePublicPage } from '../_lib/publicCache.js';
import { HttpError, allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http.js';
import { pool } from '../_lib/db.js';
import { mutatePage } from '../_lib/pageMutation.js';
import { requireUser } from '../_lib/session.js';

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) {
    return;
  }

  try {
    const user = await requireUser(req, res);

    if (!user) {
      return;
    }

    if (req.method === 'GET') {
      await ensurePageForUser(user.id);
      const account = await getAccountSummary(user.id);
      const client = await pool.connect();
      try {
        await client.query('begin isolation level repeatable read');
        const pageData = await getPageDataByUserId(user.id, client);
        const draft = await loadDraft(user.id, client);
        const revision = Number((await client.query('select edit_revision from pages where user_id=$1', [user.id])).rows[0]?.edit_revision);
        await client.query('commit');
        sendJson(res, 200, { pageData, draft, revision, account });
      } catch (error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
      return;
    }

    const body = await readJsonBody(req);

    const account = await getAccountSummary(user.id);
    const result = await mutatePage(user.id, body);
    if (!body.draft) await purgePublicPage(result.pageData?.username).catch(() => undefined);
    sendJson(res, 200, { ...result, account });
  } catch (error) {
    if ((error as any)?.code === '42703' && String((error as any)?.message).includes('edit_revision')) {
      handleApiError(res, new HttpError(503, 'يلزم تشغيل ترحيل قاعدة البيانات phase30-page-revisions.sql قبل استخدام هذا الإصدار.', 'schema_upgrade_required'));
      return;
    }
    handleApiError(res, error);
  }
}
