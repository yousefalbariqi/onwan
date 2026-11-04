const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', ...Object.keys(globals), code)(module, module.exports, ...Object.values(globals));
  return module.exports;
}
test('wallpaper variants share a decode and aspect ratio with a bounded thumbnail', async () => {
  const outputs = []; let decodes = 0;
  class Image { naturalWidth = 4000; naturalHeight = 2000; async decode() { decodes++; } }
  const document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: (type, quality) => {
      outputs.push({ width: canvas.width, height: canvas.height, type, quality }); return `data:${type};base64,${canvas.width}`;
    } }; return canvas;
  } };
  const { createWallpaperVariants } = load('src/app/lib/wallpaperVariants.ts', { Image, document });
  const result = await createWallpaperVariants('data:image/jpeg;base64,source');
  assert.equal(decodes, 1);
  assert.deepEqual(outputs, [{ width: 1600, height: 800, type: 'image/webp', quality: .86 }, { width: 64, height: 32, type: 'image/webp', quality: .25 }]);
  assert.notEqual(result.value, result.preview);
});
test('invalid images fail before creating a background', async () => {
  const { createWallpaperVariants } = load('src/app/lib/wallpaperVariants.ts', { Image: class { async decode() { throw new Error('bad image'); } } });
  await assert.rejects(createWallpaperVariants('bad'), /تعذّر فتح الصورة/);
});
test('draft transfer retains and restores the lightweight background reference', () => {
  const { slimPageData, expandPageData, KEPT } = load('shared/pageTransfer.ts');
  const page = { wallpaper: { type: 'image', value: 'data:image/webp;base64,FULL', preview: 'data:image/webp;base64,SMALL' } };
  const slim = slimPageData(page, page);
  assert.equal(slim.wallpaper.preview, KEPT);
  assert.deepEqual(expandPageData(slim, page), page);
  assert.equal(expandPageData(slim, { wallpaper: { value: page.wallpaper.value } }), null);
});

test('saving stores both wallpaper versions and retries a failed thumbnail without duplicating the full upload', async () => {
  const uploads = [];
  let failPreview = true;
  const full = 'data:image/webp;base64,FULL';
  const preview = 'data:image/webp;base64,SMALL';
  const fullUrl = '/media/files/owner/' + 'a'.repeat(64) + '.webp';
  const previewUrl = '/media/files/owner/' + 'b'.repeat(64) + '.webp';
  const fetch = async (url, options) => {
    if (url.startsWith('data:')) return { blob: async () => ({ type: 'image/webp', size: 100, id: url }) };
    uploads.push(options.body.id);
    const failed = failPreview && options.body.id === preview;
    return { ok: !failed, json: async () => failed ? { error: 'preview failed' } : { url: options.body.id === full ? fullUrl : previewUrl } };
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/lib/mediaUpload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'fetch', code)(() => ({ getSessionToken: () => 'owner-token' }), module, module.exports, fetch);
  const page = { wallpaper: { type: 'image', value: full, preview, zoom: 1.7, positionX: 20 }, links: [] };
  await assert.rejects(module.exports.moveInlineMedia(page), /preview failed/);
  assert.equal(page.wallpaper.preview, preview);
  failPreview = false;
  const stored = await module.exports.moveInlineMedia(page);
  assert.equal(stored.wallpaper.value, fullUrl);
  assert.equal(stored.wallpaper.preview, previewUrl);
  assert.equal(stored.wallpaper.zoom, 1.7);
  assert.equal(uploads.filter(value => value === full).length, 1);
  assert.equal(uploads.filter(value => value === preview).length, 2);
});
