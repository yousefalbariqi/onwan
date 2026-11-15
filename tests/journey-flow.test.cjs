const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router');

function load(entry, mocks = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
function markup(Component, props) {
  // Router emits its expected useLayoutEffect SSR warning, which is not a failure.
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)));
}
function walk(node, predicate, found = []) {
  if (node == null || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => walk(child, predicate, found));
  return found;
}
function setup(kind, { step = 3, failSave = false } = {}) {
  const events = [], errors = [], links = [];
  const pageData = { name: 'صفحتي', bio: '', profileImage: '', links: [] };
  const context = { pageData, updatePageData() {}, updateProfileStyle() {}, addLink: item => links.push(item), saving: false,
    save: async () => { events.push('save'); if (failSave) throw new Error('save failed'); } };
  const hooks = { ...React, useEffect() {}, useId: () => 'logo', useRef: value => ({ current: value }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, value => { if (typeof value === 'string' && value) errors.push(value); }] };
  const { JourneyOnboarding } = load('src/app/pages/JourneyOnboarding.tsx', {
    react: hooks, 'react-dom': { flushSync: fn => fn() },
    'react-router': { useNavigate: () => route => events.push(route) },
    '../context/PageContext': { usePageContext: () => context },
    '../lib/api': { nonprofitCall: async () => events.push('nonprofit-start') },
    '../lib/journeyOnboarding': { onboardingProgress: () => ({ step, chosen: ['image', 'doc-registration'] }), onboardingPending: () => true,
      saveOnboarding() {}, finishOnboarding: value => events.push(`finished:${value}`) },
  });
  return { tree: JourneyOnboarding({ kind }), events, errors, links };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('standard entry uses the same landing with its own identity and policy links', () => {
  const Landing = load('src/app/pages/JourneyLanding.tsx').default;
  const html = markup(Landing, { kind: 'standard' });
  assert.match(html, /أنشئ صفحتك/);
  assert.match(html, /href="\/signup"/);
  assert.match(html, /href="\/reports"/);
  assert.match(html, /href="\/refund"/);
  assert.doesNotMatch(html, /باقة عنوان للجمعيات|منتج مخصص للجمعيات|href="\/nonprofit\//);
});
test('standard setup excludes association documents while nonprofit setup retains them', () => {
  const titles = kind => walk(setup(kind, { step: 1 }).tree, node => node.type === 'button' && 'aria-pressed' in node.props)
    .map(node => node.props.children.at(-1).props.children);
  assert.ok(titles('nonprofit').includes('شهادة تسجيل الجمعية'));
  assert.ok(!titles('standard').some(title => /الجمعية|الجمعيات/.test(title)));
  assert.ok(titles('standard').includes('صورة مخصصة'));
});
for (const kind of ['standard', 'nonprofit']) {
  test(`${kind}: finishing saves before opening the editor and duplicate clicks save once`, async () => {
    const h = setup(kind);
    const button = walk(h.tree, node => node.type === 'button' && node.props.className?.includes('min-h-14'))[0];
    assert.ok(button);
    button.props.onClick(); button.props.onClick();
    await tick();
    assert.deepEqual(h.events, kind === 'standard' ? ['save', 'finished:standard', '/builder'] : ['save', 'nonprofit-start', 'finished:nonprofit', '/nonprofit/builder']);
    assert.ok(h.links.every(item => item.hidden));
    assert.equal(h.links.length, kind === 'standard' ? 1 : 2);
  });
  test(`${kind}: failed save keeps setup open without recording completion`, async () => {
    const h = setup(kind, { failSave: true });
    walk(h.tree, node => node.type === 'button' && node.props.className?.includes('min-h-14'))[0].props.onClick();
    await tick();
    assert.deepEqual(h.events, ['save']);
    assert.ok(h.errors.includes('save failed'));
  });
}

function preview(kind, { failSave = false, pending = false, status = 'draft' } = {}) {
  const routes = [], errors = [];
  let saves = 0;
  const { PreviewContinue } = load('src/app/components/PreviewContinue.tsx', {
    react: { ...React, useRef: value => ({ current: value }), useState: value => [value, next => errors.push(next)] },
    'react-router': { useNavigate: () => route => routes.push(route) },
    '../context/PageContext': { usePageContext: () => ({ account: { kind, pageStatus: status }, saving: false, hasPendingChanges: () => pending,
      save: async () => { saves++; if (failSave) throw new Error('save failed'); } }) },
  });
  return { tree: PreviewContinue(), routes, errors, saves: () => saves };
}
for (const kind of ['standard', 'nonprofit']) {
  test(`${kind}: preview saves once then continues to the correct commercial path`, async () => {
    const h = preview(kind);
    const button = walk(h.tree, node => node.type === 'button')[0];
    await Promise.all([button.props.onClick(), button.props.onClick()]);
    assert.equal(h.saves(), 1);
    assert.deepEqual(h.routes, [kind === 'nonprofit' ? '/nonprofit/quote' : '/plan-selection']);
  });
  test(`${kind}: preview cannot continue after failed save or newer unsaved changes`, async () => {
    for (const options of [{ failSave: true }, { pending: true }]) {
      const h = preview(kind, options);
      await walk(h.tree, node => node.type === 'button')[0].props.onClick();
      assert.deepEqual(h.routes, []);
      assert.ok(h.errors.at(-1));
    }
  });
}
test('published or suspended pages do not offer a new-account checkout in preview', () => {
  for (const kind of ['standard', 'nonprofit']) for (const status of ['published', 'suspended']) assert.equal(preview(kind, { status }).tree, null);
});
