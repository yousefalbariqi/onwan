import { useNavigate } from 'react-router';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';

export default function PlanSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/builder')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l7-7-7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اختر خطتك
          </h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-4">
          {/* Free Trial Card */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-gray-200 hover:border-emerald-300 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-lime-400 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  تجربة مجانية
                </h2>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  7 أيام مجاناً
                </p>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start gap-2 text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>جميع الثيمات والميزات</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>روابط غير محدودة</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>تحديثات مباشرة</span>
              </li>
            </ul>
            <button
              onClick={() => navigate('/processing?plan=trial')}
              className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-base hover:shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              ابدأ التجربة المجانية
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Premium Card */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-2 left-2 bg-yellow-400 text-purple-900 px-3 py-1 rounded-full text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              الأكثر شعبية
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  الخطة المميزة
                </h2>
                <p className="text-sm text-white/80" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  دفع لمرة واحدة
                </p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  99
                </span>
                <span className="text-lg text-white/80" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  ريال
                </span>
              </div>
              <p className="text-xs text-white/70 mt-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                دفع لمرة واحدة - مدى الحياة
              </p>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start gap-2 text-sm text-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-yellow-300 mt-0.5">★</span>
                <span>جميع ميزات التجربة ال��جانية</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-yellow-300 mt-0.5">★</span>
                <span>إطار صورة متحرك حصري</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-yellow-300 mt-0.5">★</span>
                <span>بدون إعلانات</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <span className="text-yellow-300 mt-0.5">★</span>
                <span>دعم فني ذي أولوية</span>
              </li>
            </ul>
            <button
              onClick={() => navigate('/payment')}
              className="w-full bg-white text-purple-600 py-4 rounded-2xl font-bold text-base hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-xl"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              اشترك الآن
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            يمكنك إلغاء الاشتراك في أي وقت
          </p>
        </div>
      </div>
    </div>
  );
}
