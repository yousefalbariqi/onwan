const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(file) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require','module','exports',code)(path => {
    if (path === './themePilot.js') return load('shared/themePilot.ts');
    if (path === '../lib/themePilot') return load('shared/themeLibrary.ts');
    throw Error(path);
  },m,m.exports);
  return m.exports;
}
const { LIBRARY_THEMES } = load('shared/themeLibrary.ts');
const { publishThemeLibrary } = load('src/app/admin/publishThemeLibrary.ts');
function server() {
  const rows = [{ id: 'owner-edit', name: 'أثر معدّل', status: 'draft', design: { ...LIBRARY_THEMES[1].design, customColors: { nameColor: '#123456' } } }];
  return { rows, async call(action, params) {
    if (action === 'templates.list') return { templates: rows.slice(params.offset, params.offset + 9), more: params.offset + 9 < rows.length };
    if (action === 'templates.save') { const template = { ...params, id: `id-${rows.length}`, status: 'draft' }; rows.push(template); return { template }; }
    if (action === 'templates.setStatus') { rows.find(t => t.id === params.id).status = params.status; return {}; }
    throw Error(action);
  } };
}
test('publish all 96, keep owner edits and do not duplicate on repeat', async () => {
  const s = server(); const progress = [];
  const result = await publishThemeLibrary(s.call, n => progress.push(n));
  assert.equal(result.added, 95); assert.equal(result.visible, 96);
  assert.equal(s.rows.length, 96); assert.ok(s.rows.every(t => t.status === 'visible'));
  assert.equal(s.rows[0].name, 'أثر معدّل'); assert.equal(s.rows[0].design.customColors.nameColor, '#123456');
  assert.equal(progress.at(-1), 96);
  assert.equal((await publishThemeLibrary(s.call, () => {})).added, 0);
  assert.equal(s.rows.length, 96);
});
test('a failed publish can resume without overwriting or duplicating already saved designs', async () => {
  const s = server(); let failed = false;
  await assert.rejects(publishThemeLibrary(async (action, params) => {
    if (!failed && action === 'templates.setStatus') { failed = true; throw Error('temporary'); }
    return s.call(action, params);
  }, () => {}), /temporary/);
  await publishThemeLibrary(s.call, () => {});
  assert.equal(s.rows.length, 96); assert.ok(s.rows.every(t => t.status === 'visible'));
});
