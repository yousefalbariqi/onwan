// Read-only connectivity test. Never prints credentials, JWTs or access tokens.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createPrivateKey, sign } from 'node:crypto';

const local = fs.existsSync('.env.local') ? parseEnv(fs.readFileSync('.env.local', 'utf8')) : {};
const env = { ...local, ...process.env };
const issuerId = env.GOOGLE_WALLET_ISSUER_ID || '3388000000023219826';
const classId = env.GOOGLE_WALLET_CLASS_ID || '3388000000023219826.3388000000023219826.onwan_digital_card';
const endpoint = 'https://oauth2.googleapis.com/token';
const output = data => console.log(JSON.stringify(data));
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
function apiError(body) {
  const error = body?.error;
  return {
    code: typeof error === 'string' && /^[a-z_]+$/i.test(error) ? error : error?.code,
    status: error?.status,
    reasons: Array.isArray(error?.errors) ? error.errors.map(item => item.reason).filter(value => typeof value === 'string' && /^[a-z_]+$/i.test(value)) : undefined,
  };
}
try {
  const raw = env.GOOGLE_WALLET_CREDENTIALS || (env.GOOGLE_WALLET_CREDENTIALS_FILE && fs.readFileSync(path.resolve(env.GOOGLE_WALLET_CREDENTIALS_FILE), 'utf8'));
  if (!raw) throw new Error('credentials_missing');
  const credentials = JSON.parse(raw);
  const key = createPrivateKey(credentials.private_key);
  if (credentials.type !== 'service_account' || key.asymmetricKeyType !== 'rsa' || credentials.token_uri !== endpoint) throw new Error('credentials_invalid');
  output({ stage: 'configuration', source: env.GOOGLE_WALLET_CREDENTIALS ? 'json_variable' : 'credentials_file', keyValid: true, projectMatches: credentials.project_id === 'healthy-firefly-514111-j1', accountMatches: credentials.client_email === 'onwan-wallet@healthy-firefly-514111-j1.iam.gserviceaccount.com', issuerMatches: issuerId === '3388000000023219826' });
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: endpoint, iat: now, exp: now + 3600 })}`;
  const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const authentication = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const token = await authentication.json();
  output({ stage: 'authentication', httpStatus: authentication.status, success: authentication.ok && !!token.access_token, ...(!authentication.ok ? { error: apiError(token) } : {}) });
  if (!authentication.ok || !token.access_token) process.exitCode = 1;
  else {
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const response = await request(`https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${encodeURIComponent(classId)}`, { headers });
    const body = await response.json();
    output({ stage: 'class_read', httpStatus: response.status, success: response.ok, classId: response.ok ? body.id : classId, ...(!response.ok ? { error: apiError(body) } : {}) });
    if (!response.ok) process.exitCode = 1;
    if (response.status === 404) {
      const list = await request(`https://walletobjects.googleapis.com/walletobjects/v1/genericClass?issuerId=${encodeURIComponent(issuerId)}`, { headers });
      const classes = await list.json();
      output({ stage: 'class_lookup', httpStatus: list.status, matchingClassIds: (classes.resources || []).map(item => item.id).filter(id => typeof id === 'string' && id.endsWith('onwan_digital_card')), morePages: !!classes.pagination?.nextPageToken });
    }
  }
} catch (error) {
  // Error messages from file parsing or crypto may contain credential data.
  const safe = ['credentials_missing', 'credentials_invalid'].includes(error.message) ? error.message : error.name;
  output({ stage: 'failure', error: safe, networkCode: error.cause?.code || (typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : undefined) });
  process.exitCode = 1;
}
