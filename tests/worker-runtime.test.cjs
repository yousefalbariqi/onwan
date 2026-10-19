const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const startWorker = options => new Miniflare(convertV4MiniflareOptions(options));
const { build } = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('production Worker bundle loads in workerd and routes API before assets', async () => {
  const mf = startWorker({
    modules: true, scriptPath: path.resolve('.worker-build/index.js'),
    compatibilityDate: '2026-10-19', compatibilityFlags: ['nodejs_compat'],
    bindings: { ROOT_DOMAIN: 'onwan.link', SESSION_SECRET: 'runtime-test-only' },
    serviceBindings: { ASSETS: async req => new Response(`<html>${new URL(req.url).pathname}</html>`, { headers: { 'Content-Type': 'text/html' } }) },
  });
  try {
    assert.equal((await mf.dispatchFetch('https://onwan.link/api/page/me')).status, 401);
    const response = await mf.dispatchFetch('https://onwan.link/api/nope', { headers: { 'Sec-Fetch-Mode': 'navigate' } });
    assert.equal(response.status, 404); assert.match(response.headers.get('Content-Type'), /json/);
    assert.match(await (await mf.dispatchFetch('https://onwan.link/builder')).text(), /<html>\/builder/);
    assert.equal((await mf.dispatchFetch('https://onwan.link/api/username/check?username=INVALID!')).status, 200);
    assert.equal((await mf.dispatchFetch('https://onwan.link/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: 'bad' }) })).status, 400);
  } finally { await mf.dispose(); }
});

test('workerd supports existing password hashes, sessions and request env isolation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onwan-runtime-test-'));
  const outfile = path.join(dir, 'crypto.js');
  await build({
    stdin: { contents: `
      import { hashPassword, verifyPassword } from './api/_lib/password.ts';
      import { createSessionToken, verifySessionToken } from './api/_lib/auth.ts';
      import { withRuntime, getEnv } from './api/_lib/runtime.ts';
      export default { async fetch(request, env) {
        return withRuntime({env}, async () => {
          const hash = hashPassword('runtime-test-password');
          const signed = createSessionToken('id', 'runtime@example.org', 'staff');
          await scheduler.wait(1);
          return Response.json({password:verifyPassword('runtime-test-password', hash), wrong:verifyPassword('wrong', hash), kind:verifySessionToken(signed).kind, secret:getEnv('SESSION_SECRET') === env.SESSION_SECRET});
        });
      }};
    `, resolveDir: process.cwd(), sourcefile: 'runtime-test.ts' },
    outfile, bundle: true, format: 'esm', platform: 'neutral', external: ['node:crypto', 'node:async_hooks'],
  });
  const mf = startWorker({ modules: true, modulesRoot: dir, scriptPath: outfile, compatibilityDate: '2026-10-19', compatibilityFlags: ['nodejs_compat'], bindings: { SESSION_SECRET: 'runtime-test-only' } });
  try {
    const response = await mf.dispatchFetch('https://onwan.link/');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { password: true, wrong: false, kind: 'staff', secret: true });
  } finally { await mf.dispose(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real dist assets serve landing and SPA routes while API navigation stays JSON', async () => {
  const mf = startWorker({
    modules: true, scriptPath: path.resolve('.worker-build/index.js'),
    compatibilityDate: '2026-10-19', compatibilityFlags: ['nodejs_compat'],
    bindings: { ROOT_DOMAIN: 'onwan.link', SESSION_SECRET: 'runtime-test-only' },
    assets: { directory: path.resolve('dist'), binding: 'ASSETS', run_worker_first: true, routerConfig: { has_user_worker: true }, assetConfig: { not_found_handling: 'single-page-application' } },
  });
  try {
    const navigate = { headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' } };
    for (const route of ['/', '/builder', '/admin', '/partner', '/df']) {
      const response = await mf.dispatchFetch(`https://onwan.link${route}`, navigate);
      const html = await response.text(); assert.equal(response.status, 200, `${route}: ${html}`); assert.match(html, /id="root"/, route);
    }
    const missing = await mf.dispatchFetch('https://onwan.link/api/nope', navigate);
    assert.equal(missing.status, 404); assert.match(missing.headers.get('Content-Type'), /json/);
    const js = fs.readdirSync('dist/assets').find(name => /^index-.*\.js$/.test(name));
    const asset = await mf.dispatchFetch(`https://onwan.link/assets/${js}`);
    assert.equal(asset.status, 200); assert.match(asset.headers.get('Content-Type'), /javascript/);
  } finally { await mf.dispose(); }
});
