const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = process.cwd();
const pools = [];
let query = async () => ({ rows: [], rowCount: 0 });
class FakePool {
  constructor(options) { this.options = options; this.closed = false; pools.push(this); }
  query(sql, values) { return query(sql, values, this); }
  async connect() { return { query: this.query.bind(this), release() {} }; }
  async end() { this.closed = true; }
}
// Execute the real handler graph and Node crypto; substitute only external I/O.
const cache = new Map();
function load(filename) {
  filename = path.resolve(root, filename).replace(/\.js$/, '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const realRequire = createRequire(filename);
  new Function('require', 'module', 'exports', code)(name => {
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
    if (name === 'pg') return { Pool: FakePool };
    if (name === 'resend') return { Resend: class { emails = { send: async () => ({ error: null }) }; } };
    return realRequire(name);
  }, module, module.exports);
  return module.exports;
}
const workerModule = load('worker/index.ts');
const worker = workerModule.default;
const { withRuntime, getEnv } = load('api/_lib/runtime.ts');
const { createSessionToken, verifySessionToken } = load('api/_lib/auth.ts');
const { hashPassword, verifyPassword } = load('api/_lib/password.ts');
const env = { DATABASE_URL: 'postgres://test:test@database.invalid/postgres', SESSION_SECRET: 'test-only-session-secret', ROOT_DOMAIN: 'onwan.link',
  ASSETS: { fetch: async req => new Response(`<html><head><title>عنوان</title></head><body>${new URL(req.url).pathname}</body></html>`, { headers: { 'Content-Type': 'text/html' } }) } };
const token = kind => withRuntime({ env }, () => createSessionToken('test-id', 'test@example.org', kind));
function call(route, { method = 'GET', body, bearer, host = 'onwan.link' } = {}, settings = env) {
  return worker.fetch(new Request(`https://${host}${route}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), settings);
}
beforeEach(() => { pools.length = 0; query = async () => ({ rows: [], rowCount: 0 }); });

test('every API file has an explicit route, every route retains method guards', async () => {
  const files = fs.readdirSync('api', { recursive: true }).filter(f => f.endsWith('.ts') && !f.startsWith('_lib/'));
  assert.deepEqual(Object.keys(workerModule.routes).sort(), files.map(f => `/api/${f.slice(0, -3)}`).sort());
  for (const route of Object.keys(workerModule.routes)) {
    const response = await call(route, { method: 'DELETE' });
    assert.equal(response.status, 405, route);
    assert.ok(response.headers.get('Allow'));
  }
});
test('API misses and helper files never become SPA HTML, including navigation', async () => {
  for (const route of ['/api', '/api/no-such-route', '/api/_lib/db']) {
    const response = await worker.fetch(new Request(`https://onwan.link${route}`, { headers: { 'Sec-Fetch-Mode': 'navigate' } }), env);
    assert.equal(response.status, 404); assert.match(response.headers.get('Content-Type'), /json/);
  }
  assert.match(await (await call('/builder')).text(), /\/builder/);
  assert.match(await (await call('/')).text(), /<title>عنوان/);
});
test('query and JSON request bodies reach real handlers', async () => {
  const available = await call('/api/username/check?username=df');
  assert.equal(available.status, 200); assert.equal((await available.json()).status, 'available');
  assert.ok(pools[0].closed);
  assert.equal((await call('/api/auth/signup', { method: 'POST', body: { username: 'df', phone: 'invalid' } })).status, 400);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { identifier: 'test@example.org', password: 'wrong' } })).status, 401);
});
test('protected beneficiary endpoints reject missing tokens and other token kinds', async () => {
  for (const route of ['/api/page/me', '/api/account', '/api/auth/email-code', '/api/video-upload']) {
    const method = ['/api/account', '/api/auth/email-code', '/api/video-upload'].includes(route) ? 'POST' : 'GET';
    for (const kind of [undefined, 'staff', 'partner']) {
      const bearer = kind ? token(kind) : undefined;
      assert.equal((await call(route, { method, bearer, body: method === 'POST' ? { action: 'send' } : undefined })).status, route === '/api/video-upload' && kind === 'partner' ? 403 : 401, route);
    }
  }
});
test('banned beneficiary remains forbidden and active staff cannot perform manager actions', async () => {
  query = async sql => ({ rows: sql.includes('from users') ? [{ id: 'test-id', status: 'banned' }] : [{ id: 'test-id', role: 'staff', is_active: true, permissions: [] }], rowCount: 1 });
  const banned = await call('/api/page/me', { bearer: token() });
  assert.equal(banned.status, 403); assert.equal((await banned.json()).code, 'banned');
  assert.equal((await call('/api/admin', { method: 'POST', bearer: token('staff'), body: { action: 'plans.set' } })).status, 403);
  assert.equal((await call('/api/admin', { method: 'POST', bearer: token('staff'), body: { action: 'subdomain.change' } })).status, 403);
});
test('admin and partner token domains remain separate', async () => {
  for (const [route, bearer] of [['/api/admin', token()], ['/api/admin', token('partner')], ['/api/partner', token()], ['/api/partner', token('staff')]]) {
    assert.equal((await call(route, { method: 'POST', bearer, body: { action: 'me' } })).status, 401);
  }
});
test('wildcard root gets SEO shell through ASSETS, unknown name gets noindex and 404', async () => {
  const response = await call('/?username=someone-else', { host: 'df.onwan.link' });
  assert.equal(response.status, 404); assert.match(await response.text(), /noindex/);
  assert.equal((await call('/', { host: 'www.onwan.link' })).status, 200);
});
test('binary, redirects, errors and response headers survive the adapter', async () => {
  let response = await workerModule.invokeHandler(new Request('https://onwan.link/api/test'), async (req, res) => { res.status(200).setHeader('Content-Type', 'image/png'); res.send(Buffer.from([0, 255, 10])); });
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 255, 10]);
  response = await workerModule.invokeHandler(new Request('https://onwan.link/api/test'), async (req, res) => { res.status(302).setHeader('Location', 'https://example.org'); res.send(''); });
  assert.equal(response.status, 302); assert.equal(response.headers.get('Location'), 'https://example.org');
});
test('concurrent requests isolate secrets and connection pools; failures close the pool', async () => {
  query = async (sql, values, pool) => { await new Promise(resolve => setTimeout(resolve, 1)); assert.ok(!pool.closed); return { rows: [], rowCount: 0 }; };
  await Promise.all([call('/api/username/check?username=a'), call('/api/username/check?username=b', {}, { ...env, DATABASE_URL: 'postgres://test:test@other.invalid/postgres' })]);
  assert.equal(pools.length, 2); assert.ok(pools.every(p => p.closed)); assert.notEqual(pools[0].options.connectionString, pools[1].options.connectionString);
  await Promise.all(['a', 'b'].map(secret => withRuntime({ env: { SESSION_SECRET: secret } }, async () => { await new Promise(resolve => setTimeout(resolve, 1)); assert.equal(getEnv('SESSION_SECRET'), secret); })));
  assert.equal(withRuntime({ env: {} }, () => getEnv('PATH')), undefined);
  query = async () => { throw new Error('simulated DB failure'); };
  const previous = console.error; console.error = () => {};
  try { assert.equal((await call('/api/username/check?username=c')).status, 500); assert.ok(pools.at(-1).closed); } finally { console.error = previous; }
});
test('existing scrypt hashes and HMAC sessions remain compatible', () => {
  const hash = hashPassword('test-password'); assert.equal(verifyPassword('test-password', hash), true); assert.equal(verifyPassword('wrong', hash), false);
  withRuntime({ env }, () => { const signed = token('staff'); assert.equal(verifySessionToken(signed).kind, 'staff'); assert.equal(verifySessionToken(`${signed}x`), null); });
});


test('signup commits a held name and draft, login preserves response and public API keeps moved/suspended states', async () => {
  const statements = [];
  const password = hashPassword('test-password');
  query = async (sql, values) => {
    statements.push(sql.trim());
    let rows = [];
    if (sql.startsWith('insert into users')) rows = [{ id: 'test-id' }];
    else if (sql.includes('password_hash')) rows = [{ id: 'test-id', email: 'test@example.org', password_hash: password, status: 'active' }];
    else if (sql.includes('from pages p')) rows = [{ id: 'page-id', username: 'df', status: 'draft' }];
    else if (sql.includes('from users u')) rows = [{ email: 'test@example.org', phone: '966500000000', name_fixed: false, page_status: 'draft' }];
    return { rows, rowCount: rows.length };
  };
  const response = await call('/api/auth/signup', { method: 'POST', body: { username: 'df', phone: '966500000000', email: 'test@example.org', password: 'test-password' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.pageData.username, 'df'); assert.equal(body.account.nameFixed, false); assert.equal(body.account.pageStatus, 'draft');
  assert.ok(statements.includes('begin')); assert.ok(statements.includes('commit'));
  assert.ok(statements.some(sql => sql.startsWith('insert into username_reservations')));
  assert.ok(!statements.some(sql => /insert into usernames\s/.test(sql)));
  assert.ok(pools.every(pool => pool.closed));
  const loggedIn = await call('/api/auth/login', { method: 'POST', body: { identifier: 'test@example.org', password: 'test-password' } });
  assert.equal(loggedIn.status, 200); assert.ok((await loggedIn.json()).token);
  query = async sql => ({ rows: sql.includes('from usernames u') ? [{ id: 'page-id', username: 'df', status: 'suspended', suspension_message: 'paused' }] : [], rowCount: 1 });
  const suspended = await call('/api/public-page?username=df');
  assert.deepEqual(await suspended.json(), { suspended: true, message: 'paused' });
  query = async sql => ({ rows: sql.includes('from username_redirects') ? [{ username: 'new-name' }] : [], rowCount: 0 });
  assert.deepEqual(await (await call('/api/public-page?username=old-name')).json(), { movedTo: 'new-name' });
});

test('published wildcard SEO escapes content and binary logo retains bytes', async () => {
  query = async sql => ({ rows: sql.includes('from usernames u') ? [{ id: 'page-id', username: 'df', status: 'published', display_name: '<Entity>', bio: 'A & B', profile_image_url: 'data:image/png;base64,AP8K' }] : [], rowCount: 1 });
  const response = await call('/', { host: 'df.onwan.link' });
  assert.equal(response.status, 200);
  const html = await response.text(); assert.match(html, /&lt;Entity&gt;/); assert.match(html, /https:\/\/df.onwan.link/); assert.match(html, /og:image/);
  const logo = await call('/api/public-page?username=df&image=logo');
  assert.equal(logo.headers.get('Content-Type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await logo.arrayBuffer())], [0, 255, 10]);
});


test('Hyperdrive takes priority over legacy URL and does not force origin TLS', async () => {
  const url = 'postgres://test:test@hyperdrive.invalid/postgres';
  const response = await call('/api/username/check?username=df', {}, { ...env, DATABASE_URL: 'postgres://test:test@HOST/postgres', HYPERDRIVE: { connectionString: url } });
  assert.equal(response.status, 200);
  assert.equal(pools[0].options.connectionString, url);
  assert.equal(Object.hasOwn(pools[0].options, 'ssl'), false);
  assert.equal(pools[0].closed, true);
});

// Note 42: a session only ever reaches its own account's data, whatever the request says.
test('page and account endpoints read and write only the session user, never an id from the request', async () => {
  const tokenFor = id => withRuntime({ env }, () => createSessionToken(id, `${id}@example.org`));
  const seen = [];
  query = async (sql, values = []) => {
    seen.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    if (/from users/i.test(sql)) return { rows: [{ id: values[0], email: `${values[0]}@example.org`, phone: '0500000000', status: 'active', email_verified_at: null }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  for (const [route, options] of [
    ['/api/page/me', {}],
    ['/api/page/me', { method: 'PATCH', body: { userId: 'user-a', pageData: { name: 'x', links: [] } } }],
    ['/api/account', { method: 'POST', body: { action: 'overview', userId: 'user-a' } }],
  ]) {
    seen.length = 0;
    await call(route, { ...options, bearer: tokenFor('user-b') });
    const ids = seen.flatMap(entry => entry.values).filter(value => typeof value === 'string' && /^user-/.test(value));
    assert.ok(ids.length > 0, `${route} queried by user id`);
    assert.deepEqual([...new Set(ids)], ['user-b'], route);
  }
  // A forged token (signed with another secret) is refused before any data is read.
  const forged = withRuntime({ env: { ...env, SESSION_SECRET: 'not-the-real-secret' } }, () => createSessionToken('user-a', 'a@example.org'));
  seen.length = 0;
  assert.equal((await call('/api/page/me', { bearer: forged })).status, 401);
  assert.equal(seen.filter(entry => /pages|page_links/.test(entry.sql)).length, 0);
});

test('demo activation requires the server switch', async () => {
  const { completeDemoPayment } = load('api/_lib/demoPayment.ts');
  await assert.rejects(withRuntime({ env }, () => completeDemoPayment({ cart: 'TEST', plan: 'annual' }, { id: 'test-id' })), error => error.status === 403);
  assert.equal(pools.length, 0);
});

test('demo checkout activates the owned cart once and records zero collection', async () => {
  const { completeDemoPayment } = load('api/_lib/demoPayment.ts');
  const statements = [];
  const cart = { id: 'cart-id', cart_number: 5001, user_id: 'test-id', plan: 'annual', plan_price: 290, design_price: null, nfc_quantity: 0, status: 'pending_payment' };
  query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes('cart_number::text')) {
      assert.deepEqual(values, ['5001', 'test-id']);
      return { rows: [{ ...cart }], rowCount: 1 };
    }
    if (sql === 'select 1 from usernames where user_id = $1') return { rows: [{}], rowCount: 1 };
    if (sql.includes("update registration_carts set status = 'paid'")) cart.status = 'paid';
    return { rows: [], rowCount: 0 };
  };
  const settings = { ...env, DEMO_PAYMENT_ENABLED: 'true' };
  await withRuntime({ env: settings }, () => completeDemoPayment({ cart: '5001' }, { id: 'test-id' }));
  await withRuntime({ env: settings }, () => completeDemoPayment({ cart: '5001' }, { id: 'test-id' }));
  assert.equal(statements.filter(x => x.sql.includes('insert into subscriptions')).length, 1);
  assert.equal(statements.filter(x => x.sql.includes("update pages set status = 'published'")).length, 1);
  const payments = statements.filter(x => x.sql.includes('insert into payments'));
  assert.equal(payments.length, 1);
  assert.equal(payments[0].values[2], 0);
  assert.match(payments[0].values[3], /^DEMO:/);
});

test('demo checkout rolls back when a cart is missing or belongs to another user', async () => {
  const { completeDemoPayment } = load('api/_lib/demoPayment.ts');
  const statements = [];
  query = async (sql, values) => { statements.push({ sql, values }); return { rows: [], rowCount: 0 }; };
  await assert.rejects(withRuntime({ env: { ...env, DEMO_PAYMENT_ENABLED: 'true' } }, () => completeDemoPayment({ cart: '999' }, { id: 'test-id' })), error => error.status === 409);
  assert.ok(statements.some(x => x.sql === 'rollback'));
  assert.ok(!statements.some(x => x.sql.includes('insert into subscriptions')));
});

test('zero-price TEST checkout stores selected plan and renewal cannot be applied twice', async () => {
  const { completeDemoPayment } = load('api/_lib/demoPayment.ts');
  const statements = [];
  const invoice = { id: 'renewal-id', plan: 'monthly', status: 'pending_payment' };
  query = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes('insert into registration_carts')) return { rows: [{ id: 'zero-cart', cart_number: 5002, user_id: 'test-id', plan: values[1], plan_price: 0, design_price: null, nfc_quantity: 0, status: 'pending_payment' }], rowCount: 1 };
    if (sql === 'select 1 from usernames where user_id = $1') return { rows: [{}], rowCount: 1 };
    if (sql.includes('invoice_number::text')) { assert.deepEqual(values, ['7001', 'test-id']); return { rows: [{ ...invoice }], rowCount: 1 }; }
    if (sql.includes('update subscription_renewals')) invoice.status = 'paid';
    return { rows: [], rowCount: 0 };
  };
  const settings = { ...env, DEMO_PAYMENT_ENABLED: 'true' };
  const result = await withRuntime({ env: settings }, () => completeDemoPayment({ cart: 'TEST', plan: 'monthly' }, { id: 'test-id' }));
  assert.equal(result.cartNumber, 5002);
  assert.deepEqual(statements.find(x => x.sql.includes('insert into registration_carts')).values, ['test-id', 'monthly']);
  statements.length = 0;
  invoice.status = 'pending_payment';
  await withRuntime({ env: settings }, () => completeDemoPayment({ invoice: '7001' }, { id: 'test-id' }));
  await withRuntime({ env: settings }, () => completeDemoPayment({ invoice: '7001' }, { id: 'test-id' }));
  assert.equal(statements.filter(x => x.sql.includes('insert into subscriptions')).length, 1);
});

test('public partner link exposes sale prices only and hides invalid below-floor plans', async () => {
  query = async sql => ({ rows: sql.includes('from partners') ? [{ id: '11111111-1111-4111-8111-111111111111', shop_name: 'Print Shop', status: 'active', price_monthly: '20', price_annual: '200', sale_monthly: '35', sale_annual: '190', email: 'private@example.org' }] : [], rowCount: 1 });
  const response = await call('/api/partner', { method: 'POST', body: { action: 'storefront.view', partnerId: '11111111-1111-4111-8111-111111111111' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { partner: { id: '11111111-1111-4111-8111-111111111111', shopName: 'Print Shop', monthly: 35, annual: null } });
});

test('partner cannot lower public sale prices below their floor or edit a completed order', async () => {
  const { runPartnerAction } = load('api/_lib/partner.ts');
  query = async sql => ({ rows: sql.includes('select * from partners') ? [{ id: 'test-id', status: 'active', price_monthly: '20', price_annual: '200' }] : [], rowCount: 0 });
  const req = { headers: { authorization: `Bearer ${token('partner')}` } };
  await assert.rejects(withRuntime({ env }, () => runPartnerAction(req, 'storefront.save', { monthly: 1, annual: 250 }, 'https://onwan.link')), e => e.status === 400);
  await assert.rejects(withRuntime({ env }, () => runPartnerAction(req, 'orders.getDraft', { id: 'another-order' }, 'https://onwan.link')), e => e.status === 404);
});

test('partner full-editor design is validated and copied inside payment transaction', async () => {
  const { validatePartnerPageDraft, savePageData } = load('api/_lib/page.ts');
  const draft = { name: 'Customer', bio: 'Full editor', profileImage: '', theme: { background: '#123456', buttonColor: '#ffffff' }, wallpaper: { type: 'color', value: '#123456' }, buttonStyle: { shape: 'pill' }, profileStyle: { type: 'hero' }, typography: { font: 'tajawal' }, links: [{ id: 'a', title: 'Website', url: 'https://example.org' }] };
  const normalized = validatePartnerPageDraft(draft);
  assert.equal(normalized.links.length, 1);
  assert.throws(() => validatePartnerPageDraft({ ...draft, links: [{ title: 'Bad', url: 'javascript:alert(1)' }] }));
  const writes = [];
  const client = { query: async (sql, values) => { writes.push({ sql, values }); return { rows: sql.includes('update pages') ? [{ id: 'page-id' }] : [], rowCount: 0 }; }, release: () => { throw Error('Must not release caller transaction'); } };
  const result = await withRuntime({ env }, () => savePageData('customer-id', normalized, { client }));
  assert.equal(result.typography.font, 'tajawal');
  assert.equal(writes.find(x => x.sql.includes('update pages')).values[3], '');
  assert.match(writes.find(x => x.sql.includes('insert into page_links')).values[1], /example.org/);
  assert.ok(!writes.some(x => ['begin', 'commit', 'rollback'].includes(x.sql)));
});

test('referral captures server prices and first purchase earns once; demo earns zero', async () => {
  const { attachReferral, convertReferral } = load('api/_lib/partnerReferral.ts');
  let converted = false;
  const writes = [];
  const referral = { partner_id: 'p', sale_monthly: '35', sale_annual: '350', floor_monthly: '20', floor_annual: '200', partner_status: 'active' };
  const client = { query: async (sql, values) => {
    writes.push({ sql, values });
    if (sql.includes('select id, shop_name')) return { rows: [{ id: 'p', shop_name: 'Shop', status: 'active', price_monthly: 20, price_annual: 200, sale_monthly: 35, sale_annual: 350 }], rowCount: 1 };
    if (sql.includes('for update of r')) return { rows: converted ? [] : [referral], rowCount: converted ? 0 : 1 };
    if (sql.includes('insert into partner_orders')) return { rows: [{ id: 'order-id' }], rowCount: 1 };
    if (sql.includes('set converted_order_id')) converted = true;
    return { rows: [], rowCount: 0 };
  } };
  await attachReferral(client, 'user-id', '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(writes.find(x => x.sql.includes('insert into partner_referrals')).values, ['user-id', 'p', 35, 350, 20, 200]);
  await convertReferral(client, 'user-id', 'annual', 'paid-ref');
  await convertReferral(client, 'user-id', 'annual', 'paid-ref');
  const commissions = writes.filter(x => x.sql.includes('insert into partner_commissions'));
  assert.equal(commissions.length, 1);
  assert.equal(commissions[0].values[2], 150);
  converted = false;
  await convertReferral(client, 'another-user', 'monthly', 'DEMO:cart:xyz');
  assert.equal(writes.filter(x => x.sql.includes('insert into partner_commissions')).at(-1).values[2], 0);
});

test('referred checkout uses the stored partner prices, without stacking discounts', async () => {
  const { getPlans, pricePlan } = load('api/_lib/account.ts');
  query = async sql => ({ rows: sql.includes('from partner_referrals') ? [{ sale_monthly: '35', sale_annual: '350' }] : sql.includes('from plans') ? [{ plan: 'annual', price_sar: '100', discount_percent: '50' }, { plan: 'monthly', price_sar: '10', discount_percent: '10' }] : [], rowCount: 1 });
  const plans = await withRuntime({ env }, () => getPlans('user-id'));
  assert.equal(plans[0].priceSar, 350);
  assert.equal(plans[0].discountPercent, null);
  await assert.rejects(withRuntime({ env }, () => pricePlan('annual', 'DISCOUNT', 'user-id')), e => e.status === 400);
});

test('active partners upload videos under their own folder with their own token', async () => {
  query = async sql => ({ rows:
    sql.includes('from partners') ? [{ id: 'partner-owner' }] :
    sql.includes('as minute') ? [{ minute: 0, day: 0, bytes: '0' }] :
    sql.includes('as count from media_upload_events') ? [{ count: 0 }] :
    sql.includes('returning id::text') ? [{ id: 'upload-event' }] :
    sql.includes('select reserved_bytes') ? [{ reserved_bytes: String(20 * 1024 * 1024) }] : [], rowCount: 1 });
  const files = [];
  const settings = { ...env, MEDIA: { head: async () => null, list: async () => ({ objects: [], truncated: false }), put: async (key, body) => files.push({ key, size: body.byteLength }) } };
  const response = await worker.fetch(new Request('https://onwan.link/api/video-upload', {
    method: 'POST', headers: { Authorization: `Bearer ${token('partner')}`, 'Content-Type': 'video/mp4' }, body: new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]), // REQ-017: a real MP4 start («ftyp»)
  }), settings);
  assert.equal(response.status, 200);
  assert.match(files[0].key, /^wallpapers\/partner-owner\//);
  assert.equal(files[0].size, 8);
  const { validatePartnerPageDraft } = load('api/_lib/page.ts');
  const draft = { wallpaper: { type: 'video', uploaded: true, value: (await response.json()).url } };
  assert.doesNotThrow(() => validatePartnerPageDraft(draft, 'partner-owner'));
  assert.throws(() => validatePartnerPageDraft(draft, 'another-partner'));
});

// Note 71: a wrong code is a 400 — never a 401, which the app treats as «signed out».
test('a wrong email code keeps the session: 400 with a clear message, not 401', async () => {
  const bearer = withRuntime({ env }, () => createSessionToken('user-a', 'a@example.org'));
  query = async (sql, values = []) => {
    if (/from users/i.test(sql)) return { rows: [{ id: 'user-a', email: 'a@example.org', phone: '0500000000', status: 'active', email_verified_at: null }], rowCount: 1 };
    if (/from verification_codes/i.test(sql) && /expires_at <= now\(\) as expired/.test(sql)) return { rows: [{ expired: false, attempts: 1, used: false }], rowCount: 1 };
    if (/from verification_codes/i.test(sql)) return { rows: [{ id: 'code', code: '1234', attempts: 0 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const response = await call('/api/auth/email-code', { method: 'POST', bearer, body: { action: 'verify', code: '9999' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /غير صحيح/);
});

// REQ-015: drafts and publishing share one daily limit of 200 saves; a draft never touches the public page.
test('daily save limit refuses the 201st save; a draft is stored without publishing', async () => {
  const bearer = withRuntime({ env }, () => createSessionToken('user-a', 'a@example.org'));
  let saves = 199;
  const seen = [];
  query = async (sql, values = []) => {
    seen.push(sql.replace(/\s+/g, ' '));
    if (/from users/i.test(sql)) return { rows: [{ id: 'user-a', email: 'a@example.org', phone: '0500000000', status: 'active', email_verified_at: new Date() }], rowCount: 1 };
    if (/insert into page_save_counts/.test(sql)) { saves += 1; return { rows: [{ saves }], rowCount: 1 }; }
    if (/update pages set draft_json/.test(sql)) return { rows: [{ draft_saved_at: '2026-10-25T00:00:00Z' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const draft = await call('/api/page/me', { method: 'PATCH', bearer, body: { draft: true, pageData: { name: 'x', links: [] } } });
  assert.equal(draft.status, 200);
  assert.ok(!seen.some((sql) => /update pages set display_name|delete from page_links/.test(sql)), 'a draft does not publish');
  const over = await call('/api/page/me', { method: 'PATCH', bearer, body: { draft: true, pageData: { name: 'y', links: [] } } });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).code, 'save_limit');
});
