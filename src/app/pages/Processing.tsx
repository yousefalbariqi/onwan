import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Loader2, Check } from 'lucide-react';

export default function Processing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [progress, setProgress] = useState(0);

  const plan = searchParams.get('plan');
  const payment = searchParams.get('payment');

  useEffect(() => {
    // Simulate processing with progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Simulate processing time (2 seconds)
    const timer = setTimeout(() => {
      setProcessing(false);
      // Wait a bit to show success state
      setTimeout(() => {
        navigate('/success?plan=' + plan);
      }, 800);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [navigate, plan]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col items-center justify-center px-4" dir="rtl">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
          {processing ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-100"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '1s' }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
                جاري المعالجة...
              </h2>
              <p className="text-sm text-gray-500 mb-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                {plan === 'trial' 
                  ? 'جاري تفعيل تجربتك المجانية'
                  : 'جاري التحقق من عملية الدفع'}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-lime-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              
              <p className="text-xs text-gray-400 mt-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                قد يستغرق الأمر بضع ثوانٍ
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-lime-400 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-emerald-600 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تم بنجاح! ✓
              </h2>
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                جاري التحويل...
              </p>
            </>
          )}
        </div>

        {plan !== 'trial' && processing && (
          <div className="mt-6 bg-white/60 backdrop-blur-sm rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              🔒 عملية الدفع مؤمنة ومشفرة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
