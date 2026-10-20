import { useId, useState } from 'react';
import { usePageContext } from '../context/PageContext';
import { Group, Panel } from './ios';
import { ZoomIn } from 'lucide-react';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { ProfileImageControls } from './ProfileImageControls';
import { ProfileImageDisplay } from './ProfileImageDisplay';

// Uploaded images are stored inline for now; final limits are pending (P-02).
// The source may be larger than what is stored: cropping re-encodes it small.
const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

// A slider standing upright beside the photo. `topIsMin`: the top end is the
// minimum (position: 0 = top); otherwise the top end is the maximum (zoom in).
function VerticalSlider({ label, min, max, step, value, onChange, topIsMin = false, icon }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void; topIsMin?: boolean; icon?: 'zoom' }) {
  const LENGTH = 150;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 text-[10px] text-[#6e6e73]">
      {icon === 'zoom' ? <ZoomIn className="h-3.5 w-3.5" /> : <span>{topIsMin ? 'أعلى' : ''}</span>}
      <div className="relative w-7" style={{ height: LENGTH }}>
        <input
          aria-label={label}
          type="range"
          dir="ltr"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute left-1/2 top-1/2 accent-[#0a84ff]"
          style={{ width: LENGTH, transform: `translate(-50%, -50%) rotate(${topIsMin ? 90 : -90}deg)` }}
        />
      </div>
      <span>{icon === 'zoom' ? 'تكبير' : topIsMin ? 'أسفل' : ''}</span>
    </div>
  );
}

export function HeaderEditor() {
  const { pageData, updatePageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const canAdjust = Boolean(pageData.profileImage) && (style.fit ?? (style.type === 'hero_safe' ? 'contain' : 'cover')) === 'cover';
  const [imageError, setImageError] = useState('');

  // The builder mounts this editor twice (mobile and desktop layouts), so a
  // fixed id would point the desktop label at the hidden mobile input.
  const uploadId = useId();

  const applyProfileImage = async (imageUrl: string) => {


    // A data URL is about 4/3 the size of the file it carries.
    if (imageUrl.length * 0.75 > MAX_IMAGE_SIZE) {
      setImageError('حجم الصورة كبير. الحد الأقصى 2MB — جرّب صورة بحجم أصغر.');
      return;
    }

    updatePageData({ profileImage: imageUrl });

    // استخراج الألوان من الصورة
    const colors = await extractColorsFromImage(imageUrl, 8);
    if (colors.length > 0) {
      updatePageData({ extractedColors: colors });
    }
  };

  return (
    <Panel>
      {/* Apple contact-card style: the photo large at the top, tap it to change. */}
      <section className="flex flex-col items-center gap-2 pt-1">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Allow picking the same file again after cancelling the crop.
            e.target.value = '';
            if (file && file.size > MAX_SOURCE_SIZE) {
              setImageError('حجم الصورة كبير جدًا. الحد الأقصى 8MB.');
              return;
            }
            setImageError('');
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const source = reader.result as string;
                if (file.size <= MAX_IMAGE_SIZE) { void applyProfileImage(source); return; }
                const image = new Image();
                image.onerror = () => setImageError('تعذّر فتح الصورة. جرّب صورة أخرى.');
                image.onload = () => {
                  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
                  const canvas = document.createElement('canvas');
                  canvas.width = Math.max(1, Math.round(image.width * scale));
                  canvas.height = Math.max(1, Math.round(image.height * scale));
                  const context = canvas.getContext('2d');
                  if (!context) { setImageError('تعذّر تجهيز الصورة. حاول مجددًا.'); return; }
                  context.drawImage(image, 0, 0, canvas.width, canvas.height);
                  void applyProfileImage(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
                };
                image.src = source;
              };
              reader.onerror = () => setImageError('تعذّر قراءة الملف. حاول مجددًا.');
              reader.readAsDataURL(file);
            }
          }}
          className="hidden"
          id={uploadId}
        />
        {/* The photo with its three controls around it: up/down on the right,
            zoom on the left, left/right underneath — each where it acts. */}
        <div className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white p-4" aria-label="معاينة الصورة بالشكل المختار">
          {canAdjust && <VerticalSlider label="أعلى / أسفل" min={0} max={100} step={1} value={style.positionY ?? 50} topIsMin onChange={(value) => updateProfileStyle({ positionY: value })} />}
          <div className="flex min-w-0 flex-1 justify-center overflow-hidden rounded-xl bg-[#f2f2f7] p-3">
            <ProfileImageDisplay profileImage={pageData.profileImage} name={pageData.name} profileStyle={pageData.profileStyle} textColor="#1d1d1f" backgroundColor="#f2f2f7" />
          </div>
          {canAdjust && <VerticalSlider label="تكبير" min={1} max={3} step={0.01} value={style.zoom ?? 1} icon="zoom" onChange={(value) => updateProfileStyle({ zoom: value })} />}
        </div>
        {canAdjust && (
          <label className="flex w-full items-center gap-3 px-1 text-xs text-[#6e6e73]">
            <span>يمين</span>
            <input aria-label="يمين / يسار" type="range" dir="rtl" min={0} max={100} step={1} value={style.positionX ?? 50} onChange={(event) => updateProfileStyle({ positionX: Number(event.target.value) })} className="min-w-0 flex-1 accent-[#0a84ff]" />
            <span>يسار</span>
          </label>
        )}
        <div className="flex items-center gap-4 text-[15px]">
          <label htmlFor={uploadId} className="cursor-pointer text-[#0a84ff]">{pageData.profileImage ? 'تغيير الصورة' : 'إضافة شعار أو صورة'}</label>
          {!!pageData.profileImage && (
            <button onClick={() => updatePageData({ profileImage: '', extractedColors: [] })} className="text-[#ff3b30]">إزالة</button>
          )}
        </div>
        {!!imageError && <p className="text-xs text-[#ff3b30]">{imageError}</p>}

      </section>

      <Group title="شكل الصورة" footer="تظهر الخيارات نفسها في «الأسلوب»، وتنعكس التعديلات في المعاينة مباشرة.">
        <div className="p-4"><ProfileImageControls showPosition={false} /></div>
      </Group>

      <Group title="الاسم">
        <div className="px-4 py-1">
          <input value={pageData.name} onChange={(e) => updatePageData({ name: e.target.value })} placeholder="اسم الجهة" maxLength={80} className="w-full bg-transparent py-3 text-[17px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} />
        </div>
      </Group>

      <Group title="الوصف" footer="بطاقة جهة الاتصال التي ينزّلها زوارك تأخذ جوال حسابك وبريده تلقائيًا. الخط والألوان في «الأسلوب».">
        <div className="px-4 py-3">
          <textarea
            value={pageData.bio}
            onChange={(e) => updatePageData({ bio: e.target.value })}
            placeholder="نبذة مختصرة"
            maxLength={150}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none"
          />
          <span className="block text-left text-xs text-[#8e8e93]" dir="ltr">{pageData.bio.length}/150</span>
        </div>
      </Group>

      <Group title="الاسم بالإنجليزية (اختياري)">
        <div dir="ltr" className="px-4 py-1">
          <input value={pageData.translations?.en?.name || ''} onChange={(e) => updatePageData({ translations: { en: { ...pageData.translations?.en, name: e.target.value } } })} placeholder="Name" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" />
        </div>
      </Group>

      <Group title="الوصف بالإنجليزية (اختياري)" footer="إن أدخلتها ظهر لزوارك زر تبديل اللغة، وتُعرض تلقائيًا لمن لغة جهازه إنجليزية. عناوين الأزرار بالإنجليزية من «الروابط».">
        <div dir="ltr">
          <div className="px-4 py-3">
            <textarea
              value={pageData.translations?.en?.bio || ''}
              onChange={(e) => updatePageData({ translations: { en: { ...pageData.translations?.en, bio: e.target.value } } })}
              placeholder="Short description"
              rows={2}
              maxLength={300}
              className="w-full resize-none bg-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none"
            />
            <span className="block text-right text-xs text-[#8e8e93]">{(pageData.translations?.en?.bio || '').length}/300</span>
          </div>
        </div>
      </Group>
    </Panel>
  );
}
