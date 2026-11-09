// One minimal test object; does not change the existing class or application UI.
// No private keys, OAuth tokens or signed JWTs are printed or saved.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createPrivateKey, sign } from 'node:crypto';
const env = { ...parseEnv(fs.readFileSync('.env.local', 'utf8')), ...process.env };
const issuer = env.GOOGLE_WALLET_ISSUER_ID || '3388000000023219826';
const classId = env.GOOGLE_WALLET_CLASS_ID || '3388000000023219826.3388000000023219826.onwan_digital_card';
const id = `${issuer}.test_yaamur_connection_20261108`;
const url = 'https://yaamur.onwan.link';
const localized = value => ({ defaultValue: { language: 'ar', value } });
const object = { id, classId, state: 'ACTIVE', cardTitle: localized('عنوان — اختبار تقني'), header: localized('جمعية يعمر'), hexBackgroundColor: '#ff6b2c', subheader: localized('بطاقة تعريفية'), barcode: { type: 'QR_CODE', value: url, alternateText: 'yaamur.onwan.link' }, linksModuleData: { uris: [{ uri: url, description: 'زيارة صفحة الجمعية' }] } };
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const output = value => console.log(JSON.stringify(value));
try {
  const credentials = JSON.parse(env.GOOGLE_WALLET_CREDENTIALS || fs.readFileSync(path.resolve(env.GOOGLE_WALLET_CREDENTIALS_FILE), 'utf8'));
  if (issuer !== '3388000000023219826' || credentials.project_id !== 'healthy-firefly-514111-j1') throw Error('configuration_mismatch');
  const key = createPrivateKey(credentials.private_key), now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const auth = await request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const token = await auth.json();
  output({ stage: 'authentication', httpStatus: auth.status, success: auth.ok });
  if (!auth.ok || !token.access_token) throw Error('authentication_failed');
  const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
  const endpoint = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(id)}`;
  let response = await request(endpoint, { headers });
  if (response.status === 404) {
    const created = await request('https://walletobjects.googleapis.com/walletobjects/v1/genericObject', { method: 'POST', headers, body: JSON.stringify(object) });
    const result = await created.json();
    output({ stage: 'object_create', httpStatus: created.status, success: created.ok, objectId: id, ...(!created.ok ? { errorCode: result.error?.code, errorStatus: result.error?.status, reasons: result.error?.errors?.map(error => error.reason) } : {}) });
    if (!created.ok) throw Error('creation_failed');
    response = await request(endpoint, { headers });
  } else output({ stage: 'existing_test', httpStatus: response.status, objectId: id });
  if (process.argv.includes('--refresh-design') && response.ok) {
    const refreshed = await request(endpoint, { method: 'PATCH', headers, body: JSON.stringify(object) });
    output({ stage: 'test_design_refresh', success: refreshed.ok, httpStatus: refreshed.status });
    if (!refreshed.ok) throw Error('creation_failed');
    response = await request(endpoint, { headers });
  }
  const saved = await response.json();
  const verified = response.ok && saved.classId === classId && saved.header?.defaultValue?.value === 'جمعية يعمر' && ['QR_CODE', 'qrCode'].includes(saved.barcode?.type) && saved.barcode?.value === url && saved.linksModuleData?.uris?.some(link => link.uri === url);
  output({ stage: 'object_verify', httpStatus: response.status, success: verified, objectId: id, returnedClassId: saved.classId, returnedBarcodeType: saved.barcode?.type, name: saved.header?.defaultValue?.value, qrMatches: saved.barcode?.value === url, linkMatches: saved.linksModuleData?.uris?.some(link => link.uri === url) });
  if (!verified) process.exitCode = 1;
} catch (error) {
  const allowed = ['configuration_mismatch', 'authentication_failed', 'creation_failed'];
  output({ stage: 'failure', error: allowed.includes(error.message) ? error.message : error.name, networkCode: error.cause?.code });
  process.exitCode = 1;
}
