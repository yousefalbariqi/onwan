import '../../styles/nonprofit-quote.css';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import AuthModal from '../components/AuthModal';
import { EmailVerifyChip } from '../components/EmailVerifyChip';
import { NonprofitBuilderPage } from './NonprofitBuilder';
import { usePageContext } from '../context/PageContext';
import { nonprofitCall } from '../lib/api';
import { nonprofitPath, quoteStatus } from '../lib/nonprofit';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';
import { PhonePreview } from '../components/PhonePreview';
import { ArrowRight, Check, ChevronDown, Loader2, LogOut, Pencil, Plus } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';

function Shell({ children, branded = false }: {children: React.ReactNode; branded?: boolean}) {
  const logout = () => { clearSessionToken(); clearLocalAccountData(); window.location.assign(nonprofitPath()); };
  // Note 09: the «عنوان» brand and logo, as on the nonprofit home page.
  if (branded) return <div dir="rtl" className="onwan-quote">
    <header className="quote-header">
      <Link to={nonprofitPath()} aria-label="عنوان — الجمعيات"><OnwanLogo /></Link>
      <nav aria-label="التنقل" className="quote-nav">
        <Link to={nonprofitPath('builder')} className="quote-back"><ArrowRight size={15} aria-hidden="true" />المحرر</Link>
        <button type="button" onClick={logout} className="quote-logout" aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={17} aria-hidden="true" /></button>
      </nav>
    </header>
    <main className="quote-main">{children}</main>
  </div>;
  return <div dir="rtl" className="min-h-screen bg-[#F8F8F6] text-[#111111]" style={{fontFamily:'Cairo, sans-serif'}}><header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 p-6"><Link to={nonprofitPath()} aria-label="عنوان — الجمعيات"><OnwanLogo /></Link>{getSessionToken() && <div className="flex gap-5 text-sm"><Link to={nonprofitPath('builder')}>محرر الجمعية</Link><button onClick={logout}>تسجيل الخروج</button></div>}</header><main className="mx-auto max-w-4xl p-6">{children}</main></div>;
}
export function NonprofitAuth({ mode }: {mode:'signup'|'login'}) {
  return <><Shell><h1>حساب الجمعية</h1></Shell><AuthModal mode={mode} nonprofit /></>;
}
// Note 09: the page behind the password reset card — the same as behind
// sign-in and sign-up, so the three read as one experience.
export function NonprofitAuthBackdrop({ children }: {children: React.ReactNode}) {
  return <><Shell><h1>حساب الجمعية</h1></Shell><div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/25 backdrop-blur-[2px]" role="presentation"><div className="flex min-h-full items-center justify-center px-4 py-6">{children}</div></div></>;
}
// While the account loads: the shape of the editor in soft, pulsing blocks
// instead of a line of text, so the wait reads as the page arriving.
function AccountSkeleton() {
  const block = 'rounded-2xl bg-[#ECEAE5]';
  return <div dir="rtl" className="min-h-screen bg-[#F8F8F6]" role="status" aria-label="جارٍ تحميل حساب الجمعية">
    <div className="mx-auto flex max-w-6xl animate-pulse gap-6 px-4 py-5 motion-reduce:animate-none sm:px-6">
      <div className="hidden w-14 shrink-0 flex-col items-center gap-5 pt-14 lg:flex">{[0,1,2,3,4].map(i => <span key={i} className="h-14 w-14 rounded-full bg-[#ECEAE5]" />)}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex items-center justify-between"><span className={`${block} h-10 w-40`} /><span className={`${block} h-10 w-32 rounded-full`} /></div>
        <div className="flex gap-6">
          <div className="hidden w-[420px] shrink-0 flex-col gap-3 lg:flex"><span className={`${block} h-14`} /><span className={`${block} h-24`} /><span className={`${block} h-14`} /><span className={`${block} h-14`} /></div>
          <div className="flex flex-1 justify-center"><span className="aspect-[390/862] w-full max-w-[300px] rounded-[40px] bg-[#ECEAE5]" /></div>
        </div>
      </div>
    </div>
  </div>;
}
export function NonprofitGate({ children }: {children: React.ReactNode}) {
  const { account, loadingPage, isAuthenticated } = usePageContext();
  if (!isAuthenticated || !getSessionToken()) return <Navigate to={nonprofitPath('login')} replace />;
  if (loadingPage) return <AccountSkeleton />;
  if (!account) return <Shell><p role="alert">تعذر تحميل الحساب. حدّث الصفحة أو سجّل الدخول مجددًا.</p></Shell>;
  if (account.kind !== 'nonprofit') return <Shell><p>هذا الحساب مسجل كحساب عميل عادي. لن نغيّر حسابك أو اشتراكك.</p><a href="https://onwan.link/builder" className="mt-4 inline-block underline">متابعة حسابك في عنوان</a><p className="mt-4">لجمعية جديدة، سجّل الخروج ثم أنشئ حساب جمعية مستقلًا.</p></Shell>;
  return <>{children}</>;
}
// Note 19: designing, saving and the quote request are open from the start;
// publishing waits for a confirmed email and the activation.
function ActivationNotice() {
  return <section className="mt-6 rounded-2xl border border-[#FFD9C4] bg-[#FFF0E8] p-6">
    <h2 className="font-bold">صفحتك جاهزة للتفعيل</h2>
    <p className="mt-2 text-sm leading-7 text-[#3a3a3a]">يمكنك متابعة تصميم صفحتك وحفظ تعديلاتك. لنشر الصفحة، يرجى تأكيد البريد الإلكتروني وإكمال إجراءات التفعيل.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3"><EmailVerifyChip /><Link to={nonprofitPath('builder')} className="text-sm font-bold underline">العودة إلى المحرر</Link></div>
  </section>;
}
export function NonprofitBuilder() {
  return <NonprofitBuilderPage gate={NonprofitGate} />;
}
export function NonprofitQuote() {
  const { pageData, account, save, saving } = usePageContext();
  const [request, setRequest] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const initialized = useRef(false);
  const [wantsDomain, setWantsDomain] = useState(false);
  const [domain, setDomain] = useState('');
  const [form, setForm] = useState({ organizationName: '', contactName: '', phone: '', email: '', notes: '' });
  useEffect(() => {
    if (!account || initialized.current) return;
    initialized.current = true;
    setForm(f => ({ ...f, organizationName: pageData.name || '', phone: account.phone, email: account.email }));
  }, [account, pageData.name]);
  useEffect(() => {
    nonprofitCall().then(r => { setRequest(r.request); setLoaded(true); })
      .catch(e => setError(e.message)).finally(() => setChecking(false));
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current || saving || checking || !loaded || request) return;
    sending.current = true; setBusy(true); setError('');
    try {
      await save();
      const r = await nonprofitCall({ action: 'submit', ...form, customDomain: wantsDomain ? domain.trim() : '' });
      setRequest(r.request);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال الطلب.'); }
    finally { sending.current = false; setBusy(false); }
  };
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));
  return <NonprofitGate><Shell branded>
    <div className="quote-heading">
      <span className="quote-eyebrow">{request ? 'تم الاستلام' : 'الخطوة الأخيرة'}</span>
      <h1>{request ? 'طلبكم وصل.' : 'طلب عرض السعر'}</h1>
    </div>
    {checking ? <p role="status" className="quote-loading"><Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />جارٍ تحميل الطلب…</p> : request ?
      <section className="quote-confirmation" role="status">
        <span className="quote-confirmation-check"><Check size={23} aria-hidden="true" /></span>
        <h2>طلب #{request.request_number} · {quoteStatus[request.status]}</h2>
        <p>سنتواصل معكم بعرض السعر.</p>
        <dl className="quote-receipt">
          <div><dt>الجمعية</dt><dd>{request.organization_name}</dd></div>
          <div><dt>مسؤول التواصل</dt><dd>{request.contact_name}</dd></div>
          <div><dt>الجوال</dt><dd dir="ltr">{request.phone}</dd></div>
          <div><dt>البريد</dt><dd dir="ltr">{request.email}</dd></div>
        </dl>
        {request.notes && <details className="quote-disclosure"><summary>تفاصيل الطلب<ChevronDown size={14} aria-hidden="true" /></summary><p className="whitespace-pre-wrap">{request.notes}</p></details>}
        <p className="quote-caption">التصميم المرفق محفوظ. تعديلاتكم التالية تبقى مسودة. لم يتم النشر أو الدفع.</p>
        {request.email_status === 'failed' && <p className="text-sm text-amber-800">طلبكم محفوظ، وسنعيد محاولة إرسال إشعار البريد.</p>}
        <Link to={nonprofitPath('builder')} className="quote-text-link">العودة إلى المحرر<ArrowRight size={14} aria-hidden="true" /></Link>
      </section> : loaded &&
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy || saving} className="quote-layout">
          <section className="quote-overview" aria-label="ملخص الطلب">
            <div className="quote-design">
              <div className="quote-thumbnail" aria-hidden="true"><PhonePreview interactive={false} /></div>
              <div className="quote-design-info">
                <span className="quote-caption">صفحة جمعيتكم</span>
                <h2>{pageData.name || 'صفحة الجمعية'}</h2>
                <p dir="ltr" className="quote-page-link">{pageData.username}.onwan.link</p>
                <Link to={nonprofitPath('builder')} className="quote-text-link"><Pencil size={12} aria-hidden="true" />تعديل التصميم</Link>
              </div>
            </div>
            <div className="quote-offer">
              <div className="quote-price-row">
                <p className="quote-price"><strong>٤٣٠</strong><span>ريال<small>قيمة الشراء</small></span></p>
                <span className="quote-gift">٣ سنوات استضافة<em>هدية من عنوان</em></span>
              </div>
              <p className="quote-ownership">الرابط لكم. والتجديد للاستضافة فقط.</p>
              <p className="quote-renewal">تجديد سنوي من السنة الرابعة؛ الرسوم في العرض.</p>
            </div>
            <details className="quote-disclosure quote-includes">
              <summary><span>ومعها خدمات مجانية</span><ChevronDown size={14} aria-hidden="true" /></summary>
              <ul className="quote-perks">{['محرر الصفحة', 'رمز QR', 'Apple Wallet', 'التواصل والدعم'].map(service => <li key={service}><Check size={13} aria-hidden="true" />{service}</li>)}</ul>
            </details>
          </section>
          <section className="quote-details" aria-labelledby="quote-details-title">
            <div className="quote-section-heading"><h2 id="quote-details-title">بيانات الطلب</h2><span>جاهزة للمراجعة والتعديل</span></div>
            <div className="quote-fields">
              <label className="quote-field"><span>الجمعية</span><input required maxLength={160} autoComplete="organization" value={form.organizationName} onChange={update('organizationName')} /></label>
              <label className="quote-field"><span>المسؤول</span><input required maxLength={160} autoComplete="name" placeholder="اسم مسؤول التواصل" value={form.contactName} onChange={update('contactName')} /></label>
              <label className="quote-field"><span>الجوال</span><input required type="tel" maxLength={30} autoComplete="tel" dir="ltr" value={form.phone} onChange={update('phone')} /></label>
              <label className="quote-field"><span>البريد</span><input required type="email" maxLength={254} autoComplete="email" dir="ltr" value={form.email} onChange={update('email')} /></label>
            </div>
            <div className="quote-options">
              <label className="quote-domain-choice"><input type="checkbox" checked={wantsDomain} onChange={e => setWantsDomain(e.target.checked)} aria-controls="quote-domain" /><span>أرغب بربط نطاق الجمعية الخاص</span><span className="quote-optional">اختياري</span></label>
              {wantsDomain && <div id="quote-domain" className="quote-domain"><label htmlFor="domain" className="sr-only">نطاق الجمعية الخاص</label><input id="domain" required maxLength={253} value={domain} onChange={e => setDomain(e.target.value)} dir="ltr" placeholder="links.example.org" autoCapitalize="none" spellCheck={false} /><p>يُسعّر ضمن العرض؛ لا يعني حجز النطاق أو ربطه.</p></div>}
              <details className="quote-disclosure quote-notes"><summary><span><Plus size={14} aria-hidden="true" />إضافة ملاحظة</span><span className="quote-optional">اختياري</span></summary><label htmlFor="quote-notes" className="sr-only">ملاحظات للعرض</label><textarea id="quote-notes" maxLength={4000} value={form.notes} onChange={update('notes')} rows={2} placeholder="ما الذي تودّون إضافته؟" /></details>
            </div>
            {error && <p role="alert" className="quote-error">{error}</p>}
            <div className="quote-action"><button disabled={busy || saving} type="submit" className="quote-submit">{busy ? <><Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />جارٍ إرسال الطلب…</> : <>إرسال طلب عرض السعر<ArrowRight size={17} aria-hidden="true" /></>}</button><p>لا دفع الآن، ولا نشر للصفحة.</p></div>
          </section>
        </fieldset>
      </form>}
    {error && (!loaded || request) && <p role="alert" className="quote-error">{error}{!loaded && !checking && <button type="button" onClick={() => window.location.reload()} className="mr-3 underline">إعادة المحاولة</button>}</p>}
    {!checking && request && account && !account.emailVerified && <ActivationNotice />}
  </Shell></NonprofitGate>;
}
