const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('preview stays hidden until measured and ignores hidden-pane/invalid resize measurements', () => {
  const hooks = []; const layoutEffects = []; let cursor = 0, resize;
  const React = {
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useLayoutEffect(effect) { layoutEffects.push(effect); }, useEffect() {},
  };
  class ResizeObserver { constructor(callback) { resize = callback; } observe() {} disconnect() {} }
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/components/PhonePreview.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'ResizeObserver', code)(name => {
    if (name === 'react') return React;
    if (name === 'react-dom') return { createPortal: () => null };
    if (name === '../context/PageContext') return { usePageContext: () => ({ pageData: {} }) };
    if (name === './PageView') return { PageView: () => null };
    return require(name);
  }, module, module.exports, ResizeObserver);
  const render = () => { cursor = 0; const tree = module.exports.PhonePreview({}); return tree.props.children.props.children[0]; };
  assert.equal(render().props.style.visibility, 'hidden');
  assert.equal(render().props.style.transform, 'scale(0)');
  hooks[0].current = { clientWidth: 260 };
  const cleanup = layoutEffects[0]();
  assert.equal(render().props.style.transform, `scale(${260 / 390})`);
  for (const width of [0, NaN, Infinity, -1]) resize([{ contentRect: { width } }]);
  assert.equal(render().props.style.transform, `scale(${260 / 390})`);
  resize([{ contentRect: { width: 130 } }]);
  assert.equal(render().props.style.transform, `scale(${130 / 390})`);
  assert.equal(render().props.width, 390);
  assert.equal(render().props.height, 844);
  cleanup();
});
