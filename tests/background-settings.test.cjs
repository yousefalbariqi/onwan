const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(entry, mocks = {}, globals = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, external: ['react', 'react-dom', ...Object.keys(mocks)], define: { 'import.meta.env': '{}' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports, ...Object.values(globals));
  return module.exports;
}
function nodes(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  React.Children.forEach(node.props?.children, child => nodes(child, predicate, found)); return found;
}
function harness(wallpaper = { type: 'color', value: '#ffffff' }) {
  let cursor = 0, slots = [], data = { wallpaper, theme: { background: '#ffffff' }, extractedColors: ['#123456', 'invalid'] };
  const actions = [];
  const hooks = { ...React, useEffect() {}, useRef: value => slots[cursor++] ??= { current: value }, useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; } };
  const Component = load('src/app/components/BackgroundSettings.tsx', { react: hooks, '../context/PageContext': { usePageContext: () => ({ pageData: data, updateWallpaper: next => { actions.push(next); data = { ...data, wallpaper: next }; } }) } }).BackgroundSettings;
  return { actions, get data() { return data; }, render() { cursor = 0; return Component({}); } };
}
test('background exposes colour, gradient, photo and video tabs; browsing does not edit', () => {
  const h = harness(); let tree = h.render();
  const tabs = nodes(tree, n => n.props?.role === 'tab');
  assert.deepEqual(tabs.map(n => n.props.children[1]), ['لون', 'تدرج', 'صورة', 'فيديو']);
  assert.equal(nodes(tree, n => n.type === 'details').length, 0);
  tabs[2].props.onClick(); tree = h.render();
  assert.equal(nodes(tree, n => n.props?.role === 'tab' && n.props['aria-selected'])[0].props.id, 'background-tab-photo');
  assert.equal(h.actions.length, 0);
});
test('suggested/extracted and HEX selection update only the chosen background; incomplete HEX stays local', () => {
  const h = harness(); let tree = h.render();
  nodes(tree, n => n.props?.['aria-label'] === 'لون #123456')[0].props.onClick();
  assert.equal(h.data.wallpaper.value, '#123456');
  const hex = nodes(h.render(), n => n.props?.['aria-label'] === 'رمز لون الخلفية HEX')[0];
  hex.props.onChange({ target: { value: '#1' } }); assert.equal(h.actions.length, 1);
  hex.props.onChange({ target: { value: '#abcdef' } }); assert.equal(h.data.wallpaper.value, '#abcdef');
});
test('photo fitting and zoom operate on the real wallpaper fields without losing framing or source', () => {
  const h = harness({ type: 'image', value: 'https://example.test/photo.jpg', zoom: 1, positionX: 25, positionY: 30 });
  let tree = h.render();
  const options = nodes(tree, n => n.props?.['aria-label'] === 'ملاءمة صورة الخلفية')[0];
  options.props.children[1].props.onClick();
  assert.equal(h.data.wallpaper.fit, 'contain'); assert.equal(h.data.wallpaper.positionX, 25);
  nodes(h.render(), n => n.props?.['aria-label'] === 'تكبير خلفية الصورة')[0].props.onClick();
  assert.equal(h.data.wallpaper.zoom, 1.1); assert.equal(h.data.wallpaper.value, 'https://example.test/photo.jpg');
});
test('real wallpaper renderer supports contain and tile, retaining cover as the default', () => {
  const { WallpaperImage } = load('src/app/components/WallpaperImage.tsx');
  const render = fit => renderToStaticMarkup(React.createElement(WallpaperImage, { wallpaper: { type: 'image', value: 'https://example.test/a.jpg', fit } }));
  assert.match(render('contain'), /object-fit:contain/);
  assert.match(render('tile'), /background-repeat:repeat/);
  assert.match(render(undefined), /object-fit:cover/);
});
test('poster extraction chooses an actual video frame and times out rather than hanging', async () => {
  let video, timeout, cleared = false;
  const fakeDocument = { createElement: kind => kind === 'canvas' ? { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,frame' } : (video = { duration: 12, videoWidth: 100, videoHeight: 200, removeAttribute() {}, load() {} }) };
  const { captureFirstFrame } = load('src/app/components/VideoWallpaperEditor.tsx', {}, { document: fakeDocument, window: { setTimeout: fn => { timeout = fn; return 1; }, clearTimeout: () => { cleared = true; } } });
  const capture = captureFirstFrame('blob:local-video', 5);
  video.onloadeddata(); assert.equal(video.currentTime, 5);
  video.onseeked(); assert.equal(await capture, 'data:image/jpeg;base64,frame'); assert.equal(cleared, true);
  const stalled = captureFirstFrame('blob:stalled'); timeout(); assert.equal(await stalled, undefined);
});
