import { useEffect, useState } from 'react';
import { Check, ChevronDown, ContactRound, Copy, Download, QrCode, Share2, Smartphone, UserRound, WalletCards, X } from 'lucide-react';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { pageHost, pageUrl } from '../lib/site';
import { downloadVCard } from '../lib/vcard';

// Note 39: «مشاركة صفحتك» — the digital card on top, one main action, and a
// short list of the other ways to share or keep the page. Wallet passes need
// Apple / Google signing accounts that are not set up yet, so they say so
// instead of handing out an image in their place.
export function QRCodeDisplay({ username }: { username: string }) {
  const { pageData } = usePageContext();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [toast, setToast] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const url = pageUrl(username);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!username || !open) return;
    QRCode.toDataURL(url, { width: 800, margin: 2, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'H' }).then(setQr);
  }, [username, url, open]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!username) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setToast('تم نسخ الرابط');
    } catch {
      setToast('');
    }
  };

  const downloadQr = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.download = `onwan-${username}-qr.png`;
    link.href = qr;
    link.click();
    setToast('تم تنزيل رمز QR');
  };

  const wallets = [
    { id: 'apple', label: 'Apple Wallet', Icon: WalletCards, tone: 'bg-[#1d1d1f]', note: 'إضافة البطاقة إلى Apple Wallet تحتاج شهادة Apple لتوقيعها، وتتفعّل عند إعدادها.' },
    { id: 'google', label: 'Google Wallet', Icon: Smartphone, tone: 'bg-[#0a84ff]', note: 'إضافة البطاقة إلى Google Wallet تحتاج حساب Google Wallet للمُصدِر، وتتفعّل عند إعداده.' },
  ];
  // The wallet of this device first.
  if (isAndroid && !isIos) wallets.reverse();

  const row = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-right active:bg-[#f2f2f7]';
  const tile = (tone: string) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white ${tone}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-[104px] items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm transition-transform active:scale-95"
        style={{ fontFamily: 'Cairo, sans-serif' }}
        title="مشاركة صفحتك"
      >
        <Share2 className="h-4 w-4" />
        مشاركة
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <section dir="rtl" role="dialog" aria-modal="true" aria-label="مشاركة صفحتك" onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#f2f2f7] pb-6 sm:rounded-[28px]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center bg-[#f2f2f7]/95 px-5 py-3 backdrop-blur">
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3e3e8] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
              <h2 className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>مشاركة صفحتك</h2>
              <span />
            </div>

            <div className="space-y-5 px-5">
              {/* The digital card, in the page's own colours. */}
              <div className="relative overflow-hidden rounded-[24px] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]" style={{ background: `linear-gradient(145deg, ${pageData.theme.buttonColor}, ${pageData.theme.textColor})`, color: pageData.theme.buttonTextColor }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/40">
                    {pageData.profileImage ? <img src={pageData.profileImage} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>{pageData.name || 'صفحتك'}</span>
                    <span className="block truncate text-sm opacity-80" dir="ltr" style={{ textAlign: 'right' }}>{pageHost(username)}</span>
                  </span>
                </div>
                {qr && <img src={qr} alt="" className="absolute bottom-4 left-4 h-14 w-14 rounded-lg bg-white p-1" />}
                <div className="mt-8 h-1" />
              </div>

              {canShare ? (
                <button onClick={() => navigator.share({ title: pageData.name || undefined, url }).catch(() => undefined)} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0a84ff] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] active:scale-[0.98]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <Share2 className="h-5 w-5" />مشاركة
                </button>
              ) : (
                <button onClick={copy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0a84ff] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] active:scale-[0.98]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <Copy className="h-5 w-5" />نسخ الرابط
                </button>
              )}

              <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
                {canShare && (
                  <button onClick={copy} className={row}>
                    <span className={tile('bg-[#8e8e93]')}><Copy className="h-[18px] w-[18px]" /></span>
                    <span className="flex-1 text-[15px] text-[#1d1d1f]">نسخ الرابط</span>
                  </button>
                )}
                <button onClick={() => setShowQr(!showQr)} aria-expanded={showQr} className={row}>
                  <span className={tile('bg-[#1d1d1f]')}><QrCode className="h-[18px] w-[18px]" /></span>
                  <span className="flex-1 text-[15px] text-[#1d1d1f]">رمز QR</span>
                  <ChevronDown className={`h-4 w-4 text-[#c7c7cc] transition-transform ${showQr ? 'rotate-180' : ''}`} />
                </button>
                {showQr && (
                  <div className="flex flex-col items-center gap-3 px-4 py-4">
                    {qr ? <img src={qr} alt={`رمز QR لصفحة ${pageHost(username)}`} className="h-48 w-48" /> : <div className="h-48 w-48 animate-pulse rounded-xl bg-[#f2f2f7]" />}
                    <button onClick={downloadQr} className="flex items-center gap-1.5 text-sm font-bold text-[#0a84ff]"><Download className="h-4 w-4" />تنزيل للطباعة</button>
                  </div>
                )}
                <button onClick={() => { downloadVCard(pageData); setToast('تم تنزيل جهة الاتصال'); }} className={row}>
                  <span className={tile('bg-[#34c759]')}><ContactRound className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-[#1d1d1f]">حفظ جهة الاتصال</span>
                    <span className="block text-xs text-[#8e8e93]">الاسم والجوال والبريد والرابط والشعار</span>
                  </span>
                </button>
                {wallets.map(({ id, label, Icon, tone, note }) => (
                  <button key={id} onClick={() => setWalletNote(walletNote === note ? '' : note)} className={row}>
                    <span className={tile(tone)}><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="flex-1 text-[15px] text-[#8e8e93]">{label}</span>
                    <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[11px] font-bold text-[#8e8e93]">قريبًا</span>
                  </button>
                ))}
              </div>
              {walletNote && <p className="rounded-xl bg-white px-3.5 py-2.5 text-[13px] leading-6 text-[#3a3a3c]">{walletNote}</p>}
            </div>

            {toast && (
              <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4" role="status">
                <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-black/5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34c759] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  {toast}
                </span>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
