import { getAccountSummary, getPlans, isPlan, requestSubscription } from './_lib/account';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http';
import { requireUser } from './_lib/session';

// GET  → plans (prices set by the manager, PAY-01) + the account's subscription.
// POST → record the chosen plan and start checkout.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'POST'])) {
    return;
  }

  try {
    const user = await requireUser(req, res);

    if (!user) {
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { plans: await getPlans(), account: await getAccountSummary(user.id) });
      return;
    }

    const body = await readJsonBody(req);

    if (!isPlan(body.plan)) {
      throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
    }

    await requestSubscription(user.id, body.plan);

    // SUB-02: a payment counts only when the gateway confirms it. The gateway
    // is not chosen yet (pending decision P-08), so there is no checkout URL to
    // hand out and nothing here may mark the subscription as paid. When the
    // gateway is integrated: create the checkout session here and return its
    // URL, then call activateSubscription() from the gateway's webhook.
    sendJson(res, 200, {
      checkoutUrl: null,
      paymentConfigured: false,
      account: await getAccountSummary(user.id),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
