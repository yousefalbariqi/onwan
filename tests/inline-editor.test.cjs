const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(entry, mocks = {}, globals = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports, ...Object.values(globals));
  return module.exports;
}
test('insertion preserves normal order, section membership, and missing-anchor fallback', () => {
  const { insertSectionItemAfter } = load('shared/linkSections.ts');
  const items = [{ id: 'one' }, { id: 'two' }];
  assert.deepEqual(insertSectionItemAfter(items, { id: 'new' }, 'one').map(item => item.id), ['one', 'new', 'two']);
  assert.deepEqual(insertSectionItemAfter(items, { id: 'new' }, null).map(item => item.id), ['new', 'one', 'two']);
  assert.deepEqual(insertSectionItemAfter(items, { id: 'new' }, 'missing').map(item => item.id), ['one', 'two', 'new']);
  const grouped = [{ id: 'heading', display: { kind: 'heading', sectionId: 'g' } }, { id: 'member', display: { sectionId: 'g' } }, { id: 'last' }];
  const next = insertSectionItemAfter(grouped, { id: 'new' }, 'member');
  assert.deepEqual(next.map(item => item.id), ['heading', 'member', 'new', 'last']);
  assert.equal(next[2].display.sectionId, 'g');
  assert.deepEqual(grouped.map(item => item.id), ['heading', 'member', 'last']);
});
test('adding a group after a member keeps groups whole', () => {
  const { insertSectionItemAfter } = load('shared/linkSections.ts');
  const items = [{ id: 'g1', display: { kind: 'heading', sectionId: 'old' } }, { id: 'a', display: { sectionId: 'old' } }, { id: 'b', display: { sectionId: 'old' } }, { id: 'last' }];
  const next = insertSectionItemAfter(items, { id: 'g2', display: { kind: 'heading', sectionId: 'new' } }, 'a');
  assert.deepEqual(next.map(item => item.id), ['g1', 'a', 'b', 'g2', 'last']);
});
test('published renderer has normal links and no editing controls; inline controls are opt-in', () => {
  const { mergeWithDefaults } = load('src/app/context/PageContext.tsx');
  const { PageView } = load('src/app/components/PageView.tsx');
  const data = mergeWithDefaults({ name: 'اسمي', bio: 'نبذتي', links: [{ id: 'one', title: 'موقعي', url: 'https://example.org' }] });
  const render = props => renderToStaticMarkup(React.createElement(PageView, { data, variant: 'public', ...props }));
  const publicHtml = render({});
  assert.match(publicHtml, /href="https:\/\/example.org"/);
  assert.doesNotMatch(publicHtml, /onwan-inline|تعديل الاسم|أضف إلى صفحتك/);
  const editorHtml = render({ onIdentityClick() {}, onItemClick() {}, onAddAfter() {}, selectedItemId: 'one' });
  assert.match(editorHtml, /تعديل الاسم/); assert.match(editorHtml, /تعديل الصورة/); assert.match(editorHtml, /تعديل النبذة/);
  assert.match(editorHtml, /أضف إلى صفحتك/); assert.match(editorHtml, /is-selected/);
});
function draftSource({ fail = false } = {}) {
  const session = new Map(), records = new Map(), writes = [];
  const storage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) };
  const templates = { readCreationDraft: () => JSON.parse(session.get('draft') || 'null'), saveCreationDraft: data => { session.set('draft', JSON.stringify(data)); session.set('onwan_guest_creation_stamp', String(Date.now())); return true; } };
  const api = load('src/app/lib/creationDraftSource.ts', {
    './draftRecovery': { readRecovery: async key => records.get(key) ?? null, writeRecovery: async (record, key) => { if (fail) throw Error('quota'); records.set(key, record); writes.push(record); } },
    './creationTemplates': templates,
  }, { sessionStorage: storage, crypto });
  return { source: api.createGuestPageSource(), create: api.createGuestPageSource, session, records, writes };
}
test('guest source saves incomplete forms durably and resumes the same draft across editor modes', async () => {
  const h = draftSource();
  const data = { name: 'اسم', links: [], editorForm: { form: { title: 'ملف غير مكتمل' } } };
  await h.source.saveDraft(data);
  assert.deepEqual((await h.create().load()).pageData, data);
  assert.equal(h.writes[0].owner, 'guest');
  assert.equal(h.source.uploadToken(), null);
});
test('guest snapshots are ordered and an IndexedDB failure is reported instead of claiming a save', async () => {
  const h = draftSource();
  await Promise.all([h.source.saveDraft({ name: 'first', links: [] }), h.create().saveDraft({ name: 'latest', links: [] })]);
  assert.equal((await h.create().load()).pageData.name, 'latest');
  assert.ok(h.writes[1].sequence > h.writes[0].sequence);
  await assert.rejects(draftSource({ fail: true }).source.saveDraft({ name: 'file', links: [] }), /quota/);
});

test('durable guest media wins over an older session copy and does not leak into a new tab', async () => {
  const h = draftSource();
  const media = { name: 'with file', links: [{ id: 'pdf', url: 'data:application/pdf;base64,JVBERi0=', fileName: 'report.pdf' }] };
  await h.source.saveDraft(media);
  h.session.set('draft', JSON.stringify({ name: 'old', links: [] }));
  h.session.set('onwan_guest_creation_stamp', '1');
  assert.deepEqual((await h.create().load()).pageData.links, media.links);
  h.session.clear();
  await assert.rejects(h.create().load(), /اختر تصميمًا/);
});

function workspace({ failDraft = false, pending = false } = {}) {
  let cursor = 0; const slots = [], actions = [];
  const PageView = () => null, LinkEditor = () => null;
  const noop = () => null;
  const hooks = { ...React, useEffect() {}, useLayoutEffect() {}, useCallback: callback => callback, useRef: value => slots[cursor++] ??= { current: value }, useState: initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  const Component = load('src/app/components/InlinePageEditor.tsx', {
    react: hooks,
    '../context/PageContext': { usePageContext: () => ({
      pageData: { name: 'اسمي', bio: '', profileImage: '', theme: { background: '#fff', textColor: '#111' }, buttonStyle: { shape: 'pill' }, links: [{ id: 'first' }, { id: 'last' }] },
      loadingPage: false, saving: false, conflict: false, draftState: 'saved', canUndo: true, canRedo: true,
      saveDraft: async () => { actions.push('draft'); if (failDraft) throw Error('save failed'); },
      save: async () => { actions.push('save'); }, hasPendingChanges: () => pending,
      undo: () => actions.push('undo'), redo: () => actions.push('redo'), updatePageData() {}, moveLink() {},
    }) },
    '../lib/editorPreview': { editorPreview: data => data },
    './PageView': { PageView }, './LinkEditor': { LinkEditor }, './TemporaryPasswordGate': { TemporaryPasswordGate: noop },
    './HeaderEditor': { HeaderEditor: noop }, './FormattingTextarea': { FormattingTextarea: noop },
    './WallpaperEditor': { WallpaperEditor: noop }, './StyleEditor': { StyleEditor: noop },
    './CreationInlineTemplates': { CreationInlineTemplates: noop }, './TemplateGallery': { TemplateGallery: noop },
  }).InlinePageEditor;
  return { actions, PageView, LinkEditor, render() { cursor = 0; return Component({ localOnly: true, onAdvanced: () => actions.push('advanced'), onBack: () => actions.push('back'), onContinue: () => actions.push('continue'), continueLabel: 'حفظ صفحتي' }); } };
}
function nodes(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => nodes(child, predicate, found)); return found;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('workspace has one add control, no repeated insertion slots, and appends through the existing content editor', () => {
  const h = workspace(); let tree = h.render();
  assert.equal(nodes(tree, n => n.type === h.PageView)[0].props.onAddAfter, undefined);
  const add = nodes(tree, n => n.props?.className === 'inline-editor__add'); assert.equal(add.length, 1);
  const page = nodes(tree, n => n.type === h.PageView)[0];
  assert.equal(nodes(page, n => n.props?.className === 'inline-editor__add').length, 1);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__dock-actions').length, 0);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__more-actions').length, 1);
  add[0].props.onClick(); tree = h.render();
  const editor = nodes(tree, n => n.type === h.LinkEditor)[0];
  assert.equal(editor.props.addRequest.afterId, 'last'); assert.equal(editor.props.focusId, null);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__design-tools')[0].props.children.length, 6);
});
test('preview removes editing controls and saves before changing mode; return and advanced preserve draft save', async () => {
  const h = workspace(); let tree = h.render();
  nodes(tree, n => n.type === 'button' && n.props['aria-pressed'] === false)[0].props.onClick(); await settle();
  tree = h.render(); assert.ok(tree.props.className.includes('is-preview'));
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__dock').length, 0);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__add').length, 0);
  assert.equal(nodes(tree, n => n.type === h.PageView)[0].props.onIdentityClick, undefined);
  assert.deepEqual(h.actions, ['draft']);
  nodes(tree, n => n.props?.['aria-label'] === 'العودة')[0].props.onClick(); await settle();
  assert.deepEqual(h.actions.slice(-2), ['draft', 'back']);
});
test('header save retains completion checks and blocks navigation when newer changes remain', async () => {
  for (const pending of [false, true]) {
    const h = workspace({ pending });
    nodes(h.render(), n => n.props?.className === 'inline-editor__save')[0].props.onClick(); await settle();
    assert.equal(h.actions.includes('save'), true); assert.equal(h.actions.includes('continue'), !pending);
    if (pending) assert.ok(nodes(h.render(), n => n.props?.role === 'alert').length > 0);
  }
});
test('a failed draft save prevents leaving the editor and surfaces the error', async () => {
  const h = workspace({ failDraft: true });
  nodes(h.render(), n => n.props?.['aria-label'] === 'العودة')[0].props.onClick(); await settle();
  assert.deepEqual(h.actions, ['draft']);
  assert.ok(nodes(h.render(), n => n.props?.role === 'alert').length > 0);
});


test('identity panel leaves a clear inert live preview, expands and closes without a manual save action', async () => {
  const h = workspace(); let tree = h.render();
  nodes(tree, n => n.props?.className === 'inline-editor__design-tools')[0].props.children[0].props.onClick();
  tree = h.render();
  assert.ok(tree.props.className.includes('has-panel'));
  assert.equal(nodes(tree, n => n.type === 'main')[0].props.inert, true);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__sheet-footer').length, 0);
  assert.equal(nodes(tree, n => n.props?.className === 'inline-editor__save')[0].props.children[1].props.children, 'التالي');
  const handle = nodes(tree, n => n.props?.className === 'inline-editor__handle')[0];
  handle.props.onClick();
  assert.ok(h.render().props.className.includes('is-panel-expanded'));
  nodes(tree, n => n.props?.['aria-label'] === 'إغلاق اللوحة')[0].props.onClick(); await settle();
  assert.equal(h.render().props.className.includes('has-panel'), false);
  assert.deepEqual(h.actions, ['draft']);
});


test('panel exit holds its last frame until the native dialog is hidden', async () => {
  const { closeInlinePanel } = load('src/app/lib/inlinePanelMotion.ts', {});
  const order = []; let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const element = { animate(frames, options) { assert.equal(options.fill, 'forwards'); order.push('animate'); return { finished, cancel() { order.push('release'); } }; }, close() { order.push('hide'); } };
  const closing = closeInlinePanel(element, false);
  assert.deepEqual(order, ['animate']);
  finish(); await closing;
  assert.deepEqual(order, ['animate', 'hide', 'release']);
});
test('reduced motion closes immediately without creating an animation', async () => {
  const { closeInlinePanel } = load('src/app/lib/inlinePanelMotion.ts', {});
  let closed = false;
  await closeInlinePanel({ close() { closed = true; }, animate() { throw Error('unexpected animation'); } }, true);
  assert.equal(closed, true);
});
test('an interrupted exit still hides the panel before releasing its held frame', async () => {
  const { closeInlinePanel } = load('src/app/lib/inlinePanelMotion.ts', {});
  const order = [];
  await closeInlinePanel({ animate() { return { finished: Promise.reject(Error('interrupted')), cancel() { order.push('release'); } }; }, close() { order.push('hide'); } }, false);
  assert.deepEqual(order, ['hide', 'release']);
});
