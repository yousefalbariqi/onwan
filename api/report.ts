import { getEnv } from './_lib/runtime.js';
import { pool } from './_lib/db.js';
import { sendAdminEmail } from './_lib/email.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http.js';
import { getPublicPageByUsername } from './_lib/page.js';
import { normalizeUsername } from './_lib/username.js';

const MAX_REPORTS_PER_PAGE_PER_HOUR = 10;

// PUB-03 / AC-07: a visitor reports the whole page with free text, without an
// account. The report is stored and copied to the administration mailbox.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const username = normalizeUsername(String(body.username ?? ''));
    const message = String(body.message ?? '').trim();

    if (!username || message.length < 5) {
      throw new HttpError(400, 'اكتب سبب البلاغ باختصار.');
    }

    if (message.length > 2000) {
      throw new HttpError(400, 'نص البلاغ طويل جدًا.');
    }

    const page = await getPublicPageByUsername(username);

    if (!page || page.state === 'moved') {
      throw new HttpError(404, 'الصفحة غير موجودة.');
    }

    const recent = await pool.query<{ count: string }>(
      `select count(*)::text as count from page_reports
       where page_id = $1 and created_at > now() - interval '1 hour'`,
      [page.pageId],
    );

    if (Number(recent.rows[0]?.count ?? '0') >= MAX_REPORTS_PER_PAGE_PER_HOUR) {
      throw new HttpError(429, 'استلمنا بلاغات كافية عن هذه الصفحة وستراجعها الإدارة.');
    }

    await pool.query('insert into page_reports (page_id, username, message) values ($1, $2, $3)', [
      page.pageId,
      username,
      message,
    ]);

    const rootDomain = getEnv('ROOT_DOMAIN') || 'onwan.link';

    await sendAdminEmail(`بلاغ عن صفحة: ${username}`, [
      `رابط الصفحة: https://${username}.${rootDomain}`,
      `سبب البلاغ: ${message}`,
    ]);

    sendJson(res, 200, { message: 'تم إرسال البلاغ إلى الإدارة. شكرًا لك.' });
  } catch (error) {
    handleApiError(res, error);
  }
}
