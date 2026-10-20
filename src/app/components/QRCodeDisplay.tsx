import { useState, useEffect, useRef } from 'react';
import { Check, Copy, Download, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { pageHost, pageUrl } from '../lib/site';

interface QRCodeDisplayProps {
  username: string;
}

export function QRCodeDisplay({ username }: QRCodeDisplayProps) {
  const [showModal, setShowModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = pageUrl(username);

  useEffect(() => {
    if (!username) return;

    QRCode.toDataURL(url, {
      width: 800,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl);
  }, [username, url]);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `onwan-${username}-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  if (!username) return null;

  return (
    <>
      {/* Same size and shape as «صمّم لي» and «التالي» beside it. */}
      <button
        onClick={() => setShowModal(true)}
        className="flex h-10 w-[104px] items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm transition-transform active:scale-95"
        style={{ fontFamily: 'Cairo, sans-serif' }}
        title="مشاركة رابط صفحتك وباركودها"
      >
        <Share2 className="h-4 w-4" />
        مشاركة
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                مشاركة صفحتك
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* QR Code */}
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 mb-4 flex flex-col items-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64"
                />
              ) : (
                <div className="w-56 h-56 bg-gray-100 rounded-xl animate-pulse" />
              )}
              <p
                className="text-sm font-bold text-emerald-600 mt-4"
                style={{ fontFamily: 'Cairo, sans-serif' }}
                dir="ltr"
              >
                {pageHost(username)}
              </p>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // clipboard blocked: the link is shown above to copy by hand
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-800"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'تم النسخ' : 'نسخ الرابط'}
              </button>
              <button
                onClick={() => navigator.share?.({ url }).catch(() => undefined)}
                disabled={typeof navigator.share !== 'function'}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-800 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
                إرسال
              </button>
            </div>
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-base hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Download className="w-5 h-5" />
              تحميل الباركود للطباعة
            </button>

            <p className="text-center text-xs text-gray-400 mt-3" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              امسح الباركود بالكاميرا للوصول لصفحتك مباشرة
            </p>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
