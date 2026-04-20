import { getPageDataByUsername } from './_lib/page';
import { allowMethods, handleApiError, sendJson } from './_lib/http';
import { normalizeUsername } from './_lib/username';

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET'])) {
    return;
  }

  try {
    const username = normalizeUsername(String(req.query.username ?? ''));

    if (!username) {
      sendJson(res, 400, { error: 'Username is required' });
      return;
    }

    const pageData = await getPageDataByUsername(username);

    if (!pageData) {
      sendJson(res, 404, { error: 'Page not found' });
      return;
    }

    sendJson(res, 200, { pageData });
  } catch (error) {
    handleApiError(res, error);
  }
}
