import {
  Award, Bell, BookOpen, Briefcase, Building2, CalendarCheck, Camera, Car, Coffee, Download, FileText, Gift,
  Globe, GraduationCap, HandHeart, Heart, HelpCircle, Image, Info, Link, Mail, MapPin, Megaphone, MessageSquare,
  Music, Newspaper, Percent, Phone, PlayCircle, ShoppingBag, ShoppingCart, Star, Stethoscope, Tag, Ticket, Truck,
  Users, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';

// Built-in icons a link button can use instead of its platform icon (design-qa D-11).
// Stored as 'icon:<id>' in page_links.custom_icon — never rename an id.
export const LINK_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'store', label: 'متجر', Icon: ShoppingBag },
  { id: 'cart', label: 'سلة', Icon: ShoppingCart },
  { id: 'menu', label: 'قائمة طعام', Icon: UtensilsCrossed },
  { id: 'coffee', label: 'قهوة', Icon: Coffee },
  { id: 'booking', label: 'حجز', Icon: CalendarCheck },
  { id: 'location', label: 'الموقع', Icon: MapPin },
  { id: 'phone', label: 'اتصال', Icon: Phone },
  { id: 'chat', label: 'محادثة', Icon: MessageSquare },
  { id: 'mail', label: 'بريد', Icon: Mail },
  { id: 'donate', label: 'تبرع', Icon: HandHeart },
  { id: 'gift', label: 'هدية', Icon: Gift },
  { id: 'offer', label: 'عرض', Icon: Percent },
  { id: 'tag', label: 'سعر', Icon: Tag },
  { id: 'ticket', label: 'تذكرة', Icon: Ticket },
  { id: 'delivery', label: 'توصيل', Icon: Truck },
  { id: 'book', label: 'كتاب', Icon: BookOpen },
  { id: 'news', label: 'أخبار', Icon: Newspaper },
  { id: 'announce', label: 'إعلان', Icon: Megaphone },
  { id: 'video', label: 'فيديو', Icon: PlayCircle },
  { id: 'music', label: 'صوت', Icon: Music },
  { id: 'camera', label: 'صور', Icon: Camera },
  { id: 'image', label: 'صورة', Icon: Image },
  { id: 'file', label: 'ملف', Icon: FileText },
  { id: 'download', label: 'تحميل', Icon: Download },
  { id: 'jobs', label: 'وظائف', Icon: Briefcase },
  { id: 'education', label: 'تعليم', Icon: GraduationCap },
  { id: 'health', label: 'صحة', Icon: Stethoscope },
  { id: 'car', label: 'سيارات', Icon: Car },
  { id: 'team', label: 'فريقنا', Icon: Users },
  { id: 'company', label: 'الجهة', Icon: Building2 },
  { id: 'award', label: 'إنجاز', Icon: Award },
  { id: 'star', label: 'تقييم', Icon: Star },
  { id: 'heart', label: 'مفضلة', Icon: Heart },
  { id: 'bell', label: 'تنبيه', Icon: Bell },
  { id: 'info', label: 'عن الجهة', Icon: Info },
  { id: 'help', label: 'مساعدة', Icon: HelpCircle },
  { id: 'globe', label: 'موقع', Icon: Globe },
  { id: 'link', label: 'رابط', Icon: Link },
];

export function findLinkIcon(customIcon?: string) {
  if (!customIcon?.startsWith('icon:')) return undefined;
  return LINK_ICONS.find((icon) => icon.id === customIcon.slice(5));
}
