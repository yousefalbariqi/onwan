const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup() {
  let row, fail = false, allowed = true;
  const messages = [];
  const pool = { async query(sql, values = []) {
    if (sql.includes('account_kind')) return { rows: allowed ? [{}] : [] };
    if (sql.startsWith('insert into nonprofit_creation_starts')) {
      row ??= { user_id: values[0], organization_name: values[1], email: 'registered@example.org', phone: null, contact_name: null, created_at: '2026-11-12T10:00:00Z', email_status: 'pending', email_attempts: 0 };
    } else if (sql.includes("set email_status='sending'")) {
      if (!row || !['pending', 'failed'].includes(row.email_status) || row.email_attempts >= 5) return { rows: [] };
      row.email_status = 'sending'; row.email_attempts++;
      return { rows: [{ ...row }] };
    } else if (sql.includes('set email_status=$2')) row.email_status = values[1];
    else if (sql.startsWith('select user_id')) return { rows: row && row.email_status !== 'sent' ? [row] : [] };
    return { rows: [] };
  } };
  const mocks = { './db.js': { pool }, './http.js': { HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } } }, './page.js': {}, './runtime.js': { getEnv: () => 'admin@example.org' }, './email.js': { sendNoticeEmail: async (...args) => { messages.push(args); return !fail; } } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/_lib/nonprofit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
  return { api: module.exports, messages, row: () => row, fail: value => fail = value, allow: value => allowed = value };
}
test('first start records account details once; repeated and concurrent calls send one notice', async () => {
  const s = setup();
  await Promise.all([1, 2, 3].map(() => s.api.startNonprofitCreation('owner', { organizationName: 'جمعية الأثر', email: 'spoof@example.org' })));
  assert.equal(s.messages.length, 1);
  assert.equal(s.row().email_status, 'sent');
  assert.match(s.messages[0][2].join('\n'), /registered@example.org/);
  assert.match(s.messages[0][2].join('\n'), /غير متوفر/);
  assert.match(s.messages[0][2].join('\n'), /الرياض/);
  assert.equal(s.messages[0][3], 'nonprofit-creation-owner');
  await s.api.startNonprofitCreation('owner', { organizationName: 'changed' });
  assert.equal(s.row().organization_name, 'جمعية الأثر');
  assert.equal(s.messages.length, 1);
});
test('failed mail leaves a durable event that cron retries with the same delivery key', async () => {
  const s = setup(); s.fail(true);
  assert.deepEqual(await s.api.startNonprofitCreation('owner', { organizationName: 'جمعية' }), { started: true });
  assert.equal(s.row().email_status, 'failed');
  s.fail(false); await s.api.retryCreationStartNotifications();
  assert.equal(s.row().email_status, 'sent');
  assert.equal(s.messages[0][3], s.messages[1][3]);
});
test('standard accounts and empty organization names cannot record a start', async () => {
  const s = setup(); s.allow(false);
  await assert.rejects(() => s.api.startNonprofitCreation('owner', { organizationName: 'جمعية' }), { status: 403 });
  s.allow(true);
  await assert.rejects(() => s.api.startNonprofitCreation('owner', { organizationName: ' ' }), { status: 400 });
  assert.equal(s.row(), undefined);
});
