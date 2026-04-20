import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Mail, Smartphone, Settings, CreditCard, User } from 'lucide-react';
import { sendCode, verifyCode } from '../lib/api';
import { setSessionToken } from '../lib/session';
import { usePageContext } from '../context/PageContext';

export default function Phone() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || '';
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [returningUser, setReturningUser] = useState<{ pageData: any } | null>(null);
  const { replacePageData, setAuthenticated } = usePageContext();
  const isLoginOnly = !username;

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setError('يرجى إدخال رقم الجوال.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await sendCode(email, phone, username || undefined);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 4) {
      return;
    }

    try {
      setError('');
      setLoading(true);

      const response = await verifyCode(email, otp);

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
      setError(err instanceof Error ? err.message : 'رمز التحقق غير صحيح.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'info') {
        handleSendCode();
      } else {
        handleVerifyCode();
      }
    }
  };

  // --- Returning user screen ---
  if (returningUser) {
    const pd = returningUser.pageData;
    const displayUsername = pd?.username || '';
    // Placeholder subscription info (no real subscription table yet)
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
            {/* Avatar */}
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
              مسجّل كـ <span className="font-bold text-emerald-600">{displayUsername || email}</span>
            </p>

            {/* Subscription Info */}
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

            {/* Action Buttons */}
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
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-8 text-white/80 hover:text-white flex items-center gap-2 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ArrowRight className="w-5 h-5" />
          <span>رجوع</span>
        </button>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
            {step === 'otp' ? <Mail className="w-8 h-8 text-white" /> : <Smartphone className="w-8 h-8 text-white" />}
          </div>

          {/* Title */}
          <h1 
            className="text-3xl font-black text-gray-900 mb-3"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {step === 'otp'
              ? 'أدخل رمز التحقق'
              : isLoginOnly
                ? 'تسجيل الدخول'
                : 'بس بياناتك... ونبدأ'}
          </h1>

          {/* Description */}
          <p 
            className="text-gray-600 text-lg mb-8"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            {step === 'otp'
              ? `أرسلنا رمز تحقق إلى ${email}`
              : isLoginOnly
                ? 'أدخل بريدك الإلكتروني ورقم جوالك لتسجيل الدخول'
                : 'سنرسل رمز تحقق إلى بريدك الإلكتروني'}
          </p>

          {!!username && step === 'info' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="text-sm text-emerald-600 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                اسم المستخدم المقترح
              </div>
              <div className="text-xl font-bold text-emerald-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                bio.sa/{username}
              </div>
            </div>
          )}

          {step === 'info' ? (
            <>
              <div className="space-y-2 mb-4">
                <label 
                  className="block text-sm font-semibold text-gray-700"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="you@example.com"
                  className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg focus:outline-none focus:border-emerald-500 transition-all"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  dir="ltr"
                />
                <div className="text-xs text-gray-500 text-right" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  سيتم إرسال رمز التحقق إلى هذا البريد
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label 
                  className="block text-sm font-semibold text-gray-700"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  رقم الجوال
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyPress={handleKeyPress}
                  placeholder="05XXXXXXXX"
                  maxLength={20}
                  className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg text-right focus:outline-none focus:border-emerald-500 transition-all"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  dir="ltr"
                />
                <div className="text-xs text-gray-500 text-right" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  مثال: 0512345678
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2 mb-6">
              <label 
                className="block text-sm font-semibold text-gray-700"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                رمز التحقق
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                onKeyPress={handleKeyPress}
                placeholder="0000"
                maxLength={4}
                className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-3xl text-center tracking-[0.75em] focus:outline-none focus:border-emerald-500 transition-all"
                style={{ fontFamily: 'Cairo, sans-serif' }}
                dir="ltr"
                autoFocus
              />
              <button
                onClick={() => { setStep('info'); setOtp(''); setError(''); }}
                className="text-sm text-emerald-600 hover:underline mt-2"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                تغيير البريد الإلكتروني؟
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {error}
            </div>
          )}

          <button
            onClick={step === 'info' ? handleSendCode : handleVerifyCode}
            disabled={step === 'info' ? (!email.includes('@') || !phone || loading) : (otp.length !== 4 || loading)}
            className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {step === 'info' ? 'جاري الإرسال...' : 'جاري التحقق...'}
              </span>
            ) : step === 'info' ? (
              'إرسال رمز التحقق'
            ) : (
              'تأكيد'
            )}
          </button>

          {step === 'otp' && (
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="w-full text-sm text-emerald-600 hover:underline mt-3 disabled:opacity-50"
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              إعادة إرسال الرمز
            </button>
          )}

          {/* Privacy Note */}
          <p className="text-xs text-gray-400 text-center mt-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            سيتم إرسال رمز التحقق إلى بريدك الإلكتروني لتأكيد هويتك 🔒
          </p>
        </div>
      </div>
    </div>
  );
}
