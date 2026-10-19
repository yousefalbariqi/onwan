import { runAdminAction } from './_lib/admin.js';
import { allowMethods, handleApiError, readJsonBody, sendJson } from './_lib/http.js';

// One function for the whole administration panel (the Vercel plan caps the
// number of functions): POST { action, ...params }. Access rules live in
// api/_lib/admin.ts.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const { action, ...params } = await readJsonBody(req);

    sendJson(res, 200, await runAdminAction(req, String(action ?? ''), params));
  } catch (error) {
    handleApiError(res, error);
  }
}
