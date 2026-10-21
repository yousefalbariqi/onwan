import { usePageContext, type PageData } from '../context/PageContext';

type ShapeId = PageData['profileStyle']['type'];

// Note 29: five shapes; «صورة عريضة» is the approved name of the old «مشهد ممتلئ». «مشهد متوازن» (hero_safe) is no longer offered, but
// pages that use it keep rendering it; in the picker it counts as «صورة عريضة».
export const PROFILE_SHAPES: { id: ShapeId; label: string; preview: string }[] = [
  { id: 'circle', label: 'دائرة', preview: 'h-9 w-9 rounded-full' },
  { id: 'rounded', label: 'مربع ناعم', preview: 'h-9 w-9 rounded-xl' },
  { id: 'square', label: 'مربع', preview: 'h-9 w-9 rounded-none' },
  { id: 'premium', label: 'بإطار', preview: 'h-9 w-9 rounded-full ring-2 ring-offset-2 ring-[#1d1d1f]' },
  { id: 'hero', label: 'صورة عريضة', preview: 'h-8 w-12 rounded-md' },
];

const isShapeActive = (current: ShapeId, id: ShapeId) => current === id || (id === 'hero' && current === 'hero_safe');

// Note 21: how the photo sits in its shape, said plainly and shown, not named.
const FITS = [
  { id: 'cover', label: 'تملأ الشكل', hint: 'تُقص الأطراف' },
  { id: 'contain', label: 'تظهر كاملة', hint: 'بلا قص' },
] as const;

// Shape and fit of the profile photo; «الهوية» draws the position / zoom
// sliders around the photo itself.
export function ProfileImageControls() {
  const { pageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const fit = style.fit ?? (style.type === 'hero_safe' ? 'contain' : 'cover');
  const image = pageData.profileImage;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="شكل الصورة">
        {PROFILE_SHAPES.map((shape) => {
          const active = isShapeActive(style.type, shape.id);
          return (
            <button
              type="button"
              key={shape.id}
              aria-pressed={active}
              // Leaving the old «مشهد متوازن» keeps the photo uncropped as it was.
              onClick={() => !active && updateProfileStyle(shape.id === 'hero' && style.type === 'hero_safe' ? { type: 'hero', fit } : { type: shape.id })}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border-2 px-1 py-2 transition-colors ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}
            >
              <span className={`block overflow-hidden bg-[#c7c7cc] ${shape.preview}`}>
                {image && <img src={image} alt="" className="h-full w-full" style={{ objectFit: fit, objectPosition: `${style.positionX ?? 50}% ${style.positionY ?? 50}%` }} />}
              </span>
              <span className="text-[11px] font-bold leading-4 text-[#1d1d1f]">{shape.label}</span>
            </button>
          );
        })}
      </div>

      {image && (
        <div>
          <p className="mb-2 text-[13px] font-bold text-[#6e6e73]" style={{ fontFamily: 'Cairo, sans-serif' }}>الصورة داخل الشكل</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="الصورة داخل الشكل">
            {FITS.map((option) => {
              const active = fit === option.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  key={option.id}
                  onClick={() => !active && updateProfileStyle({ fit: option.id, zoom: 1 })}
                  className={`flex items-center gap-3 rounded-xl border-2 p-2.5 text-right transition-colors ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}
                >
                  {/* The photo itself in a small frame, filled or whole. */}
                  <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
                    <img src={image} alt="" className="h-full w-full" style={{ objectFit: option.id }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#1d1d1f]">{option.label}</span>
                    <span className="block text-[11px] text-[#8e8e93]">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
