const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', buildSync({ entryPoints: ['shared/contentNavigation.ts'], bundle: true, format: 'cjs', write: false }).outputFiles[0].text)(moduleUnderTest, moduleUnderTest.exports);
const { contentBack } = moduleUnderTest.exports;
test('a new content form goes back to the chooser, then the content list', () => {
  const first = contentBack({ name: 'form' });
  assert.deepEqual(first, { target: { name: 'choose' }, confirmDiscard: false });
  assert.deepEqual(contentBack(first.target), { target: { name: 'list' }, confirmDiscard: false });
});
test('unsaved new and existing forms require confirmation before discarding input', () => {
  assert.deepEqual(contentBack({ name: 'form' }, true), { target: { name: 'choose' }, confirmDiscard: true });
  assert.deepEqual(contentBack({ name: 'form', id: 'existing' }, true), { target: { name: 'list' }, confirmDiscard: true });
});
test('editing an existing item returns to its content list', () => {
  assert.deepEqual(contentBack({ name: 'form', id: 'existing' }), { target: { name: 'list' }, confirmDiscard: false });
});
