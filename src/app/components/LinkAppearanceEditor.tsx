import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { LinkDisplay } from '../context/PageContext';
import { Group, Segmented } from './ios';

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
    setLoading(false);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('اختر صورة PNG أو JPG أو WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('الحد الأقصى للصورة 8MB.'); return; }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const factor = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * factor));
      canvas.height = Math.max(1, Math.round(image.height * factor));
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
      if (result.length > 2_000_000) throw new Error();
      if (current === request.current) latest.current.onChange({ ...latest.current.display, image: result, positionX: 50, positionY: 50 });
    } catch {
      if (current === request.current) setError('تعذّر تجهيز الصورة. جرّب صورة أصغر أو صيغة JPG.');
    } finally {
      URL.revokeObjectURL(url);
      if (current === request.current) setLoading(false);
    }
  };
  return <Group title="طريقة عرض الرابط" footer="البطاقة تعرض صورة كبيرة مع عنوان الرابط. يمكنك الرجوع للزر العادي دون فقد الصورة.">
    <div className="space-y-3 p-3">
      <Segmented options={[{ id: 'button', label: 'زر عادي' }, { id: 'card', label: 'بطاقة مصوّرة' }]} value={display.layout ?? 'button'} onChange={layout => onChange({ ...display, layout: layout === 'card' ? 'card' : undefined })} />
      {display.layout === 'card' && <>
        {display.image && <div className="aspect-video overflow-hidden rounded-xl bg-[#f2f2f7]"><img src={display.image} alt="" className="h-full w-full" style={{ objectFit: fit, objectPosition: `${display.positionX ?? 50}% ${display.positionY ?? 50}%` }} /></div>}
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0a84ff] focus-within:ring-2 focus-within:ring-blue-500">
          <Upload className="h-4 w-4" />{loading ? 'جارٍ تجهيز الصورة…' : display.image ? 'تغيير صورة البطاقة' : 'إرفاق صورة البطاقة'}
          <input type="file" aria-label="صورة البطاقة" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
        </label>
        {display.image && <>
          <Segmented options={[{ id: 'cover', label: 'ملء المساحة' }, { id: 'contain', label: 'إظهار كاملة' }]} value={fit} onChange={imageFit => onChange({ ...display, imageFit: imageFit as 'cover' | 'contain' })} />
          {fit === 'cover' && (['positionX', 'positionY'] as const).map(key => <label key={key} className="flex items-center gap-3 text-sm text-[#3a3a3c]">
            <span>{key === 'positionX' ? 'موضع أفقي' : 'موضع عمودي'}</span><input aria-label={key === 'positionX' ? 'موضع صورة البطاقة أفقيًا' : 'موضع صورة البطاقة عموديًا'} type="range" dir="ltr" min={0} max={100} value={display[key] ?? 50} onChange={event => onChange({ ...display, [key]: Number(event.target.value) })} className="min-w-0 flex-1 accent-[#0a84ff]" />
          </label>)}
          <button type="button" onClick={() => onChange({ ...display, image: undefined, positionX: 50, positionY: 50 })} className="text-xs text-[#ff3b30]">إزالة صورة البطاقة</button>
        </>}
        {!display.image && <p className="text-xs text-[#6e6e73]">أرفق صورة لإكمال البطاقة المصوّرة.</p>}
      </>}
      {!!error && <p role="alert" className="text-xs text-[#ff3b30]">{error}</p>}
    </div>
  </Group>;
}
