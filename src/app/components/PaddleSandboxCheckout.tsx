import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import type { Paddle } from '@paddle/paddle-js';
import { loadSandbox, sandboxConfig, sandboxPrice, subscribeToSandbox } from '../lib/paddleSandbox';

type Props = { ready: boolean; email?: string; features: string[]; loadError?: string; retry: () => void; saveDraft: () => Promise<unknown> };

// Sandbox UI only: never calls publication, activation, or payment confirmation.
export default function PaddleSandboxCheckout({ ready, email, features, loadError, retry, saveDraft }: Props) {
  const navigate = useNavigate();
  const [price, setPrice] = useState<ReturnType<typeof sandboxPrice> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState(false);
  const [completed, setCompleted] = useState(false);
  const paddle = useRef<Paddle | null>(null);
  const running = useRef(false);
  const opened = useRef(false);

  useEffect(() => subscribeToSandbox(event => {
    if (!opened.current) return;
    if (event.name === 'checkout.completed') { setCompleted(true); setOpening(false); }
    if (event.name === 'checkout.loaded') setOpening(false);
    if (event.name === 'checkout.closed') { opened.current = false; setOpening(false); }
    if (event.name === 'checkout.error' || event.name === 'checkout.payment.error' || event.name === 'checkout.payment.failed') {
      setOpening(false);
      setError('تعذر إتمام الدفع التجريبي. تحقق من إعدادات Sandbox ورابط الدفع الافتراضي في Paddle، ثم حاول مجددًا.');
    }
  }), []);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setError(''); setPrice(null); paddle.current = null;
    const run = async () => {
      const config = sandboxConfig(import.meta.env);
      const client = await loadSandbox(config);
      // No invented country code: Paddle detects the visitor's location.
      const result = sandboxPrice(await client.PricePreview({ items: [{ priceId: config.priceId, quantity: 1 }] }), config.priceId);
      if (live) { paddle.current = client; setPrice(result); }
    };
    void run().catch(problem => { if (live) setError(problem instanceof Error ? problem.message : 'تعذر تحميل السعر التجريبي.'); });
    return () => { live = false; };
  }, [ready, attempt]);

  useEffect(() => {
    if (!opening) return;
    const timeout = window.setTimeout(() => {
      setOpening(false);
      setError('لم تفتح نافذة الدفع. تحقق من اتصالك ورابط الدفع الافتراضي في إعدادات Paddle، ثم أعد المحاولة.');
    }, 20000);
    return () => window.clearTimeout(timeout);
  }, [opening]);

  async function pay() {
    if (!price || !paddle.current || running.current || opening || completed) return;
    running.current = true; setOpening(true); setError('');
    try {
      const config = sandboxConfig(import.meta.env);
      await saveDraft();
      opened.current = true;
      paddle.current.Checkout.open({
        items: [{ priceId: config.priceId, quantity: 1 }],
        ...(email ? { customer: { email, ...(price.address ? { address: price.address } : {}) } } : {}),
        settings: { displayMode: 'overlay', variant: 'one-page', showAddDiscounts: false, showAddTaxId: false, ...(email ? { allowLogout: false } : {}) },
      });
    } catch (problem) {
      opened.current = false; setOpening(false);
      setError(problem instanceof Error ? problem.message : 'تعذر فتح الدفع التجريبي.');
    } finally { running.current = false; }
  }

  return <main className="subscription-checkout" dir="rtl"><div className="subscription-checkout__container">
    <button type="button" className="subscription-checkout__back" onClick={() => navigate('/builder')} aria-label="الرجوع إلى المصمم"><ArrowRight size={22} /></button>
    <header><h1>جرّب الدفع</h1><p>اشتراك عنوان السنوي · بيئة Sandbox</p></header>
    <section className="subscription-checkout__card" aria-label="تجربة دفع اشتراك عنوان">
      <p className="subscription-checkout__notice">تجربة فقط — لا تحصيل حقيقي ولا نشر للصفحة أو تفعيل للاشتراك.</p>
      <h2>اشتراك عنوان السنوي</h2>
      {price ? <><p className="subscription-checkout__price" dir="auto">{price.total}</p><p className="subscription-checkout__annual">دفعة سنوية · العملة {price.currency}</p><p className="subscription-checkout__muted">هذا سعر الاختبار من Paddle، وليس سعر الإطلاق بالريال. قد يتحدث الإجمالي عند تغيير بلد الفوترة داخل نافذة الدفع.</p></> : !error && !loadError && <p role="status" className="subscription-checkout__loading"><Loader2 className="animate-spin" />جارٍ تحميل السعر التجريبي…</p>}
      <ul className="subscription-checkout__features">{features.map(feature => <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
      {(error || loadError) && <div role="alert" className="subscription-checkout__error"><p>{error || loadError}</p><button type="button" onClick={() => { retry(); setAttempt(value => value + 1); }}>إعادة المحاولة</button></div>}
      {completed ? <div role="status" className="subscription-checkout__notice">انتهت خطوة الدفع في نافذة Sandbox. هذه النتيجة لا تؤكد السداد على خادم عنوان ولا تفعّل الاشتراك. <Link to="/builder">العودة للمصمم</Link></div> : <button type="button" className="subscription-checkout__pay" disabled={!ready || !price || opening || Boolean(loadError)} onClick={() => void pay()}>{opening ? 'جارٍ فتح Paddle…' : price ? `جرّب الدفع ${price.total}` : 'بانتظار السعر التجريبي'}</button>}
    </section>
  </div></main>;
}
