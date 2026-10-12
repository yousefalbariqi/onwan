import { getAccountSummary, normalizeEmail } from '../_lib/account';
import { createSessionToken } from '../_lib/auth';
import { pool } from '../_lib/db';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page';
import { verifyPassword } from '../_lib/password';
import { getBannedMessage } from '../_lib/session';

// NEW-03: email + password login for existing accounts.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');

    if (!email || !password) {
      throw new HttpError(400, 'البريد الإلكتروني وكلمة المرور مطلوبان.');
    }

    const result = await pool.query<{ id: string; password_hash: string | null; status: string }>(
      'select id, password_hash, status from users where email = $1 limit 1',
      [email],
    );

    const user = result.rows[0];

    // Accounts created before passwords existed have no hash; they set one
    // through «نسيت كلمة المرور». The same message is used for every failure
    // so the form does not reveal which emails are registered.
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(
        401,
        'البريد الإلكتروني أو كلمة المرور غير صحيحة. إن لم تُنشئ كلمة مرور بعد فاستخدم «نسيت كلمة المرور».',
      );
    }

    if (user.status === 'banned') {
      throw new HttpError(403, getBannedMessage(), 'banned');
    }

    await ensurePageForUser(user.id);

    sendJson(res, 200, {
      token: createSessionToken(user.id, email),
      pageData: await getPageDataByUserId(user.id),
      account: await getAccountSummary(user.id),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
