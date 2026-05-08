import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Smartphone, Settings, CreditCard, User } from 'lucide-react';
import { loginWithPhone } from '../lib/api';
import { setSessionToken } from '../lib/session';
import { usePageContext } from '../context/PageContext';

export default function Phone() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || '';
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [returningUser, setReturningUser] = useState<{ pageData: any } | null>(null);
  const { replacePageData, setAuthenticated } = usePageContext();
  const isLoginOnly = !username;

  const handleLogin = async () => {
    if (!phone.trim() || phone.length < 8) {
      setError('يرجى إدخال رقم جوال صحيح.');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const response = await loginWithPhone(phone, username || undefined);

      setSessionToken(response.token);
      setAuthenticated(true);

      if (response.pageData) {
        replacePageData(response.pageData);
      }

      if (response.isNewUser) {
        navigate('/builder');
      } else {
        setReturningUser({ pageData: response.pageData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول الآن.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (returningUser) {
    const pd = returningUser.pageData;
    const displayUsername = pd?.username || '';
    const plan = 'تجربة مجانية';
    const planPeriod = '7 أيام';

    return (
      <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <button
            onClick={() => setReturningUser(null)}
            className="mb-8 text-white/80 hover:text-white flex items-center gap-2 transition-all"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <ArrowRight className="w-5 h-5" />
            <span>رجوع</span>
          </button>

          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
              <User className="w-8 h-8 text-white" />
            </div>

            <h1
              className="text-3xl font-black text-gray-900 mb-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              أهلاً بعودتك! 👋
            </h1>
            <p
              className="text-gray-600 text-lg mb-6"
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              مسجّل كـ <span className="font-bold text-emerald-600">{displayUsername || phone}</span>
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>نوع الاشتراك</span>
                <span className="text-sm font-bold text-emerald-700" style={{ fontFamily: 'Cairo, sans-serif' }}>{plan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>الفترة</span>
                <span className="text-sm font-bold text-emerald-700" style={{ fontFamily: 'Cairo, sans-serif' }}>{planPeriod}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/builder')}
                className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Settings className="w-5 h-5" />
                الإعدادات
              </button>
              <button
                onClick={() => navigate('/plan-selection')}
                className="w-full bg-white border-2 border-emerald-500 text-emerald-600 py-4 rounded-xl text-lg font-bold hover:bg-emerald-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <CreditCard className="w-5 h-5" />
                الاشتراك
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-8 text-white/80 hover:text-white flex items-center gap-2 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ArrowRight className="w-5 h-5" />
          <span>رجوع</span>
        </button>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
            <Smartphone className="w-8 h-8 text-white" />
          </div>

          <h1
            className="text-3xl font-black text-gray-900 mb-3"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {isLoginOnly ? 'دخول مباشر' : 'ابدأ بدون تحقق'}
          </h1>

          <p
            className="text-gray-600 text-lg mb-8"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            {isLoginOnly
              ? 'أدخل رقم الجوال للدخول مباشرة أثناء التجربة.'
              : 'أدخل رقم الجوال وسننشئ صفحتك مباشرة بدون OTP.'}
          </p>

          {!!username && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="text-sm text-emerald-600 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                اسم المستخدم المقترح
              </div>
              <div className="text-xl font-bold text-emerald-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                bio.sa/{username}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            <label
              className="block text-sm font-semibold text-gray-700"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              رقم الجوال
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={handleKeyPress}
              placeholder="05XXXXXXXX"
              maxLength={20}
              className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg text-right focus:outline-none focus:border-emerald-500 transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              dir="ltr"
              autoFocus
            />
            <div className="text-xs text-gray-500 text-right" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              مثال: 0512345678
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!phone || loading}
            className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                جاري الدخول...
              </span>
            ) : isLoginOnly ? (
              'دخول مباشر'
            ) : (
              'أنشئ الصفحة الآن'
            )}
          </button>

          <p className="text-xs text-center mt-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            تم تعطيل التحقق المؤقت في بيئة التجربة. يمكنك إعادة OTP لاحقًا بسهولة.
          </p>
        </div>
      </div>
    </div>
  );
}
