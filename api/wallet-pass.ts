import { getPublicPageByUsername, getPageDataByUserId } from './_lib/page.js';
import { normalizeUsername } from './_lib/username.js';
import { getUsernameByDomain } from './_lib/domains.js';
import { requireUser } from './_lib/session.js';
import { buildPkpass, walletConfigured } from './_lib/wallet/pass.js';
import { allowMethods, handleApiError, HttpError } from './_lib/http.js';

// A signed .pkpass for Apple Wallet.
//   GET /api/wallet-pass?username=<name>  → a visitor's card for a PUBLISHED page.
//   GET /api/wallet-pass  (signed in)     → the owner's own card, any status, so
//                                            they can add it while still a draft.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    if (!walletConfigured()) throw new HttpError(503, 'بطاقة Apple Wallet غير مهيأة بعد.');
    const raw = String(req.query?.username ?? '');
    const host = String(req.query?.host ?? '');

    let username = '';
    let name = '';
    if (raw || host) {
      username = normalizeUsername(raw) || (host ? await getUsernameByDomain(host) : '');
      if (!username) throw new HttpError(400, 'اسم الصفحة مطلوب.');
      const page = await getPublicPageByUsername(username);
      if (!page || page.state !== 'published') throw new HttpError(404, 'الصفحة غير متاحة.');
      name = page.pageData.name;
    } else {
      // Owner's own card from the session, even before the page is published.
      const user = await requireUser(req, res);
      if (!user) return;
      const page = await getPageDataByUserId(user.id);
      username = page?.username ?? '';
      name = page?.name ?? '';
      if (!username) throw new HttpError(409, 'عيّن رابط الصفحة أولًا قبل إنشاء البطاقة.');
    }

    const pkpass = buildPkpass({ username, name });
    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="onwan-${username}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pkpass);
  } catch (error) {
    handleApiError(res, error);
  }
}
