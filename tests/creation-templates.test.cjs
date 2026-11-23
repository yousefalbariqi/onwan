const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
function load(entry, mocks = {}, storage) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-router', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'sessionStorage', outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports, storage);
  return module.exports;
}
function setup({ draft = null, blocked = false, category = 'personal' } = {}) {
  const values = new Map(), routes = [], states = [], refs = []; let cursor = 0, refCursor = 0;
  if (draft) values.set('onwan_guest_creation_v1', JSON.stringify(draft));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (blocked) throw Error('blocked'); values.set(key, value); } };
  const api = load('src/app/lib/creationTemplates.ts', {}, storage);
  const PhonePreview = () => null;
  const hooks = { ...React, useEffect() {}, useRef: value => refs[refCursor++] ||= { current: value }, useState: initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  } };
  const Screen = load('src/app/pages/CreationTemplates.tsx', {
    react: hooks, 'react-router': { useNavigate: () => route => routes.push(route), Link: () => null },
    '../context/PageContext': { mergeWithDefaults: data => data },
    '../components/PhonePreview': { PhonePreview }, '../components/TemplatePreview': { TemplatePreview: () => null },
    '../lib/creationStart': { readCreationCategory: () => category, saveCreationCategory() {} },
    '../lib/creationTemplates': api,
    '../lib/creationDraftSource': { createGuestPageSource: () => ({ load: async () => ({ pageData: api.readCreationDraft() || api.creationSample('personal') }), saveDraft: async data => { if (!api.saveCreationDraft(data)) throw Error('blocked'); } }) },
  }).default;
  return { api, values, routes, PhonePreview, render: () => { cursor = 0; refCursor = 0; return Screen(); } };
}
function walk(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => walk(child, predicate, found));
  return found;
}
test('templates use different layout and button settings as well as palettes', async () => {
  const { api } = setup();
  for (const group of api.TEMPLATE_GROUPS) {
    const templates = api.creationTemplates(group.id);
    assert.equal(templates.length, 12);
    assert.equal(new Set(templates.map(item => item.id)).size, 12);
    assert.ok(new Set(templates.map(item => item.design.buttonStyle.shape)).size > 1);
    assert.ok(templates.every(item => item.design.buttonStyle.composition.align === 'center'));
  }
  assert.equal(api.templateGroup('creator'), 'personal');
});
test('selecting a template updates the real-preview data and selected card without navigating', async () => {
  const h = setup(); let tree = h.render();
  const original = walk(tree, node => node.type === h.PhonePreview)[0].props.data;
  await walk(tree, node => node.props?.role === 'radio')[3].props.onClick();
  tree = h.render();
  const preview = walk(tree, node => node.type === h.PhonePreview)[0].props.data;
  assert.notDeepEqual(preview.theme, original.theme);
  assert.notDeepEqual(preview.buttonStyle, original.buttonStyle);
  assert.deepEqual(h.routes, []);
  assert.equal(walk(tree, node => node.props?.role === 'radio' && node.props['aria-checked']).length, 1);
  assert.equal(tree.props.className, 'creation-themes');
});
test('using a design opens email verification while retaining existing content and without copying preview-only URLs', async () => {
  const draft = { name: 'اسمي', bio: 'نبذتي', profileImage: 'my-image', links: [{ id: 'mine', title: 'موقعي', url: '' }] };
  const h = setup({ draft });
  await walk(h.render(), node => node.props?.role === 'radio')[2].props.onClick();
  await walk(h.render(), node => node.props?.className === 'creation-themes__continue')[0].props.onClick();
  const saved = h.api.readCreationDraft();
  assert.equal(saved.name, draft.name); assert.equal(saved.bio, draft.bio); assert.equal(saved.profileImage, draft.profileImage);
  assert.deepEqual(saved.links, draft.links);
  assert.equal(saved.theme.id, 'creation-night');
  assert.deepEqual(h.routes, ['/signup?step=save']);
});
test('blocked guest-draft storage leaves selection open and reports the problem', async () => {
  const h = setup({ blocked: true });
  await walk(h.render(), node => node.props?.className === 'creation-themes__continue')[0].props.onClick();
  assert.deepEqual(h.routes, []);
  assert.ok(walk(h.render(), node => node.props?.role === 'alert').length);
});
test('the prior category determines templates without repeated category tabs', () => {
  const h = setup({ category: 'nonprofit' });
  const tree = h.render();
  assert.equal(walk(tree, node => node.type === h.PhonePreview)[0].props.data.name, 'اسم جمعيتك');
  assert.equal(walk(tree, node => node.props?.['aria-pressed'] !== undefined).length, 0);
  assert.equal(walk(tree, node => node.props?.['aria-label'] === 'تغيير تصنيف الصفحة')[0].props.to, '/signup');
  assert.equal(walk(tree, node => node.props?.role === 'radio').length, 12);
});

test('smart search finds Nukhba by Arabic specialties and English synonyms, not just its name', async () => {
  const h = setup();
  const { searchCreationTemplates } = load('src/app/lib/creationTemplateSearch.ts');
  const templates = h.api.creationTemplates('business');
  for (const query of ['محامي', 'خدمات قانونية', 'مكتب محاماة', 'LAWYER', 'نُخْبَة']) {
    assert.equal(searchCreationTemplates(templates, query)[0].name, 'نخبة', query);
  }
  assert.ok(searchCreationTemplates(templates, 'استشارات إدارية').some(item => item.name === 'نخبة'));
  assert.equal(searchCreationTemplates(templates, 'مُحَامِي')[0].name, 'نخبة');
  assert.equal(searchCreationTemplates(templates, 'مكتب هندسي')[0].name, 'مسار');
  assert.equal(searchCreationTemplates(templates, 'عيادة')[0].name, 'واجهة');
  assert.deepEqual(searchCreationTemplates(templates, 'محامي عيادة'), []);
  assert.deepEqual(searchCreationTemplates(templates, '   '), templates);
});
test('search normalization supports Arabic spelling variants, diacritics and punctuation', async () => {
  const { normalizeTemplateSearch } = load('src/app/lib/creationTemplateSearch.ts');
  assert.equal(normalizeTemplateSearch('  إِستشاراتٌ ـ إدارية، LAWYER! '), 'استشارات اداريه lawyer');
});
test('search is inside the sheet, retains the current preview, and only continues after a matching result is chosen', async () => {
  const h = setup({ category: 'business' });
  walk(h.render(), node => node.type === 'input' && node.props.type === 'search')[0].props.onFocus();
  const original = walk(h.render(), node => node.type === h.PhonePreview)[0].props.data;
  walk(h.render(), node => node.type === 'input' && node.props.type === 'search')[0].props.onChange({ target: { value: 'محامي' } });
  let tree = h.render();
  assert.equal(walk(tree, node => node.props?.role === 'radio').length, 1);
  assert.equal(walk(tree, node => node.props?.role === 'radio')[0].props['aria-label'], 'تصميم نخبة');
  assert.deepEqual(walk(tree, node => node.type === h.PhonePreview)[0].props.data, original);
  assert.equal(walk(tree, node => node.props?.className === 'creation-themes__continue')[0].props.disabled, true);
  await walk(tree, node => node.props?.role === 'radio')[0].props.onClick();
  tree = h.render();
  assert.equal(walk(tree, node => node.type === h.PhonePreview)[0].props.data.theme.name, 'نخبة');
  assert.equal(walk(tree, node => node.props?.className === 'creation-themes__continue')[0].props.disabled, false);
  assert.deepEqual(h.routes, []);
});
test('empty results allow clearing search without changing the category or forgetting the selected design', async () => {
  const h = setup();
  await walk(h.render(), node => node.props?.role === 'radio')[2].props.onClick();
  walk(h.render(), node => node.type === 'input' && node.props.type === 'search')[0].props.onFocus();
  walk(h.render(), node => node.type === 'input' && node.props.type === 'search')[0].props.onChange({ target: { value: 'xyzunknown' } });
  let tree = h.render();
  assert.equal(walk(tree, node => node.props?.role === 'radio').length, 0);
  const next = walk(tree, node => node.props?.className === 'creation-themes__continue')[0];
  assert.equal(next.props.disabled, true);
  await next.props.onClick(); assert.deepEqual(h.routes, []);
  await walk(tree, node => node.type === 'button' && node.props.children === 'عرض كل التصاميم')[0].props.onClick();
  tree = h.render();
  assert.equal(walk(tree, node => node.props?.role === 'radio').length, 12);
  assert.equal(walk(tree, node => node.props?.role === 'radio' && node.props['aria-checked'])[0].props['aria-label'], 'تصميم مدار');
});

test('search opens on demand and expands the sheet; Escape clears it and returns to preview', () => {
  const h = setup();
  let tree = h.render();
  assert.equal(walk(tree, node => node.props?.['aria-label'] === 'إغلاق البحث').length, 0);
  walk(tree, node => node.type === 'input')[0].props.onFocus();
  tree = h.render();
  assert.ok(tree.props.className.includes('is-expanded'));
  const input = walk(tree, node => node.type === 'input')[0];
  input.props.onChange({ target: { value: 'xyzunknown' } });
  const previous = global.window;
  global.window = { requestAnimationFrame: callback => callback() };
  try { input.props.onKeyDown({ key: 'Escape', preventDefault() {} }); }
  finally { global.window = previous; }
  tree = h.render();
  assert.equal(tree.props.className, 'creation-themes');
  assert.equal(walk(tree, node => node.type === 'input')[0].props.value, '');
  assert.equal(walk(tree, node => node.props?.['aria-label'] === 'إغلاق البحث').length, 0);
  assert.equal(walk(tree, node => node.props?.role === 'radio').length, 12);
  assert.deepEqual(h.routes, []);
});
test('handle swipes snap to expanded and compact states without the following click undoing the swipe', () => {
  const h = setup();
  const handle = () => walk(h.render(), node => node.props?.className === 'creation-themes__handle')[0];
  handle().props.onPointerDown({ clientY: 200, pointerId: 1, currentTarget: { setPointerCapture() {} } });
  handle().props.onPointerUp({ clientY: 100 }); handle().props.onClick();
  assert.ok(h.render().props.className.includes('is-expanded'));
  handle().props.onPointerDown({ clientY: 100, pointerId: 1, currentTarget: { setPointerCapture() {} } });
  handle().props.onPointerUp({ clientY: 200 }); handle().props.onClick();
  assert.equal(h.render().props.className, 'creation-themes');
});
