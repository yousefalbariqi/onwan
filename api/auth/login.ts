import { serverTiming } from '../_lib/serverTiming.js';
import { assertHuman } from '../_lib/turnstile.js';
import { getAccountSummary, normalizeEmail } from '../_lib/account.js';
import { isValidEmailAddress } from '../../shared/accountRules.js';
import { createSessionToken } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page.js';
import { verifyPassword } from '../_lib/password.js';
import { getBannedMessage } from '../_lib/session.js';
import { assertNotLocked, clearFailures, recordFailure } from '../_lib/loginGuard.js';

// Note 08: sign-in is by email and password; the phone is kept for contact only.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  const timing = serverTiming(res);
  try {
    const body = await timing.measure('body', () => readJsonBody(req));
    await timing.measure('turnstile', () => assertHuman(req, body)); // REQ-020
    const email = normalizeEmail(body.email ?? body.identifier);
    const password = String(body.password ?? '');

    if (!isValidEmailAddress(email) || !password) {
      throw new HttpError(400, 'أدخل بريدك الإلكتروني وكلمة المرور.');
    }

    const tried = email;
    await timing.measure('login_guard', () => assertNotLocked('customer', tried));

    const result = await timing.measure('user_lookup', () => pool.query<{ id: string; email: string | null; password_hash: string | null; status: string; session_version: number }>(
      'select id, email, password_hash, status, session_version from users where email = $1 limit 1',
      [email],
    ));

    const user = result.rows[0];

    // Accounts created before passwords existed have no hash; they set one
    // through «نسيت كلمة المرور». The same message is used for every failure
    // so the form does not reveal which emails are registered.
    if (!user || !timing.sync('password_verify', () => verifyPassword(password, user.password_hash))) {
      await timing.measure('record_failure', () => recordFailure('customer', tried));
      throw new HttpError(
        401,
        'البريد الإلكتروني أو رقم الجوال أو كلمة المرور غير صحيحة. إن لم تُنشئ كلمة مرور بعد فاستخدم «نسيت كلمة المرور».',
      );
    }

    if (user.status === 'banned') {
      throw new HttpError(403, getBannedMessage(), 'banned');
    }

    await timing.measure('clear_failures', () => clearFailures('customer', tried));
    await timing.measure('page_ensure', () => ensurePageForUser(user.id));

    const response = {
      token: createSessionToken(user.id, user.email || email, undefined, user.session_version),
      pageData: await timing.measure('page_load', () => getPageDataByUserId(user.id)),
      account: await timing.measure('account_load', () => getAccountSummary(user.id)),
    };
    timing.flush();
    sendJson(res, 200, response);
  } catch (error) {
    timing.flush();
    handleApiError(res, error);
  }
}
