const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const priceId = 'pri_01m84e49p285hp3x0zakankrff';
const env = { VITE_PADDLE_SANDBOX_ENABLED: 'true', VITE_PADDLE_ENVIRONMENT: 'sandbox', VITE_PADDLE_CLIENT_TOKEN: 'test_example', VITE_PADDLE_PRICE_ID: priceId };
function load(entry, mocks = {}) {
  const { outputFiles } = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    external: ['react', 'react-router', '@paddle/paddle-js', ...Object.keys(mocks)], define: { 'import.meta.env': JSON.stringify(env) } });
  const module = { exports: {} }; new Function('require', 'module', 'exports', outputFiles[0].text)(name => mocks[name] ?? require(name), module, module.exports); return module.exports;
}
const sdk = { initializePaddle: async () => ({}) };
const { sandboxConfig, sandboxPrice, paddleSandboxRequested } = load('src/app/lib/paddleSandbox.ts', { '@paddle/paddle-js': sdk });
function preview() { return { data: { currencyCode: 'USD', address: { countryCode: 'SA', postalCode: null }, details: { lineItems: [{
  price: { id: priceId, status: 'active', billingCycle: { interval: 'year', frequency: 1 }, trialPeriod: null }, quantity: 1,
  formattedTotals: { total: '$57.50', tax: '$7.50' },
}] } } }; }
test('sandbox is explicitly opt-in and refuses missing, live or malformed configuration', () => {
  assert.equal(paddleSandboxRequested({}), false); assert.equal(paddleSandboxRequested(env), true);
  assert.equal(sandboxConfig(env).environment, 'sandbox');
  for (const bad of [{ ...env, VITE_PADDLE_ENVIRONMENT: '' }, { ...env, VITE_PADDLE_ENVIRONMENT: 'production' },
    { ...env, VITE_PADDLE_CLIENT_TOKEN: 'live_example' }, { ...env, VITE_PADDLE_PRICE_ID: 'forged' }]) assert.throws(() => sandboxConfig(bad));
});
test('shows Paddle formatted totals verbatim, retains preview location, and rejects a different product frequency or trial', () => {
  assert.deepEqual(sandboxPrice(preview(), priceId), { total: '$57.50', tax: '$7.50', currency: 'USD', address: { countryCode: 'SA' } });
  for (const change of [p => p.price.id = 'other', p => p.price.billingCycle.interval = 'month', p => p.price.status = 'archived',
    p => p.price.trialPeriod = { interval: 'day', frequency: 7 }, p => p.quantity = 2, p => p.formattedTotals.total = '']) {
    const data = preview(); change(data.data.details.lineItems[0]); assert.throws(() => sandboxPrice(data, priceId));
  }
  const unknown = preview(); unknown.data.address = null; assert.equal(sandboxPrice(unknown, priceId).address, undefined);
});
test('checkout saves the draft then opens the exact annual price, prefills the user and never provisions', async () => {
  const calls = []; const client = { Checkout: { open: options => calls.push(['open', options]) } };
  let state = 0, ref = 0;
  const hooks = { ...React, useEffect() {}, useState: initial => [state++ === 0 ? sandboxPrice(preview(), priceId) : initial, () => {}],
    useRef: value => ({ current: ref++ === 0 ? client : value }) };
  const Page = load('src/app/components/PaddleSandboxCheckout.tsx', {
    react: hooks, 'react-router': { Link: 'a', useNavigate: () => () => {} }, '@paddle/paddle-js': sdk,
  }).default;
  const tree = Page({ ready: true, email: 'test@example.com', features: [], retry() {}, saveDraft: async () => calls.push(['save']) });
  const html = renderToStaticMarkup(tree); assert.match(html, /\$57\.50/); assert.match(html, /لا تحصيل حقيقي/); assert.doesNotMatch(html, /190 ريال|انشر صفحتي/);
  function find(node) { if (!node || typeof node !== 'object') return; if (node.props?.className === 'subscription-checkout__pay') return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = find(child); if (found) return found; } }
  find(tree).props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], 'save'); assert.equal(calls[1][0], 'open');
  assert.deepEqual(calls[1][1].items, [{ priceId, quantity: 1 }]);
  assert.equal(calls[1][1].settings.variant, 'one-page'); assert.equal(calls[1][1].settings.displayMode, 'overlay');
  assert.deepEqual(calls[1][1].customer, { email: 'test@example.com', address: { countryCode: 'SA' } });
  assert.equal(calls.length, 2);
});
