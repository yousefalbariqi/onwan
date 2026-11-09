const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
function load(file, external = []) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external }).outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { applyTextStyle, editTextFormat, normalizeTextFormat } = load('shared/textFormatting.ts');
test('formatting affects only selected characters and toggles independently', () => {
  let format = applyTextStyle('مرحبا بالعالم', undefined, 0, 5, 'bold');
  assert.deepEqual(format, [{ start: 0, end: 5, bold: true }]);
  format = applyTextStyle('مرحبا بالعالم', format, 2, 4, 'italic');
  assert.deepEqual(format, [{ start: 0, end: 2, bold: true }, { start: 2, end: 4, bold: true, italic: true }, { start: 4, end: 5, bold: true }]);
  format = applyTextStyle('مرحبا بالعالم', format, 0, 5, 'bold');
  assert.deepEqual(format, [{ start: 2, end: 4, italic: true }]);
});
test('paragraph alignment does not alter other paragraphs', () => {
  assert.deepEqual(applyTextStyle('أول\nثان\nثالث', undefined, 4, 6, 'align', 'center'), [{ start: 4, end: 7, align: 'center' }]);
});
test('inserting and deleting text adjusts existing selections without changing plain text', () => {
  const format = [{ start: 2, end: 4, underline: true }];
  assert.deepEqual(editTextFormat('abcdef', 'Xabcdef', format), [{ start: 3, end: 5, underline: true }]);
  assert.deepEqual(editTextFormat('abcdef', 'abef', format), []);
  assert.deepEqual(editTextFormat('plain', 'plain more'), []);
});
test('normalization allows only bounded supported styles', () => {
  assert.deepEqual(normalizeTextFormat([{ start: -1, end: 9000, bold: true, align: 'javascript:', color: 'red' }, { start: 0.1, end: 2, italic: true }], 4), [{ start: 0, end: 4, bold: true }]);
});
test('rendering preserves legacy text and safely renders marks in the published component', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { FormattedText } = load('src/app/components/FormattedText.tsx', ['react', 'react/jsx-runtime']);
  assert.equal(renderToStaticMarkup(React.createElement(FormattedText, { text: 'نص قديم\nبلا تنسيق' })), 'نص قديم\nبلا تنسيق');
  const html = renderToStaticMarkup(React.createElement(FormattedText, { text: '<script>hello', format: [{ start: 8, end: 13, bold: true, italic: true, underline: true }] }));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('font-weight:700')); assert.ok(html.includes('font-style:italic')); assert.ok(html.includes('text-decoration:underline'));
});
