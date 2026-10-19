import { getAccountSummary, isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from '../_lib/account.js';
import { createSessionToken } from '../_lib/auth.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { issueCode } from '../_lib/otp.js';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page.js';
import { hashPassword, validatePassword } from '../_lib/password.js';
import { getUsernameAvailability, reserveUsername } from '../_lib/username.js';

// ACCT-01 / ACCT-02 / ACCT-03: name + mandatory phone + email + password.
// The account and its draft page are created immediately, with no prior
// approval; the page is not public until payment is confirmed.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const password = String(body.password ?? '');

    if (!isValidPhone(phone)) {
      throw new HttpError(400, 'رقم الجوال مطلوب ويجب أن يكون صحيحًا.');
    }

    if (!isValidEmail(email)) {
      throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      throw new HttpError(400, passwordError);
    }

    const availability = await getUsernameAvailability(String(body.username ?? ''));

    if (!availability.available) {
      throw new HttpError(409, availability.reason ?? 'الاسم غير متاح.', `username_${availability.status}`);
    }

    const client = await pool.connect();
    let userId: string;

    try {
      await client.query('begin');

      const userResult = await client.query<{ id: string }>(
        'insert into users (email, phone, password_hash) values ($1, $2, $3) returning id',
        [email, phone, hashPassword(password)],
      );

      userId = userResult.rows[0].id;

      // NEW-01 (amended): the name is held, not fixed — it becomes the
      // beneficiary's for good when the payment is confirmed.
      await reserveUsername(client, userId, availability.normalized);

      await ensurePageForUser(userId, client);
      await client.query('commit');
    } catch (error: any) {
      await client.query('rollback');

      if (error instanceof HttpError) {
        throw error;
      }

      if (error?.code === '23505') {
        const constraint = String(error.constraint ?? '');

        if (constraint.includes('username')) {
          throw new HttpError(409, 'هذا الاسم حُجز للتو. اختر اسمًا آخر.', 'username_taken');
        }

        // Email or phone already registered.
        throw new HttpError(409, 'يوجد حساب مسجل بهذا البريد أو رقم الجوال. سجّل الدخول بدلًا من ذلك.', 'account_exists');
      }

      throw error;
    } finally {
      client.release();
    }

    // ACCT-04: the email is confirmed by a code after signup; a failed send
    // must not undo the signup — the builder shows a reminder with a resend.
    try {
      await issueCode(email, 'verify_email', 'رمز تأكيد بريدك الإلكتروني في عنوان:');
    } catch (error) {
      console.error('Failed to send email confirmation code:', error);
    }

    sendJson(res, 200, {
      token: createSessionToken(userId, email),
      pageData: await getPageDataByUserId(userId),
      account: await getAccountSummary(userId),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
