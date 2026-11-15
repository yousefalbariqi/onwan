import { Navigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { getSessionToken } from '../lib/session';
import { journeyPath, type JourneyKind } from '../lib/journey';
import { ROOT_DOMAIN, isNonprofitHost } from '../lib/site';

function AccountSkeleton() {
  const block = 'rounded-2xl bg-[#ECEAE5]';
  return <div dir="rtl" className="min-h-screen bg-[#F8F8F6]" role="status" aria-label="جارٍ تحميل حسابك">
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

export function JourneyGate({ kind, children }: { kind: JourneyKind; children: React.ReactNode }) {
  const { account, loadingPage, isAuthenticated } = usePageContext();
  if (loadingPage) return <AccountSkeleton />;
  if (!isAuthenticated || !getSessionToken()) return <Navigate to={journeyPath(kind, 'login')} replace />;
  if (!account) return <div dir="rtl" role="alert" className="min-h-screen bg-[#F8F8F6] p-6">تعذر تحميل الحساب. حدّث الصفحة أو سجّل الدخول مجددًا.</div>;
  if (account.kind !== kind) {
    const target = journeyPath(account.kind === 'nonprofit' ? 'nonprofit' : 'standard', 'builder');
    if (isNonprofitHost()) return <div dir="rtl" className="min-h-screen space-y-4 bg-[#F8F8F6] p-6"><p>هذا الحساب مسجل في مسار عنوان الرسمي.</p><a className="inline-block underline" href={`https://${ROOT_DOMAIN}/builder`}>متابعة حسابك في عنوان</a><p>لجمعية جديدة، سجّل الخروج ثم أنشئ حساب جمعية مستقلًا.</p></div>;
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
