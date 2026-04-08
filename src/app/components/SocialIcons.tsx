import { Instagram, MessageCircle, Youtube, Linkedin, Github, Facebook, Mail, Globe, Link as LinkIcon } from 'lucide-react';

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
    name: 'بريد إلكتروني',
    placeholder: 'mailto:email@example.com',
    color: '#EA4335',
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
}

export function SocialIcon({ platform, iconStyle, className = 'w-5 h-5' }: SocialIconProps) {
  const platformData = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  const color = iconStyle === 'color' ? platformData?.color : '#000000';

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
      return <MessageCircle {...iconProps} />;
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
    default:
      return <LinkIcon {...iconProps} />;
  }
}