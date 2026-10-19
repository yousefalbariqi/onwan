import { findLinkIcon } from '../lib/linkIcons';
import { Instagram, Image as ImageIcon, Youtube, Linkedin, Github, Facebook, Mail, Globe, Link as LinkIcon, FileText } from 'lucide-react';

export const SOCIAL_PLATFORMS = [
  {
    id: 'instagram',
    name: 'إنستقرام',
    placeholder: 'https://instagram.com/username',
    color: '#E4405F',
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
    color: '#0077B5',
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
    color: '#1877F2',
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
    color: '#0088cc',
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
}

export function brandColor(platform: string) {
  return platform === 'image' ? '#0a84ff' : SOCIAL_PLATFORMS.find((p) => p.id === platform)?.color ?? '#6b7280';
}

export function SocialIcon({ platform, iconStyle, className = 'w-5 h-5', color: colorOverride, customIcon }: SocialIconProps) {
  const color = colorOverride ?? (iconStyle === 'color' ? brandColor(platform) : '#000000');

  if (customIcon?.startsWith('data:image/')) {
    return <img src={customIcon} alt="" className={`${className} rounded-[22%] object-cover`} />;
  }
  const libraryIcon = findLinkIcon(customIcon);
  if (libraryIcon) {
    const Icon = libraryIcon.Icon;
    return <Icon className={className} style={{ color }} strokeWidth={2} />;
  }

  const iconProps = {
    className,
    style: { color },
    strokeWidth: 2,
  };

  switch (platform) {
    case 'instagram':
      return <Instagram {...iconProps} />;
    case 'twitter':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case 'youtube':
      return <Youtube {...iconProps} />;
    case 'linkedin':
      return <Linkedin {...iconProps} />;
    case 'github':
      return <Github {...iconProps} />;
    case 'facebook':
      return <Facebook {...iconProps} />;
    case 'snapchat':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12.166,3a8.88,8.88,0,0,0-7.963,8.996,8.313,8.313,0,0,0,1.051,4.035,1.025,1.025,0,0,1-.125.969,5.87,5.87,0,0,1-.812.859.649.649,0,0,0,.421,1.108c1.264.115,2.163.4,2.4.54a.762.762,0,0,1,.346.671,5.618,5.618,0,0,0,1.992-.134,11.046,11.046,0,0,0,2.685-.864,11.046,11.046,0,0,0,2.685.864,5.618,5.618,0,0,0,1.992.134.762.762,0,0,1,.346-.671c.237-.14,1.136-.425,2.4-.54a.649.649,0,0,0,.421-1.108,5.87,5.87,0,0,1-.812-.859,1.025,1.025,0,0,1-.125-.969,8.313,8.313,0,0,0,1.051-4.035A8.88,8.88,0,0,0,12.166,3Z"/>
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
        </svg>
      );
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