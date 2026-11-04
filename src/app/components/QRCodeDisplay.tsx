import { useEffect, useState } from 'react';
import { Copy, Download, Share2, WalletCards, ContactRound } from 'lucide-react';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { pageUrl, pageHost } from '../lib/site';
import { downloadVCard } from '../lib/vcard';
import { requestWalletPassLink } from '../lib/api';
import { prepareWalletArtwork, renderWalletBanner } from '../lib/walletArtwork';
import { ExpandedQRCode } from './ExpandedQRCode';
import { OnwanLogo } from './OnwanLogo';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

export function SharingPanel({ username }: { username: string }) {
  const { pageData, account } = usePageContext();
  const [color, setColor] = useState('#111111');
  const [transparent, setTransparent] = useState(false);
  const [cardColor, setCardColor] = useState(() => pageData.extractedColors?.find(color => /^#[0-9a-f]{6}$/i.test(color)) || (/^#[0-9a-f]{6}$/i.test(pageData.theme.buttonColor) ? pageData.theme.buttonColor : '#ff6b2c'));
  const [shortName, setShortName] = useState('');
  const [logoOverride, setLogoOverride] = useState<string | null>(null);
  const [expandedQr, setExpandedQr] = useState(false);
  const cardName = shortName.trim() || pageData.name || username;
  const cardLogo = logoOverride ?? pageData.profileImage;
  const [qr, setQr] = useState('');
  const [cardQr, setCardQr] = useState('');
  const [walletUrl, setWalletUrl] = useState('');
  const [walletError, setWalletError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [bannerImage, setBannerImage] = useState('');
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
    setWalletUrl(''); setWalletError('');
    let alive = true;
    setBannerImage('');
    renderWalletBanner(cardName, cardColor).then(value => { if (alive) setBannerImage(value); }).catch(() => {});
    return () => { alive = false; };
  }, [cardColor, cardName, cardLogo, username]);
  const prepareCard = async () => {
    setPreparing(true); setWalletError('');
    try {
      const artwork = await prepareWalletArtwork(cardName, cardLogo || '', cardColor);
      setWalletUrl(await requestWalletPassLink(cardColor, artwork));
    } catch (error) { setWalletError(error instanceof Error ? error.message : 'تعذر تجهيز بطاقة Apple Wallet. حاول مجددًا.'); }
    finally { setPreparing(false); }
  };
  if (!username) return <p className="p-5">اختر رابط صفحتك أولًا.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setNotice('تم نسخ الرابط'); }
    catch { setNotice('تعذر النسخ؛ يمكنك نسخ الرابط من الحقل.'); }
  };
  const bannerColor = '#' + [1, 3, 5].map(start => Math.round(parseInt(cardColor.slice(start, start + 2), 16) * 0.24 + 255 * 0.76).toString(16).padStart(2, '0')).join('');
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
      <label className="block space-y-2 text-sm"><span>الاسم المختصر على البطاقة (اختياري)</span><input value={shortName} disabled={preparing} maxLength={160} placeholder={pageData.name} onChange={event => setShortName(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 px-3" /></label>
      <label className="block space-y-2 text-sm"><span>شعار البطاقة</span><input type="file" disabled={preparing} accept="image/png,image/jpeg,image/webp,image/gif" className="block w-full text-xs" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 5_000_000) { setWalletError('اختر شعارًا أصغر من 5MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => { setLogoOverride(String(reader.result)); setWalletError(''); };
        reader.onerror = () => setWalletError('تعذرت قراءة الشعار.');
        reader.readAsDataURL(file);
      }} /></label>
      <p className="text-xs text-gray-500">اختر شعار الجمعية إن كانت صورة الصفحة شخصية. هذا الاختيار يخص البطاقة فقط.</p>
      <div className="overflow-hidden rounded-[22px] border border-black/5 bg-[#f8f8f6] text-[#1c1e1d] shadow-sm">
        <div dir="ltr" className="flex items-center justify-between gap-3 px-4 py-3">{cardLogo ? <img src={cardLogo} alt="شعار الصفحة" className="h-12 w-28 object-contain" /> : <OnwanLogo className="shrink-0 scale-75 origin-left" />}<div className="min-w-0 text-left"><span className="block text-xs text-[#454d47]">الرابط</span><span dir="ltr" className="block break-all text-xs font-semibold">{pageHost(username)}</span></div></div>
        {bannerImage ? <img src={bannerImage} alt={`بطاقة تعريفية — ${cardName}`} className="block w-full" /> : <div className="h-28" style={{ backgroundColor: bannerColor }} />}
        <div className="flex flex-col items-center px-5 pb-5 pt-4">{cardQr && <img src={cardQr} alt="باركود البطاقة" className="aspect-square w-48 max-w-full" />}<p className="mt-2 text-xs text-[#454d47]">امسح لفتح الصفحة</p></div>
      </div>
      <button type="button" onClick={() => setExpandedQr(true)} className="min-h-11 w-full rounded-xl border border-gray-200 text-sm font-bold">عرض الباركود بأكبر مساحة للشاشة</button>
      <label className="flex items-center justify-between text-sm">اللون المميز للبطاقة<input type="color" aria-label="لون البطاقة" disabled={preparing} value={cardColor} onChange={event => setCardColor(event.target.value)} className="h-10 w-12 cursor-pointer" /></label>
      <p className="text-xs text-gray-500">معاينة تقريبية؛ نستخدم درجة فاتحة من اللون المختار لوضوح الاسم. حجم الباركود وموضع الشعار يحددهما Apple Wallet؛ لا يمكن ضبط الباركود على ٩٠٪ في هذا القالب.</p>
      {walletUrl ? <a href={walletUrl} className={action}><WalletCards size={18} />إضافة إلى Apple Wallet</a> : <button type="button" disabled={preparing} onClick={prepareCard} className={`w-full ${action}`}>{preparing ? 'جارٍ تجهيز البطاقة…' : walletError ? 'إعادة تجهيز البطاقة' : 'تجهيز بطاقة Apple Wallet'}</button>}
      {walletError && <p role="status" className="text-sm text-red-700">{walletError}</p>}
      <button type="button" disabled className={`w-full ${action}`}>Google Wallet — قريبًا</button>
      <p className="text-xs text-gray-500">الإضافة إلى Google Wallet غير متاحة حاليًا.</p>
      <button type="button" onClick={() => downloadVCard(pageData)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-bold"><ContactRound size={18} />حفظ جهة الاتصال</button>
    </section>
    <Dialog open={expandedQr} onOpenChange={setExpandedQr}><DialogContent dir="rtl" className="overflow-y-auto p-0" style={{ top: 0, left: 0, width: '100vw', height: '100dvh', maxWidth: 'none', transform: 'none', borderRadius: 0 }}><DialogTitle className="sr-only">عرض الباركود الموسّع</DialogTitle><ExpandedQRCode url={url} name={cardName} onClose={() => setExpandedQr(false)} /></DialogContent></Dialog>
    <p role="status" aria-live="polite" className="text-sm text-gray-600">{notice}</p>
  </div>;
}

export function QRCodeDisplay({ username }: { username: string }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="rounded-full border bg-white px-4 py-2 text-sm font-bold">مشاركة</button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto bg-[#f2f2f7] p-0"><DialogTitle className="px-5 pt-5">المشاركة</DialogTitle><SharingPanel username={username} /></DialogContent></Dialog>;
}
