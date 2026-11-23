const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
function load(entry, external = []) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, external });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(name => name.includes('/db') ? { pool: {} } : require(name), module, module.exports);
  return module.exports;
}
const links = load('src/app/lib/linkSuggestions.ts');
const VALID = /^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
test('email gives a personal name or company domain, never a role word or government name', () => {
  assert.equal(links.linkFromEmail('Yousef.Ali+x@gmail.com'), 'yousef-ali');
  assert.equal(links.linkFromEmail('info@albaraka.sa'), 'albaraka');
  assert.equal(links.linkFromEmail('me@albaraka.com.sa'), 'albaraka');
  assert.equal(links.linkFromEmail('info@gmail.com'), '');
  assert.equal(links.linkFromEmail('person@ministry.gov.sa'), '');
});
test('alternatives are valid, unique and within the length limit', () => {
  const list = links.linkCandidates('a'.repeat(30), 'owner@gmail.com', 'taken');
  assert.ok(list.length >= 3); assert.equal(new Set(list).size, list.length);
  assert.ok(list.every(item => VALID.test(item)));
  assert.ok(!list.includes('a'.repeat(30)));
});
test('a reserved name gets no look-alike variants', () => {
  assert.deepEqual(links.linkCandidates('protected', 'owner@gmail.com', 'reserved'), ['owner', 'owner-sa']);
  assert.deepEqual(links.linkCandidates('protected', 'info@gmail.com', 'reserved'), []);
});
test('only free names are offered and checking stops at three', async () => {
  const checked = [];
  const found = await links.findAvailableLinks(['a', 'b', 'c', 'd', 'e'], async name => { checked.push(name); return { available: name !== 'b' }; });
  assert.deepEqual(found, ['a', 'c', 'd']); assert.deepEqual(checked, ['a', 'b', 'c', 'd']);
});
test('a name added to the reserved table is refused by the server', async () => {
  const { getUsernameAvailability } = load('api/_lib/username.ts', ['./db.js']);
  const result = await getUsernameAvailability('protected', {}, { query: async sql => ({ rowCount: sql.includes('reserved_usernames') ? 1 : 0 }) });
  assert.equal(result.available, false); assert.equal(result.status, 'reserved'); assert.equal(result.reason, 'هذا الاسم محجوز.');
});
