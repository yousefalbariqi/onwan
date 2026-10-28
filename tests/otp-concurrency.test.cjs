const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('esbuild');
function service({ attempts = 0, expired = false } = {}) {
  let used = false;
  const pool = { async query(sql) {
    if (sql.startsWith('select id')) return { rows: [{ id: 'code-id', code: '7392', attempts }] };
    if (sql.includes('attempts = attempts + 1')) { if (!used && attempts < 5) attempts++; return { rows: [] }; }
    if (sql.includes('returning id')) {
      if (used || expired || attempts >= 5) return { rows: [] };
      used = true; return { rows: [{ id: 'code-id' }] };
    }
    throw new Error(sql);
  } };
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync('api/_lib/otp.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === './db.js') return { pool };
    if (name === './email.js') return {};
    if (name === './http.js') return { HttpError: Error };
    return require(name);
  }, module, module.exports);
  return module.exports;
}
test('concurrent correct OTP requests succeed exactly once', async () => {
  const otp = service();
  const results = await Promise.all(Array.from({ length: 20 }, () => otp.consumeCode('test@example.invalid', 'reset_password', '7392')));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await otp.consumeCode('test@example.invalid', 'reset_password', '7392'), false);
});
test('wrong guesses, exhausted attempts and expiry cannot claim the code', async () => {
  const otp = service();
  for (let i = 0; i < 5; i++) assert.equal(await otp.consumeCode('test@example.invalid', 'reset_password', '0000'), false);
  assert.equal(await otp.consumeCode('test@example.invalid', 'reset_password', '7392'), false);
  assert.equal(await service({ expired: true }).consumeCode('test@example.invalid', 'reset_password', '7392'), false);
});
