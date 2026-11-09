import { useEffect, useState } from 'react';
import { Copy, Download, Share2, WalletCards, ContactRound, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { pageUrl, pageHost } from '../lib/site';
import { downloadVCard } from '../lib/vcard';
import { requestWalletPassLink, requestGoogleWalletLink } from '../lib/api';
import { prepareWalletArtwork } from '../lib/walletArtwork';
import { Group, SettingsRow } from './ios';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

export function SharingPanel({ username }: { username: string }) {
  const { pageData, account } = usePageContext();
  const [contactBusy, setContactBusy] = useState(false);
  const [color, setColor] = useState('#111111');
  const [transparent, setTransparent] = useState(false);
  const [cardColor, setCardColor] = useState(() => pageData.extractedColors?.find(color => /^#[0-9a-f]{6}$/i.test(color)) || (/^#[0-9a-f]{6}$/i.test(pageData.theme.buttonColor) ? pageData.theme.buttonColor : '#ff6b2c'));
  const cardName = pageData.name || username;
  const cardLogo = pageData.profileImage;
  const [qr, setQr] = useState('');
  const [walletUrl, setWalletUrl] = useState('');
  const [walletError, setWalletError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleUrl, setGoogleUrl] = useState('');
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
  useEffect(() => { setWalletUrl(''); setWalletError(''); }, [cardColor, cardName, cardLogo, username]);
  const prepareCard = async () => {
    setPreparing(true); setWalletError('');
    try {
      const artwork = await prepareWalletArtwork(cardName, cardLogo || '', cardColor);
      const passUrl = await requestWalletPassLink(cardColor, artwork);
      setWalletUrl(passUrl);
      window.location.assign(passUrl);
    } catch (error) { setWalletError(error instanceof Error ? error.message : 'تعذر تجهيز بطاقة Apple Wallet. حاول مجددًا.'); }
    finally { setPreparing(false); }
  };
  if (!username) return <p className="p-5">اختر رابط صفحتك أولًا.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setNotice('تم نسخ الرابط'); }
    catch { setNotice('تعذر النسخ؛ يمكنك نسخ الرابط من الحقل.'); }
  };
  return <div dir="rtl" className="space-y-6 p-5" style={{ fontFamily: 'Cairo, sans-serif' }}>
    {!published && <p className="px-1 text-xs leading-6 text-[#737373]">يمكنك تجهيز أدوات المشاركة الآن. {account?.pageStatus === 'suspended' ? 'الصفحة موقوفة حاليًا.' : 'يفتح الرابط للزوار بعد تفعيل الصفحة.'}</p>}
    <Group title="رابط الصفحة">
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        <input aria-label="رابط الصفحة" readOnly value={url} dir="ltr" onFocus={event => event.target.select()} className="min-h-11 min-w-0 flex-1 bg-transparent text-left text-sm text-[#1d1d1f] focus:outline-none" />
        {typeof navigator.share === 'function' && <button type="button" onClick={copy} aria-label="نسخ الرابط" title="نسخ الرابط" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#0a84ff] hover:bg-black/5"><Copy size={18} /></button>}
      </div>
      <div className="px-4 pb-4"><button type="button" className={`w-full ${action}`} onClick={() => {
        if (typeof navigator.share !== 'function') { void copy(); return; }
        navigator.share({ title: pageData.name, url }).catch(error => { if (error.name !== 'AbortError') setNotice('تعذرت المشاركة. انسخ الرابط وحاول مجددًا.'); });
      }}>{typeof navigator.share === 'function' ? <><Share2 size={17} />مشاركة الرابط</> : <><Copy size={17} />نسخ الرابط</>}</button></div>
    </Group>

    <Group title="رمز QR">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ececec] bg-white">{qr ? <img src={qr} alt={`رمز QR لصفحة ${pageHost(username)}`} className="h-20 w-20" /> : <QrCode aria-hidden="true" size={32} className="text-[#c7c7cc]" />}</div>
        <div className="min-w-0 flex-1"><p className="text-sm text-[#1d1d1f]">امسحه لفتح صفحتك</p><a aria-disabled={!qr} href={qr || undefined} download={`onwan-${username}-qr${transparent ? '-transparent' : ''}.png`} className={`mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#0a84ff] ${!qr ? 'pointer-events-none opacity-40' : ''}`}><Download size={16} />تحميل PNG</a></div>
      </div>
      <details className="px-4 py-3"><summary className="cursor-pointer text-sm text-[#6e6e73]">تخصيص رمز QR</summary><div className="mt-4 space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm">اللون<input type="color" aria-label="لون الباركود" value={color} onChange={event => setColor(event.target.value)} className="h-10 w-12 cursor-pointer" /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={transparent} onChange={event => setTransparent(event.target.checked)} />تحميل بدون خلفية</label>
        <p className="text-xs leading-6 text-[#737373]">استخدم لونًا داكنًا على خلفية فاتحة ليسهل مسحه.</p>
      </div></details>
    </Group>

    <Group title="Apple Wallet">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#111] text-white"><WalletCards size={18} /></span>
        <div className="min-w-0 flex-1"><p className="text-sm text-[#1d1d1f]">بطاقتك على الجوال</p><p className="mt-0.5 text-xs text-[#737373]">أضفها من iPhone</p></div>
        {walletUrl ? <a href={walletUrl} className="shrink-0 p-1.5" aria-label="إضافة إلى Apple Wallet"><img src="/apple-wallet-add-en.png" alt="Add to Apple Wallet" className="h-12 w-auto" /></a> : <button type="button" disabled={preparing} onClick={prepareCard} aria-label={walletError ? 'إعادة محاولة الإضافة إلى Apple Wallet' : 'إضافة إلى Apple Wallet'} aria-busy={preparing} className="shrink-0 p-1.5 disabled:cursor-wait"><img src="/apple-wallet-add-en.png" alt="Add to Apple Wallet" className="h-12 w-auto" /></button>}
      </div>
      {preparing && <p role="status" className="px-4 pb-3 text-sm text-[#737373]">جارٍ تجهيز البطاقة…</p>}
      {walletError && <p role="alert" className="px-4 pb-3 text-sm text-red-700">{walletError}</p>}
      <details className="px-4 py-3"><summary className="cursor-pointer text-sm text-[#6e6e73]">تخصيص البطاقة</summary>
        <label className="mt-4 flex items-center justify-between text-sm">لون البطاقة<input type="color" aria-label="لون البطاقة" disabled={preparing} value={cardColor} onChange={event => setCardColor(event.target.value)} className="h-10 w-12 cursor-pointer" /></label>
      </details>
    </Group>

    <Group title="Google Wallet">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#f2f2f7] text-[#6e6e73]"><WalletCards size={18} /></span>
        <div className="min-w-0 flex-1"><p className="text-sm text-[#1d1d1f]">بطاقتك على Android</p><p className="mt-0.5 text-xs text-[#737373]">متاحة الآن</p></div>
        <button type="button" disabled={googleBusy} aria-label="إضافة إلى Google Wallet" className="shrink-0 p-2 disabled:opacity-40" onClick={async () => {
          if (googleBusy) return;
          setGoogleBusy(true); setGoogleError(''); setGoogleUrl('');
          try { const link = await requestGoogleWalletLink(cardColor); setGoogleUrl(link); window.location.assign(link); }
          catch (error) { setGoogleError(error instanceof Error ? error.message : 'تعذر تجهيز البطاقة.'); }
          finally { setGoogleBusy(false); }
        }}><img src="/google-wallet-add-ar.svg" alt="إضافة إلى Google Wallet" className="h-12 w-auto max-w-[180px]" /></button>
      </div>
    </Group>

    {googleBusy && <p role="status" className="px-4 text-sm text-[#737373]">جارٍ تجهيز البطاقة…</p>}
    {googleError && <p role="alert" className="px-4 text-sm text-red-700">{googleError}</p>}
    {googleUrl && <a href={googleUrl} className="block px-4 text-sm text-[#0a84ff]">متابعة الإضافة إلى Google Wallet</a>}
    <Group title="جهة الاتصال">
      <SettingsRow icon={ContactRound} tone="bg-[#5856d6]" label={contactBusy ? 'جارٍ تجهيز جهة الاتصال…' : 'حفظ جهة الاتصال'} onClick={() => {
        if (contactBusy) return;
        setContactBusy(true);
        void downloadVCard(pageData).catch(() => setNotice('تعذر حفظ جهة الاتصال. حاول مجددًا.')).finally(() => setContactBusy(false));
      }} />
    </Group>
    {notice && <p role="status" aria-live="polite" className="px-1 text-sm text-[#6e6e73]">{notice}</p>}
  </div>;
}

export function QRCodeDisplay({ username }: { username: string }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="rounded-full border bg-white px-4 py-2 text-sm font-bold">مشاركة</button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto bg-[#f2f2f7] p-0"><DialogTitle className="px-5 pt-5">المشاركة</DialogTitle><SharingPanel username={username} /></DialogContent></Dialog>;
}
