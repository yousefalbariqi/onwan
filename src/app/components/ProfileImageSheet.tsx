import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Crop, ImagePlus, Trash2, X } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { hasTransparency } from '../lib/imageTransparency';

// Note 22: one small sheet for the photo. The menu and the crop are two steps
// of the same sheet. Cropping never touches the file: the original stays and
// only position and zoom are stored, so changing the shape later loses nothing.

const FRAME_WIDTH = 240;

function frameFor(type: string) {
  if (type === 'hero' || type === 'hero_safe') return { width: 300, height: 190, radius: '14px' };
  if (type === 'circle' || type === 'premium' || type === 'banner') return { width: FRAME_WIDTH, height: FRAME_WIDTH, radius: '50%' };
  if (type === 'rounded') return { width: FRAME_WIDTH, height: FRAME_WIDTH, radius: '28px' };
  return { width: FRAME_WIDTH, height: FRAME_WIDTH, radius: '0' };
}

const clampPercent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

export function ProfileImageSheet({ uploadId, startAtCrop, minZoom, onClose, onRemove }: {
  uploadId: string;
  startAtCrop: boolean;
  minZoom: number;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { pageData, updateProfileStyle } = usePageContext();
  const style = pageData.profileStyle;
  const [step, setStep] = useState<'menu' | 'crop'>(startAtCrop ? 'crop' : 'menu');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const before = useRef({ fit: style.fit, zoom: style.zoom, positionX: style.positionX, positionY: style.positionY });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const fit = style.fit ?? (style.type === 'hero_safe' ? 'contain' : 'cover');
  const zoom = style.zoom ?? 1;
  const positionX = style.positionX ?? 50;
  const positionY = style.positionY ?? 50;
  const frame = frameFor(style.type);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openCrop = () => {
    before.current = { fit: style.fit, zoom: style.zoom, positionX: style.positionX, positionY: style.positionY };
    setStep('crop');
    // Older pages stored a photo as «whole»; with no such option now, a photo opens filling its frame.
    if (style.fit === 'contain' && style.type !== 'hero_safe') void hasTransparency(pageData.profileImage).then(transparent => { if (!transparent) updateProfileStyle({ fit: 'cover', zoom: 1 }); });
  };
  const cancelCrop = () => {
    updateProfileStyle(before.current);
    if (startAtCrop) onClose(); else setStep('menu');
  };

  // With object-position p and scale z about p, the image's edge sits at
  // p * (frame - rendered * z), so a drag of d pixels moves p by d / (frame - rendered * z).
  const dragRange = () => {
    if (!natural) return { x: 0, y: 0 };
    const scale = fit === 'cover'
      ? Math.max(frame.width / natural.w, frame.height / natural.h)
      : Math.min(frame.width / natural.w, frame.height / natural.h);
    return { x: frame.width - natural.w * scale * zoom, y: frame.height - natural.h * scale * zoom };
  };

  const sheet = (
    <div className="image-sheet" dir="rtl" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="image-sheet__panel" role="dialog" aria-modal="true" aria-label={step === 'menu' ? 'الصورة الشخصية' : 'اقتصاص الصورة'}>
        <span className="image-sheet__handle" aria-hidden="true" />
        <header className="image-sheet__header">
          {step === 'crop'
            ? <button type="button" onClick={cancelCrop} aria-label="رجوع بدون حفظ القص"><ChevronRight size={22} /></button>
            : <span aria-hidden="true" />}
          <h3>{step === 'menu' ? 'الصورة الشخصية' : 'اقتصاص وضبط'}</h3>
          <button type="button" onClick={step === 'crop' ? () => { updateProfileStyle(before.current); onClose(); } : onClose} aria-label="إغلاق"><X size={22} /></button>
        </header>

        {step === 'menu' ? (
          <div className="image-sheet__menu">
            <button type="button" onClick={openCrop}><span><Crop size={22} /></span><b>اقتصاص وضبط</b><ChevronLeft size={19} aria-hidden="true" /></button>
            <label htmlFor={uploadId} onClick={onClose}><span><ImagePlus size={22} /></span><b>استبدال الصورة</b><ChevronLeft size={19} aria-hidden="true" /></label>
            <button type="button" className="is-danger" onClick={() => { onRemove(); onClose(); }}><span><Trash2 size={22} /></span><b>إزالة الصورة</b></button>
          </div>
        ) : (
          <div className="image-sheet__crop">
            <div
              className="image-sheet__frame"
              style={{ width: frame.width, height: frame.height, borderRadius: frame.radius }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, y: event.clientY, px: positionX, py: positionY };
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                const range = dragRange();
                const next: { positionX?: number; positionY?: number } = {};
                if (Math.abs(range.x) > 1) next.positionX = clampPercent(drag.current.px + ((event.clientX - drag.current.x) / range.x) * 100);
                if (Math.abs(range.y) > 1) next.positionY = clampPercent(drag.current.py + ((event.clientY - drag.current.y) / range.y) * 100);
                if (next.positionX !== undefined || next.positionY !== undefined) updateProfileStyle(next);
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
            >
              <img
                src={pageData.profileImage}
                alt=""
                draggable={false}
                onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
                style={{ objectFit: fit, objectPosition: `${positionX}% ${positionY}%`, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: `${positionX}% ${positionY}%` }}
              />
            </div>
            <p>اسحب لتحريك الصورة، وصغّرها لإظهارها كاملة</p>
            <input type="range" dir="ltr" min={minZoom} max={3} step={0.01} value={zoom} aria-label="تكبير الصورة" onChange={(event) => updateProfileStyle({ zoom: Number(event.target.value) })} />
            <button type="button" className="image-sheet__done" onClick={onClose}>تم</button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
