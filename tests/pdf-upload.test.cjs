const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

test('REQ-001: PDF accepts 10 MB, rejects one byte above; images enforce 1,000 KB', async () => {
  let writes = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('api/media-upload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'crypto', code)(name => {
    if (name.includes('/auth')) return { getBearerToken: () => '', verifySessionToken: () => null };
    if (name.includes('/db')) return {};
    if (name.includes('/runtime')) return { getBinding: () => ({ head: async () => null, put: async () => { writes++; } }) };
    if (name.includes('/session')) return { requireUser: async () => ({ id: 'owner' }) };
    if (name.includes('/mediaUploadLimits')) return { beginMediaUpload: async () => 'event', storeLimitedUpload: async (media, owner, key, body, type) => media.put(key, body, { httpMetadata: { contentType: type } }) };
    if (name.includes('/fileSignatures')) { const m = { exports: {} }; new Function('module', 'exports', ts.transpileModule(fs.readFileSync('shared/fileSignatures.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(m, m.exports); return m.exports; }
    if (name.includes('/http')) return {
      allowMethods: () => true,
      HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } },
      sendJson: (res, status, data) => Object.assign(res, { status, data }),
      handleApiError: (res, error) => Object.assign(res, { status: error.status, data: error.message }),
    };
    throw new Error(name);
  }, module, module.exports, webcrypto);
  for (const [type, size, expected] of [
    ['application/pdf', 10 * 1024 * 1024, 200],
    ['application/pdf', 10 * 1024 * 1024 + 1, 413],
    ['image/png', 1_000_000, 200],
    ['image/png', 1_000_001, 413],
  ]) {
    const before = writes;
    const res = {};
    // REQ-017: bodies start like real files.
    const body = new Uint8Array(size);
    body.set(type === 'application/pdf' ? [0x25, 0x50, 0x44, 0x46, 0x2d] : [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await module.exports.default({ headers: { 'content-type': type }, arrayBuffer: async () => body.buffer }, res);
    assert.equal(res.status, expected);
    assert.equal(writes - before, expected === 200 ? 1 : 0);
  }
});
