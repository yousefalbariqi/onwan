import { useId, useState } from 'react';
import { usePageContext } from '../context/PageContext';
import { FieldRow, Group, Panel } from './ios';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { ProfileImageControls } from './ProfileImageControls';
import { ProfileImageDisplay } from './ProfileImageDisplay';

// Uploaded images are stored inline for now; final limits are pending (P-02).
// The source may be larger than what is stored: cropping re-encodes it small.
const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export function HeaderEditor() {
  const { pageData, updatePageData } = usePageContext();
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
        <div className="flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f2f2f7] p-4" aria-label="معاينة الصورة بالشكل المختار">
          <ProfileImageDisplay profileImage={pageData.profileImage} name={pageData.name} profileStyle={pageData.profileStyle} textColor="#1d1d1f" backgroundColor="#f2f2f7" />
        </div>
        <div className="flex items-center gap-4 text-[15px]">
          <label htmlFor={uploadId} className="cursor-pointer text-[#0a84ff]">{pageData.profileImage ? 'تغيير الصورة' : 'إضافة شعار أو صورة'}</label>
          {!!pageData.profileImage && (
            <button onClick={() => updatePageData({ profileImage: '', extractedColors: [] })} className="text-[#ff3b30]">إزالة</button>
          )}
        </div>
        {!!imageError && <p className="text-xs text-[#ff3b30]">{imageError}</p>}

      </section>

      <Group title="شكل الصورة وضبطها" footer="تظهر الخيارات نفسها في «الأسلوب»، وتنعكس التعديلات في المعاينة مباشرة.">
        <div className="p-4"><ProfileImageControls /></div>
      </Group>

      <Group title="الجهة" footer="بطاقة جهة الاتصال التي ينزّلها زوارك تأخذ جوال حسابك وبريده تلقائيًا. الخط والألوان في «الأسلوب».">
        <FieldRow label="الاسم" value={pageData.name} onChange={(e) => updatePageData({ name: e.target.value })} placeholder="اسم الجهة" style={{ fontFamily: 'Cairo, sans-serif' }} />
        <div className="px-4 py-3">
          <span className="mb-1 block text-[15px] text-[#1d1d1f]">الوصف</span>
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

      <Group title="English (اختياري)" footer="إن أدخلتها ظهر لزوارك زر تبديل اللغة، وتُعرض تلقائيًا لمن لغة جهازه إنجليزية. عناوين الأزرار بالإنجليزية من «الروابط».">
        <div dir="ltr">
          <FieldRow label="Name" value={pageData.translations?.en?.name || ''} onChange={(e) => updatePageData({ translations: { en: { ...pageData.translations?.en, name: e.target.value } } })} placeholder="Name" />
          <div className="border-t border-[#e5e5ea] px-4 py-3">
            <textarea
              value={pageData.translations?.en?.bio || ''}
              onChange={(e) => updatePageData({ translations: { en: { ...pageData.translations?.en, bio: e.target.value } } })}
              placeholder="Short description"
              rows={2}
              maxLength={300}
              className="w-full resize-none bg-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none"
            />
          </div>
        </div>
      </Group>
    </Panel>
  );
}
