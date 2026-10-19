import { useRef, useState } from 'react';

interface ImageCropperProps {
  src: string;
  // width / height of the crop frame
  aspect: number;
  // width of the produced image in pixels
  outputWidth: number;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  // Offer the untouched image too (a wide logo should not be forced square).
  onUseOriginal?: () => void;
}

const FRAME_WIDTH = 280;

// PAGE-02 / PAGE-03: crop, move and scale an uploaded image before it is used.
export function ImageCropper({ src, aspect, outputWidth, onConfirm, onCancel, onUseOriginal }: ImageCropperProps) {
  const frameHeight = FRAME_WIDTH / aspect;
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Scale at which the image exactly covers the frame, times the chosen zoom.
  const scale = natural ? Math.max(FRAME_WIDTH / natural.w, frameHeight / natural.h) * zoom : 1;
  const shown = natural ? { w: natural.w * scale, h: natural.h * scale } : { w: FRAME_WIDTH, h: frameHeight };

  const clamp = (value: { x: number; y: number }, size = shown) => {
    const maxX = Math.max(0, (size.w - FRAME_WIDTH) / 2);
    const maxY = Math.max(0, (size.h - frameHeight) / 2);

    return { x: Math.min(maxX, Math.max(-maxX, value.x)), y: Math.min(maxY, Math.max(-maxY, value.y)) };
  };

  const handleZoom = (nextZoom: number) => {
    if (!natural) return;

    const nextScale = Math.max(FRAME_WIDTH / natural.w, frameHeight / natural.h) * nextZoom;
    setZoom(nextZoom);
    setOffset((prev) => clamp(prev, { w: natural.w * nextScale, h: natural.h * nextScale }));
  };

  const handleConfirm = () => {
    const image = imageRef.current;

    if (!image || !natural) return;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = Math.round(outputWidth / aspect);

    const context = canvas.getContext('2d');

    if (!context) return;

    // The part of the original image that sits inside the frame.
    const sourceX = ((shown.w - FRAME_WIDTH) / 2 - offset.x) / scale;
    const sourceY = ((shown.h - frameHeight) / 2 - offset.y) / scale;

    context.drawImage(image, sourceX, sourceY, FRAME_WIDTH / scale, frameHeight / scale, 0, 0, canvas.width, canvas.height);

    // PNG keeps a logo's transparency; photos are much smaller as JPEG.
    const isPng = src.startsWith('data:image/png');
    onConfirm(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-1 text-base font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
          قص الصورة وتحريكها
        </h3>
        <p className="mb-4 text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          اسحب الصورة لتحريكها، واستخدم الشريط للتكبير.
        </p>

        <div
          className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px] active:cursor-grabbing"
          style={{ width: FRAME_WIDTH, height: frameHeight }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setOffset(clamp({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: shown.w,
              height: shown.h,
              left: (FRAME_WIDTH - shown.w) / 2 + offset.x,
              top: (frameHeight - shown.h) / 2 + offset.y,
            }}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => handleZoom(Number(event.target.value))}
          className="mt-4 w-full accent-emerald-500"
          aria-label="تكبير الصورة"
        />

        <div className="mt-4 grid grid-cols-2 gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          <button onClick={handleConfirm} disabled={!natural} className="rounded-lg bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
            استخدام الصورة
          </button>
          <button onClick={onCancel} className="rounded-lg bg-gray-100 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200">
            إلغاء
          </button>
        </div>
        {onUseOriginal && (
          <button onClick={onUseOriginal} className="mt-2 w-full text-xs text-gray-500 hover:underline" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            استخدام الصورة كاملة دون قص (للشعارات العريضة)
          </button>
        )}
      </div>
    </div>
  );
}
