import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Smartphone } from 'lucide-react';

export default function Phone() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || '';
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendCode = () => {
    if (phone.trim() && phone.length >= 10) {
      setLoading(true);
      // محاكاة إرسال الكود
      setTimeout(() => {
        setLoading(false);
        setCodeSent(true);
        setResendTimer(60); // 60 ثانية قبل إعادة الإرسال
      }, 1000);
    }
  };

  const handleResendCode = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResendTimer(60);
    }, 1000);
  };

  const handleVerifyCode = () => {
    if (code.length === 4) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        navigate(`/builder?username=${username}`);
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (codeSent) {
        handleVerifyCode();
      } else {
        handleSendCode();
      }
    }
  };

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
            <Smartphone className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h1 
            className="text-3xl font-black text-gray-900 mb-3"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            بس رقمك... ونبدأ
          </h1>

          {/* Description */}
          <p 
            className="text-gray-600 text-lg mb-8"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            بنرسل لك كود سريع عشان نتأكد إنك إنت
          </p>

          {/* Username Display */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <div className="text-sm text-emerald-600 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              اسم المستخدم
            </div>
            <div className="text-xl font-bold text-emerald-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
              bio.sa/{username}
            </div>
          </div>

          {!codeSent ? (
            <>
              {/* Phone Input */}
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
                  maxLength={10}
                  className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg text-right focus:outline-none focus:border-emerald-500 transition-all"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  dir="ltr"
                />
                <div className="text-xs text-gray-500 text-right" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  مثال: 0512345678
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSendCode}
                disabled={phone.length < 10 || loading}
                className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري الإرسال...
                  </span>
                ) : (
                  'أرسل الكود'
                )}
              </button>
            </>
          ) : (
            <>
              {/* Phone Number Display */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                <div className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  تم إرسال الكود إلى
                </div>
                <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }} dir="ltr">
                  {phone}
                </div>
              </div>

              {/* Code Input */}
              <div className="space-y-2 mb-6">
                <label 
                  className="block text-sm font-semibold text-gray-700"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  أدخل الرمز
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  onKeyPress={handleKeyPress}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-2xl text-center tracking-widest focus:outline-none focus:border-emerald-500 transition-all"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  dir="ltr"
                />
                <div className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  أدخل الكود المكون من 4 أرقام
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifyCode}
                disabled={code.length < 4 || loading}
                className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري التحقق...
                  </span>
                ) : (
                  'تحقق من الكود'
                )}
              </button>

              {/* Resend Code */}
              <div className="text-center mt-4">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    يمكنك إعادة الإرسال بعد {resendTimer} ثانية
                  </p>
                ) : (
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-all"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    إعادة إرسال الكود
                  </button>
                )}
              </div>
            </>
          )}

          {/* Privacy Note */}
          <p className="text-xs text-gray-400 text-center mt-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            معلوماتك محمية ومشفرة بالكامل 🔒
          </p>
        </div>
      </div>
    </div>
  );
}