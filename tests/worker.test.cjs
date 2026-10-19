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
    const method = ['/api/account', '/api/auth/email-code'].includes(route) ? 'POST' : 'GET';
    for (const bearer of [undefined, token('staff'), token('partner')]) {
      assert.equal((await call(route, { method, bearer, body: method === 'POST' ? { action: 'send' } : undefined })).status, 401, route);
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
