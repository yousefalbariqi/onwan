import { ReactNode } from 'react';
import { FONT_OPTIONS, PageData } from '../context/PageContext';
import { pageHost } from '../lib/site';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { SocialIcon } from './SocialIcons';

interface PageViewProps {
  data: PageData;
  // 'preview' is the framed card inside the builder; 'public' is the real,
  // full-screen page. Both render the same components so they cannot drift.
  variant: 'preview' | 'public';
  children?: ReactNode;
}

const NAME_SIZES = {
  preview: { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' },
  public: { small: 'text-2xl', medium: 'text-3xl', large: 'text-4xl' },
};

const BIO_SIZES = {
  preview: { small: 'text-xs', medium: 'text-sm', large: 'text-base' },
  public: { small: 'text-sm', medium: 'text-base', large: 'text-lg' },
};

const BUTTON_SIZES = {
  small: 'px-5 py-3 text-sm',
  medium: 'px-6 py-4',
  large: 'px-6 py-5 text-lg',
};

const BUTTON_SHAPES = {
  rounded: 'rounded-xl',
  square: 'rounded-none',
  pill: 'rounded-full',
};

function withAlpha(color: string, opacityPercent: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];

  if (!hex || opacityPercent >= 100) {
    return color;
  }

  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
}

export function PageView({ data, variant, children }: PageViewProps) {
  const isPublic = variant === 'public';
  const isHeroLayout = data.profileStyle.type === 'hero' || data.profileStyle.type === 'hero_safe';
  const fontFamily = (FONT_OPTIONS.find((font) => font.id === data.typography?.font) ?? FONT_OPTIONS[0]).family;
  const textSize = data.typography?.size ?? 'medium';
  const { buttonStyle, theme, wallpaper } = data;
  // PAGE-06: hidden buttons stay in the editor list but are not rendered.
  const visibleLinks = data.links.filter((link) => !link.hidden);

  const backgroundStyle =
    wallpaper.type === 'gradient'
      ? { background: wallpaper.value }
      : wallpaper.type === 'image'
        ? {
            backgroundImage: `url(${wallpaper.value})`,
            backgroundSize: 'cover',
            backgroundPosition: wallpaper.position ?? 'center',
          }
        : { backgroundColor: wallpaper.value };

  const accentColor =
    buttonStyle.useCustomColor && buttonStyle.customColor ? buttonStyle.customColor : theme.buttonColor;

  const buttonClassName = [
    BUTTON_SHAPES[buttonStyle.shape],
    BUTTON_SIZES[buttonStyle.size ?? 'medium'],
    buttonStyle.border ? 'border-2' : '',
    buttonStyle.shadow ? 'shadow-lg' : '',
  ].join(' ');

  const profileImage = (
    <ProfileImageDisplay
      profileImage={data.profileImage}
      name={data.name}
      profileStyle={data.profileStyle}
      textColor={theme.textColor}
      size={isPublic ? 'large' : 'medium'}
      backgroundColor={isHeroLayout && wallpaper.type !== 'image' ? wallpaper.value : undefined}
    />
  );

  return (
    <div
      className={
        isPublic
          ? 'relative min-h-screen flex items-center justify-center transition-all duration-500'
          : `relative w-full rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
              isHeroLayout ? 'min-h-[700px]' : 'min-h-[600px]'
            }`
      }
      style={{ ...backgroundStyle, color: theme.textColor, fontFamily }}
      dir="rtl"
    >
      {wallpaper.type === 'image' && !!wallpaper.dim && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: Math.min(wallpaper.dim, 80) / 100 }}
        />
      )}

      <div className={isPublic ? 'relative w-full max-w-md' : 'relative'}>
        {isHeroLayout && (
          <div className={isPublic ? 'overflow-hidden rounded-t-3xl relative' : 'relative'}>{profileImage}</div>
        )}

        <div
          className={`flex flex-col items-center ${
            isPublic ? `px-4 ${isHeroLayout ? 'pt-6' : 'pt-10'} pb-8` : `p-8 ${isHeroLayout ? 'pt-6' : ''}`
          }`}
        >
          {!isHeroLayout && profileImage}

          {(data.name || !isPublic) && (
            <h1
              className={`${NAME_SIZES[variant][textSize]} font-black mb-3 text-center ${
                isHeroLayout ? 'mt-0 drop-shadow-md' : isPublic ? 'mt-6' : 'mt-4'
              }`}
              style={{ color: data.customColors?.nameColor || theme.textColor }}
            >
              {data.name || 'اسم الجهة'}
            </h1>
          )}

          {(data.bio || !isPublic) && (
            <p
              className={`${BIO_SIZES[variant][textSize]} opacity-90 mb-4 text-center max-w-sm whitespace-pre-line`}
              style={{ color: data.customColors?.bioColor || theme.textColor }}
            >
              {data.bio || 'أضف تعريفًا قصيرًا بالجهة ونشاطها'}
            </p>
          )}

          {!!data.username && (
            <div
              className={`text-sm text-center ${isPublic ? 'mb-10' : 'mb-8'}`}
              style={{
                color: data.customColors?.usernameColor || theme.textColor,
                opacity: data.customColors?.usernameColor ? 1 : 0.7,
              }}
              dir="ltr"
            >
              {pageHost(data.username)}
            </div>
          )}

          <div className={`w-full ${isPublic ? 'space-y-4' : 'max-w-sm space-y-3'}`}>
            {visibleLinks.map((link) => {
              const icon = (
                <SocialIcon
                  platform={link.platform || 'website'}
                  iconStyle={link.iconStyle || 'color'}
                  className={`${isPublic ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`}
                />
              );

              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={link.linkType === 'file' ? link.fileName || true : undefined}
                  className={`w-full flex items-center gap-3 transition-all hover:scale-105 active:scale-95 ${buttonClassName}`}
                  style={{
                    backgroundColor: buttonStyle.border
                      ? 'transparent'
                      : withAlpha(accentColor, buttonStyle.opacity ?? 100),
                    color: buttonStyle.border ? accentColor : theme.buttonTextColor,
                    borderColor: accentColor,
                  }}
                >
                  {(link.textPosition || 'center') === 'center' ? (
                    // تخطيط مركز: نص في الوسط وأيقونة على الطرف
                    <>
                      <span className="flex-1 font-semibold text-center">{link.title}</span>
                      {icon}
                    </>
                  ) : (
                    // تخطيط يمين: أيقونة ونص على اليمين
                    <>
                      {icon}
                      <span className="font-semibold">{link.title}</span>
                      <span className="flex-1"></span>
                    </>
                  )}
                </a>
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
