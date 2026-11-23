import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { usePageContext } from '../context/PageContext';

// Audit E03: the cover has its own framing, separate from the logo's.
const RATIO = 2.4;
const clampPercent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

export function BannerCropSheet({ onClose }: { onClose: () => void }) {
  const { pageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const before = useRef({ bannerX: style.bannerX, bannerY: style.bannerY, bannerZoom: style.bannerZoom });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const width = Math.min(window.innerWidth - 32, 428);
  const height = Math.round(width / RATIO);
  const x = style.bannerX ?? 50;
  const y = style.bannerY ?? 50;
  const zoom = style.bannerZoom ?? 1;
  const origin = `${x}% ${y}%`;
  const cancel = () => { updateProfileStyle(before.current); onClose(); };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { updateProfileStyle(before.current); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, updateProfileStyle]);
  const range = () => {
    if (!natural) return { x: 0, y: 0 };
    const scale = Math.max(width / natural.w, height / natural.h) * zoom;
    return { x: width - natural.w * scale, y: height - natural.h * scale };
  };
  return createPortal(<div className="image-sheet" dir="rtl" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) cancel(); }}>
    <div className="image-sheet__panel" role="dialog" aria-modal="true" aria-label="ضبط الغلاف">
      <span className="image-sheet__handle" aria-hidden="true" />
      <header className="image-sheet__header"><span aria-hidden="true" /><h3>ضبط الغلاف</h3><button type="button" onClick={cancel} aria-label="إغلاق بدون حفظ الضبط"><X size={22} /></button></header>
      <div className="image-sheet__crop">
        <div className="image-sheet__frame" style={{ width, height, borderRadius: 14, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, px: x, py: y }; }}
          onPointerMove={event => {
            if (!drag.current) return;
            const limits = range();
            const next: { bannerX?: number; bannerY?: number } = {};
            if (Math.abs(limits.x) > 1) next.bannerX = clampPercent(drag.current.px + ((event.clientX - drag.current.x) / limits.x) * 100);
            if (Math.abs(limits.y) > 1) next.bannerY = clampPercent(drag.current.py + ((event.clientY - drag.current.y) / limits.y) * 100);
            if (next.bannerX !== undefined || next.bannerY !== undefined) updateProfileStyle(next);
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <img src={style.bannerImage} alt="" draggable={false} onLoad={event => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })} style={{ objectFit: 'cover', objectPosition: origin, transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: origin }} />
        </div>
        <p>اسحب الصورة لتختار الجزء الظاهر</p>
        <input type="range" dir="ltr" min={1} max={3} step={0.01} value={zoom} aria-label="تكبير صورة الغلاف" onChange={event => updateProfileStyle({ bannerZoom: Number(event.target.value) })} />
        <button type="button" className="image-sheet__done" onClick={onClose}>تم</button>
      </div>
    </div>
  </div>, document.body);
}
