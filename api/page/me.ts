import { getBearerToken, verifySessionToken } from '../_lib/auth';
import { ensurePageForUser, getPageDataByUserId, savePageData } from '../_lib/page';
import { allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http';

function requireSession(req: any, res: any) {
  const session = verifySessionToken(getBearerToken(req));

  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }

  return session;
}

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) {
    return;
  }

  try {
    const session = requireSession(req, res);

    if (!session) {
      return;
    }

    if (req.method === 'GET') {
      await ensurePageForUser(session.userId);
      const pageData = await getPageDataByUserId(session.userId);
      sendJson(res, 200, { pageData });
      return;
    }

    const body = await readJsonBody(req);
    const pageData = await savePageData(session.userId, body.pageData ?? {});

    sendJson(res, 200, { pageData });
  } catch (error) {
    handleApiError(res, error);
  }
}
