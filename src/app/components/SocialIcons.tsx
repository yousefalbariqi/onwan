import { findLinkIcon } from '../lib/linkIcons';
import { BRAND_PATHS } from '../lib/brandIcons';
import { Image as ImageIcon, Mail, Globe, Link as LinkIcon, FileText } from 'lucide-react';

export const SOCIAL_PLATFORMS = [
  {
    id: 'instagram',
    name: 'إنستقرام',
    placeholder: 'https://instagram.com/username',
    color: '#FF0069',
  },
  {
    id: 'twitter',
    name: 'تويتر / X',
    placeholder: 'https://twitter.com/username',
    color: '#000000',
  },
  {
    id: 'tiktok',
    name: 'تيك توك',
    placeholder: 'https://tiktok.com/@username',
    color: '#000000',
  },
  {
    id: 'youtube',
    name: 'يوتيوب',
    placeholder: 'https://youtube.com/@channel',
    color: '#FF0000',
  },
  {
    id: 'linkedin',
    name: 'لينكد إن',
    placeholder: 'https://linkedin.com/in/username',
    color: '#0A66C2',
  },
  {
    id: 'github',
    name: 'GitHub',
    placeholder: 'https://github.com/username',
    color: '#181717',
  },
  {
    id: 'facebook',
    name: 'فيسبوك',
    placeholder: 'https://facebook.com/username',
    color: '#0866FF',
  },
  {
    id: 'snapchat',
    name: 'سناب شات',
    placeholder: 'https://snapchat.com/add/username',
    color: '#FFFC00',
  },
  {
    id: 'whatsapp',
    name: 'واتساب',
    placeholder: 'https://wa.me/966XXXXXXXXX',
    color: '#25D366',
  },
  {
    id: 'telegram',
    name: 'تيليجرام',
    placeholder: 'https://t.me/username',
    color: '#26A5E4',
  },
  {
    id: 'website',
    name: 'موقع إلكتروني',
    placeholder: 'https://example.com',
    color: '#6366f1',
  },
  {
    id: 'email',
    name: 'البريد',
    placeholder: 'name@example.com',
    color: '#EA4335',
  },
  {
    id: 'file',
    name: 'ملف PDF',
    placeholder: 'https://example.com/file.pdf',
    color: '#0f766e',
  },
  {
    id: 'custom',
    name: 'رابط مخصص',
    placeholder: 'https://example.com',
    color: '#6b7280',
  },
] as const;

interface SocialIconProps {
  platform: string;
  iconStyle: 'color' | 'mono';
  className?: string;
  // Overrides the brand colour (PageView passes the colour it chose for contrast).
  color?: string;
  // The link's own icon (page_links.custom_icon), shown instead of the platform's.
  customIcon?: string;
  size?: number;
}

export function brandColor(platform: string) {
  return platform === 'image' ? '#0a84ff' : SOCIAL_PLATFORMS.find((p) => p.id === platform)?.color ?? '#6b7280';
}

export function SocialIcon({ platform, iconStyle, className: baseClass = 'w-5 h-5', color: colorOverride, customIcon, size }: SocialIconProps) {
  // `size` (px) sets width and height together, so a logo never stretches.
  const className = size ? `${baseClass} shrink-0` : baseClass;
  const box = size ? { width: size, height: size } : {};
  const color = colorOverride ?? (iconStyle === 'color' ? brandColor(platform) : '#000000');

  if (customIcon?.startsWith('data:image/')) {
    return <img src={customIcon} alt="" className={`${className} rounded-[22%] object-cover`} style={box} />;
  }
  const libraryIcon = findLinkIcon(customIcon);
  if (libraryIcon) {
    const Icon = libraryIcon.Icon;
    return <Icon className={className} style={{ color, ...box }} strokeWidth={2} />;
  }

  const iconProps = {
    className,
    style: { color, ...box },
    strokeWidth: 2,
  };

  const brandPath = BRAND_PATHS[platform];
  if (brandPath) {
    return (
      // Snapchat's yellow ghost gets the hairline outline of its real logo, so it stays visible on light surfaces.
      <svg className={className} style={{ ...box, color, filter: color.toUpperCase() === '#FFFC00' ? 'drop-shadow(0 0 0.7px rgba(0,0,0,0.75))' : undefined }} viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        <path d={brandPath} />
      </svg>
    );
  }

  switch (platform) {
    case 'website':
      return <Globe {...iconProps} />;
    case 'email':
      return <Mail {...iconProps} />;
    case 'image':
      return <ImageIcon {...iconProps} />;
    case 'file':
      return <FileText {...iconProps} />;
    default:
      return <LinkIcon {...iconProps} />;
  }
}