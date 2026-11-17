const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
function load(entry, mocks = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
function storageHarness(blocked = false) {
  const values = new Map();
  const module = { exports: {} };
  const { outputFiles } = buildSync({ entryPoints: ['src/app/lib/creationStart.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const storage = { getItem: key => { if (blocked) throw Error('blocked'); return values.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw Error('blocked'); values.set(key, value); } };
  new Function('module', 'exports', 'sessionStorage', outputFiles[0].text)(module, module.exports, storage);
  return { api: module.exports, values };
}
function walk(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => walk(child, predicate, found));
  return found;
}
function screen() {
  const { api, values } = storageHarness();
  const state = []; const navigations = []; let cursor = 0;
  const hooks = { ...React, useEffect() {}, useRef: value => ({ current: value }), useState: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  } };
  const CreationStart = load('src/app/pages/CreationStart.tsx', { react: hooks, 'react-router': { useNavigate: () => path => navigations.push(path), Link: () => null }, '../lib/creationStart': api }).default;
  return { render: () => { cursor = 0; return CreationStart(); }, values, navigations };
}
test('category screen is available without account fields and starts without a selected category', () => {
  const h = screen(), tree = h.render();
  const radios = walk(tree, node => node.props?.role === 'radio');
  assert.equal(radios.length, 4);
  assert.deepEqual(radios.map(radio => walk(radio, node => node.props?.className === 'creation-start__choice-label')[0].props.children), ['صفحة شخصية', 'نشاط تجاري', 'صانع محتوى', 'جمعية أو جهة غير ربحية']);
  assert.ok(radios.every(node => !node.props['aria-checked']));
  assert.equal(walk(tree, node => node.type === 'input' || node.props?.role === 'dialog').length, 0);
  assert.equal(walk(tree, node => node.props?.className === 'creation-start__continue')[0].props.disabled, true);
  assert.equal(walk(tree, node => node.props?.role === 'radiogroup')[0].props.dir, 'rtl');
});
test('changing the category selects exactly one card and confirmation retains it without registration', () => {
  const h = screen();
  walk(h.render(), node => node.props?.role === 'radio')[1].props.onClick();
  let tree = h.render(), radios = walk(tree, node => node.props?.role === 'radio');
  assert.equal(radios.filter(node => node.props['aria-checked']).length, 1);
  assert.ok(radios[1].props.className.includes('is-selected'));
  assert.deepEqual(h.navigations, [], 'selection must not navigate automatically');
  walk(tree, node => node.props?.className === 'creation-start__continue')[0].props.onClick();
  assert.deepEqual(h.navigations, ['/signup?step=templates']);
  assert.equal([...h.values.values()][0], 'business');
  assert.match(walk(h.render(), node => node.props?.role === 'status')[0].props.children, /نشاط تجاري/);
  radios[0].props.onClick();
  tree = h.render(); radios = walk(tree, node => node.props?.role === 'radio');
  assert.equal(radios[0].props['aria-checked'], true);
  assert.equal(radios[1].props['aria-checked'], false);
  assert.match(walk(tree, node => node.props?.role === 'status')[0].props.children, /بدون تسجيل/);
});
test('category cards support arrow-key selection in their RTL grid', () => {
  const h = screen(); let prevented = false;
  walk(h.render(), node => node.props?.role === 'radio')[0].props.onKeyDown({ key: 'ArrowLeft', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(walk(h.render(), node => node.props?.role === 'radio')[1].props['aria-checked'], true);
});
test('stored categories are validated and blocked storage does not prevent selection', () => {
  const { api, values } = storageHarness();
  api.saveCreationCategory('nonprofit'); assert.equal(api.readCreationCategory(), 'nonprofit');
  for (const key of values.keys()) values.set(key, 'invalid');
  assert.equal(api.readCreationCategory(), null);
  const blocked = storageHarness(true).api;
  assert.doesNotThrow(() => blocked.saveCreationCategory('personal'));
  assert.equal(blocked.readCreationCategory(), null);
});
test('the primary signup URL opens category selection, reserving account creation for its later explicit step', () => {
  const Entry = () => null;
  const params = new URLSearchParams();
  const Signup = load('src/app/pages/Signup.tsx', {
    'react-router': { useSearchParams: () => [params] },
    '../components/AccountEntry': { AccountEntry: Entry },
  }).default;
  assert.equal(Signup().type.name, 'CreationStart');
  params.set('step', 'account');
  assert.equal(Signup().type, Entry);
});
