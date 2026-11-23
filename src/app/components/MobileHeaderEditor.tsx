import { FormattingTextarea } from './FormattingTextarea';
import { useEffect, useId, useRef, useState } from 'react';
import { FONT_OPTIONS, usePageContext, type FontId } from '../context/PageContext';
import { Camera, Pencil, Plus } from 'lucide-react';
import { EndsSlider, Group } from './ios';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { PROFILE_SHAPES } from './ProfileImageControls';
import { ProfileImageSheet } from './ProfileImageSheet';
import { BannerCropSheet } from './BannerCropSheet';
import { hasTransparency } from '../lib/imageTransparency';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { loadFont } from '../lib/fonts';
import './mobileHeaderEditor.css';
import { ImageProblem, compressImage } from '../lib/compressImage';

// The stored logo must fit the server limit (1,000 KB); compressImage does that.

const MAX_IMAGE_SIZE = 1_000_000;
const MIN_LOGO_ZOOM = 0.3;
// Audit E06: three plain choices first; the exact shape appears only inside the chosen one.
type HeaderType = 'circle' | 'premium' | 'rounded' | 'square' | 'hero' | 'hero_safe' | 'banner';
const IMAGE_FAMILIES: { id: string; label: string; hint: string; shapes: { id: HeaderType; label: string }[] }[] = [
  { id: 'small', label: 'شعار أو صورة صغيرة', hint: 'فوق اسمك', shapes: [{ id: 'circle', label: 'دائرة' }, { id: 'premium', label: 'دائرة بإطار' }, { id: 'rounded', label: 'مربع ناعم' }, { id: 'square', label: 'مربع' }] },
  { id: 'large', label: 'صورة كبيرة', hint: 'تملأ أعلى الصفحة', shapes: [{ id: 'hero', label: 'بعرض الصفحة' }, { id: 'hero_safe', label: 'بهوامش' }] },
  { id: 'cover', label: 'غلاف مع شعار', hint: 'صورة عريضة وشعارك فوقها', shapes: [{ id: 'banner', label: 'غلاف' }] },
];


export function MobileHeaderEditor({ logoZoomOut = false, logoBanner = false, essentials = false, onBusyChange }: { onBusyChange?: (busy: boolean) => void; logoZoomOut?: boolean; logoBanner?: boolean; essentials?: boolean } = {}) {
  const { pageData, updatePageData, updateProfileStyle, updateTypography } = usePageContext();
  const style = pageData.profileStyle;
  const [imageSheet, setImageSheet] = useState<'menu' | 'crop' | null>(null);
  const nameFont = pageData.typography?.nameFont;
  const nameColor = pageData.customColors?.nameColor || pageData.theme.textColor;
  useEffect(() => { if (nameFont) loadFont(nameFont); }, [nameFont]);
  // Zoom and position stay at hand in both «الصورة كاملة» and «ملء الإطار» (note 10).
  const canAdjust = Boolean(pageData.profileImage);
  const [imageError, setImageError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const imageRequest = useRef(0);
  useEffect(() => () => { imageRequest.current++; }, []);
  useEffect(() => { onBusyChange?.(preparing); }, [preparing, onBusyChange]);

  // The builder mounts this editor twice (mobile and desktop layouts), so a
  // fixed id would point the desktop label at the hidden mobile input.
  const uploadId = useId();
  const bannerId = useId();
  const [bannerError, setBannerError] = useState('');
  const [bannerCrop, setBannerCrop] = useState(false);
  const isBanner = style.type === 'banner';

  const applyProfileImage = async (imageUrl: string, request: number) => {
    if (request !== imageRequest.current) return;


    // A data URL is about 4/3 the size of the file it carries.
    if (imageUrl.length * 0.75 > MAX_IMAGE_SIZE) {
      setImageError('تعذّر تصغير الصورة بما يكفي. جرّب صورة أبسط.');
      return;
    }

    // Note (10): a new picture starts with no zoom or framing left over.
    const transparent = await hasTransparency(imageUrl);
    if (request !== imageRequest.current) return;
    updatePageData({ profileImage: imageUrl });
    updateProfileStyle({ fit: transparent ? 'contain' : 'cover', zoom: 1, positionX: 50, positionY: 50 });
    // Note 9: the crop opens straight after choosing a picture.
    setImageSheet('crop');

    // استخراج الألوان من الصورة
    const colors = await extractColorsFromImage(imageUrl, 8);
    if (request === imageRequest.current && colors.length > 0) {
      updatePageData({ extractedColors: colors });
    }
  };

  return (
    <div className="identity-editor-shell">
      <div className="identity-editor">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImageError('');
            const request = ++imageRequest.current; setPreparing(true); onBusyChange?.(true);
            // Note (6)/(10): up to 10 MB in, made small automatically (the server takes 1,000 KB).
            // An SVG logo becomes a PNG here, before anything is uploaded.
            compressImage(file, 1600, { allowSvg: true })
              .then((image) => applyProfileImage(image, request))
              .catch((problem) => { if (request === imageRequest.current) setImageError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'); }).finally(() => { if (request === imageRequest.current) { setPreparing(false); onBusyChange?.(false); } });
          }}
          className="hidden"
          disabled={preparing}
          id={uploadId}
        />

      <section className="identity-editor__layouts image-families" aria-labelledby={`${uploadId}-layouts`}>
        <h3 id={`${uploadId}-layouts`}>كيف تظهر صورتك؟</h3>
        <div role="radiogroup" aria-label="طريقة ظهور الصورة">
          {IMAGE_FAMILIES.filter(family => logoBanner || family.id !== 'cover').map(family => {
            const active = family.shapes.some(shape => shape.id === style.type);
            const shown = active ? style.type : family.shapes[0].id;
            return <button type="button" key={family.id} role="radio" aria-checked={active} onClick={() => { if (!active) updateProfileStyle({ type: family.shapes[0].id }); }}>
              <span className="identity-editor__layout-preview" aria-hidden="true"><ProfileImageDisplay profileImage={pageData.profileImage} name={pageData.name} profileStyle={{ ...style, type: shown }} textColor="#111111" backgroundColor="#efefed" /></span>
              <b>{family.label}</b><small>{family.hint}</small>
            </button>;
          })}
        </div>
        {(() => {
          const family = IMAGE_FAMILIES.find(item => item.shapes.some(shape => shape.id === style.type));
          if (!family || family.shapes.length < 2) return null;
          return <div className="image-families__shapes" role="radiogroup" aria-label="شكل الصورة">
            {family.shapes.map(shape => <button type="button" key={shape.id} role="radio" aria-checked={style.type === shape.id} onClick={() => updateProfileStyle({ type: shape.id })}>{shape.label}</button>)}
          </div>;
        })()}
      </section>
      <section className="identity-editor__photo-card" aria-labelledby={`${uploadId}-title`}>
        <div className="identity-editor__photo-top">
          <div><h3 id={`${uploadId}-title`}>{isBanner ? 'الشعار' : 'صورتك أو شعارك'}</h3><p>يفضّل صورة مربعة بنسبة ١:١</p></div>
          {pageData.profileImage
            ? <button type="button" className="identity-editor__photo-edit" disabled={preparing} aria-label="خيارات الصورة" onClick={() => setImageSheet('menu')}>
                <img src={pageData.profileImage} alt="" style={{ objectFit: style.fit ?? 'cover', objectPosition: `${style.positionX ?? 50}% ${style.positionY ?? 50}%` }} />
                <span aria-hidden="true"><Pencil size={15} /></span>
              </button>
            : <label htmlFor={uploadId} className="identity-editor__photo-edit" tabIndex={0} role="button" aria-label="إضافة شعار أو صورة" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); (document.getElementById(uploadId) as HTMLInputElement | null)?.click(); } }}>
                <span aria-hidden="true"><Plus size={17} strokeWidth={3} /></span>
              </label>}
        </div>
        {preparing && <p role="status">جارٍ تجهيز الصورة…</p>}
        {imageError && <p role="alert" className="identity-editor__error">{imageError}</p>}
      </section>
      {logoBanner && isBanner ? (
        <Group title="صورة الغلاف" footer="الغلاف والشعار صورتان مستقلتان، وتقدر تغيّر كل واحدة لحالها.">
          <div className="space-y-4 p-4">
            <input id={bannerId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={preparing} onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBannerError('');
              const request = ++imageRequest.current; setPreparing(true); onBusyChange?.(true);
              compressImage(file).then((image) => { if (request === imageRequest.current) { updateProfileStyle({ bannerImage: image, bannerX: 50, bannerY: 50, bannerZoom: 1 }); setBannerCrop(true); } }).catch((problem) => { if (request === imageRequest.current) setBannerError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'); }).finally(() => { if (request === imageRequest.current) { setPreparing(false); onBusyChange?.(false); } });
            }} />
            <label htmlFor={bannerId} className="block cursor-pointer overflow-hidden rounded-2xl bg-[#F5F5F3]">
              {style.bannerImage
                ? <img src={style.bannerImage} alt="صورة الغلاف" className="aspect-[2.4/1] w-full object-cover" style={{ objectPosition: `${style.bannerX ?? 50}% ${style.bannerY ?? 50}%`, transform: (style.bannerZoom ?? 1) > 1 ? `scale(${style.bannerZoom})` : undefined, transformOrigin: `${style.bannerX ?? 50}% ${style.bannerY ?? 50}%` }} />
                : <span className="flex aspect-[2.4/1] w-full items-center justify-center gap-2 text-sm font-bold text-[#737373]"><Camera className="h-5 w-5" />رفع صورة الغلاف</span>}
            </label>
            {style.bannerImage && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setBannerCrop(true)} className="min-h-11 rounded-xl bg-[#F5F5F3] text-sm font-bold text-[#111111]">ضبط الغلاف</button><label htmlFor={bannerId} className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[#F5F5F3] text-sm font-bold text-[#C2410C]">تغيير الصورة</label></div>}
            {!!bannerError && <p className="text-xs text-[#DC2626]">{bannerError}</p>}
            <EndsSlider label="حجم الشعار" start="أصغر" end="أكبر" min={56} max={160} value={style.logoSize ?? 112} onChange={(value) => updateProfileStyle({ logoSize: value })} />
          </div>
        </Group>
      ) : null}

      {bannerCrop && !!style.bannerImage && <BannerCropSheet onClose={() => setBannerCrop(false)} />}
      <section className="identity-editor__text">
        <label htmlFor={`${uploadId}-name`}>الاسم</label>
        <input id={`${uploadId}-name`} value={pageData.name} maxLength={80} onChange={event => updatePageData({ name: event.target.value })} placeholder="اسمك أو اسم نشاطك" />
        {/* Editor phase 3: font and colour live in their own tools. */}
        {!essentials && <>
        <div className="identity-editor__setting">
          <label htmlFor={`${uploadId}-font-toggle`}>خط بديل للعنوان</label>
          <button id={`${uploadId}-font-toggle`} type="button" role="switch" aria-checked={Boolean(nameFont)} aria-controls={`${uploadId}-font`} onClick={() => updateTypography({ nameFont: nameFont ? undefined : (pageData.typography?.font || 'cairo') })}><span /></button>
        </div>
        {nameFont && <label className="identity-editor__font-picker" htmlFor={`${uploadId}-font`}>خط العنوان<select id={`${uploadId}-font`} value={nameFont} onChange={event => updateTypography({ nameFont: event.target.value as FontId })}>{FONT_OPTIONS.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label>}
        <div className="identity-editor__setting">
          <label htmlFor={`${uploadId}-color`}>لون العنوان</label>
          <label className="identity-editor__color" dir="ltr"><input id={`${uploadId}-color`} type="color" value={/^#[0-9a-f]{6}$/i.test(nameColor) ? nameColor : '#111111'} onChange={event => updatePageData({ customColors: { ...pageData.customColors, nameColor: event.target.value } })} /><span>{nameColor.toUpperCase()}</span></label>
        </div>
        </>}
        <div className="identity-editor__bio-label"><label htmlFor={`${uploadId}-bio`}>النبذة</label><span dir="ltr">{pageData.bio.length}/300</span></div>
        <FormattingTextarea id={`${uploadId}-bio`} value={pageData.bio} format={pageData.typography?.bioFormat} onChange={(bio, bioFormat) => updatePageData({ bio, typography: { ...pageData.typography, bioFormat: bioFormat.length ? bioFormat : undefined } })} placeholder="اكتب نبذة قصيرة عنك، شغفك أو أعمالك…" maxLength={300} rows={4} className="identity-editor__bio" />
      </section>
      {!essentials && <details className="identity-editor__extra"><summary>الاسم والنبذة بالإنجليزية (اختياري)</summary>
      <Group title="الاسم بالإنجليزية (اختياري)">
        <div dir="ltr" className="px-4 py-1">
          <input value={pageData.translations?.en?.name || ''} onChange={(e) => updatePageData({ translations: { en: { ...pageData.translations?.en, name: e.target.value } } })} placeholder="Name" className="w-full bg-transparent py-3 text-[17px] font-bold text-[#111111] placeholder:font-normal placeholder:text-[#D4D4D4] focus:outline-none" />
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
              className="w-full resize-none bg-transparent text-[15px] text-[#111111] placeholder:text-[#D4D4D4] focus:outline-none"
            />
            <span className="block text-right text-xs text-[#737373]">{(pageData.translations?.en?.bio || '').length}/300</span>
          </div>
        </div>
      </Group>
      </details>}
      </div>
      {imageSheet && !!pageData.profileImage && <ProfileImageSheet
        uploadId={uploadId}
        startAtCrop={imageSheet === 'crop'}
        minZoom={MIN_LOGO_ZOOM}
        onClose={() => setImageSheet(null)}
        onRemove={() => { imageRequest.current++; updatePageData({ profileImage: '', extractedColors: [] }); }}
      />}
    </div>
  );
}
