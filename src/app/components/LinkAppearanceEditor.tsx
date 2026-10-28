import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { LinkDisplay } from '../context/PageContext';
import { Group, Segmented } from './ios';
import { ImageProblem, compressImage } from '../lib/compressImage';
import { cardImageStyle } from './PageView';

export function LinkAppearanceEditor({ display, onChange }: { display: LinkDisplay; onChange: (value: LinkDisplay) => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const latest = useRef({ display, onChange });
  latest.current = { display, onChange };
  useEffect(() => () => { request.current++; }, []);
  const fit = display.imageFit ?? 'cover';
  const upload = async (file?: File) => {
    if (!file) return;
    const current = ++request.current;
    setError('');
    setLoading(true);
    try {
      // Note (6): up to 10 MB in, made small automatically; the link's other edits stay as they are.
      const result = await compressImage(file);
      if (current === request.current) latest.current.onChange({ ...latest.current.display, image: result, positionX: 50, positionY: 50 });
    } catch (problem) {
      if (current === request.current) setError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  };
  return <Group title="طريقة عرض الرابط" footer="البطاقة تعرض صورة كبيرة مع عنوان الرابط. يمكنك الرجوع للزر العادي دون فقد الصورة.">
    <div className="space-y-3 p-3">
      {/* Note 42: two small pictures of the result instead of two words. */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="طريقة عرض الرابط">
        {([['button', 'زر عادي'], ['card', 'بطاقة مصوّرة']] as const).map(([id, label]) => {
          const active = (display.layout ?? 'button') === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={active} onClick={() => !active && onChange({ ...display, layout: id === 'card' ? 'card' : undefined })} className={`flex flex-col items-stretch gap-1.5 rounded-xl p-1.5 transition-colors ${active ? 'bg-[#0a84ff]/10 ring-2 ring-[#0a84ff]' : 'bg-[#f2f2f7]'}`}>
              <span className="flex h-[76px] items-center justify-center rounded-lg bg-white px-3" aria-hidden="true">
                {id === 'button'
                  ? <span className="flex h-7 w-full items-center justify-center rounded-full bg-[#1d1d1f]/85"><span className="h-1.5 w-12 rounded-full bg-white/80" /></span>
                  : <span className="flex w-16 flex-col overflow-hidden rounded-lg bg-[#1d1d1f]/85"><span className="aspect-square w-full bg-[#c7c7cc]">{display.image && <img src={display.image} alt="" className="h-full w-full object-cover" />}</span><span className="flex h-3.5 items-center justify-center"><span className="h-1 w-8 rounded-full bg-white/80" /></span></span>}
              </span>
              <span className={`text-center text-[12px] ${active ? 'font-bold text-[#0a84ff]' : 'text-[#3a3a3c]'}`}>{label}</span>
            </button>
          );
        })}
      </div>
      {display.layout === 'card' && <>
        {/* Note 44: the card's own frame (16:9, as on the page): drag the photo to
            place it, zoom with − / + — the same result visitors see. */}
        {display.image && <CardFrame display={display} onChange={onChange} />}
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0a84ff] focus-within:ring-2 focus-within:ring-blue-500">
          <Upload className="h-4 w-4" />{loading ? 'جارٍ تجهيز الصورة…' : display.image ? 'تغيير صورة البطاقة' : 'إرفاق صورة البطاقة'}
          <input type="file" aria-label="صورة البطاقة" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
        </label>
        {display.image && <>
          <Segmented options={[{ id: 'cover', label: 'ملء المساحة' }, { id: 'contain', label: 'إظهار كاملة' }]} value={fit} onChange={imageFit => onChange({ ...display, imageFit: imageFit as 'cover' | 'contain' })} />
          <button type="button" onClick={() => onChange({ ...display, image: undefined, positionX: 50, positionY: 50, zoom: undefined })} className="text-xs text-[#ff3b30]">إزالة صورة البطاقة</button>
        </>}
        {!display.image && <p className="text-xs text-[#6e6e73]">أرفق صورة لإكمال البطاقة المصوّرة.</p>}
      </>}
      {!!error && <p role="alert" className="text-xs text-[#ff3b30]">{error}</p>}
    </div>
  </Group>;
}

// The card's photo in its real frame. Dragging moves the focus point the way the
// finger goes; zoom runs 1–3 like the profile photo. Touch, mouse and pen alike.
function CardFrame({ display, onChange }: { display: LinkDisplay; onChange: (value: LinkDisplay) => void }) {
  const drag = useRef<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null);
  const zoom = display.zoom ?? 1;
  const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));
  const setZoom = (value: number) => onChange({ ...display, zoom: Math.round(Math.min(3, Math.max(1, value)) * 100) / 100 });
  return (
    <div className="space-y-2">
      <div
        className="relative aspect-video w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-[#f2f2f7] active:cursor-grabbing"
        aria-label="اسحب الصورة لضبط موضعها"
        onPointerDown={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, px: display.positionX ?? 50, py: display.positionY ?? 50, w: box.width, h: box.height };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const dx = ((event.clientX - start.x) / start.w) * 100 / zoom;
          const dy = ((event.clientY - start.y) / start.h) * 100 / zoom;
          onChange({ ...display, positionX: clamp(start.px - dx), positionY: clamp(start.py - dy) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <img src={display.image} alt="" draggable={false} className="pointer-events-none h-full w-full" style={cardImageStyle(display)} />
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <button type="button" aria-label="تصغير صورة البطاقة" onClick={() => setZoom(zoom - 0.1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] text-lg font-bold text-[#1d1d1f]">−</button>
        <input type="range" aria-label="تكبير صورة البطاقة" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="min-w-0 flex-1 accent-[#0a84ff]" />
        <button type="button" aria-label="تكبير صورة البطاقة" onClick={() => setZoom(zoom + 0.1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] text-lg font-bold text-[#1d1d1f]">+</button>
      </div>
      <p className="text-center text-[11px] text-[#8e8e93]">اسحب الصورة لتحريكها، وكبّرها من الشريط.</p>
    </div>
  );
}
