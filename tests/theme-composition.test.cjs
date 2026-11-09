const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(file, pool = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(path => {
    if (path === './themePilot.js' || path.endsWith('shared/themePilot.js')) return load('shared/themePilot.ts');
    if (path === './db.js') return { pool };
    if (path === './admin.js') return { audit: async () => {} };
    if (path === './http.js') return { HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } } };
    throw Error(path);
  }, m, m.exports);
  return m.exports;
}
const { PILOT_THEMES } = load('shared/themePilot.ts');
const { normalizeDesign } = load('api/_lib/pageTemplates.ts');

test('eight pilot designs survive server normalization with different compositions', () => {
  assert.equal(PILOT_THEMES.length, 8);
  assert.equal(new Set(PILOT_THEMES.map(t => t.name)).size, 8);
  const compositions = new Set();
  for (const theme of PILOT_THEMES) {
    const design = normalizeDesign(theme.design);
    assert.deepEqual(design.buttonStyle.composition, theme.design.buttonStyle.composition);
    assert.equal(design.theme.id, theme.design.theme.id);
    assert.equal(design.links, undefined);
    assert.equal(design.name, undefined);
    compositions.add(JSON.stringify(design.buttonStyle.composition));
  }
  assert.equal(compositions.size, 8);
  assert.ok(new Set(PILOT_THEMES.map(t => t.design.typography.font)).size >= 4);
});

test('unknown composition values are dropped and existing designs still normalize', () => {
  const seed = structuredClone(PILOT_THEMES[0].design);
  seed.buttonStyle.composition = { align: 'absolute', width: '10000px', items: 'tiles', unsafe: 'x' };
  assert.deepEqual(normalizeDesign(seed).buttonStyle.composition, { items: 'tiles' });
  delete seed.buttonStyle.composition;
  assert.deepEqual(normalizeDesign(seed).buttonStyle.composition, {});
});

test('installing the review library twice keeps eight drafts without overwriting edits', async () => {
  const saved = new Map(); let release = 0;
  const client = { async query(sql, params) {
    if (sql.startsWith('select id from page_templates')) return { rows: saved.has(params[0]) ? [{ id: params[0] }] : [] };
    if (sql.startsWith('insert into page_templates')) {
      assert.ok(sql.includes("'draft'"));
      const design = JSON.parse(params[2]); saved.set(design.theme.id, { name: params[0], design });
    }
    return { rows: [] };
  }, release() { release++; } };
  const { templateAdminHandlers } = load('api/_lib/pageTemplates.ts', { connect: async () => client });
  const handler = templateAdminHandlers['templates.installPilot'];
  assert.equal(handler.access, 'manager');
  assert.equal((await handler.run({}, {})).added, 8);
  saved.get('pilot-1').name = 'تعديل المدير';
  assert.equal((await handler.run({}, {})).added, 0);
  assert.equal(saved.size, 8); assert.equal(saved.get('pilot-1').name, 'تعديل المدير');
  assert.equal(release, 2);
});


test('complete library has twelve categories with eight unique designs each', () => {
  const { LIBRARY_THEMES, THEME_CATEGORIES } = load('shared/themeLibrary.ts');
  assert.equal(LIBRARY_THEMES.length, 96);
  assert.equal(new Set(LIBRARY_THEMES.map(t => t.design.theme.id)).size, 96);
  assert.equal(new Set(LIBRARY_THEMES.map(t => t.name)).size, 96);
  for (const [category] of THEME_CATEGORIES) assert.equal(LIBRARY_THEMES.filter(t => t.category === category).length, 8);
  const signatures = new Set();
  for (const theme of LIBRARY_THEMES) {
    const design = normalizeDesign(theme.design);
    assert.deepEqual(design.buttonStyle.composition, theme.design.buttonStyle.composition);
    signatures.add(JSON.stringify([design.buttonStyle, design.profileStyle, design.typography]));
    assert.equal(design.links, undefined);
  }
  assert.equal(signatures.size, 96, 'designs remain distinct after removing palette colors');
});

test('library text and button palettes have readable contrast', () => {
  const { LIBRARY_THEMES } = load('shared/themeLibrary.ts');
  const lum = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  for (const t of LIBRARY_THEMES) {
    assert.ok(contrast(t.design.theme.textColor,t.design.theme.background)>=4.5, `${t.name}: page text`);
    const a = t.design.theme;
    assert.ok(contrast(t.design.buttonStyle.border ? a.buttonColor : a.buttonTextColor, t.design.buttonStyle.border ? a.background : a.buttonColor)>=4.5, `${t.name}: button text`);
  }
});
