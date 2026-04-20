import { useState } from 'react';
import { User } from 'lucide-react';
import { PageData } from '../context/PageContext';

interface ProfileImageDisplayProps {
  profileImage: string;
  name: string;
  profileStyle: PageData['profileStyle'];
  textColor: string;
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string; // للـ gradient overlay في Hero
}

export function ProfileImageDisplay({
  profileImage,
  name,
  profileStyle,
  textColor,
  size = 'medium',
  backgroundColor,
}: ProfileImageDisplayProps) {
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
          className="w-full h-full object-cover"
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

  // صورة كاملة (Hero)
  if (isHeroFillStyle || isHeroSafeStyle) {
    // استخراج لون الخلفية للتدرج
    const getGradientOverlay = () => {
      if (!backgroundColor) {
        // تدرج إلى أبيض صافي - يبدأ من 60% فقط الجزء السفلي
        return 'linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0.4) 78%, rgba(255,255,255,0.6) 84%, rgba(255,255,255,0.8) 90%, rgba(255,255,255,0.95) 96%, #ffffff 100%)';
      }
      
      // إذا كان gradient - استخدام أبيض
      if (backgroundColor.includes('gradient')) {
        return 'linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0.4) 78%, rgba(255,255,255,0.6) 84%, rgba(255,255,255,0.8) 90%, rgba(255,255,255,0.95) 96%, #ffffff 100%)';
      }
      
      // إذا كان لون solid - استخدام نفس اللون بتدرج ناعم يبدأ من 60%
      let colors = [];
      let solidColor;
      
      if (backgroundColor.includes('#')) {
        // hex color - نستخرج RGB ثم نضيف opacity متدرج
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        colors = [
          `rgba(${r}, ${g}, ${b}, 0.2)`,   // 70%
          `rgba(${r}, ${g}, ${b}, 0.4)`,   // 78%
          `rgba(${r}, ${g}, ${b}, 0.6)`,   // 84%
          `rgba(${r}, ${g}, ${b}, 0.8)`,   // 90%
          `rgba(${r}, ${g}, ${b}, 0.95)`,  // 96%
        ];
        solidColor = backgroundColor;
      } else if (backgroundColor.includes('rgb')) {
        // rgb color
        const values = backgroundColor.match(/\d+/g);
        if (values && values.length >= 3) {
          colors = [
            `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.2)`,
            `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.4)`,
            `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.6)`,
            `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.8)`,
            `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.95)`,
          ];
          solidColor = `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
        } else {
          // fallback
          colors = [
            'rgba(255,255,255,0.2)',
            'rgba(255,255,255,0.4)',
            'rgba(255,255,255,0.6)',
            'rgba(255,255,255,0.8)',
            'rgba(255,255,255,0.95)',
          ];
          solidColor = '#ffffff';
        }
      } else {
        // fallback
        colors = [
          'rgba(255,255,255,0.2)',
          'rgba(255,255,255,0.4)',
          'rgba(255,255,255,0.6)',
          'rgba(255,255,255,0.8)',
          'rgba(255,255,255,0.95)',
        ];
        solidColor = '#ffffff';
      }
      
      // تدرج يبدأ من 60% - فقط الجزء السفلي من الصورة
      return `linear-gradient(to bottom, transparent 0%, transparent 60%, ${colors[0]} 70%, ${colors[1]} 78%, ${colors[2]} 84%, ${colors[3]} 90%, ${colors[4]} 96%, ${solidColor} 100%)`;
    };

    return (
      <div
        className="relative w-full min-h-[340px] overflow-hidden sm:min-h-[420px] lg:min-h-[520px]"
        style={{ backgroundColor: backgroundColor && !backgroundColor.includes('gradient') ? backgroundColor : '#111827' }}
      >
        {profileImage ? (
          <>
            {isHeroFillStyle && (
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
                style={{ objectPosition: heroImagePosition }}
                onLoad={handleHeroImageLoad}
              />
            ) : (
              <div className="absolute inset-0 p-4 sm:p-6 lg:p-8">
                <img
                  src={profileImage}
                  alt={name}
                  className="h-full w-full object-contain"
                  style={{ objectPosition: 'center center' }}
                />
              </div>
            )}
            {isHeroFillStyle && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: getGradientOverlay(),
                }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
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