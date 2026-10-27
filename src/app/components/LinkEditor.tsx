import { parseYouTubeVideoSource } from '../../../shared/videoSources';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, LinkDisplay, usePageContext } from '../context/PageContext';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  GripVertical,
  Link2,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { SOCIAL_PLATFORMS, SocialIcon } from './SocialIcons';
import { ConfirmSheet, Group, Panel, Segmented } from './ios';
import { ImageCropper } from './ImageCropper';
import { LinkAppearanceEditor } from './LinkAppearanceEditor';
import { OfficialDocumentsEditor } from './OfficialDocumentsEditor';
import { LINK_ICONS } from '../lib/linkIcons';
import { MAX_LINKS } from '../lib/site';

// «المحتوى»: a calm list with one «+ إضافة محتوى», then four kinds to choose
// from (رابط، ملف، نص، مجموعة), then only the fields that kind needs; the rest
// waits behind «خيارات إضافية». Every kind is one of the existing stored forms
// (link, file, text paragraph, heading / section), so nothing new is saved.

type ContentKind = 'link' | 'file' | 'text' | 'group';
// Note (5): «تواصل اجتماعي» picks a platform (searchable); its logo follows.
type LinkMode = 'url' | 'social' | 'whatsapp' | 'email';
type FileCategory = 'cv' | 'menu' | 'other';

type FormState = {
  kind: ContentKind;
  mode: LinkMode;
  // «نص» is a paragraph (نبذة) or a standalone heading (عنوان).
  textStyle: 'body' | 'heading';
  title: string;
  // Until the title is typed by hand it follows the link (platform / site name).
  titleTouched: boolean;
  titleEn: string;
  url: string;
  platform: string;
  iconStyle: 'color' | 'mono';
  textPosition: 'center' | 'right';
  fileCategory: FileCategory;
  fileName: string;
  fileMimeType: string;
  fileSize?: number;
  customIcon: string;
  display: LinkDisplay;
  sectionMembers: string[];
};

type Screen = { name: 'list' } | { name: 'choose' } | { name: 'form'; id?: string };

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// FILE-01: صور وPDF فقط — must match ALLOWED_FILE_MIME_TYPES in api/_lib/page.ts.
const ALLOWED_FILE_TYPES = [...IMAGE_TYPES, 'application/pdf'];
// REQ-001: PDFs allow 10 MB; images retain their existing cap.
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_ICON_SOURCE_SIZE = 8 * 1024 * 1024;
const WHATSAPP_PREFIX = 'https://wa.me/966';
// General buttons can carry their own icon (D-11); brand platforms keep their logo.
const ICON_PLATFORMS = ['website', 'custom', 'file'];

const KINDS: { id: ContentKind; label: string; hint: string; Icon: typeof Link2; tone: string }[] = [
  { id: 'link', label: 'رابط', hint: 'المواقع الخارجية ووسائل التواصل', Icon: Link2, tone: 'bg-[#0a84ff]/10 text-[#0a84ff]' },
  { id: 'file', label: 'ملف', hint: 'الصور وملفات PDF', Icon: FileText, tone: 'bg-[#ff9500]/12 text-[#c76a00]' },
  { id: 'text', label: 'نص', hint: 'عنوان أو نبذة داخل الصفحة', Icon: Type, tone: 'bg-[#34c759]/12 text-[#1f8a3b]' },
  { id: 'group', label: 'مجموعة', hint: 'تنظيم عدة عناصر تحت عنوان', Icon: FolderOpen, tone: 'bg-[#af52de]/12 text-[#8e3bb8]' },
];

const PLATFORM_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(twitter|x)\.com$/, 'twitter'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/, 'youtube'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)snapchat\.com$/, 'snapchat'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)(t\.me|telegram\.me|telegram\.org)$/, 'telegram'],
];

function hostOf(raw: string) {
  const value = raw.trim();
  if (!value) return '';
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

// Known platforms by the link's host (not a substring, so «netflix.com» is not X).
function detectPlatform(raw: string) {
  if (/^mailto:/i.test(raw.trim())) return 'email';
  const host = hostOf(raw);
  if (!host) return null;
  return PLATFORM_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'website';
}

// Social platforms offered in «تواصل اجتماعي» (WhatsApp and email have their own tabs).
const SOCIAL_IDS: string[] = SOCIAL_PLATFORMS.map((platform) => platform.id as string).filter((id) => !['file', 'email', 'whatsapp', 'custom', 'website'].includes(id));

const platformName = (id: string) => (id === 'twitter' ? 'X' : SOCIAL_PLATFORMS.find((platform) => platform.id === id)?.name ?? '');

function suggestedTitle(form: FormState) {
  if (form.mode === 'whatsapp') return 'واتساب';
  if (form.mode === 'email') return 'راسلنا';
  if (form.platform === 'website' || form.platform === 'custom') return hostOf(form.url);
  return platformName(form.platform);
}

function emptyForm(kind: ContentKind): FormState {
  return {
    kind,
    mode: 'url',
    textStyle: 'body',
    title: '',
    titleTouched: false,
    titleEn: '',
    url: '',
    platform: kind === 'file' ? 'file' : kind === 'link' ? 'website' : 'custom',
    iconStyle: 'color',
    textPosition: 'center',
    fileCategory: 'other',
    fileName: '',
    fileMimeType: '',
    customIcon: '',
    display: kind === 'text' ? { kind: 'text', body: '' } : kind === 'group' ? { kind: 'heading', sectionId: crypto.randomUUID() } : {},
    sectionMembers: [],
  };
}

function kindOf(link: Link): ContentKind {
  if (link.display?.kind === 'heading') return link.display.sectionId ? 'group' : 'text';
  if (link.display?.kind === 'text') return 'text';
  return link.linkType === 'file' ? 'file' : 'link';
}

function formFromLink(link: Link, links: Link[]): FormState {
  const kind = kindOf(link);
  const sectionId = link.display?.sectionId;
  return {
    kind,
    mode: link.platform === 'whatsapp' && link.url.startsWith(WHATSAPP_PREFIX) ? 'whatsapp' : link.platform === 'email' && link.url.startsWith('mailto:') ? 'email' : SOCIAL_IDS.includes(link.platform || '') ? 'social' : 'url',
    textStyle: link.display?.kind === 'heading' ? 'heading' : 'body',
    title: link.title,
    titleTouched: true,
    titleEn: link.titleEn || '',
    url: link.url,
    platform: link.platform || (kind === 'file' ? 'file' : 'custom'),
    iconStyle: link.iconStyle || 'color',
    textPosition: link.textPosition || 'center',
    fileCategory: link.fileCategory || 'other',
    fileName: link.fileName || '',
    fileMimeType: link.fileMimeType || '',
    fileSize: link.fileSize,
    customIcon: link.customIcon || '',
    display: link.display || {},
    sectionMembers: kind === 'group' && sectionId ? links.filter((item) => item.display?.kind !== 'heading' && item.display?.sectionId === sectionId).map((item) => item.id) : [],
  };
}

function isReady(form: FormState) {
  if (form.kind === 'text') return form.textStyle === 'heading' ? Boolean(form.title.trim()) : Boolean(form.display.body?.trim() && form.display.body.length <= 2000);
  if (form.kind === 'group') return Boolean(form.title.trim());
  if (!form.title.trim() || !form.url.trim()) return false;
  if (form.display.kind === 'video') return Boolean(parseYouTubeVideoSource(form.url));
  if (form.mode === 'email') return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.url);
  if (form.mode === 'whatsapp') return /^https:\/\/wa\.me\/9665\d{8}$/.test(form.url);
  return form.display.layout !== 'card' || Boolean(form.display.image);
}

function formatFileSize(size?: number) {
  if (!size || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

// Note 25: chosen at signup, link not added yet.
const isIncomplete = (link: Link) => !link.url && link.linkType !== 'file' && !['heading', 'text'].includes(link.display?.kind ?? '');

function itemSubtitle(link: Link, links: Link[]) {
  if (isIncomplete(link)) return 'يرجى إكمال الرابط';
  if (link.hidden) return 'مخفي عن الزوار';
  const kind = link.display?.kind;
  if (kind === 'text') return 'نبذة';
  if (kind === 'video') return 'فيديو يوتيوب داخل الصفحة';
  if (kind === 'document') return `وثيقة رسمية · PDF${link.fileSize ? ` · ${formatFileSize(link.fileSize)}` : ''}`;
  if (kind === 'heading') {
    if (!link.display?.sectionId) return 'عنوان';
    const count = links.filter((item) => item.display?.kind !== 'heading' && item.display?.sectionId === link.display?.sectionId).length;
    return count ? `مجموعة · ${count} ${count === 1 ? 'عنصر' : count === 2 ? 'عنصران' : count <= 10 ? 'عناصر' : 'عنصرًا'}` : 'مجموعة فارغة';
  }
  if (link.display?.layout === 'card') return 'بطاقة مصوّرة';
  if (link.linkType === 'file') return [link.fileMimeType === 'application/pdf' ? 'PDF' : 'صورة', formatFileSize(link.fileSize)].filter(Boolean).join(' · ');
  if (link.url.startsWith(WHATSAPP_PREFIX)) return `+966 ${link.url.slice(WHATSAPP_PREFIX.length)}`;
  return link.url.replace(/^mailto:/i, '').replace(/^https?:\/\/(www\.)?/i, '');
}

function ItemIcon({ link }: { link: Link }) {
  const kind = link.display?.kind;
  if (kind === 'text') return <Type className="h-5 w-5 text-[#1f8a3b]" />;
  if (kind === 'video') return <PlayCircle className="h-5 w-5 text-[#ff3b30]" />;
  if (kind === 'heading') return link.display?.sectionId ? <FolderOpen className="h-5 w-5 text-[#8e3bb8]" /> : <Type className="h-5 w-5 text-[#6e6e73]" />;
  if (link.display?.layout === 'card' && link.display.image) return <img src={link.display.image} alt="" className="h-full w-full rounded-[10px] object-cover" />;
  return <SocialIcon platform={link.linkType === 'file' && link.fileMimeType?.startsWith('image/') ? 'image' : link.platform || 'custom'} iconStyle={link.iconStyle || 'color'} customIcon={link.customIcon} color={link.customIcon?.startsWith('icon:') ? '#3a3a3c' : undefined} className="h-5 w-5" />;
}

function Advanced({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-white px-4 text-[15px] text-[#1d1d1f]">
        خيارات إضافية
        <ChevronDown className={`h-4 w-4 text-[#8e8e93] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4 space-y-6">{children}</div>}
    </section>
  );
}

// `onPendingChange`: the editor window is told while a form holds unadded
// input, so closing it never drops that input silently.
// `officialDocuments` (note 27, nonprofit editor) adds «الوثائق الرسمية» above the list.
export function LinkEditor({ onPendingChange, officialDocuments }: { onPendingChange?: (pending: boolean) => void; officialDocuments?: boolean } = {}) {
  const { pageData, addLink, removeLink, updateLink, moveLink, reorderLink } = usePageContext();
  const links = pageData.links;
  const limitReached = links.length >= MAX_LINKS;
  // The English fields appear once the page has an English version.
  const hasEnglish = Boolean(pageData.translations?.en?.name || pageData.translations?.en?.bio);
  const groups = links.filter((item) => item.display?.kind === 'heading' && item.display.sectionId);

  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [form, setForm] = useState<FormState>(() => emptyForm('link'));
  const formStart = useRef('');
  const [fileError, setFileError] = useState('');
  const [iconError, setIconError] = useState('');
  const [iconsOpen, setIconsOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  const [iconCrop, setIconCrop] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'leave' } | { kind: 'deleteGroup'; link: Link; count: number }>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef<HTMLDivElement>(null);

  // Each new screen starts at its top (not on first opening the panel).
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return; }
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [screen]);

  const openForm = (next: FormState, id?: string) => {
    setForm(next);
    formStart.current = JSON.stringify(next);
    setFileError('');
    setIconError('');
    setIconsOpen(false);
    setIconQuery('');
    setActionsFor(null);
    setScreen({ name: 'form', id });
  };

  const formChanged = screen.name === 'form' && JSON.stringify(form) !== formStart.current;
  useEffect(() => onPendingChange?.(formChanged), [formChanged, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const backToList = () => setScreen({ name: 'list' });
  const leaveForm = () => (formChanged ? setConfirm({ kind: 'leave' }) : backToList());

  const update = (changes: Partial<FormState>) => setForm((prev) => {
    const next = { ...prev, ...changes };
    return next.titleTouched || next.kind !== 'link' ? next : { ...next, title: suggestedTitle(next) };
  });

  const webMode = (mode: LinkMode) => mode === 'url' || mode === 'social';
  const setLinkMode = (mode: LinkMode) => update({
    mode,
    // Moving between «رابط» and «تواصل اجتماعي» keeps the link and its platform.
    platform: webMode(mode) ? (webMode(form.mode) ? form.platform : 'website') : mode,
    url: mode === form.mode || (webMode(mode) && webMode(form.mode)) ? form.url : '',
    display: { ...form.display, kind: undefined },
  });
  const [platformQuery, setPlatformQuery] = useState('');

  const submit = () => {
    if (!isReady(form)) return;
    const isHeading = form.kind === 'group' || (form.kind === 'text' && form.textStyle === 'heading');
    const display: LinkDisplay = form.kind === 'group'
      ? { ...form.display, kind: 'heading', sectionId: form.display.sectionId || crypto.randomUUID() }
      : isHeading
        ? { kind: 'heading' }
        : form.kind === 'text'
          ? { kind: 'text', body: form.display.body, bodyEn: form.display.bodyEn, sectionId: form.display.sectionId }
          : form.display;
    const isFile = form.kind === 'file';
    const values: Omit<Link, 'id'> = {
      display,
      title: form.kind === 'text' && !isHeading ? form.display.body!.trim().slice(0, 80) : form.title.trim(),
      titleEn: form.titleEn.trim() || undefined,
      url: isHeading || form.kind === 'text' ? '' : form.url.trim(),
      platform: (isHeading || form.kind === 'text' ? 'custom' : isFile ? 'file' : form.platform) as Link['platform'],
      iconStyle: form.iconStyle,
      textPosition: form.textPosition,
      linkType: isFile ? 'file' : 'url',
      fileCategory: isFile ? form.fileCategory : undefined,
      fileName: isFile ? form.fileName.trim() || undefined : undefined,
      fileMimeType: isFile ? form.fileMimeType.trim() || undefined : undefined,
      fileSize: isFile ? form.fileSize : undefined,
      customIcon: ICON_PLATFORMS.includes(isFile ? 'file' : form.platform) && (form.kind === 'link' || isFile) ? form.customIcon || undefined : undefined,
    };
    const members = form.kind === 'group' ? form.sectionMembers : undefined;
    // A completed platform from signup (note 25) becomes visible once its link is in.
    const wasIncomplete = screen.name === 'form' && screen.id ? links.some((link) => link.id === screen.id && isIncomplete(link)) : false;
    if (screen.name === 'form' && screen.id) updateLink(screen.id, wasIncomplete ? { ...values, hidden: false } : values, members);
    else addLink(values, members);
    backToList();
  };

  const pickFile = async (file: File) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) { setFileError('اختر صورة (PNG أو JPG أو WebP أو GIF) أو ملف PDF.'); return; }
    const isPdf = file.type === 'application/pdf';
    if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE)) { setFileError(isPdf ? 'حجم ملف PDF كبير. الحد الأقصى 10MB.' : 'حجم الصورة كبير. الحد الأقصى 3MB.'); return; }
    setFileError('');
    try {
      const url = await readFileAsDataUrl(file);
      setForm((prev) => ({
        ...prev,
        url,
        fileName: file.name,
        fileMimeType: file.type,
        fileSize: file.size,
        // The file's own name is a good first title; it stays editable.
        title: prev.titleTouched ? prev.title : file.name.replace(/\.[^.]+$/, '').slice(0, 120),
      }));
    } catch {
      setFileError('تعذر قراءة الملف. حاول مرة أخرى.');
    }
  };

  const deleteItem = (link: Link) => {
    setActionsFor(null);
    if (link.display?.kind === 'heading' && link.display.sectionId) {
      const count = links.filter((item) => item.display?.kind !== 'heading' && item.display?.sectionId === link.display?.sectionId).length;
      if (count) { setConfirm({ kind: 'deleteGroup', link, count }); return; }
    }
    removeLink(link.id);
    if (screen.name === 'form') backToList();
  };

  // Drag and drop with a finger or a mouse, from the handle (dropping onto an
  // item of a group moves the dragged item into that group, data intact).
  const dragHandlers = (id: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragId(id);
      setOverId(null);
      setActionsFor(null);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (dragId !== id) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-item-id]');
      const next = target?.dataset.itemId ?? null;
      setOverId(next && next !== id ? next : null);
    },
    onPointerUp: () => {
      if (dragId && overId) reorderLink(dragId, overId);
      setDragId(null);
      setOverId(null);
    },
    onPointerCancel: () => { setDragId(null); setOverId(null); },
  });

  // ——— «الأيقونة» ———
  const renderIconChooser = () => {
    const isFile = form.kind === 'file';
    const platform = isFile ? 'file' : form.platform;
    const canCustom = ICON_PLATFORMS.includes(platform);
    const uploaded = form.customIcon.startsWith('data:');
    const subject = `${form.title} ${form.url}`.toLowerCase();
    const suggestions = isFile
      ? (form.fileMimeType.startsWith('image/') ? ['image', 'camera', 'download', 'file'] : ['file', 'download', 'book', 'menu'])
      : /تبرع|دعم|donat/.test(subject) ? ['donate', 'heart', 'gift', 'team']
      : /متجر|تسوق|shop|store/.test(subject) ? ['store', 'cart', 'offer', 'delivery']
      : /حجز|موعد|book|reserv/.test(subject) ? ['booking', 'ticket', 'phone', 'location']
      : /موقع|خريطة|maps|location/.test(subject) ? ['location', 'globe', 'car', 'company']
      : ['globe', 'link', 'info', 'phone', 'location', 'store', 'booking', 'file'];
    const selected = form.customIcon.startsWith('icon:') ? form.customIcon.slice(5) : '';
    const query = iconQuery.trim().toLowerCase();
    const library = query
      ? LINK_ICONS.filter((icon) => `${icon.label} ${icon.id}`.toLowerCase().includes(query))
      // Note (7): a fixed order — choosing an icon only moves the blue frame, never the icons.
      : [...new Set([...suggestions, selected])].filter(Boolean).map((id) => LINK_ICONS.find((icon) => icon.id === id)).filter((icon): icon is (typeof LINK_ICONS)[number] => Boolean(icon));
    const platforms = SOCIAL_PLATFORMS.filter((item) => !['file', 'email', 'whatsapp', 'custom'].includes(item.id) && (!query || `${item.name} ${item.id}`.toLowerCase().includes(query)));
    const tile = (active: boolean) => `flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-1.5 transition-colors ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`;

    return (
      <Group title="الأيقونة">
        <button type="button" aria-expanded={iconsOpen} onClick={() => setIconsOpen(!iconsOpen)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-right">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f2f2f7]">
            <SocialIcon platform={isFile && form.fileMimeType.startsWith('image/') ? 'image' : platform} iconStyle="color" customIcon={canCustom ? form.customIcon || undefined : undefined} color={form.customIcon.startsWith('icon:') ? '#3a3a3c' : undefined} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] text-[#1d1d1f]">{form.customIcon && canCustom ? 'أيقونة مختارة' : !isFile && form.platform !== 'website' && form.platform !== 'custom' ? `${platformName(form.platform)} · تلقائيًا` : 'الأيقونة الافتراضية'}</span>
          <span className="text-sm font-bold text-[#0a84ff]">{iconsOpen ? 'إخفاء' : 'تغيير'}</span>
        </button>
        {iconsOpen && (
          <div className="space-y-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
              <input type="search" aria-label="البحث في الأيقونات" placeholder="ابحث عن أيقونة أو منصة…" value={iconQuery} onChange={(event) => setIconQuery(event.target.value)} className="h-10 w-full rounded-xl bg-[#f2f2f7] pl-3 pr-9 text-sm focus:outline-none" />
            </div>
            {!isFile && form.mode === 'url' && platforms.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-[#6e6e73]">شعار منصة</p>
                <div className="grid grid-cols-4 gap-2">
                  {platforms.map((item) => (
                    <button key={item.id} type="button" aria-pressed={form.platform === item.id} onClick={() => update({ platform: item.id, customIcon: '' })} className={`${tile(form.platform === item.id)} min-h-16`}>
                      <SocialIcon platform={item.id} iconStyle="color" className="h-5 w-5" />
                      <span className="max-w-full truncate text-[10px] text-[#6e6e73]">{item.id === 'twitter' ? 'X' : item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {canCustom ? (
              <div>
                <p className="mb-2 text-xs text-[#6e6e73]">{query ? 'من المكتبة' : 'مقترحة لهذا العنصر'}</p>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => update({ customIcon: '' })} aria-pressed={!form.customIcon} className={`${tile(!form.customIcon)} min-h-16`}>
                    <SocialIcon platform={isFile ? 'file' : platform} iconStyle="color" className="h-5 w-5" />
                    <span className="text-[10px] text-[#6e6e73]">الافتراضية</span>
                  </button>
                  {library.map(({ id, label, Icon }) => (
                    <button key={id} type="button" onClick={() => update({ customIcon: `icon:${id}` })} aria-pressed={form.customIcon === `icon:${id}`} aria-label={label} className={`${tile(form.customIcon === `icon:${id}`)} min-h-16`}>
                      <Icon className="h-5 w-5 text-[#3a3a3c]" />
                      <span className="max-w-full truncate text-[10px] text-[#6e6e73]">{label}</span>
                    </button>
                  ))}
                </div>
                {!library.length && <p className="py-2 text-center text-xs text-[#6e6e73]">لا توجد أيقونة مطابقة.</p>}
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0a84ff]/10 text-sm font-bold text-[#0a84ff] focus-within:ring-2 focus-within:ring-[#0a84ff]">
                  {uploaded ? <img src={form.customIcon} alt="" className="h-6 w-6 rounded-md object-contain" /> : <Upload className="h-4 w-4" />}
                  {uploaded ? 'تغيير الشعار المرفق' : 'إرفاق شعار خاص'}
                  <input type="file" aria-label="إرفاق شعار خاص" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    if (file.size > MAX_ICON_SOURCE_SIZE) { setIconError('الصورة كبيرة جدًا. الحد الأقصى 8MB.'); return; }
                    setIconError('');
                    readFileAsDataUrl(file).then(setIconCrop).catch(() => setIconError('تعذّر قراءة الصورة. حاول مجددًا.'));
                  }} />
                </label>
              </div>
            ) : (
              <button type="button" onClick={() => update({ platform: 'website', customIcon: '' })} className="w-full text-center text-xs font-bold text-[#0a84ff]">استخدام أيقونة عامة بدل شعار المنصة</button>
            )}
            {!!iconError && <p className="text-xs text-[#ff3b30]">{iconError}</p>}
          </div>
        )}
      </Group>
    );
  };

  const groupSelect = form.kind !== 'group' && !(form.kind === 'text' && form.textStyle === 'heading') && groups.length > 0 && (
    <Group title="المجموعة" footer="اختياري. نقل العنصر بين المجموعات يحافظ على بياناته.">
      <label className="flex min-h-[48px] items-center gap-3 px-4">
        <span className="shrink-0 text-[15px] text-[#1d1d1f]">ضمن</span>
        <select aria-label="مجموعة العنصر" value={form.display.sectionId ?? ''} onChange={(event) => update({ display: { ...form.display, sectionId: event.target.value || undefined } })} className="min-w-0 flex-1 rounded-lg bg-[#f2f2f7] px-2 py-2 text-[15px]">
          <option value="">بدون مجموعة</option>
          {groups.map((item) => <option key={item.id} value={item.display!.sectionId}>{item.title}{item.hidden ? ' (مخفية)' : ''}</option>)}
        </select>
      </label>
    </Group>
  );

  const englishTitle = hasEnglish && form.kind !== 'text' && (
    <Group title="بالإنجليزية (اختياري)">
      <div dir="ltr" className="px-4 py-1"><input value={form.titleEn} maxLength={255} onChange={(event) => update({ titleEn: event.target.value })} placeholder="Title in English" className="w-full bg-transparent py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" /></div>
    </Group>
  );

  // ——— the form of each kind ———
  const renderLinkFields = () => {
    const web = webMode(form.mode);
    const detected = web ? detectPlatform(form.url) : null;
    const youtube = web && parseYouTubeVideoSource(form.url);
    const chosen = SOCIAL_PLATFORMS.find((platform) => platform.id === form.platform);
    const query = platformQuery.trim().toLowerCase();
    const platforms = SOCIAL_IDS.map((id) => SOCIAL_PLATFORMS.find((platform) => platform.id === id)!).filter((platform) => !query || `${platform.name} ${platform.id}`.toLowerCase().includes(query));
    return (
      <>
        <Segmented options={[{ id: 'url', label: 'رابط' }, { id: 'social', label: 'تواصل اجتماعي' }, { id: 'whatsapp', label: 'واتساب' }, { id: 'email', label: 'بريد' }] as const} value={form.mode} onChange={setLinkMode} />

        {/* Note (5): the title first — what visitors read on the button. */}
        <Group title="العنوان" footer="النص الذي يراه زوارك على الزر.">
          <div className="px-4 py-1"><input aria-label="عنوان الزر" maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value, titleTouched: true })} placeholder={form.mode === 'social' && chosen && SOCIAL_IDS.includes(chosen.id) ? platformName(chosen.id) : 'عنوان الزر'} className="w-full bg-transparent py-3 text-[16px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
        </Group>

        <Group title={form.mode === 'whatsapp' ? 'رقم الواتساب' : form.mode === 'email' ? 'البريد الإلكتروني' : form.mode === 'social' ? 'رابط الحساب أو القناة' : 'الرابط'}>
          {web && (
            <div className="flex items-center gap-2 px-4 py-1">
              {/* The chosen platform's logo shows beside its link. */}
              {(form.mode === 'social' || (detected && detected !== 'website')) && <SocialIcon platform={form.platform} iconStyle="color" className="h-5 w-5 shrink-0" />}
              <input
                type="url"
                dir="ltr"
                inputMode="url"
                autoFocus={!form.url && form.mode === 'url'}
                aria-label="الرابط"
                value={form.url}
                onChange={(event) => {
                  const url = event.target.value;
                  // A known address sets its platform; otherwise a chosen platform stays.
                  const found = detectPlatform(url);
                  const platform = found && found !== 'website' ? found : form.mode === 'social' && SOCIAL_IDS.includes(form.platform) ? form.platform : found ?? 'website';
                  // A YouTube video stays a link unless chosen to play inside the page.
                  update({ url, platform, display: { ...form.display, kind: form.display.kind === 'video' && parseYouTubeVideoSource(url) ? 'video' : undefined }, customIcon: ICON_PLATFORMS.includes(platform) ? form.customIcon : '' });
                }}
                placeholder={form.mode === 'social' && chosen?.placeholder && SOCIAL_IDS.includes(chosen.id) ? chosen.placeholder : 'الصق الرابط هنا'}
                className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#1d1d1f] placeholder:text-right placeholder:text-[#c7c7cc] focus:outline-none"
              />
            </div>
          )}
          {form.mode === 'whatsapp' && (
            <label className="flex min-h-[48px] items-center gap-2 px-4" dir="ltr">
              <SocialIcon platform="whatsapp" iconStyle="color" className="h-5 w-5 shrink-0" />
              <span className="text-[16px] text-[#8e8e93]">+966</span>
              <input type="tel" inputMode="numeric" aria-label="رقم الواتساب" autoFocus value={form.url.startsWith(WHATSAPP_PREFIX) ? form.url.slice(WHATSAPP_PREFIX.length) : ''} onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').replace(/^(966|0)/, '').slice(0, 9);
                update({ url: digits ? `${WHATSAPP_PREFIX}${digits}` : '' });
              }} placeholder="5X XXX XXXX" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
            </label>
          )}
          {form.mode === 'email' && (
            <div className="flex items-center gap-2 px-4 py-1" dir="ltr">
              <SocialIcon platform="email" iconStyle="color" className="h-5 w-5 shrink-0" />
              <input type="email" inputMode="email" aria-label="البريد الإلكتروني" autoFocus value={form.url.replace(/^mailto:/i, '')} onChange={(event) => {
                const address = event.target.value.trim();
                update({ url: address ? `mailto:${address}` : '' });
              }} placeholder="name@example.com" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
            </div>
          )}
          {form.mode === 'url' && detected && detected !== 'website' && (
            <p className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1f8a3b]"><Check className="h-4 w-4" />تعرّفنا على {platformName(detected)} وأضفنا شعاره</p>
          )}
          {youtube && (
            <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 text-[15px] text-[#1d1d1f]">
              <span>تشغيل الفيديو داخل الصفحة</span>
              <input type="checkbox" checked={form.display.kind === 'video'} onChange={(event) => update({ display: { ...form.display, kind: event.target.checked ? 'video' : undefined, layout: undefined } })} className="h-5 w-5 accent-[#0a84ff]" />
            </label>
          )}
          {web && !!form.url && form.display.kind === 'video' && !youtube && <p role="alert" className="px-4 py-2 text-xs text-[#ff3b30]">ضع رابط فيديو يوتيوب محدد، وليس رابط قناة.</p>}
        </Group>

        {/* Note (5): the platform — chosen and searchable in «تواصل اجتماعي»; never required for a plain link. */}
        {form.mode === 'social' && (
          <Group title="المنصة" footer="يظهر شعارها على الزر تلقائيًا، ويمكنك تغيير الأيقونة من الأسفل.">
            <div className="space-y-3 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                <input type="search" aria-label="ابحث عن منصة" placeholder="ابحث: يوتيوب، سناب، تيك توك…" value={platformQuery} onChange={(event) => setPlatformQuery(event.target.value)} className="h-10 w-full rounded-xl bg-[#f2f2f7] pl-3 pr-9 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {platforms.map((platform) => {
                  const active = form.platform === platform.id;
                  return (
                    <button key={platform.id} type="button" aria-pressed={active} onClick={() => update({ platform: platform.id, customIcon: '' })} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 p-1.5 ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}>
                      <SocialIcon platform={platform.id} iconStyle="color" className="h-6 w-6" />
                      <span className="max-w-full truncate text-[10px] text-[#3a3a3c]">{platformName(platform.id)}</span>
                    </button>
                  );
                })}
              </div>
              {!platforms.length && <p className="py-2 text-center text-xs text-[#6e6e73]">لا توجد منصة بهذا الاسم. استخدم «رابط» لأي موقع آخر.</p>}
            </div>
          </Group>
        )}

        {form.display.kind !== 'video' && renderIconChooser()}
        <Advanced>
          {englishTitle}
          {groupSelect}
          {form.display.kind !== 'video' && <LinkAppearanceEditor display={form.display} onChange={(display) => update({ display })} />}
          {!englishTitle && !groupSelect && form.display.kind === 'video' && <p className="px-4 text-xs text-[#8e8e93]">لا توجد خيارات إضافية لهذا العنصر.</p>}
        </Advanced>
      </>
    );
  };

  const renderFileFields = () => (
    <>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#c7c7cc] bg-white px-4 py-7 text-center focus-within:border-[#0a84ff]">
        {form.url ? (
          <>
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#f2f2f7]">
              {form.fileMimeType.startsWith('image/') ? <img src={form.url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-[#c76a00]" />}
            </span>
            <span className="flex max-w-full items-center gap-1.5 text-xs text-[#6e6e73]">
              <span className="min-w-0 truncate" dir="ltr">{form.fileName || 'ملف'}</span>
              {form.fileSize ? <><span aria-hidden="true">·</span><span className="shrink-0" dir="ltr">{formatFileSize(form.fileSize)}</span></> : null}
            </span>
            <span className="text-sm font-bold text-[#0a84ff]">تغيير الملف</span>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff9500]/12 text-[#c76a00]"><Upload className="h-5 w-5" /></span>
            <span className="text-[15px] font-bold text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختيار صورة أو ملف PDF</span>
            <span className="text-xs text-[#8e8e93]">PDF حتى 10MB · الصور تُحفظ حتى 1,000KB بعد الضغط</span>
          </>
        )}
        <input type="file" aria-label="اختيار الملف" accept={ALLOWED_FILE_TYPES.join(',')} className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void pickFile(file);
        }} />
      </label>
      {!!fileError && <p role="alert" className="flex items-center gap-1 px-4 text-xs text-[#ff3b30]"><AlertCircle className="h-4 w-4" />{fileError}</p>}
      <Group title="العنوان" footer="النص الذي يراه زوارك على الزر.">
        <div className="px-4 py-1"><input aria-label="عنوان الملف" maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value, titleTouched: true })} placeholder="مثل: الملف التعريفي" className="w-full bg-transparent py-3 text-[16px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
      </Group>
      {renderIconChooser()}
      <Advanced>
        {englishTitle}
        {groupSelect}
        <LinkAppearanceEditor display={form.display} onChange={(display) => update({ display })} />
      </Advanced>
    </>
  );

  const renderTextFields = () => (
    <>
      <Segmented options={[{ id: 'body', label: 'نبذة' }, { id: 'heading', label: 'عنوان' }] as const} value={form.textStyle} onChange={(textStyle) => update({ textStyle })} />
      {form.textStyle === 'heading' ? (
        <Group title="العنوان" footer="عنوان يفصل بين أجزاء صفحتك.">
          <div className="px-4 py-1"><input aria-label="نص العنوان" autoFocus maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="مثل: خدماتنا" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
        </Group>
      ) : (
        <Group title="النبذة">
          <div className="px-4 py-3">
            <textarea aria-label="نص النبذة" autoFocus rows={5} maxLength={2000} value={form.display.body ?? ''} onChange={(event) => update({ display: { ...form.display, kind: 'text', body: event.target.value } })} placeholder="اكتب نبذة أو إعلانًا أو شرحًا يظهر في صفحتك…" className="w-full resize-y bg-transparent text-[16px] leading-relaxed text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
            <span className="block text-left text-xs text-[#8e8e93]" dir="ltr">{form.display.body?.length ?? 0}/2000</span>
          </div>
        </Group>
      )}
      {(hasEnglish || groupSelect) && (
        <Advanced>
          {hasEnglish && (form.textStyle === 'heading' ? (
            <Group title="بالإنجليزية (اختياري)">
              <div dir="ltr" className="px-4 py-1"><input value={form.titleEn} maxLength={255} onChange={(event) => update({ titleEn: event.target.value })} placeholder="Heading in English" className="w-full bg-transparent py-3 text-[15px] placeholder:text-[#c7c7cc] focus:outline-none" /></div>
            </Group>
          ) : (
            <Group title="بالإنجليزية (اختياري)">
              <div dir="ltr" className="px-4 py-3"><textarea rows={4} maxLength={2000} value={form.display.bodyEn ?? ''} onChange={(event) => update({ display: { ...form.display, bodyEn: event.target.value } })} placeholder="Optional English paragraph" className="w-full resize-y bg-transparent text-[15px] placeholder:text-[#c7c7cc] focus:outline-none" /></div>
            </Group>
          ))}
          {groupSelect}
        </Advanced>
      )}
    </>
  );

  const renderGroupFields = () => {
    const candidates = links.filter((item) => item.display?.kind !== 'heading');
    return (
      <>
        <Group title="اسم المجموعة">
          <div className="px-4 py-1"><input aria-label="اسم المجموعة" autoFocus={!form.title} maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="مثل: خدماتنا" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
        </Group>
        <Group title="عناصر المجموعة" footer={candidates.length ? 'اختياري. يمكنك أيضًا إضافة العناصر إليها لاحقًا أو سحبها إليها.' : 'أضف روابط أو ملفات، ثم اجمعها هنا.'}>
          {candidates.map((item) => {
            const elsewhere = item.display?.sectionId && item.display.sectionId !== form.display.sectionId ? groups.find((group) => group.display?.sectionId === item.display?.sectionId) : undefined;
            return (
              <label key={item.id} className="flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 text-[15px] text-[#1d1d1f]">
                <input type="checkbox" checked={form.sectionMembers.includes(item.id)} onChange={(event) => update({ sectionMembers: event.target.checked ? [...form.sectionMembers, item.id] : form.sectionMembers.filter((id) => id !== item.id) })} className="h-5 w-5 shrink-0 accent-[#0a84ff]" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {elsewhere && <span className="shrink-0 text-[11px] text-[#8e8e93]">في «{elsewhere.title}»</span>}
              </label>
            );
          })}
        </Group>
        <Advanced>
          {englishTitle}
          <Group title="طريقة عرض المجموعة">
            <div className="p-3"><Segmented options={[{ id: 'list', label: 'قائمة' }, { id: 'grid', label: 'شبكة' }, { id: 'carousel', label: 'شرائح أفقية' }] as const} value={form.display.sectionLayout ?? 'list'} onChange={(sectionLayout) => update({ display: { ...form.display, sectionLayout } })} /></div>
          </Group>
        </Advanced>
      </>
    );
  };

  const editing = screen.name === 'form' && screen.id ? links.find((item) => item.id === screen.id) : undefined;
  const kindInfo = KINDS.find((item) => item.id === form.kind)!;

  return (
    <Panel>
      <div ref={topRef} className="-mt-5 h-0" aria-hidden="true" />
      {!!iconCrop && (
        // Square and small: an icon only needs 128 px.
        <ImageCropper
          src={iconCrop}
          aspect={1}
          outputWidth={128}
          onUseOriginal={() => {
            const image = new Image();
            image.onerror = () => { setIconError('تعذّر فتح الشعار. جرّب صورة أخرى.'); setIconCrop(null); };
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 128;
              const context = canvas.getContext('2d');
              if (!context) { setIconError('تعذّر تجهيز الشعار. حاول مجددًا.'); setIconCrop(null); return; }
              const scale = Math.min(128 / image.width, 128 / image.height);
              context.drawImage(image, (128 - image.width * scale) / 2, (128 - image.height * scale) / 2, image.width * scale, image.height * scale);
              update({ customIcon: canvas.toDataURL('image/png') });
              setIconCrop(null);
            };
            image.src = iconCrop;
          }}
          onCancel={() => setIconCrop(null)}
          onConfirm={(value) => { update({ customIcon: value }); setIconCrop(null); }}
        />
      )}

      {screen.name === 'list' && (
        <>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setScreen({ name: 'choose' })}
              disabled={limitReached}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0a84ff] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              إضافة محتوى
            </button>
            <p className="px-1 text-center text-xs text-[#8e8e93]">
              {limitReached ? `وصلت إلى الحد (${MAX_LINKS}). احذف عنصرًا لتضيف غيره.` : `${links.length} من ${MAX_LINKS}`}
            </p>
          </div>

          {officialDocuments && <OfficialDocumentsEditor ref={documentsRef} />}

          {links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-10 text-center">
              <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-[#0a84ff]/10 text-[#0a84ff]"><Link2 className="h-7 w-7" /></span>
              <p className="text-[16px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>صفحتك جاهزة لأول عنصر</p>
              <p className="text-sm leading-6 text-[#6e6e73]">أضف حساباتك أو موقعك أو ملفًا يحتاجه زوارك، وسيظهر هنا بالترتيب الذي تختاره.</p>
            </div>
          ) : (
            <section>
              <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white" onPointerLeave={() => dragId && setOverId(null)}>
                {links.map((link) => {
                  const sectionKey = link.display?.sectionId;
                  const isMember = Boolean(sectionKey && link.display?.kind !== 'heading');
                  const siblings = links.filter((item) => (isMember ? item.display?.kind !== 'heading' && item.display?.sectionId === sectionKey : item.display?.kind === 'heading' || !item.display?.sectionId));
                  const index = siblings.findIndex((item) => item.id === link.id);
                  const showActions = actionsFor === link.id;
                  return (
                    <div key={link.id} data-item-id={link.id} className={`transition-colors ${overId === link.id ? 'bg-[#0a84ff]/10' : ''} ${dragId === link.id ? 'opacity-50' : ''} ${isMember ? 'border-r-[3px] border-r-[#af52de]/30 pr-3' : ''}`}>
                      <div className="flex min-h-[60px] items-center gap-1 pl-1.5 pr-1">
                        <span {...dragHandlers(link.id)} className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[#c7c7cc] active:cursor-grabbing" aria-label={`اسحب لنقل «${link.title}»`} role="button" tabIndex={-1}>
                          <GripVertical className="h-5 w-5" />
                        </span>
                        <button type="button" onClick={() => (link.display?.kind === 'document' ? documentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : openForm(formFromLink(link, links), link.id))} className={`flex min-w-0 flex-1 items-center gap-3 py-2 text-right ${link.hidden && !isIncomplete(link) ? 'opacity-45' : ''}`}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#f2f2f7]"><ItemIcon link={link} /></span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[15px] text-[#1d1d1f] ${link.display?.kind === 'heading' ? 'font-bold' : ''}`}>{link.title}</span>
                            <span className={`flex items-center gap-1 truncate text-xs ${isIncomplete(link) ? 'font-bold text-amber-700' : 'text-[#8e8e93]'}`}>{isIncomplete(link) && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />}{itemSubtitle(link, links)}</span>
                          </span>
                        </button>
                        {/* Note (8): one step up or down per tap; dragging still works. */}
                        <span className="flex shrink-0 flex-col">
                          <button type="button" disabled={index <= 0} onClick={() => moveLink(link.id, 'up')} aria-label={`نقل «${link.title}» للأعلى`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#3a3a3c] active:bg-[#f2f2f7] disabled:text-[#d1d1d6]"><ArrowUp className="h-4 w-4" /></button>
                          <button type="button" disabled={index === siblings.length - 1} onClick={() => moveLink(link.id, 'down')} aria-label={`نقل «${link.title}» للأسفل`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#3a3a3c] active:bg-[#f2f2f7] disabled:text-[#d1d1d6]"><ArrowDown className="h-4 w-4" /></button>
                        </span>
                        <button type="button" onClick={() => updateLink(link.id, { hidden: !link.hidden })} aria-label={link.hidden ? `إظهار «${link.title}»` : `إخفاء «${link.title}» دون حذفه`} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[#8e8e93] active:bg-[#f2f2f7]">
                          {link.hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                        <button type="button" onClick={() => setActionsFor(showActions ? null : link.id)} aria-expanded={showActions} aria-label={`خيارات «${link.title}»`} className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-full ${showActions ? 'bg-[#f2f2f7] text-[#1d1d1f]' : 'text-[#8e8e93]'}`}>
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                      {showActions && (
                        <div className="px-3 pb-3">
                          <button type="button" onClick={() => deleteItem(link)} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#ff3b30]/10 text-sm font-bold text-[#ff3b30]"><Trash2 className="h-4 w-4" />حذف</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1.5 px-4 text-xs leading-5 text-[#8e8e93]">اضغط على أي عنصر لتعديله، ورتّبه بالسهمين ↑↓ أو اسحبه من المقبض. العين تخفيه عن الزوار دون حذفه.</p>
            </section>
          )}
        </>
      )}

      {screen.name === 'choose' && (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={backToList} className="flex h-10 items-center gap-1 rounded-full pl-3 text-[15px] text-[#0a84ff]"><ChevronRight className="h-5 w-5" />رجوع</button>
          </div>
          <h3 className="px-1 text-xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>ماذا تريد أن تضيف؟</h3>
          <div className="grid grid-cols-2 gap-3">
            {KINDS.map(({ id, label, hint, Icon, tone }) => (
              <button key={id} type="button" onClick={() => openForm(emptyForm(id))} className="flex min-h-[132px] flex-col items-start gap-3 rounded-2xl bg-white p-4 text-right shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.97]">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon className="h-6 w-6" /></span>
                <span>
                  <span className="block text-[16px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#6e6e73]">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="px-1 text-xs leading-5 text-[#8e8e93]">المجموعات اختيارية؛ يمكنك إضافة أي محتوى مباشرة دون إنشاء مجموعة.</p>
        </>
      )}

      {screen.name === 'form' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={leaveForm} className="flex h-10 items-center gap-1 rounded-full pl-3 text-[15px] text-[#0a84ff]"><ChevronRight className="h-5 w-5" />رجوع</button>
            <span className="flex items-center gap-2 text-[15px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${kindInfo.tone}`}><kindInfo.Icon className="h-4 w-4" /></span>
              {editing ? `تعديل ${kindInfo.label}` : `${kindInfo.label} جديد${form.kind === 'group' ? 'ة' : ''}`}
            </span>
            <span className="w-16" />
          </div>

          {form.kind === 'link' && renderLinkFields()}
          {form.kind === 'file' && renderFileFields()}
          {form.kind === 'text' && renderTextFields()}
          {form.kind === 'group' && renderGroupFields()}

          <div className="space-y-3 pt-1">
            <button type="button" onClick={submit} disabled={!isReady(form)} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {editing ? 'تطبيق التعديل' : 'إضافة إلى الصفحة'}
            </button>
            {editing && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateLink(editing.id, { hidden: !editing.hidden })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-[#1d1d1f]">
                  {editing.hidden ? <><Eye className="h-4 w-4" />إظهار للزوار</> : <><EyeOff className="h-4 w-4" />إخفاء عن الزوار</>}
                </button>
                <button type="button" onClick={() => deleteItem(editing)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-[#ff3b30]"><Trash2 className="h-4 w-4" />حذف</button>
              </div>
            )}
          </div>
        </>
      )}

      {confirm?.kind === 'leave' && (
        <ConfirmSheet title="تجاهل ما كتبته؟" message="لم تُضف هذه التعديلات بعد." confirmLabel="تجاهل والرجوع" cancelLabel="متابعة التعديل" onConfirm={() => { setConfirm(null); backToList(); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm?.kind === 'deleteGroup' && (
        <ConfirmSheet
          title={`حذف مجموعة «${confirm.link.title}»؟`}
          message={`العناصر التي فيها (${confirm.count}) لن تُحذف؛ ستبقى في صفحتك خارج أي مجموعة.`}
          confirmLabel="حذف المجموعة فقط"
          cancelLabel="إلغاء"
          onConfirm={() => { removeLink(confirm.link.id); setConfirm(null); if (screen.name === 'form') backToList(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Panel>
  );
}

