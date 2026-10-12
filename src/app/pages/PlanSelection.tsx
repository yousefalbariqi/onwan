import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { Plan, fetchSubscription, startCheckout } from '../lib/api';

const PLAN_LABELS: Record<Plan, { name: string; period: string }> = {
  monthly: { name: 'اشتراك شهري', period: 'شهريًا' },
  annual: { name: 'اشتراك سنوي', period: 'سنويًا' },
};

// SUB-01: monthly or annual, same features and storage; payment is the
// condition for the first publish. Prices come from the server (PAY-01).
export default function PlanSelection() {
  const navigate = useNavigate();
  const { account, setAccount, isAuthenticated, loadingPage } = usePageContext();
  const [plans, setPlans] = useState<{ plan: Plan; priceSar: number | null }[]>([]);
  const [selected, setSelected] = useState<Plan>('annual');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [awaitingGateway, setAwaitingGateway] = useState(false);

  useEffect(() => {
    if (!loadingPage && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loadingPage, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchSubscription()
      .then((response) => {
        setPlans(response.plans);
        setAccount(response.account);
        if (response.account.subscription) {
          setSelected(response.account.subscription.plan);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل الباقات.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, setAccount]);

  const subscription = account?.subscription;
  const isActive = subscription?.status === 'active';

  const handleCheckout = async () => {
    try {
      setError('');
      setSubmitting(true);
      const response = await startCheckout(selected);
      setAccount(response.account);

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      setAwaitingGateway(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر بدء عملية الدفع.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col" dir="rtl">
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/builder')} className="text-gray-600 hover:text-gray-800 transition-colors" title="العودة للمحرر">
            <ArrowRight className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الاشتراك والنشر
          </h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-emerald-100">
          {loading ? (
            <div className="mx-auto h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin"></div>
          ) : isActive ? (
            <div className="text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                اشتراكك فعّال
              </h2>
              <p className="text-gray-600">{PLAN_LABELS[subscription.plan].name}. تفاصيل الاشتراك في تبويب «الحساب» داخل المحرر.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                اختر مدة الاشتراك
              </h2>
              <p className="text-sm text-gray-500 mb-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                نفس المزايا ومساحة التخزين في الخيارين. تُنشر صفحتك للجمهور بعد تأكيد الدفع.
              </p>

              <div className="space-y-3 mb-6">
                {plans.map(({ plan, priceSar }) => (
                  <button
                    key={plan}
                    onClick={() => setSelected(plan)}
                    className={`w-full rounded-2xl border-2 p-4 flex items-center justify-between transition-all ${
                      selected === plan ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {PLAN_LABELS[plan].name}
                    </span>
                    <span className="text-sm text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                      {priceSar === null ? 'يُعلن السعر قريبًا' : `${priceSar} ريال ${PLAN_LABELS[plan].period}`}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  {error}
                </div>
              )}

              {awaitingGateway || subscription?.status === 'pending_payment' ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>
                    سُجّل اختيارك ({PLAN_LABELS[subscription?.plan ?? selected].name}) وهو بانتظار الدفع. الدفع الإلكتروني غير مفعّل بعد؛
                    ستُنشر صفحتك فور تأكيد الدفع. يمكنك متابعة تجهيز الصفحة في المحرر.
                  </span>
                </div>
              ) : null}

              <button
                onClick={handleCheckout}
                disabled={submitting || plans.length === 0}
                className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {submitting ? 'لحظات...' : 'المتابعة إلى الدفع'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                الدفع بالريال السعودي عبر بوابة الدفع الإلكترونية.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
