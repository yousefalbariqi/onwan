import { createPrivateKey, sign } from 'node:crypto';
import { getEnv } from './runtime.js';
import { HttpError } from './http.js';
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function config() {
  try {
    const credentials = JSON.parse(getEnv('GOOGLE_WALLET_SERVICE_ACCOUNT') || getEnv('GOOGLE_WALLET_CREDENTIALS') || '');
    const issuer = getEnv('GOOGLE_WALLET_ISSUER_ID');
    const classId = getEnv('GOOGLE_WALLET_CLASS_ID');
    if (!issuer || !classId || credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) throw new Error();
    return { credentials, issuer, classId };
  } catch { throw new HttpError(503, 'Google Wallet غير متاح مؤقتًا. حاول لاحقًا.'); }
}
function jwt(payload: unknown) {
  const { credentials } = config();
  const data = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}`;
  try { return `${data}.${sign('RSA-SHA256', Buffer.from(data), createPrivateKey(credentials.private_key)).toString('base64url')}`; }
  catch { throw new HttpError(503, 'تعذر توقيع بطاقة Google Wallet.'); }
}
let cached: { email: string; token: string; expires: number } | undefined;
async function token() {
  const { credentials } = config();
  if (cached?.email === credentials.client_email && cached.expires > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(15000) });
  const body: any = await response.json();
  if (!response.ok || !body.access_token) throw new HttpError(502, 'تعذر الاتصال بخدمة Google Wallet.');
  cached = { email: credentials.client_email, token: body.access_token, expires: Date.now() + Math.max(0, Number(body.expires_in || 3600) - 120) * 1000 };
  return cached.token;
}
export function buildGoogleObject(pageId: string, page: { username: string; name?: string; profileImage?: string }, color = '#ff6b2c') {
  const { issuer, classId } = config();
  const url = `https://${page.username}.onwan.link`;
  const localized = (value: string) => ({ defaultValue: { language: 'ar', value } });
  const logo = page.profileImage?.startsWith('/media/') ? `https://onwan.link${page.profileImage}` : page.profileImage;
  return {
    id: `${issuer}.onwan_${pageId.replace(/[^a-zA-Z0-9_-]/g, '_')}`, classId, state: 'ACTIVE',
    cardTitle: localized(`${page.username}.onwan.link`), header: localized(page.name || page.username),
    subheader: localized('بطاقة تعريفية'), hexBackgroundColor: /^#[a-f0-9]{6}$/i.test(color) ? color : '#ff6b2c',
    ...(logo && /^https:\/\//.test(logo) ? { logo: { sourceUri: { uri: logo }, contentDescription: localized(page.name || page.username) } } : {}),
    barcode: { type: 'QR_CODE', value: url, alternateText: 'امسح لفتح الصفحة' },
    linksModuleData: { uris: [{ id: 'page', uri: url, description: 'زيارة الصفحة' }] },
  };
}
export async function issueGoogleWallet(pageId: string, page: { username: string; name?: string; profileImage?: string }, color?: string) {
  const object = buildGoogleObject(pageId, page, color);
  const authorization = `Bearer ${await token()}`;
  const base = 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject';
  const headers = { Authorization: authorization, 'Content-Type': 'application/json' };
  const existing = await fetch(`${base}/${encodeURIComponent(object.id)}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!existing.ok && existing.status !== 404) throw new HttpError(502, 'تعذر قراءة بطاقة Google Wallet.');
  let response = await fetch(existing.status === 404 ? base : `${base}/${encodeURIComponent(object.id)}`, { method: existing.status === 404 ? 'POST' : 'PATCH', headers, body: JSON.stringify(object), signal: AbortSignal.timeout(15000) });
  if (response.status === 409 && existing.status === 404) response = await fetch(`${base}/${encodeURIComponent(object.id)}`, { method: 'PATCH', headers, body: JSON.stringify(object), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new HttpError(502, 'تعذر تجهيز بطاقة Google Wallet. حاول مجددًا.');
  return googleSaveLink(object.id);
}
export function googleSaveLink(id: string) {
  const { credentials } = config();
  const now = Math.floor(Date.now() / 1000);
  return `https://pay.google.com/gp/v/save/${jwt({ iss: credentials.client_email, aud: 'google', typ: 'savetowallet', iat: now, origins: ['onwan.link', 'nonprofit.onwan.link'], payload: { genericObjects: [{ id }] } })}`;
}

export async function existingGoogleSaveLink(id: string) {
  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) throw new HttpError(404, 'لم يتم تجهيز البطاقة بعد. أضفها من قسم المشاركة أولًا.');
  if (!response.ok) throw new HttpError(502, 'تعذر قراءة بطاقة Google Wallet.');
  return googleSaveLink(id);
}
export async function yaamurTrialLink() {
  const { issuer } = config();
  return existingGoogleSaveLink(`${issuer}.test_yaamur_connection_20261108`);
}
