import { Link } from 'react-router';
import { nonprofitPath } from '../lib/nonprofit';
import { useEffect } from 'react';
import { ArrowUpLeft, HeartHandshake, QrCode, Bookmark } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '../lib/site';
import { OnwanLogo } from '../components/OnwanLogo';
import { NonprofitFooter } from '../components/NonprofitFooter';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';


// Note 31: colours are the «عنوان» brand tokens (onwan-brand.html).
// One-screen scene: the association page in the middle, sharing (QR) and saving on the sides.
function Scene() {
  return (
    <div className="relative mx-auto w-full max-w-md" role="img" aria-label="مثال توضيحي: صفحة جمعية على الجوال، تُشارك برمز QR وتُحفظ للرجوع إليها">
      <div aria-hidden="true" className="absolute inset-x-6 inset-y-4 rounded-[3rem] bg-[#FFF0E8]" />
      <div aria-hidden="true" className="relative mx-auto w-44 rounded-[2rem] border-[6px] border-[#111111] bg-[#FFFFFF] p-4 shadow-lg shadow-[#111111]/10 sm:w-56 sm:p-5">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white sm:h-14 sm:w-14"><HeartHandshake size={26} /></div>
        <p className="mt-3 text-center text-sm font-bold sm:text-base">اسم الجهة</p>
        <p className="mt-1 text-center text-[11px] text-[#737373]">رسالتكم، أقرب للجميع</p>
        <div className="mt-4 space-y-2">{['برامجنا', 'شارك معنا', 'تواصل معنا'].map(label => <div key={label} className="flex items-center justify-between rounded-lg bg-[#F5F5F3] px-3 py-2 text-xs font-bold sm:py-2.5"><span>{label}</span><ArrowUpLeft size={13} /></div>)}</div>
      </div>
      <div aria-hidden="true" className="absolute bottom-6 right-0 flex items-center gap-2 rounded-2xl bg-white p-2.5 text-xs font-bold shadow-md shadow-[#111111]/10 sm:bottom-10"><span className="rounded-lg border border-[#111111]/15 bg-white p-1"><QrCode size={30} /></span>شاركوها<br />في لقاءاتكم</div>
      <div aria-hidden="true" className="absolute left-0 top-8 flex items-center gap-2 rounded-2xl bg-[#111111] px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-[#111111]/15 sm:top-12"><Bookmark size={18} />محفوظة<br />للرجوع إليها</div>
    </div>
  );
}

export default function NonprofitLanding() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'عنوان للجمعيات الأهلية';
    return () => { document.title = previous; };
  }, []);
  const signedIn = Boolean(getSessionToken());
  return (
    <div dir="rtl" className="flex min-h-[100svh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <a href="#" aria-label="عنوان للجمعيات — الرئيسية" className="flex items-center gap-3"><OnwanLogo /></a>
        {/* Note 23: a signed-in association comes back here, still signed in. */}
        {signedIn ? (
          <button type="button" onClick={() => { clearSessionToken(); clearLocalAccountData(); window.location.assign(nonprofitPath()); }} className="min-h-11 rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111]">تسجيل الخروج</button>
        ) : (
          <Link to={nonprofitPath('login')} className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4">تسجيل الدخول</Link>
        )}
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="text-[2rem] font-bold tracking-[-0.02em] leading-[1.45] sm:text-5xl sm:leading-[1.5]">لرسالتكم أثر.<br /><span className="text-[#FF6B2C]">ولجمعيتكم عنوان.</span></h1>
          <p className="mt-3 max-w-lg text-base leading-8 text-[#737373] sm:mt-5 sm:text-lg sm:leading-9">حضور يليق بكم، يجمع برامجكم وروابطكم بهويتكم، ويقرّبها من المستفيدين والداعمين.</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
            {/* Note 30: one large filled start button for a new association. */}
            <Link to={nonprofitPath(signedIn ? 'builder' : 'signup')} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#FF6B2C] px-8 py-3.5 text-base font-bold text-white shadow-md shadow-[#FF6B2C]/25 transition hover:bg-[#F25A18] active:scale-[0.98] focus-visible:outline-[#FF6B2C] focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto sm:text-lg">{signedIn ? 'متابعة تصميم صفحة الجمعية' : 'أنشئ صفحة جمعيتك'} <ArrowUpLeft size={19} aria-hidden="true" /></Link>
            {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center px-2 text-sm font-bold underline underline-offset-4">تواصلوا معنا</a>}
          </div>
          <p className="mt-2 text-xs text-[#737373]">صمّموا وشاهدوا المعاينة مجانًا. النشر بعد الاتفاق والتفعيل.</p>
          {/* Note 30: the second way in, for an association that already has an account. */}
          {!signedIn && (
            <p className="mt-6 border-t border-[#E7E7E7] pt-4 text-sm text-[#737373]">لديكم حساب؟ <Link to={nonprofitPath('login')} className="inline-flex min-h-11 items-center font-bold text-[#111111] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">دخول بوابة الجمعية</Link></p>
          )}
        </div>
        <Scene />
      </main>
      <NonprofitFooter />
    </div>
  );
}
