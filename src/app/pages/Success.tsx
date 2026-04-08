import { useNavigate, useSearchParams } from 'react-router';
import { Check, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { usePageContext } from '../context/PageContext';

export default function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pageData } = usePageContext();
  const plan = searchParams.get('plan');

  const handleViewPage = () => {
    // Navigate to the actual bio page
    navigate(`/${pageData.username || 'preview'}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-lime-50 to-yellow-50 flex flex-col items-center justify-center px-4 relative overflow-hidden" dir="rtl">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-20 h-20 bg-emerald-300/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-32 h-32 bg-lime-300/30 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-yellow-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="w-28 h-28 mx-auto bg-gradient-to-br from-emerald-400 to-lime-400 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
              <Check className="w-14 h-14 text-white" strokeWidth={3} />
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            <div className="absolute -bottom-2 -left-2">
              <Sparkles className="w-6 h-6 text-pink-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
        </div>

        {/* Success Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
            مبروك! 🎉
          </h1>
          <p className="text-base text-gray-600 mb-2" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {plan === 'trial' 
              ? 'تم تفعيل تجربتك المجانية بنجاح'
              : 'تم الاشتراك في الخطة المميزة بنجاح'}
          </p>
          <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            صفحتك الشخصية جاهزة الآن! 🚀
          </p>

          {/* Features List */}
          <div className="bg-gradient-to-br from-emerald-50 to-lime-50 rounded-2xl p-4 mt-6 mb-6">
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>صفحتك منشورة ومتاحة للجميع</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>يمكنك التعديل عليها في أي وقت</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>شارك رابطك مع الجميع</span>
              </li>
            </ul>
          </div>

          {/* View Page Button */}
          <button
            onClick={handleViewPage}
            className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
            عرض صفحتي
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigate('/builder')}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              تعديل الصفحة
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/${pageData.username || 'preview'}`;
                navigator.clipboard.writeText(url);
                alert('تم نسخ الرابط! 📋');
              }}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              نسخ الرابط
            </button>
          </div>
        </div>

        {/* Info Card */}
        {plan === 'trial' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              💡 تنتهي تجربتك المجانية بعد 7 أيام. يمكنك الترقية في أي وقت!
            </p>
          </div>
        )}
        
        {plan !== 'trial' && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-purple-200">
            <p className="text-xs text-purple-700 font-semibold" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              ⭐ أنت الآن عضو مميز! استمتع بجميع الميزات الحصرية
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
