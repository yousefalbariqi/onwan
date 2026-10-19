import { themes, usePageContext } from '../context/PageContext';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Upload } from 'lucide-react';
import { ColorDots, Group, Panel, Row, Segmented } from './ios';
import { ImageCropper } from './ImageCropper';
import { VideoWallpaperEditor } from './VideoWallpaperEditor';

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

const positions = [
  { id: 'top', label: 'أعلى' },
  { id: 'center', label: 'وسط' },
  { id: 'bottom', label: 'أسفل' },
] as const;

// Stored inline for now; final storage limits are pending (P-02). The source
// may be larger: cropping re-encodes it to a phone-sized JPEG.
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export type WallpaperSegment = 'themes' | 'colors' | 'gradients' | 'photo' | 'video';

const SEGMENTS = [
  { id: 'themes', label: 'ثيمات' },
  { id: 'colors', label: 'ألوان' },
  { id: 'gradients', label: 'تدرجات' },
  { id: 'photo', label: 'صورة' },
  { id: 'video', label: 'فيديو' },
] as const;

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

// «الخلفية» now also holds the themes: one place for the page's overall look.
export function WallpaperEditor({ initialSegment = 'themes', onThemeSelected }: { initialSegment?: WallpaperSegment; onThemeSelected?: (themeName: string) => void }) {
  const { pageData, updateWallpaper, updateTheme } = usePageContext();
  const [imageError, setImageError] = useState('');
  const [cropSource, setCropSource] = useState('');
  const [segment, setSegment] = useState<WallpaperSegment>(initialSegment);
  const isImage = pageData.wallpaper.type === 'image';
  const extractedColors = Array.from(
    new Set((pageData.extractedColors || []).filter((color) => /^#([A-Fa-f0-9]{6})$/.test(color))),
  ).slice(0, 8);
  const solid = pageData.wallpaper.type === 'color' ? pageData.wallpaper.value : undefined;

  return (
    <Panel>
      <Segmented options={SEGMENTS} value={segment} onChange={(id) => setSegment(id as WallpaperSegment)} />

      {segment === 'video' && <VideoWallpaperEditor />}

      {segment === 'themes' && (
        <Group title={`${themes.length} ثيمًا`} footer="الثيم يغيّر الخلفية ولون الأزرار والنص معًا، ثم تقدر تعدّل كل جزء من «الأسلوب».">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 p-3">
            {themes.map((theme) => (
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
      )}

      {segment === 'colors' && (
        <>
          <Group title="لون سادة">
            <div className="grid grid-cols-4 gap-x-3 gap-y-4 p-3">
              {colors.map((color) => (
                <PhoneCard key={color.value} name={color.name} style={{ backgroundColor: color.value }} active={solid === color.value} onClick={() => updateWallpaper({ type: 'color', value: color.value })} />
              ))}
            </div>
            <Row label="لون آخر" stacked>
              <ColorDots value={solid} onChange={(color) => color && updateWallpaper({ type: 'color', value: color })} />
            </Row>
          </Group>
          {extractedColors.length > 0 ? (
            <Group title="من شعارك" footer="ألوان مأخوذة تلقائيًا من الصورة التي رفعتها في «الهوية».">
              <div className="flex flex-wrap gap-3 p-4">
                {extractedColors.map((color) => (
                  <button key={color} onClick={() => updateWallpaper({ type: 'color', value: color })} aria-label={color} className={`h-10 w-10 rounded-full ring-1 ring-black/10 ${solid === color ? 'outline outline-2 outline-offset-2 outline-[#0a84ff]' : ''}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </Group>
          ) : (
            <p className="px-4 text-xs text-[#8e8e93]">ارفع شعارك في «الهوية» لتظهر هنا ألوان مأخوذة منه.</p>
          )}
        </>
      )}

      {segment === 'gradients' && (
        <Group title="تدرجات">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 p-3">
            {gradients.map((gradient) => (
              <PhoneCard key={gradient.value} name={gradient.name} style={{ background: gradient.value }} active={pageData.wallpaper.type === 'gradient' && pageData.wallpaper.value === gradient.value} onClick={() => updateWallpaper({ type: 'gradient', value: gradient.value })}>
                <span className="absolute inset-x-0 top-3 text-center text-base font-bold text-white/90 drop-shadow-sm" dir="ltr">9:41</span>
              </PhoneCard>
            ))}
          </div>
        </Group>
      )}

      {segment === 'photo' && (
        <>
          <Group title="صورة خلفية" footer="الحد الأقصى 8MB. تُقص الصورة بمقاس الجوال.">
            {isImage && (
              <div className="flex justify-center p-4">
                <span className="block aspect-[9/19] w-28 rounded-[20px] shadow-[0_8px_18px_rgba(15,23,42,0.18)]" style={{ backgroundImage: `url(${pageData.wallpaper.value})`, backgroundPosition: pageData.wallpaper.position ?? 'center', backgroundSize: 'cover' }} />
              </div>
            )}
            <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 px-4 text-[15px] text-[#0a84ff]">
              <Upload className="h-4 w-4" />
              {isImage ? 'تغيير الصورة' : 'اختيار صورة'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  if (file.size > MAX_IMAGE_SIZE) {
                    setImageError('حجم الصورة كبير جدًا. الحد الأقصى 8MB.');
                    return;
                  }
                  setImageError('');
                  const reader = new FileReader();
                  reader.onloadend = () => setCropSource(String(reader.result || ''));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </Group>
          {!!imageError && <p className="px-4 text-xs text-[#ff3b30]">{imageError}</p>}
          {isImage && (
            <Group title="ضبط الصورة">
              <Row label="الموضع" stacked>
                <Segmented options={positions} value={pageData.wallpaper.position ?? 'center'} onChange={(position) => updateWallpaper({ ...pageData.wallpaper, position })} />
              </Row>
              <Row label="التعتيم" stacked>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={80} step={5} value={pageData.wallpaper.dim ?? 0} onChange={(e) => updateWallpaper({ ...pageData.wallpaper, dim: Number(e.target.value) })} className="flex-1 accent-[#0a84ff]" />
                  <span className="w-10 text-left text-sm text-[#8e8e93]" dir="ltr">{pageData.wallpaper.dim ?? 0}%</span>
                </div>
              </Row>
            </Group>
          )}
          {!!cropSource && (
            <ImageCropper
              src={cropSource}
              aspect={9 / 16}
              outputWidth={1080}
              onCancel={() => setCropSource('')}
              onConfirm={(value) => {
                setCropSource('');
                updateWallpaper({ type: 'image', value, position: pageData.wallpaper.position ?? 'center', dim: pageData.wallpaper.dim ?? 0 });
              }}
            />
          )}
        </>
      )}
    </Panel>
  );
}
