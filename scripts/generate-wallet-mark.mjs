// Rasterize the existing code-native OnwanMark into Apple's logo sizes.
// Run locally with sharp available; the Worker only imports the generated PNGs.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const component = await fs.readFile(new URL('../src/app/components/OnwanLogo.tsx', import.meta.url), 'utf8');
let svg = component.match(/<svg viewBox="30 10 210 170"[\s\S]*?<\/svg>/)[0]
  .replace('className={className} aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"')
  .replace('id={mask}', 'id="wallet-mark"').replace('mask={`url(#${mask})`}', 'mask="url(#wallet-mark)"');
const lines = ['// Generated from OnwanMark by scripts/generate-wallet-mark.mjs.'];
for (const scale of [1, 2, 3]) {
  const png = await sharp(Buffer.from(svg)).resize(36 * scale, 30 * scale, { fit: 'contain' }).png().toBuffer();
  lines.push(`export const walletMark${scale}x = '${png.toString('base64')}';`);
  if (scale === 3) await fs.writeFile('/tmp/onwan-wallet-mark.png', png);
}
await fs.writeFile(new URL('../api/_lib/wallet/mark.ts', import.meta.url), lines.join('\n') + '\n');
