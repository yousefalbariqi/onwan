import { pool } from './_lib/db';
import { sendAdminEmail } from './_lib/email';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http';
import { requireUser } from './_lib/session';

// What the beneficiary may ask the administration for. Each one is a request
// only — execution stays with the administration (PAGE-13, PAGE-14,
// DOMAIN-01, SUB-05, FILE-03, PAY-05).
const REQUEST_TYPES: Record<string, string> = {
  message: 'رسالة للإدارة',
  pause_page: 'طلب إيقاف الصفحة',
  reactivate_page: 'طلب إعادة تفعيل الصفحة',
  delete_account: 'طلب حذف الحساب',
  change_subdomain: 'طلب تغيير رابط الصفحة',
  stop_renewal: 'طلب إيقاف التجديد',
  more_storage: 'طلب زيادة المساحة',
  invoice: 'طلب فاتورة',
};

// PAGE-12 / REQ-01: saved for the administration panel, with a copy by email.
// The internal status is never returned to the beneficiary (REQ-03).
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
    const type = String(body.type ?? '');
    const message = String(body.message ?? '').trim();

    if (!REQUEST_TYPES[type]) {
      throw new HttpError(400, 'نوع الطلب غير معروف.');
    }

    if (message.length < 3) {
      throw new HttpError(400, 'اكتب تفاصيل الطلب.');
    }

    if (message.length > 4000) {
      throw new HttpError(400, 'نص الطلب طويل جدًا.');
    }

    await pool.query('insert into support_requests (user_id, type, message) values ($1, $2, $3)', [
      user.id,
      type,
      message,
    ]);

    await sendAdminEmail(`${REQUEST_TYPES[type]} — ${user.email ?? user.phone}`, [
      `النوع: ${REQUEST_TYPES[type]}`,
      `البريد: ${user.email ?? '—'}`,
      `الجوال: ${user.phone}`,
      `التفاصيل: ${message}`,
    ]);

    sendJson(res, 200, { message: 'تم استلام طلبك وسيتواصل معك فريق عنوان.' });
  } catch (error) {
    handleApiError(res, error);
  }
}
