const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const filename = process.env.LOGO_REVIEW_SOURCE || 'src/app/pages/JourneyOnboarding.tsx';
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const initializers = {};
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['pickLogo', 'next', 'finish', 'canContinue'].includes(node.name.getText(source))) initializers[node.name.getText(source)] = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
initializer = initializers.pickLogo;
assert.ok(initializer, 'test must execute the actual pickLogo body');
const compiled = ts.transpileModule(`const pickLogo = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const logoPending = { current: false };
  const state = {}, compression = new Map(), palette = new Map(), uploads = [], logoRequest = { current: 0 };
  const pick = new Function('setImageError', 'compressImage', 'updatePageData', 'preloadMedia', 'updateProfileStyle', 'extractColorsFromImage', 'ImageProblem', 'logoRequest', 'logoPending', 'setPreparingLogo', `${compiled}; return pickLogo;`)(
    error => state.error = error,
    file => { const d = deferred(); compression.set(file, d); return d.promise; },
    updates => Object.assign(state, updates), image => uploads.push(image), () => {},
    image => { const d = deferred(); palette.set(image, d); return d.promise; }, class extends Error {}, logoRequest, logoPending, value => state.preparingLogo = value);
  return { state, compression, palette, uploads, logoRequest, logoPending, pick };
}
async function complete(h, file) {
  h.compression.get(file).resolve(file);
  await tick();
  h.palette.get(file)?.resolve([`${file}-color`]);
  await tick();
}
test('newest selection survives earlier compression completing last', async () => {
  const h = harness(); h.pick('first'); h.pick('second');
  await complete(h, 'second'); await complete(h, 'first');
  assert.equal(h.state.profileImage, 'second');
  assert.deepEqual(h.state.extractedColors, ['second-color']);
  assert.deepEqual(h.uploads, ['second']);
});
test('late palette does not replace colors of newer selection', async () => {
  const h = harness(); h.pick('first'); h.compression.get('first').resolve('first'); await tick();
  h.pick('second'); await complete(h, 'second');
  h.palette.get('first').resolve(['first-color']); await tick();
  assert.equal(h.state.profileImage, 'second');
  assert.deepEqual(h.state.extractedColors, ['second-color']);
});
test('stale failure does not show an error after newer success', async () => {
  const h = harness(); h.pick('first'); h.pick('second'); await complete(h, 'second');
  h.compression.get('first').reject(new Error('old failure')); await tick();
  assert.equal(h.state.error, '');
});
test('current failure remains visible and user can retry', async () => {
  const h = harness(); h.pick('first'); h.compression.get('first').reject(new Error('current failure')); await tick();
  assert.ok(h.state.error);
  h.pick('second'); await complete(h, 'second');
  assert.equal(h.state.error, ''); assert.equal(h.state.profileImage, 'second');
});
test('invalidated request cannot update page or start an upload', async () => {
  const h = harness(); h.pick('first'); h.logoRequest.current++;
  await complete(h, 'first');
  assert.equal(h.state.profileImage, undefined); assert.deepEqual(h.uploads, []);
});

function navigation(h, step = 2) {
  let moved = false, saves = 0;
  const compiled = ts.transpileModule(`const finish = ${initializers.finish}; const next = ${initializers.next}; const canContinue = ${initializers.canContinue};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const values = { nonprofit: true, kind: 'nonprofit', visibleChoices: [], logoPending: h.logoPending, preparingLogo: Boolean(h.state.preparingLogo), step, chosen: ['image'], pageData: { name: 'Association', links: [] }, saving: false, starting: false, finishing: { current: false }, setError() {}, setStarting() {}, onboardingItems: () => [], VISIBLE_CHOICES: [], flushSync: fn => fn(), addLink() {}, save: async () => { saves++; }, nonprofitCall: async () => {}, finishOnboarding() {}, toEditor() {}, setStep: () => { moved = true; } };
  const actions = new Function(...Object.keys(values), `${compiled}; return { next, finish, canContinue };`)(...Object.values(values));
  return { ...actions, moved: () => moved, saves: () => saves };
}
test('pending compression blocks continuing and saving even before rerender', async () => {
  const h = harness(), staleHandlers = navigation(h); h.pick('logo');
  assert.equal(navigation(h).canContinue, false);
  staleHandlers.next(); await staleHandlers.finish();
  assert.equal(staleHandlers.moved(), false); assert.equal(staleHandlers.saves(), 0);
  await complete(h, 'logo');
  assert.equal(navigation(h).canContinue, true);
  const ready = navigation(h); ready.next(); assert.equal(ready.moved(), true);
  await ready.finish(); assert.equal(ready.saves(), 1);
});
test('palette extraction keeps continuation blocked until it finishes', async () => {
  const h = harness(); h.pick('logo'); h.compression.get('logo').resolve('logo'); await tick();
  assert.equal(navigation(h).canContinue, false);
  h.palette.get('logo').resolve(['color']); await tick();
  assert.equal(navigation(h).canContinue, true);
});
test('older completion cannot release newer pending request', async () => {
  const h = harness(); h.pick('old'); h.pick('new'); await complete(h, 'old');
  assert.equal(h.logoPending.current, true); assert.equal(navigation(h).canContinue, false);
  await complete(h, 'new'); assert.equal(h.logoPending.current, false);
});
test('current failure releases pending state so retry remains possible', async () => {
  const h = harness(); h.pick('logo'); h.compression.get('logo').reject(new Error('failed')); await tick();
  assert.equal(h.logoPending.current, false); assert.equal(navigation(h).canContinue, true);
});
