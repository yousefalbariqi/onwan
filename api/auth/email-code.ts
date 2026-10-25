import { getAccountSummary } from '../_lib/account.js';
import { pool } from '../_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http.js';
import { OTP_RESEND_SECONDS, codeFailure, consumeCode, issueCode, resendWaitSeconds } from '../_lib/otp.js';
import { requireUser } from '../_lib/session.js';

// ACCT-04: confirm the signed-in account's email.
//   { action: 'send' }          → (re)send the code
//   { action: 'verify', code }  → confirm it
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const user = await requireUser(req, res);

    if (!user) {
      return;
    }

    const body = await readJsonBody(req);

    if (!user.email) {
      throw new HttpError(400, 'لا يوجد بريد إلكتروني مسجل لهذا الحساب. تواصل مع الإدارة.');
    }

    if (body.action === 'send') {
      if (user.email_verified_at) {
        sendJson(res, 200, { message: 'بريدك مؤكد بالفعل.' });
        return;
      }

      // Note 38: the code sent at signup (or a moment ago) still stands, so
      // opening the code window does not fail; it says so and counts down.
      const wait = await resendWaitSeconds(user.email, 'verify_email');
      if (wait > 0) {
        sendJson(res, 200, { sent: false, retryAfter: wait, message: 'أرسلنا رمز التحقق إلى بريدك الإلكتروني. تحقق من صندوق الوارد.' });
        return;
      }

      await issueCode(user.email, 'verify_email', 'رمز تأكيد بريدك الإلكتروني في عنوان:');
      sendJson(res, 200, { sent: true, retryAfter: OTP_RESEND_SECONDS, message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني. تحقق من صندوق الوارد.' });
      return;
    }

    const code = String(body.code ?? '').trim();

    if (body.action !== 'verify' || !code) {
      throw new HttpError(400, 'رمز التأكيد مطلوب.');
    }

    if (!(await consumeCode(user.email, 'verify_email', code))) {
      throw await codeFailure(user.email, 'verify_email');
    }

    await pool.query('update users set email_verified_at = now(), updated_at = now() where id = $1', [user.id]);

    sendJson(res, 200, { account: await getAccountSummary(user.id) });
  } catch (error) {
    handleApiError(res, error);
  }
}
