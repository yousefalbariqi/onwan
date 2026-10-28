import { sectionBlocks, visibleSectionItems } from '../../../shared/linkSections';
import { ReactNode, useEffect, useRef } from 'react';
import { FONT_OPTIONS, Link, PageData } from '../context/PageContext';
import { pageHost } from '../lib/site';
import { customFontActive, customFontFamily, loadCustomFont, loadFont } from '../lib/fonts';
import { SectionLayout } from './SectionLayout';
import { VideoBlock } from './VideoBlock';
import { ITEM_SPACING, pageDesign } from '../lib/pageDesign';
import { VideoBackground } from './VideoBackground';
import { WallpaperImage } from './WallpaperImage';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { SocialIcon, brandColor } from './SocialIcons';
import { FONT_WEIGHTS, buttonMetrics } from '../lib/buttonSizes';
import { OFFICIAL_DOCUMENT_ICON } from '../lib/officialDocuments';

interface PageViewProps {
  data: PageData;
  // 'preview' is the framed card inside the builder; 'public' is the real,
  // full-screen page. Both render the same components so they cannot drift.
  variant: 'preview' | 'public';
  // PAGE-16: 'en' shows the manually entered English text where it exists.
  lang?: 'ar' | 'en';
  children?: ReactNode;
  // Note 22: the editor's own preview also shows items chosen but not yet
  // completed, faded with a small mark. Note 23: there, tapping any item opens
  // it in «المحتوى» instead of following it. Never set for visitors.
  showIncomplete?: boolean;
  onItemClick?: (id: string) => void;
}

// Note 44: a picture card's photo in its fixed frame — moved and zoomed as set
// in the editor, never stretched. Shared with the editor's own frame.
export const cardImageStyle = (display: { imageFit?: 'cover' | 'contain'; positionX?: number; positionY?: number; zoom?: number }): React.CSSProperties => {
  const origin = `${display.positionX ?? 50}% ${display.positionY ?? 50}%`;
  return { objectFit: display.imageFit ?? 'cover', objectPosition: origin, transform: display.zoom && display.zoom > 1 ? `scale(${display.zoom})` : undefined, transformOrigin: origin };
};

const isIncompleteItem = (link: Link) => !link.url && !['heading', 'text'].includes(link.display?.kind ?? '');

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

export function PageView({ data, variant, lang = 'ar', children, showIncomplete = false, onItemClick }: PageViewProps) {
  const english = lang === 'en' ? data.translations?.en : undefined;
  const name = english?.name || data.name;
  const bio = english?.bio || data.bio;
  const isPublic = variant === 'public';
  const isHeroLayout = data.profileStyle.type === 'hero' || data.profileStyle.type === 'hero_safe';
  const isBannerLayout = data.profileStyle.type === 'banner';
  const builtInFamily = (FONT_OPTIONS.find((font) => font.id === data.typography?.font) ?? FONT_OPTIONS[0]).family;
  // Note (9): an uploaded font, with the chosen built-in one as its fallback.
  const customFont = customFontActive(data.typography) ? data.typography?.customFont?.url : undefined;
  // Note 26: loaded into the document this page is drawn in (the preview frame too).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => loadCustomFont(customFont, rootRef.current?.ownerDocument), [customFont]);
  const fontFamily = customFont ? `${customFontFamily(customFont)}, ${builtInFamily}` : builtInFamily;
  useEffect(() => loadFont(data.typography?.font), [data.typography?.font]);
  // nameSize / bioSize override the shared size for each text.
  const textSize = data.typography?.size ?? 'medium';
  const nameSize = data.typography?.nameSize ?? textSize;
  const bioSize = data.typography?.bioSize ?? textSize;
  const { buttonStyle, theme, wallpaper } = data;
  const design = pageDesign(data);
  // PAGE-06: hidden buttons stay in the editor list but are not rendered.
  // Note 25: a platform still waiting for its link is not drawn, even in the preview.
  // Incomplete items are kept hidden from visitors; the editor preview un-hides them.
  const shownLinks = showIncomplete ? data.links.map((link) => (isIncompleteItem(link) ? { ...link, hidden: false } : link)) : data.links;
  const blocks = sectionBlocks(visibleSectionItems(shownLinks.filter((link) => link.url || link.linkType === 'file' || ['heading', 'text'].includes(link.display?.kind ?? '') || (showIncomplete && isIncompleteItem(link)))));

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

  // Note 22: an incomplete item in its final shape, faded, with a small mark.
  // Note 23: in the editor every item is a way into its own settings.
  const renderItem = (link: Link) => {
    const incomplete = showIncomplete && isIncompleteItem(link);
    if (!incomplete && !onItemClick) return renderLink(link);
    const inner = incomplete && link.display?.kind === 'video'
      ? <div className={`flex aspect-video w-full items-center justify-center ${design.mediaRadius} bg-black/80 text-white`}><svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></div>
      : renderLink(link);
    const open = onItemClick && (() => onItemClick(link.id));
    return (
      <div key={link.id} role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined} title={open ? 'اضغط للتعديل' : undefined}
        className={`relative [&>a]:h-full ${incomplete ? 'opacity-55' : ''} ${open ? 'cursor-pointer rounded-xl outline-2 outline-offset-2 outline-transparent transition-[outline-color,opacity] hover:outline-[#0a84ff]/50 [outline-style:solid]' : ''}`}
        onClickCapture={open ? (event) => { event.preventDefault(); event.stopPropagation(); open(); } : undefined}
        onKeyDown={open ? (event) => { if (event.key === 'Enter') open(); } : undefined}>
        {inner}
        {/* A playing video would swallow the tap; in the editor it opens the item instead. */}
        {open && link.display?.kind === 'video' && <span className="absolute inset-0" aria-hidden="true" />}
        {incomplete && <span className="pointer-events-none absolute -top-1.5 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>غير مكتمل</span>}
      </div>
    );
  };

  const renderLink = (link: Link) => {
    if (link.display?.kind === 'text') return <p key={link.id} className={`whitespace-pre-wrap break-words text-start ${design.paragraph} leading-relaxed`} style={{ color: paragraphColor }}>{(lang === 'en' && link.display.bodyEn) || link.display.body}</p>;
    if (link.display?.kind === 'video') return <VideoBlock key={`${link.id}:${link.url}`} url={link.url} title={(lang === 'en' && link.titleEn) || link.title} caption={link.display.caption} textColor={paragraphColor} radiusClass={design.mediaRadius} />;
    // Note 38: a group's title already sits after the page's 16 px gap, so it
    // adds only a little; a standalone heading keeps its larger lead.
    if (link.display?.kind === 'heading') return <h2 key={link.id} className={`break-words ${link.display.sectionId ? 'pt-1' : 'pt-5'} pb-1 text-start ${design.heading} font-bold`} style={{ color: headingColor }}>{(lang === 'en' && link.titleEn) || link.title}</h2>;
    // Note 35 / 44: a picture card — a fixed video-shaped (16:9) frame on top (cropped where its owner
    // set it, never stretched) and the button under it. A «pill» button style
    // would turn the card into an oval, so cards keep rounded corners instead.
    if (link.display?.layout === 'card' && link.display.image) return <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" download={link.linkType === 'file' ? link.fileName || true : undefined} className={`block w-full overflow-hidden transition-opacity hover:opacity-90 ${buttonStyle.shape === 'pill' ? 'rounded-3xl' : BUTTON_SHAPES[buttonStyle.shape]} ${buttonStyle.shadow ? 'shadow-lg' : ''} ${buttonStyle.border ? 'border-2' : ''}`} style={{ backgroundColor: buttonStyle.border ? 'transparent' : withAlpha(accentColor, buttonStyle.opacity ?? 100), color: buttonTextColor, borderColor: accentColor }}>
      <div className="aspect-video w-full overflow-hidden bg-black/5"><img src={link.display.image} alt="" loading="lazy" className="h-full w-full" style={cardImageStyle(link.display)} /></div>
      <span className={`block break-words ${BUTTON_SIZES[buttonStyle.size ?? 'medium']} ${link.textPosition === 'right' ? 'text-start' : 'text-center'}`} style={{ ...sizeStyle, minHeight: undefined, fontWeight }}>{(lang === 'en' && link.titleEn) || link.title}</span>
    </a>;

    const platform = link.linkType === 'file' && link.fileMimeType?.startsWith('image/') ? 'image' : link.platform || 'website';
    // Note 24: an official document is a button like any other, with the
    // documents' own mark unless its owner chose another icon.
    const itemIcon = link.customIcon ?? (link.display?.kind === 'document' ? OFFICIAL_DOCUMENT_ICON : undefined);
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
        customIcon={itemIcon}
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
      ref={rootRef}
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

          <div className={`w-full ${ITEM_SPACING[design.spacing]}`}>
            {blocks.map(block => block[0].display?.kind === 'heading' && block[0].display.sectionId
              ? <SectionLayout key={`${block[0].id}:${block[0].display.sectionLayout ?? 'list'}`} heading={block[0]} items={block.slice(1)} renderItem={renderItem} lang={lang} spacing={design.spacing} />
              : block.map(renderItem))}
          </div>

          {children}
        </div>
      </div>
    </div>
  );

  return isPublic ? <div className="relative min-h-screen">{backdrop}{page}</div> : page;
}
