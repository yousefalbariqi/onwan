import forge from 'node-forge';
import { zipSync } from 'fflate';
import { getEnv } from '../runtime.js';
import { HttpError } from '../http.js';
import { iconPng, icon2xPng, icon3xPng } from './images.js';
import { cardStripImages } from './qrStrip.js';
import { walletMark1x, walletMark2x, walletMark3x } from './mark.js';

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

export type PassInput = { username: string; name: string; design?: { wallpaper?: any; theme?: any }; artwork?: { logo?: Uint8Array; strip?: Uint8Array }; style?: 'generic' };

type Rgb = [number, number, number];
const ORANGE: Rgb = [255, 107, 44];
function parseColour(value: unknown): Rgb | null {
  const text = String(value ?? '');
  const hex = text.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = text.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map(c => Math.min(255, c)) as Rgb : null;
}
// The card wears the page's own background (owner decision, 2 Nov 2026):
// the plain colour, a gradient's first colour, or the average colour the
// editor stored for a photo/video. Older pages fall back to the theme's
// button colour, then the brand orange.
export function passColours(design: PassInput['design']) {
  const wallpaper = design?.wallpaper ?? {};
  const background = (wallpaper.type === 'color' || wallpaper.type === 'gradient' ? parseColour(wallpaper.value) : parseColour(wallpaper.tint))
    ?? parseColour(design?.theme?.buttonColor) ?? ORANGE;
  const [r, g, b] = background.map(c => c / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
  const css = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  return {
    rgb: background,
    backgroundColor: css(background),
    foregroundColor: light ? 'rgb(17, 17, 17)' : 'rgb(255, 255, 255)',
    labelColor: light ? 'rgb(90, 90, 90)' : 'rgb(230, 230, 230)',
  };
}

// Keep the accent pale enough for Wallet's single foreground colour to read
// well both over the strip and on the light card body.
export function walletCardAppearance(design: PassInput['design']) {
  const accent = passColours(design).rgb;
  return {
    backgroundColor: 'rgb(248, 248, 246)',
    foregroundColor: 'rgb(28, 30, 29)',
    labelColor: 'rgb(69, 77, 71)',
    strip: accent.map(value => Math.round(value * 0.24 + 255 * 0.76)) as Rgb,
  };
}

export function buildPkpass({ username, name, design, style, artwork }: PassInput): Uint8Array {
  const publicUrl = `https://${username}.${ROOT_DOMAIN()}`;
  const host = `${username}.${ROOT_DOMAIN()}`;
  const colours = walletCardAppearance(design);
  const fields = {
    headerFields: [{ key: 'link', label: 'الرابط', value: host, textAlignment: 'PKTextAlignmentLeft' }],
    // A rendered banner gives us a predictable medium font and one-line fitting.
    ...(artwork?.strip && style !== 'generic' ? {} : { primaryFields: [{ key: 'name', label: 'بطاقة تعريفية', value: name || username, textAlignment: 'PKTextAlignmentCenter' }] }),
    backFields: [
      { key: 'name', label: 'بطاقة تعريفية', value: name || username },
      { key: 'page', label: 'فتح الصفحة', value: publicUrl },
      { key: 'about', label: 'عنوان', value: 'امسح رمز QR لزيارة الصفحة والاطلاع على معلومات التواصل.' },
    ],
  };
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID(),
    teamIdentifier: TEAM_ID(),
    serialNumber: `onwan-${username}`,
    organizationName: 'عنوان',
    description: `بطاقة ${name || 'عنوان'}`,
    ...(artwork?.logo ? {} : { logoText: 'عنوان' }),
    backgroundColor: colours.backgroundColor,
    foregroundColor: colours.foregroundColor,
    labelColor: colours.labelColor,
    suppressStripShine: true,
    // PassKit JSON uses this case-sensitive name (not PKBARCODE_FORMAT_QR).
    barcodes: [{ format: 'PKBarcodeFormatQR', message: publicUrl, messageEncoding: 'iso-8859-1', altText: 'امسح لفتح الصفحة' }],
    ...(style === 'generic' ? { generic: fields } : { storeCard: fields }),
  };

  const files: Record<string, Uint8Array> = {
    'pass.json': new TextEncoder().encode(JSON.stringify(pass)),
    'icon.png': b64ToBytes(iconPng),
    'icon@2x.png': b64ToBytes(icon2xPng),
    'icon@3x.png': b64ToBytes(icon3xPng),
    ...(artwork?.logo ? { 'logo@3x.png': artwork.logo } : {
      'logo.png': b64ToBytes(walletMark1x),
      'logo@2x.png': b64ToBytes(walletMark2x),
      'logo@3x.png': b64ToBytes(walletMark3x),
    }),
    ...(style === 'generic' ? {} : artwork?.strip ? { 'strip@3x.png': artwork.strip } : cardStripImages(colours.strip)),
  };

  const manifest: Record<string, string> = {};
  for (const [filename, bytes] of Object.entries(files)) manifest[filename] = sha1Hex(bytes);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  files['manifest.json'] = manifestBytes;
  files['signature'] = signManifest(manifestBytes);

  return zipSync(files);
}
