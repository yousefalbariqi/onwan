import { usePageContext } from '../context/PageContext';
import { Segmented } from './ios';

export const PROFILE_SHAPES: { id: import('../context/PageContext').PageData['profileStyle']['type']; label: string; preview: string }[] = [
  { id: 'circle', label: 'دائرة', preview: 'h-10 w-10 rounded-full' },
  { id: 'rounded', label: 'مربع ناعم', preview: 'h-10 w-10 rounded-xl' },
  { id: 'square', label: 'مربع', preview: 'h-10 w-10 rounded-none' },
  { id: 'premium', label: 'دائرة مميزة', preview: 'h-10 w-10 rounded-full ring-2 ring-offset-2 ring-[#1d1d1f]' },
  { id: 'hero', label: 'مشهد ممتلئ', preview: 'h-8 w-14 rounded-md' },
  { id: 'hero_safe', label: 'مشهد متوازن', preview: 'h-8 w-14 rounded-md border-2 border-dashed border-[#8e8e93] bg-transparent' },
];

export function ProfileImageControls() {
  const { pageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const fit = style.fit ?? (style.type === 'hero_safe' ? 'contain' : 'cover');
  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="شكل الصورة">
        {PROFILE_SHAPES.map(shape => (
          <button type="button" key={shape.id} aria-pressed={style.type === shape.id} onClick={() => updateProfileStyle({ type: shape.id })} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border-2 p-2 ${style.type === shape.id ? 'border-[#0a84ff] bg-blue-50' : 'border-transparent bg-[#f2f2f7]'}`}>
            <span className={`block overflow-hidden bg-[#c7c7cc] ${shape.preview}`}>
              {pageData.profileImage && <img src={pageData.profileImage} alt="" className="h-full w-full" style={{ objectFit: style.fit ?? (shape.id === 'hero_safe' ? 'contain' : 'cover'), objectPosition: `${style.positionX ?? 50}% ${style.positionY ?? 50}%` }} />}
            </span>
            <span className="text-xs text-[#1d1d1f]">{shape.label}</span>
          </button>
        ))}
      </div>
      {pageData.profileImage && <>
        <Segmented options={[{ id: 'cover', label: 'ملء المساحة' }, { id: 'contain', label: 'إظهار كاملة' }]} value={fit} onChange={fit => updateProfileStyle({ fit: fit as 'cover' | 'contain', zoom: 1 })} />
        {fit === 'cover' && <div className="space-y-3">
          <p className="text-xs text-[#6e6e73]">اضبط موضع الصورة وتكبيرها، وتابع النتيجة في المعاينة.</p>
          {([{ key: 'positionX', label: 'أفقيًا', min: 0, max: 100, value: style.positionX ?? 50 }, { key: 'positionY', label: 'عموديًا', min: 0, max: 100, value: style.positionY ?? 50 }, { key: 'zoom', label: 'التكبير', min: 1, max: 3, value: style.zoom ?? 1 }] as const).map(control => <label key={control.key} className="flex items-center gap-3 text-sm text-[#1d1d1f]">
            <span className="w-16">{control.label}</span><input aria-label={control.label} type="range" dir="ltr" min={control.min} max={control.max} step={control.key === 'zoom' ? 0.01 : 1} value={control.value} onChange={event => updateProfileStyle({ [control.key]: Number(event.target.value) })} className="min-w-0 flex-1 accent-[#0a84ff]" />
          </label>)}
          <button type="button" onClick={() => updateProfileStyle({ positionX: 50, positionY: 50, zoom: 1 })} className="text-xs text-[#0a84ff]">إعادة ضبط الموضع والتكبير</button>
        </div>}
        <p className="text-xs text-[#6e6e73]">للشعارات والصور الجماعية جرّب «إظهار كاملة». تغيير الشكل يحافظ على الصورة المرفوعة.</p>
      </>}
    </div>
  );
}
