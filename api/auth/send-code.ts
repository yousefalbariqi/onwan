import { allowMethods, handleApiError, HttpError, sendJson } from '../_lib/http';
import { issueCode } from '../_lib/otp';
import { requireUser } from '../_lib/session';

// ACCT-04: (re)send the email confirmation code to the signed-in account.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const user = await requireUser(req, res);

    if (!user) {
      return;
    }

    if (!user.email) {
      throw new HttpError(400, 'لا يوجد بريد إلكتروني مسجل لهذا الحساب. تواصل مع الإدارة.');
    }

    if (user.email_verified_at) {
      sendJson(res, 200, { message: 'بريدك مؤكد بالفعل.' });
      return;
    }

    await issueCode(user.email, 'verify_email', 'رمز تأكيد بريدك الإلكتروني في عنوان:');

    sendJson(res, 200, { message: 'تم إرسال رمز التأكيد إلى بريدك الإلكتروني.' });
  } catch (error) {
    handleApiError(res, error);
  }
}
