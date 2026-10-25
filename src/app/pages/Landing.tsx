import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { checkUsername } from '../lib/api';
import { BRAND_NAME, ROOT_DOMAIN, USERNAME_PATTERN, pageHost } from '../lib/site';
import AuthModal from '../components/AuthModal';
import { usePageContext } from '../context/PageContext';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-16 px-4">
          <div className="text-white text-3xl font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {BRAND_NAME}
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/builder')}
                className="px-6 py-2 bg-white text-emerald-700 font-bold rounded-full shadow transition-all hover:bg-white/90"
              >
                افتح صفحتي
              </button>
            ) : (
              <button
                onClick={() => navigate('/?auth=login')}
                className="px-6 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all"
              >
                تسجيل الدخول
              </button>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-white/20 px-4 py-3 text-white backdrop-blur-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <span>أنت مسجّل الدخول{pageData.username ? <> — <span dir="ltr" className="font-bold">{pageHost(pageData.username)}</span></> : ''}</span>
            <button onClick={() => navigate('/builder')} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-emerald-700">متابعة التعديل</button>
            <button onClick={() => { logout(); }} className="text-sm underline opacity-90">تسجيل الخروج</button>
          </div>
        )}
        {/* Hero Section */}
        <div className="text-center space-y-8">

          <h1 
            className="text-5xl md:text-7xl font-black text-white leading-tight"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            عنوان واحد لكل ما يخص جهتك
          </h1>

          <p 
            className="text-xl md:text-2xl text-white/90 max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            تعريف الجهة وشعارها وروابطها وملفاتها
            <br />
            في صفحة واحدة سهلة المشاركة والرجوع إليها
          </p>

          {/* Input Section */}
          <div className="max-w-md mx-auto mt-12 space-y-4">
            <div
              className="flex items-center rounded-2xl bg-white shadow-xl focus-within:ring-4 focus-within:ring-white/50 transition-all"
              dir="ltr"
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                onKeyPress={handleKeyPress}
                placeholder="name"
                aria-label="اسم رابط الصفحة"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={30}
                className="min-w-0 flex-1 rounded-l-2xl bg-transparent py-5 pl-5 pr-1 text-lg text-right text-black focus:outline-none"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              />
              <span className="py-5 pr-5 text-lg text-gray-500" style={{ fontFamily: 'Cairo, sans-serif' }}>
                .{ROOT_DOMAIN}
              </span>
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
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/20 bg-white/10 text-white'
              }`}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              <div className="text-sm font-semibold">
                {status === 'service_error' && serviceMessage ? serviceMessage : feedback.title}
              </div>
              {feedback.details.length > 0 && (
                <div className={`mt-2 space-y-1 text-xs ${
                  feedback.tone === 'neutral' || feedback.tone === 'hint'
                    ? 'text-white/85'
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

            <button
              onClick={handleStart}
              disabled={!canProceed}
              className="w-full bg-gray-900 text-white py-5 rounded-2xl text-xl font-bold hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              احجز الاسم وابدأ
            </button>
          </div>

          <button onClick={() => navigate('/partners')} className="text-sm text-white/80 underline hover:text-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            مطبعة أو محل طباعة؟ كن شريكًا
          </button>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-16 text-white/80">
            <div className="text-center">
              <div className="text-3xl mb-2">🔗</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>روابط وملفات PDF</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📇</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>حفظ جهة الاتصال</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎨</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>تصميم قابل للتخصيص</div>
            </div>
          </div>
        </div>
      </div>
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
