const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function service({ verified = true, existing = null, mailFails = false, standard = false } = {}) {
  const writes = [];
  let released = false;
  let stored = existing;
  const account = { id: 'association', email: 'owner@example.org', phone: '0512345678', email_verified_at: verified ? '2026-11-01' : null };
  const client = {
    async query(sql, values) {
      writes.push(sql);
      if (sql.includes('from users')) return { rows: [account] };
      if (sql.includes('select * from nonprofit_quote_requests')) return { rows: stored ? [stored] : [] };
      if (sql.includes('insert into nonprofit_quote_requests')) {
        stored = { id: 'request', request_number: 1, status: 'pending', page_json: JSON.parse(values[6]) };
        return { rows: [stored] };
      }
      return { rows: [] };
    },
    release() { released = true; },
  };
  const pool = {
    async connect() { return client; },
    async query(sql) {
      if (sql.includes('account_kind')) return { rows: standard ? [] : [{ id: account.id }] };
      if (sql.includes('email_attempts=email_attempts+1')) {
        if (mailFails) throw Error('mail unavailable');
        return { rows: [] };
      }
      return { rows: stored ? [stored] : [] };
    },
  };
  class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
  const mocks = {
    './db.js': { pool }, './http.js': { HttpError },
    './page.js': { getPageDataByUserId: async () => ({ name: 'جمعية اختبار', username: 'test-org', links: [] }) },
    './runtime.js': { getEnv: () => undefined }, './email.js': { sendNoticeEmail: async () => false },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/_lib/nonprofit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, module, module.exports);
  return { api: module.exports, writes, stored: () => stored, released: () => released };
}
const form = { organizationName: 'جمعية اختبار', contactName: 'المسؤول' };

test('unverified association cannot bypass the email step via request API', async () => {
  const s = service({ verified: false });
  await assert.rejects(() => s.api.submitNonprofit('association', form), { status: 403, code: 'email_verification_required' });
  assert.ok(s.writes.includes('rollback'));
  assert.equal(s.stored(), null);
  assert.ok(s.released());
});
test('verified request stores the saved design and never publishes or records payment', async () => {
  const s = service();
  const result = await s.api.submitNonprofit('association', form);
  assert.equal(result.request.id, 'request');
  assert.equal(s.stored().page_json.name, 'جمعية اختبار');
  assert.ok(s.writes.includes('commit'));
  assert.ok(!s.writes.some(sql => /update pages|insert into subscriptions|insert into payments/.test(sql)));
  await s.api.submitNonprofit('association', form);
  assert.equal(s.writes.filter(sql => sql.includes('insert into nonprofit_quote_requests')).length, 1);
});
test('saved request survives notification failure', async () => {
  const s = service({ mailFails: true });
  const result = await s.api.submitNonprofit('association', form);
  assert.equal(result.request.id, 'request');
  assert.ok(s.writes.includes('commit'));
});
test('standard customer cannot enter the nonprofit request flow', async () => {
  const s = service({ standard: true });
  await assert.rejects(() => s.api.submitNonprofit('standard', form), { status: 403, code: 'nonprofit_only' });
  assert.equal(s.writes.length, 0);
});
