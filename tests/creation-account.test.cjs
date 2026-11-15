const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
function load(entry, mocks = {}, globals = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports, ...Object.values(globals));
  return module.exports;
}
class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
function server({ taken = false, completed = false } = {}) {
  const queries = [], tokens = []; let users = completed ? 1 : 0, backup;
  let draft = { id: 'draft', email: 'verified@example.org', page_json: { name: 'chosen', theme: { id: 'selected' }, links: [{ id: 'one', url: 'https://example.org', title: 'mine' }] }, account_user_id: completed ? 'user' : null };
  let saved;
  const query = async (sql, args) => {
    queries.push({ sql, args });
    if (sql === 'begin') backup = { users, draft: structuredClone(draft), saved };
    if (sql === 'rollback') { users = backup.users; draft = backup.draft; saved = backup.saved; }
    if (sql.startsWith('select * from creation_email_drafts')) return { rows: [draft] };
    if (sql.startsWith('select password_hash')) return { rows: [{ password_hash: 'hash' }] };
    if (sql.startsWith('insert into users')) { users++; return { rows: [{ id: 'user' }] }; }
    if (sql.includes('draft_json=$3')) saved = JSON.parse(args[2]);
    if (sql.startsWith('update creation_email_drafts')) draft.account_user_id = args[1];
    return { rows: [], rowCount: 0 };
  };
  const handler = load('api/auth/signup.ts', {
    '../_lib/creationDraft.js': { requireCreationDraft: async () => draft },
    '../_lib/loginGuard.js': { assertNotLocked: async () => {}, recordFailure: async () => {}, clearFailures: async () => {} },
    '../_lib/pageDraft.js': { loadDraft: async () => ({ pageData: saved || draft.page_json }) },
    '../_lib/serverTiming.js': { serverTiming: () => ({ measure: async (_, fn) => fn(), sync: (_, fn) => fn(), flush() {} }) },
    '../_lib/turnstile.js': { assertHuman: async () => {} },
    '../_lib/partnerReferral.js': { attachReferral: async () => {} },
    '../_lib/account.js': { normalizeEmail: email => email.toLowerCase().trim(), getAccountSummary: async () => ({ emailVerified: Boolean(draft.account_user_id), pageStatus: 'draft' }) },
    '../_lib/auth.js': { createSessionToken: (...args) => { tokens.push(args); return 'customer-token'; } },
    '../_lib/db.js': { pool: { connect: async () => ({ query, release() {} }) } },
    '../_lib/http.js': { HttpError, allowMethods: () => true, readJsonBody: async req => req.body, sendJson: (res, status, body) => Object.assign(res, { status, body }), handleApiError: (res, error) => Object.assign(res, { status: error.status || 500, body: { code: error.code, error: error.message } }) },
    '../_lib/page.js': { ensurePageForUser: async () => {}, getPageDataByUserId: async () => ({ name: 'original' }) },
    '../_lib/password.js': { hashPassword: () => 'hash', validatePassword: value => value.length >= 8 ? null : 'weak password', verifyPassword: value => value === 'Strong123' },
    '../_lib/username.js': { validateUsername: value => ({ valid: Boolean(value), normalized: value }), reserveUsername: async () => { if (taken) throw new HttpError(409, 'taken', 'username_taken'); } },
  }).default;
  return { queries, tokens, users: () => users, saved: () => saved, run: async (changes = {}) => { const res = {}; await handler({ method: 'POST', body: { creationToken: 'proof', email: 'verified@example.org', phone: '0512345678', password: 'Strong123', username: 'chosen', organizationName: 'edited name', termsAccepted: true, ...changes } }, res); return res; } };
}
test('completion uses ordinary signup and atomically attaches the entire draft, verified mailbox and reserved link without publication', async () => {
  const h = server(); const response = await h.run();
  assert.equal(response.status, 200); assert.equal(h.users(), 1);
  assert.equal(h.saved().theme.id, 'selected'); assert.equal(h.saved().links[0].title, 'mine');
  assert.equal(h.saved().name, 'edited name'); assert.equal(h.saved().username, 'chosen');
  assert.equal(response.body.account.emailVerified, true);
  assert.ok(h.queries.some(q => q.sql.includes('for update')));
  assert.ok(h.queries.some(q => q.sql.includes('email_verified_at=now()')));
  assert.ok(!h.queries.some(q => /published'|insert into subscriptions|payments/.test(q.sql)));
  assert.equal(h.tokens.length, 1);
});
test('changing a claimed verified email, missing consent, weak password or invalid phone cannot create an account', async () => {
  for (const values of [{ email: 'other@example.org' }, { termsAccepted: false }, { password: 'weak' }, { phone: '123' }]) {
    const h = server(); assert.equal((await h.run(values)).status, 400); assert.equal(h.users(), 0); assert.equal(h.tokens.length, 0);
  }
});
test('a last-moment username collision rolls back account creation and retains the cloud draft', async () => {
  const h = server({ taken: true }); assert.equal((await h.run()).body.code, 'username_taken');
  assert.equal(h.users(), 0); assert.equal(h.saved(), undefined); assert.equal(h.tokens.length, 0);
  assert.ok(h.queries.some(q => q.sql === 'rollback'));
});
test('repeating completion after a lost response returns the same account only with its password', async () => {
  const h = server(); await h.run(); const response = await h.run();
  assert.equal(response.status, 200); assert.equal(h.users(), 1);
  const denied = await h.run({ password: 'Different123' }); assert.equal(denied.status, 409); assert.equal(h.users(), 1);
});
function walk(node, predicate, found = []) { if (!node || typeof node !== 'object') return found; if (predicate(node)) found.push(node); React.Children.forEach(node.props?.children, child => walk(child, predicate, found)); return found; }
async function screen() {
  const slots = [], effects = [], routes = [], saved = [], requests = [], sessions = new Map(); let cursor = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = { ...React, useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; }, useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useEffect: (fn, deps) => { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } } };
  const session = { id: 'draft', token: 'proof', email: 'verified@example.org', revision: 1 };
  const data = { name: 'يوسف', username: '', links: [], theme: { id: 'selected' } };
  const Page = load('src/app/pages/CreationAccount.tsx', {
    react: hooks, 'react-router': { Link: () => null, useNavigate: () => (...args) => routes.push(args) },
    '../components/PasswordInput': { PasswordInput: 'password-control' },
    '../context/PageContext': { usePageContext: () => ({ replacePageData() {}, setAccount() {}, setAuthenticated() {} }) },
    '../lib/session': { setSessionToken: token => sessions.set('customer', token) },
    '../lib/turnstile': { TurnstileBox: () => null, useHumanOk: () => true },
    '../lib/creationCloud': { creationSession: () => session, clearCreationSession() {}, storeCreationSession() {}, readCloudCreation: async () => ({ termsAccepted: false }), changeCreationEmail: async () => ({ ...session, email: 'new@example.org' }) },
    '../lib/creationDraftSource': { createGuestPageSource: () => ({ load: async () => ({ pageData: data }), saveDraft: async value => saved.push(value) }) },
    '../lib/api': { checkUsername: async name => ({ available: name !== 'taken' }), signup: async value => { requests.push(value); return { token: 'customer', pageData: data, account: {} }; } },
  }, { sessionStorage: { getItem: key => sessions.get(key) || null, setItem: (key, value) => sessions.set(key, value), removeItem: key => sessions.delete(key) } }).default;
  function render() { cursor = 0; const tree = Page(); while (effects.length) effects.shift()(); return tree; }
  render(); await new Promise(resolve => setImmediate(resolve)); render(); await new Promise(resolve => setTimeout(resolve, 430));
  return { render, routes, saved, requests };
}
test('completion screen restores page identity, checks its generated link and submits existing verified email once', async () => {
  const h = await screen(); let tree = h.render();
  const submit = () => walk(h.render(), node => node.type === 'button' && node.props.type === 'submit')[0];
  assert.equal(submit().props.disabled, true);
  assert.equal(walk(tree, node => node.type === 'password-control').length, 1);
  walk(tree, node => node.type === 'password-control')[0].props.onChange({ target: { value: 'Strong123' } });
  walk(tree, node => node.type === 'input' && node.props.type === 'tel')[0].props.onChange({ target: { value: '٠٥١٢٣٤٥٦٧٨' } });
  walk(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  assert.equal(submit().props.disabled, false);
  walk(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].email, 'verified@example.org');
  assert.ok(h.requests[0].username); assert.equal(h.saved[0].theme.id, 'selected');
  assert.equal(h.routes.at(-1)[0], '/plan-selection');
});

test('email replacement requires both the current draft credential and new mailbox proof, keeping the same draft and content', async () => {
  let valid = false, exists = false; const updates = [], tokens = [];
  const current = { id: 'original-draft', email: 'old@example.org', revision: 4, page_json: { name: 'retained' } };
  const query = async (sql, args) => {
    if (sql.startsWith('select *')) return { rows: [current] };
    if (sql.startsWith('select id from users')) return { rowCount: exists ? 1 : 0 };
    if (sql.startsWith('update creation_email_drafts')) updates.push(args);
    return { rows: [] };
  };
  const handler = load('api/auth/creation-email.ts', {
    '../_lib/creationDraft.js': { requireCreationDraft: async () => current },
    '../_lib/account.js': { normalizeEmail: value => value.toLowerCase() },
    '../_lib/auth.js': { createSessionToken: (...args) => { tokens.push(args); return 'new-scoped-token'; } },
    '../_lib/db.js': { pool: { connect: async () => ({ query, release() {} }) } },
    '../_lib/http.js': { HttpError, allowMethods: () => true, readJsonBody: async req => req.body, sendJson: (res, status, body) => Object.assign(res, { status, body }), handleApiError: (res, error) => Object.assign(res, { status: error.status || 500, body: { code: error.code } }) },
    '../_lib/loginGuard.js': { assertNotLocked: async () => {}, clearFailures: async () => {}, recordFailure: async () => {} },
    '../_lib/otp.js': { consumeCode: async () => valid, codeFailure: async () => new HttpError(400, 'incorrect code') },
  }).default;
  const run = async () => { const res = {}; await handler({ method: 'POST', body: { action: 'change-verify', email: 'new@example.org', code: '1234' } }, res); return res; };
  assert.equal((await run()).status, 400); assert.equal(updates.length, 0); assert.equal(tokens.length, 0);
  valid = true; exists = true;
  assert.equal((await run()).status, 409); assert.equal(updates.length, 0);
  exists = false; const result = await run();
  assert.equal(result.status, 200); assert.equal(result.body.id, 'original-draft'); assert.equal(result.body.revision, 4);
  assert.deepEqual(updates[0], ['original-draft', 'new@example.org']);
  assert.deepEqual(tokens[0], ['original-draft', 'new@example.org', 'creation']);
  assert.equal(current.page_json.name, 'retained');
});
