import type { PageData } from '../context/PageContext';

type Wallpaper = PageData['wallpaper'];

// Focus point (0–100 %) and zoom of a background photo. Older pages only have
// `position` (top / center / bottom), which maps onto the vertical focus.
export function wallpaperFocus(wallpaper: Wallpaper) {
  const legacyY = wallpaper.position === 'top' ? 0 : wallpaper.position === 'bottom' ? 100 : 50;
  return { x: wallpaper.positionX ?? 50, y: wallpaper.positionY ?? legacyY, zoom: wallpaper.zoom ?? 1 };
}

// The background photo, moved and scaled as set in «تنسيق» (note 27). Fills
// its positioned parent; used by the page itself and by the editor's previews.
export function WallpaperImage({ wallpaper, src = wallpaper.value }: { wallpaper: Wallpaper; src?: string }) {
  const { x, y, zoom } = wallpaperFocus(wallpaper);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: `${x}% ${y}%`,
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: `${x}% ${y}%`,
        }}
      />
    </div>
  );
}
