import { useMemo, useState, useEffect } from 'react';
import { usePageContext } from '../context/PageContext';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Info,
  ChevronUp,
  ChevronDown,
  Search,
  FileText,
  Upload,
  AlertCircle,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { SOCIAL_PLATFORMS, SocialIcon } from './SocialIcons';
import { MAX_LINKS } from '../lib/site';

type LinkType = 'url' | 'file';
type IconStyle = 'color' | 'mono';
type TextPosition = 'center' | 'right';
type FileCategory = 'cv' | 'menu' | 'other';

type LinkFormState = {
  title: string;
  url: string;
  platform: string;
  iconStyle: IconStyle;
  textPosition: TextPosition;
  linkType: LinkType;
  fileCategory: FileCategory;
  fileName: string;
  fileMimeType: string;
  fileSize?: number;
};

const QUICK_SOCIAL_IDS = ['instagram', 'twitter', 'tiktok', 'youtube', 'whatsapp'];
// Files are stored inline for now; the final storage limits are pending (P-02).
const MAX_FILE_SIZE = 3 * 1024 * 1024;
// FILE-01: صور وPDF فقط — must match ALLOWED_FILE_MIME_TYPES in api/_lib/page.ts.
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

function createInitialFormState(): LinkFormState {
  return {
    title: '',
    url: '',
    platform: 'instagram',
    iconStyle: 'color',
    textPosition: 'center',
    linkType: 'url',
    fileCategory: 'other',
    fileName: '',
    fileMimeType: '',
  };
}

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

export function LinkEditor() {
  const { pageData, addLink, removeLink, updateLink, moveLink, reorderLink } = usePageContext();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const limitReached = pageData.links.length >= MAX_LINKS;
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

  const quickSocialPlatforms = useMemo(
    () => SOCIAL_PLATFORMS.filter((platform) => QUICK_SOCIAL_IDS.includes(platform.id)),
    [],
  );

  const filePlatform = useMemo(() => SOCIAL_PLATFORMS.find((platform) => platform.id === 'file'), []);

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
    if (prevNewPlatform !== newLink.platform) {
      const isFile = newLink.platform === 'file';
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === newLink.platform);
      
      setNewLink((prev) => ({
        ...prev,
        title: isFile ? getDefaultTitleByCategory(prev.fileCategory) : platform?.name || '',
        url: isFile ? prev.url : (platform?.placeholder || ''),
        linkType: isFile ? 'file' : 'url',
      }));
      setPrevNewPlatform(newLink.platform);
    }
  }, [newLink.platform, prevNewPlatform]);

  // عند تغيير platform في نموذج تعديل: حدّث العنوان والـ URL
  useEffect(() => {
    if (prevEditPlatform !== editLink.platform) {
      const isFile = editLink.platform === 'file';
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === editLink.platform);
      
      setEditLink((prev) => ({
        ...prev,
        title: isFile ? getDefaultTitleByCategory(prev.fileCategory) : platform?.name || '',
        url: isFile ? prev.url : (platform?.placeholder || ''),
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
      linkType: isFile ? 'file' : 'url',
      title: form.title || (isFile ? getDefaultTitleByCategory(form.fileCategory) : platform?.name || ''),
      url: isFile ? form.url : form.url || platform?.placeholder || '',
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
    if (!(newLink.title.trim() && newLink.url.trim())) return;

    addLink({
      title: newLink.title.trim(),
      url: newLink.url.trim(),
      platform: newLink.platform as any,
      iconStyle: newLink.iconStyle,
      textPosition: newLink.textPosition,
      linkType: newLink.linkType,
      fileCategory: newLink.linkType === 'file' ? newLink.fileCategory : undefined,
      fileName: newLink.fileName.trim() || undefined,
      fileMimeType: newLink.fileMimeType.trim() || undefined,
      fileSize: newLink.fileSize,
    });

    setNewLink(createInitialFormState());
    setNewPlatformQuery('');
    setShowMorePlatformsForNew(false);
    setNewFileError('');
    setIsAdding(false);
  };

  const handleEditLink = (id: string) => {
    if (!(editLink.title.trim() && editLink.url.trim())) return;

    updateLink(id, {
      title: editLink.title.trim(),
      url: editLink.url.trim(),
      platform: editLink.platform as any,
      iconStyle: editLink.iconStyle,
      textPosition: editLink.textPosition,
      linkType: editLink.linkType,
      fileCategory: editLink.linkType === 'file' ? editLink.fileCategory : undefined,
      fileName: editLink.fileName.trim() || undefined,
      fileMimeType: editLink.fileMimeType.trim() || undefined,
      fileSize: editLink.fileSize,
    });

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
    setEditLink({
      title: link.title,
      url: link.url,
      platform: link.platform || 'custom',
      iconStyle: link.iconStyle || 'color',
      textPosition: link.textPosition || 'center',
      linkType: link.linkType || (link.platform === 'file' ? 'file' : 'url'),
      fileCategory: link.fileCategory || 'other',
      fileName: link.fileName || '',
      fileMimeType: link.fileMimeType || '',
      fileSize: link.fileSize,
    });
    setEditPlatformQuery('');
    setShowMorePlatformsForEdit(false);
    setEditFileError('');
  };

  const renderQuickTypePicker = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
  ) => (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
        اختر النوع
      </label>
      <div className="grid grid-cols-3 gap-2">
        {quickSocialPlatforms.map((platform) => {
          const isActive = form.platform === platform.id;
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => setForm((prev) => applyPlatformToForm(prev, platform.id))}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                isActive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
              }`}
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {platform.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setForm((prev) => applyPlatformToForm(prev, 'file'))}
          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
            form.platform === 'file' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
          }`}
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {filePlatform?.name || 'ملف PDF'}
        </button>
      </div>
    </div>
  );

  const renderAllPlatforms = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    platformQuery: string,
    setPlatformQuery: (value: string) => void,
    showMorePlatforms: boolean,
    setShowMorePlatforms: (value: boolean) => void,
    filteredPlatforms: typeof SOCIAL_PLATFORMS,
  ) => (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowMorePlatforms(!showMorePlatforms)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        {showMorePlatforms ? '← إخفاء المنصات' : 'منصات أخرى +'}
      </button>

      {showMorePlatforms && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={platformQuery}
              onChange={(e) => setPlatformQuery(e.target.value)}
              placeholder="ابحث عن منصة..."
              className="w-full rounded-lg border border-gray-200 py-2 pr-8 pl-3 text-xs text-right focus:outline-none focus:border-emerald-500"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            />
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {filteredPlatforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setForm((prev) => applyPlatformToForm(prev, platform.id))}
                className={`w-full rounded-md px-3 py-2 text-xs text-right transition-all ${
                  form.platform === platform.id ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {platform.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderFileFields = (
    form: LinkFormState,
    setForm: React.Dispatch<React.SetStateAction<LinkFormState>>,
    fileError: string,
    setFileError: (value: string) => void,
  ) => (
    <div className="space-y-2">
      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 py-4 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 hover:border-teal-400">
        <Upload className="h-5 w-5" />
        تحميل صورة أو PDF
        <input
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            handleFilePicked(file, setForm, setFileError);
          }}
        />
      </label>

      {!!form.fileMimeType && (
        <div className="text-xs text-teal-700 text-center" style={{ fontFamily: 'monospace' }}>
          {form.fileMimeType}
          {form.fileSize ? ` • ${formatFileSize(form.fileSize)}` : ''}
        </div>
      )}

      {!!fileError && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span style={{ fontFamily: 'Tajawal, sans-serif' }}>{fileError}</span>
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
    const isFile = form.platform === 'file' || form.linkType === 'file';

    return (
      <>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            عنوان الرابط
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="العنوان"
            className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm text-right focus:outline-none focus:border-emerald-500"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          />
          {isFile && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              <span className="mt-px text-amber-500 shrink-0">💡</span>
              <span>هذا هو النص الذي يراه الزوار على الزر — اختر اسمًا يعكس محتوى الملف مثل <strong>"التقرير السنوي"</strong> أو <strong>"الملف التعريفي"</strong>.</span>
            </p>
          )}

        </div>

        {isFile ? (
          renderFileFields(form, setForm, fileError, setFileError)
        ) : (
          <input
            type="url"
            value={form.url}
            onChange={(e) => {
              const value = e.target.value;
              const detected = detectPlatformFromUrl(value);
              setForm((prev) => ({ ...prev, url: value, platform: detected || prev.platform, linkType: 'url' }));
            }}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm text-left focus:outline-none focus:border-emerald-500"
            dir="ltr"
            style={{ fontFamily: 'monospace' }}
          />
        )}
      </>
    );
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
          إدارة الروابط
        </h3>
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {pageData.links.length} / {MAX_LINKS}
        </div>
      </div>

      <div className="p-3 bg-indigo-50 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            أضف رابطًا خارجيًا أو صورة أو ملف PDF. اسحب الأزرار لترتيبها، وأخفِ أي زر دون حذفه. الفيديو يُضاف كرابط.
          </p>
        </div>
      </div>

      {isAdding ? (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-3 space-y-3">
          {renderQuickTypePicker(newLink, setNewLink)}
          {renderAllPlatforms(
            newLink,
            setNewLink,
            newPlatformQuery,
            setNewPlatformQuery,
            showMorePlatformsForNew,
            setShowMorePlatformsForNew,
            filteredPlatformsForNew,
          )}

          {renderFormFields(newLink, setNewLink, newFileError, setNewFileError)}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAddLink}
              disabled={newLink.platform === 'file' && !newLink.url}
              className="bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewLink(createInitialFormState());
                setNewPlatformQuery('');
                setShowMorePlatformsForNew(false);
                setNewFileError('');
              }}
              className="bg-white text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
          </div>
        </div>
      ) : limitReached ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          وصلت للحد الأقصى ({MAX_LINKS} زرًا). احذف زرًا لإضافة آخر.
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full border-2 border-dashed border-gray-300 text-gray-600 py-3 rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
            إضافة رابط أو ملف
          </span>
        </button>
      )}

      <div className="space-y-2">
        {pageData.links.map((link, index) => {
          const isFile = link.linkType === 'file';

          return (
            <div key={link.id}>
              {editingId === link.id ? (
                <div className="bg-white border-2 border-emerald-500 rounded-lg p-3 space-y-3">
                  {renderQuickTypePicker(editLink, setEditLink)}
                  {renderAllPlatforms(
                    editLink,
                    setEditLink,
                    editPlatformQuery,
                    setEditPlatformQuery,
                    showMorePlatformsForEdit,
                    setShowMorePlatformsForEdit,
                    filteredPlatformsForEdit,
                  )}

                  {renderFormFields(editLink, setEditLink, editFileError, setEditFileError)}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEditLink(link.id)}
                      disabled={editLink.platform === 'file' && !editLink.url}
                      className="bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-all flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      حفظ
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditLink(createInitialFormState());
                        setEditPlatformQuery('');
                        setShowMorePlatformsForEdit(false);
                        setEditFileError('');
                      }}
                      className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-all flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div
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
                  className={`bg-white border rounded-lg p-3 flex items-center gap-2 transition-all ${
                    dragOverId === link.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-200 hover:border-gray-300'
                  } ${draggedId === link.id || link.hidden ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="hidden lg:block w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveLink(link.id, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded transition-all ${
                        index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveLink(link.id, 'down')}
                      disabled={index === pageData.links.length - 1}
                      className={`p-1 rounded transition-all ${
                        index === pageData.links.length - 1
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-shrink-0">
                    <SocialIcon platform={link.platform || 'custom'} iconStyle={link.iconStyle || 'color'} className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {link.title}
                      {link.hidden && <span className="mr-2 text-xs font-normal text-gray-500">(مخفي)</span>}
                    </div>
                    {isFile ? (
                      <div className="text-xs text-teal-700 truncate" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                        {getCategoryLabel(link.fileCategory)}: {link.fileName || 'ملف مرفق'} {link.fileSize ? `• ${formatFileSize(link.fileSize)}` : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 truncate" dir="ltr" style={{ fontFamily: 'monospace' }}>
                        {link.url}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => updateLink(link.id, { hidden: !link.hidden })}
                      title={link.hidden ? 'إظهار الزر للجمهور' : 'إخفاء الزر دون حذفه'}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      {link.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(link.id)}
                      className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeLink(link.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
