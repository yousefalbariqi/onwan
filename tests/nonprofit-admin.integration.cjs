// Dedicated disposable LOCAL database only. Never use production DATABASE_URL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { Pool } = require('pg');
const url = process.env.NONPROFIT_ADMIN_TEST_DATABASE_URL;
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw Error(name); }, module, module.exports);
  return module.exports;
}
test('association administration: real SQL migration, payments, conflicts, activation and suspension', { skip: !url }, async t => {
  const parsed = new URL(url);
  assert.ok(parsed.pathname.startsWith('/onwan_test_'), 'must be a dedicated test database');
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname), 'must be local');
  const pool = new Pool({ connectionString: url, max: 6 });
  const staff = { id: '10000000-0000-4000-8000-000000000001', name: 'موظف الاختبار', role: 'staff' };
  const user = '20000000-0000-4000-8000-000000000001';
  const other = '20000000-0000-4000-8000-000000000002';
  const standard = '20000000-0000-4000-8000-000000000003';
  let purges = [];
  const receivedAt = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
  const http = { HttpError };
  const names = load('api/_lib/username.ts', { './db.js': { pool }, './http.js': http });
  const service = load('api/_lib/nonprofitAdmin.ts', {
    './db.js': { pool }, './http.js': http, './admin.js': { audit: async () => {} },
    './nonprofit.js': { notifyNonprofit: async () => {} },
    './page.js': { getPageDataByUserId: async () => ({ name: 'آخر تصميم', links: [] }) },
    './username.js': names, './publicCache.js': { purgePublicPage: async name => purges.push(name) },
    './wallet/pass.js': { walletConfigured: () => false },
  });
  try {
    await pool.query(`create table users(id uuid primary key,email text,phone text,status text default 'active',email_verified_at timestamptz);
      create table staff(id uuid primary key,name text);
      create table pages(id uuid primary key default gen_random_uuid(),user_id uuid unique references users(id),status text default 'draft',suggested_username text,suspension_message text,suspension_reason text,suspended_at timestamptz);
      create table subscriptions(user_id uuid primary key,status text);
      create table payments(id uuid primary key default gen_random_uuid(),user_id uuid references users(id),kind text,amount numeric(10,2),reference text,label text,recorded_by text,created_at timestamptz default now());
      create table audit_log(staff_id uuid,staff_name text,action text,target_type text,target_id uuid,target_label text,details jsonb,created_at timestamptz default now());
      create table usernames(user_id uuid primary key references users(id),username text unique);
      create table username_reservations(user_id uuid unique references users(id),username text primary key,expires_at timestamptz);
      create table reserved_usernames(username text primary key);
      create table username_redirects(old_username text,expires_at timestamptz);
      create table partner_orders(id uuid primary key default gen_random_uuid(),username text,status text,sent_at timestamptz,created_at timestamptz default now());
      create function media_check_references(data jsonb) returns void language plpgsql as $$ begin return; end $$;`);
    await pool.query(fs.readFileSync('database/phase25-nonprofit-requests.sql', 'utf8'));
    await pool.query('insert into staff values($1,$2)', [staff.id, staff.name]);
    await pool.query("insert into users(id,email,phone,account_kind,email_verified_at) values($1,'a@example.invalid','0500000000','nonprofit',now()),($2,'b@example.invalid','0500000001','nonprofit',now()),($3,'ordinary@example.invalid','0500000002','standard',now())", [user, other, standard]);
    await pool.query("insert into pages(user_id,suggested_username) values($1,'association'),($2,'second-association'),($3,'taken')", [user, other, standard]);
    const request = (await pool.query("insert into nonprofit_quote_requests(user_id,organization_name,contact_name,phone,email,page_json,status) values($1,'جمعية اختبار','مسؤول','0500000000','a@example.invalid','{\"name\":\"النسخة الأصلية\"}','agreed') returning id", [user])).rows[0];
    await pool.query(fs.readFileSync('database/phase29-nonprofit-admin.sql', 'utf8'));
    await pool.query(fs.readFileSync('database/phase29-nonprofit-admin.sql', 'utf8'));
    const row = async () => (await pool.query('select * from nonprofit_quote_requests where id=$1', [request.id])).rows[0];
    const run = async (action, fields = {}, version) => service.nonprofitMutation({ id: request.id, version: version ?? (await row()).version, ...fields }, staff, action);
    const quote = { amount: 430, months: 36, includes: 'الصفحة والاستضافة والباركود', notes: 'عرض خاص' };
    await t.test('migration preserves legacy agreed status without inventing payment', async () => {
      assert.equal((await row()).status, 'agreed');
      assert.equal((await row()).payment_id, null);
      assert.equal((await pool.query('select status from pages where user_id=$1', [user])).rows[0].status, 'draft');
      await assert.rejects(() => run('activate', { username: 'association' }), { status: 409 });
    });
    await t.test('cannot forge stages, invalid quotes, or confirm before sending', async () => {
      await assert.rejects(() => run('update', { status: 'paid' }), { status: 409 });
      await assert.rejects(() => run('quote', { quote: { ...quote, months: 0 } }), { status: 400 });
      await assert.rejects(() => run('quote', { quote: { ...quote, amount: '1.001' } }), { status: 400 });
      await assert.rejects(() => run('payment', { amount: 430, reference: 'bank' }), { status: 409 });
      await run('quote', { quote });
      await run('sent');
      await run('quote', { quote: { ...quote, amount: 500 } });
      assert.equal((await row()).sent_quote_json.amount, 430, 'editing draft does not change sent quote');
    });
    await t.test('real concurrent confirmations record exactly one payment', async () => {
      await assert.rejects(() => run('payment', { amount: 430, reference: 'bank', receivedAt: '2026-02-31' }), { status: 400 });
      await assert.rejects(() => run('payment', { amount: 500, reference: 'bank', receivedAt }), { status: 400 });
      const version = (await row()).version;
      const results = await Promise.allSettled([run('payment', { amount: 430, reference: 'BANK-001', receivedAt }, version), run('payment', { amount: 430, reference: 'BANK-001', receivedAt }, version)]);
      assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
      assert.equal((await pool.query('select * from payments')).rowCount, 1);
      assert.equal((await row()).status, 'paid');
      assert.equal((await row()).sent_quote_json.amount, 430);
    });
    await t.test('blocked name and suspension cannot publish or lose recorded payment', async () => {
      await pool.query('insert into usernames values($1,$2)', [standard, 'taken']);
      await assert.rejects(() => run('activate', { username: 'taken' }), { status: 409 });
      await pool.query("insert into username_reservations values($1,'held-name',null)", [other]);
      await assert.rejects(() => run('activate', { username: 'held-name' }), { status: 409 });
      await pool.query("update pages set status='suspended' where user_id=$1", [user]);
      await assert.rejects(() => run('activate', { username: 'association' }), { status: 409 });
      await pool.query("update pages set status='draft' where user_id=$1", [user]);
      assert.equal((await row()).status, 'paid');
      assert.equal((await pool.query('select * from nonprofit_hosting')).rowCount, 0);
      assert.equal((await pool.query('select * from payments')).rowCount, 1);
    });
    await t.test('activation is atomic with audit, then publishes for the agreed duration', async () => {
      await pool.query("alter table audit_log add constraint reject_activation check(action <> 'nonprofits.activate')");
      await assert.rejects(() => run('activate', { username: 'association' }));
      assert.equal((await pool.query('select * from nonprofit_hosting')).rowCount, 0);
      assert.equal((await pool.query('select * from usernames where user_id=$1', [user])).rowCount, 0);
      assert.equal((await pool.query('select nonprofit_activated_at from users where id=$1', [user])).rows[0].nonprofit_activated_at, null);
      await pool.query('alter table audit_log drop constraint reject_activation');
      await run('activate', { username: 'association' });
      assert.equal((await row()).status, 'active');
      assert.equal((await pool.query('select status from pages where user_id=$1', [user])).rows[0].status, 'published');
      const hosting = (await pool.query('select * from nonprofit_hosting')).rows[0];
      assert.equal(hosting.months, 36);
      assert.ok(new Date(hosting.expires_at) - new Date(hosting.starts_at) > 1094 * 86400000);
      assert.equal((await pool.query('select * from subscriptions')).rowCount, 0, 'no fabricated retail plan');
      assert.ok(purges.includes('association'));
      await assert.rejects(() => run('activate', { username: 'association' }), { status: 409 });
    });
    await t.test('suspend/reactivate preserve content, hosting, payment and audit', async () => {
      await run('suspend', { reason: 'طلب الجمعية', message: 'متوقفة مؤقتًا' });
      assert.equal((await pool.query('select status from pages where user_id=$1', [user])).rows[0].status, 'suspended');
      await run('reactivate');
      assert.equal((await pool.query('select status from pages where user_id=$1', [user])).rows[0].status, 'published');
      assert.equal((await pool.query('select * from payments')).rowCount, 1);
      assert.equal((await row()).page_json.name, 'النسخة الأصلية');
      assert.ok((await pool.query("select * from nonprofit_request_events where action='reactivate'")).rowCount);
      await pool.query("insert into audit_log(staff_name,action,target_id,details) values('موظف','content.save',$1,'{}')", [user]);
      const result = await service.nonprofitAdminHandlers['nonprofits.get'].run({ id: request.id });
      assert.equal(result.payment.reference, 'BANK-001');
      assert.equal(result.pageData.name, 'آخر تصميم');
      assert.equal(result.request.page_json.name, 'النسخة الأصلية');
      assert.ok(result.events.some(entry => entry.action === 'content'));
      const listing = await service.nonprofitAdminHandlers['nonprofits.list'].run({ q: 'جمعية', status: 'active', page: 1 });
      assert.equal(listing.total, 1);
    });
    await t.test('standard accounts and stale versions cannot enter the workflow', async () => {
      const fake = (await pool.query("insert into nonprofit_quote_requests(user_id,organization_name,contact_name,phone,email,page_json) values($1,'عادي','مسؤول','0500000002','ordinary@example.invalid','{}') returning id", [standard])).rows[0];
      await assert.rejects(() => service.nonprofitMutation({ id: fake.id, version: 1 }, staff, 'assign'), { status: 404 });
      await assert.rejects(() => run('assign', {}, 1), { status: 409 });
      assert.equal((await pool.query('select status from pages where user_id=$1', [standard])).rows[0].status, 'draft');
    });
    await t.test('search and pagination return real totals beyond the first page', async () => {
      await pool.query(`with made as (
        insert into users(id,email,phone,account_kind) select gen_random_uuid(),'bulk-'||n||'@example.invalid','050000'||n,'nonprofit' from generate_series(1,27) n returning id,email,phone
      ), added_pages as (insert into pages(user_id) select id from made returning user_id)
      insert into nonprofit_quote_requests(user_id,organization_name,contact_name,phone,email,page_json)
      select m.id,'جمعية دفعة','مسؤول',m.phone,m.email,'{}' from made m join added_pages p on p.user_id=m.id`);
      const listing = await service.nonprofitAdminHandlers['nonprofits.list'].run({ q: 'دفعة', page: 2 });
      assert.equal(listing.total, 27);
      assert.equal(listing.requests.length, 2);
      assert.ok(listing.requests.every(row => row.organization_name === 'جمعية دفعة'));
    });
  } finally { await pool.end(); }
});
