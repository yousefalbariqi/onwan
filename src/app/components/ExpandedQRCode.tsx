import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// A separate scanning view, deliberately distinct from the native Wallet preview.
// A square occupies 90vw where height allows; quiet-zone modules remain intact.
export function ExpandedQRCode({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [qr, setQr] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setQr(''); setError(false);
    QRCode.toDataURL(url, { width: 1600, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(value => { if (alive) setQr(value); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [url]);
  return <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-[5vw] py-6 text-[#111]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
    <h1 className="max-w-full text-center text-lg font-bold">{name}</h1>
    <div style={{ width: 'min(90vw, calc(100svh - 180px), 960px)' }} className="aspect-square">
      {qr ? <img src={qr} alt={`باركود صفحة ${name}`} className="h-full w-full" /> : <p role="status" className="flex h-full items-center justify-center">{error ? 'تعذر إنشاء الباركود. أعد فتح الصفحة.' : 'جارٍ تجهيز الباركود…'}</p>}
    </div>
    <p className="text-sm text-gray-600">امسح الباركود لفتح الصفحة</p>
    <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-gray-200 px-6 text-sm font-bold">العودة إلى الصفحة</button>
  </main>;
}
