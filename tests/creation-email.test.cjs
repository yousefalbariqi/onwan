const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
function load(entry, mocks = {}, globals = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports, ...Object.values(globals));
  return module.exports;
}
class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
function auth({ valid = true, exists = false, cooldown = 0 } = {}) {
  const calls = [], issues = [], tokens = [];
  const query = async (sql, values) => {
    calls.push(sql);
    if (sql.startsWith('select id from users')) return { rows: exists ? [{ id: 'customer' }] : [], rowCount: exists ? 1 : 0 };
    if (sql.startsWith('insert into creation_email_drafts')) return { rows: [{ id: 'draft-id', email: values[0], revision: 0, page_json: null }] };
    return { rows: [], rowCount: 0 };
  };
  const handler = load('api/auth/creation-email.ts', {
    '../_lib/account.js': { normalizeEmail: value => String(value).trim().toLowerCase() },
    '../_lib/auth.js': { createSessionToken: (...args) => { tokens.push(args); return 'scoped-token'; } },
    '../_lib/db.js': { pool: { query, connect: async () => ({ query, release() {} }) } },
    '../_lib/http.js': { HttpError, allowMethods: () => true, readJsonBody: async req => req.body, sendJson: (res, status, body) => Object.assign(res, { status, body }), handleApiError: (res, error) => Object.assign(res, { status: error.status || 500, body: { error: error.message, code: error.code } }) },
    '../_lib/loginGuard.js': { assertNotLocked: async () => {}, clearFailures: async () => {}, recordFailure: async () => {} },
    '../_lib/otp.js': { resendWaitSeconds: async () => cooldown, issueCode: async (...args) => issues.push(args), consumeCode: async () => valid, codeFailure: async () => new HttpError(400, 'invalid code'), OTP_RESEND_SECONDS: 60 },
    '../_lib/turnstile.js': { assertHuman: async () => calls.push('human') },
  }).default;
  return { calls, issues, tokens, run: async body => { const res = {}; await handler({ method: 'POST', body }, res); return res; } };
}
test('sending the same response for existing and new emails does not probe accounts before proof', async () => {
  const a = auth({ exists: false }), b = auth({ exists: true });
  const first = await a.run({ action: 'send', email: 'person@example.org' });
  const second = await b.run({ action: 'send', email: 'person@example.org' });
  assert.deepEqual(first, second);
  assert.equal(a.issues[0][1], 'creation_draft');
  assert.ok(a.calls.includes('human'));
  assert.ok(!a.calls.some(sql => sql.includes('from users')));
  assert.ok(a.calls.some(sql => sql.includes('pg_advisory_xact_lock')));
  const recent = auth({ cooldown: 45 });
  assert.equal((await recent.run({ action: 'send', email: 'person@example.org' })).body.retryAfter, 45);
  assert.equal(recent.issues.length, 0);
});
test('incorrect email proof never creates a draft session; existing accounts receive only a safe login route', async () => {
  const bad = auth({ valid: false });
  assert.equal((await bad.run({ action: 'verify', email: 'person@example.org', code: '1234' })).status, 400);
  assert.equal(bad.tokens.length, 0);
  assert.ok(!bad.calls.some(sql => sql.startsWith('insert into')));
  const existing = auth({ exists: true });
  const response = await existing.run({ action: 'verify', email: 'person@example.org', code: '1234' });
  assert.equal(response.body.existingAccount, true);
  assert.equal(existing.tokens.length, 0);
  assert.ok(!existing.calls.some(sql => sql.startsWith('insert into creation')));
});
test('verified new emails receive creation-only credentials, without creating a customer or publishing', async () => {
  const h = auth();
  const result = await h.run({ action: 'verify', email: 'Person@example.org', code: '1234', clientKey: '12345678-1234-1234-1234-123456789abc' });
  assert.equal(result.body.email, 'person@example.org');
  assert.equal(h.tokens[0][2], 'creation');
  assert.ok(!h.calls.some(sql => /insert into users|subscriptions|update pages/.test(sql)));
});
test('draft tokens cannot be substituted by customer, staff or partner credentials', async () => {
  let session = null, queries = 0;
  const { requireCreationDraft } = load('api/_lib/creationDraft.ts', {
    './auth.js': { getBearerToken: () => '', verifySessionToken: () => session }, './http.js': { HttpError },
    './db.js': { pool: { query: async () => { queries++; return { rows: [{ id: 'draft' }] }; } } }, './pageDraft.js': { MAX_DRAFT_CHARS: 2000000 },
  });
  for (const kind of [undefined, 'staff', 'partner']) { session = { kind }; await assert.rejects(requireCreationDraft({}), error => error.status === 401); }
  assert.equal(queries, 0);
  session = { kind: 'creation', userId: 'draft', email: 'owner@example.org' };
  assert.equal((await requireCreationDraft({})).id, 'draft');
});
test('cloud drafts reject stale revisions and inline files; retrying a committed operation does not write twice', async () => {
  let updates = 0;
  const row = { revision: 3, last_operation: 'committed' };
  const query = async sql => { if (sql.startsWith('select revision')) return { rows: [row] }; if (sql.startsWith('update')) { updates++; return { rows: [{ revision: 4 }] }; } return { rows: [] }; };
  const api = load('api/_lib/creationDraft.ts', { './auth.js': {}, './http.js': { HttpError }, './pageDraft.js': { MAX_DRAFT_CHARS: 2000000 }, './db.js': { pool: { connect: async () => ({ query, release() {} }) } } });
  const body = { revision: 1, operationId: 'new', pageData: { name: 'my page', links: [] } };
  await assert.rejects(api.saveCreationCloudDraft('draft', body), error => error.code === 'creation_conflict');
  assert.equal(updates, 0);
  assert.equal((await api.saveCreationCloudDraft('draft', { ...body, operationId: 'committed' })).revision, 3);
  assert.equal(updates, 0);
  assert.throws(() => api.validateCreationPayload({ name: 'x', links: [], profileImage: 'data:image/png;base64,abc' }), error => error.code === 'media_inline_forbidden');
});
function walk(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => walk(child, predicate, found));
  return found;
}
function screen({ existing = false, failSave = false, failSession = false, failVerify = false } = {}) {
  const slots = [], routes = [], sessions = [], saved = []; let cursor = 0, verifies = 0, sends = 0;
  const hooks = { ...React, useEffect() {}, useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; }, useState: initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  const Page = load('src/app/pages/CreationEmailSave.tsx', {
    react: hooks, 'react-router': { Link: () => null, useNavigate: () => (...args) => routes.push(args) },
    '../context/PageContext': { mergeWithDefaults: data => data },
    '../lib/turnstile': { TurnstileBox: () => null, useHumanOk: () => true },
    '../lib/creationCloud': { clearCreationSession() {}, sendCreationCode: async () => { sends++; return { retryAfter: 60 }; }, verifyCreationCode: async () => { verifies++; if (failVerify) { failVerify = false; throw Error('invalid code'); } return existing ? { existingAccount: true } : { id: 'draft', token: 'scoped', email: 'person@example.org', revision: 0 }; }, storeCreationSession: value => { if (failSession) { failSession = false; throw Error('storage blocked'); } sessions.push(value); } },
    '../lib/creationDraftSource': { createGuestPageSource: () => ({ load: async () => ({ pageData: { name: 'chosen', links: [], theme: { id: 'chosen-theme' } } }), saveDraft: async data => { if (failSave) { failSave = false; throw Error('save failed'); } saved.push(data); } }) },
  }).default;
  return { render: () => { cursor = 0; return Page(); }, routes, sessions, saved, verifies: () => verifies, sends: () => sends };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function enterCode(h) {
  walk(h.render(), node => node.type === 'input')[0].props.onChange({ target: { value: 'person@example.org' } });
  walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick();
  walk(h.render(), node => node.type?.name === 'VerificationCodeInput')[0].props.onChange('1234');
}
test('email screen has one field, validates it, and only enters editing after proof and durable saving', async () => {
  const h = screen(); let tree = h.render();
  assert.equal(walk(tree, node => node.type === 'input').length, 1);
  assert.equal(walk(tree, node => node.type === 'button' && node.props.type === 'submit')[0].props.disabled, true);
  walk(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'bad' } });
  assert.equal(walk(h.render(), node => node.type === 'button' && node.props.type === 'submit')[0].props.disabled, true);
  await enterCode(h);
  walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(h.verifies(), 1); assert.equal(h.sends(), 1);
  assert.equal(h.saved[0].theme.id, 'chosen-theme');
  assert.equal(h.routes[0][0], '/signup?step=edit');
});
test('save failure keeps the chosen design and retries saving without consuming another verification code', async () => {
  const h = screen({ failSave: true }); await enterCode(h);
  const submit = () => walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  submit(); await tick(); assert.equal(h.routes.length, 0);
  assert.ok(walk(h.render(), node => node.props?.role === 'alert').length);
  submit(); await tick(); assert.equal(h.verifies(), 1); assert.equal(h.routes.length, 1);
});
test('verified existing-account emails are directed to sign in without attaching or overwriting a page', async () => {
  const h = screen({ existing: true }); await enterCode(h);
  walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(h.sessions.length, 0); assert.equal(h.saved.length, 0); assert.equal(h.routes.length, 0);
  assert.ok(walk(h.render(), node => node.props?.to?.startsWith('/login?email=')).length);
});

test('blocked credential storage cannot pretend the draft is saved; retry retains the proof', async () => {
  const h = screen({ failSession: true }); await enterCode(h);
  const submit = () => walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  submit(); await tick(); assert.equal(h.routes.length, 0); assert.equal(h.saved.length, 0);
  submit(); await tick(); assert.equal(h.verifies(), 1); assert.equal(h.sessions.length, 1); assert.equal(h.routes.length, 1);
});
test('cloud transport reuses a lost-response operation and uploads with only the scoped draft credential', async () => {
  const storage = new Map(), calls = [], uploads = []; let lost = true;
  const cloud = load('src/app/lib/creationCloud.ts', {
    './mediaUpload': { moveInlineMedia: async (data, token) => { uploads.push(token); return data; } },
    './turnstile': { takeTurnstileToken: () => null },
  }, {
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, options) => { calls.push({ url, ...options }); if (lost) { lost = false; throw Error('connection lost'); } return { ok: true, json: async () => ({ revision: 1 }) }; },
  });
  const data = { name: 'chosen', links: [] };
  cloud.storeCreationSession({ token: 'creation-only', id: 'draft', email: 'person@example.org', revision: 0 });
  await assert.rejects(cloud.writeCloudCreation(data, 7), /connection lost/);
  await cloud.writeCloudCreation(data, 7);
  assert.equal(JSON.parse(calls[0].body).operationId, JSON.parse(calls[1].body).operationId);
  assert.equal(calls[1].headers.Authorization, 'Bearer creation-only');
  assert.deepEqual(uploads, ['creation-only', 'creation-only']);
  assert.equal(cloud.creationSession().revision, 1);
  assert.equal(cloud.creationSession().syncedSequence, 7);
});

test('failed verification retains the code for correction and back returns to email without losing the design route', async () => {
  const h = screen({ failVerify: true }); await enterCode(h);
  walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick();
  let tree = h.render();
  const field = walk(tree, node => node.type?.name === 'VerificationCodeInput')[0];
  assert.equal(field.props.value, '1234'); assert.equal(field.props.invalid, true);
  field.props.onChange('0123');
  assert.equal(walk(h.render(), node => node.props?.role === 'alert').length, 0);
  walk(h.render(), node => node.props?.className === 'creation-email__back')[0].props.onClick();
  tree = h.render(); assert.equal(walk(tree, node => node.type === 'input')[0].props.value, 'person@example.org');
  assert.equal(walk(tree, node => node.type?.name === 'VerificationCodeInput').length, 0);
  walk(tree, node => node.props?.className === 'creation-email__back')[0].props.onClick();
  assert.equal(h.routes[0][0], '/signup?step=templates');
});
