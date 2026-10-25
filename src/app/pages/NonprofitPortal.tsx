import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import AuthModal from '../components/AuthModal';
import Builder from './Builder';
import { usePageContext } from '../context/PageContext';
import { nonprofitCall } from '../lib/api';
import { nonprofitPath, quoteStatus } from '../lib/nonprofit';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';

function Shell({ children }: {children: React.ReactNode}) {
  const logout = () => { clearSessionToken(); clearLocalAccountData(); window.location.assign(nonprofitPath()); };
  return <div dir="rtl" className="min-h-screen bg-[#faf9f6] text-[#173c36]" style={{fontFamily:'Cairo, sans-serif'}}><header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 p-6"><Link to={nonprofitPath()}>عنوان · الجمعيات الخيرية</Link>{getSessionToken() && <div className="flex gap-5 text-sm"><Link to={nonprofitPath('account')}>حساب الجمعية</Link><button onClick={logout}>تسجيل الخروج</button></div>}</header><main className="mx-auto max-w-4xl p-6">{children}</main></div>;
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
export function NonprofitAccount() {
  const [request,setRequest] = useState<any>(null);
  const [error,setError] = useState('');
  useEffect(()=>{ nonprofitCall().then(r=>setRequest(r.request)).catch(e=>setError(e.message)); },[]);
  return <NonprofitGate><Shell><h1 className="text-3xl font-bold">أهلًا بجمعيتكم</h1><p className="mt-4 leading-8">صمّموا الصفحة وشاهدوا المعاينة السريعة، ثم أرسلوا طلب عرض السعر. الصفحة غير منشورة حتى تفعيل الإدارة.</p>{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}{request && <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">طلب عرض السعر #{request.request_number}</h2><p className="mt-3">{quoteStatus[request.status]}</p><p className="mt-3 text-sm leading-7">نتواصل معكم عبر الهاتف والبريد لتقديم العرض يدويًا. لا يتم التحصيل أو التفعيل من هذه الصفحة.</p></section>}<div className="mt-8 flex flex-wrap gap-4"><Link className="rounded-xl bg-[#173c36] px-6 py-4 text-white" to={nonprofitPath('builder')}>فتح المحرر</Link><Link className="rounded-xl border px-6 py-4" to={nonprofitPath('quote')}>{request?'عرض حالة الطلب':'طلب عرض سعر'}</Link></div></Shell></NonprofitGate>;
}
export function NonprofitBuilder() {
  const navigate=useNavigate();
  return <NonprofitGate><Builder staffEdit={{ title:'تصميم الجمعية — معاينة خاصة', onExit:()=>navigate(nonprofitPath('account')), onContinue:()=>navigate(nonprofitPath('quote')), continueLabel:'التالي · طلب عرض سعر', exitLabel:'العودة إلى حساب الجمعية' }} /></NonprofitGate>;
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
  return <NonprofitGate><Shell><h1 className="text-2xl font-bold">{request?'طلب عرض السعر':'تأكيد طلب عرض السعر'}</h1>{checking?<p className="mt-5">جارٍ تحميل الطلب…</p>:request?<section className="mt-6 space-y-4 rounded-2xl border bg-white p-6"><p className="font-bold">طلب #{request.request_number} · {quoteStatus[request.status]}</p><p>{request.organization_name}</p><p>سنتواصل معكم عبر هاتف الحساب وبريده لتقديم العرض يدويًا.</p><p className="text-sm leading-7">تم تثبيت نسخة التصميم المرفقة بالطلب. تعديلاتكم اللاحقة تبقى مسودة ولا تغير الطلب المقدم.</p>{request.email_status==='failed' && <p className="text-sm text-amber-800">طلبكم محفوظ في الإدارة، لكن إشعار البريد لم يصل بعد. ستُعاد محاولته.</p>}</section>:<form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border bg-white p-6"><p className="leading-8">سنرسل نسخة التصميم المحفوظة للإدارة. هذا طلب عرض سعر؛ لا ينشر صفحتكم ولا يتطلب دفعًا الآن.</p><label className="block">اسم الجمعية<input required maxLength={160} value={form.organizationName} placeholder={pageData.name || 'اسم الجمعية'} onChange={e=>setForm({...form,organizationName:e.target.value})} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block">اسم مسؤول التواصل<input required maxLength={160} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})} className="mt-2 w-full rounded-xl border p-3" /></label><div className="rounded-xl bg-gray-50 p-4 text-sm leading-8"><p>هاتف التواصل: <span dir="ltr">{account?.phone}</span></p><p>البريد: <span dir="ltr">{account?.email}</span></p></div><label className="block">ملاحظات للعرض (اختياري)<textarea maxLength={4000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-2 w-full rounded-xl border p-3" rows={3}/></label><button disabled={busy||saving} className="rounded-xl bg-[#173c36] px-6 py-4 text-white disabled:opacity-50">{busy?'جارٍ حفظ التصميم وإرسال الطلب…':'تأكيد طلب عرض السعر'}</button></form>}{error && <p role="alert" className="mt-5 text-red-700">{error}</p>}<Link className="mt-6 inline-block underline" to={nonprofitPath('builder')}>العودة إلى المحرر والمعاينة</Link></Shell></NonprofitGate>;
}
