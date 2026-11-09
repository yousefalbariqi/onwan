const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const state = { pageData: { name: 'جمعية اختبار', username: 'association', profileImage: '', extractedColors: [], theme: { buttonColor: '#ff6b2c' } }, account: { kind: 'nonprofit', pageStatus: 'published', emailVerified: true, nameFixed: true, email: 'owner@example.test', phone: '0500000000' } };
async function component(file, navigator = {}) {
  const mocks = {
    PageContext: 'export const usePageContext=()=>__state;',
    site: "export const isNonprofitHost=()=>true; export const pageUrl=name=>'https://'+name+'.example.test',pageHost=name=>name+'.example.test';",
    api: 'export const requestGoogleWalletLink=async()=>{throw Error("unexpected request")}; export const requestWalletPassLink=async()=>{throw Error("unexpected request")},accountCall=async()=>{},nonprofitCall=async()=>{},sendSupportRequest=async()=>{};',
    walletArtwork: 'export const prepareWalletArtwork=async()=>{},renderWalletBanner=async()=>{};',
    vcard: 'export const downloadVCard=async()=>{};',
    AccountServices: 'export const AccountSecurity=()=>null,VisitsPage=()=>null,CHANGE_LABELS={},useOverview=()=>({overview:null});',
    EmailVerifyChip: 'export const EmailVerifyChip=()=>null;',
    dialog: 'export const Dialog=({children})=>children,DialogContent=Dialog,DialogTitle=Dialog,DialogTrigger=Dialog;',
  };
  const result = await build({ entryPoints: [file], bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic', external: ['react', 'react/jsx-runtime'], plugins: [{ name: 'connected-boundaries', setup(b) {
    b.onResolve({ filter: /\/(PageContext|site|api|walletArtwork|vcard|AccountServices|EmailVerifyChip|dialog)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
  } }] });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__state', 'navigator', result.outputFiles[0].text)(require, module, module.exports, state, navigator);
  return module.exports;
}
test('sharing starts with useful actions and hides wallet design behind disclosure', async () => {
  const { SharingPanel } = await component('src/app/components/QRCodeDisplay.tsx');
  const html = renderToStaticMarkup(React.createElement(SharingPanel, { username: 'association' }));
  for (const label of ['نسخ الرابط', 'رمز QR', 'تحميل PNG', 'إضافة إلى Apple Wallet', 'حفظ جهة الاتصال']) assert.ok(html.includes(label));
  assert.equal((html.match(/<details/g) || []).length, 2);
  assert.ok(!/<details[^>]*\sopen/.test(html));
  assert.ok(!html.includes('معاينة بطاقة المحفظة'));
  assert.ok(html.includes('Google Wallet'));
  assert.ok(html.includes('aria-label="إضافة إلى Google Wallet"'));
  assert.ok(!html.includes('قريبًا'));
  assert.ok(!html.includes('الاسم المختصر'));
  assert.ok(!html.includes('type="file"'));
});
test('native share and the copy alternative are both available on supported devices', async () => {
  const { SharingPanel } = await component('src/app/components/QRCodeDisplay.tsx', { share: async () => {} });
  const html = renderToStaticMarkup(React.createElement(SharingPanel, { username: 'association' }));
  assert.ok(html.includes('مشاركة الرابط')); assert.ok(html.includes('aria-label="نسخ الرابط"'));
});
test('nonprofit settings no longer contain sharing or wallet diagnostics', async () => {
  const { NonprofitSettings } = await component('src/app/components/NonprofitSettings.tsx');
  const html = renderToStaticMarkup(React.createElement(NonprofitSettings, { onLogout() {} }));
  for (const label of ['Apple Wallet', 'فحص الاتصال', 'تشخيص', 'رمز QR', 'المشاركة']) assert.ok(!html.includes(label));
  assert.ok(html.includes('البريد الإلكتروني')); assert.ok(html.includes('التواصل مع الإدارة'));
});
