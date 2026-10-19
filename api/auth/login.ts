import { getAccountSummary, isValidPhone, normalizeEmail, normalizePhone } from '../_lib/account.js';
import { createSessionToken } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page.js';
import { verifyPassword } from '../_lib/password.js';
import { getBannedMessage } from '../_lib/session.js';

// Existing beneficiaries can use either their email or their registered phone.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const identifier = String(body.identifier ?? body.email ?? '').trim();
    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const password = String(body.password ?? '');

    if ((!email && !isValidPhone(phone)) || !password) {
      throw new HttpError(400, 'البريد الإلكتروني أو رقم الجوال وكلمة المرور مطلوبان.');
    }

    const result = await pool.query<{ id: string; email: string | null; password_hash: string | null; status: string }>(
      'select id, email, password_hash, status from users where email = $1 or phone = $2 limit 1',
      [email || null, isValidPhone(phone) ? phone : null],
    );

    const user = result.rows[0];

    // Accounts created before passwords existed have no hash; they set one
    // through «نسيت كلمة المرور». The same message is used for every failure
    // so the form does not reveal which emails are registered.
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(
        401,
        'البريد الإلكتروني أو رقم الجوال أو كلمة المرور غير صحيحة. إن لم تُنشئ كلمة مرور بعد فاستخدم «نسيت كلمة المرور».',
      );
    }

    if (user.status === 'banned') {
      throw new HttpError(403, getBannedMessage(), 'banned');
    }

    await ensurePageForUser(user.id);

    sendJson(res, 200, {
      token: createSessionToken(user.id, user.email || email),
      pageData: await getPageDataByUserId(user.id),
      account: await getAccountSummary(user.id),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
