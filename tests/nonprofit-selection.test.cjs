const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}, localStorage) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'localStorage', code)(name => { if (name in mocks) return mocks[name]; throw Error(name); }, module, module.exports, localStorage);
  return module.exports;
}
const { onboardingItems } = load('src/app/lib/nonprofitSelection.ts');
const choices = [
  { id: 'whatsapp', name: 'واتساب', kind: 'platform' },
  { id: 'instagram', name: 'إنستغرام', kind: 'platform' },
  { id: 'video', name: 'مقطع', kind: 'content' },
  { id: 'youtube', name: 'يوتيوب', kind: 'platform' },
  { id: 'image', name: 'صورة', kind: 'content' },
  { id: 'file', name: 'ملف', kind: 'content' },
  { id: 'doc-registration', name: 'شهادة الجمعية', kind: 'document', docType: 'registration' },
];
test('no selection or skip creates no default content', () => {
  assert.deepEqual(onboardingItems(choices, [], []), []);
  assert.deepEqual(onboardingItems(choices, ['unknown', 'doc-hidden'], []), []);
});
test('only explicit selections are added and remain hidden until completed', () => {
  const added = onboardingItems(choices, ['whatsapp', 'file', 'doc-registration'], []);
  assert.deepEqual(added.map(item => item.title), ['واتساب', 'ملف', 'شهادة الجمعية']);
  assert.ok(added.every(item => item.hidden && item.url === ''));
});
test('video and YouTube are distinct choices, and retries do not duplicate them or files', () => {
  const chosen = ['video', 'youtube', 'image', 'file'];
  const added = onboardingItems(choices, chosen, []);
  assert.equal(added.length, 4);
  assert.deepEqual(onboardingItems(choices, chosen, added.map((item, i) => ({ ...item, id: String(i) }))), []);
});
test('existing user content is neither removed nor mutated', () => {
  const existing = [{ id: 'one', title: 'رابط أضفته بنفسي', platform: 'website', url: 'https://example.org' }];
  const before = JSON.stringify(existing);
  assert.deepEqual(onboardingItems(choices, [], existing), []);
  assert.equal(JSON.stringify(existing), before);
});
function authHarness() {
  let owner = 'guest'; const storage = new Map(), restores = [], routes = [], replacements = [];
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const session = { sessionOwner: () => owner, setSessionToken: () => { owner = 'user:new'; } };
  const onboarding = load('src/app/lib/nonprofitOnboarding.ts', { './session': session }, localStorage);
  const context = { pageData: { name: 'guest', links: [{ id: 'guest-link', platform: 'instagram' }] }, replacePageData: data => replacements.push(data), restoreDraft: data => restores.push(data), setAccount() {}, setAuthenticated() {} };
  const { useAuthSuccess } = load('src/app/lib/useAuthSuccess.ts', {
    'react-router': { useNavigate: () => (...args) => routes.push(args) },
    '../context/PageContext': { usePageContext: () => context }, './session': session,
    './site': { isNonprofitHost: () => true }, './nonprofitOnboarding': onboarding,
  });
  return { run: useAuthSuccess(), storage, restores, routes, replacements };
}
test('new nonprofit signup cannot inherit a guest draft or stale onboarding selections', () => {
  const h = authHarness();
  h.storage.set('onwan_nonprofit_onboarding_user:new', JSON.stringify({ step: 2, chosen: ['instagram'] }));
  h.run({ token: 'new', account: { kind: 'nonprofit' }, pageData: { name: 'new association', links: [] } }, { keepDraft: true, newNonprofit: true });
  assert.equal(h.restores.length, 0);
  assert.deepEqual(h.replacements[0].links, []);
  assert.deepEqual(JSON.parse(h.storage.get('onwan_nonprofit_onboarding_user:new')), { step: 1, chosen: [] });
});
test('existing nonprofit login keeps its own unfinished selections', () => {
  const h = authHarness(), progress = { step: 2, chosen: ['whatsapp'] };
  h.storage.set('onwan_nonprofit_onboarding_user:new', JSON.stringify(progress));
  h.run({ token: 'new', account: { kind: 'nonprofit' }, pageData: { links: [] } }, { keepDraft: false });
  assert.deepEqual(JSON.parse(h.storage.get('onwan_nonprofit_onboarding_user:new')), progress);
  assert.equal(h.restores.length, 0);
});
test('standard signup still preserves an explicitly requested guest design', () => {
  const h = authHarness();
  h.run({ token: 'new', account: { kind: 'standard' }, pageData: { links: [] } }, { keepDraft: true });
  assert.equal(h.restores.length, 1);
  assert.equal(h.restores[0].links[0].id, 'guest-link');
});
