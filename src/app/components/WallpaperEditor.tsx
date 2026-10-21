import { PageData, themes, usePageContext } from '../context/PageContext';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Loader2, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import { ColorDots, EndsSlider, Group, Panel, Row, Segmented, VerticalSlider } from './ios';
import { VideoWallpaperEditor } from './VideoWallpaperEditor';
import { WallpaperImage, wallpaperFocus } from './WallpaperImage';

const colors = [
  { name: 'أبيض', value: '#ffffff' },
  { name: 'أسود', value: '#1a1a1a' },
  { name: 'أزرق', value: '#e0f7ff' },
  { name: 'وردي', value: '#ffe0f0' },
  { name: 'أخضر', value: '#e8f5e9' },
  { name: 'أصفر', value: '#fff9c4' },
  { name: 'بنفسجي', value: '#f3e5f5' },
  { name: 'برتقالي', value: '#ffe0b2' },
];

const gradients = [
  { name: 'فجر', value: 'linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)' },
  { name: 'بحر', value: 'linear-gradient(135deg, #a5f3fc 0%, #6366f1 100%)' },
  { name: 'غابة', value: 'linear-gradient(135deg, #d9f99d 0%, #10b981 100%)' },
  { name: 'ليل', value: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { name: 'ورد', value: 'linear-gradient(135deg, #fbcfe8 0%, #c084fc 100%)' },
  { name: 'رمل', value: 'linear-gradient(135deg, #fef3c7 0%, #d6d3d1 100%)' },
];

// Stored inline for now; final storage limits are pending (P-02). A larger
// source is scaled down to a phone-sized JPEG before it is used.
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

export type WallpaperSegment = 'themes' | 'colors' | 'gradients' | 'photo' | 'video';

// Note 26: right to left — فيديو، صورة، ثيمات، ألوان، تدرجات.
const SEGMENTS = [
  { id: 'video', label: 'فيديو' },
  { id: 'photo', label: 'صورة' },
  { id: 'themes', label: 'ثيمات' },
  { id: 'colors', label: 'ألوان' },
  { id: 'gradients', label: 'تدرجات' },
] as const;

// Theme names are shown as they are; these Arabic words only help the search.
const THEME_WORDS: Record<string, string> = {
  minimal: 'بسيط أبيض', dark: 'داكن أسود', ocean: 'محيط بحر أزرق', sunset: 'غروب برتقالي', forest: 'غابة أخضر',
  neon: 'نيون فسفوري', rose: 'ورد وردي', lavender: 'لافندر بنفسجي', peach: 'خوخ', midnight: 'منتصف الليل ليل',
  sand: 'رمل رملي', candy: 'حلوى وردي', mint: 'نعناع أخضر', royal: 'ملكي بنفسجي', coral: 'مرجان مرجاني',
  sky: 'سماء أزرق', vintage: 'كلاسيكي قديم', emerald: 'زمرد زمردي أخضر', autumn: 'خريف أصفر', berry: 'توت توتي',
};

// Lenient Arabic/Latin matching: case, hamza forms, taa marbuta and diacritics.
const fold = (text: string) => text.toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
const matches = (query: string, ...texts: string[]) => !fold(query) || texts.some((text) => fold(text).includes(fold(query)));

function scaleImage(source: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('تعذّر فتح الصورة. جرّب صورة أخرى.'));
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('تعذّر تجهيز الصورة. حاول مجددًا.')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.src = source;
  });
}

// A phone-shaped card, as in Apple's wallpaper picker.
function PhoneCard({ name, style, active, onClick, children }: { name: string; style: CSSProperties; active: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="min-w-0 text-right transition-transform active:scale-[0.97]">
      <span className={`relative block aspect-[9/19] overflow-hidden rounded-[22px] border shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition-all ${active ? 'border-[#0a84ff] ring-2 ring-[#0a84ff]/60 ring-offset-2' : 'border-black/5'}`} style={style}>
        {children}
        {active && <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0a84ff] text-white shadow"><Check className="h-3.5 w-3.5" /></span>}
      </span>
      <span className="mt-2 block truncate text-center text-xs font-bold text-[#3a3a3c]" style={{ fontFamily: 'Cairo, sans-serif' }}>{name}</span>
    </button>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full rounded-xl bg-[#e3e3e8] pl-3 pr-9 text-[15px] text-[#1d1d1f] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40" />
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-8 text-center">
      <p className="text-sm text-[#6e6e73]">لا توجد نتائج مطابقة.</p>
      <button type="button" onClick={onClear} className="mt-2 text-sm font-bold text-[#0a84ff]">مسح البحث</button>
    </div>
  );
}

// The background photo in a phone frame, with the dimming the page will show.
function PhotoPreview({ wallpaper, className = '' }: { wallpaper: PageData['wallpaper']; className?: string }) {
  return (
    <span className={`relative block aspect-[9/19] overflow-hidden rounded-[26px] bg-[#1d1d1f] shadow-[0_10px_24px_rgba(15,23,42,0.2)] ${className}`}>
      <WallpaperImage wallpaper={wallpaper} />
      {!!wallpaper.dim && <span className="absolute inset-0 bg-black" style={{ opacity: Math.min(wallpaper.dim, 80) / 100 }} />}
      <span className="absolute inset-x-0 top-3 text-center text-sm font-bold text-white/90 drop-shadow" dir="ltr">9:41</span>
    </span>
  );
}

// «تنسيق» (note 27): move and zoom the photo, with the same tools as the
// profile photo in «الهوية». Changes show at once; «×» leaves.
function PhotoFraming({ onClose }: { onClose: () => void }) {
  const { pageData, updateWallpaper } = usePageContext();
  const wallpaper = pageData.wallpaper;
  const { x, y, zoom } = wallpaperFocus(wallpaper);
  const set = (changes: Partial<PageData['wallpaper']>) => updateWallpaper({ ...wallpaper, positionX: x, positionY: y, zoom, ...changes });
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);
  const changed = x !== 50 || y !== 50 || zoom !== 1;

  return (
    <div className="fixed inset-0 z-[65] flex items-end bg-black/40 sm:items-center sm:justify-center" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <section className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#f2f2f7] pb-6 sm:max-w-md sm:rounded-[28px]" role="dialog" aria-modal="true" aria-label="تنسيق صورة الخلفية">
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center bg-[#f2f2f7]/95 px-5 py-3 backdrop-blur">
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3e3e8] text-[#55555b]" aria-label="إغلاق التنسيق"><X className="h-5 w-5" /></button>
          <h3 className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>تنسيق الصورة</h3>
          <span />
        </div>

        <div className="space-y-4 px-5">
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-4">
            <VerticalSlider label="أعلى / أسفل" min={0} max={100} step={1} value={y} topIsMin onChange={(value) => set({ positionY: value })} />
            {/* Dragging the photo moves it too. */}
            <div
              className="w-40 shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const box = event.currentTarget.getBoundingClientRect();
                drag.current = { px: event.clientX, py: event.clientY, x, y, w: box.width, h: box.height };
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                if (!start) return;
                const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));
                set({ positionX: clamp(start.x - ((event.clientX - start.px) / start.w) * 100), positionY: clamp(start.y - ((event.clientY - start.py) / start.h) * 100) });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <PhotoPreview wallpaper={wallpaper} />
            </div>
            <VerticalSlider label="تكبير" min={1} max={3} step={0.01} value={zoom} icon="zoom" onChange={(value) => set({ zoom: value })} />
          </div>
          <EndsSlider label="يمين / يسار" start="يمين" end="يسار" min={0} max={100} value={x} onChange={(value) => set({ positionX: value })} />

          <div className="rounded-2xl bg-white px-4 py-3">
            <div className="mb-1 flex items-center justify-between text-[15px] text-[#1d1d1f]">
              <span>التعتيم</span>
              <span className="text-sm text-[#8e8e93]" dir="ltr">{wallpaper.dim ?? 0}%</span>
            </div>
            <input type="range" aria-label="تعتيم الخلفية" min={0} max={80} step={5} value={wallpaper.dim ?? 0} onChange={(event) => set({ dim: Number(event.target.value) })} className="w-full accent-[#0a84ff]" />
            <p className="text-xs text-[#8e8e93]">يجعل الكتابة والأزرار أوضح فوق الصور المزدحمة.</p>
          </div>

          {changed && <button type="button" onClick={() => set({ positionX: 50, positionY: 50, zoom: 1 })} className="block w-full text-center text-sm text-[#0a84ff]">إعادة الصورة إلى المنتصف</button>}
        </div>
      </section>
    </div>
  );
}

// «الخلفية» now also holds the themes: one place for the page's overall look.
export function WallpaperEditor({ initialSegment = 'themes', onThemeSelected }: { initialSegment?: WallpaperSegment; onThemeSelected?: (themeName: string) => void }) {
  const { pageData, updateWallpaper, updateTheme } = usePageContext();
  const [imageError, setImageError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [framing, setFraming] = useState(false);
  const [segment, setSegment] = useState<WallpaperSegment>(initialSegment);
  // Searching only narrows what is shown; the current choice stays as it is.
  const [query, setQuery] = useState('');
  const isImage = pageData.wallpaper.type === 'image';
  const extractedColors = Array.from(
    new Set((pageData.extractedColors || []).filter((color) => /^#([A-Fa-f0-9]{6})$/.test(color))),
  ).slice(0, 8);
  const solid = pageData.wallpaper.type === 'color' ? pageData.wallpaper.value : undefined;
  const shownThemes = themes.filter((theme) => matches(query, theme.name, theme.id, THEME_WORDS[theme.id] ?? ''));
  const shownColors = colors.filter((color) => matches(query, color.name, color.value));
  const shownGradients = gradients.filter((gradient) => matches(query, gradient.name));
  const searchable = segment === 'themes' || segment === 'colors' || segment === 'gradients';

  const pickPhoto = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setImageError('اختر صورة PNG أو JPG أو WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('حجم الصورة كبير جدًا. الحد الأقصى 8MB.');
      return;
    }
    setImageError('');
    setPreparing(true);
    const reader = new FileReader();
    reader.onerror = () => { setPreparing(false); setImageError('تعذّر قراءة الصورة. حاول مجددًا.'); };
    reader.onloadend = () => {
      scaleImage(String(reader.result || ''))
        // A new photo starts centred; the dimming chosen before is kept.
        .then((value) => updateWallpaper({ type: 'image', value, positionX: 50, positionY: 50, zoom: 1, dim: pageData.wallpaper.dim ?? 0 }))
        .catch((error: Error) => setImageError(error.message))
        .finally(() => setPreparing(false));
    };
    reader.readAsDataURL(file);
  };

  const photoInput = (
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="sr-only"
      disabled={preparing}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) pickPhoto(file);
      }}
    />
  );

  return (
    <Panel>
      <Segmented large options={SEGMENTS} value={segment} onChange={(id) => setSegment(id as WallpaperSegment)} />

      {searchable && <SearchField value={query} onChange={setQuery} placeholder={segment === 'themes' ? 'ابحث عن ثيم بالاسم' : segment === 'colors' ? 'ابحث عن لون' : 'ابحث عن تدرج'} />}

      {segment === 'video' && <VideoWallpaperEditor />}

      {segment === 'themes' && (shownThemes.length ? (
        <Group title={query ? `${shownThemes.length} من ${themes.length}` : `${themes.length} ثيمًا`} footer="الثيم يغيّر الخلفية ولون الأزرار والنص معًا، ثم تقدر تعدّل كل جزء من «الأسلوب».">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 p-3">
            {shownThemes.map((theme) => (
              <PhoneCard
                key={theme.id}
                name={theme.name}
                style={{ background: theme.background }}
                active={pageData.theme.id === theme.id}
                onClick={() => {
                  if (pageData.theme.id === theme.id) return;
                  onThemeSelected?.(theme.name);
                  updateTheme(theme);
                }}
              >
                <span className="absolute inset-x-0 top-3 text-center text-base font-bold" style={{ color: theme.textColor }} dir="ltr">9:41</span>
                <span className="absolute left-1/2 top-10 h-6 w-6 -translate-x-1/2 rounded-full opacity-30" style={{ backgroundColor: theme.textColor }} />
                {[0, 1, 2].map((row) => (
                  <span key={row} className="absolute inset-x-3 h-3.5 rounded-md" style={{ top: `${50 + row * 13}%`, backgroundColor: theme.buttonColor }} />
                ))}
              </PhoneCard>
            ))}
          </div>
        </Group>
      ) : <NoResults onClear={() => setQuery('')} />)}

      {segment === 'colors' && (
        <>
          {shownColors.length ? (
            <Group title="لون سادة">
              <div className="grid grid-cols-4 gap-x-3 gap-y-4 p-3">
                {shownColors.map((color) => (
                  <PhoneCard key={color.value} name={color.name} style={{ backgroundColor: color.value }} active={solid === color.value} onClick={() => updateWallpaper({ type: 'color', value: color.value })} />
                ))}
              </div>
              {!query && (
                <Row label="لون آخر" stacked>
                  <ColorDots value={solid} onChange={(color) => color && updateWallpaper({ type: 'color', value: color })} />
                </Row>
              )}
            </Group>
          ) : <NoResults onClear={() => setQuery('')} />}
          {!query && (extractedColors.length > 0 ? (
            <Group title="من شعارك" footer="ألوان مأخوذة تلقائيًا من الصورة التي رفعتها في «الهوية».">
              <div className="flex flex-wrap gap-3 p-4">
                {extractedColors.map((color) => (
                  <button key={color} onClick={() => updateWallpaper({ type: 'color', value: color })} aria-label={color} className={`h-10 w-10 rounded-full ring-1 ring-black/10 ${solid === color ? 'outline outline-2 outline-offset-2 outline-[#0a84ff]' : ''}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </Group>
          ) : (
            <p className="px-4 text-xs text-[#8e8e93]">ارفع شعارك في «الهوية» لتظهر هنا ألوان مأخوذة منه.</p>
          ))}
        </>
      )}

      {segment === 'gradients' && (shownGradients.length ? (
        <Group title="تدرجات">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 p-3">
            {shownGradients.map((gradient) => (
              <PhoneCard key={gradient.value} name={gradient.name} style={{ background: gradient.value }} active={pageData.wallpaper.type === 'gradient' && pageData.wallpaper.value === gradient.value} onClick={() => updateWallpaper({ type: 'gradient', value: gradient.value })}>
                <span className="absolute inset-x-0 top-3 text-center text-base font-bold text-white/90 drop-shadow-sm" dir="ltr">9:41</span>
              </PhoneCard>
            ))}
          </div>
        </Group>
      ) : <NoResults onClear={() => setQuery('')} />)}

      {segment === 'photo' && (
        <>
          {/* Note 27: the photo alone first; the adjusting tools wait behind «تنسيق». */}
          {isImage ? (
            <section className="flex flex-col items-center gap-4 rounded-2xl bg-white px-4 py-5">
              <PhotoPreview wallpaper={pageData.wallpaper} className="w-36" />
              <button type="button" onClick={() => setFraming(true)} className="flex min-h-11 items-center gap-2 rounded-full bg-[#0a84ff] px-6 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(10,132,255,0.3)] active:scale-95" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <SlidersHorizontal className="h-4 w-4" />
                تنسيق
              </button>
              <div className="flex items-center gap-5 text-[15px]">
                <label className="cursor-pointer text-[#0a84ff] focus-within:underline">{preparing ? 'جارٍ التجهيز…' : 'تغيير الصورة'}{photoInput}</label>
                <button type="button" onClick={() => updateWallpaper({ type: 'color', value: pageData.theme.background })} className="text-[#ff3b30]">إزالة</button>
              </div>
            </section>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#c7c7cc] bg-white px-4 py-10 text-center focus-within:border-[#0a84ff]">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a84ff]/10 text-[#0a84ff]">{preparing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}</span>
              <span className="text-[15px] font-bold text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{preparing ? 'جارٍ تجهيز الصورة…' : 'اختيار صورة خلفية'}</span>
              <span className="text-xs text-[#8e8e93]">PNG أو JPG أو WebP حتى 8MB</span>
              {photoInput}
            </label>
          )}
          {!!imageError && <p role="alert" className="px-4 text-xs text-[#ff3b30]">{imageError}</p>}
          {framing && isImage && <PhotoFraming onClose={() => setFraming(false)} />}
        </>
      )}
    </Panel>
  );
}
