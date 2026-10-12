import { getAccountSummary } from '../_lib/account';
import { pool } from '../_lib/db';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from '../_lib/http';
import { consumeCode } from '../_lib/otp';
import { requireUser } from '../_lib/session';

// ACCT-04: confirm the signed-in account's email with the emailed code.
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
    const code = String(body.code ?? '').trim();

    if (!user.email || !code) {
      throw new HttpError(400, 'رمز التأكيد مطلوب.');
    }

    if (!(await consumeCode(user.email, 'verify_email', code))) {
      throw new HttpError(401, 'الرمز غير صحيح أو منتهي الصلاحية.');
    }

    await pool.query('update users set email_verified_at = now(), updated_at = now() where id = $1', [user.id]);

    sendJson(res, 200, { account: await getAccountSummary(user.id) });
  } catch (error) {
    handleApiError(res, error);
  }
}
