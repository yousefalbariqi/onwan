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
      sendJson(res, 200, {
        pageData: await getPageDataByUserId(user.id),
        account: await getAccountSummary(user.id),
      });
      return;
    }

    const body = await readJsonBody(req);
    const pageData = await savePageData(user.id, body.pageData ?? {});

    sendJson(res, 200, { pageData, account: await getAccountSummary(user.id) });
  } catch (error) {
    handleApiError(res, error);
  }
}
