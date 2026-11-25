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
  const effects = [];
  const hooks = { ...React, useEffect: effect => effects.push(effect), useState: initial => [state++ === 0 ? sandboxPrice(preview(), priceId) : initial, () => {}],
    useRef: value => ({ current: ref++ === 0 ? client : value }) };
  const Page = load('src/app/components/PaddleSandboxCheckout.tsx', {
    react: hooks, 'react-router': { Link: 'a', useNavigate: () => () => {} }, '@paddle/paddle-js': sdk,
  }).default;
  const tree = Page({ ready: true, email: 'test@example.com', features: [], retry() {}, saveDraft: async () => calls.push(['save']) });
  const html = renderToStaticMarkup(tree); assert.match(html, /\$57\.50/); assert.match(html, /لا تحصيل حقيقي/); assert.doesNotMatch(html, /190 ريال|انشر صفحتي/);
  assert.match(html, /onwan-paddle-payment/);
  effects[3](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], 'save'); assert.equal(calls[1][0], 'open');
  assert.deepEqual(calls[1][1].items, [{ priceId, quantity: 1 }]);
  assert.equal(calls[1][1].settings.variant, 'one-page'); assert.equal(calls[1][1].settings.displayMode, 'inline');
  assert.deepEqual(calls[1][1].settings.allowedPaymentMethods, ['apple_pay', 'card']);
  assert.equal(calls[1][1].settings.frameTarget, 'onwan-paddle-payment');
  assert.deepEqual(calls[1][1].customer, { email: 'test@example.com', address: { countryCode: 'SA' } });
  assert.equal(calls.length, 2);
});

test('a declined card asks for another test card, and completion clears the old failure without granting access', () => {
  let state = 0, listener;
  const updates = [];
  const helpers = { sandboxConfig, sandboxPrice, loadSandbox: async () => { throw Error('should not load without session'); },
    subscribeToSandbox: callback => { listener = callback; return () => {}; } };
  let ref = 0;
  const hooks = { ...React, useEffect: effect => effect(), useState: initial => { const index = state++; return [initial, value => updates.push([index, value])]; },
    useRef: value => ({ current: ref++ === 2 ? true : value }) };
  const Page = load('src/app/components/PaddleSandboxCheckout.tsx', { react: hooks,
    'react-router': { Link: 'a', useNavigate: () => () => {} }, '../lib/paddleSandbox': helpers }).default;
  Page({ ready: false, features: [], retry() {}, saveDraft: async () => {} });
  listener({ name: 'checkout.payment.failed' });
  assert.ok(updates.some(([index, value]) => index === 1 && /بطاقة اختبار أخرى/.test(value)));
  assert.ok(!updates.some(([, value]) => typeof value === 'string' && /إعدادات Sandbox/.test(value)));
  listener({ name: 'checkout.completed' });
  assert.ok(updates.some(([index, value]) => index === 1 && value === ''));
  assert.ok(updates.some(([index, value]) => index === 4 && value === true));
});
test('connected checkout uses only the server transaction and returns to server status, never client activation',async()=>{
  let state=0,ref=0,listener;const effects=[],calls=[],navigation=[];
  const client={Checkout:{open:options=>calls.push(['open',options])}};
  const helpers={sandboxConfig,sandboxPrice,loadSandbox:async()=>client,subscribeToSandbox:callback=>{listener=callback;return()=>{};}};
  const hooks={...React,useEffect:effect=>effects.push(effect),useState:initial=>[state++===0?sandboxPrice(preview(),priceId):initial,()=>{}],
    useRef:value=>({current:ref++===0?client:value})};
  const Page=load('src/app/components/PaddleSandboxCheckout.tsx',{react:hooks,'../lib/paddleSandbox':helpers,
    'react-router':{Link:'a',useNavigate:()=>path=>navigation.push(path)}}).default;
  const original=global.window;global.window={location:{origin:'https://sandbox.example.com'}};
  try {
    Page({ready:true,email:'test@example.com',features:[],retry(){},saveDraft:async()=>calls.push(['save']),
      prepareCheckout:async()=>{calls.push(['prepare']);return {orderId:'opaque-order',transactionId:'txn_from_server',priceId,state:'open'};}});
    effects[0]();effects[3]();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calls.map(([name])=>name),['save','prepare','open']);
    assert.equal(calls[2][1].transactionId,'txn_from_server');assert.equal(calls[2][1].items,undefined);
    assert.equal(calls[2][1].settings.successUrl,'https://sandbox.example.com/payment/success?order=opaque-order');
    listener({name:'checkout.completed'});assert.deepEqual(navigation,['/payment/success?order=opaque-order']);
  } finally {global.window=original;}
});
