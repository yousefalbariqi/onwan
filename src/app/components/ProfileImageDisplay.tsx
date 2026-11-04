import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { PageData } from '../context/PageContext';

// Note 17 / قصّ الشعار: a logo with see-through pixels is shown as it is — no
// frosted frame, blurred copy or dark layer behind it. We also trim the empty
// transparent margin around it so it fills its frame instead of floating small:
// the visible pixels' bounding box is cropped onto a canvas with a small margin,
// and that trimmed copy is shown (the stored image is never changed). Trimming
// is for transparent logos only — opaque photos are never cropped. Checked once
// per image; an image that cannot be read (cross-origin) is treated as opaque
// and untrimmed, as before.
type LogoDisplay = { transparent: boolean; trimmed: string; aspect?: number };
const logoDisplayCache = new Map<string, LogoDisplay>();
const rememberLogo = (src: string, value: LogoDisplay) => {
  if (logoDisplayCache.size >= 40) logoDisplayCache.delete(logoDisplayCache.keys().next().value!);
  logoDisplayCache.set(src, value);
  return value;
};

function useLogoDisplay(src: string) {
  const [state, setState] = useState<LogoDisplay & { src: string }>(() => ({ src, ...(logoDisplayCache.get(src) ?? { transparent: false, trimmed: '' }) }));
  useEffect(() => {
    const cached = logoDisplayCache.get(src);
    if (cached) { setState({ src, ...cached }); return; }
    setState({ src, transparent: false, trimmed: '' });
    if (!src) return;
    let cancelled = false;
    const finish = (value: LogoDisplay) => { if (!cancelled) setState({ src, ...rememberLogo(src, value) }); };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const sw = img.naturalWidth, sh = img.naturalHeight;
        if (!sw || !sh) return;
        // Sample at a modest size to read transparency and the content bounds.
        const scale = Math.min(1, 256 / Math.max(sw, sh));
        const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
        const probe = document.createElement('canvas');
        probe.width = w; probe.height = h;
        const pctx = probe.getContext('2d');
        if (!pctx) return;
        pctx.drawImage(img, 0, 0, w, h);
        const data = pctx.getImageData(0, 0, w, h).data;
        let transparent = false;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3];
            if (a < 250) transparent = true;
            if (a > 16) { // a visible pixel: it counts toward the content box
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (cancelled) return;
        // Opaque image, or nothing visible: leave it whole (no crop).
        if (!transparent || maxX < minX || maxY < minY) { finish({ transparent, trimmed: '', aspect: sw / sh }); return; }
        // Only trim when there is real empty margin to remove (>6% on a side).
        const padX = (minX + (w - 1 - maxX)) / w;
        const padY = (minY + (h - 1 - maxY)) / h;
        if (padX < 0.06 && padY < 0.06) { finish({ transparent, trimmed: '', aspect: sw / sh }); return; }
        // Map the content box back to natural pixels and add a small margin so
        // the logo breathes inside its frame rather than touching the edges.
        const inv = 1 / scale;
        let bx = minX * inv, by = minY * inv;
        let bw = (maxX - minX + 1) * inv, bh = (maxY - minY + 1) * inv;
        // Padding follows the short side, so a wide mark does not gain
        // a tall empty band from its own width.
        const margin = 0.04 * Math.min(bw, bh);
        bx = Math.max(0, bx - margin); by = Math.max(0, by - margin);
        bw = Math.min(sw - bx, bw + margin * 2); bh = Math.min(sh - by, bh + margin * 2);
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(bw)); out.height = Math.max(1, Math.round(bh));
        const octx = out.getContext('2d');
        if (!octx) { finish({ transparent, trimmed: '', aspect: sw / sh }); return; }
        octx.drawImage(img, bx, by, bw, bh, 0, 0, out.width, out.height);
        finish({ transparent, trimmed: out.toDataURL('image/png'), aspect: out.width / out.height });
      } catch { /* unreadable: keep the whole image */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return state.src === src ? state : logoDisplayCache.get(src) ?? { transparent: false, trimmed: '' };
}

interface ProfileImageDisplayProps {
  profileImage: string;
  name: string;
  profileStyle: PageData['profileStyle'];
  textColor: string;
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string; // unused since note 52 (the hero fades by mask); kept for callers
}

export function ProfileImageDisplay({
  profileImage,
  name,
  profileStyle,
  textColor,
  size = 'medium',
  backgroundColor,
}: ProfileImageDisplayProps) {
  const fit = profileStyle.fit ?? (profileStyle.type === 'hero_safe' ? 'contain' : 'cover');
  const imageStyle = {
    objectFit: fit,
    objectPosition: `${profileStyle.positionX ?? 50}% ${profileStyle.positionY ?? 50}%`,
    // Note (10): zoom works in both fits; a whole logo can still be enlarged by hand.
    // Below 1 (nonprofit editor, note 10) the logo shrinks inside the frame and stays whole.
    transform: (profileStyle.zoom ?? 1) !== 1 ? `scale(${Math.min(3, Math.max(0.3, profileStyle.zoom ?? 1))})` : undefined,
    transformOrigin: `${profileStyle.positionX ?? 50}% ${profileStyle.positionY ?? 50}%`,
  };
  const { transparent, trimmed, aspect } = useLogoDisplay(profileImage);
  const displaySrc = trimmed || profileImage;
  const frameFill = transparent ? '' : 'bg-white/10 backdrop-blur-sm';
  const isHeroFillStyle = profileStyle.type === 'hero';
  const isHeroSafeStyle = profileStyle.type === 'hero_safe';
  const [heroImagePosition, setHeroImagePosition] = useState('center center');

  const sizeClasses = {
    small: 'w-24 h-24',
    medium: 'w-28 h-28',
    large: 'w-32 h-32',
  };

  const handleHeroImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;

    if (!naturalWidth || !naturalHeight) {
      setHeroImagePosition('center center');
      return;
    }

    const aspectRatio = naturalWidth / naturalHeight;

    if (aspectRatio < 0.85) {
      setHeroImagePosition('center 24%');
      return;
    }

    if (aspectRatio > 1.6) {
      setHeroImagePosition('center 42%');
      return;
    }

    setHeroImagePosition('center center');
  };

  const renderImage = () => {
    if (profileImage) {
      return (
        <img
          src={displaySrc}
          alt={name}
          className="w-full h-full"
          style={imageStyle}
        />
      );
    } else {
      return <User className="w-16 h-16 opacity-50" style={{ color: textColor }} />;
    }
  };

  // Note 21: شعار مع بنر — the banner across the top, the logo whole over its lower edge.
  if (profileStyle.type === 'banner') {
    const logo = Math.min(160, Math.max(56, profileStyle.logoSize ?? 112));
    const x = profileStyle.positionX ?? 50;
    return (
      <div className="relative w-full" style={{ paddingBottom: logo / 2 }}>
        <div className="aspect-[2.4/1] w-full overflow-hidden rounded-t-3xl bg-black/5 sm:aspect-[3.2/1]">
          {profileStyle.bannerImage && <img src={profileStyle.bannerImage} alt="" className="h-full w-full object-cover" />}
        </div>
        <div
          className={`absolute bottom-0 flex items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-xl ${transparent ? '' : 'bg-white'}`}
          style={{ width: logo, height: logo, left: `clamp(8px, calc(${100 - x}% - ${logo / 2}px), calc(100% - ${logo + 8}px))`, clipPath: 'circle(50%)' }}
        >
          {profileImage
            ? <img src={displaySrc} alt={name} className="h-full w-full" style={{ objectFit: 'contain', transform: imageStyle.transform }} />
            : <User className="h-1/2 w-1/2 opacity-50" style={{ color: textColor }} />}
        </div>
      </div>
    );
  }

  // دائرة أساسية — clip-path يضمن دائرة كاملة حتى لو كان الشعار مكبَّرًا
  // (transform)، لأن iOS Safari لا يقص الطفل المحوَّل بـ overflow-hidden وحده.
  if (profileStyle.type === 'circle') {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${frameFill} border-4 border-white/20 shadow-xl flex items-center justify-center`} style={{ clipPath: 'circle(50%)' }}>
        {renderImage()}
      </div>
    );
  }

  // مربع ناعم
  if (profileStyle.type === 'rounded') {
    return (
      <div className={`${sizeClasses[size]} rounded-3xl overflow-hidden ${frameFill} border-4 border-white/20 shadow-xl flex items-center justify-center`} style={{ transform: 'translateZ(0)' }}>
        {renderImage()}
      </div>
    );
  }

  // مربع بزوايا حادة
  if (profileStyle.type === 'square') {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden ${frameFill} border-4 border-white/20 shadow-xl flex items-center justify-center`}>
        {renderImage()}
      </div>
    );
  }

  // صورة كاملة (Hero)
  if (isHeroFillStyle || isHeroSafeStyle) {
    // A transparent mark is content, not a full-height photograph. Its box
    // follows the visible logo's ratio, so the name follows immediately below.
    // Both editor and real page use this path; photo hero layouts stay fixed.
    if (profileImage && transparent && aspect && Number.isFinite(aspect)) {
      return <div data-logo-layout="intrinsic" className="relative w-full overflow-hidden" style={{ aspectRatio: String(Math.max(1, aspect)) }}>
        <img src={displaySrc} alt={name} className="absolute inset-0 h-full w-full" style={{ ...imageStyle, objectFit: 'contain' }} />
      </div>;
    }

    // Note 52: the photo itself fades out at the bottom (a mask), so the
    // page's real background — a colour, a gradient, a photo or a video —
    // shows through. No fixed colour is painted over it and the box has no
    // background of its own, hence no seam under the photo.
    // Note 27 (update): «الصورة كاملة» fades into the page the same way.
    const fade = isHeroFillStyle && !transparent
      ? { maskImage: 'linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0.4) 84%, rgba(0,0,0,0.2) 90%, rgba(0,0,0,0.05) 96%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0.4) 84%, rgba(0,0,0,0.2) 90%, rgba(0,0,0,0.05) 96%, transparent 100%)' }
      : undefined;

    return (
      <div className="relative w-full min-h-[340px] overflow-hidden sm:min-h-[400px]">
        {profileImage ? (
          <div className="absolute inset-0" style={fade}>
            {isHeroFillStyle && fit === 'cover' && !transparent && (
              <div
                className="absolute inset-0 scale-110 opacity-45 blur-2xl"
                style={{
                  backgroundImage: `url(${profileImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: heroImagePosition,
                }}
              />
            )}
            {/* A whole photo leaves page background beside it; no tint there. */}
            {isHeroFillStyle && fit === 'cover' && !transparent && <div className="absolute inset-0 bg-black/10" />}
            {isHeroFillStyle ? (
              <img
                src={displaySrc}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ ...imageStyle, objectPosition: profileStyle.positionX === undefined && profileStyle.positionY === undefined ? heroImagePosition : imageStyle.objectPosition }}
                onLoad={handleHeroImageLoad}
              />
            ) : (
              <div className="absolute inset-0 p-4 sm:p-6 lg:p-8">
                <img
                  src={displaySrc}
                  alt={name}
                  className="h-full w-full object-contain"
                  style={imageStyle}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm">
            <User className="w-24 h-24 opacity-50" style={{ color: textColor }} />
          </div>
        )}
      </div>
    );
  }

  // دائرة مميزة (Premium)
  if (profileStyle.type === 'premium') {
    return (
      <div className="relative inline-block">
        {/* الإطار الخارجي المتحرك */}
        <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-gradient-to-tr from-purple-400 via-pink-400 to-yellow-400 animate-spin-slow blur-sm`} style={{ padding: '6px' }}></div>
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${frameFill} border-4 border-white shadow-2xl flex items-center justify-center relative z-10`} style={{ clipPath: 'circle(50%)' }}>
          {renderImage()}
        </div>
      </div>
    );
  }

  return null;
}