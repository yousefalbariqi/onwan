const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function renderer(transparent) {
  const hooks = []; const effects = []; let cursor = 0;
  const React = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], next => { hooks[i] = next; }]; },
    useEffect(effect) { effects.push(effect); },
  };
  class Image {
    naturalWidth = 1710; naturalHeight = 486;
    set src(value) { this.onload(); }
  }
  const document = { createElement: () => {
    const canvas = { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,TRIMMED' };
    canvas.getContext = () => ({ drawImage() {}, getImageData() {
      const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) data[(y * canvas.width + x) * 4 + 3] = transparent && y >= canvas.height - 3 ? 0 : 255;
      return { data };
    } });
    return canvas;
  } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/components/ProfileImageDisplay.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'Image', 'document', code)(name => {
    if (name === 'react') return React;
    if (name === 'lucide-react') return { User: () => null };
    return require(name);
  }, module, module.exports, Image, document);
  return {
    render(type, src = 'logo.png') { cursor = 0; return module.exports.ProfileImageDisplay({ profileImage: src, name: 'جمعية يعمر', textColor: '#111', profileStyle: { type, zoom: 1, fit: 'contain' } }); },
    load() { effects[0](); },
  };
}

test('transparent logos retain the original hero height and manual positioning', () => {
  for (const type of ['hero', 'hero_safe']) {
    const view = renderer(true);
    view.render(type); view.load();
    const result = view.render(type);
    assert.ok(result.props.className.includes('min-h-[340px]'));
    assert.ok(result.props.className.includes('sm:min-h-[400px]'));
    assert.equal(result.props['data-logo-layout'], undefined);
  }
});

test('opaque photos and explicitly framed logos retain their selected layout', () => {
  const photo = renderer(false);
  photo.render('hero'); photo.load();
  assert.ok(photo.render('hero').props.className.includes('min-h-[340px]'));
  const framed = renderer(true);
  framed.render('circle'); framed.load();
  assert.equal(framed.render('circle').props['data-logo-layout'], undefined);
  assert.ok(framed.render('circle').props.className.includes('rounded-full'));
});
