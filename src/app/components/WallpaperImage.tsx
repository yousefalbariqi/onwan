import { useState, type CSSProperties } from 'react';
import type { PageData } from '../context/PageContext';

type Wallpaper = PageData['wallpaper'];
export function wallpaperFocus(wallpaper: Wallpaper) {
  const legacyY = wallpaper.position === 'top' ? 0 : wallpaper.position === 'bottom' ? 100 : 50;
  return { x: wallpaper.positionX ?? 50, y: wallpaper.positionY ?? legacyY, zoom: wallpaper.zoom ?? 1 };
}

// Both images are out of document flow and share the same cover/focus/zoom.
// Request them together, and reveal the full image only after decoding it.
export function WallpaperImage({ wallpaper, src = wallpaper.value }: { wallpaper: Wallpaper; src?: string }) {
  const { x, y, zoom } = wallpaperFocus(wallpaper);
  const [decodedSrc, setDecodedSrc] = useState('');
  const preview = src === wallpaper.value ? wallpaper.preview : undefined;
  const ready = decodedSrc === src;
  const style: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', objectPosition: `${x}% ${y}%` };
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0" style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: `${x}% ${y}%` }}>
      {preview && !ready && <img src={preview} alt="" decoding="async" style={{ ...style, filter: 'blur(6px)' }} />}
      <img key={src} src={src} alt="" decoding="async" fetchPriority="high" style={{ ...style, opacity: ready || !preview ? 1 : 0 }} onLoad={async event => {
        const element = event.currentTarget;
        try { await element.decode(); } catch { /* A loaded image remains usable without decode(). */ }
        if (element.isConnected) setDecodedSrc(src);
      }} />
    </div>
  </div>;
}
