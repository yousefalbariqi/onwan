import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Copy, ExternalLink, Loader2, Share2 } from 'lucide-react';
import { accountCall } from '../lib/api';
import { usePageContext } from '../context/PageContext';
import { pageHost, pageUrl } from '../lib/site';
import '../../styles/subscription-checkout.css';

type Result = { state: 'published' | 'published_pending_payment' | 'publication_pending' | 'failed' | 'pending'; demo: boolean; username: string | null; manualPaymentUrl?: string | null; manualInvoiceUrl?: string | null };
export default function PaymentResult() {
  const [params] = useSearchParams();
  const { isAuthenticated, loadingPage } = usePageContext();
  const cart = params.get('cart');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;
    async function check() {
      try {
        const response = await accountCall<Result>('checkout.status', { cart });
        if (!live) return;
        setResult(response); setError('');
        if (response.state === 'pending' && ++checks < 18) timer = setTimeout(check, 5000);
      } catch (problem) { if (live) setError(problem instanceof Error ? problem.message : 'تعذر تأكيد العملية.'); }
    }
    void check(); return () => { live = false; clearTimeout(timer); };
  }, [isAuthenticated, cart, retry]);
  const published = (result?.state === 'published' || result?.state === 'published_pending_payment') && Boolean(result.username);
  const pendingPayment = result?.state === 'published_pending_payment';
  const url = published ? pageUrl(result!.username!) : '';
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setNotice('تعذر النسخ تلقائيًا؛ يمكنك نسخ الرابط الظاهر.'); } }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: 'صفحتي على عنوان', url }); }
    catch (problem) { if ((problem as Error).name !== 'AbortError') setNotice('تعذرت المشاركة؛ يمكنك نسخ الرابط.'); }
  }
  return <main className="subscription-checkout" dir="rtl"><section className="subscription-checkout__container subscription-checkout__result">
    {loadingPage || !result ? <>{error ? <p role="alert">{error}</p> : <><Loader2 className="animate-spin" /><h1>جارٍ تأكيد عملية الدفع</h1></>}</> : published ? <>
      <Check size={42} className="subscription-checkout__success-icon" />
      <h1>{result.demo ? 'تم التفعيل التجريبي' : 'مبروك! صفحتك صارت جاهزة 🎉'}</h1>
      <p>{pendingPayment ? 'صفحتك منشورة وتقدر تشاركها الآن. بنتواصل معك لإرسال فاتورة الاشتراك ورابط الدفع.' : result.demo ? 'تم تفعيل الاشتراك ونشر الصفحة تجريبيًا دون تحصيل أي مبلغ.' : 'تم تفعيل اشتراكك ونشر صفحتك بنجاح.'}</p>
      <p className="subscription-checkout__public-link" dir="ltr">{pageHost(result.username!)}</p>
      {pendingPayment && <p className="subscription-checkout__notice">الاشتراك بانتظار السداد. {result.manualInvoiceUrl && <a href={result.manualInvoiceUrl} target="_blank" rel="noopener noreferrer">عرض الفاتورة</a>} {result.manualPaymentUrl && <a href={result.manualPaymentUrl} target="_blank" rel="noopener noreferrer">رابط الدفع</a>}</p>}
      <div className="subscription-checkout__result-actions"><button type="button" onClick={() => void copy()}><Copy size={17} />{copied ? 'تم النسخ' : 'نسخ الرابط'}</button><button type="button" onClick={() => void share()}><Share2 size={17} />مشاركة الصفحة</button></div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="subscription-checkout__pay"><ExternalLink size={17} />زيارة الصفحة المنشورة</a>
      <Link to="/builder">الانتقال إلى لوحة التحكم</Link>
    </> : result.state === 'publication_pending' ? <><h1>تم تأكيد الدفع</h1><p>لم يكتمل نشر الصفحة بعد. اشتراكك محفوظ؛ لا تحتاج إلى الدفع مرة ثانية. تواصل مع الدعم من لوحة التحكم لمعالجة النشر.</p><Link to="/builder">لوحة التحكم والدعم</Link></> : result.state === 'failed' ? <><h1>لم تكتمل عملية الدفع</h1><p>حسابك وتصميمك محفوظان. يمكنك العودة واختيار وسيلة دفع متاحة.</p><Link to="/plan-selection">العودة للاشتراك</Link></> : <><Loader2 className="animate-spin" /><h1>جارٍ تأكيد عملية الدفع</h1><p>لم يصل تأكيد موثوق من الخادم بعد. لا تعد الدفع ما دامت العملية قيد التحقق.</p><Link to="/builder">الانتقال إلى لوحة التحكم</Link></>}
    {!loadingPage && !isAuthenticated && <Link to="/login">سجّل الدخول للتحقق من عمليتك</Link>}
    {error && result && <p role="alert" className="subscription-checkout__error">{error}</p>}
    {!published && isAuthenticated && <button type="button" className="subscription-checkout__pay" onClick={() => setRetry(value => value + 1)}>التحقق مجددًا</button>}
    {notice && <p role="status">{notice}</p>}
  </section></main>;
}
