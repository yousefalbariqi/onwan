import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, Copy, CreditCard, Download, ExternalLink, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { pageHost, pageUrl } from '../lib/site';
import { Account, accountCall } from '../lib/api';

const money = (value: number) => `${value.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`;

function cartDetails(searchParams: URLSearchParams) {
  const invoice = searchParams.get('invoice');
  const cart = searchParams.get('cart') ?? '—';
  const rawTotal = Number(searchParams.get('total'));
  const total = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
  return { cart: invoice ?? cart, total, label: invoice ? 'فاتورة التجديد' : 'رقم السلة' };
}

export function DemoPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cart, total, label } = cartDetails(searchParams);

  const { save, setAccount } = usePageContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const completeDemoPayment = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await save();
      const response = await accountCall<{ account: Account; cartNumber?: number }>('payment.demo.confirm', {
        cart, invoice: searchParams.get('invoice'), plan: searchParams.get('plan') ?? 'annual',
      });
      setAccount(response.account);
      const invoice = searchParams.get('invoice');
      const params = new URLSearchParams({ total: String(total) });
      if (invoice) params.set('invoice', invoice);
      else params.set('cart', String(response.cartNumber ?? cart));
      navigate(`/payment/success?${params.toString()}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تفعيل الاشتراك.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-10" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <section className="mx-auto max-w-md overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <div className="bg-gray-950 px-6 py-5 text-white">
          <div className="mb-4 flex items-center justify-between text-xs text-gray-300">
            <span>عنوان</span>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 font-bold text-amber-200">وضع تجريبي</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>بوابة الدفع</h1>
              <p className="mt-1 text-xs text-gray-300">معاينة رحلة الدفع قبل ربط مزوّد الخدمة</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{label}</span>
              <span dir="ltr">#{cart}</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="font-bold text-gray-900">إجمالي الطلب</span>
              <strong className="text-2xl font-black text-gray-950">{money(total)}</strong>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />
            <p>دفع تجريبي دون خصم أي مبلغ: سيتم تفعيل اشتراكك ونشر صفحتك فعليًا.</p>
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            disabled={busy}
            onClick={completeDemoPayment}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {busy ? 'جارٍ تفعيل الاشتراك ونشر الصفحة…' : 'تأكيد الدفع التجريبي والنشر'}
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => navigate('/plan-selection')} className="w-full text-sm font-bold text-gray-500 hover:text-gray-900">
            العودة إلى السلة
          </button>
        </div>
      </section>
    </main>
  );
}

export function DemoPaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pageData } = usePageContext();
  const { cart, total, label } = cartDetails(searchParams);
  const username = pageData.username;
  const publicUrl = username ? pageUrl(username) : '';
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [walletNotice, setWalletNotice] = useState('');

  // A transparent PNG is useful on cards, packaging, and any coloured print.
  useEffect(() => {
    if (!publicUrl) return;

    QRCode.toDataURL(publicUrl, {
      width: 720,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#00000000' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [publicUrl]);

  const copyLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setWalletNotice('تعذر النسخ تلقائيًا؛ انسخ الرابط يدويًا من البطاقة.');
    }
  };

  const showWalletSetup = (wallet: 'Apple Wallet' | 'Google Wallet') => {
    setWalletNotice(`واجهة ${wallet} جاهزة للمعاينة. الإضافة الفعلية ستتفعّل عند إعداد مفاتيح إصدار البطاقة وتوقيعها.`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-10" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <section className="mx-auto max-w-md rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-xl shadow-emerald-950/5">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-11 w-11" strokeWidth={2.5} />
        </div>
        <p className="mt-6 text-sm font-bold text-emerald-700">اكتملت المحاكاة بنجاح</p>
        <h1 className="mt-2 text-2xl font-black text-gray-950" style={{ fontFamily: 'Cairo, sans-serif' }}>تم الدفع التجريبي</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
          تم تفعيل الاشتراك تجريبيًا. لم يتم خصم أي مبلغ.
        </p>

        <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-right text-sm">
          <div className="flex justify-between text-gray-500"><span>{label}</span><span dir="ltr">#{cart}</span></div>
          <div className="mt-3 flex justify-between font-bold text-gray-900"><span>المبلغ المعروض</span><span>{money(total)}</span></div>
          {username && <div className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-500">رابط الصفحة <strong className="mr-1 text-gray-800" dir="ltr">{pageHost(username)}</strong></div>}
        </div>

        {publicUrl && (
          <section className="mt-5 overflow-hidden rounded-3xl bg-gray-950 p-5 text-right text-white shadow-lg shadow-gray-900/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-emerald-300">بطاقتك الرقمية</p>
                <h2 className="mt-1 text-lg font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>{pageData.name || 'صفحتك على عنوان'}</h2>
                <p className="mt-1 text-xs text-gray-400">امسح الرمز أو شارك الرابط مباشرة</p>
              </div>
              <div className="rounded-2xl bg-white p-2">
                {qr ? <img src={qr} alt="رمز QR لصفحتك" className="h-20 w-20" /> : <div className="h-20 w-20 animate-pulse rounded-xl bg-gray-100" />}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-white/10 px-3 py-2.5" dir="ltr">
              <p className="truncate text-xs text-gray-100">{publicUrl}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={copyLink} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-gray-950 transition hover:bg-gray-100">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'تم النسخ' : 'نسخ الرابط'}
              </button>
              {qr && (
                <a href={qr} download={`onwan-${username}-qr.png`} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/25 px-3 py-2.5 text-xs font-black text-white transition hover:bg-white/10">
                  <Download className="h-4 w-4" />
                  تنزيل QR
                </a>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-gray-400">ملف PNG شفاف الخلفية، جاهز للطباعة والتصميم.</p>
          </section>
        )}

        <section className="mt-5 text-right">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <WalletCards className="h-5 w-5 text-emerald-600" />
            أضف بطاقتك إلى المحفظة
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => showWalletSetup('Apple Wallet')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-3 text-sm font-bold text-white transition hover:bg-gray-800">
              <WalletCards className="h-4 w-4" />
              Apple Wallet
            </button>
            <button onClick={() => showWalletSetup('Google Wallet')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 transition hover:bg-gray-50">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Google Wallet
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-500">ستظهر البطاقة في المحفظة مع الاسم والرابط ورمز QR بعد تفعيل خدمة الإصدار.</p>
          {walletNotice && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{walletNotice}</p>}
        </section>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-right text-xs leading-5 text-amber-950">
          هذه عملية تفعيل تجريبية دون تحصيل مالي. تم تسجيل مرجع تجريبي للعملية على الخادم.
        </div>

        <div className="mt-6 grid gap-3">
          <button
            onClick={() => navigate('/preview')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3.5 font-bold text-white"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            معاينة صفحتي
            <ExternalLink className="h-4 w-4" />
          </button>
          <button onClick={() => navigate('/builder')} className="text-sm font-bold text-gray-500 hover:text-gray-900">العودة إلى المحرر</button>
        </div>
      </section>
    </main>
  );
}
