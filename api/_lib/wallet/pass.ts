import forge from 'node-forge';
import { zipSync } from 'fflate';
import { getEnv } from '../runtime.js';
import { HttpError } from '../http.js';
import { iconPng, icon2xPng, icon3xPng, logoPng, logo2xPng, logo3xPng } from './images.js';

// Apple Wallet pass signing, in the Worker. Apple needs a PKCS#7 detached
// signature over manifest.json (SHA-1 of every file), which the Workers runtime
// cannot produce with WebCrypto — so node-forge does it in pure JS, and fflate
// zips the bundle. The signing certificate, its key and the WWDR G4 cert are
// read from secrets (base64 PEM); nothing is logged and nothing is committed.

const PASS_TYPE_ID = () => getEnv('WALLET_PASS_TYPE_ID') || 'pass.link.onwan.cards';
const TEAM_ID = () => getEnv('WALLET_TEAM_ID') || 'SAPQX9XG6H';
const ROOT_DOMAIN = () => getEnv('ROOT_DOMAIN') || 'onwan.link';

export function walletConfigured() {
  return Boolean(getEnv('WALLET_CERT_PEM_B64') && getEnv('WALLET_KEY_PEM_B64') && getEnv('WALLET_WWDR_PEM_B64'));
}

const b64ToBinary = (b64: string) => forge.util.decode64(b64);
const b64ToBytes = (b64: string) => {
  const binary = forge.util.decode64(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
const bytesToBinary = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};
const sha1Hex = (bytes: Uint8Array) => forge.md.sha1.create().update(bytesToBinary(bytes)).digest().toHex();

function readSecretPem(name: string) {
  const value = getEnv(name);
  if (!value) throw new HttpError(503, 'بطاقة Apple Wallet غير مهيأة بعد.');
  return b64ToBinary(value);
}

// The detached PKCS#7 signature Apple expects over the manifest bytes.
function signManifest(manifest: Uint8Array): Uint8Array {
  const cert = forge.pki.certificateFromPem(readSecretPem('WALLET_CERT_PEM_B64'));
  const wwdr = forge.pki.certificateFromPem(readSecretPem('WALLET_WWDR_PEM_B64'));
  const passphrase = getEnv('WALLET_KEY_PASSPHRASE');
  const key = forge.pki.decryptRsaPrivateKey(readSecretPem('WALLET_KEY_PEM_B64'), passphrase || undefined)
    || forge.pki.privateKeyFromPem(readSecretPem('WALLET_KEY_PEM_B64'));
  if (!key) throw new HttpError(500, 'تعذّر قراءة مفتاح توقيع البطاقة.');

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(bytesToBinary(manifest));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const out = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i += 1) out[i] = der.charCodeAt(i);
  return out;
}

export type PassInput = { username: string; name: string };

export function buildPkpass({ username, name }: PassInput): Uint8Array {
  const publicUrl = `https://${username}.${ROOT_DOMAIN()}`;
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID(),
    teamIdentifier: TEAM_ID(),
    serialNumber: `onwan-${username}`,
    organizationName: 'عنوان',
    description: `بطاقة ${name || 'عنوان'}`,
    logoText: 'عنوان',
    foregroundColor: 'rgb(17, 17, 17)',
    backgroundColor: 'rgb(248, 248, 246)',
    labelColor: 'rgb(115, 115, 115)',
    storeCard: {
      primaryFields: [{ key: 'name', label: '', value: name || username }],
      secondaryFields: [{ key: 'link', label: 'الصفحة', value: `${username}.${ROOT_DOMAIN()}` }],
    },
    barcodes: [{ format: 'PKBARCODE_FORMAT_QR', message: publicUrl, messageEncoding: 'iso-8859-1' }],
    barcode: { format: 'PKBARCODE_FORMAT_QR', message: publicUrl, messageEncoding: 'iso-8859-1' },
  };

  const files: Record<string, Uint8Array> = {
    'pass.json': new TextEncoder().encode(JSON.stringify(pass)),
    'icon.png': b64ToBytes(iconPng),
    'icon@2x.png': b64ToBytes(icon2xPng),
    'icon@3x.png': b64ToBytes(icon3xPng),
    'logo.png': b64ToBytes(logoPng),
    'logo@2x.png': b64ToBytes(logo2xPng),
    'logo@3x.png': b64ToBytes(logo3xPng),
  };

  const manifest: Record<string, string> = {};
  for (const [filename, bytes] of Object.entries(files)) manifest[filename] = sha1Hex(bytes);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  files['manifest.json'] = manifestBytes;
  files['signature'] = signManifest(manifestBytes);

  return zipSync(files);
}
