import {useEffect,useState} from 'react';
import {Link} from 'react-router';
import {Check,Copy,ExternalLink,Loader2,Share2} from 'lucide-react';
import {accountCall,type Account} from '../lib/api';
import {usePageContext} from '../context/PageContext';
import {pageHost,pageUrl} from '../lib/site';

type Result={state:string;username:string|null;paymentConfirmed:boolean;sandbox:boolean;account?:Account};
export default function PaddlePaymentResult({order}:{order:string}) {
  const {isAuthenticated,loadingPage,pageData,setAccount}=usePageContext();
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [delayed,setDelayed]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!isAuthenticated) return;
    let live=true,timer:ReturnType<typeof setTimeout>|undefined;
    const started=Date.now();
    async function check() {
      try {
        const next=await accountCall<Result>('paddle.checkout.status',{order});
        if(!live) return;
        setResult(next);setError('');
        if(next.account) setAccount(next.account);
        if(next.state==='published' || next.state==='not_found') return;
      } catch(problem) {if(live) setError(problem instanceof Error?problem.message:'تعذر التحقق الآن.');}
      if(!live) return;
      const elapsed=Date.now()-started;
      setDelayed(elapsed>=20000);
      // Fast early feedback, then quieter checks. Stop after two minutes; manual check remains available.
      if(elapsed<120000) timer=setTimeout(check,elapsed<15000?1500:5000);
    }
    void check();
    return()=>{live=false;clearTimeout(timer);};
  },[isAuthenticated,order,retry,setAccount]);
  const published=result?.state==='published' && Boolean(result.username);
  const url=published?pageUrl(result!.username!):'';
  async function share(copyOnly=false) {
    try {
      if(!copyOnly && navigator.share) await navigator.share({title:'صفحتي على عنوان',url});
      else {await navigator.clipboard.writeText(url);setNotice('تم نسخ الرابط');}
    } catch(problem) {if((problem as Error).name!=='AbortError') setNotice('تعذرت المشاركة؛ يمكنك نسخ الرابط الظاهر.');}
  }
  return <main className="subscription-checkout" dir="rtl"><section className="subscription-checkout__container subscription-checkout__result" aria-labelledby="paddle-result-title">
    {loadingPage ? <p role="status">جارٍ تحميل حسابك…</p> : !isAuthenticated ? <><h1 id="paddle-result-title">تابع حالة طلبك</h1><p>تفعيل الطلب يستمر حتى لو أغلقت هذه الصفحة.</p><Link to={`/login?redirect=${encodeURIComponent(`/payment/success?order=${order}`)}`}>سجّل الدخول للتحقق</Link></> : <>
      <div role="status" aria-live="polite" aria-atomic="true">
        {published ? <><Check size={42} className="subscription-checkout__success-icon"/><h1 id="paddle-result-title">صفحتك جاهزة</h1><p>تفعّل اشتراكك ونُشرت صفحتك. شاركها الآن.</p></> : result?.state==='not_found' ? <><h1 id="paddle-result-title">لم نجد هذا الطلب في حسابك</h1><p>راجع حسابك أو تواصل مع الدعم. لا تُعد الدفع إذا سبق أن أكملته.</p></> : <>
          <Loader2 size={36} className="payment-activation-spinner" aria-hidden="true"/>
          <h1 id="paddle-result-title">{result?.paymentConfirmed?'تم الدفع، نجهّز صفحتك':'نتحقق من تأكيد الدفع'}</h1>
          <p>{result?.state==='publication_failed'?'دفعك محفوظ، لكن تجهيز الصفحة يحتاج وقتًا إضافيًا. سنعيد المحاولة تلقائيًا؛ لا تحتاج للدفع مرة ثانية.':delayed?'تأكيد طلبك يأخذ وقتًا أطول من المعتاد. تقدر تغادر وترجع لاحقًا؛ سنكمل التفعيل في الخلفية.':result?.paymentConfirmed?'وصل تأكيد الدفع. نفعّل اشتراكك ونجهّز رابط صفحتك للمشاركة.':'نتابع تأكيد الدفع وتجهيز صفحتك تلقائيًا. لا تحتاج إلى تحديث الصفحة أو إعادة الدفع.'}</p>
        </>}
      </div>
      {!published && result?.state!=='not_found' && <>
        <div className="payment-activation-preview">{pageData.profileImage && <img src={pageData.profileImage} alt=""/>}<strong>{pageData.name || 'صفحتك على عنوان'}</strong><span>تصميمك محفوظ</span></div>
        <ol className="payment-activation-steps" aria-label="حالة تجهيز الصفحة">
          <li data-complete="true"><Check size={16}/>حفظ التصميم</li>
          <li data-complete={Boolean(result?.paymentConfirmed)}>{result?.paymentConfirmed?<Check size={16}/>:<span className="payment-step-dot"/>}تأكيد الدفع</li>
          <li><span className="payment-step-dot"/>تفعيل الاشتراك ونشر الصفحة</li>
        </ol>
      </>}
      {result?.sandbox && <p className="subscription-checkout__muted">تمت هذه العملية في بيئة Paddle التجريبية دون تحصيل حقيقي.</p>}
      {published && <><p className="subscription-checkout__public-link" dir="ltr">{pageHost(result!.username!)}</p>
        <a className="subscription-checkout__pay" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>افتح صفحتي</a>
        <div className="subscription-checkout__result-actions"><button type="button" onClick={()=>void share(true)}><Copy size={17}/>انسخ الرابط</button><button type="button" onClick={()=>void share()}><Share2 size={17}/>مشاركة</button></div></>}
      {error && <p role="alert" className="subscription-checkout__error">{error} لا تُعد الدفع؛ يمكنك التحقق مجددًا.</p>}
      {!published && <button type="button" className="subscription-checkout__pay" onClick={()=>{setDelayed(false);setRetry(value=>value+1);}}>التحقق من الحالة</button>}
      <Link to="/builder">{published?'العودة إلى لوحة التحكم':'متابعة العمل من لوحة التحكم'}</Link>
      {notice && <p role="status">{notice}</p>}
    </>}
  </section></main>;
}
