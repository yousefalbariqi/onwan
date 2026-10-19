import { runAccountAction } from './_lib/accountActions.js';
import { allowMethods, handleApiError, readJsonBody, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';

// Everything the signed-in beneficiary does besides editing the page:
// requests, «صمّم لي», NFC orders, account changes. POST { action, ...params }.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const user = await requireUser(req, res);

    if (!user) {
      return;
    }

    const { action, ...params } = await readJsonBody(req);

    sendJson(res, 200, await runAccountAction(String(action ?? ''), params, user));
  } catch (error) {
    handleApiError(res, error);
  }
}
