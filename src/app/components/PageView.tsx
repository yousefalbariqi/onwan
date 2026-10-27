import { sectionBlocks, visibleSectionItems } from '../../../shared/linkSections';
import { ReactNode, useEffect } from 'react';
import { FONT_OPTIONS, Link, PageData } from '../context/PageContext';
import { pageHost } from '../lib/site';
import { customFontFamily, loadCustomFont, loadFont } from '../lib/fonts';
import { SectionLayout } from './SectionLayout';
import { VideoBlock } from './VideoBlock';
import { VideoBackground } from './VideoBackground';
import { WallpaperImage } from './WallpaperImage';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { SocialIcon, brandColor } from './SocialIcons';
import { FONT_WEIGHTS, buttonMetrics } from '../lib/buttonSizes';
import { OFFICIAL_DOCUMENTS } from '../lib/officialDocuments';

interface PageViewProps {
  data: PageData;
  // 'preview' is the framed card inside the builder; 'public' is the real,
  // full-screen page. Both render the same components so they cannot drift.
  variant: 'preview' | 'public';
  // PAGE-16: 'en' shows the manually entered English text where it exists.
  lang?: 'ar' | 'en';
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

// WCAG contrast ratio between two #rrggbb colours (1 = same, 21 = black on white).
function contrastRatio(a: string, b: string) {
  const luminance = (color: string) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
    if (!hex) return null;
    const [r, g, bl] = [0, 2, 4].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 21;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Below this a logo would blend into its button (TikTok black on black, Snapchat yellow on yellow).
const MIN_LOGO_CONTRAST = 2;

function withAlpha(color: string, opacityPercent: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];

  if (!hex || opacityPercent >= 100) {
    return color;
  }

  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
}

export function PageView({ data, variant, lang = 'ar', children }: PageViewProps) {
  const english = lang === 'en' ? data.translations?.en : undefined;
  const name = english?.name || data.name;
  const bio = english?.bio || data.bio;
  const isPublic = variant === 'public';
  const isHeroLayout = data.profileStyle.type === 'hero' || data.profileStyle.type === 'hero_safe';
  const isBannerLayout = data.profileStyle.type === 'banner';
  const builtInFamily = (FONT_OPTIONS.find((font) => font.id === data.typography?.font) ?? FONT_OPTIONS[0]).family;
  // Note (9): an uploaded font, with the chosen built-in one as its fallback.
  const customFont = data.typography?.customFont?.url;
  useEffect(() => loadCustomFont(customFont), [customFont]);
  const fontFamily = customFont ? `${customFontFamily(customFont)}, ${builtInFamily}` : builtInFamily;
  useEffect(() => loadFont(data.typography?.font), [data.typography?.font]);
  // nameSize / bioSize override the shared size for each text.
  const textSize = data.typography?.size ?? 'medium';
  const nameSize = data.typography?.nameSize ?? textSize;
  const bioSize = data.typography?.bioSize ?? textSize;
  const { buttonStyle, theme, wallpaper } = data;
  // PAGE-06: hidden buttons stay in the editor list but are not rendered.
  // Note 25: a platform still waiting for its link is not drawn, even in the preview.
  const blocks = sectionBlocks(visibleSectionItems(data.links.filter((link) => link.url || link.linkType === 'file' || ['heading', 'text'].includes(link.display?.kind ?? ''))));
  // Note 27: official documents next to each other share one grid of cards.
  const isDocumentBlock = (block: Link[]) => block.length === 1 && block[0].display?.kind === 'document';
  const groupedBlocks = blocks.reduce<Link[][]>((result, block) => {
    const last = result[result.length - 1];
    if (last && isDocumentBlock(block) && last.every((item) => item.display?.kind === 'document')) last.push(block[0]);
    else result.push([...block]);
    return result;
  }, []);

  const backgroundStyle =
    wallpaper.type === 'gradient'
      ? { background: wallpaper.value }
      : { backgroundColor: wallpaper.type === 'video' || wallpaper.type === 'image' ? theme.background : wallpaper.value };

  const accentColor =
    buttonStyle.useCustomColor && buttonStyle.customColor ? buttonStyle.customColor : theme.buttonColor;
  const buttonTextColor = buttonStyle.textColor || (buttonStyle.border ? accentColor : theme.buttonTextColor);
  // Exact sizes from «تحكم دقيق» (note 34); a preset alone keeps its classes.
  const metrics = buttonMetrics(buttonStyle);
  const sizeStyle = metrics.custom ? { minHeight: metrics.height, paddingTop: 6, paddingBottom: 6, fontSize: metrics.font } : {};
  const fontWeight = buttonStyle.fontWeight ? FONT_WEIGHTS[buttonStyle.fontWeight] : 600;
  const headingColor = data.customColors?.headingColor || data.customColors?.nameColor || theme.textColor;
  const paragraphColor = data.customColors?.paragraphColor || data.customColors?.bioColor || theme.textColor;
  // What a logo sits on: the button fill, or the page behind an outline-only button.
  const buttonSurface = buttonStyle.border ? (wallpaper.type === 'color' ? wallpaper.value : theme.background) : accentColor;

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
      size="large"
      backgroundColor={isHeroLayout && (wallpaper.type === 'color' || wallpaper.type === 'gradient') ? wallpaper.value : undefined}
    />
  );

  // Note 27: an official document as a formal PDF card.
  const renderDocument = (link: Link) => {
    const kind = OFFICIAL_DOCUMENTS.find((item) => item.id === link.display?.docType);
    const label = lang === 'en' ? kind?.titleEn ?? link.titleEn ?? link.title : link.title;
    return (
      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border px-3 pb-3 pt-4 text-center transition-opacity hover:opacity-90" style={{ borderColor: withAlpha(theme.textColor, 18), backgroundColor: withAlpha(theme.background, 70), color: theme.textColor }}>
        <span className="relative flex h-14 w-11 items-end justify-center rounded-[6px] border bg-white pb-1.5 shadow-sm" style={{ borderColor: '#e5e5ea' }} aria-hidden="true">
          <span className="absolute left-0 top-0 h-3 w-3 rounded-br-[4px] bg-[#e5e5ea]" />
          <span className="rounded-[3px] bg-[#c0392b] px-1 text-[9px] font-black leading-4 text-white">PDF</span>
        </span>
        <span className="line-clamp-2 text-[13px] font-bold leading-5">{label}</span>
        <span className="text-[11px] opacity-60">{lang === 'en' ? 'View document' : 'عرض الوثيقة'}</span>
      </a>
    );
  };

  const renderLink = (link: Link) => {
    if (link.display?.kind === 'document') return renderDocument(link);
    if (link.display?.kind === 'text') return <p key={link.id} className="whitespace-pre-wrap break-words text-start text-base leading-relaxed" style={{ color: paragraphColor }}>{(lang === 'en' && link.display.bodyEn) || link.display.body}</p>;
    if (link.display?.kind === 'video') return <VideoBlock key={`${link.id}:${link.url}`} url={link.url} title={(lang === 'en' && link.titleEn) || link.title} textColor={data.customColors?.bioColor || theme.textColor} surfaceColor={theme.background} />;
    if (link.display?.kind === 'heading') return <h2 key={link.id} className="break-words pt-5 pb-1 text-start text-lg font-bold" style={{ color: headingColor }}>{(lang === 'en' && link.titleEn) || link.title}</h2>;
    if (link.display?.layout === 'card' && link.display.image) return <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" download={link.linkType === 'file' ? link.fileName || true : undefined} className={`block w-full overflow-hidden transition-opacity hover:opacity-90 ${BUTTON_SHAPES[buttonStyle.shape]} ${buttonStyle.shadow ? 'shadow-lg' : ''} ${buttonStyle.border ? 'border-2' : ''}`} style={{ backgroundColor: buttonStyle.border ? 'transparent' : withAlpha(accentColor, buttonStyle.opacity ?? 100), color: buttonTextColor, borderColor: accentColor }}>
      <div className="aspect-video w-full overflow-hidden bg-black/5 sm:aspect-[2.2/1]"><img src={link.display.image} alt="" loading="lazy" className="h-full w-full" style={{ objectFit: link.display.imageFit ?? 'cover', objectPosition: `${link.display.positionX ?? 50}% ${link.display.positionY ?? 50}%` }} /></div>
      <span className={`block break-words ${BUTTON_SIZES[buttonStyle.size ?? 'medium']} ${link.textPosition === 'right' ? 'text-start' : 'text-center'}`} style={{ ...sizeStyle, minHeight: undefined, fontWeight }}>{(lang === 'en' && link.titleEn) || link.title}</span>
    </a>;

    const platform = link.linkType === 'file' && link.fileMimeType?.startsWith('image/') ? 'image' : link.platform || 'website';
    // Each logo keeps its brand colour unless it would vanish on the
    // button; then it takes the button text colour, which always reads.
    const brand = brandColor(platform);
    // Library icons have no brand colour: they follow the button text.
    const customIconColor = buttonStyle.iconColor === 'custom' && buttonStyle.iconCustomColor ? buttonStyle.iconCustomColor : undefined;
    const useText = buttonStyle.iconColor === 'text' || link.iconStyle === 'mono' || link.customIcon?.startsWith('icon:') || contrastRatio(brand, buttonSurface) < MIN_LOGO_CONTRAST;
    const icon = (
      <SocialIcon
        platform={platform}
        iconStyle="color"
        color={customIconColor ?? (useText ? buttonTextColor : brand)}
        customIcon={link.customIcon}
        className="flex-shrink-0"
        size={metrics.icon}
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
          color: buttonTextColor,
          borderColor: accentColor,
          ...sizeStyle,
        }}
      >
        {(link.textPosition || 'center') === 'center' ? (
          // تخطيط مركز: نص في الوسط وأيقونة على الطرف
          <>
            <span className="min-w-0 flex-1 break-words text-center" style={{ fontWeight }}>{(lang === 'en' && link.titleEn) || link.title}</span>
            {icon}
          </>
        ) : (
          // تخطيط يمين: أيقونة ونص على اليمين
          <>
            {icon}
            <span className="min-w-0 break-words" style={{ fontWeight }}>{(lang === 'en' && link.titleEn) || link.title}</span>
            <span className="flex-1"></span>
          </>
        )}
      </a>
    );

  };

  // Note 03 (updated): on a wide screen the public page stays in the middle
  // with a flexible width up to 680 px; the sides continue the page's own
  // background — its photo or video poster enlarged and softly blurred, tinted
  // with the page colour, or the same colour / gradient with a soft glow.
  const backdropImage = wallpaper.type === 'image' ? wallpaper.value : wallpaper.type === 'video' ? wallpaper.poster : undefined;
  const backdrop = isPublic && (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true" style={backdropImage ? { backgroundColor: theme.background } : backgroundStyle}>
      {backdropImage && <div className="absolute -inset-24 bg-cover bg-center" style={{ backgroundImage: `url(${backdropImage})`, filter: 'blur(60px) saturate(1.15)', transform: 'scale(1.2)' }} />}
      {backdropImage
        ? <div className="absolute inset-0" style={{ backgroundColor: withAlpha(theme.background, 40) }} />
        : <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${withAlpha('#ffffff', 22)}, transparent 65%)` }} />}
    </div>
  );

  const page = (
    <div
      className={
        isPublic
          // Content starts at the top (not vertically centred), so a short page
          // has no empty band above the photo.
          ? 'relative mx-auto flex min-h-screen w-full max-w-[680px] items-start justify-center overflow-hidden transition-all duration-500 min-[680px]:shadow-[0_8px_48px_rgba(0,0,0,0.12)]'
          : `relative w-full rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
              isHeroLayout ? 'min-h-[700px]' : 'min-h-[600px]'
            }`
      }
      style={{ ...backgroundStyle, color: theme.textColor, fontFamily }}
      dir={lang === 'en' ? 'ltr' : 'rtl'}
    >
      {wallpaper.type === 'image' && <WallpaperImage wallpaper={wallpaper} />}
      {wallpaper.type === 'video' && <VideoBackground src={wallpaper.value} poster={wallpaper.poster} position={wallpaper.position} />}
      {(wallpaper.type === 'image' || wallpaper.type === 'video') && !!wallpaper.dim && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: Math.min(wallpaper.dim, 80) / 100 }}
        />
      )}

      <div className={`relative w-full ${isPublic ? 'max-w-[600px]' : 'max-w-md'}`}>
        {isHeroLayout && (
          <div className="overflow-hidden rounded-t-3xl relative">{profileImage}</div>
        )}
        {isBannerLayout && <div className="relative">{profileImage}</div>}

        <div
          className={`flex flex-col items-center ${
            `px-4 sm:px-8 ${isHeroLayout ? 'pt-6' : isBannerLayout ? 'pt-3' : 'pt-8'} pb-8`
          }`}
        >
          {!isHeroLayout && !isBannerLayout && profileImage}

          {(name || !isPublic) && (
            <h1
              className={`${NAME_SIZES.public[nameSize]} font-black mb-3 text-center ${
                isHeroLayout ? 'mt-0 drop-shadow-md' : 'mt-4'
              }`}
              style={{ color: data.customColors?.nameColor || theme.textColor, fontSize: data.typography?.namePx ? `${data.typography.namePx}px` : undefined }}
            >
              {name || 'اسم الجهة'}
            </h1>
          )}

          {(bio || !isPublic) && (
            <p
              className={`${BIO_SIZES.public[bioSize]} opacity-90 mb-4 text-center max-w-sm whitespace-pre-line`}
              style={{ color: data.customColors?.bioColor || theme.textColor, fontSize: data.typography?.bioPx ? `${data.typography.bioPx}px` : undefined }}
            >
              {bio || 'أضف تعريفًا قصيرًا بالجهة ونشاطها'}
            </p>
          )}

          {!!data.username && (
            <div
              className={`text-sm text-center mb-6`}
              style={{
                color: data.customColors?.usernameColor || theme.textColor,
                opacity: data.customColors?.usernameColor ? 1 : 0.7,
              }}
              dir="ltr"
            >
              {pageHost(data.username)}
            </div>
          )}

          <div className={`w-full space-y-4`}>
            {groupedBlocks.map(block => block[0].display?.kind === 'document'
              ? <div key={block[0].id} className="grid grid-cols-2 gap-3">{block.map(renderDocument)}</div>
              : block[0].display?.kind === 'heading' && block[0].display.sectionId
              ? <SectionLayout key={`${block[0].id}:${block[0].display.sectionLayout ?? 'list'}`} heading={block[0]} items={block.slice(1)} renderItem={renderLink} lang={lang} />
              : block.map(renderLink))}
          </div>

          {children}
        </div>
      </div>
    </div>
  );

  return isPublic ? <div className="relative min-h-screen">{backdrop}{page}</div> : page;
}
