import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, LockKeyhole, WalletCards } from 'lucide-react';
import { requestWalletPassLink } from '../lib/api';
import { pageUrl } from '../lib/site';

// A preview of the association's deliverables, not a publication action.
// The server still requires administrative activation for the public page.
export function NonprofitSummaryAssets({ username, published, walletRequest = requestWalletPassLink }: { username: string; published: boolean; walletRequest?: () => Promise<string> }) {
  const [qr, setQr] = useState('');
  const [walletUrl, setWalletUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [walletError, setWalletError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setQr(''); setWalletUrl(''); setQrError(''); setWalletError('');
    if (!username) return;
    QRCode.toDataURL(pageUrl(username), { width: 600, margin: 4, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      .then(value => { if (alive) setQr(value); })
      .catch(() => { if (alive) setQrError('تعذّر تجهيز الباركود.'); });
    // A real anchor is prepared before the tap for iOS Wallet handling.
    walletRequest()
      .then(value => { if (alive) setWalletUrl(value); })
      .catch(() => { if (alive) setWalletError('إضافة البطاقة غير متاحة الآن. حاول مجددًا.'); });
    // Signed download links expire after 30 minutes; refresh before expiry.
    const timer = window.setTimeout(() => setAttempt(value => value + 1), 25 * 60 * 1000);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [username, attempt, walletRequest]);

  if (!username) return <p className="quote-caption">أكمل رابط الصفحة من الإعدادات لعرض الباركود والبطاقة.</p>;
  return <section className="quote-assets" aria-label="الباركود وبطاقة المحفظة">
    <p className="quote-asset-state"><LockKeyhole size={15} aria-hidden="true" />{published ? 'صفحتكم مفعّلة' : 'بانتظار استكمال التفعيل'}</p>
    {qr ? <img className="quote-qr" src={qr} width={180} height={180} alt="باركود رابط صفحة الجمعية" /> : <p role="status">{qrError || 'جارٍ تجهيز الباركود…'}</p>}
    <p className="quote-caption">{published ? 'الباركود يفتح صفحة الجمعية.' : 'الباركود والبطاقة جاهزان للحفظ؛ إتاحة الصفحة العامة بعد استكمال التفعيل.'}</p>
    <div className="quote-asset-actions">
      {qr && <a href={qr} download={`onwan-${username}-qr.png`}><Download size={16} aria-hidden="true" />تنزيل الباركود</a>}
      {walletUrl ? <a className="quote-wallet" href={walletUrl}><WalletCards size={17} aria-hidden="true" />إضافة إلى Apple Wallet</a> : <button type="button" disabled={!walletError} onClick={() => setAttempt(value => value + 1)}><WalletCards size={17} aria-hidden="true" />{walletError ? 'إعادة تجهيز بطاقة Apple Wallet' : 'جارٍ تجهيز بطاقة Apple Wallet…'}</button>}
    </div>
    {walletError && <p role="status" className="quote-caption">{walletError}</p>}
    {qrError && <button type="button" className="quote-text-link" onClick={() => setAttempt(value => value + 1)}>إعادة تجهيز الباركود</button>}
  </section>;
}
