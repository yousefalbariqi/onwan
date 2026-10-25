import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import AuthModal from '../components/AuthModal';
import { EmailVerifyChip } from '../components/EmailVerifyChip';
import { NonprofitBuilderPage } from './NonprofitBuilder';
import { usePageContext } from '../context/PageContext';
import { accountCall, nonprofitCall } from '../lib/api';
import { nonprofitPath, quoteStatus } from '../lib/nonprofit';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';

function Shell({ children }: {children: React.ReactNode}) {
  const logout = () => { clearSessionToken(); clearLocalAccountData(); window.location.assign(nonprofitPath()); };
  return <div dir="rtl" className="min-h-screen bg-[#faf9f6] text-[#173c36]" style={{fontFamily:'Cairo, sans-serif'}}><header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 p-6"><Link to={nonprofitPath()}>عنوان · الجمعيات الخيرية</Link>{getSessionToken() && <div className="flex gap-5 text-sm"><Link to={nonprofitPath('builder')}>محرر الجمعية</Link><button onClick={logout}>تسجيل الخروج</button></div>}</header><main className="mx-auto max-w-4xl p-6">{children}</main></div>;
}
export function NonprofitAuth({ mode }: {mode:'signup'|'login'}) {
  return <><Shell><h1>حساب الجمعية</h1></Shell><AuthModal mode={mode} nonprofit /></>;
}
export function NonprofitGate({ children }: {children: React.ReactNode}) {
  const { account, loadingPage, isAuthenticated } = usePageContext();
  if (!isAuthenticated || !getSessionToken()) return <Navigate to={nonprofitPath('login')} replace />;
  if (loadingPage) return <Shell>جارٍ تحميل حساب الجمعية…</Shell>;
  if (!account) return <Shell><p role="alert">تعذر تحميل الحساب. حدّث الصفحة أو سجّل الدخول مجددًا.</p></Shell>;
  if (account.kind !== 'nonprofit') return <Shell><p>هذا الحساب مسجل كحساب عميل عادي. لن نغيّر حسابك أو اشتراكك.</p><a href="https://onwan.link/builder" className="mt-4 inline-block underline">متابعة حسابك في عنوان</a><p className="mt-4">لجمعية جديدة، سجّل الخروج ثم أنشئ حساب جمعية مستقلًا.</p></Shell>;
  return <>{children}</>;
}
// Note 22 / 23: the link card, shown on the quote page now that there is no account page.
function LinkCard() {
  const { account, pageData, setAccount, updatePageData } = usePageContext();
  // Note 22: the suggested link can be changed until it is fixed; the Arabic name is untouched.
  const [linkName,setLinkName] = useState('');
  const [linkBusy,setLinkBusy] = useState(false);
  const [linkMsg,setLinkMsg] = useState('');
  const changeLink = async () => {
    setLinkBusy(true); setLinkMsg('');
    try { const r = await accountCall('name.change', { username: linkName }); setAccount(r.account); updatePageData({ username: r.username }); setLinkName(''); setLinkMsg('تم تغيير الرابط.'); }
    catch (e) { setLinkMsg(e instanceof Error ? e.message : 'تعذر تغيير الرابط.'); }
    finally { setLinkBusy(false); }
  };
  return <section className="mt-6 rounded-2xl border bg-white p-6">        <h2 className="font-bold">رابط الصفحة</h2>
        <p className="mt-3 text-sm" dir="ltr" style={{textAlign:'right'}}>{pageData.username}.onwan.link</p>
        {account?.nameFixed ? <p className="mt-2 text-sm text-[#6c8050]">الرابط مثبّت. لتغييره تواصلوا مع الإدارة.</p> : <>
          <p className="mt-1 text-sm text-[#6c8050]">رابط مقترح من اسم الجمعية، ويمكن تعديله قبل اعتماده.</p>
          <div className="mt-3 flex flex-wrap gap-2"><input value={linkName} onChange={e=>setLinkName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} maxLength={30} placeholder="الرابط الجديد بالإنجليزية" dir="ltr" className="min-w-0 flex-1 rounded-xl border p-3" /><button type="button" disabled={!linkName||linkBusy} onClick={changeLink} className="rounded-xl bg-[#173c36] px-5 py-3 text-white disabled:opacity-50">{linkBusy?'جارٍ التغيير…':'تغيير الرابط'}</button></div>
        </>}
        {linkMsg && <p role="status" className="mt-2 text-sm">{linkMsg}</p>}
      </section>;
}
export function NonprofitBuilder() {
  return <NonprofitBuilderPage gate={NonprofitGate} />;
}
export function NonprofitQuote() {
  const { pageData, account, save, saving }=usePageContext();
  const [request,setRequest]=useState<any>(null);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({organizationName:'',contactName:'',notes:''});
  useEffect(()=>{ nonprofitCall().then(r=>setRequest(r.request)).catch(e=>setError(e.message)).finally(()=>setChecking(false)); },[]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await save();const r=await nonprofitCall({action:'submit',...form});setRequest(r.request);}catch(e){setError(e instanceof Error?e.message:'تعذر إرسال الطلب.');}finally{setBusy(false);}};
  return <NonprofitGate><Shell><h1 className="text-2xl font-bold">{request?'طلب عرض السعر':'تأكيد طلب عرض السعر'}</h1>{checking?<p className="mt-5">جارٍ تحميل الطلب…</p>:request?<section className="mt-6 space-y-4 rounded-2xl border bg-white p-6"><p className="font-bold">طلب #{request.request_number} · {quoteStatus[request.status]}</p><p>{request.organization_name}</p><p>سنتواصل معكم عبر هاتف الحساب وبريده لتقديم العرض يدويًا.</p><p className="text-sm leading-7">تم تثبيت نسخة التصميم المرفقة بالطلب. تعديلاتكم اللاحقة تبقى مسودة ولا تغير الطلب المقدم.</p>{request.email_status==='failed' && <p className="text-sm text-amber-800">طلبكم محفوظ في الإدارة، لكن إشعار البريد لم يصل بعد. ستُعاد محاولته.</p>}</section>:!account?.emailVerified?<section className="mt-6 space-y-4 rounded-2xl border bg-white p-6"><ol className="flex flex-wrap gap-2 text-sm"><li className="rounded-full bg-[#e8eee2] px-3 py-1">١ · التصميم محفوظ ✓</li><li className="rounded-full bg-[#173c36] px-3 py-1 text-white">٢ · تأكيد البريد</li><li className="rounded-full border px-3 py-1 text-[#6c8050]">٣ · طلب عرض السعر</li></ol><p className="leading-8">قبل طلب عرض السعر، أكّدوا بريدكم الإلكتروني <span dir="ltr">{account?.email}</span>. تصميمكم محفوظ في حساب الجمعية ولن يتغير، ولن تُنشر الصفحة بتأكيد البريد.</p><EmailVerifyChip /></section>:<form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border bg-white p-6"><p className="leading-8">سنرسل نسخة التصميم المحفوظة للإدارة. هذا طلب عرض سعر؛ لا ينشر صفحتكم ولا يتطلب دفعًا الآن.</p><label className="block">اسم الجمعية<input required maxLength={160} value={form.organizationName} placeholder={pageData.name || 'اسم الجمعية'} onChange={e=>setForm({...form,organizationName:e.target.value})} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block">اسم مسؤول التواصل<input required maxLength={160} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})} className="mt-2 w-full rounded-xl border p-3" /></label><div className="rounded-xl bg-gray-50 p-4 text-sm leading-8"><p>هاتف التواصل: <span dir="ltr">{account?.phone}</span></p><p>البريد: <span dir="ltr">{account?.email}</span></p></div><label className="block">ملاحظات للعرض (اختياري)<textarea maxLength={4000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-2 w-full rounded-xl border p-3" rows={3}/></label><button disabled={busy||saving} className="rounded-xl bg-[#173c36] px-6 py-4 text-white disabled:opacity-50">{busy?'جارٍ حفظ التصميم وإرسال الطلب…':'تأكيد طلب عرض السعر'}</button></form>}{error && <p role="alert" className="mt-5 text-red-700">{error}</p>}<LinkCard /><Link className="mt-6 inline-block underline" to={nonprofitPath('builder')}>العودة إلى المحرر والمعاينة</Link></Shell></NonprofitGate>;
}
