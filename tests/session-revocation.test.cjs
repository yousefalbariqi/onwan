const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { transformSync } = require('esbuild');
function load(file, mocks) {
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
function response() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, setHeader() { return this; }, send(body) { this.body = JSON.parse(body); } }; }
function setup() {
  let version = 0;
  const auth = load('api/_lib/auth.ts', { './runtime.js': { getEnv: () => 'test-only-secret' } });
  const pool = { async query(sql) {
    if (sql.includes('update users')) {
      assert.match(sql, /session_version = session_version \+ 1/);
      assert.match(sql, /password_hash = \$2/);
      return { rows: [{ session_version: ++version }] };
    }
    return { rows: [{ id: 'customer', email: 'test@example.invalid', status: 'active', session_version: version }] };
  } };
  const http = load('api/_lib/http.ts', {});
  const sessions = load('api/_lib/session.ts', { './runtime.js': { getEnv: () => undefined }, './auth.js': auth, './db.js': { pool }, './http.js': http });
  const reset = load('api/auth/reset-password.ts', {
    '../_lib/turnstile.js': { assertHuman: async () => {} },
    '../_lib/account.js': { normalizeEmail: value => value, getAccountSummary: async () => ({}) },
    '../_lib/auth.js': auth, '../_lib/db.js': { pool }, '../_lib/http.js': http,
    '../_lib/otp.js': { consumeCode: async () => true },
    '../_lib/page.js': { ensurePageForUser: async () => {}, getPageDataByUserId: async () => ({}) },
    '../_lib/password.js': { validatePassword: () => null, hashPassword: () => 'test-hash' },
    '../_lib/session.js': sessions,
  }).default;
  const check = async token => { const res = response(); const user = await sessions.requireUser({ headers: { authorization: `Bearer ${token}` } }, res); return { user, res }; };
  return { auth, reset, check };
}
test('reset revokes every previous customer session and preserves the new one across repeated resets', async () => {
  const { auth, reset, check } = setup();
  const legacyPayload = Buffer.from(JSON.stringify({ userId: 'customer', email: 'test@example.invalid', exp: Date.now() + 100000 })).toString('base64url');
  const legacy = legacyPayload + '.' + crypto.createHmac('sha256', 'test-only-secret').update(legacyPayload).digest('base64url');
  const devices = [legacy, auth.createSessionToken('customer', 'test@example.invalid')];
  assert.ok((await check(devices[0])).user);
  const resetOnce = async () => {
    const res = response();
    await reset({ method: 'POST', body: { action: 'confirm', email: 'test@example.invalid', code: '7392', password: 'Strong-Pass2026' } }, res);
    assert.equal(res.statusCode, 200);
    return res.body.token;
  };
  const fresh = await resetOnce();
  assert.equal(auth.verifySessionToken(fresh).sessionVersion, 1);
  for (const old of devices) { const result = await check(old); assert.equal(result.user, null); assert.equal(result.res.statusCode, 401); }
  assert.ok((await check(fresh)).user);
  const newer = await resetOnce();
  assert.equal((await check(fresh)).res.statusCode, 401);
  assert.ok((await check(newer)).user);
  // A subsequent normal sign-in uses the database version as well.
  assert.ok((await check(auth.createSessionToken('customer', 'test@example.invalid', undefined, 2))).user);
});
test('customer validation still rejects staff and partner tokens', async () => {
  const { auth, check } = setup();
  for (const kind of ['staff', 'partner']) assert.equal((await check(auth.createSessionToken('customer', 'test@example.invalid', kind))).res.statusCode, 401);
});
