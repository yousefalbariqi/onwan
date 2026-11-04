import { storeInlineMedia } from './mediaUpload';

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز تصميم البطاقة.');
  return { element, context };
}

// Rasterize the real uploaded logo and Arabic banner in the browser, where
// fonts and all supported upload formats are available. The signed pass only
// reads these owner-scoped PNGs from R2; it never fetches arbitrary URLs.
export async function renderWalletBanner(name: string, color: string) {
  await document.fonts.load('600 28px Tajawal');
  await document.fonts.ready;
  const strip = canvas(1125, 369);
  const rgb = [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * .24 + 255 * .76));
  strip.context.fillStyle = `rgb(${rgb.join(',')})`;
  strip.context.fillRect(0, 0, 1125, 369);
  strip.context.textAlign = 'center';
  strip.context.direction = 'rtl';
  strip.context.fillStyle = '#454d47';
  strip.context.font = '400 33px Tajawal';
  strip.context.fillText('بطاقة تعريفية', 562.5, 125);
  let size = 84; // 28 pt, instead of Wallet's oversized primary field.
  do { strip.context.font = `600 ${size}px Tajawal`; size--; }
  while (strip.context.measureText(name).width > 1005 && size >= 18);
  strip.context.fillStyle = '#1c1e1d';
  strip.context.fillText(name, 562.5, 229, 1005);

  return strip.element.toDataURL('image/png');
}

export async function prepareWalletArtwork(name: string, profileImage: string, color: string) {
  const bannerImage = await renderWalletBanner(name, color);
  let logo: string | undefined;
  if (profileImage) {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = profileImage;
    await image.decode();
    const asset = canvas(480, 150);
    const ratio = Math.min(480 / image.naturalWidth, 150 / image.naturalHeight);
    const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
    asset.context.drawImage(image, (480 - width) / 2, (150 - height) / 2, width, height);
    logo = await storeInlineMedia(asset.element.toDataURL('image/png'));
  }
  const banner = await storeInlineMedia(bannerImage);
  return { logo, strip: banner };
}
