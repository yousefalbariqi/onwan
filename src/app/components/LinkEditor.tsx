import './mobileContent.css';
import { AutoSaveStatus } from './AutoSaveStatus';
import { contentBack, type ContentScreen } from '../../../shared/contentNavigation';
import { FormattingTextarea } from './FormattingTextarea';
import { parseYouTubeVideoSource } from '../../../shared/videoSources';
import { useEffect, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import { draftHasContent } from '../lib/editorPreview';
import { ImageProblem, compressImage, MAX_SOURCE_BYTES } from '../lib/compressImage';
import { flushSync } from 'react-dom';
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
import { OFFICIAL_DOCUMENT_ICON } from '../lib/officialDocuments';
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
  // Note B: the platform badge was chosen by hand, so editing the URL keeps it.
  platformTouched: boolean;
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
  // «بدون اسم» group: saved with an empty title; items show directly.
  noName: boolean;
};

type Screen = ContentScreen;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// FILE-01: صور وPDF فقط — must match ALLOWED_FILE_MIME_TYPES in api/_lib/page.ts.
const ALLOWED_FILE_TYPES = [...IMAGE_TYPES, 'application/pdf'];
// REQ-001: PDFs allow 10 MB; images retain their existing cap.
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_ICON_SOURCE_SIZE = 8 * 1024 * 1024;
const WHATSAPP_BASE = 'https://wa.me/';

// Note 34: one «الرابط» field takes a link, an email address or a WhatsApp
// number with its country code, and says what it is. Returns the stored link
// and its kind, or a plain-language error.
type ParsedLink = { url: string; mode: LinkMode; platform: string } | { error: string } | null;
function parseLinkInput(raw: string): ParsedLink {
  const value = raw.trim();
  if (!value) return null;
  if (/^mailto:/i.test(value) || /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(value)) {
    const address = value.replace(/^mailto:/i, '');
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(address) ? { url: `mailto:${address}`, mode: 'email', platform: 'email' } : { error: 'البريد الإلكتروني غير مكتمل.' };
  }
  if (/^\+?[\d\s()-]{7,}$/.test(value)) {
    let digits = value.replace(/\D/g, '');
    if (value.startsWith('+')) { /* already international */ }
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
    else if (/^5\d{8}$/.test(digits)) digits = `966${digits}`;
    else if (!digits.startsWith('966')) return { error: 'أضف مفتاح الدولة قبل الرقم، مثل ‎+966‎.' };
    return /^\d{8,15}$/.test(digits) ? { url: `${WHATSAPP_BASE}${digits}`, mode: 'whatsapp', platform: 'whatsapp' } : { error: 'رقم الواتساب غير صحيح.' };
  }
  const url = /^https?:\/\//i.test(value) ? value : /^[^\s]+\.[^\s]{2,}/.test(value) ? `https://${value}` : '';
  try {
    if (!url || !new URL(url).hostname.includes('.')) throw new Error();
  } catch {
    return { error: 'أدخل رابطًا صحيحًا أو بريدًا إلكترونيًا أو رقم واتساب.' };
  }
  const platform = detectPlatform(url) ?? 'website';
  if (platform === 'whatsapp') return { url, mode: 'whatsapp', platform };
  return { url, mode: SOCIAL_IDS.includes(platform) ? 'social' : 'url', platform };
}
// What the field shows for a stored link.
const rawFromUrl = (url: string) => (url.startsWith('mailto:') ? url.slice(7) : /^https:\/\/wa\.me\/\d+$/.test(url) ? `+${url.slice(WHATSAPP_BASE.length)}` : url);


const KINDS: { id: ContentKind; label: string; hint: string; Icon: typeof Link2; tone: string }[] = [
  { id: 'link', label: 'زر', hint: 'واتساب، حساباتك، موقعك أو فيديو', Icon: Link2, tone: 'bg-[#111111]/5 text-[#C2410C]' },
  { id: 'file', label: 'ملف', hint: 'صور منتجاتك، قائمة أسعار، كتالوج PDF', Icon: FileText, tone: 'bg-[#ff9500]/12 text-[#c76a00]' },
  { id: 'text', label: 'نص', hint: 'عنوان أو جملة بين الأزرار', Icon: Type, tone: 'bg-[#16A34A]/12 text-[#15803D]' },
  { id: 'group', label: 'مجموعة', hint: 'تجمع عدة أزرار تحت عنوان واحد', Icon: FolderOpen, tone: 'bg-[#af52de]/12 text-[#8e3bb8]' },
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

// Social platforms offered under «تغيير المنصة» (WhatsApp and email are recognised from what is typed).
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
    platformTouched: false,
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
    noName: false,
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
    mode: link.platform === 'whatsapp' && link.url.startsWith(WHATSAPP_BASE) ? 'whatsapp' : link.platform === 'email' && link.url.startsWith('mailto:') ? 'email' : SOCIAL_IDS.includes(link.platform || '') ? 'social' : 'url',
    textStyle: link.display?.kind === 'heading' ? 'heading' : 'body',
    title: link.title,
    titleTouched: true,
    platformTouched: false,
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
    noName: kind === 'group' && !link.title.trim(),
  };
}

function isReady(form: FormState) {
  if (form.kind === 'text') return form.textStyle === 'heading' ? Boolean(form.title.trim()) : Boolean(form.display.body?.trim() && form.display.body.length <= 2000);
  if (form.kind === 'group') return form.noName || Boolean(form.title.trim());
  if (!form.title.trim() || !form.url.trim()) return false;
  if (form.display.kind === 'video') return Boolean(parseYouTubeVideoSource(form.url));
  if (form.mode === 'email') return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.url);
  if (form.mode === 'whatsapp') return /^https:\/\/wa\.me\/\d{8,15}$/.test(form.url);
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

// Note 25 / 13: chosen at signup, link or file not added yet.
const isIncomplete = (link: Link) => !link.url && !['heading', 'text'].includes(link.display?.kind ?? '');
// Note 16: what is still missing, in plain words; shown in the editor only.
const incompleteLabel = (link: Link) =>
  link.display?.kind === 'document' ? 'لم تُرفع الوثيقة بعد'
  : link.display?.kind === 'video' || link.title === 'مقطع' ? 'لم يُضف المقطع بعد'
  : link.linkType === 'file' ? (link.title === 'صورة' ? 'لم تُرفع الصورة بعد' : 'لم يُرفع الملف بعد')
  : link.platform === 'whatsapp' ? 'لم يُضف رقم التواصل بعد'
  : link.platform === 'email' ? 'لم يُضف البريد بعد'
  : 'لم يُضف الرابط بعد';

function itemSubtitle(link: Link, links: Link[]) {
  if (isIncomplete(link)) return incompleteLabel(link);
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
  if (/^https:\/\/wa\.me\/\d+$/.test(link.url)) return `+${link.url.slice(WHATSAPP_BASE.length)}`;
  return link.url.replace(/^mailto:/i, '').replace(/^https?:\/\/(www\.)?/i, '');
}

function ItemIcon({ link }: { link: Link }) {
  const kind = link.display?.kind;
  if (kind === 'text') return <Type className="h-5 w-5 text-[#15803D]" />;
  if (kind === 'video') return <PlayCircle className="h-5 w-5 text-[#DC2626]" />;
  if (kind === 'heading') return link.display?.sectionId ? <FolderOpen className="h-5 w-5 text-[#8e3bb8]" /> : <Type className="h-5 w-5 text-[#737373]" />;
  if (link.display?.layout === 'card' && link.display.image) return <img src={link.display.image} alt="" className="h-full w-full rounded-[10px] object-cover" />;
  return <SocialIcon platform={link.linkType === 'file' && link.fileMimeType?.startsWith('image/') ? 'image' : link.platform || 'custom'} iconStyle={link.iconStyle || 'color'} customIcon={link.customIcon ?? (link.display?.kind === 'document' ? OFFICIAL_DOCUMENT_ICON : undefined)} color={link.customIcon?.startsWith('icon:') ? '#262626' : undefined} className="h-5 w-5" />;
}

// Note 45: tiny drawings, one quiet style (current colour, rounded bars), that
// show the result: several platforms in one link, a title with lines, a title
// gathering buttons, and the three ways a group is laid out.
function KindArt({ id, Icon }: { id: ContentKind; Icon: typeof Link2 }) {
  if (id === 'link') return (
    <span className="relative block h-8 w-11" aria-hidden="true">
      <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm"><SocialIcon platform="instagram" iconStyle="color" className="h-3 w-3" /></span>
      <span className="absolute right-3.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm"><SocialIcon platform="whatsapp" iconStyle="color" className="h-3 w-3" /></span>
      <span className="absolute right-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm"><PlayCircle className="h-3 w-3 text-[#DC2626]" /></span>
      <span className="absolute bottom-0 right-1 flex h-3 w-9 items-center justify-center rounded-full bg-current opacity-80"><Link2 className="h-2 w-2 text-white" /></span>
    </span>
  );
  if (id === 'text') return (
    <span className="flex w-10 flex-col items-start gap-1" aria-hidden="true">
      <span className="h-1.5 w-7 rounded-full bg-current" />
      <span className="h-1 w-10 rounded-full bg-current opacity-45" />
      <span className="h-1 w-8 rounded-full bg-current opacity-45" />
    </span>
  );
  if (id === 'group') return (
    <span className="flex w-10 flex-col items-stretch gap-1" aria-hidden="true">
      <span className="h-1.5 w-6 self-start rounded-full bg-current" />
      <span className="h-2 rounded-full bg-current opacity-55" />
      <span className="h-2 rounded-full bg-current opacity-55" />
      <span className="h-2 rounded-full bg-current opacity-55" />
    </span>
  );
  return <Icon className="h-6 w-6" />;
}

function LayoutArt({ id }: { id: 'list' | 'grid' | 'carousel' }) {
  const bar = 'rounded-md bg-current opacity-60';
  if (id === 'list') return <span className="flex w-12 flex-col gap-1" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={`h-2 ${bar}`} />)}</span>;
  if (id === 'grid') return <span className="grid w-12 grid-cols-2 gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-3 ${bar}`} />)}</span>;
  return (
    <span className="flex w-12 flex-col items-center gap-1" aria-hidden="true">
      <span className="flex w-full gap-1 overflow-hidden"><span className={`h-6 w-9 shrink-0 ${bar}`} /><span className={`h-6 w-4 shrink-0 ${bar} opacity-30`} /></span>
      <span className="flex gap-0.5"><span className="h-1 w-1 rounded-full bg-current" /><span className="h-1 w-1 rounded-full bg-current opacity-35" /><span className="h-1 w-1 rounded-full bg-current opacity-35" /></span>
    </span>
  );
}

function Advanced({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-white px-4 text-[15px] text-[#111111]">
        خيارات إضافية
        <ChevronDown className={`h-4 w-4 text-[#737373] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4 space-y-6">{children}</div>}
    </section>
  );
}

// `onPendingChange`: the editor window is told while a form holds unadded
// input, so closing it never drops that input silently.
// `focusId` (note 22): an item tapped in the preview opens here for completing.
export function LinkEditor({ onPendingChange, focusId, onFocused, saveActionRef, externalSave = false, draftSave = false, inline = false, mobileOverview = false, addRequest, onCommitted, onBusyChange }: { onBusyChange?: (busy: boolean) => void; mobileOverview?: boolean; inline?: boolean; addRequest?: { requestId: number; afterId: string | null }; onCommitted?: () => void; saveActionRef?: MutableRefObject<(() => Promise<void>) | null>; externalSave?: boolean; draftSave?: boolean; onPendingChange?: (pending: boolean) => void; focusId?: string | null; onFocused?: () => void } = {}) {
  const { pageData, saveDraft, saving, draftState, conflict, updatePageData, addLink, removeLink, updateLink, moveLink, reorderLink } = usePageContext();
  const links = pageData.links;
  const limitReached = links.length >= MAX_LINKS;
  // The English fields appear once the page has an English version.
  const hasEnglish = Boolean(pageData.translations?.en?.name || pageData.translations?.en?.bio);
  const groups = links.filter((item) => item.display?.kind === 'heading' && item.display.sectionId);

  const [saveError, setSaveError] = useState('');
  const [commitTick, setCommitTick] = useState(0);
  useEffect(() => { if (commitTick) onCommitted?.(); }, [commitTick]);
  const [screen, setScreen] = useState<Screen>(() => pageData.editorForm?.screen ?? { name: inline && !mobileOverview ? 'choose' : 'list' });
  const insertionAnchor = useRef<string | null | undefined>(pageData.editorForm?.insertionAfter);
  const lastAddRequest = useRef<number | undefined>(undefined);
  const [form, setForm] = useState<FormState>(() => pageData.editorForm?.form ?? emptyForm('link'));
  const autoCommitted = useRef('');
  const autoItemId = useRef<string | undefined>(pageData.editorForm?.screen.id);
  const formStart = useRef(pageData.editorForm?.start ?? '');
  const [rawLink, setRawLink] = useState(pageData.editorForm?.rawLink ?? '');
  const [fileError, setFileError] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const fileRequest = useRef(0);
  useEffect(() => () => { fileRequest.current++; }, []);
  const [iconError, setIconError] = useState('');
  const [iconsOpen, setIconsOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  const [iconCrop, setIconCrop] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'leave' } | { kind: 'deleteGroup'; link: Link; count: number }>(null);
  const [contentQuery, setContentQuery] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const autoFocusFields = typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches;

  // Each new screen starts at its top (not on first opening the panel).
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return; }
    // Scroll only the editor panel; scrollIntoView also moves the outer desktop.
    topRef.current?.closest('[data-builder-panel-scroll]')?.scrollTo({ top: 0 });
    // Editor phase 2: steps slide inside the same sheet (forward moves left in RTL).
    if (inline && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const offset = screen.name === 'form' ? -18 : 18;
      topRef.current?.parentElement?.animate?.([{ opacity: .35, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 200, easing: 'cubic-bezier(.22, .68, 0, 1)' });
    }
  }, [screen]);

  // A new item joins the page as soon as it is valid; its title stays «جديد» until reopened.
  const formIsNew = useRef(false);
  const openForm = (next: FormState, id?: string) => {
    formIsNew.current = !id;
    autoCommitted.current = '';
    autoItemId.current = id;
    setForm(next);
    setRawLink(rawFromUrl(next.url));
    setEditingTitle(false);
    setIconsExpanded(false);
    formStart.current = JSON.stringify(next);
    setFileError('');
    setIconError('');
    setSaveError('');
    setIconsOpen(false);
    setIconQuery('');
    setActionsFor(null);
    setScreen({ name: 'form', id });
  };

  const openQuickLink = (parsed: { url: string; mode: LinkMode; platform: string }) => {
    const next = { ...emptyForm('link'), ...parsed };
    openForm({ ...next, title: suggestedTitle(next) });
    // A pasted link is new input, so it joins the page like a typed one.
    formStart.current = JSON.stringify(emptyForm('link'));
    setContentQuery('');
  };

  // Note 23: the item tapped in the preview opens its form. Unadded input in
  // another form is never dropped: the usual «تجاهل؟» question comes first.
  const pendingFocus = useRef<string | null>(null);
  const focusItem = (id: string) => {
    if (draftSave && formChanged && !isReady(form)) {
      setSaveError('ما كتبته محفوظ كمسودة. أكمل البيانات المطلوبة قبل تحرير عنصر آخر.');
      return;
    }
    const link = links.find((item) => item.id === id);
    if (link) openForm(formFromLink(link, links), link.id);
  };
  useEffect(() => {
    if (!focusId) return;
    if (!draftSave && formChanged && !(screen.name === 'form' && screen.id === focusId)) {
      pendingFocus.current = focusId;
      setConfirm({ kind: 'leave' });
    } else if (!(screen.name === 'form' && screen.id === focusId)) {
      focusItem(focusId);
    }
    onFocused?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  useEffect(() => {
    if (!addRequest || addRequest.requestId === lastAddRequest.current) return;
    lastAddRequest.current = addRequest.requestId;
    if (screen.name === 'form' && formChanged && !isReady(form) && draftHasContent({ form, rawLink })) {
      setSaveError('لديك عنصر غير مكتمل محفوظ كمسودة. أكمله قبل إضافة عنصر آخر.');
      return;
    }
    insertionAnchor.current = addRequest.afterId;
    updatePageData({ editorForm: undefined });
    setScreen({ name: 'choose' });
    // The request is an explicit user action, not a side effect of typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRequest?.requestId]);

  const formChanged = screen.name === 'form' && (JSON.stringify(form) !== formStart.current || rawLink !== rawFromUrl(JSON.parse(formStart.current || '{}').url || ''));
  useEffect(() => {
    if (!formChanged || (draftState === 'saved' && !conflict)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formChanged, draftState, conflict]);
  useEffect(() => onPendingChange?.(!draftSave && formChanged), [formChanged, draftSave, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const backToList = () => { updatePageData({ editorForm: undefined }); setScreen({ name: 'list' }); };
  const backFromForm = () => { updatePageData({ editorForm: undefined }); setScreen(contentBack(screen).target); };
  const leaveForm = () => {
    if (!draftSave) { if (contentBack(screen, formChanged).confirmDiscard) setConfirm({ kind: 'leave' }); else backFromForm(); return; }
    if (formChanged && !isReady(form)) {
      // Nothing typed: just go back. Something typed: ask before dropping it.
      if (draftHasContent({ form, rawLink })) setConfirm({ kind: 'leave' }); else backFromForm();
      return;
    }
    if (formChanged) submit(); else backFromForm();
  };

  const update = (changes: Partial<FormState>) => setForm((prev) => {
    const next = { ...prev, ...changes };
    return next.titleTouched || next.kind !== 'link' ? next : { ...next, title: suggestedTitle(next) };
  });

  // Note B: choosing a platform badge changes only the icon — not the URL, and
  // not a title the owner set; marking it «touched» keeps the badge when the URL
  // is edited later.
  const pickPlatform = (id: string) => setForm((prev) => ({ ...prev, platform: id, mode: id === 'website' ? 'url' : 'social', customIcon: '', platformTouched: true }));

  // Note 34: what was typed in «الرابط», read on every change.
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (screen.name !== 'form') return;
    if (!formChanged) {
      if (pageData.editorForm) updatePageData({ editorForm: undefined });
      return;
    }
    if (draftSave && autoCommitted.current === JSON.stringify({ form, rawLink })) return;
    const snapshot = { form, screen: draftSave && autoItemId.current ? { name: 'form' as const, id: autoItemId.current } : screen, start: formStart.current, rawLink, insertionAfter: insertionAnchor.current };
    if (JSON.stringify(snapshot) !== JSON.stringify(pageData.editorForm)) updatePageData({ editorForm: snapshot });
  }, [form, screen, rawLink, formChanged, pageData.editorForm, updatePageData]);

  // Note B: «عرض المزيد» reveals the whole icon library beyond the suggestions.
  const [iconsExpanded, setIconsExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const changeLink = (raw: string) => {
    setRawLink(raw);
    const parsed = parseLinkInput(raw);
    if (!parsed || 'error' in parsed) { update({ url: '' }); return; }
    // A recognised platform takes over; a platform picked by hand stays for a plain site.
    const platform = parsed.mode === 'url' && SOCIAL_IDS.includes(form.platform) && form.platformTouched ? form.platform : parsed.platform;
    update({ url: parsed.url, mode: parsed.mode, platform, display: { ...form.display, kind: form.display.kind === 'video' && parseYouTubeVideoSource(parsed.url) ? 'video' : undefined } });
  };

  const submit = (close = true) => {
    if (!isReady(form)) return;
    const isHeading = form.kind === 'group' || (form.kind === 'text' && form.textStyle === 'heading');
    const display: LinkDisplay = form.kind === 'group'
      ? { ...form.display, kind: 'heading', sectionId: form.display.sectionId || links.find(item => item.id === autoItemId.current)?.display?.sectionId || crypto.randomUUID() }
      : isHeading
        ? { kind: 'heading' }
        : form.kind === 'text'
          ? { kind: 'text', body: form.display.body, bodyFormat: form.display.bodyFormat, bodyEn: form.display.bodyEn, sectionId: form.display.sectionId }
          : form.display;
    const isFile = form.kind === 'file';
    const values: Omit<Link, 'id'> = {
      display,
      title: form.kind === 'group' && form.noName ? '' : form.kind === 'text' && !isHeading ? form.display.body!.trim().slice(0, 80) : form.title.trim(),
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
      customIcon: form.kind === 'link' || isFile ? form.customIcon || undefined : undefined,
    };
    const members = form.kind === 'group' ? form.sectionMembers : undefined;
    // A completed platform from signup becomes visible once its link is in.
    const id = draftSave ? autoItemId.current : screen.name === 'form' ? screen.id : undefined;
    const wasIncomplete = Boolean(id && links.some(link => link.id === id && isIncomplete(link)));
    if (id) updateLink(id, wasIncomplete ? { ...values, hidden: false } : values, members);
    else {
      if (limitReached) return;
      autoItemId.current = addLink(values, members, insertionAnchor.current);
    }
    autoCommitted.current = JSON.stringify({ form, rawLink });
    updatePageData({ editorForm: undefined });
    if (close) { backToList(); setCommitTick(tick => tick + 1); }
  };

  // Valid input joins the shared draft automatically; incomplete input stays
  // in editorForm and is also recovered and autosaved by PageContext.
  useEffect(() => {
    if (!draftSave || screen.name !== 'form' || !formChanged || !isReady(form)) return;
    if (autoCommitted.current === JSON.stringify({ form, rawLink })) return;
    submit(false);
    // Only input changes trigger a commit, never the resulting shared-page update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSave, form, rawLink, screen, formChanged]);


  const saveElementDraft = async () => {
    if (screen.name === 'form') {
      if (!isReady(form)) throw new Error('أكمل البيانات المطلوبة: العنوان والرابط أو الملف، ثم احفظ تعديلك.');
      // Commit to the shared draft before capturing the server snapshot.
      flushSync(() => submit());
    }
    await saveDraft();
  };
  useEffect(() => {
    if (!saveActionRef) return;
    saveActionRef.current = saveElementDraft;
    return () => { saveActionRef.current = null; };
  });

  const pickFile = async (file: File) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) { setFileError('اختر صورة (PNG أو JPG أو WebP أو GIF) أو ملف PDF.'); return; }
    // An official document stays a PDF (the server checks it too).
    if (form.display.kind === 'document' && file.type !== 'application/pdf') { setFileError('الوثيقة الرسمية تُرفع بصيغة PDF.'); return; }
    const isPdf = file.type === 'application/pdf';
    // Phone photos are made small automatically; a GIF would lose its motion, so it keeps its own limit.
    const isGif = file.type === 'image/gif';
    if (file.size > (isPdf ? MAX_PDF_SIZE : isGif ? MAX_FILE_SIZE : MAX_SOURCE_BYTES)) { setFileError(isPdf ? 'ملف PDF أكبر من 10 ميجا. اختر ملفًا أصغر.' : isGif ? 'الصورة المتحركة أكبر من 3 ميجا. اختر صورة أصغر.' : 'الصورة أكبر من 10 ميجا. اختر صورة أصغر.'); return; }
    setFileError('');
    const request = ++fileRequest.current; setReadingFile(true); onBusyChange?.(true);
    try {
      const url = isPdf || isGif ? await readFileAsDataUrl(file) : await compressImage(file);
      if (request !== fileRequest.current) return;
      const mime = url.match(/^data:([^;,]+)/)?.[1] ?? file.type;
      const bytes = isPdf || isGif ? file.size : Math.ceil(((url.length - url.indexOf(',') - 1) * 3) / 4);
      setForm((prev) => ({
        ...prev,
        url,
        fileName: file.name,
        fileMimeType: mime,
        fileSize: bytes,
        // The file's own name is a good first title; it stays editable.
        // A camera file name means nothing to visitors.
        title: prev.titleTouched ? prev.title : /^(img|image|photo|dsc|pxl|screenshot)[\s_-]*\d*/i.test(file.name) && !isPdf ? 'صورة' : file.name.replace(/\.[^.]+$/, '').slice(0, 120),
        // A new picture is shown as a picture, not as a button with a small icon.
        display: !isPdf && formIsNew.current ? { ...prev.display, layout: 'card', image: url } : !isPdf && prev.display.image === prev.url ? { ...prev.display, image: url, positionX: 50, positionY: 50, zoom: undefined } : prev.display,
      }));
    } catch (problem) {
      if (request === fileRequest.current) setFileError(problem instanceof ImageProblem ? problem.message : 'تعذر قراءة الملف. حاول مرة أخرى.');
    } finally { if (request === fileRequest.current) { setReadingFile(false); onBusyChange?.(false); } }
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
    const canCustom = true;
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
    // Note (7): a fixed order — choosing an icon only moves the blue frame, never
    // the icons. Note B: «عرض المزيد» reveals the whole library beyond the few
    // suggestions; search still finds any icon by name.
    const compact = [...new Set([...suggestions, selected])].filter(Boolean).map((id) => LINK_ICONS.find((icon) => icon.id === id)).filter((icon): icon is (typeof LINK_ICONS)[number] => Boolean(icon));
    const library = query ? LINK_ICONS.filter((icon) => `${icon.label} ${icon.id}`.toLowerCase().includes(query)) : iconsExpanded ? LINK_ICONS : compact;
    const platforms = SOCIAL_PLATFORMS.filter((item) => !['file', 'email', 'whatsapp', 'custom'].includes(item.id) && (!query || `${item.name} ${item.id}`.toLowerCase().includes(query)));
    const tile = (active: boolean) => `flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-1.5 transition-colors ${active ? 'border-[#111111] bg-[#111111]/5' : 'border-transparent bg-[#F5F5F3]'}`;

    return (
      <Group title="الأيقونة">
        <button type="button" aria-expanded={iconsOpen} onClick={() => setIconsOpen(!iconsOpen)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-right">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#F5F5F3]">
            <SocialIcon platform={isFile && form.fileMimeType.startsWith('image/') ? 'image' : platform} iconStyle="color" customIcon={canCustom ? form.customIcon || undefined : undefined} color={form.customIcon.startsWith('icon:') ? '#262626' : undefined} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] text-[#111111]">{form.customIcon && canCustom ? 'أيقونة مختارة' : !isFile && form.platform !== 'website' && form.platform !== 'custom' ? `${platformName(form.platform)} · تلقائيًا` : 'أيقونة تلقائية'}</span>
          <span className="text-sm font-bold text-[#C2410C]">{iconsOpen ? 'إخفاء' : 'تغيير'}</span>
        </button>
        {iconsOpen && (
          <div className="space-y-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
              <input type="search" aria-label="البحث في الأيقونات" placeholder="ابحث عن أيقونة أو منصة…" value={iconQuery} onChange={(event) => setIconQuery(event.target.value)} className="h-10 w-full rounded-xl bg-[#F5F5F3] pl-3 pr-9 text-sm focus:outline-none" />
            </div>
            {!isFile && form.mode !== 'whatsapp' && form.mode !== 'email' && platforms.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-[#737373]">شعار منصة</p>
                <div className="grid grid-cols-4 gap-2">
                  {[{ id: 'website', name: 'موقع' }, ...platforms.map((item) => ({ id: item.id as string, name: item.id === 'twitter' ? 'X' : item.name }))].map((item) => (
                    <button key={item.id} type="button" aria-pressed={form.platform === item.id} onClick={() => pickPlatform(item.id)} className={`${tile(form.platform === item.id)} min-h-16`}>
                      <SocialIcon platform={item.id} iconStyle="color" className="h-5 w-5" />
                      <span className="max-w-full truncate text-[10px] text-[#737373]">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs text-[#737373]">{query ? 'من المكتبة' : iconsExpanded ? 'كل الأيقونات' : 'مقترحة لهذا العنصر'}</p>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={() => update({ customIcon: '' })} aria-pressed={!form.customIcon} className={`${tile(!form.customIcon)} min-h-16`}>
                  <SocialIcon platform={isFile ? 'file' : platform} iconStyle="color" className="h-5 w-5" />
                  <span className="text-[10px] text-[#737373]">الافتراضية</span>
                </button>
                {library.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => update({ customIcon: `icon:${id}` })} aria-pressed={form.customIcon === `icon:${id}`} aria-label={label} className={`${tile(form.customIcon === `icon:${id}`)} min-h-16`}>
                    <Icon className="h-5 w-5 text-[#262626]" />
                    <span className="max-w-full truncate text-[10px] text-[#737373]">{label}</span>
                  </button>
                ))}
              </div>
              {!library.length && <p className="py-2 text-center text-xs text-[#737373]">لا توجد أيقونة مطابقة.</p>}
              {!query && LINK_ICONS.length > compact.length && (
                <button type="button" aria-expanded={iconsExpanded} onClick={() => setIconsExpanded(!iconsExpanded)} className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-bold text-[#C2410C]">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${iconsExpanded ? 'rotate-180' : ''}`} />{iconsExpanded ? 'عرض أقل' : 'عرض المزيد'}
                </button>
              )}
              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#111111]/5 text-sm font-bold text-[#C2410C] focus-within:ring-2 focus-within:ring-[#111111]">
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
            {!!iconError && <p className="text-xs text-[#DC2626]">{iconError}</p>}
          </div>
        )}
      </Group>
    );
  };

  const groupSelect = form.kind !== 'group' && !(form.kind === 'text' && form.textStyle === 'heading') && groups.length > 0 && (
    <Group title="المجموعة">
      <label className="flex min-h-[48px] items-center gap-3 px-4">
        <span className="shrink-0 text-[15px] text-[#111111]">ضمن</span>
        <select aria-label="مجموعة العنصر" value={form.display.sectionId ?? ''} onChange={(event) => update({ display: { ...form.display, sectionId: event.target.value || undefined } })} className="min-w-0 flex-1 rounded-lg bg-[#F5F5F3] px-2 py-2 text-[15px]">
          <option value="">بدون مجموعة</option>
          {groups.map((item) => <option key={item.id} value={item.display!.sectionId}>{item.title || 'مجموعة بلا اسم'}{item.hidden ? ' (مخفية)' : ''}</option>)}
        </select>
      </label>
    </Group>
  );

  const englishTitle = hasEnglish && form.kind !== 'text' && (
    <Group title="بالإنجليزية (اختياري)">
      <div dir="ltr" className="px-4 py-1"><input value={form.titleEn} maxLength={255} onChange={(event) => update({ titleEn: event.target.value })} placeholder="Title in English" className="w-full bg-transparent py-3 text-[15px] text-[#111111] placeholder:text-[#D4D4D4] focus:outline-none" /></div>
    </Group>
  );

  // ——— the form of each kind ———
  const renderLinkFields = () => {
    const parsed = parseLinkInput(rawLink);
    const linkError = parsed && 'error' in parsed ? parsed.error : '';
    const youtube = form.mode !== 'email' && form.mode !== 'whatsapp' && parseYouTubeVideoSource(form.url);
    // N: a per-type helper line, so «قناة» vs «مقطع» is clear and nothing switches silently.
    const typeHint = !form.url || form.mode === 'email' || form.mode === 'whatsapp' ? ''
      : form.platform === 'youtube' && youtube ? 'مقطع يوتيوب — فعّل «تشغيل الفيديو داخل الصفحة» لعرضه هنا، أو اتركه زرًا يفتح المقطع.'
      : form.platform === 'youtube' ? 'رابط قناة يوتيوب — سيظهر كزر يفتح قناتك.'
      : SOCIAL_IDS.includes(form.platform) ? `رابط ${platformName(form.platform)} — سيظهر كزر يفتح حسابك.`
      : '';
    return (
      <>
        {/* Note 34: one field first — a link, an email or a WhatsApp number. */}
        <Group title="الرابط">
          <div className="flex items-center gap-2 px-4 py-1" dir="ltr">
            {!!form.url && <SocialIcon platform={form.platform} iconStyle="color" className="h-5 w-5 shrink-0" />}
            <input
              dir="ltr"
              inputMode="url"
              autoFocus={autoFocusFields && !form.url}
              aria-label="الرابط"
              aria-invalid={Boolean(linkError)}
              value={rawLink}
              onChange={(event) => changeLink(event.target.value)}
              placeholder="رابط، بريد إلكتروني، أو رقم واتساب ‎+966…"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#dddcd5] bg-white px-3 py-3 text-[16px] text-[#111111] placeholder:text-right placeholder:text-[13px] placeholder:text-[#77776f] focus:border-[#ff6b2c] focus:outline-none"
            />
          </div>
          {linkError && <p role="alert" className="px-4 py-2 text-xs text-[#DC2626]">{linkError}</p>}
          {!!form.url && (
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
              <span className="flex items-center gap-2 font-bold text-[#15803D]"><Check className="h-4 w-4" />{form.mode === 'email' ? 'بريد إلكتروني' : form.mode === 'whatsapp' ? 'واتساب' : form.platform === 'website' || form.platform === 'custom' ? 'رابط موقع' : platformName(form.platform)}</span>
            </div>
          )}
          {typeHint && <p className="-mt-1 px-4 pb-2.5 text-xs leading-5 text-[#737373]">{typeHint}</p>}
          {youtube && (
            <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 text-[15px] text-[#111111]">
              <span>تشغيل الفيديو داخل الصفحة</span>
              <input type="checkbox" checked={form.display.kind === 'video'} onChange={(event) => update({ display: { ...form.display, kind: event.target.checked ? 'video' : undefined, layout: undefined } })} className="h-5 w-5 accent-[#FF6B2C]" />
            </label>
          )}
          {/* Note 37: the video's title and YouTube link, set right here with the video. */}
          {youtube && form.display.kind === 'video' && (
            <>
              <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 text-[15px] text-[#111111]">
                <span>إظهار العنوان ورابط يوتيوب</span>
                <input type="checkbox" checked={Boolean(form.display.caption)} onChange={(event) => update({ display: { ...form.display, caption: event.target.checked ? 'below' : undefined } })} className="h-5 w-5 accent-[#FF6B2C]" />
              </label>
              {form.display.caption && (
                <div className="px-4 py-2.5"><Segmented options={[{ id: 'below', label: 'تحت المقطع' }, { id: 'above', label: 'فوق المقطع' }] as const} value={form.display.caption} onChange={(caption) => update({ display: { ...form.display, caption } })} /></div>
              )}
            </>
          )}
        </Group>
        {/* N: a plain-text, always-available how-to — no video. */}
        <div className="-mt-3">
          <button type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)} className="flex items-center gap-1.5 px-4 text-xs font-bold text-[#C2410C]">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />كيف أحصل على الرابط؟
          </button>
          {helpOpen && (
            <div className="mt-2 space-y-1.5 rounded-2xl bg-white px-4 py-3 text-xs leading-6 text-[#737373]">
              <p className="font-bold text-[#111111]">من أي حساب أو قناة تواصل اجتماعي:</p>
              <ol className="list-decimal space-y-1 pr-4">
                <li>افتح حسابك أو قناتك في التطبيق أو المتصفح.</li>
                <li>اضغط زر المشاركة (Share) أو «نسخ الرابط».</li>
                <li>ألصق الرابط في الحقل بالأعلى.</li>
              </ol>
              <p>تنفع الطريقة نفسها لإنستقرام وسناب وتيك توك ويوتيوب وإكس وغيرها.</p>
            </div>
          )}
        </div>

        {/* Then the title, suggested from what was recognised and free to change. */}
        {/* Note 42: the suggested title shows as text; «تغيير العنوان» opens the field. */}
        {!!form.url && (
          <Group title="العنوان">
            {editingTitle || !form.title.trim() ? (
              <div className="px-4 py-1"><input aria-label="عنوان الزر" autoFocus={autoFocusFields && editingTitle} maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value, titleTouched: true })} placeholder="عنوان الزر" className="w-full bg-transparent py-3 text-[16px] font-bold text-[#111111] placeholder:font-normal placeholder:text-[#D4D4D4] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
            ) : (
              <div className="flex min-h-[48px] items-center justify-between gap-3 px-4">
                <span className="min-w-0 truncate text-[16px] font-bold text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>{form.title}</span>
                <button type="button" onClick={() => setEditingTitle(true)} className="shrink-0 text-xs font-bold text-[#C2410C]">تغيير العنوان</button>
              </div>
            )}
          </Group>
        )}


        {/* Note 42: how it shows, and its group, in view; the rest stays folded. */}
        {!!form.url && form.display.kind !== 'video' && <LinkAppearanceEditor display={form.display} onChange={(display) => update({ display })} />}
        {!!form.url && groupSelect}
        {form.display.kind !== 'video' && renderIconChooser()}
        {englishTitle && <Advanced>{englishTitle}</Advanced>}
      </>
    );
  };

  const renderFileFields = () => (
    <>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#D4D4D4] bg-white px-4 py-7 text-center focus-within:border-[#111111]">
        {form.url ? (
          <>
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#F5F5F3]">
              {form.fileMimeType.startsWith('image/') ? <img src={form.url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-[#c76a00]" />}
            </span>
            <span className="flex max-w-full items-center gap-1.5 text-xs text-[#737373]">
              <span className="min-w-0 truncate" dir="ltr">{form.fileName || 'ملف'}</span>
              {form.fileSize ? <><span aria-hidden="true">·</span><span className="shrink-0" dir="ltr">{formatFileSize(form.fileSize)}</span></> : null}
            </span>
            <span className="text-sm font-bold text-[#C2410C]">تغيير الملف</span>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff9500]/12 text-[#c76a00]"><Upload className="h-5 w-5" /></span>
            <span className="text-[15px] font-bold text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختيار صورة أو ملف PDF</span>
            <span className="text-xs text-[#737373]">حتى 10 ميجا، ونجهّز الصور تلقائيًا</span>
          </>
        )}
        <input type="file" aria-label="اختيار الملف" accept={ALLOWED_FILE_TYPES.join(',')} className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void pickFile(file);
        }} />
      </label>
      {!!fileError && <p role="alert" className="flex items-center gap-1 px-4 text-xs text-[#DC2626]"><AlertCircle className="h-4 w-4" />{fileError}</p>}
      <Group title="العنوان" footer="النص الذي يراه زوارك على الزر.">
        <div className="px-4 py-1"><input aria-label="عنوان الملف" maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value, titleTouched: true })} placeholder="مثل: الملف التعريفي" className="w-full bg-transparent py-3 text-[16px] font-bold text-[#111111] placeholder:font-normal placeholder:text-[#D4D4D4] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
      </Group>
      {/* Note 44: display and group in view for files too; the rest stays folded. */}
      {!!form.url && <LinkAppearanceEditor display={form.display} fileImage={form.fileMimeType.startsWith('image/') ? form.url : undefined} onChange={(display) => update({ display })} />}
      {groupSelect}
      {renderIconChooser()}
      {englishTitle && <Advanced>{englishTitle}</Advanced>}
    </>
  );

  const renderTextFields = () => (
    <>
      <Segmented options={[{ id: 'body', label: 'نبذة' }, { id: 'heading', label: 'عنوان' }] as const} value={form.textStyle} onChange={(textStyle) => update({ textStyle })} />
      {form.textStyle === 'heading' ? (
        <Group title="العنوان" footer="عنوان يفصل بين أجزاء صفحتك.">
          <div className="px-4 py-1"><input aria-label="نص العنوان" autoFocus={autoFocusFields} maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="مثل: خدماتنا" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#111111] placeholder:font-normal placeholder:text-[#D4D4D4] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
        </Group>
      ) : (
        <Group title="النبذة">
          <div className="px-4 py-3">
            <FormattingTextarea format={form.display.bodyFormat} aria-label="نص النبذة" autoFocus={autoFocusFields} rows={5} maxLength={2000} value={form.display.body ?? ''} onChange={(body, bodyFormat) => update({ display: { ...form.display, kind: 'text', body, bodyFormat: bodyFormat.length ? bodyFormat : undefined } })} placeholder="اكتب نبذة أو إعلانًا أو شرحًا يظهر في صفحتك…" className="w-full resize-y bg-transparent text-[16px] leading-relaxed text-[#111111] placeholder:text-[#D4D4D4] focus:outline-none" />
            <span className="block text-left text-xs text-[#737373]" dir="ltr">{form.display.body?.length ?? 0}/2000</span>
          </div>
        </Group>
      )}
      {(hasEnglish || groupSelect) && (
        <Advanced>
          {hasEnglish && (form.textStyle === 'heading' ? (
            <Group title="بالإنجليزية (اختياري)">
              <div dir="ltr" className="px-4 py-1"><input value={form.titleEn} maxLength={255} onChange={(event) => update({ titleEn: event.target.value })} placeholder="Heading in English" className="w-full bg-transparent py-3 text-[15px] placeholder:text-[#D4D4D4] focus:outline-none" /></div>
            </Group>
          ) : (
            <Group title="بالإنجليزية (اختياري)">
              <div dir="ltr" className="px-4 py-3"><textarea rows={4} maxLength={2000} value={form.display.bodyEn ?? ''} onChange={(event) => update({ display: { ...form.display, bodyEn: event.target.value } })} placeholder="Optional English paragraph" className="w-full resize-y bg-transparent text-[15px] placeholder:text-[#D4D4D4] focus:outline-none" /></div>
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
          {!form.noName && (
            <div className="px-4 py-1"><input aria-label="اسم المجموعة" autoFocus={autoFocusFields && !form.title} maxLength={120} value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="مثل: خدماتنا" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#111111] placeholder:font-normal placeholder:text-[#D4D4D4] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} /></div>
          )}
          {/* P: «بدون اسم» — the group is saved with no title, and its items show
              directly on the page with no empty title bar above them. */}
          <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 text-[15px] text-[#111111]">
            <span>بدون اسم <span className="text-xs text-[#737373]">— تظهر العناصر مباشرة</span></span>
            <input type="checkbox" checked={form.noName} onChange={(event) => update({ noName: event.target.checked })} className="h-5 w-5 accent-[#FF6B2C]" />
          </label>
        </Group>
        {/* P: «طريقة العرض» shown directly, not behind «خيارات إضافية». */}
        <Group title="طريقة العرض">
          <div className="grid grid-cols-3 gap-2 p-3" role="radiogroup" aria-label="طريقة عرض المجموعة">
            {([['list', 'قائمة'], ['grid', 'شبكة'], ['carousel', 'شرائح أفقية']] as const).map(([id, label]) => {
              const active = (form.display.sectionLayout ?? 'list') === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={active} onClick={() => update({ display: { ...form.display, sectionLayout: id } })} className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition-colors ${active ? 'bg-[#111111]/5 text-[#C2410C] ring-2 ring-[#111111]' : 'bg-[#F5F5F3] text-[#737373]'}`}>
                  <span className="flex h-9 items-center"><LayoutArt id={id} /></span>
                  <span className={`text-[12px] ${active ? 'font-bold' : 'text-[#262626]'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </Group>
        {/* Note 40: the chosen items, in their order — moved here with ↑↓ — kept
            apart from the items that can still be added. */}
        <Group title="عناصر المجموعة" footer={form.sectionMembers.length ? 'رتّبها بالسهمين؛ يظهر الترتيب نفسه في القائمة والصفحة.' : 'لم تُضف عناصر بعد. اختر من الأسفل.'}>
          {form.sectionMembers.map((id, index) => {
            const item = candidates.find((value) => value.id === id);
            if (!item) return null;
            const move = (delta: number) => {
              const members = [...form.sectionMembers];
              [members[index], members[index + delta]] = [members[index + delta], members[index]];
              update({ sectionMembers: members });
            };
            return (
              <div key={item.id} className="flex min-h-[48px] items-center gap-2 px-3 py-1.5 text-[15px] text-[#111111]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#F5F5F3]"><ItemIcon link={item} /></span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={index === 0} onClick={() => move(-1)} aria-label={`نقل «${item.title}» للأعلى`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#262626] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={index === form.sectionMembers.length - 1} onClick={() => move(1)} aria-label={`نقل «${item.title}» للأسفل`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#262626] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]"><ArrowDown className="h-4 w-4" /></button>
                </span>
                <button type="button" onClick={() => update({ sectionMembers: form.sectionMembers.filter((value) => value !== item.id) })} aria-label={`إخراج «${item.title}» من المجموعة`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#DC2626] active:bg-[#F5F5F3]">−</button>
              </div>
            );
          })}
        </Group>
        {candidates.some((item) => !form.sectionMembers.includes(item.id)) && (
          <Group title="إضافة عناصر" footer="العنصر المختار يُضاف إلى نهاية المجموعة.">
            {candidates.filter((item) => !form.sectionMembers.includes(item.id)).map((item) => {
              const elsewhere = item.display?.sectionId && item.display.sectionId !== form.display.sectionId ? groups.find((group) => group.display?.sectionId === item.display?.sectionId) : undefined;
              return (
                <button key={item.id} type="button" onClick={() => update({ sectionMembers: [...form.sectionMembers, item.id] })} className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-right text-[15px] text-[#111111]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white"><Plus className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {elsewhere && <span className="shrink-0 text-[11px] text-[#737373]">في «{elsewhere.title || 'بلا اسم'}»</span>}
                </button>
              );
            })}
          </Group>
        )}
        {!form.noName && englishTitle && <Advanced>{englishTitle}</Advanced>}
      </>
    );
  };

  const editing = screen.name === 'form' ? links.find((item) => item.id === (draftSave ? autoItemId.current : screen.id)) : undefined;
  const kindInfo = KINDS.find((item) => item.id === form.kind)!;

  return (
    <Panel className={mobileOverview ? 'mobile-content-panel' : undefined}>
      {draftSave && !externalSave && <AutoSaveStatus />}
      {readingFile && <p role="status" className="text-sm text-[#737373]">جارٍ تجهيز الملف…</p>}
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
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

      {mobileOverview && screen.name !== 'form' && <div className="mobile-content" dir="rtl">
        <form className="mobile-content__search" onSubmit={event => {
          event.preventDefault();
          const parsed = parseLinkInput(contentQuery);
          if (parsed && !('error' in parsed) && !limitReached) {
            openQuickLink(parsed);
          }
        }}>
          <Search size={21} aria-hidden="true" />
          <input aria-label="ألصق رابطًا أو ابحث عن نوع محتوى" placeholder="ألصق رابطًا أو ابحث عن محتوى…" value={contentQuery} onChange={event => setContentQuery(event.target.value)} onPaste={event => {
            const value = event.clipboardData.getData('text');
            const parsed = parseLinkInput(value);
            if (parsed && !('error' in parsed) && !limitReached) {
              event.preventDefault(); openQuickLink(parsed);
            }
          }} />
          {contentQuery && <button type="button" aria-label="مسح البحث" onClick={() => setContentQuery('')}>×</button>}
        </form>
        <div className="mobile-content__kinds" aria-label="أنواع المحتوى">
          {KINDS.filter(item => !contentQuery || `${item.label} ${item.hint}`.includes(contentQuery.trim()) || Boolean(parseLinkInput(contentQuery) && !('error' in parseLinkInput(contentQuery)!))).map(({ id, label, hint, Icon, tone }) => <button key={id} type="button" disabled={limitReached} onClick={() => {
            const parsed = id === 'link' ? parseLinkInput(contentQuery) : null;
            if (parsed && !('error' in parsed)) openQuickLink(parsed); else { openForm(emptyForm(id)); setContentQuery(''); }
          }}><span className={tone}><Icon size={22} strokeWidth={1.9} /></span><b>{id === 'file' ? 'صورة أو ملف' : label}</b><small>{hint}</small></button>)}
        </div>
        {contentQuery && !KINDS.some(item => `${item.label} ${item.hint}`.includes(contentQuery.trim())) && (() => { const parsed = parseLinkInput(contentQuery); return !parsed || 'error' in parsed; })() && <p role="status" className="mobile-content__hint">لا يوجد نوع مطابق. جرّب زر، ملف، نص أو مجموعة.</p>}
        {/* Editor phase 4: «إضافة» shows only what can be added; the list stays in «المحتوى». */}
        {screen.name !== 'choose' && <>
        <header className="mobile-content__list-heading"><h3>المحتوى <span>{links.length}</span></h3><button type="button" aria-pressed={ordering} onClick={() => { setOrdering(!ordering); setActionsFor(null); }}>{ordering ? 'تم' : 'ترتيب بالأسهم'}</button></header>
        {limitReached && <p role="status" className="mobile-content__hint">وصلت إلى الحد ({MAX_LINKS}). احذف عنصرًا لتضيف غيره.</p>}
        {!links.length && <p className="mobile-content__empty">أضف أول محتوى لصفحتك من الخيارات أعلاه.</p>}
        <div className="mobile-content__items">
          {links.map((link, index) => {
            const section = link.display?.sectionId;
            const group = link.display?.kind === 'heading' && Boolean(section);
            const member = Boolean(section && !group);
            if (member && !ordering && !openGroups.includes(section!)) return null;
            const expandedGroup = Boolean(section && openGroups.includes(section));
            return <div key={link.id} data-item-id={link.id} className={`mobile-content__item ${member ? 'is-member' : ''} ${link.hidden ? 'is-hidden' : ''} ${overId === link.id ? 'is-over' : ''} ${dragId === link.id ? 'is-dragging' : ''}`}>
              <div className="mobile-content__row">
                {<span {...dragHandlers(link.id)} className="mobile-content__grip" aria-hidden="true"><GripVertical size={20} /></span>}
                <button type="button" className="mobile-content__edit" onClick={() => openForm(formFromLink(link, links), link.id)}>
                  <span className="mobile-content__icon"><ItemIcon link={link} /></span><span><strong>{link.title || (group ? 'مجموعة بلا اسم' : 'عنصر بلا عنوان')}</strong><small>{itemSubtitle(link, links)}</small></span>
                </button>
                {ordering ? <div className="mobile-content__arrows"><button type="button" disabled={index === 0} aria-label={`نقل «${link.title}» للأعلى`} onClick={() => moveLink(link.id, 'up')}><ArrowUp size={18} /></button><button type="button" disabled={index === links.length - 1} aria-label={`نقل «${link.title}» للأسفل`} onClick={() => moveLink(link.id, 'down')}><ArrowDown size={18} /></button></div> : <>
                  <button type="button" className="mobile-content__visibility" role="switch" aria-checked={!link.hidden} aria-label={`إظهار «${link.title}» للزوار`} onClick={() => updateLink(link.id, { hidden: !link.hidden })}><span /></button>
                  <button type="button" className="mobile-content__more" aria-label={`خيارات «${link.title}»`} aria-expanded={actionsFor === link.id} onClick={() => setActionsFor(actionsFor === link.id ? null : link.id)}>خيارات</button>
                </>}
              </div>
              {group && !ordering && <button type="button" className="mobile-content__group" aria-expanded={expandedGroup} onClick={() => setOpenGroups(expandedGroup ? openGroups.filter(id => id !== section) : [...openGroups, section!])}>{expandedGroup ? 'إخفاء عناصر المجموعة' : 'عرض عناصر المجموعة'}<ChevronDown size={16} /></button>}
              {actionsFor === link.id && !ordering && <div className="mobile-content__actions"><button type="button" onClick={() => openForm(formFromLink(link, links), link.id)}>تعديل</button><button type="button" onClick={() => deleteItem(link)}><Trash2 size={16} />حذف</button></div>}
            </div>;
          })}
        </div>
        {ordering && <p className="mobile-content__hint">اسحب من المقبض أو استخدم السهمين. تظهر عناصر المجموعات أثناء الترتيب.</p>}
        </>}
      </div>}

      {!mobileOverview && screen.name === 'list' && (
        <>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setScreen({ name: 'choose' })}
              disabled={limitReached}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(17,17,17,0.28)] transition-transform active:scale-[0.98] disabled:bg-[#E7E7E7] disabled:text-[#737373] disabled:shadow-none"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              إضافة محتوى
            </button>
            <p className="px-1 text-center text-xs text-[#737373]">
              {limitReached ? `وصلت إلى الحد (${MAX_LINKS}). احذف عنصرًا لتضيف غيره.` : `${links.length} من ${MAX_LINKS}`}
            </p>
          </div>


          {links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-10 text-center">
              <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-[#111111]/5 text-[#C2410C]"><Link2 className="h-7 w-7" /></span>
              <p className="text-[16px] font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>صفحتك جاهزة لأول عنصر</p>
              <p className="text-sm leading-6 text-[#737373]">أضف حساباتك أو موقعك أو ملفًا يحتاجه زوارك، وسيظهر هنا بالترتيب الذي تختاره.</p>
            </div>
          ) : (
            <section>
              <div className="divide-y divide-[#E7E7E7] overflow-hidden rounded-2xl bg-white" onPointerLeave={() => dragId && setOverId(null)}>
                {links.map((link) => {
                  const sectionKey = link.display?.sectionId;
                  const isMember = Boolean(sectionKey && link.display?.kind !== 'heading');
                  const siblings = links.filter((item) => (isMember ? item.display?.kind !== 'heading' && item.display?.sectionId === sectionKey : item.display?.kind === 'heading' || !item.display?.sectionId));
                  const index = siblings.findIndex((item) => item.id === link.id);
                  const showActions = actionsFor === link.id;
                  return (
                    <div key={link.id} data-item-id={link.id} className={`transition-colors ${overId === link.id ? 'bg-[#111111]/5' : ''} ${dragId === link.id ? 'opacity-50' : ''} ${isMember ? 'border-r-[3px] border-r-[#af52de]/30 pr-3' : ''}`}>
                      <div className="flex min-h-[52px] items-center gap-1 pl-1.5 pr-1">
                        <span {...dragHandlers(link.id)} className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[#D4D4D4] active:cursor-grabbing" aria-label={`اسحب لنقل «${link.title}»`} role="button" tabIndex={-1}>
                          <GripVertical className="h-5 w-5" />
                        </span>
                        <button type="button" onClick={() => openForm(formFromLink(link, links), link.id)} className={`flex min-w-0 flex-1 items-center gap-3 py-2 text-right ${link.hidden && !isIncomplete(link) ? 'opacity-45' : ''}`}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#F5F5F3]"><ItemIcon link={link} /></span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[15px] text-[#111111] ${link.display?.kind === 'heading' ? 'font-bold' : ''}`}>{link.title || (link.display?.kind === 'heading' && link.display.sectionId ? 'مجموعة بلا اسم' : '')}</span>
                            {/* Note 43: a row shows its logo and title only; details wait in its
                                form. Only what still needs doing is said under the title. */}
                            {isIncomplete(link) && <span className="flex items-center gap-1 truncate text-xs font-bold text-amber-700"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />{itemSubtitle(link, links)}</span>}
                          </span>
                          {/* Note 16: the item stays off the public page until this is done. */}
                          {isIncomplete(link) && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">أكمل البيانات</span>}
                        </button>
                        {/* Note (8): one step up or down per tap; dragging still works. */}
                        <span className="flex shrink-0 flex-col">
                          <button type="button" disabled={index <= 0} onClick={() => moveLink(link.id, 'up')} aria-label={`نقل «${link.title}» للأعلى`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#262626] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]"><ArrowUp className="h-4 w-4" /></button>
                          <button type="button" disabled={index === siblings.length - 1} onClick={() => moveLink(link.id, 'down')} aria-label={`نقل «${link.title}» للأسفل`} className="flex h-6 w-9 items-center justify-center rounded-md text-[#262626] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]"><ArrowDown className="h-4 w-4" /></button>
                        </span>
                        <button type="button" onClick={() => updateLink(link.id, { hidden: !link.hidden })} aria-label={link.hidden ? `إظهار «${link.title}»` : `إخفاء «${link.title}» دون حذفه`} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[#737373] active:bg-[#F5F5F3]">
                          {link.hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                        <button type="button" onClick={() => setActionsFor(showActions ? null : link.id)} aria-expanded={showActions} aria-label={`خيارات «${link.title}»`} className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-full ${showActions ? 'bg-[#F5F5F3] text-[#111111]' : 'text-[#737373]'}`}>
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                      {showActions && (
                        <div className="px-3 pb-3">
                          <button type="button" onClick={() => deleteItem(link)} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#DC2626]/10 text-sm font-bold text-[#DC2626]"><Trash2 className="h-4 w-4" />حذف</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1.5 px-4 text-xs leading-5 text-[#737373]">اضغط على أي عنصر لتعديله، ورتّبه بالسهمين ↑↓ أو اسحبه من المقبض. العين تخفيه عن الزوار دون حذفه.</p>
            </section>
          )}
        </>
      )}

      {!mobileOverview && screen.name === 'choose' && (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={backToList} className="flex h-10 items-center gap-1 rounded-full pl-3 text-[15px] text-[#C2410C]"><ChevronRight className="h-5 w-5" />رجوع</button>
          </div>
          <h3 className="px-1 text-xl font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>ماذا تريد أن تضيف؟</h3>
          {inline && <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'زر', kind: 'link' as const, preset: {} },
              { label: 'صورة', kind: 'file' as const, preset: { display: { layout: 'card' as const } } },
              { label: 'مقطع فيديو', kind: 'link' as const, preset: { platform: 'youtube', display: { kind: 'video' as const } } },
              { label: 'ملف أو وثيقة', kind: 'file' as const, preset: {} },
              { label: 'وسائل التواصل', kind: 'link' as const, preset: { mode: 'social' as const, platform: 'instagram' } },
              { label: 'نص أو عنوان', kind: 'text' as const, preset: {} },
              { label: 'مجموعة', kind: 'group' as const, preset: {} },
            ].map(item => <button key={item.label} type="button" className="min-h-16 rounded-2xl border border-[#e5e2d8] bg-white p-3 text-sm font-bold" onClick={() => openForm({ ...emptyForm(item.kind), ...item.preset })}>{item.label}</button>)}
          </div>}
          {!inline && <div className="grid grid-cols-2 gap-3">
            {KINDS.map(({ id, label, hint, Icon, tone }) => (
              <button key={id} type="button" onClick={() => openForm(emptyForm(id))} className="flex min-h-[132px] flex-col items-center justify-start gap-3 rounded-2xl bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.97]">
                {/* Note 45: a tiny drawing of what gets added, in the same box size. */}
                <span className={`flex h-11 w-14 items-center justify-center overflow-hidden rounded-xl ${tone}`}><KindArt id={id} Icon={Icon} /></span>
                <span>
                  <span className="block text-[16px] font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#737373]">{hint}</span>
                </span>
              </button>
            ))}
          </div>}
          <p className="px-1 text-xs leading-5 text-[#737373]">المجموعات اختيارية؛ يمكنك إضافة أي محتوى مباشرة دون إنشاء مجموعة.</p>
        </>
      )}

      {screen.name === 'form' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={leaveForm} className="flex h-10 items-center gap-1 rounded-full pl-3 text-[15px] text-[#C2410C]"><ChevronRight className="h-5 w-5" />رجوع</button>
            <span className="flex items-center gap-2 text-[15px] font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${kindInfo.tone}`}><kindInfo.Icon className="h-4 w-4" /></span>
              {editing && !formIsNew.current ? `تعديل ${kindInfo.label}` : `${kindInfo.label} جديد${form.kind === 'group' ? 'ة' : ''}`}
            </span>
            <span className="w-16" />
          </div>

          {form.kind === 'link' && renderLinkFields()}
          {form.kind === 'file' && renderFileFields()}
          {form.kind === 'text' && renderTextFields()}
          {form.kind === 'group' && renderGroupFields()}

          <div className="space-y-3 pt-1">
            {!draftSave && <button type="button" onClick={() => submit()} disabled={!isReady(form)} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#111111] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(17,17,17,0.28)] transition-transform active:scale-[0.98] disabled:bg-[#E7E7E7] disabled:text-[#737373] disabled:shadow-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {editing ? 'تطبيق التعديل' : 'إضافة إلى الصفحة'}
            </button>}
            {editing && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateLink(editing.id, { hidden: !editing.hidden })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-[#111111]">
                  {editing.hidden ? <><Eye className="h-4 w-4" />إظهار للزوار</> : <><EyeOff className="h-4 w-4" />إخفاء عن الزوار</>}
                </button>
                <button type="button" onClick={() => deleteItem(editing)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-[#DC2626]"><Trash2 className="h-4 w-4" />حذف</button>
              </div>
            )}
          </div>
        </>
      )}

      {confirm?.kind === 'leave' && (
        <ConfirmSheet title="تجاهل ما كتبته؟" message="لم تُضف هذه التعديلات بعد." confirmLabel="تجاهل والرجوع" cancelLabel="متابعة التعديل" onConfirm={() => { setConfirm(null); const next = pendingFocus.current; pendingFocus.current = null; if (next) { updatePageData({ editorForm: undefined }); focusItem(next); } else backFromForm(); }} onCancel={() => { pendingFocus.current = null; setConfirm(null); }} />
      )}
      {confirm?.kind === 'deleteGroup' && (
        <ConfirmSheet
          title={`حذف مجموعة «${confirm.link.title || 'بلا اسم'}»؟`}
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

