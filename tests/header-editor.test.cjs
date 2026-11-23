const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(entry, mocks = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
function nodes(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => nodes(child, predicate, found)); return found;
}
function harness(mobile = true) {
  let cursor = 0, slots = [];
  const { mergeWithDefaults, FONT_OPTIONS } = load('src/app/context/PageContext.tsx');
  let pageData = mergeWithDefaults({ name: 'اسم الحساب', bio: 'نبذة', typography: { font: 'cairo' } });
  const hooks = { ...React, useId: () => 'photo', useEffect() {}, useRef: initial => slots[cursor++] ??= { current: initial }, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
  const editor = load(mobile ? 'src/app/components/MobileHeaderEditor.tsx' : 'src/app/components/HeaderEditor.tsx', { react: hooks, '../context/PageContext': { FONT_OPTIONS, usePageContext: () => ({ pageData, updatePageData: update => { pageData = { ...pageData, ...update }; }, updateProfileStyle: update => { pageData = { ...pageData, profileStyle: { ...pageData.profileStyle, ...update } }; }, updateTypography: update => { pageData = { ...pageData, typography: { ...pageData.typography, ...update } }; } }) } });
  const Component = mobile ? editor.MobileHeaderEditor : editor.HeaderEditor;
  return { get data() { return pageData; }, render() { cursor = 0; return Component({ logoBanner: true, logoZoomOut: true }); } };
}
test('title font disclosure changes only the title font and can return to inherited typography', () => {
  const h = harness(); let tree = h.render();
  assert.equal(nodes(tree, n => n.type === 'select').length, 0);
  nodes(tree, n => n.props?.role === 'switch')[0].props.onClick(); tree = h.render();
  const select = nodes(tree, n => n.type === 'select')[0];
  assert.equal(select.props.children[0].props.children, 'Cairo');
  select.props.onChange({ target: { value: 'amiri' } });
  assert.equal(h.data.typography.nameFont, 'amiri'); assert.equal(h.data.typography.font, 'cairo');
  nodes(h.render(), n => n.props?.role === 'switch')[0].props.onClick();
  assert.equal(h.data.typography.nameFont, undefined);
  assert.equal(h.data.bio, 'نبذة');
});
test('layout and title colour preserve content and existing photo framing', () => {
  const h = harness(); let tree = h.render();
  nodes(tree, n => n.props?.role === 'radio' && n.key === 'large')[0].props.onClick();
  assert.equal(h.data.profileStyle.type, 'hero');
  nodes(tree, n => n.props?.type === 'color')[0].props.onChange({ target: { value: '#123456' } });
  assert.equal(h.data.customColors.nameColor, '#123456');
  assert.equal(h.data.name, 'اسم الحساب');
  assert.equal(h.data.bio, 'نبذة');
});
test('the real page renderer applies a title-only font independently of body text', () => {
  const { mergeWithDefaults } = load('src/app/context/PageContext.tsx');
  const { PageView } = load('src/app/components/PageView.tsx');
  const data = mergeWithDefaults({ name: 'عنوان', bio: 'نبذة', typography: { font: 'cairo', nameFont: 'amiri' } });
  const html = renderToStaticMarkup(React.createElement(PageView, { data, variant: 'public' }));
  assert.match(html, /<h1[^>]*font-family:Amiri, serif/);
  assert.match(html, /font-family:Cairo, sans-serif/);
  assert.equal(data.typography.font, 'cairo');
});


test('three plain families still reach every stored photo shape by its original identifier', () => {
  const h = harness();
  const radio = key => nodes(h.render(), n => n.props?.role === 'radio' && n.key === key)[0];
  assert.deepEqual(['small', 'large', 'cover'].map(key => Boolean(radio(key))), [true, true, true]);
  for (const [family, shapes] of [['small', ['circle', 'premium', 'rounded', 'square']], ['large', ['hero', 'hero_safe']], ['cover', ['banner']]]) {
    radio(family).props.onClick();
    assert.equal(h.data.profileStyle.type, shapes[0]);
    for (const shape of shapes.slice(1)) { radio(shape).props.onClick(); assert.equal(h.data.profileStyle.type, shape); }
    assert.equal(radio(family).props['aria-checked'], true);
  }
});
test('desktop controls move and zoom the existing photo within bounds', () => {
  const h = harness(false); h.data.profileImage = '/template-samples/mark.svg';
  const control = label => nodes(h.render(), n => n.props?.label === label)[0];
  control('أعلى / أسفل').props.onChange(45); assert.equal(h.data.profileStyle.positionY, 45);
  control('يمين / يسار').props.onChange(55); assert.equal(h.data.profileStyle.positionX, 55);
  const zoom = label => nodes(h.render(), n => n.props?.['aria-label'] === label)[0].props.onClick();
  zoom('تكبير الشعار'); assert.equal(h.data.profileStyle.zoom, 1.1);
  for (let i = 0; i < 30; i++) zoom('تصغير الشعار');
  assert.equal(h.data.profileStyle.zoom, .3);
});
test('desktop header retains its original photo controls while mobile styling stays isolated', () => {
  const desktop = harness(false); desktop.data.profileImage = '/template-samples/mark.svg';
  const tree = desktop.render();
  assert.equal(nodes(tree, n => n.props?.className === 'identity-editor').length, 0);
  assert.equal(nodes(tree, n => n.props?.className === 'identity-editor__layouts').length, 0);
  assert.equal(nodes(tree, n => n.props?.label === 'أعلى / أسفل').length, 1);
  assert.equal(nodes(tree, n => n.props?.label === 'يمين / يسار').length, 1);
  assert.equal(nodes(harness().render(), n => n.props?.className === 'identity-editor__layouts image-families').length, 1);
});
