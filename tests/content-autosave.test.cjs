const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');

async function editor(initialData = { links: [] }) {
  let slots = [], cursor = 0, effects = [], dirty = true, tree, nextId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const context = {
    pageData: initialData, draftState: 'saved',
    updatePageData(changes) { context.pageData = { ...context.pageData, ...changes }; dirty = true; },
    addLink(values) { const id = `item-${++nextId}`; context.updatePageData({ links: [...context.pageData.links, { ...values, id }] }); return id; },
    updateLink(id, values) { context.updatePageData({ links: context.pageData.links.map(item => item.id === id ? { ...item, ...values } : item) }); },
  };
  const source = fs.readFileSync('src/app/components/LinkEditor.tsx', 'utf8');
  const stubs = new Map();
  for (const match of source.matchAll(/import\s*{([^}]+)}\s*from\s*'([^']+)'/g)) {
    const [, names, path] = match;
    if (path.startsWith('../../../shared/') || path === 'react' || path === 'react-dom' || path.includes('context/PageContext')) continue;
    stubs.set(path, names.split(',').map(name => name.trim()).filter(name => name && !name.startsWith('type ')).map(name => {
      const value = name === 'MAX_LINKS' ? '30' : ['SOCIAL_PLATFORMS', 'LINK_ICONS'].includes(name) ? '[]' : name === 'OFFICIAL_DOCUMENT_ICON' ? "''" : '()=>null';
      return `export const ${name}=${value};`;
    }).join('\n'));
  }
  const jsx = (type, props) => ({ type, props });
  const sandbox = { __react: react, __context: context, __jsx: { jsx, jsxs: jsx }, module: { exports: {} }, console, crypto, URL, window: { matchMedia: () => ({ matches: true }), addEventListener() {}, removeEventListener() {} } };
  sandbox.globalThis = sandbox;
  const built = await build({ entryPoints: ['src/app/components/LinkEditor.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (stubs.has(args.path) || ['react', 'react/jsx-runtime', 'react-dom'].includes(args.path) || args.path.includes('context/PageContext')) return { path: args.path, namespace: 'mock' };
    });
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: stubs.get(path) ?? (path === 'react' ? 'module.exports=globalThis.__react' : path === 'react/jsx-runtime' ? 'module.exports=globalThis.__jsx' : path === 'react-dom' ? 'export const flushSync=fn=>fn();' : 'export const usePageContext=()=>globalThis.__context;'), loader: 'js' }));
  } }] });
  vm.runInNewContext(built.outputFiles[0].text, sandbox);
  function flush() {
    for (let i = 0; i < 30; i++) {
      if (dirty) { dirty = false; cursor = 0; tree = sandbox.module.exports.LinkEditor({ draftSave: true, externalSave: true }); }
      const pending = effects.splice(0); pending.forEach(fn => fn());
      if (!dirty && !effects.length) return;
    }
    assert.fail('content editor did not settle');
  }
  function walk(node) { return !node ? [] : Array.isArray(node) ? node.flatMap(walk) : typeof node === 'object' ? [node, ...walk(node.props?.children)] : []; }
  const nodes = () => walk(tree);
  function text(node) { return !node ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node); }
  function click(label) { const node = nodes().find(node => node.type === 'button' && text(node).includes(label)); assert.ok(node, label); node.props.onClick(); flush(); }
  flush();
  return { context, flush, click, nodes };
}

test('valid content is applied automatically, edited without duplicates, and back needs no discard confirmation', async () => {
  const e = await editor();
  e.click('إضافة محتوى'); e.click('رابط');
  const input = e.nodes().find(node => node.type === 'input' && node.props.dir === 'ltr');
  assert.ok(input, 'link input');
  input.props.onChange({ target: { value: 'https://wa.me/966557757272' } }); e.flush();
  assert.equal(e.context.pageData.links.length, 1);
  assert.equal(e.context.pageData.links[0].url, 'https://wa.me/966557757272');
  assert.equal(e.context.pageData.editorForm, undefined);
  const current = e.nodes().find(node => node.type === 'input' && node.props.dir === 'ltr');
  current.props.onChange({ target: { value: 'https://wa.me/966557757273' } }); e.flush();
  assert.equal(e.context.pageData.links.length, 1);
  assert.equal(e.context.pageData.links[0].url, 'https://wa.me/966557757273');
  e.click('رجوع');
  assert.equal(e.nodes().some(node => node.props?.title === 'تجاهل ما كتبته؟'), false);
});

test('incomplete input stays recoverable and keeps the id of its previously valid item', async () => {
  const e = await editor(); e.click('إضافة محتوى'); e.click('رابط');
  const input = () => e.nodes().find(node => node.type === 'input' && node.props.dir === 'ltr');
  input().props.onChange({ target: { value: 'https://wa.me/966557757272' } }); e.flush();
  const id = e.context.pageData.links[0].id;
  input().props.onChange({ target: { value: '05' } }); e.flush();
  assert.equal(e.context.pageData.editorForm.rawLink, '05');
  assert.equal(e.context.pageData.editorForm.screen.id, id);
  assert.equal(e.context.pageData.links.length, 1);
  e.click('رجوع');
  assert.equal(e.context.pageData.editorForm.rawLink, '05');
  assert.equal(e.nodes().some(node => node.props?.title === 'تجاهل ما كتبته؟'), false);
});

test('restoring an incomplete draft continues the same item instead of adding another', async () => {
  const e = await editor(); e.click('إضافة محتوى'); e.click('رابط');
  const input = state => state.nodes().find(node => node.type === 'input' && node.props.dir === 'ltr');
  input(e).props.onChange({ target: { value: 'https://wa.me/966557757272' } }); e.flush();
  const id = e.context.pageData.links[0].id;
  input(e).props.onChange({ target: { value: '05' } }); e.flush();
  const restored = await editor(JSON.parse(JSON.stringify(e.context.pageData)));
  input(restored).props.onChange({ target: { value: 'https://wa.me/966557757274' } }); restored.flush();
  assert.equal(restored.context.pageData.links.length, 1);
  assert.equal(restored.context.pageData.links[0].id, id);
  assert.equal(restored.context.pageData.links[0].url, 'https://wa.me/966557757274');
  assert.equal(restored.context.pageData.editorForm, undefined);
});
