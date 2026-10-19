import { useState, useEffect, useRef } from 'react';
import { Download, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { pageHost, pageUrl } from '../lib/site';

interface QRCodeDisplayProps {
  username: string;
}

export function QRCodeDisplay({ username }: QRCodeDisplayProps) {
  const [showModal, setShowModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
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
      <button
        onClick={() => setShowModal(true)}
        className="flex h-10 min-w-10 items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 px-2 sm:px-4 rounded-full text-sm font-semibold hover:bg-gray-50 hover:border-emerald-300 transition-all"
        title="عرض باركود الصفحة"
      >
        <QrCode className="h-5 w-5" />
        <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
          باركود
        </span>
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
                باركود صفحتك
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
