const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const forge = require('node-forge');
const { unzipSync } = require('fflate');

// Ephemeral certificates: this test never reads production signing secrets.
const keys = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date('2026-01-01');
cert.validity.notAfter = new Date('2030-01-01');
cert.setSubject([{ name: 'commonName', value: 'Wallet design test' }]);
cert.setIssuer(cert.subject.attributes);
cert.sign(keys.privateKey, forge.md.sha256.create());
const pem = forge.pki.certificateToPem(cert);
const env = {
  WALLET_CERT_PEM_B64: Buffer.from(pem).toString('base64'),
  WALLET_KEY_PEM_B64: Buffer.from(forge.pki.privateKeyToPem(keys.privateKey)).toString('base64'),
  WALLET_WWDR_PEM_B64: Buffer.from(pem).toString('base64'),
  ROOT_DOMAIN: 'example.test',
};
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '../runtime.js') return { getEnv: key => env[key] };
    if (name === '../http.js') return { HttpError: Error };
    if (name.startsWith('./')) return load('api/_lib/wallet/' + name.slice(2).replace(/\.js$/, '.ts'));
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const { buildPkpass, walletCardAppearance } = load('api/_lib/wallet/pass.ts');

test('signed card contains the native QR, page identity, logo and retina strip assets', () => {
  const files = unzipSync(buildPkpass({ username: 'yaamur', name: 'جمعية يعمر', design: { wallpaper: { type: 'color', value: '#ff6b2c' } } }));
  const pass = JSON.parse(Buffer.from(files['pass.json']).toString());
  assert.equal(pass.serialNumber, 'onwan-yaamur');
  assert.equal(pass.storeCard.primaryFields[0].value, 'جمعية يعمر');
  assert.equal(pass.storeCard.headerFields[0].value, 'yaamur.example.test');
  assert.equal(pass.barcodes.length, 1);
  assert.equal(pass.barcodes[0].format, 'PKBarcodeFormatQR');
  assert.equal(pass.barcodes[0].message, 'https://yaamur.example.test');
  assert.equal(pass.storeCard.backFields[0].value, 'https://yaamur.example.test');
  assert.equal(pass.backgroundColor, 'rgb(248, 248, 246)');
  for (const [file, width, height] of [['strip.png', 375, 123], ['strip@2x.png', 750, 246], ['strip@3x.png', 1125, 369], ['logo@3x.png', 108, 90]]) {
    const bytes = Buffer.from(files[file]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
  for (const [name, hash] of Object.entries(manifest)) assert.equal(crypto.createHash('sha1').update(files[name]).digest('hex'), hash);
  assert.ok(files.signature.length > 0);
});

test('even the darkest selected accent leaves readable text on the strip', () => {
  for (const color of ['#000000', '#ffffff', '#ff6b2c', '#2b5118']) {
    const appearance = walletCardAppearance({ wallpaper: { type: 'color', value: color } });
    const linear = appearance.strip.map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    const text = [69, 77, 71].map(c => ((c / 255 + .055) / 1.055) ** 2.4);
    const textLuminance = text[0] * .2126 + text[1] * .7152 + text[2] * .0722;
    assert.ok((luminance + .05) / (textLuminance + .05) >= 4.5, color);
    assert.equal(appearance.foregroundColor, 'rgb(28, 30, 29)');
  }
});

test('generic diagnostic style keeps its native QR without an unsupported strip', () => {
  const files = unzipSync(buildPkpass({ username: 'test', name: '', style: 'generic' }));
  const pass = JSON.parse(Buffer.from(files['pass.json']).toString());
  assert.equal(pass.generic.primaryFields[0].value, 'test');
  assert.equal(pass.barcodes[0].format, 'PKBarcodeFormatQR');
  assert.equal(files['strip.png'], undefined);
});
