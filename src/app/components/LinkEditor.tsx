import { parseYouTubeVideoSource } from '../../../shared/videoSources';
import { useMemo, useState, useEffect } from 'react';
import { LinkDisplay, usePageContext } from '../context/PageContext';
import {
  Plus,
  Trash2,
  Check,
  ChevronUp,
  ChevronDown,
  Search,
  Upload,
  PlayCircle,
  AlertCircle,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { SOCIAL_PLATFORMS, SocialIcon } from './SocialIcons';
import { FieldRow, Group, Panel, Segmented } from './ios';
import { ImageCropper } from './ImageCropper';
import { LinkAppearanceEditor } from './LinkAppearanceEditor';
import { LINK_ICONS } from '../lib/linkIcons';
import { MAX_LINKS } from '../lib/site';

type LinkType = 'url' | 'file';
type IconStyle = 'color' | 'mono';
type TextPosition = 'center' | 'right';
type FileCategory = 'cv' | 'menu' | 'other';
type FileKind = 'image' | 'pdf';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

type LinkFormState = {
  title: string;
  titleEn: string;
  url: string;
  platform: string;
  iconStyle: IconStyle;
  textPosition: TextPosition;
  linkType: LinkType;
  fileCategory: FileCategory;
  fileName: string;
  fileMimeType: string;
  fileSize?: number;
  // Editor-only: which file tile was picked. Both are saved as platform 'file'.
  fileKind: FileKind;
  customIcon: string;
  display: LinkDisplay;
  sectionMembers: string[];
};

const QUICK_SOCIAL_IDS = ['whatsapp', 'instagram', 'twitter', 'tiktok', 'snapchat', 'youtube', 'facebook', 'email', 'website', 'custom'];
// Files are stored inline for now; the final storage limits are pending (P-02).
const MAX_FILE_SIZE = 3 * 1024 * 1024;
// FILE-01: صور وPDF فقط — must match ALLOWED_FILE_MIME_TYPES in api/_lib/page.ts.
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

function createInitialFormState(): LinkFormState {
  return {
    title: '',
    titleEn: '',
    url: '',
    platform: 'instagram',
    iconStyle: 'color',
    textPosition: 'center',
    linkType: 'url',
    fileCategory: 'other',
    fileName: '',
    fileMimeType: '',
    fileKind: 'pdf',
    customIcon: '',
    display: {},
    sectionMembers: [],
  };
}

function isFormReady(form: LinkFormState) {
  if (form.display.kind === 'text') return Boolean(form.display.body?.trim() && form.display.body.length <= 2000);
  if (form.display.kind === 'video') return Boolean(form.title.trim() && parseYouTubeVideoSource(form.url));
  return Boolean(form.title.trim() && (form.display.kind === 'heading' || (form.url.trim() && (form.display.layout !== 'card' || form.display.image))));
}

// WhatsApp and email have their own fields (a phone number / an address);
// the link is built from them, so a platform placeholder must never become the value.
function keepOwnFieldUrl(platformId: string | undefined, url: string) {
  if (platformId === 'email') return url.startsWith('mailto:') ? url : '';
  if (platformId === 'whatsapp') return url.startsWith('https://wa.me/') && /\d$/.test(url) ? url : '';
  return null;
}

const WHATSAPP_PREFIX = 'https://wa.me/966';

// General buttons can carry their own icon (D-11); brand platforms keep their logo.
const ICON_PLATFORMS = ['website', 'custom', 'file'];
const MAX_ICON_SOURCE_SIZE = 8 * 1024 * 1024;

function detectPlatformFromUrl(rawUrl: string) {
  const normalized = rawUrl.trim().toLowerCase();

  if (!normalized) return null;
  if (normalized.startsWith('mailto:')) return 'email';
  if (normalized.includes('instagram.com')) return 'instagram';
  if (normalized.includes('twitter.com') || normalized.includes('x.com')) return 'twitter';
  if (normalized.includes('tiktok.com')) return 'tiktok';
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
  if (normalized.includes('linkedin.com')) return 'linkedin';
  if (normalized.includes('github.com')) return 'github';
  if (normalized.includes('facebook.com')) return 'facebook';
  if (normalized.includes('snapchat.com')) return 'snapchat';
  if (normalized.includes('wa.me') || normalized.includes('whatsapp')) return 'whatsapp';
  if (normalized.includes('t.me') || normalized.includes('telegram.me')) return 'telegram';

  return 'website';
}

function getDefaultTitleByCategory(category: FileCategory) {
  if (category === 'cv') return 'السيرة الذاتية';
  if (category === 'menu') return 'قائمة الطعام';
  return 'الملف التعريفي';
}

function getCategoryLabel(category?: FileCategory) {
  if (category === 'cv') return 'سيرة ذاتية';
  if (category === 'menu') return 'قائمة طعام';
  return 'ملف';
}

function formatFileSize(size?: number) {
  if (!size || size <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

// Shown only once the field holds a valid value, to confirm what the button will do.
function Confirmation({ text }: { text: string }) {
  return <p className="-mt-1 !border-t-0 px-4 pb-3 text-xs font-bold text-[#34c759]">✓ {text}</p>;
}

export function LinkEditor() {
  const { pageData, addLink, removeLink, updateLink, moveLink, reorderLink } = usePageContext();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const limitReached = pageData.links.length >= MAX_LINKS;
  // The English title field appears once the page has an English version.
  const hasEnglish = Boolean(pageData.translations?.en?.name || pageData.translations?.en?.bio);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<LinkFormState>(createInitialFormState());
  const [editLink, setEditLink] = useState<LinkFormState>(createInitialFormState());
  const [newPlatformQuery, setNewPlatformQuery] = useState('');
  const [editPlatformQuery, setEditPlatformQuery] = useState('');
  const [showMorePlatformsForNew, setShowMorePlatformsForNew] = useState(false);
  const [showMorePlatformsForEdit, setShowMorePlatformsForEdit] = useState(false);
  const [newFileError, setNewFileError] = useState('');
  const [editFileError, setEditFileError] = useState('');
  const [prevNewPlatform, setPrevNewPlatform] = useState(newLink.platform);
  const [prevEditPlatform, setPrevEditPlatform] = useState(editLink.platform);
  const [iconError, setIconError] = useState('');
  const [expandedIcons, setExpandedIcons] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  useEffect(() => { setExpandedIcons(false); setIconQuery(''); setIconError(''); }, [isAdding, editingId]);
  const [iconCrop, setIconCrop] = useState<{ src: string; setForm: React.Dispatch<React.SetStateAction<LinkFormState>> } | null>(null);

  const quickSocialPlatforms = useMemo(
    () => QUICK_SOCIAL_IDS.map((id) => SOCIAL_PLATFORMS.find((platform) => platform.id === id)!).filter(Boolean),
    [],
  );


  const filteredPlatformsForNew = useMemo(() => {
    const query = newPlatformQuery.trim().toLowerCase();
    if (!query) return SOCIAL_PLATFORMS;

    return SOCIAL_PLATFORMS.filter(
      (platform) =>
        platform.name.toLowerCase().includes(query) ||
        platform.id.toLowerCase().includes(query) ||
        platform.placeholder.toLowerCase().includes(query),
    );
  }, [newPlatformQuery]);

  const filteredPlatformsForEdit = useMemo(() => {
    const query = editPlatformQuery.trim().toLowerCase();
    if (!query) return SOCIAL_PLATFORMS;

    return SOCIAL_PLATFORMS.filter(
      (platform) =>
        platform.name.toLowerCase().includes(query) ||
        platform.id.toLowerCase().includes(query) ||
        platform.placeholder.toLowerCase().includes(query),
    );
  }, [editPlatformQuery]);

  // عند تغيير platform في نموذج جديد: حدّث العنوان والـ URL
  useEffect(() => {
    if (newLink.display.kind) { setPrevNewPlatform(newLink.platform); return; }
    if (prevNewPlatform !== newLink.platform) {
      const isFile = newLink.platform === 'file';
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === newLink.platform);
      
      setNewLink((prev) => ({
        ...prev,
        title: isFile ? getDefaultTitleByCategory(prev.fileCategory) : platform?.name || '',
        url: isFile ? prev.url : keepOwnFieldUrl(platform?.id, prev.url) ?? (platform?.placeholder || ''),
        linkType: isFile ? 'file' : 'url',
      }));
      setPrevNewPlatform(newLink.platform);
    }
  }, [newLink.platform, prevNewPlatform]);

  // عند تغيير platform في نموذج تعديل: حدّث العنوان والـ URL
  useEffect(() => {
    if (editLink.display.kind) { setPrevEditPlatform(editLink.platform); return; }
    if (prevEditPlatform !== editLink.platform) {
      const isFile = editLink.platform === 'file';
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === editLink.platform);
      
      setEditLink((prev) => ({
        ...prev,
        title: isFile ? getDefaultTitleByCategory(prev.fileCategory) : platform?.name || '',
        url: isFile ? prev.url : keepOwnFieldUrl(platform?.id, prev.url) ?? (platform?.placeholder || ''),
        linkType: isFile ? 'file' : 'url',
      }));
      setPrevEditPlatform(editLink.platform);
    }
  }, [editLink.platform, prevEditPlatform]);

  const applyPlatformToForm = (form: LinkFormState, platformId: string): LinkFormState => {
    const platform = SOCIAL_PLATFORMS.find((item) => item.id === platformId);
    const isFile = platformId === 'file';

    return {
      ...form,
      platform: platformId,
      display: { ...form.display, kind: undefined },
      linkType: isFile ? 'file' : 'url',
      title: form.title || (isFile ? getDefaultTitleByCategory(form.fileCategory) : platform?.name || ''),
      url: isFile ? form.url : keepOwnFieldUrl(platformId, form.url) ?? (form.url || platform?.placeholder || ''),
      fileName: isFile ? form.fileName : '',
      fileMimeType: isFile ? form.fileMimeType : '',
      fileSize: isFile ? form.fileSize : undefined,
    };
  };

  const handleFilePicked = async (
    file: File,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    setError: (value: string) => void,
  ) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('نوع الملف غير مدعوم. المسموح: الصور (PNG, JPG, WebP, GIF) وملفات PDF فقط.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('حجم الملف كبير. الحد الأقصى 3MB.');
      return;
    }

    setError('');

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({
        ...prev,
        platform: 'file',
        linkType: 'file',
        url: dataUrl,
        fileName: prev.fileName || file.name,
        fileMimeType: file.type || prev.fileMimeType,
        fileSize: file.size,
        title: prev.title.trim() ? prev.title : getDefaultTitleByCategory(prev.fileCategory),
      }));
    } catch {
      setError('تعذر قراءة الملف. حاول مرة أخرى.');
    }
  };

  const handleAddLink = () => {
    if (!isFormReady(newLink)) return;

    addLink({
      display: newLink.display,
      title: newLink.display.kind === 'text' ? newLink.display.body!.trim().slice(0, 80) : newLink.title.trim(),
      titleEn: newLink.titleEn.trim() || undefined,
      url: newLink.url.trim(),
      platform: newLink.platform as any,
      iconStyle: newLink.iconStyle,
      textPosition: newLink.textPosition,
      linkType: newLink.linkType,
      fileCategory: newLink.linkType === 'file' ? newLink.fileCategory : undefined,
      fileName: newLink.fileName.trim() || undefined,
      fileMimeType: newLink.fileMimeType.trim() || undefined,
      fileSize: newLink.fileSize,
      customIcon: ICON_PLATFORMS.includes(newLink.platform) ? newLink.customIcon || undefined : undefined,
    }, newLink.sectionMembers);

    setNewLink(createInitialFormState());
    setNewPlatformQuery('');
    setShowMorePlatformsForNew(false);
    setNewFileError('');
    setIsAdding(false);
  };

  const handleEditLink = (id: string) => {
    if (!isFormReady(editLink)) return;

    updateLink(id, {
      display: editLink.display,
      title: editLink.display.kind === 'text' ? editLink.display.body!.trim().slice(0, 80) : editLink.title.trim(),
      titleEn: editLink.titleEn.trim() || undefined,
      url: editLink.url.trim(),
      platform: editLink.platform as any,
      iconStyle: editLink.iconStyle,
      textPosition: editLink.textPosition,
      linkType: editLink.linkType,
      fileCategory: editLink.linkType === 'file' ? editLink.fileCategory : undefined,
      fileName: editLink.fileName.trim() || undefined,
      fileMimeType: editLink.fileMimeType.trim() || undefined,
      fileSize: editLink.fileSize,
      customIcon: ICON_PLATFORMS.includes(editLink.platform) ? editLink.customIcon || undefined : undefined,
    }, editLink.sectionMembers);

    setEditingId(null);
    setEditLink(createInitialFormState());
    setEditPlatformQuery('');
    setShowMorePlatformsForEdit(false);
    setEditFileError('');
  };

  const startEdit = (id: string) => {
    const link = pageData.links.find((item) => item.id === id);
    if (!link) return;

    setEditingId(id);
    setPrevEditPlatform(link.platform || 'custom');
    setEditLink({
      title: link.title,
      titleEn: link.titleEn || '',
      url: link.url,
      platform: link.platform || 'custom',
      iconStyle: link.iconStyle || 'color',
      textPosition: link.textPosition || 'center',
      linkType: link.linkType || (link.platform === 'file' ? 'file' : 'url'),
      fileCategory: link.fileCategory || 'other',
      fileName: link.fileName || '',
      fileMimeType: link.fileMimeType || '',
      fileSize: link.fileSize,
      fileKind: link.fileMimeType?.startsWith('image/') ? 'image' : 'pdf',
      customIcon: link.customIcon || '',
      display: link.display?.kind === 'heading' ? { ...link.display, sectionId: link.display.sectionId || crypto.randomUUID() } : link.display || {},
      sectionMembers: link.display?.kind === 'heading' && link.display.sectionId ? pageData.links.filter(item => item.display?.kind !== 'heading' && item.display?.sectionId === link.display?.sectionId).map(item => item.id) : [],
    });
    setEditPlatformQuery('');
    setShowMorePlatformsForEdit(false);
    setEditFileError('');
  };

  const renderQuickTypePicker = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
  ) => (
    <div className="grid grid-cols-3 gap-2 p-3">
      {quickSocialPlatforms.map((platform) => {
        const isActive = form.display.kind !== 'video' && form.platform === platform.id;
        return (
          <button
            key={platform.id}
            type="button"
            onClick={() => setForm((prev) => applyPlatformToForm(prev, platform.id))}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 text-[11px] font-bold transition-all ${
              isActive ? 'border-[#0a84ff] bg-[#0a84ff]/5 text-[#1d1d1f]' : 'border-transparent bg-[#f2f2f7] text-[#3a3a3c]'
            }`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <SocialIcon platform={platform.id as any} iconStyle="color" className="h-6 w-6" />
            {platform.id === 'twitter' ? 'X' : platform.name}
          </button>
        );
      })}
      <button type="button" onClick={() => setForm(prev => ({ ...prev, platform: 'custom', linkType: 'url', title: prev.title || 'فيديو تعريفي', url: parseYouTubeVideoSource(prev.url) ? prev.url : '', display: { kind: 'video', sectionId: prev.display.sectionId } }))} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 text-[11px] font-bold ${form.display.kind === 'video' ? 'border-[#0a84ff] bg-blue-50' : 'border-transparent bg-[#f2f2f7]'}`}><PlayCircle className="h-6 w-6" />فيديو يوتيوب داخل الصفحة</button>
      {/* Image and PDF are two tiles; both are stored as a file button. */}
      {([
        { kind: 'image', label: 'صورة', icon: 'image' },
        { kind: 'pdf', label: 'ملف PDF', icon: 'file' },
      ] as const).map((tile) => {
        const isActive = form.platform === 'file' && form.fileKind === tile.kind;
        return (
          <button
            key={tile.kind}
            type="button"
            onClick={() =>
              setForm((prev) => {
                const next = applyPlatformToForm(prev, 'file');
                // switching kind drops a file of the other kind
                const keep = prev.platform === 'file' && prev.fileKind === tile.kind;
                return { ...next, fileKind: tile.kind, ...(keep ? {} : { url: '', fileName: '', fileMimeType: '', fileSize: undefined }) };
              })
            }
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 text-[11px] font-bold transition-all ${
              isActive ? 'border-[#0a84ff] bg-[#0a84ff]/5 text-[#1d1d1f]' : 'border-transparent bg-[#f2f2f7] text-[#3a3a3c]'
            }`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <SocialIcon platform={tile.icon} iconStyle="color" className="h-6 w-6" />
            {tile.label}
          </button>
        );
      })}
    </div>
  );

  const renderAllPlatforms = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    platformQuery: string,
    setPlatformQuery: (value: string) => void,
    showMorePlatforms: boolean,
    setShowMorePlatforms: (value: boolean) => void,
    filteredPlatforms: readonly (typeof SOCIAL_PLATFORMS)[number][],
  ) => (
    <>
      <button
        type="button"
        onClick={() => setShowMorePlatforms(!showMorePlatforms)}
        className="flex min-h-[44px] w-full items-center justify-between px-4 text-[15px] text-[#0a84ff]"
      >
        {showMorePlatforms ? 'إخفاء المنصات' : 'منصات أخرى'}
        <ChevronDown className={`h-4 w-4 transition-transform ${showMorePlatforms ? 'rotate-180' : ''}`} />
      </button>

      {showMorePlatforms && (
        <div className="space-y-1 px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-[#8e8e93]" />
            <input
              value={platformQuery}
              onChange={(e) => setPlatformQuery(e.target.value)}
              placeholder="بحث"
              className="w-full rounded-[10px] bg-[#e9e9ee] py-2 pl-3 pr-8 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filteredPlatforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setForm((prev) => applyPlatformToForm(prev, platform.id))}
                className="flex min-h-[44px] w-full items-center gap-3 border-b border-[#e5e5ea] px-1 text-right text-[15px] text-[#1d1d1f] last:border-0"
              >
                <SocialIcon platform={platform.id as any} iconStyle="color" className="h-5 w-5" />
                <span className="flex-1">{platform.name}</span>
                {form.platform === platform.id && <Check className="h-4 w-4 text-[#0a84ff]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderFileFields = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    fileError: string,
    setFileError: (value: string) => void,
  ) => (
    <div className="px-4 py-3">
      <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#f2f2f7] text-[15px] text-[#0a84ff]">
        <Upload className="h-4 w-4" />
        {form.fileKind === 'image' ? (form.url ? 'تغيير الصورة' : 'اختيار صورة') : form.url ? 'تغيير الملف' : 'اختيار ملف PDF'}
        <input
          type="file"
          accept={form.fileKind === 'image' ? IMAGE_TYPES.join(',') : 'application/pdf'}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const isImage = file.type.startsWith('image/');
            if (isImage !== (form.fileKind === 'image')) {
              setFileError(form.fileKind === 'image' ? 'اختر صورة (PNG أو JPG أو WebP أو GIF).' : 'اختر ملف PDF.');
              return;
            }
            handleFilePicked(file, setForm, setFileError);
          }}
        />
      </label>

      {!!form.fileMimeType && (
        <div className="mt-2 truncate text-center text-xs text-[#8e8e93]" dir="ltr">
          {form.fileName || form.fileMimeType}
          {form.fileSize ? ` • ${formatFileSize(form.fileSize)}` : ''}
        </div>
      )}

      {!!fileError && (
        <div className="mt-2 flex items-center gap-1 text-xs text-[#ff3b30]">
          <AlertCircle className="h-4 w-4" />
          <span>{fileError}</span>
        </div>
      )}
    </div>
  );

  const renderFormFields = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    fileError: string,
    setFileError: (value: string) => void,
  ) => {
    if (form.display.kind === 'text') return <div className="space-y-3 p-4">
      <label className="block text-sm text-[#1d1d1f]">النص<textarea aria-label="نص الفقرة" rows={5} maxLength={2000} value={form.display.body ?? ''} onChange={event => setForm(prev => ({ ...prev, display: { ...prev.display, body: event.target.value } }))} placeholder="اكتب نبذة أو إعلانًا أو شرحًا بين الروابط…" className="mt-2 w-full resize-y rounded-xl bg-[#f2f2f7] p-3 leading-relaxed" /></label>
      <p className="text-left text-xs text-[#8e8e93]">{form.display.body?.length ?? 0} / 2000</p>
      {hasEnglish && <label className="block text-sm text-[#1d1d1f]">English<textarea aria-label="English paragraph" dir="ltr" rows={4} maxLength={2000} value={form.display.bodyEn ?? ''} onChange={event => setForm(prev => ({ ...prev, display: { ...prev.display, bodyEn: event.target.value } }))} placeholder="Optional English paragraph" className="mt-2 w-full resize-y rounded-xl bg-[#f2f2f7] p-3 leading-relaxed" /></label>}
    </div>;
    if (form.display.kind === 'heading') return <>
      <FieldRow label="عنوان القسم" value={form.title} maxLength={120} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="مثل: خدماتنا" />
      {hasEnglish && <FieldRow label="English" dir="ltr" value={form.titleEn} maxLength={255} onChange={event => setForm(prev => ({ ...prev, titleEn: event.target.value }))} placeholder="Section title (optional)" />}
    </>;
    if (form.display.kind === 'video') return <>
      <FieldRow label="عنوان الفيديو" value={form.title} maxLength={120} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="مثل: تعرّف على الجهة" />
      {hasEnglish && <FieldRow label="English" dir="ltr" value={form.titleEn} onChange={event => setForm(prev => ({ ...prev, titleEn: event.target.value }))} placeholder="Video title (optional)" />}
      <FieldRow label="رابط الفيديو" aria-label="رابط الفيديو يوتيوب داخل الصفحة" type="url" dir="ltr" value={form.url} onChange={event => setForm(prev => ({ ...prev, url: event.target.value }))} placeholder="https://www.youtube.com/watch?v=…" />
      <p className="px-4 py-2 text-xs text-[#6e6e73]">ضع رابط فيديو محدد من يوتيوب، وليس رابط قناة. يشاهده الزائر داخل الصفحة.</p>
      {!!form.url && !parseYouTubeVideoSource(form.url) && <p role="alert" className="px-4 pb-3 text-xs text-[#ff3b30]">أدخل رابط فيديو يوتيوب صالحًا، وليس رابط قناة أو قائمة تشغيل.</p>}
    </>;
    const isFile = form.platform === 'file' || form.linkType === 'file';

    return (
      <>
        <FieldRow label="العنوان" maxLength={120} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={isFile ? 'مثل: التقرير السنوي' : 'العنوان'} style={{ fontFamily: 'Cairo, sans-serif' }} />
        {hasEnglish && (
          <FieldRow label="English" dir="ltr" value={form.titleEn} onChange={(e) => setForm((prev) => ({ ...prev, titleEn: e.target.value }))} placeholder="Button title (optional)" />
        )}
        {isFile ? (
          renderFileFields(form, setForm, fileError, setFileError)
        ) : form.platform === 'email' ? (
          // The visitor taps the button and their mail app opens; «mailto:» is added here, never typed.
          <>
            <FieldRow
              label="البريد"
              type="email"
              inputMode="email"
              dir="ltr"
              value={form.url.replace(/^mailto:/i, '')}
              onChange={(e) => {
                const address = e.target.value.trim();
                setForm((prev) => ({ ...prev, url: address ? `mailto:${address}` : '', linkType: 'url' }));
              }}
              placeholder="name@example.com"
            />
            {/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.url) && <Confirmation text="يفتح رسالة بريد جديدة إليك" />}
          </>
        ) : form.platform === 'whatsapp' ? (
          // A phone number in; the wa.me link is built here.
          <>
            <label className="flex min-h-[48px] items-center gap-3 px-4">
              <span className="w-20 shrink-0 text-[15px] text-[#1d1d1f]">الجوال</span>
              <span className="flex min-w-0 flex-1 items-center gap-2" dir="ltr">
                <span className="text-[15px] text-[#8e8e93]">+966</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.url.startsWith(WHATSAPP_PREFIX) ? form.url.slice(WHATSAPP_PREFIX.length) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').replace(/^(966|0)/, '').slice(0, 9);
                    setForm((prev) => ({ ...prev, url: digits ? `${WHATSAPP_PREFIX}${digits}` : '', linkType: 'url' }));
                  }}
                  placeholder="5X XXX XXXX"
                  className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none"
                />
              </span>
            </label>
            {/^https:\/\/wa\.me\/9665\d{8}$/.test(form.url) && <Confirmation text="يفتح محادثة واتساب معك" />}
          </>
        ) : (
          <FieldRow
            label="الرابط"
            type="url"
            dir="ltr"
            value={form.url}
            onChange={(e) => {
              const value = e.target.value;
              const detected = detectPlatformFromUrl(value);
              setForm((prev) => ({ ...prev, url: value, platform: detected || prev.platform, linkType: 'url' }));
            }}
            placeholder="https://example.com"
          />
        )}
      </>
    );
  };

  // «الأيقونة»: the default icon, an uploaded image (D) or one from the library (A).
  const renderIconPicker = (form: LinkFormState, setForm: React.Dispatch<React.SetStateAction<LinkFormState>>) => {
    const uploaded = form.customIcon.startsWith('data:');
    const subject = `${form.title} ${form.url}`.toLowerCase();
    const suggestions = form.linkType === 'file'
      ? (form.fileKind === 'image' ? ['image', 'camera', 'download', 'file'] : ['file', 'download', 'book', 'menu'])
      : /تبرع|دعم|donat/.test(subject) ? ['donate', 'heart', 'gift', 'team']
      : /متجر|تسوق|shop|store/.test(subject) ? ['store', 'cart', 'offer', 'delivery']
      : /حجز|موعد|book|reserv/.test(subject) ? ['booking', 'ticket', 'phone', 'location']
      : /موقع|خريطة|maps|location/.test(subject) ? ['location', 'globe', 'car', 'company']
      : ['globe', 'link', 'info', 'phone', 'location', 'store', 'booking', 'file'];
    const selected = form.customIcon.startsWith('icon:') ? form.customIcon.slice(5) : '';
    const suggestedIcons = [...new Set([selected, ...suggestions])].filter(Boolean).map(id => LINK_ICONS.find(icon => icon.id === id)).filter((icon): icon is (typeof LINK_ICONS)[number] => Boolean(icon));
    const visibleIcons = expandedIcons ? LINK_ICONS.filter(icon => `${icon.label} ${icon.id}`.toLowerCase().includes(iconQuery.trim().toLowerCase())) : suggestedIcons;

    const tile = (active: boolean) =>
      `flex aspect-square items-center justify-center rounded-xl border-2 transition-all ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`;

    return (
      <Group title="الأيقونة" footer="ارفع شعارًا أو صورة صغيرة، أو اختر أيقونة تعبّر عن الزر.">
        <div className="flex items-center gap-3 p-3">
          <button type="button" onClick={() => setForm((prev) => ({ ...prev, customIcon: '' }))} className={`${tile(!form.customIcon)} h-11 w-11 shrink-0`} aria-label="الأيقونة الافتراضية">
            <SocialIcon platform={form.platform === 'file' && form.fileKind === 'image' ? 'image' : form.platform} iconStyle="color" className="h-5 w-5" />
          </button>
          <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#0a84ff]/30 bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0a84ff] focus-within:ring-2 focus-within:ring-[#0a84ff]">
            {uploaded ? <img src={form.customIcon} alt="" className="h-7 w-7 rounded-md object-contain" /> : <Upload className="h-5 w-5 text-[#0a84ff]" />}
            <span>{uploaded ? 'تغيير الشعار المرفق' : 'إرفاق شعار أو أيقونة خاصة'}</span>
            <input
              type="file"
              aria-label="إرفاق شعار أو أيقونة خاصة"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > MAX_ICON_SOURCE_SIZE) {
                  setIconError('الصورة كبيرة جدًا. الحد الأقصى 8MB.');
                  return;
                }
                setIconError('');
                const reader = new FileReader();
                reader.onloadend = () => setIconCrop({ src: String(reader.result || ''), setForm });
                reader.onerror = () => setIconError('تعذّر قراءة الصورة. حاول مجددًا.');
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="px-3 pb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#6e6e73]">{expandedIcons ? 'مكتبة الأيقونات' : 'أيقونات مقترحة لهذا الزر'}</span>
            <button type="button" aria-expanded={expandedIcons} onClick={() => { setExpandedIcons(!expandedIcons); setIconQuery(''); }} className="min-h-10 text-xs font-semibold text-[#0a84ff]">{expandedIcons ? 'عرض المقترحة فقط' : 'إظهار كل الأيقونات'}</button>
          </div>
          {expandedIcons && <input type="search" aria-label="البحث في الأيقونات" placeholder="ابحث عن أيقونة…" value={iconQuery} onChange={event => setIconQuery(event.target.value)} className="mb-3 w-full rounded-xl bg-[#f2f2f7] px-3 py-2 text-sm" />}
          <div className={`grid grid-cols-4 gap-2 ${expandedIcons ? 'max-h-64 overflow-y-auto' : ''}`}>
          {visibleIcons.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setForm((prev) => ({ ...prev, customIcon: `icon:${id}` }))} className={`${tile(form.customIcon === `icon:${id}`)} min-h-16 flex-col gap-1 p-1`} aria-pressed={form.customIcon === `icon:${id}`} aria-label={label} title={label}>
              <Icon className="h-5 w-5 text-[#3a3a3c]" />
              <span className="text-[10px] text-[#6e6e73]">{label}</span>
            </button>
          ))}
          </div>
          {!visibleIcons.length && <p className="py-3 text-center text-xs text-[#6e6e73]">لا توجد أيقونة مطابقة. جرّب كلمة أخرى أو أرفق شعارك.</p>}
        </div>
        {!!iconError && <p className="px-4 pb-3 text-xs text-[#ff3b30]">{iconError}</p>}
      </Group>
    );
  };

  // The add / edit form: a sheet-like card with Cancel and the main action, as in iOS.
  const renderForm = (
    title: string,
    actionLabel: string,
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    fileError: string,
    setFileError: (value: string) => void,
    platforms: Parameters<typeof renderAllPlatforms>,
    onSubmit: () => void,
    onCancel: () => void,
  ) => (
    <div className="space-y-4 rounded-2xl bg-[#e9e9ee]/60 p-2">
      <div className="flex items-center justify-between px-2 pt-1">
        <button onClick={onCancel} className="text-[15px] text-[#0a84ff]">إلغاء</button>
        <span className="text-[15px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{title}</span>
        <button
          onClick={onSubmit}
          disabled={!isFormReady(form)}
          className="text-[15px] font-bold text-[#0a84ff] disabled:text-[#c7c7cc]"
        >
          {actionLabel}
        </button>
      </div>
      {form.display.kind !== 'heading' && form.display.kind !== 'text' && <Group title="النوع">
        {renderQuickTypePicker(form, setForm)}
        {renderAllPlatforms(...platforms)}
      </Group>}
      <Group
        title="التفاصيل"
        footer={form.platform === 'file' ? 'العنوان هو النص الذي يراه الزوار على الزر.' : undefined}
      >
        {renderFormFields(form, setForm, fileError, setFileError)}
      </Group>
      {form.display.kind === 'heading' && <Group title={form.display.sectionId ? 'روابط القسم' : 'تجميع الروابط'} footer="نقل القسم ينقل روابطه معه. إخفاؤه يخفيها عن الزوار، وحذفه يُبقي الروابط خارج الأقسام.">
        {!form.display.sectionId ? <button type="button" onClick={() => setForm(prev => ({ ...prev, display: { ...prev.display, sectionId: crypto.randomUUID() } }))} className="min-h-11 px-4 text-sm text-[#0a84ff]">تجميع روابط تحت هذا العنوان</button> : <div className="p-3">
          <div className="mb-4 space-y-2"><p className="text-xs text-[#6e6e73]">طريقة عرض القسم</p><Segmented options={[{ id: 'list', label: 'قائمة' }, { id: 'grid', label: 'شبكة' }, { id: 'carousel', label: 'شرائح أفقية' }]} value={form.display.sectionLayout ?? 'list'} onChange={sectionLayout => setForm(prev => ({ ...prev, display: { ...prev.display, sectionLayout: sectionLayout as 'list' | 'grid' | 'carousel' } }))} /></div>
          <p className="mb-2 text-xs text-[#6e6e73]">اختياري: اختر محتوى القسم، أو اتركه فارغًا ليظهر العنوان فقط.</p>
          {pageData.links.filter(item => item.display?.kind !== 'heading').map(item => <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-gray-100 py-2 text-sm text-[#1d1d1f]">
            <input type="checkbox" checked={form.sectionMembers.includes(item.id)} onChange={event => setForm(prev => ({ ...prev, sectionMembers: event.target.checked ? [...prev.sectionMembers, item.id] : prev.sectionMembers.filter(id => id !== item.id) }))} className="h-4 w-4 accent-[#0a84ff]" />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.display?.sectionId && item.display.sectionId !== form.display.sectionId && <span className="text-[10px] text-[#8e8e93]">من قسم آخر</span>}
          </label>)}
          {!pageData.links.some(item => item.display?.kind !== 'heading') && <p className="py-2 text-xs text-[#6e6e73]">يمكنك إضافة القسم كعنوان فقط الآن، وربط المحتوى به لاحقًا.</p>}
        </div>}
      </Group>}
      {form.display.kind !== 'heading' && <>
        <Group title="القسم">
          <label className="flex items-center gap-3 p-3 text-sm text-[#1d1d1f]">
            <span>ضمن قسم</span><select aria-label="قسم الرابط" value={form.display.sectionId ?? ''} onChange={event => setForm(prev => ({ ...prev, display: { ...prev.display, sectionId: event.target.value || undefined } }))} className="min-w-0 flex-1 rounded-lg bg-[#f2f2f7] px-2 py-2">
              <option value="">خارج الأقسام</option>
              {pageData.links.filter(item => item.display?.kind === 'heading' && item.display.sectionId).map(item => <option key={item.id} value={item.display!.sectionId}>{item.title}{item.hidden ? ' (مخفي)' : ''}</option>)}
            </select>
          </label>
        </Group>
        {form.display.kind !== 'video' && form.display.kind !== 'text' && <>
          <LinkAppearanceEditor display={form.display} onChange={display => setForm(prev => ({ ...prev, display }))} />
          {ICON_PLATFORMS.includes(form.platform) && renderIconPicker(form, setForm)}
        </>}
      </>}
    </div>
  );

  const resetNew = () => {
    setIsAdding(false);
    setNewLink(createInitialFormState());
    setNewPlatformQuery('');
    setShowMorePlatformsForNew(false);
    setNewFileError('');
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditLink(createInitialFormState());
    setEditPlatformQuery('');
    setShowMorePlatformsForEdit(false);
    setEditFileError('');
  };

  return (
    <Panel>
      {!!iconCrop && (
        // Square and small: an icon only needs 128 px.
        <ImageCropper
          src={iconCrop.src}
          aspect={1}
          outputWidth={128}
          onUseOriginal={() => {
            const pending = iconCrop;
            const image = new Image();
            image.onerror = () => { setIconError('تعذّر فتح الشعار. جرّب صورة أخرى.'); setIconCrop(null); };
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 128;
              const context = canvas.getContext('2d');
              if (!context) { setIconError('تعذّر تجهيز الشعار. حاول مجددًا.'); setIconCrop(null); return; }
              const scale = Math.min(128 / image.width, 128 / image.height);
              const width = image.width * scale;
              const height = image.height * scale;
              context.drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
              pending.setForm(prev => ({ ...prev, customIcon: canvas.toDataURL('image/png') }));
              setIconCrop(null);
            };
            image.src = pending.src;
          }}
          onCancel={() => setIconCrop(null)}
          onConfirm={(value) => {
            iconCrop.setForm((prev) => ({ ...prev, customIcon: value }));
            setIconCrop(null);
          }}
        />
      )}
      {isAdding &&
        renderForm(newLink.display.kind === 'text' ? 'فقرة نصية جديدة' : newLink.display.kind === 'heading' ? 'قسم جديد' : 'رابط جديد', 'إضافة', newLink, setNewLink, newFileError, setNewFileError,
          [newLink, setNewLink, newPlatformQuery, setNewPlatformQuery, showMorePlatformsForNew, setShowMorePlatformsForNew, filteredPlatformsForNew],
          handleAddLink, resetNew)}

      <Group
        title={`المحتوى · ${pageData.links.length} من ${MAX_LINKS}`}
        footer="رتّب بالأسهم أو بالسحب على الكمبيوتر. العين تخفي الزر عن الزوار دون حذفه. الفيديو يمكن عرضه بمشغّل داخل الصفحة."
      >
        {!isAdding && (
          limitReached ? (
            <p className="px-4 py-3 text-sm text-[#8e8e93]">وصلت للحد الأقصى ({MAX_LINKS} عنصرًا). احذف عنصرًا لإضافة آخر.</p>
          ) : (
            <div>
            <button onClick={() => { setNewLink(createInitialFormState()); setIsAdding(true); }} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-[15px] text-[#0a84ff]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a84ff] text-white"><Plus className="h-4 w-4" /></span>
              إضافة رابط أو ملف
            </button>
            <button onClick={() => { setNewLink({ ...createInitialFormState(), platform: 'custom', display: { kind: 'text', body: '' } }); setIsAdding(true); }} className="flex min-h-11 w-full items-center gap-3 px-4 pb-2 text-sm text-[#0a84ff]"><Plus className="h-4 w-4" />إضافة فقرة نصية</button>
            <button onClick={() => { setNewLink({ ...createInitialFormState(), platform: 'custom', display: { kind: 'heading', sectionId: crypto.randomUUID() } }); setIsAdding(true); }} className="flex min-h-11 w-full items-center gap-3 px-4 pb-2 text-sm text-[#0a84ff]">
              <Plus className="h-4 w-4" />إضافة قسم
            </button>
            </div>
          )
        )}

        {pageData.links.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#8e8e93]">لا توجد أزرار بعد.</p>
        )}

        {pageData.links.map((link, index) => {
          const isFile = link.linkType === 'file';
          const sectionKey = link.display?.sectionId;
          const isMember = Boolean(sectionKey && link.display?.kind !== 'heading');
          const section = isMember ? pageData.links.find(item => item.display?.kind === 'heading' && item.display.sectionId === sectionKey) : undefined;
          const siblings = pageData.links.filter(item => isMember ? item.display?.kind !== 'heading' && item.display?.sectionId === sectionKey : item.display?.kind === 'heading' || !item.display?.sectionId);
          const siblingIndex = siblings.findIndex(item => item.id === link.id);

          if (editingId === link.id) {
            return (
              <div key={link.id} className="p-2">
                {renderForm(link.display?.kind === 'text' ? 'تعديل الفقرة النصية' : link.display?.kind === 'heading' ? 'تعديل القسم' : 'تعديل الزر', 'تم', editLink, setEditLink, editFileError, setEditFileError,
                  [editLink, setEditLink, editPlatformQuery, setEditPlatformQuery, showMorePlatformsForEdit, setShowMorePlatformsForEdit, filteredPlatformsForEdit],
                  () => handleEditLink(link.id), resetEdit)}
              </div>
            );
          }

          return (
            <div
              key={link.id}
              draggable
              onDragStart={(e) => {
                setDraggedId(link.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!draggedId || draggedId === link.id) return;
                e.preventDefault();
                setDragOverId(link.id);
              }}
              onDragLeave={() => setDragOverId((current) => (current === link.id ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId) reorderLink(draggedId, link.id);
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={`flex min-h-[60px] items-center gap-2 px-3 py-2 transition-all ${dragOverId === link.id ? 'bg-[#0a84ff]/10' : ''} ${draggedId === link.id ? 'opacity-50' : ''} ${isMember ? 'mr-5 border-r-2 border-blue-100 bg-blue-50/20' : sectionKey ? 'bg-blue-50/50' : ''}`}
            >
              <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-[#c7c7cc] lg:block" />
              <div className="flex flex-col">
                <button onClick={() => moveLink(link.id, 'up')} disabled={siblingIndex === 0} aria-label="أعلى" className="p-0.5 text-[#8e8e93] disabled:text-[#e5e5ea]"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveLink(link.id, 'down')} disabled={siblingIndex === siblings.length - 1} aria-label="أسفل" className="p-0.5 text-[#8e8e93] disabled:text-[#e5e5ea]"><ChevronDown className="h-4 w-4" /></button>
              </div>

              <button onClick={() => startEdit(link.id)} className={`flex min-w-0 flex-1 items-center gap-3 text-right ${link.hidden ? 'opacity-40' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7]">
                  {link.display?.kind === 'text' ? <span className="text-lg font-bold">ن</span> : link.display?.kind === 'video' ? <PlayCircle className="h-5 w-5" /> : link.display?.kind === 'heading' ? <span className="text-lg font-bold text-[#6e6e73]">ع</span> : link.display?.layout === 'card' && link.display.image ? <img src={link.display.image} alt="" className="h-full w-full rounded-[10px] object-cover" /> : <SocialIcon platform={link.linkType === 'file' && link.fileMimeType?.startsWith('image/') ? 'image' : link.platform || 'custom'} iconStyle={link.iconStyle || 'color'} customIcon={link.customIcon} color={link.customIcon?.startsWith('icon:') ? '#3a3a3c' : undefined} className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[#1d1d1f]">{link.title}</span>
                  <span className="block truncate text-xs text-[#8e8e93]" dir={isFile ? undefined : 'ltr'}>
                    {link.hidden ? 'مخفي عن الزوار' : link.display?.kind === 'text' ? 'فقرة نصية · بدون رابط' : link.display?.kind === 'video' ? 'فيديو يوتيوب داخل الصفحة' : link.display?.kind === 'heading' ? sectionKey ? `قسم روابط · ${pageData.links.filter(item => item.display?.kind !== 'heading' && item.display?.sectionId === sectionKey).length} روابط` : 'عنوان فقط · بدون رابط' : link.display?.layout === 'card' ? 'بطاقة مصوّرة' : isFile ? `${getCategoryLabel(link.fileCategory)}${link.fileSize ? ` • ${formatFileSize(link.fileSize)}` : ''}` : link.url.replace(/^mailto:/i, '')}
                  </span>
                  {section && <span className="block text-[10px] text-[#0a84ff]">ضمن {section.title}{section.hidden ? ' · القسم مخفي عن الزوار' : ''}</span>}
                </span>
              </button>

              <button
                onClick={() => updateLink(link.id, { hidden: !link.hidden })}
                aria-label={link.hidden ? 'إظهار الزر للجمهور' : 'إخفاء الزر دون حذفه'}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#8e8e93] active:bg-[#f2f2f7]"
              >
                {link.hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
              <button
                onClick={() => removeLink(link.id)}
                aria-label="حذف"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#ff3b30] active:bg-[#ff3b30]/10"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>
          );
        })}
      </Group>
    </Panel>
  );
}
