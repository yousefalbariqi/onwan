import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { checkUsername } from '../lib/api';

type UsernameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'available_unverified'
  | 'invalid'
  | 'reserved'
  | 'taken'
  | 'service_error';

const LOCAL_USERNAME_PATTERN = /^(?=.{1,30}$)(?!.*[_-]{2})[a-z0-9_-]+$/;

function isLocallyValidUsername(username: string) {
  return LOCAL_USERNAME_PATTERN.test(username);
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
        title: `ممتاز، ${normalizedUsername} متاح حاليًا.`,
        details: ['سيتم تأكيد الحجز النهائي لاحقًا عند اكتمال خطوات الإطلاق/الدفع.'],
      };
    case 'available_unverified':
      return {
        tone: 'warning' as const,
        title: `سنسمح لك بالمتابعة بالاسم ${normalizedUsername}.`,
        details: [
          'تعذر التحقق من قاعدة البيانات الآن، لذلك هذا قبول مبدئي فقط.',
          'سيتم التأكد من توفر الاسم فعليًا عند اكتمال الربط مع الخدمة.',
        ],
      };
    case 'taken':
      return {
        tone: 'error' as const,
        title: `الاسم ${normalizedUsername} مستخدم بالفعل.`,
        details: ['جرّب إضافة رقم أو شرطة مثل: name1 أو my-name.'],
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
          'المسموح فقط: أحرف إنجليزية صغيرة، أرقام، - و _',
        ],
      };
    case 'service_error':
      return {
        tone: 'error' as const,
        title: 'تعذر الوصول إلى خدمة التحقق.',
        details: [
          'الواجهة لم تستطع الاتصال بالـ API أو قاعدة البيانات.',
          'إذا كنت تعمل محليًا فشغّل المشروع ببيئة تدعم مجلد api، أو تأكد من إعداد DATABASE_URL و SESSION_SECRET.',
        ],
      };
    default:
      return {
        tone: 'hint' as const,
        title: 'اكتب الاسم الذي تريد أن يظهر في رابط صفحتك.',
        details: ['مثال: yaamur أو yaamur_store'],
      };
  }
}

export default function Landing() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
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
    if (canProceed) {
      navigate(`/phone?username=${normalizedUsername}`);
    }
  };

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
            bio.sa
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/phone')}
              className="px-6 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all"
            >
              دخول
            </button>
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-white text-emerald-600 rounded-full hover:bg-white/90 transition-all font-semibold"
            >
              ابدأ
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>صفحتك الشخصية في دقائق</span>
          </div>

          <h1 
            className="text-5xl md:text-7xl font-black text-white leading-tight"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            رابطك... بشكل يليق فيك
          </h1>

          <p 
            className="text-xl md:text-2xl text-white/90 max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            تعب من توزيع روابطك؟
            <br />
            bio.sa يجمعها لك في صفحة وحدة بشكل أنيق وسهل
          </p>

          {/* Input Section */}
          <div className="max-w-md mx-auto mt-12 space-y-4">
            <div className="relative">
              
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                onKeyPress={handleKeyPress}
                placeholder="bio.sa/ اسمك او اسم الشركة"
                className="w-full px-4 pr-24 py-5 rounded-2xl text-lg text-left bg-white text-black focus:outline-none focus:ring-4 focus:ring-white/50 transition-all shadow-xl bg-[#ffffff00]"
                style={{ fontFamily: 'Cairo, sans-serif', direction: 'ltr' }}
              />
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
              ابدأ صفحتك الآن
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-16 text-white/80">
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>سريع</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">✨</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>بسيط</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎨</div>
              <div className="text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>قابل للتخصيص</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
