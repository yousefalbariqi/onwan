import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { accountCall, type Account } from '../lib/api';
import { pageHost } from '../lib/site';
import type { subscriptionCheckoutPolicy } from '../../../shared/subscriptionCheckout';
import '../../styles/subscription-checkout.css';
import PaddleSandboxCheckout from '../components/PaddleSandboxCheckout';
import { paddleSandboxRequested } from '../lib/paddleSandbox';

type Quote = { checkout: ReturnType<typeof subscriptionCheckoutPolicy>; account: Account; demoPrices?: boolean; cart?: { cart_number: number; plan: string; total: number; design_price: number | null; nfc_quantity: number; custom_domain: string | null; discount_code?: string | null } | null };
export const checkoutMoney = (value: number) => `${value.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`;

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const { pageData, isAuthenticated, loadingPage, setAccount, saveDraft } = usePageContext();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  useEffect(() => { if (!loadingPage && !isAuthenticated) navigate('/login', { replace: true }); }, [loadingPage, isAuthenticated, navigate]);
  useEffect(() => {
    if (!isAuthenticated) return;
    let live = true; setError('');
    accountCall<Quote>('cart.quote').then(result => { if (!live) return; setQuote(result); setAccount(result.account); }).catch(problem => { if (live) setError(problem.message); });
    return () => { live = false; };
  }, [isAuthenticated, attempt, setAccount]);
  const policy = quote?.checkout;
  const active = quote?.account.subscription?.status === 'active' && Boolean(quote.account.subscription.expiresAt && new Date(quote.account.subscription.expiresAt) > new Date());
  const extras = Boolean(quote?.cart && (quote.cart.plan !== 'annual' || quote.cart.design_price !== null || quote.cart.nfc_quantity > 0 || quote.cart.custom_domain || quote.cart.discount_code || quote.cart.total !== policy?.total));
  const canPay = Boolean(policy?.paymentConfigured && policy.total !== null && policy.methods.some(item => item.id === method) && !active && !extras && pageData.username);
  const canPublish = Boolean(policy?.manualPublication && policy.total !== null && !active && !extras && pageData.username);
  async function pay() {
    if ((!canPay && !canPublish) || running.current || !policy) return;
    running.current = true; setBusy(true); setError('');
    try {
      await saveDraft();
      const result = await accountCall<{ checkoutUrl?: string; state?: string; cartNumber?: number }>(canPublish ? 'checkout.publish' : 'checkout.start', { plan: 'annual', method, expectedTotal: policy.total });
      if (result.checkoutUrl) {
        const target = new URL(result.checkoutUrl); if (target.protocol !== 'https:') throw new Error('تعذر فتح رابط دفع آمن.');
        window.location.assign(target.href);
      } else if (result.cartNumber) window.location.assign(`/payment/success?cart=${encodeURIComponent(result.cartNumber)}`);
      else throw new Error('تعذر بدء الدفع. لم يتم تأكيد أي عملية.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر بدء الدفع.'); }
    finally { running.current = false; setBusy(false); }
  }
  if (paddleSandboxRequested(import.meta.env) && quote?.account.kind !== 'nonprofit') {
    return <PaddleSandboxCheckout ready={Boolean(quote && isAuthenticated && !loadingPage)} email={quote?.account.email}
      features={policy?.features ?? []} loadError={error} retry={() => setAttempt(value => value + 1)} saveDraft={saveDraft} />;
  }
  return <main className="subscription-checkout" dir="rtl"><div className="subscription-checkout__container">
    <button type="button" className="subscription-checkout__back" onClick={() => navigate('/builder')} aria-label="الرجوع إلى المصمم"><ArrowRight size={22} /></button>
    <header><h1>فعّل صفحتك</h1><p>باقي خطوة واحدة وتكون صفحتك جاهزة للنشر</p></header>
    {!policy ? <div role="status" className="subscription-checkout__loading">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></> : <><Loader2 className="animate-spin" />جارٍ تحميل الاشتراك…</>}</div> : <section className="subscription-checkout__card" aria-label="اشتراك عنوان السنوي">
      <h2>اشتراك عنوان السنوي</h2>
      <p className="subscription-checkout__price">{policy.monthlyEquivalent === null ? 'السعر غير متاح' : checkoutMoney(policy.monthlyEquivalent)}{policy.monthlyEquivalent !== null && <span> / شهريًا</span>}</p>
      <p className="subscription-checkout__annual">{policy.total === null ? 'سيظهر الإجمالي عند تحديد السعر' : `تُدفع ${checkoutMoney(policy.total)} مرة واحدة سنويًا`}</p>
      <p className="subscription-checkout__muted">اشتراك لمدة سنة كاملة · السعر الشهري معادل للاشتراك السنوي، وليس دفعة شهرية.</p>
      {quote?.demoPrices && <p className="subscription-checkout__notice">السعر المعروض تجريبي ولم يُعتمد للتحصيل.</p>}
      <ul className="subscription-checkout__features">{policy.features.map(feature => <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
      <p className="subscription-checkout__muted">ربط نطاق خاص متاح كخدمة إضافية، ولا يشمل هذا الاشتراك رسوم ربطه.</p>
      <div className="subscription-checkout__payment"><h3>إكمال الاشتراك</h3>
        {policy.paymentConfigured && policy.methods.length ? <div role="radiogroup" aria-label="طريقة الدفع" className="subscription-checkout__methods">{policy.methods.map(item => <button type="button" role="radio" key={item.id} aria-checked={method === item.id} onClick={() => setMethod(item.id)}>{item.label}{method === item.id && <Check size={16} />}</button>)}</div> : <p className="subscription-checkout__notice">انشر صفحتك الآن، وبنتواصل معك لإرسال الفاتورة ورابط الدفع.</p>}
      </div>
      {active && <p role="status" className="subscription-checkout__notice">اشتراكك فعّال بالفعل. <Link to="/builder">الانتقال إلى لوحة التحكم</Link></p>}
      {extras && <p className="subscription-checkout__notice">لديك سلة سابقة تحتوي خيارات إضافية. <Link to="/plan-selection?extras=1">مراجعة السلة الحالية</Link></p>}
      <div className="subscription-checkout__total"><span>قيمة الاشتراك السنوي</span><strong>{policy.total === null ? '—' : checkoutMoney(policy.total)}</strong></div>
      <p className="subscription-checkout__muted">جميع الأسعار شاملة ضريبة القيمة المضافة.</p>
      {pageData.username && <p className="subscription-checkout__link" dir="ltr">{pageHost(pageData.username)}</p>}
      {error && <p role="alert" className="subscription-checkout__error">{error}</p>}
      <button type="button" className="subscription-checkout__pay" disabled={(!canPay && !canPublish) || busy} onClick={() => void pay()}>{busy ? 'جارٍ نشر صفحتك…' : policy.total === null ? 'النشر غير متاح حاليًا' : canPublish ? 'انشر صفحتي' : `ادفع الآن ${checkoutMoney(policy.total)}`}</button>
      <p className="subscription-checkout__legal">الدفع عبر رابط يرسله لك فريق عنوان. لا يوجد خصم تلقائي أو تحصيل في هذه الخطوة.</p>
      <p className="subscription-checkout__legal">بالنشر، تؤكد طلب الاشتراك بالقيمة المعروضة. <Link to="/terms">الشروط والأحكام</Link> و<Link to="/privacy">سياسة الخصوصية</Link>.</p>
    </section>}
  </div></main>;
}
