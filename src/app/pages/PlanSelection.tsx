import { useNavigate } from 'react-router';
import { Zap, ArrowRight, Check } from 'lucide-react';

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الاشتراك
          </h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-emerald-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-lime-400 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  تجربة مجانية
                </h2>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  7 أيام مجاناً — جميع الميزات
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'جميع الثيمات والتصاميم',
                'روابط غير محدودة',
                'تحديثات مباشرة',
                'تخصيص الألوان والخطوط',
                'صفحة عامة مع رابطك الخاص',
                'ملفاتك التعريفية',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/processing?plan=trial')}
              className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              ابدأ التجربة المجانية
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-center text-xs text-gray-400 mt-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              لا يتطلب بطاقة دفع — يمكنك الإلغاء في أي وقت
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
