import { getAccountSummary, normalizeEmail } from '../_lib/account';
import { createSessionToken } from '../_lib/auth';
import { pool } from '../_lib/db';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http';
import { consumeCode, issueCode } from '../_lib/otp';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page';
import { hashPassword, validatePassword } from '../_lib/password';
import { getBannedMessage } from '../_lib/session';

// ACCT-06: one-time code to the registered email, then a new password.
//   { action: 'request', email }
//   { action: 'confirm', email, code, password }
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);

    if (!email) {
      throw new HttpError(400, 'البريد الإلكتروني مطلوب.');
    }

    const userResult = await pool.query<{ id: string; status: string }>(
      'select id, status from users where email = $1 limit 1',
      [email],
    );

    const user = userResult.rows[0];

    if (body.action === 'request') {
      // Same answer whether or not the email is registered — including when
      // the code could not be issued (cooldown, mail failure) — so the form
      // cannot be used to probe which emails have accounts.
      if (user && user.status === 'active') {
        try {
          await issueCode(email, 'reset_password', 'رمز استعادة كلمة المرور في عنوان:');
        } catch (error) {
          if (!(error instanceof HttpError)) {
            console.error('Failed to send password reset code:', error);
          }
        }
      }

      sendJson(res, 200, { message: 'إن كان البريد مسجلًا لدينا فسيصلك رمز الاستعادة خلال لحظات.' });
      return;
    }

    if (body.action !== 'confirm') {
      throw new HttpError(400, 'طلب غير صالح.');
    }

    const password = String(body.password ?? '');
    const passwordError = validatePassword(password);

    if (passwordError) {
      throw new HttpError(400, passwordError);
    }

    if (!user || !(await consumeCode(email, 'reset_password', String(body.code ?? '')))) {
      throw new HttpError(401, 'الرمز غير صحيح أو منتهي الصلاحية.');
    }

    if (user.status === 'banned') {
      throw new HttpError(403, getBannedMessage(), 'banned');
    }

    // Receiving the code proves ownership of the mailbox as well.
    await pool.query(
      `update users
       set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
       where id = $1`,
      [user.id, hashPassword(password)],
    );

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
