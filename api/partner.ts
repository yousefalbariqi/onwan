import { getOrigin } from './_lib/admin';
import { allowMethods, handleApiError, readJsonBody, sendJson } from './_lib/http';
import { runPartnerAction } from './_lib/partner';

// Print-partner portal, plus the two customer-facing links a partner sale
// produces (payment link, set-password link): POST { action, ...params }.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const { action, ...params } = await readJsonBody(req);

    sendJson(res, 200, await runPartnerAction(req, String(action ?? ''), params, getOrigin(req)));
  } catch (error) {
    handleApiError(res, error);
  }
}
