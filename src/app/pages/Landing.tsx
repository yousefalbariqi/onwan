import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { checkUsername } from '../lib/api';
import { BRAND_NAME, ROOT_DOMAIN, USERNAME_PATTERN, pageHost } from '../lib/site';
import AuthModal from '../components/AuthModal';
import { usePageContext } from '../context/PageContext';
import { OnwanLogo } from '../components/OnwanLogo';
import { SiteFooter } from '../components/SiteFooter';
import { PUBLIC_PLAN_PRICES } from '../../../shared/planPrices';

// During UI testing the landing page can proceed using local name validation
// only, without asking the API (and therefore the database) for availability.
const skipUsernameAvailabilityCheck =
  import.meta.env.DEV || import.meta.env.VITE_SKIP_SIGNUP_USERNAME_CHECK === 'true';

type UsernameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'available_locally'
  | 'available_unverified'
  | 'invalid'
  | 'reserved'
  | 'taken'
  | 'service_error';

function isLocallyValidUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}

function getUsernameFeedback(status: UsernameStatus, normalizedUsername: string) {
  switch (status) {
    case 'checking':
      return {
        tone: 'neutral' as const,
        title: 'جاري التحقق من توفر الاسم...',
        details: [],
      };
    case 'available':
      return {
        tone: 'success' as const,
        title: `ممتاز، ${pageHost(normalizedUsername)} متاح.`,
        details: ['يُحجز الاسم لك عند إنشاء الحساب.'],
      };
    case 'available_locally':
      return {
        tone: 'success' as const,
        title: `يمكنك المتابعة بالاسم ${normalizedUsername}.`,
        details: ['وضع الاختبار مفعّل: لم يتم التحقق من توفر الاسم في قاعدة البيانات.'],
      };
    case 'available_unverified':
      return {
        tone: 'warning' as const,
        title: `يمكنك المتابعة بالاسم ${normalizedUsername}.`,
        details: ['تعذر التحقق من التوفر الآن؛ سيُتحقق من الاسم نهائيًا عند إنشاء الحساب.'],
      };
    case 'taken':
      return {
        tone: 'error' as const,
        title: `الاسم ${normalizedUsername} مستخدم بالفعل.`,
        details: ['جرّب اسمًا قريبًا، مثل إضافة المدينة أو شرطة: name-riyadh.'],
      };
    case 'reserved':
      return {
        tone: 'error' as const,
        title: `الاسم ${normalizedUsername} محجوز من النظام.`,
        details: ['هذا النوع من الأسماء لا يمكن استخدامه لأنه مخصص لصفحات داخلية أو تشغيلية.'],
      };
    case 'invalid':
      return {
        tone: 'error' as const,
        title: 'صيغة الاسم غير صحيحة.',
        details: [
          'يجب أن يكون بين 1 و30 حرفًا.',
          'المسموح فقط: أحرف إنجليزية صغيرة وأرقام وشرطة (-)، ولا يبدأ أو ينتهي بشرطة.',
        ],
      };
    case 'service_error':
      return {
        tone: 'error' as const,
        title: 'تعذر الوصول إلى خدمة التحقق.',
        details: ['حاول مرة أخرى بعد قليل.'],
      };
    default:
      return {
        tone: 'hint' as const,
        title: 'اكتب الاسم الذي تريده في رابط صفحة جهتك.',
        details: [`مثال: albir.${ROOT_DOMAIN}`],
      };
  }
}

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedUsername = (searchParams.get('username') || '').trim().toLowerCase();
  const [username, setUsername] = useState(requestedUsername);
  // Notes (2) and (3): a signed-in visitor sees that they are signed in, and
  // a new account needs signing out first — so no earlier design is carried over.
  const { isAuthenticated, pageData, logout } = usePageContext();
  const [confirmNew, setConfirmNew] = useState(false);
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [serviceMessage, setServiceMessage] = useState('');
  const normalizedUsername = username.trim().toLowerCase();
  const feedback = getUsernameFeedback(status, normalizedUsername);
  const canProceed = Boolean(normalizedUsername) && isLocallyValidUsername(normalizedUsername) && status !== 'taken' && status !== 'reserved';

  useEffect(() => {
    const trimmed = normalizedUsername;

    if (!trimmed) {
      setStatus('idle');
      setServiceMessage('');
      return;
    }

    if (skipUsernameAvailabilityCheck) {
      setStatus(isLocallyValidUsername(trimmed) ? 'available_locally' : 'invalid');
      setServiceMessage('');
      return;
    }

    setStatus('checking');
    setServiceMessage('');

    const timer = window.setTimeout(async () => {
      try {
        const result = await checkUsername(trimmed);
        setStatus(result.status);
        setServiceMessage('');
      } catch (error) {
        setStatus(isLocallyValidUsername(trimmed) ? 'available_unverified' : 'service_error');
        setServiceMessage(error instanceof Error ? error.message : 'تعذر التحقق من الاسم.');
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedUsername]);

  const handleStart = () => {
    if (!canProceed) return;
    if (isAuthenticated) { setConfirmNew(true); return; }
    navigate(`/builder?onboarding=signup&username=${encodeURIComponent(normalizedUsername)}`);
  };

  const authMode = searchParams.get('auth');
  const showSignup = authMode === 'signup' && USERNAME_PATTERN.test(normalizedUsername);
  const showLogin = authMode === 'login';

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  const monthly = PUBLIC_PLAN_PRICES.monthly.toLocaleString('ar-u-nu-latn');
  const annual = PUBLIC_PLAN_PRICES.annual.toLocaleString('ar-u-nu-latn');
  const goStart = () => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Reviewers and visitors alike should see, without signing in, what is sold,
  // its price, how to pay and our policies — the page is ordered that way.
  return (
    <div dir="rtl" className="min-h-screen bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a href="/" aria-label={`${BRAND_NAME} — الرئيسية`}><OnwanLogo /></a>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#pricing" className="hidden rounded-full px-3 py-2 font-bold hover:bg-white sm:inline-flex">الأسعار</a>
          <a href="#how" className="hidden rounded-full px-3 py-2 font-bold hover:bg-white sm:inline-flex">كيف يعمل</a>
          {isAuthenticated
            ? <button onClick={() => navigate('/builder')} className="rounded-full bg-[#111111] px-4 py-2 font-bold text-white">افتح صفحتي</button>
            : <button onClick={() => navigate('/?auth=login')} className="rounded-full border border-[#E7E7E7] bg-white px-4 py-2 font-bold">تسجيل الدخول</button>}
        </nav>
      </header>

      {isAuthenticated && (
        <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 text-sm">
          <span>أنت مسجّل الدخول{pageData.username ? <> — <span dir="ltr" className="font-bold">{pageHost(pageData.username)}</span></> : ''}</span>
          <button onClick={() => navigate('/builder')} className="font-bold text-[#F25A18] underline underline-offset-4">متابعة التعديل</button>
          <button onClick={() => { logout(); }} className="text-[#737373] underline underline-offset-4">تسجيل الخروج</button>
        </div>
      )}

      <main>
        {/* What it is and what it costs, in the first screen. */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 md:grid-cols-2">
          <div className="space-y-5 text-center md:text-right">
            <p className="inline-flex rounded-full bg-[#FFF0E8] px-3 py-1 text-sm font-bold text-[#F25A18]">اشتراك يبدأ من {monthly} ريال شهريًا</p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl" style={{ fontFamily: 'Cairo, sans-serif' }}>صفحة رابط واحدة لكل ما يخصك أو يخص جهتك</h1>
            <p className="text-lg leading-8 text-[#737373]">احجز اسمك، وضع تعريفك وشعارك وروابطك وملفاتك وبيانات التواصل في صفحة على <span dir="ltr" className="font-bold text-[#111111]">name.{ROOT_DOMAIN}</span>، وشاركها برابط ورمز QR.</p>

            <div id="start" className="mx-auto max-w-md space-y-3 md:mx-0">
              <div className="flex items-center rounded-2xl border border-[#E7E7E7] bg-white shadow-sm focus-within:border-[#FF6B2C]" dir="ltr">
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())} onKeyPress={handleKeyPress} placeholder="name" aria-label="اسم رابط الصفحة" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} className="min-w-0 flex-1 rounded-l-2xl bg-transparent py-4 pl-4 pr-1 text-right text-lg focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }} />
                <span className="py-4 pr-4 text-lg text-[#737373]" style={{ fontFamily: 'Cairo, sans-serif' }}>.{ROOT_DOMAIN}</span>
              </div>
            <div
              className={`rounded-2xl border px-4 py-3 text-right ${
                feedback.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : feedback.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : feedback.tone === 'error'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : feedback.tone === 'neutral'
                      ? 'border-[#E7E7E7] bg-white text-[#3a3a3c]'
                      : 'border-[#E7E7E7] bg-white text-[#3a3a3c]'
              }`}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              <div className="text-sm font-semibold">
                {status === 'service_error' && serviceMessage ? serviceMessage : feedback.title}
              </div>
              {feedback.details.length > 0 && (
                <div className={`mt-2 space-y-1 text-xs ${
                  feedback.tone === 'neutral' || feedback.tone === 'hint'
                    ? 'text-[#737373]'
                    : feedback.tone === 'success'
                      ? 'text-emerald-800'
                      : feedback.tone === 'warning'
                        ? 'text-amber-800'
                      : 'text-red-800'
                }`}>
                  {feedback.details.map((detail) => (
                    <div key={detail}>{detail}</div>
                  ))}
                </div>
              )}
            </div>

              <button onClick={handleStart} disabled={!canProceed} className="w-full rounded-2xl bg-[#FF6B2C] py-4 text-lg font-bold text-white transition hover:bg-[#F25A18] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" style={{ fontFamily: 'Cairo, sans-serif' }}>احجز الاسم وابدأ</button>
              <p className="text-xs text-[#737373]">التصميم والمعاينة مجانًا، والدفع عند نشر الصفحة.</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[300px] rounded-[40px] border-8 border-[#111111] bg-white p-5 shadow-xl" aria-hidden="true">
            <div className="mx-auto h-16 w-16 rounded-full bg-[#C9C0B4]" />
            <p className="mt-3 text-center font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>اسم الجهة</p>
            <p className="text-center text-xs text-[#737373]">وصف مختصر</p>
            <div className="mt-4 space-y-2">
              {['الموقع الإلكتروني', 'تواصل عبر واتساب', 'الملف التعريفي PDF', 'حفظ جهة الاتصال'].map((label) => <div key={label} className="rounded-xl bg-[#111111] py-2.5 text-center text-sm font-bold text-white">{label}</div>)}
            </div>
          </div>
        </section>

        {/* The product: what a subscription includes. */}
        <section className="border-y border-[#E7E7E7] bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-3xl font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>ماذا تحصل عليه</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['رابط باسمك', `صفحتك على name.${ROOT_DOMAIN} باسم تختاره.`],
                ['روابط وملفات', 'روابط المواقع والتواصل، وملفات PDF، وفيديو وصور.'],
                ['حفظ جهة الاتصال', 'زر يحفظ رقمك وبريدك في جوال الزائر مباشرة.'],
                ['رمز QR', 'رمز جاهز للطباعة والمشاركة.'],
                ['تصميم بهويتك', 'ألوانك وشعارك وخطك وقوالب جاهزة.'],
                ['إحصاءات الزيارات', 'عدد زيارات صفحتك.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-[#E7E7E7] p-5">
                  <h3 className="font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>{title}</h3>
                  <p className="mt-1 text-sm leading-7 text-[#737373]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prices, public and fixed. */}
        <section id="pricing" className="mx-auto max-w-5xl scroll-mt-6 px-4 py-14 sm:px-6">
          <h2 className="text-center text-3xl font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>الأسعار</h2>
          <p className="mt-2 text-center text-[#737373]">خطة واحدة بكل المزايا، تختار مدة الدفع.</p>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
            {[
              { name: 'الاشتراك الشهري', price: monthly, period: 'ريال / شهر', note: 'يتجدد كل شهر، ويمكن إلغاؤه في أي وقت.', best: false },
              { name: 'الاشتراك السنوي', price: annual, period: 'ريال / سنة', note: 'يُدفع مرة كل سنة.', best: true },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl bg-white p-6 ${plan.best ? 'border-2 border-[#FF6B2C]' : 'border border-[#E7E7E7]'}`}>
                {plan.best && <span className="absolute -top-3 right-6 rounded-full bg-[#FF6B2C] px-3 py-1 text-xs font-bold text-white">الأفضل للعميل</span>}
                <h3 className="font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>{plan.name}</h3>
                <p className="mt-3"><span className="text-4xl font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>{plan.price}</span> <span className="text-[#737373]">{plan.period}</span></p>
                <p className="mt-2 text-sm text-[#737373]">{plan.note}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {['صفحة برابط باسمك', 'روابط وملفات PDF وفيديو', 'حفظ جهة الاتصال ورمز QR', 'تخصيص التصميم والقوالب', 'إحصاءات الزيارات'].map((item) => <li key={item} className="flex gap-2"><span className="text-[#FF6B2C]">✓</span>{item}</li>)}
                </ul>
                <button onClick={goStart} className={`mt-5 w-full rounded-2xl py-3 font-bold ${plan.best ? 'bg-[#FF6B2C] text-white hover:bg-[#F25A18]' : 'bg-[#111111] text-white'}`}>اشترك الآن</button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-[#737373]">الأسعار بالريال السعودي. الدفع إلكترونيًا عبر بوابة دفع آمنة، ويظهر المبلغ النهائي قبل التأكيد. <a href="/refund" className="font-bold text-[#111111] underline underline-offset-4">سياسة الإلغاء والاسترجاع</a></p>
        </section>

        {/* How buying works, end to end. */}
        <section id="how" className="scroll-mt-6 border-t border-[#E7E7E7] bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-3xl font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>كيف يعمل</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-4">
              {['احجز اسم الرابط وأنشئ حسابك.', 'صمّم صفحتك وعاينها مجانًا.', 'اختر الاشتراك الشهري أو السنوي وادفع إلكترونيًا.', 'تُنشر صفحتك فورًا وتشاركها برابطها ورمز QR.'].map((step, index) => (
                <li key={step} className="rounded-2xl bg-[#F8F8F6] p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-sm font-bold text-white">{index + 1}</span>
                  <p className="mt-3 text-sm leading-7">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center text-sm text-[#737373]">
              <button onClick={() => navigate('/partners')} className="underline underline-offset-4 hover:text-[#111111]">مطبعة أو محل طباعة؟ كن شريكًا</button>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
      {showSignup && <AuthModal mode="signup" username={normalizedUsername} />}
      {showLogin && <AuthModal mode="login" />}
      {confirmNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirmNew(false)} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <div className="w-full max-w-[340px] rounded-[22px] bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>إنشاء حساب جديد؟</p>
            <p className="mt-1 text-sm leading-6 text-[#6e6e73]">أنت مسجّل الدخول بحساب آخر. سجّل الخروج منه أولًا، ثم تبدأ صفحة جديدة فارغة.</p>
            <div className="mt-4 space-y-2">
              <button onClick={() => { logout(); setConfirmNew(false); navigate(`/builder?onboarding=signup&username=${encodeURIComponent(normalizedUsername)}`); }} className="block w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold text-white">تسجيل الخروج والمتابعة</button>
              <button onClick={() => { setConfirmNew(false); navigate('/builder'); }} className="block w-full rounded-xl bg-[#f2f2f7] py-3 text-[15px] font-bold text-[#1d1d1f]">العودة لصفحتي</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
