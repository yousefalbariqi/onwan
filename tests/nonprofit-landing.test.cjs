const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSync, buildSync } = require('esbuild');
const fs = require('node:fs');
function site(host) {
  const module = { exports: {} };
  const { code } = transformSync(fs.readFileSync('src/app/lib/site.ts', 'utf8'), { loader: 'ts', format: 'cjs', define: { 'import.meta.env.VITE_ROOT_DOMAIN': '"onwan.link"', 'import.meta.env.VITE_SUPPORT_WHATSAPP': '""' } });
  new Function('module', 'exports', 'window', code)(module, module.exports, { location: { hostname: host } });
  return module.exports;
}
test('nonprofit is a platform host; existing customer and custom-domain detection is preserved', () => {
  assert.equal(site('nonprofit.onwan.link').isNonprofitHost(), true);
  assert.equal(site('nonprofit.onwan.link').getSubdomainUsername(), null);
  assert.equal(site('nonprofit.onwan.link').getCustomHost(), null);
  assert.equal(site('customer.onwan.link').getSubdomainUsername(), 'customer');
  assert.equal(site('customer.onwan.link').isNonprofitHost(), false);
  assert.equal(site('charity.example').getCustomHost(), 'charity.example');
  assert.equal(site('onwan.link').getSubdomainUsername(), null);
});
test('association landing offers signup and login without checkout or publishing', () => {
  const { outputFiles } = buildSync({ entryPoints: ['src/app/pages/NonprofitLanding.tsx'], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', external: ['react', 'react-dom/server', 'react-router'], define: { 'import.meta.env.VITE_ROOT_DOMAIN': '"onwan.link"', 'import.meta.env.VITE_SUPPORT_WHATSAPP': '""' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports);
  const React = require('react');
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(require('react-router').MemoryRouter, null, React.createElement(module.exports.default)));
  assert.match(html, /للجمعيات الأهلية/);
  assert.doesNotMatch(html, /id="features"|id="journey"/);
  assert.match(html, /href="\/nonprofit\/signup"/);
  assert.match(html, /href="\/nonprofit\/login"/);
  assert.doesNotMatch(html, /href="[^"]*(payment|plan-selection)/);
  assert.match(html, /النشر بعد الاتفاق/);
});
