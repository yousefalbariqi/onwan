import type { PageData } from '../context/PageContext';

// The Apple Wallet card takes its colour from the page (owner decision,
// 2 Nov 2026). A photo or video background has no single colour the Worker
// can read, so the browser works out its average colour at save time and the
// page stores it as `wallpaper.tint`. Colour and gradient backgrounds need none.

function averageColour(src: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24; canvas.height = 24;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(undefined);
        context.drawImage(image, 0, 0, 24, 24);
        const pixels = context.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 128) continue;
          r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n += 1;
        }
        if (!n) return resolve(undefined);
        resolve('#' + [r, g, b].map(c => Math.round(c / n).toString(16).padStart(2, '0')).join(''));
      } catch { resolve(undefined); }
    };
    image.onerror = () => resolve(undefined);
    image.src = src;
  });
}

export async function withWallpaperTint(data: PageData): Promise<PageData> {
  const { wallpaper } = data;
  const source = wallpaper.type === 'image' ? wallpaper.value : wallpaper.type === 'video' ? wallpaper.poster : undefined;
  const { tint: _previous, ...rest } = wallpaper;
  const tint = source ? await averageColour(source) : undefined;
  if (tint === wallpaper.tint) return data;
  return { ...data, wallpaper: tint ? { ...rest, tint } : rest };
}
