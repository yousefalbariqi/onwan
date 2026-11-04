import crypto from 'node:crypto';
import { getPublicPageByUsername, getPageDataByUserId } from './_lib/page.js';
import { normalizeUsername } from './_lib/username.js';
import { getUsernameByDomain } from './_lib/domains.js';
import { requireUser } from './_lib/session.js';
import { getEnv } from './_lib/runtime.js';
import { buildPkpass, walletConfigured } from './_lib/wallet/pass.js';
import { readWalletArtwork, validateWalletArtwork, type WalletArtworkRefs } from './_lib/wallet/artwork.js';
import { allowMethods, handleApiError, HttpError, sendJson } from './_lib/http.js';

// A signed .pkpass for Apple Wallet.
//   ?link=1   (signed in)  → a short-lived URL the browser can open directly;
//                            iOS Safari can only add a pass from a real URL,
//                            not a blob download, so the UI opens that URL.
//   ?pass=<t>              → redeems that URL; builds the owner's own card.
//   ?username=<name>       → a visitor's card for a PUBLISHED page.
//   (signed in, no params) → the owner's own card (kept for API use).

const PASS_LINK_TTL_MS = 30 * 60 * 1000;

function signPassToken(userId: string, artwork?: WalletArtworkRefs): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, a: artwork, e: Date.now() + PASS_LINK_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', getEnv('SESSION_SECRET') || '').update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyPassToken(token: string): { userId: string; artwork?: WalletArtworkRefs } | null {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', getEnv('SESSION_SECRET') || '').update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.u || !data.e || Date.now() > data.e) return null;
    return { userId: String(data.u), artwork: validateWalletArtwork(data.a, String(data.u)) };
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    if (!walletConfigured()) throw new HttpError(503, 'بطاقة Apple Wallet غير مهيأة بعد.');
    const raw = String(req.query?.username ?? '');
    const host = String(req.query?.host ?? '');
    const pass = String(req.query?.pass ?? '');

    const color = String(req.query?.color ?? '');
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) throw new HttpError(400, 'لون البطاقة غير صالح.');

    // Step 1: the signed-in owner asks for an openable link.
    if (req.query?.link) {
      const user = await requireUser(req, res);
      if (!user) return;
      let artwork: WalletArtworkRefs | undefined;
      if (req.query?.artwork) {
        let input: unknown;
        try { input = JSON.parse(String(req.query.artwork)); }
        catch { throw new HttpError(400, 'تصميم البطاقة غير صالح.'); }
        artwork = validateWalletArtwork(input, user.id);
      }
      const page = await getPageDataByUserId(user.id);
      if (!page?.username) throw new HttpError(409, 'عيّن رابط الصفحة أولًا قبل إنشاء البطاقة.');
      return sendJson(res, 200, { url: `/api/wallet-pass?pass=${encodeURIComponent(signPassToken(user.id, artwork))}${color ? `&color=${encodeURIComponent(color)}` : ''}` });
    }

    let artworkRefs: WalletArtworkRefs | undefined;
    let username = '';
    let name = '';
    let design: { wallpaper?: unknown; theme?: unknown } | undefined;
    if (pass) {
      // Step 2: redeem the short-lived link (opened directly by the browser).
      const verified = verifyPassToken(pass);
      if (!verified) throw new HttpError(401, 'انتهت صلاحية رابط البطاقة. أنشئه من جديد.');
      artworkRefs = verified.artwork;
      const page = await getPageDataByUserId(verified.userId);
      username = page?.username ?? '';
      name = page?.name ?? '';
      design = page ?? undefined;
      if (!username) throw new HttpError(409, 'عيّن رابط الصفحة أولًا قبل إنشاء البطاقة.');
    } else if (raw || host) {
      username = normalizeUsername(raw) || (host ? await getUsernameByDomain(host) : '');
      if (!username) throw new HttpError(400, 'اسم الصفحة مطلوب.');
      const page = await getPublicPageByUsername(username);
      if (!page || page.state !== 'published') throw new HttpError(404, 'الصفحة غير متاحة.');
      name = page.pageData.name;
      design = page.pageData;
    } else {
      const user = await requireUser(req, res);
      if (!user) return;
      const page = await getPageDataByUserId(user.id);
      username = page?.username ?? '';
      name = page?.name ?? '';
      design = page ?? undefined;
      if (!username) throw new HttpError(409, 'عيّن رابط الصفحة أولًا قبل إنشاء البطاقة.');
    }

    if (color) design = { ...design, wallpaper: { type: 'color', value: color } };
    const pkpass = buildPkpass({ username, name, design, artwork: await readWalletArtwork(artworkRefs), style: req.query?.style === 'generic' ? 'generic' : undefined });
    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    // `inline`, not `attachment`: iOS Safari refuses to «download» a pkpass, but
    // hands an inline one straight to Apple Wallet. Desktop still saves it.
    res.setHeader('Content-Disposition', `inline; filename="onwan-${username}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pkpass);
  } catch (error) {
    handleApiError(res, error);
  }
}
