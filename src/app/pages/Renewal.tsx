import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CalendarClock, CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { Account, Plan, accountCall } from '../lib/api';

type RenewalQuote = {
  account: Account;
  plans: { plan: Plan; priceSar: number | null }[];
};

const PLAN_NAMES: Record<Plan, { name: string; period: string }> = {
  monthly: { name: 'اشتراك شهري', period: 'لمدة شهر' },
  annual: { name: 'اشتراك سنوي', period: 'لمدة سنة' },
};

const money = (amount: number) => `${amount.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`;
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString('ar-u-ca-gregory-nu-latn', { dateStyle: 'long' }) : '—');

export default function Renewal() {
  const navigate = useNavigate();
  const { isAuthenticated, loadingPage, setAccount } = usePageContext();
  const [quote, setQuote] = useState<RenewalQuote | null>(null);
  const [plan, setPlan] = useState<Plan>('annual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loadingPage && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loadingPage, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    accountCall<RenewalQuote>('renewal.quote')
      .then((response) => {
        setQuote(response);
        setAccount(response.account);
        setPlan(response.account.subscription?.renewalInvoice?.plan ?? response.account.subscription?.plan ?? 'annual');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل التجديد.'));
  }, [isAuthenticated, setAccount]);

  if (!quote) {
    return (
      <main className="grid min-h-screen place-items-center bg-gray-50 p-4" dir="rtl">
        {error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />}
      </main>
    );
  }

  const subscription = quote.account.subscription;
  if (!subscription) return null;
  const selected = quote.plans.find((item) => item.plan === plan);
  const invoice = subscription.renewalInvoice;

  const submit = async () => {
    try {
      setBusy(true);
      setError('');
      const response = await accountCall('renewal.submit', { plan });
      setAccount(response.account);

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      // Local journey review only. It deliberately never marks the invoice paid.
      navigate(`/payment/demo?${new URLSearchParams({ invoice: String(response.invoiceNumber), total: String(response.total), type: 'renewal' }).toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إصدار فاتورة التجديد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white p-4 sm:p-8" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <section className="mx-auto max-w-2xl">
        <button onClick={() => navigate('/builder')} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-950">
          <ArrowRight className="h-5 w-5" /> العودة إلى المحرر
        </button>

        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
          <header className="border-b border-gray-100 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CalendarClock className="h-6 w-6" /></div>
              <div>
                <p className="text-sm font-bold text-emerald-700">الاشتراك</p>
                <h1 className="mt-1 text-2xl font-black text-gray-950" style={{ fontFamily: 'Cairo, sans-serif' }}>تجديد اشتراكك</h1>
                <p className="mt-2 text-sm text-gray-600">اختر مدتك، ثم انتقل إلى بوابة الدفع الآمنة عند تفعيلها.</p>
              </div>
            </div>
          </header>

          <div className="space-y-5 p-6 sm:p-8">
            <div className={`rounded-2xl border p-4 text-sm ${subscription.status === 'expired' || invoice ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div className="flex items-start gap-3">
                {subscription.status === 'expired' || invoice ? <FileWarning className="mt-0.5 h-5 w-5 flex-none" /> : <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />}
                <div>
                  <strong>{invoice ? `فاتورة تجديد #${invoice.number} بانتظار السداد` : subscription.status === 'expired' ? 'انتهى اشتراكك' : `ينتهي اشتراكك في ${formatDate(subscription.expiresAt)}`}</strong>
                  <p className="mt-1 text-xs leading-5">تبقى بيانات صفحتك محفوظة. لا يمتد الاشتراك إلا بعد تأكيد الدفع.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {quote.plans.map((item) => (
                <button
                  key={item.plan}
                  onClick={() => setPlan(item.plan)}
                  className={`rounded-2xl border-2 p-4 text-right transition ${plan === item.plan ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-black text-gray-950" style={{ fontFamily: 'Cairo, sans-serif' }}>{PLAN_NAMES[item.plan].name}</div><div className="mt-1 text-xs text-gray-500">{PLAN_NAMES[item.plan].period}</div></div>
                    {plan === item.plan && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <div className="mt-4 text-lg font-black text-gray-900">{item.priceSar === null ? 'السعر غير متاح' : money(item.priceSar)}</div>
                </button>
              ))}
            </div>

            {invoice && <div className="rounded-2xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span className="text-gray-500">الفاتورة الحالية</span><strong dir="ltr">#{invoice.number}</strong></div><div className="mt-2 flex justify-between"><span className="text-gray-500">المبلغ</span><strong>{money(invoice.amount)}</strong></div></div>}
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <button disabled={busy || selected?.priceSar === null} onClick={submit} className="w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-lime-500 py-4 text-base font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-50" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {busy ? 'لحظات...' : invoice ? 'تحديث الفاتورة والمتابعة للدفع' : 'إصدار فاتورة التجديد'}
            </button>
            <p className="text-center text-xs text-gray-500">لن تُخصم أي مبالغ قبل ربط بوابة الدفع وتأكيد العملية.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
