import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CreditCard, Smartphone, ArrowRight } from 'lucide-react';

const paymentMethods = [
  {
    id: 'applepay',
    name: 'Apple Pay',
    icon: '🍎',
    description: 'ادفع بسهولة عبر Apple Pay',
  },
  {
    id: 'mada',
    name: 'مدى',
    icon: '💳',
    description: 'بطاقة مدى السعودية',
  },
  {
    id: 'visa',
    name: 'Visa / Mastercard',
    icon: '💳',
    description: 'بطاقات الائتمان الدولية',
  },
];

export default function Payment() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState<string>('');

  const handleProceed = () => {
    if (selectedMethod) {
      navigate('/processing?plan=premium&payment=' + selectedMethod);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/plan-selection')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l7-7-7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
            طريقة الدفع
          </h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-4">
          {/* Order Summary */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-6 text-white shadow-xl mb-6">
            <p className="text-sm opacity-80 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              المبلغ الإجمالي
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                99
              </span>
              <span className="text-xl" style={{ fontFamily: 'Cairo, sans-serif' }}>
                ريال سعودي
              </span>
            </div>
            <p className="text-xs opacity-70 mt-2" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              الخطة المميزة - دفع لمرة واحدة
            </p>
          </div>

          <h2 className="text-base font-bold text-gray-700 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اختر طريقة الدفع
          </h2>

          {/* Payment Methods */}
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full bg-white rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] ${
                  selectedMethod === method.id
                    ? 'border-purple-500 shadow-lg ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                    {method.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {method.name}
                    </h3>
                    <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                      {method.description}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === method.id
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedMethod === method.id && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Proceed Button */}
          <button
            onClick={handleProceed}
            disabled={!selectedMethod}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 mt-6 ${
              selectedMethod
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-xl'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            متابعة الدفع
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="bg-gray-50 rounded-2xl p-4 mt-4">
            <div className="flex items-start gap-2">
              <div className="text-xl">🔒</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  دفع آمن ومشفر
                </p>
                <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  معلومات الدفع محمية بأعلى معايير الأمان
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
