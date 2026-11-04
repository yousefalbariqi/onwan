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
    if (name === '../../../shared/walletPalette.js') return load('shared/walletPalette.ts');
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
  assert.equal(pass.storeCard.backFields.find(field => field.key === 'page').value, 'https://yaamur.example.test');
  assert.equal(pass.storeCard.backFields.some(field => field.key === 'large-qr'), false);
  assert.equal(pass.backgroundColor, 'rgb(255, 240, 234)');
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

test('uploaded artwork replaces the default logo and oversized native name', () => {
  const { cardStripImages } = load('api/_lib/wallet/qrStrip.ts');
  const strip = cardStripImages([240, 230, 220])['strip@3x.png'];
  const logo = Uint8Array.from([1, 2, 3, 4]);
  const files = unzipSync(buildPkpass({ username: 'yaamur', name: 'جمعية ذات اسم طويل', artwork: { logo, strip } }));
  const pass = JSON.parse(Buffer.from(files['pass.json']).toString());
  assert.equal(pass.logoText, undefined);
  assert.equal(pass.storeCard.primaryFields, undefined);
  assert.equal(pass.storeCard.backFields.find(field => field.key === 'name').value, 'جمعية ذات اسم طويل');
  assert.deepEqual(files['logo@3x.png'], logo);
  assert.deepEqual(files['strip@3x.png'], strip);
  assert.equal(pass.barcodes[0].format, 'PKBarcodeFormatQR');
});

function artworkModule(bucket) {
  const module = { exports: {} };
  const source = fs.readFileSync('api/_lib/wallet/artwork.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '../runtime.js') return { getBinding: () => bucket };
    if (name === '../http.js') return { HttpError: class extends Error { constructor(status, message) { super(message); this.status = status; } } };
    throw new Error(name);
  }, module, module.exports);
  return module.exports;
}

test('artwork references reject other owners, remote URLs and non-PNG uploads', () => {
  const { validateWalletArtwork } = artworkModule();
  const strip = '/media/files/owner/' + 'a'.repeat(64) + '.png';
  assert.deepEqual(validateWalletArtwork({ strip }, 'owner'), { strip });
  for (const path of [strip.replace('/owner/', '/other/'), 'https://example.test/logo.png', strip.replace('.png', '.jpg'), strip + '/../secret']) {
    assert.throws(() => validateWalletArtwork({ strip: path }, 'owner'));
  }
});

test('missing or incorrectly sized artwork fails before card issuance', async () => {
  const refs = { strip: '/media/files/owner/' + 'a'.repeat(64) + '.png' };
  await assert.rejects(artworkModule({ get: async () => null }).readWalletArtwork(refs));
  const { cardStripImages } = load('api/_lib/wallet/qrStrip.ts');
  const png = cardStripImages([255, 255, 255])['strip.png'];
  await assert.rejects(artworkModule({ get: async () => ({ size: png.length, arrayBuffer: async () => png.buffer }) }).readWalletArtwork(refs));
});


test('one signed pass contains posterGeneric plus the legacy style, sharing identity and native QR', () => {
  for (const style of [undefined, 'generic']) {
    const files = unzipSync(buildPkpass({ username: 'poster', name: 'جمعية عنوان', style }));
    const pass = JSON.parse(Buffer.from(files['pass.json']).toString());
    assert.equal(pass.posterGeneric.primaryFields[0].value, 'جمعية عنوان');
    assert.equal(pass.posterGeneric.headerFields.length, 1);
    assert.equal(pass.posterGeneric.footerFields.length, 1);
    assert.ok(style === 'generic' ? pass.generic : pass.storeCard);
    assert.equal(pass.serialNumber, 'onwan-poster');
    assert.equal(pass.barcodes[0].format, 'PKBarcodeFormatQR');
    assert.equal(pass.barcodes[0].message, 'https://poster.example.test');
    assert.equal(pass.minimumOSVersion, undefined);
    for (const [file, width, height] of [['artwork.png', 358, 448], ['artwork@2x.png', 716, 896], ['artwork@3x.png', 1074, 1344]]) {
      const image = Buffer.from(files[file]);
      assert.equal(image.readUInt32BE(16), width);
      assert.equal(image.readUInt32BE(20), height);
    }
    assert.ok(files['primaryLogo@3x.png']);
    const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
    assert.ok(manifest['artwork@3x.png']);
    assert.ok(manifest['primaryLogo@3x.png']);
  }
});

test('poster uses the chosen short name and separate artwork/logo without changing the fallback', () => {
  const poster = Uint8Array.from([10, 20, 30]);
  const primaryLogo = Uint8Array.from([40, 50, 60]);
  const files = unzipSync(buildPkpass({ username: 'poster', name: 'الاسم الكامل للجمعية', artwork: { poster, primaryLogo, displayName: 'جمعية عنوان' } }));
  const pass = JSON.parse(Buffer.from(files['pass.json']).toString());
  assert.equal(pass.posterGeneric.primaryFields[0].value, 'جمعية عنوان');
  assert.equal(pass.storeCard.primaryFields[0].value, 'الاسم الكامل للجمعية');
  assert.deepEqual(files['artwork@3x.png'], poster);
  assert.deepEqual(files['primaryLogo@3x.png'], primaryLogo);
});

test('poster references and custom names are owner-scoped and validated', () => {
  const { validateWalletArtwork } = artworkModule();
  const strip = '/media/files/owner/' + 'a'.repeat(64) + '.png';
  assert.deepEqual(validateWalletArtwork({ strip, poster: strip, primaryLogo: strip, displayName: 'عنوان' }, 'owner'), { strip, poster: strip, primaryLogo: strip, displayName: 'عنوان' });
  assert.throws(() => validateWalletArtwork({ strip, poster: strip.replace('/owner/', '/other/') }, 'owner'));
  assert.throws(() => validateWalletArtwork({ strip, primaryLogo: 'https://example.test/logo.png' }, 'owner'));
  assert.throws(() => validateWalletArtwork({ strip, displayName: 'x'.repeat(161) }, 'owner'));
});
