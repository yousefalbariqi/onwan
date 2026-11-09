const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', buildSync({ entryPoints: ['src/app/lib/editorPreview.ts'], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text)(moduleUnderTest, moduleUnderTest.exports);
const { editorPreview } = moduleUnderTest.exports;
test('unfinished form previews an existing link without modifying approved data', () => {
  const data = { links: [{ id: 'one', title: 'original', url: 'https://example.org', hidden: true }], editorForm: { screen: { name: 'form', id: 'one' }, form: { kind: 'link', title: 'typing now', url: '', platform: 'website', display: {} } } };
  const preview = editorPreview(data);
  assert.equal(preview.links[0].title, 'typing now'); assert.equal(preview.links[0].hidden, false);
  assert.equal(data.links[0].title, 'original'); assert.equal(data.links[0].hidden, true);
});
test('new incomplete content is visual-only and disappears when the form is removed', () => {
  const data = { links: [], editorForm: { screen: { name: 'form' }, form: { kind: 'file', title: 'my report', url: '', display: {} } } };
  assert.equal(editorPreview(data).links[0].url, '');
  assert.equal(editorPreview(data).links.length, 1); assert.equal(data.links.length, 0);
  assert.equal(editorPreview({ ...data, editorForm: undefined }).links.length, 0);
});
