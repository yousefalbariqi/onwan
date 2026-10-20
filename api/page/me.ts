import { getAccountSummary } from '../_lib/account.js';
import { ensurePageForUser, getPageDataByUserId, savePageData } from '../_lib/page.js';
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
      const [pageData, account] = await Promise.all([getPageDataByUserId(user.id), getAccountSummary(user.id)]);
      sendJson(res, 200, { pageData, account });
      return;
    }

    const body = await readJsonBody(req);
    // The account summary does not depend on the page content, so it is read
    // alongside the save instead of after it.
    const [pageData, account] = await Promise.all([savePageData(user.id, body.pageData ?? {}), getAccountSummary(user.id)]);

    sendJson(res, 200, { pageData, account });
  } catch (error) {
    handleApiError(res, error);
  }
}
