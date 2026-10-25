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

export function HeaderEditor() {
  const { pageData, updatePageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  // Zoom and position stay at hand in both «تظهر كاملة» and «تملأ الشكل» (note 10).
  const canAdjust = Boolean(pageData.profileImage);
  const [imageError, setImageError] = useState('');

  // The builder mounts this editor twice (mobile and desktop layouts), so a
  // fixed id would point the desktop label at the hidden mobile input.
  const uploadId = useId();

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
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImageError('');
            // Note (6)/(10): up to 10 MB in, made small automatically (the server takes 1,000 KB).
            compressImage(file)
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
          {canAdjust && <VerticalSlider label="تكبير" min={1} max={3} step={0.01} value={style.zoom ?? 1} icon="zoom" onChange={(value) => updateProfileStyle({ zoom: value })} />}
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
      <Group title="شكل الصورة" footer="تظهر النتيجة في المعاينة مباشرة، وتغيير الشكل يحافظ على الصورة المرفوعة.">
        <div className="p-4"><ProfileImageControls /></div>
      </Group>

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
