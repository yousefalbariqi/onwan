const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/app/lib/vcard.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)(() => ({ pageUrl: name => `https://${name}.onwan.link` }), moduleUnderTest, moduleUnderTest.exports);
const { buildVCard, inlinePhoto } = moduleUnderTest.exports;
const page = { name: 'جمعية الأثر', username: 'athar', bio: '', contactPhone: '+966500000000', contactEmail: 'test@example.com' };

test('contact export embeds stored and inline WebP logos as PNG and retains contact data', async () => {
  const originals = Object.fromEntries(['fetch', 'FileReader', 'Image', 'document'].map(key => [key, global[key]]));
  let draws = 0;
  global.fetch = async () => ({ ok: true, blob: async () => ({ type: 'image/webp' }) });
  global.FileReader = class { readAsDataURL() { this.result = 'data:image/webp;base64,V0VCUA=='; this.onload(); } };
  global.Image = class { naturalWidth = 1024; naturalHeight = 512; async decode() {} };
  global.document = { createElement: () => ({ getContext: () => ({ drawImage: () => draws++ }), toDataURL: type => { assert.equal(type, 'image/png'); return 'data:image/png;base64,UE5H'; } }) };
  try {
    for (const profileImage of ['/media/files/owner/logo.webp', 'data:image/webp;base64,V0VCUA==']) {
      const prepared = await inlinePhoto({ ...page, profileImage });
      const card = buildVCard(prepared);
      assert.match(card, /PHOTO;ENCODING=b;TYPE=PNG:UE5H/);
      assert.match(card, /TEL;TYPE=CELL:\+966500000000/);
      assert.match(card, /EMAIL;TYPE=INTERNET:test@example.com/);
    }
    assert.equal(draws, 2);
    for (const type of ['png', 'jpeg']) {
      const input = { ...page, profileImage: `data:image/${type};base64,UE5H` };
      assert.equal((await inlinePhoto(input)).profileImage, input.profileImage);
    }
    assert.equal((await inlinePhoto({ ...page, profileImage: '' })).profileImage, '');
    global.fetch = async () => ({ ok: false });
    await assert.rejects(() => inlinePhoto({ ...page, profileImage: '/missing.webp' }));
    global.Image = class { async decode() { throw new Error('corrupt image'); } };
    await assert.rejects(() => inlinePhoto({ ...page, profileImage: 'data:image/webp;base64,broken' }));
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});
