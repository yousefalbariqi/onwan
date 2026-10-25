import { useState } from 'react';
import { User } from 'lucide-react';
import { PageData } from '../context/PageContext';

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
    transform: fit === 'cover' ? `scale(${Math.min(3, Math.max(1, profileStyle.zoom ?? 1))})` : undefined,
    transformOrigin: `${profileStyle.positionX ?? 50}% ${profileStyle.positionY ?? 50}%`,
  };
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
          src={profileImage} 
          alt={name}
          className="w-full h-full"
          style={imageStyle}
        />
      );
    } else {
      return <User className="w-16 h-16 opacity-50" style={{ color: textColor }} />;
    }
  };

  // دائرة أساسية
  if (profileStyle.type === 'circle') {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-white/10 backdrop-blur-sm border-4 border-white/20 shadow-xl flex items-center justify-center`}>
        {renderImage()}
      </div>
    );
  }

  // مربع ناعم
  if (profileStyle.type === 'rounded') {
    return (
      <div className={`${sizeClasses[size]} rounded-3xl overflow-hidden bg-white/10 backdrop-blur-sm border-4 border-white/20 shadow-xl flex items-center justify-center`}>
        {renderImage()}
      </div>
    );
  }

  // مربع بزوايا حادة
  if (profileStyle.type === 'square') {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden bg-white/10 backdrop-blur-sm border-4 border-white/20 shadow-xl flex items-center justify-center`}>
        {renderImage()}
      </div>
    );
  }

  // صورة كاملة (Hero)
  if (isHeroFillStyle || isHeroSafeStyle) {
    // Note 52: the photo itself fades out at the bottom (a mask), so the
    // page's real background — a colour, a gradient, a photo or a video —
    // shows through. No fixed colour is painted over it and the box has no
    // background of its own, hence no seam under the photo.
    const fade = isHeroFillStyle && fit === 'cover'
      ? { maskImage: 'linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0.4) 84%, rgba(0,0,0,0.2) 90%, rgba(0,0,0,0.05) 96%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0.4) 84%, rgba(0,0,0,0.2) 90%, rgba(0,0,0,0.05) 96%, transparent 100%)' }
      : undefined;

    return (
      <div className="relative w-full min-h-[340px] overflow-hidden sm:min-h-[420px] lg:min-h-[520px]">
        {profileImage ? (
          <div className="absolute inset-0" style={fade}>
            {isHeroFillStyle && fit === 'cover' && (
              <div
                className="absolute inset-0 scale-110 opacity-45 blur-2xl"
                style={{
                  backgroundImage: `url(${profileImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: heroImagePosition,
                }}
              />
            )}
            {isHeroFillStyle && <div className="absolute inset-0 bg-black/10" />}
            {isHeroFillStyle ? (
              <img
                src={profileImage}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ ...imageStyle, objectPosition: profileStyle.positionX === undefined && profileStyle.positionY === undefined ? heroImagePosition : imageStyle.objectPosition }}
                onLoad={handleHeroImageLoad}
              />
            ) : (
              <div className="absolute inset-0 p-4 sm:p-6 lg:p-8">
                <img
                  src={profileImage}
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
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-white/10 backdrop-blur-sm border-4 border-white shadow-2xl flex items-center justify-center relative z-10`}>
          {renderImage()}
        </div>
      </div>
    );
  }

  return null;
}