import { getAccountSummary } from '../_lib/account.js';
import { ensurePageForUser, getPageDataByUserId, savePageData } from '../_lib/page.js';
import { clearDraft, countSave, loadDraft, saveDraft } from '../_lib/pageDraft.js';
import { purgePublicPage } from '../_lib/publicCache.js';
import { allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http.js';
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
      const [pageData, account, draft] = await Promise.all([getPageDataByUserId(user.id), getAccountSummary(user.id), loadDraft(user.id)]);
      sendJson(res, 200, { pageData, account, draft });
      return;
    }

    const body = await readJsonBody(req);

    // Back to the published version: the draft is dropped (not a save).
    if (body.draft === true && body.pageData === null) {
      await clearDraft(user.id);
      sendJson(res, 200, { savedAt: null });
      return;
    }

    // REQ-015: every save — draft or publish — counts toward the daily limit.
    await countSave(user.id);

    // A draft is kept for the owner only; the public page is unchanged.
    if (body.draft === true) {
      sendJson(res, 200, await saveDraft(user.id, body.pageData));
      return;
    }

    // The account summary does not depend on the page content, so it is read
    // alongside the save instead of after it.
    const [pageData, account] = await Promise.all([savePageData(user.id, body.pageData ?? {}, { slimResponse: body.slim === true }), getAccountSummary(user.id)]);
    await clearDraft(user.id);
    // REQ-021: visitors see the published version at once.
    await purgePublicPage(pageData?.username);

    sendJson(res, 200, { pageData, account });
  } catch (error) {
    handleApiError(res, error);
  }
}
