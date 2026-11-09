import { walletPosterPixel } from '../../../shared/walletGeometry';
import { walletPaletteFromHex } from '../../../shared/walletPalette';
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
  const palette = walletPaletteFromHex(color);
  strip.context.fillStyle = palette.stripColor;
  strip.context.fillRect(0, 0, 1125, 369);
  strip.context.textAlign = 'center';
  strip.context.direction = 'rtl';
  strip.context.fillStyle = '#454d47';
  strip.context.font = '400 30px Tajawal';
  strip.context.fillText('بطاقة تعريفية', 562.5, 119);
  let size = 84; // 28 pt, instead of Wallet's oversized primary field.
  do { strip.context.font = `600 ${size}px Tajawal`; size--; }
  while (strip.context.measureText(name).width > 1005 && size >= 18);
  strip.context.fillStyle = '#1c1e1d';
  strip.context.fillText(name, 562.5, 224, 1005);

  return strip.element.toDataURL('image/png');
}

// Poster artwork is decorative; the name, link and QR remain native fields.
export async function renderWalletPoster(color: string) {
  const palette = walletPaletteFromHex(color);
  const poster = canvas(1074, 1344);
  const pixels = poster.context.createImageData(1074, 1344);
  for (let y = 0, i = 0; y < 1344; y++) {
    for (let x = 0; x < 1074; x++, i += 4) {
      const rgb = walletPosterPixel(x / 3, y / 3, palette.strip, palette.body);
      pixels.data[i] = rgb[0]; pixels.data[i + 1] = rgb[1]; pixels.data[i + 2] = rgb[2]; pixels.data[i + 3] = 255;
    }
  }
  poster.context.putImageData(pixels, 0, 0);
  let png = poster.element.toDataURL('image/png');
  if (png.length * .75 > 900_000) {
    // Keep PNG and Apple's exact pixel dimensions. The generic uploader would
    // otherwise convert an oversized photograph to WebP, which passes reject.
    const source = poster.context.getImageData(0, 0, 1074, 1344);
    const original = new Uint8ClampedArray(source.data);
    for (const steps of [32, 16, 8, 4, 2]) {
      for (let i = 0; i < source.data.length; i += 4) {
        for (let c = 0; c < 3; c++) source.data[i + c] = Math.round(Math.round(original[i + c] / 255 * (steps - 1)) / (steps - 1) * 255);
      }
      poster.context.putImageData(source, 0, 0);
      png = poster.element.toDataURL('image/png');
      if (png.length * .75 <= 900_000) break;
    }
    if (png.length * .75 > 900_000) throw new Error('خلفية البطاقة كبيرة جدًا. اختر صورة أبسط.');
  }
  return png;
}

export async function prepareWalletArtwork(name: string, profileImage: string, color: string) {
  const bannerImage = await renderWalletBanner(name, color);
  const posterImage = await renderWalletPoster(color);
  let logo: string | undefined;
  let primaryLogo: string | undefined;
  if (profileImage) {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = profileImage;
    await image.decode();
    const fit = (width: number, height: number) => {
      const asset = canvas(width, height);
      const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
      asset.context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      return asset.element.toDataURL('image/png');
    };
    logo = await storeInlineMedia(fit(480, 150));
    primaryLogo = await storeInlineMedia(fit(378, 90));
  }
  const strip = await storeInlineMedia(bannerImage);
  const poster = await storeInlineMedia(posterImage);
  return { logo, primaryLogo, strip, poster, displayName: name };
}
