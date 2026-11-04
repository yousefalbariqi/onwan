import { useEffect, useState } from 'react';
import { Copy, Download, Share2, WalletCards, ContactRound } from 'lucide-react';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { pageUrl, pageHost } from '../lib/site';
import { downloadVCard } from '../lib/vcard';
import { requestWalletPassLink } from '../lib/api';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

export function SharingPanel({ username }: { username: string }) {
  const { pageData, account } = usePageContext();
  const [color, setColor] = useState('#111111');
  const [transparent, setTransparent] = useState(false);
  const [cardColor, setCardColor] = useState('#ff6b2c');
  const [qr, setQr] = useState('');
  const [cardQr, setCardQr] = useState('');
  const [walletUrl, setWalletUrl] = useState('');
  const [walletError, setWalletError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const url = pageUrl(username);
  const published = account?.pageStatus === 'published';
  const action = 'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#111] px-4 text-sm font-bold text-white disabled:opacity-40';
  useEffect(() => {
    let alive = true;
    setQr('');
    QRCode.toDataURL(url, { width: 1200, margin: 4, errorCorrectionLevel: 'H', color: { dark: color, light: transparent ? '#ffffff00' : '#ffffff' } })
      .then(value => { if (alive) setQr(value); }).catch(() => { if (alive) setNotice('تعذر إنشاء الباركود. حاول مجددًا.'); });
    return () => { alive = false; };
  }, [url, color, transparent]);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 240, margin: 4 }).then(value => { if (alive) setCardQr(value); }).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  useEffect(() => {
    let alive = true;
    setWalletUrl(''); setWalletError('');
    requestWalletPassLink(cardColor).then(value => { if (alive) setWalletUrl(value); })
      .catch(() => { if (alive) setWalletError('تعذر تجهيز بطاقة Apple Wallet. حاول مجددًا.'); });
    return () => { alive = false; };
  }, [cardColor, attempt]);
  if (!username) return <p className="p-5">اختر رابط صفحتك أولًا.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setNotice('تم نسخ الرابط'); }
    catch { setNotice('تعذر النسخ؛ يمكنك نسخ الرابط من الحقل.'); }
  };
  const light = [1, 3, 5].reduce((sum, start, index) => sum + parseInt(cardColor.slice(start, start + 2), 16) * [0.299, 0.587, 0.114][index], 0) > 160;
  return <div dir="rtl" className="space-y-5 p-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
    {!published && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">الرابط والباركود يعملان للزوار بعد نشر الصفحة.</p>}
    <section className="space-y-3 rounded-2xl bg-white p-4">
      <h3 className="font-bold">رابط الصفحة</h3>
      <input aria-label="رابط الصفحة" readOnly value={url} dir="ltr" onFocus={event => event.target.select()} className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
      <div className="flex flex-wrap gap-2"><button type="button" onClick={copy} className={action}><Copy size={16} />نسخ الرابط</button>
      {typeof navigator.share === 'function' && <button type="button" className={action} onClick={() => navigator.share({ title: pageData.name, url }).catch(error => { if (error.name !== 'AbortError') setNotice('تعذرت المشاركة. انسخ الرابط وحاول مجددًا.'); })}><Share2 size={16} />مشاركة الرابط</button>}</div>
    </section>
    <section className="space-y-4 rounded-2xl bg-white p-4">
      <h3 className="font-bold">الباركود</h3>
      <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-xl border border-gray-100 bg-[#f5f5f7]">{qr && <img src={qr} alt={`باركود ${pageHost(username)}`} className="h-48 w-48" />}</div>
      <label className="flex items-center justify-between gap-3 text-sm">لون الباركود<input type="color" aria-label="لون الباركود" value={color} onChange={event => setColor(event.target.value)} className="h-10 w-12 cursor-pointer" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transparent} onChange={event => setTransparent(event.target.checked)} />تحميل بدون خلفية</label>
      <p className="text-xs text-gray-500">اختر لونًا داكنًا، وضع الباركود على خلفية فاتحة ليسهل مسحه.</p>
      <a aria-disabled={!qr} href={qr || undefined} download={`onwan-${username}-qr${transparent ? '-transparent' : ''}.png`} className={`${action} ${!qr ? 'pointer-events-none opacity-40' : ''}`}><Download size={16} />تحميل الباركود PNG</a>
    </section>
    <section className="space-y-4 rounded-2xl bg-white p-4">
      <h3 className="font-bold">بطاقة المحفظة</h3>
      <p className="text-sm text-gray-500">اختر لون بطاقتك المميز، ثم أضفها إلى المحفظة.</p>
      <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: cardColor, color: light ? '#111111' : '#ffffff' }}>
        <p className="text-lg font-bold">{pageData.name || 'صفحتك'}</p><p dir="ltr" className="mt-1 text-right text-sm">{pageHost(username)}</p>
        {cardQr && <img src={cardQr} alt="باركود البطاقة" className="mt-5 h-24 w-24 rounded-lg" />}
      </div>
      <label className="flex items-center justify-between text-sm">لون البطاقة<input type="color" aria-label="لون البطاقة" value={cardColor} onChange={event => setCardColor(event.target.value)} className="h-10 w-12 cursor-pointer" /></label>
      <p className="text-xs text-gray-500">معاينة اللون؛ تنسيق البطاقة يتبع تطبيق المحفظة.</p>
      {walletUrl ? <a href={walletUrl} className={action}><WalletCards size={18} />إضافة إلى Apple Wallet</a> : <button type="button" disabled={!walletError} onClick={() => setAttempt(value => value + 1)} className={`w-full ${action}`}>{walletError ? 'إعادة تجهيز البطاقة' : 'جارٍ تجهيز البطاقة…'}</button>}
      {walletError && <p role="status" className="text-sm text-red-700">{walletError}</p>}
      <button type="button" disabled className={`w-full ${action}`}>Google Wallet — قريبًا</button>
      <p className="text-xs text-gray-500">الإضافة إلى Google Wallet غير متاحة حاليًا.</p>
      <button type="button" onClick={() => downloadVCard(pageData)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-bold"><ContactRound size={18} />حفظ جهة الاتصال</button>
    </section>
    <p role="status" aria-live="polite" className="text-sm text-gray-600">{notice}</p>
  </div>;
}

export function QRCodeDisplay({ username }: { username: string }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="rounded-full border bg-white px-4 py-2 text-sm font-bold">مشاركة</button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto bg-[#f2f2f7] p-0"><DialogTitle className="px-5 pt-5">المشاركة</DialogTitle><SharingPanel username={username} /></DialogContent></Dialog>;
}
