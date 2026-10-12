import { getPublicPageByUsername } from './_lib/page';
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

    const page = await getPublicPageByUsername(username);

    if (!page) {
      sendJson(res, 404, { error: 'Page not found' });
      return;
    }

    if (page.state === 'moved') {
      sendJson(res, 200, { movedTo: page.username });
      return;
    }

    if (page.state === 'suspended') {
      sendJson(res, 200, { suspended: true, message: page.message });
      return;
    }

    sendJson(res, 200, { pageData: page.pageData });
  } catch (error) {
    handleApiError(res, error);
  }
}
