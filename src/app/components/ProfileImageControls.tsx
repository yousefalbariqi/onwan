import { usePageContext, type PageData } from '../context/PageContext';

type ShapeId = PageData['profileStyle']['type'];

// Note 29: the shapes. Note 33: shown in three families, each option drawn
// as the top of the page with the owner's own photo. «صورة كاملة» is the
// whole photo with no frame (stored as `hero_safe`, offered again here).
export const PROFILE_SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'circle', label: 'دائرة' },
  { id: 'premium', label: 'دائرة بإطار' },
  { id: 'rounded', label: 'مربع ناعم' },
  { id: 'square', label: 'مربع' },
  // Note 41: named by what they do — edge to edge and fading («غلاف»), or
  // the whole photo inside a margin («بهامش»).
  { id: 'hero', label: 'غلاف' },
  { id: 'hero_safe', label: 'بهامش' },
];

const isShapeActive = (current: ShapeId, id: ShapeId) => current === id;

// Note 21: how the photo sits in its shape, said plainly and shown, not named.
// Note 27: plainer names, and each example drawn in the chosen frame's own
// proportions, so «الصورة كاملة» shows its empty margins and «ملء الإطار» its crop.
const FITS = [
  { id: 'cover', label: 'ملء الإطار', hint: 'قد تُقص الأطراف' },
  { id: 'contain', label: 'الصورة كاملة', hint: 'بلا قص ولا تشويه' },
] as const;

// The frame of the example: wide for «غلاف» and «بهامش», otherwise the shape itself.
function fitFrame(type: ShapeId) {
  if (type === 'hero' || type === 'hero_safe') return 'h-10 w-16 rounded-md';
  if (type === 'circle' || type === 'premium') return 'h-12 w-12 rounded-full';
  if (type === 'rounded') return 'h-12 w-12 rounded-xl';
  return 'h-12 w-12 rounded-none';
}
// The empty part of a frame, faintly striped so it reads as «not photo».
const EMPTY_FRAME = { backgroundColor: '#ececf0', backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 4px, transparent 4px 8px)' };

// Note 33: the top of the page in miniature — the page's own background, the
// photo in this shape, then two faint lines for the name and the bio — so the
// result reads before choosing. Fits the option's card; nothing grows.
function MiniPageTop({ shape, image, fit, position, background }: { shape: ShapeId; image: string; fit: 'cover' | 'contain'; position: string; background: string }) {
  const photo = image
    ? <img src={image} alt="" className="h-full w-full" style={{ objectFit: fit, objectPosition: position }} />
    : null;
  const wide = shape === 'hero' || shape === 'hero_safe';
  const frame = shape === 'circle' ? 'rounded-full' : shape === 'premium' ? 'rounded-full ring-2 ring-[#1d1d1f] ring-offset-1' : shape === 'rounded' ? 'rounded-lg' : 'rounded-none';
  const fade = { maskImage: 'linear-gradient(to bottom, #000 60%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, #000 60%, transparent)' };
  return (
    <span className="relative block h-[64px] w-full overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background }} aria-hidden="true">
      {wide ? (
        <span className={`block h-[42px] w-full overflow-hidden ${shape === 'hero_safe' ? 'px-3 pt-1.5' : ''}`} style={shape === 'hero' ? fade : undefined}>
          <span className="block h-full w-full overflow-hidden bg-[#c7c7cc]/60">{photo}</span>
        </span>
      ) : (
        <span className="flex justify-center pt-1.5"><span className={`block h-8 w-8 overflow-hidden bg-[#c7c7cc] ${frame}`}>{photo}</span></span>
      )}
      <span className={`absolute inset-x-0 flex flex-col items-center gap-1 ${wide ? 'top-[48px]' : 'top-[44px]'}`}>
        <span className="h-1.5 w-12 rounded-full bg-black/35" />
        <span className="h-1 w-16 rounded-full bg-black/15" />
      </span>
    </span>
  );
}

// Shape and fit of the profile photo; «الهوية» draws the position / zoom
// sliders around the photo itself.
export function ProfileImageControls() {
  const { pageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const fit = style.fit ?? (style.type === 'hero_safe' ? 'contain' : 'cover');
  const image = pageData.profileImage;
  const pageBackground = pageData.wallpaper.type === 'color' || pageData.wallpaper.type === 'gradient' ? pageData.wallpaper.value : pageData.theme.background;

  return (
    <div className="space-y-3" dir="rtl">
      {/* Note 41: one quiet grid — three to a row (two on very narrow screens),
          the preview doing the explaining, a short name under it. */}
      <div className="grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-3" role="group" aria-label="شكل الصورة">
        {PROFILE_SHAPES.map((shape) => {
          const active = isShapeActive(style.type, shape.id);
          return (
            <button
              type="button"
              key={shape.id}
              aria-pressed={active}
              onClick={() => !active && updateProfileStyle({ type: shape.id })}
              className={`flex flex-col items-stretch gap-0.5 rounded-xl p-0.5 transition-colors ${active ? 'bg-[#0a84ff]/10 ring-2 ring-[#0a84ff]' : 'hover:bg-[#f2f2f7]'}`}
            >
              <MiniPageTop shape={shape.id} image={image} fit={shape.id === 'hero_safe' ? 'contain' : fit} position={`${style.positionX ?? 50}% ${style.positionY ?? 50}%`} background={pageBackground} />
              <span className={`text-center text-[12px] leading-4 ${active ? 'font-bold text-[#0a84ff]' : 'text-[#3a3a3c]'}`}>{shape.label}</span>
            </button>
          );
        })}
      </div>

      {/* «بهامش» always shows the whole photo, so it has no fit choice. */}
      {image && style.type !== 'hero_safe' && (
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-[#6e6e73]" style={{ fontFamily: 'Cairo, sans-serif' }}>الصورة داخل الشكل</p>
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
                  className={`flex items-center gap-2.5 rounded-xl border-2 px-2 py-1.5 text-right transition-colors ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}
                >
                  {/* The photo itself in a small frame, filled or whole. */}
                  <span className={`block shrink-0 overflow-hidden ring-1 ring-black/10 ${fitFrame(style.type)}`} style={EMPTY_FRAME}>
                    <img src={image} alt="" className="h-full w-full" style={{ objectFit: option.id, objectPosition: `${style.positionX ?? 50}% ${style.positionY ?? 50}%` }} />
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
