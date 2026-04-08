import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  const handleStart = () => {
    if (username.trim()) {
      navigate(`/phone?username=${username}`);
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
            <button className="px-6 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all">
              دخول
            </button>
            <button className="px-6 py-2 bg-white text-emerald-600 rounded-full hover:bg-white/90 transition-all font-semibold">
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
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="bio.sa/ اسمك او اسم الشركة"
                className="w-full px-4 pr-24 py-5 rounded-2xl text-lg text-left bg-white text-black focus:outline-none focus:ring-4 focus:ring-white/50 transition-all shadow-xl bg-[#ffffff00]"
                style={{ fontFamily: 'Cairo, sans-serif', direction: 'ltr' }}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!username.trim()}
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