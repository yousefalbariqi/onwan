import { useId, useState } from 'react';
import { usePageContext } from '../context/PageContext';
import { Camera } from 'lucide-react';
import { EndsSlider, Group, Panel, VerticalSlider } from './ios';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { ProfileImageControls } from './ProfileImageControls';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { ImageProblem, compressImage } from '../lib/compressImage';

// The stored logo must fit the server limit (1,000 KB); compressImage does that.

const MAX_IMAGE_SIZE = 1_000_000;
const MIN_LOGO_ZOOM = 0.3;
const zoomStep = (zoom: number | undefined, by: number) => Math.round(Math.min(3, Math.max(MIN_LOGO_ZOOM, (zoom ?? 1) + by)) * 100) / 100;

export function HeaderEditor({ logoZoomOut = false, logoBanner = false }: { logoZoomOut?: boolean; logoBanner?: boolean } = {}) {
  const { pageData, updatePageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  // Zoom and position stay at hand in both «تظهر كاملة» and «تملأ الشكل» (note 10).
  const canAdjust = Boolean(pageData.profileImage);
  const [imageError, setImageError] = useState('');

  // The builder mounts this editor twice (mobile and desktop layouts), so a
  // fixed id would point the desktop label at the hidden mobile input.
  const uploadId = useId();
  const bannerId = useId();
  const [bannerError, setBannerError] = useState('');
  const isBanner = style.type === 'banner';

  const applyProfileImage = async (imageUrl: string) => {


    // A data URL is about 4/3 the size of the file it carries.
    if (imageUrl.length * 0.75 > MAX_IMAGE_SIZE) {
      setImageError('تعذّر تصغير الصورة بما يكفي. جرّب صورة أبسط.');
      return;
    }

    updatePageData({ profileImage: imageUrl });
    // Note (10): a new logo starts whole — no zoom or framing left over from
    // the previous picture; «تملأ الشكل» and the sliders stay available.
    updateProfileStyle({ fit: 'contain', zoom: 1, positionX: 50, positionY: 50 });

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
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImageError('');
            // Note (6)/(10): up to 10 MB in, made small automatically (the server takes 1,000 KB).
            // An SVG logo becomes a PNG here, before anything is uploaded.
            compressImage(file, 1600, { allowSvg: true })
              .then((image) => applyProfileImage(image))
              .catch((problem) => setImageError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'));
          }}
          className="hidden"
          id={uploadId}
        />
        {/* The photo with its three controls around it: up/down on the right,
            zoom on the left, left/right underneath — each where it acts. */}
        <div className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white p-4" aria-label="معاينة الصورة بالشكل المختار">
          {canAdjust && <VerticalSlider label="أعلى / أسفل" min={0} max={100} step={1} value={style.positionY ?? 50} topIsMin onChange={(value) => updateProfileStyle({ positionY: value })} />}
          {/* Note 41: the whole photo box opens the file picker (tap, click,
              Enter or Space), with a small camera badge saying so. */}
          <label
            htmlFor={uploadId}
            tabIndex={0}
            role="button"
            aria-label={pageData.profileImage ? 'تغيير الصورة' : 'إضافة شعار أو صورة'}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              (document.getElementById(uploadId) as HTMLInputElement | null)?.click();
            }}
            className="group relative flex min-w-0 flex-1 cursor-pointer justify-center overflow-hidden rounded-xl bg-[#f2f2f7] p-3 outline-none transition-[transform,box-shadow] hover:ring-2 hover:ring-[#0a84ff]/30 focus-visible:ring-2 focus-visible:ring-[#0a84ff] active:scale-[0.98]"
          >
            <ProfileImageDisplay profileImage={pageData.profileImage} name={pageData.name} profileStyle={pageData.profileStyle} textColor="#1d1d1f" backgroundColor="#f2f2f7" />
            <span className="pointer-events-none absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0a84ff] text-white shadow-[0_2px_8px_rgba(10,132,255,0.4)] transition-transform group-hover:scale-110" aria-hidden="true">
              <Camera className="h-4 w-4" />
            </span>
          </label>
          {canAdjust && (logoZoomOut ? (
            // Note 10 (nonprofit editor): − / + beside the slider, down to 30 % so a wide logo fits whole.
            <div className="flex flex-col items-center gap-1">
              <button type="button" aria-label="تكبير الشعار" onClick={() => updateProfileStyle({ zoom: zoomStep(style.zoom, 0.1) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f2f7] text-lg font-bold text-[#1d1d1f]">+</button>
              <VerticalSlider label="تكبير" min={MIN_LOGO_ZOOM} max={3} step={0.01} value={style.zoom ?? 1} icon="zoom" onChange={(value) => updateProfileStyle({ zoom: value })} />
              <button type="button" aria-label="تصغير الشعار" onClick={() => updateProfileStyle({ zoom: zoomStep(style.zoom, -0.1) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f2f7] text-lg font-bold text-[#1d1d1f]">−</button>
            </div>
          ) : <VerticalSlider label="تكبير" min={1} max={3} step={0.01} value={style.zoom ?? 1} icon="zoom" onChange={(value) => updateProfileStyle({ zoom: value })} />)}
        </div>
        {canAdjust && (
          <EndsSlider label="يمين / يسار" start="يمين" end="يسار" min={0} max={100} value={style.positionX ?? 50} onChange={(value) => updateProfileStyle({ positionX: value })} />
        )}
        {canAdjust && ((style.positionX ?? 50) !== 50 || (style.positionY ?? 50) !== 50 || (style.zoom ?? 1) !== 1) && (
          <button type="button" onClick={() => updateProfileStyle({ positionX: 50, positionY: 50, zoom: 1 })} className="text-xs text-[#0a84ff]">إعادة الصورة إلى المنتصف</button>
        )}
        <div className="flex items-center gap-4 text-[15px]">
          <label htmlFor={uploadId} className="cursor-pointer text-[#0a84ff]">{pageData.profileImage ? 'تغيير الصورة' : 'إضافة شعار أو صورة'}</label>
          {!!pageData.profileImage && (
            <button onClick={() => updatePageData({ profileImage: '', extractedColors: [] })} className="text-[#ff3b30]">إزالة</button>
          )}
        </div>
        {!!imageError && <p className="text-xs text-[#ff3b30]">{imageError}</p>}

      </section>

      {/* Note 24: every tool of the profile photo lives here, beside the photo. */}
      {/* Note 21 (nonprofit editor): two layouts only — plain logo, or logo with banner. */}
      {logoBanner && (
        <Group title="طريقة العرض">
          <div className="grid grid-cols-2 gap-2 p-4" role="radiogroup" aria-label="طريقة عرض الشعار">
            {([['plain', 'شعار عادي'], ['banner', 'شعار مع بنر']] as const).map(([id, label]) => {
              const active = id === 'banner' ? isBanner : !isBanner;
              return (
                <button key={id} type="button" role="radio" aria-checked={active} onClick={() => !active && updateProfileStyle({ type: id === 'banner' ? 'banner' : 'circle' })} className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-colors ${active ? 'border-[#173c36]' : 'border-[#ececec]'}`}>
                  <span className="relative block h-14 w-full overflow-hidden rounded-xl bg-[#f2f2f7]">
                    {id === 'banner' && <span className="absolute inset-x-0 top-0 block h-8 bg-[#c9d5c2]" />}
                    <span className="absolute left-1/2 top-1/2 block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#6c8050]" style={id === 'banner' ? { top: '62%' } : undefined} />
                  </span>
                  <span className="text-sm font-bold text-[#1d1d1f]">{label}</span>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {logoBanner && isBanner ? (
        <Group title="البنر" footer="تتغير صورة البنر والشعار كلٌّ على حدة. «يمين / يسار» تحت الصورة يحدد موضع الشعار.">
          <div className="space-y-4 p-4">
            <input id={bannerId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBannerError('');
              compressImage(file).then((image) => updateProfileStyle({ bannerImage: image })).catch((problem) => setBannerError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'));
            }} />
            <label htmlFor={bannerId} className="block cursor-pointer overflow-hidden rounded-2xl bg-[#f2f2f7]">
              {style.bannerImage
                ? <img src={style.bannerImage} alt="صورة البنر" className="aspect-[2.4/1] w-full object-cover" />
                : <span className="flex aspect-[2.4/1] w-full items-center justify-center gap-2 text-sm font-bold text-[#6e6e73]"><Camera className="h-5 w-5" />رفع صورة البنر</span>}
            </label>
            {style.bannerImage && <label htmlFor={bannerId} className="block cursor-pointer text-center text-sm font-bold text-[#0a84ff]">تغيير صورة البنر</label>}
            {!!bannerError && <p className="text-xs text-[#ff3b30]">{bannerError}</p>}
            <EndsSlider label="حجم الشعار" start="أصغر" end="أكبر" min={56} max={160} value={style.logoSize ?? 112} onChange={(value) => updateProfileStyle({ logoSize: value })} />
          </div>
        </Group>
      ) : (
        <Group title="شكل الصورة" footer="تظهر النتيجة في المعاينة مباشرة، وتغيير الشكل يحافظ على الصورة المرفوعة.">
          <div className="p-4"><ProfileImageControls /></div>
        </Group>
      )}

      <Group title="الاسم">
        <div className="px-4 py-1">
          <input value={pageData.name} onChange={(e) => updatePageData({ name: e.target.value })} placeholder="اسمك" maxLength={80} className="w-full bg-transparent py-3 text-[17px] font-bold text-[#1d1d1f] placeholder:font-normal placeholder:text-[#c7c7cc] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} />
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

      <Group title="الوصف بالإنجليزية (اختياري)" footer="إن أدخلتها ظهر لزوارك زر تبديل اللغة، وتُعرض تلقائيًا لمن لغة جهازه إنجليزية. عناوين الأزرار بالإنجليزية من «المحتوى».">
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
