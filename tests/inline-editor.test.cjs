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
