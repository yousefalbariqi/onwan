import { requireUser } from './_lib/session.js';
import { getPageDataByUserId, getPublicPageByUsername } from './_lib/page.js';
import { pool } from './_lib/db.js';
import { buildGoogleObject, existingGoogleSaveLink, yaamurTrialLink, issueGoogleWallet } from './_lib/googleWallet.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http.js';
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      if (req.query?.test === 'yaamur') { res.status(302).setHeader('Location', await yaamurTrialLink()); res.send(''); return; }
      const username = String(req.query?.username || '').toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(username)) throw new HttpError(400, 'رابط الصفحة غير صالح.');
      const published = await getPublicPageByUsername(username);
      if (!published || published.state !== 'published') throw new HttpError(404, 'الصفحة غير متاحة.');
      // Read-only save link. Creating/updating cards requires the signed-in owner.
      const object = buildGoogleObject(published.pageId, published.pageData);
      res.status(302).setHeader('Location', await existingGoogleSaveLink(object.id)); res.send(''); return;
    }
    const user = await requireUser(req, res);
    if (!user) return;
    const body = await readJsonBody(req);
    if (body.color && !/^#[a-f0-9]{6}$/i.test(body.color)) throw new HttpError(400, 'لون البطاقة غير صالح.');
    const page = await getPageDataByUserId(user.id);
    if (!page?.username) throw new HttpError(409, 'احفظ رابط الصفحة أولًا.');
    const result = await pool.query('select id from pages where user_id=$1', [user.id]);
    if (!result.rows[0]) throw new HttpError(404, 'الصفحة غير موجودة.');
    const url = await issueGoogleWallet(String(result.rows[0].id), page, body.color);
    sendJson(res, 200, { url });
  } catch (error) {
    // Network and signing errors must not expose credentials or signed links.
    handleApiError(res, error instanceof HttpError ? error : new HttpError(502, 'تعذر تجهيز بطاقة Google Wallet. حاول مجددًا.'));
  }
}
