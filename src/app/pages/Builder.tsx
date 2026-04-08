import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { PagePreview } from '../components/PagePreview';
import { ThemeSelector } from '../components/ThemeSelector';
import { HeaderEditor } from '../components/HeaderEditor';
import { WallpaperEditor } from '../components/WallpaperEditor';
import { StyleEditor } from '../components/StyleEditor';
import { LinkEditor } from '../components/LinkEditor';
import { Palette, User, Image as ImageIcon, Sparkles, Share2, Link2, Check, Eye, Home, ChevronDown, ChevronUp, Info, ArrowLeft } from 'lucide-react';

type Tab = 'theme' | 'header' | 'wallpaper' | 'style' | 'links';

export default function Builder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || '';
  const [activeTab, setActiveTab] = useState<Tab>('theme');
  const [showSettings, setShowSettings] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const { pageData, updatePageData } = usePageContext();

  // تعيين اسم المستخدم عند التحميل
  useEffect(() => {
    if (!pageData.username && username) {
      updatePageData({ username });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // إخفاء رسالة الترحيب بعد 8 ثوان
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = () => {
    navigate('/plan-selection');
  };

  const tabs = [
    { id: 'theme' as Tab, label: 'الثيمات', icon: Palette },
    { id: 'header' as Tab, label: 'البروفايل', icon: User },
    { id: 'links' as Tab, label: 'الروابط', icon: Link2 },
    { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon },
    { id: 'style' as Tab, label: 'الأزرار', icon: Sparkles },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            title="العودة للرئيسية"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <div className="text-lg sm:text-xl font-bold text-emerald-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            bio.sa
          </div>
          <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
          <div className="text-xs sm:text-sm text-gray-600 hidden sm:block" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {username}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => navigate('/preview')}
            className="flex items-center gap-1 sm:gap-2 bg-gray-100 text-gray-700 px-2 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold hover:bg-gray-200 transition-all"
            title="اعرض صفحتك في نافذة جديدة"
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>معاينة</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-lime-500 to-emerald-500 text-white px-4 sm:px-6 py-2.5 rounded-full text-sm sm:text-base font-bold hover:shadow-lg transition-all min-w-[100px] sm:min-w-[120px]"
            title="المتابعة إلى الخطوة التالية"
          >
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>
              التالي
            </span>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className={`flex-1 overflow-y-auto px-4 transition-all duration-300 ${showSettings ? 'pb-24' : 'pb-4'}`}>
        <div className="max-w-md mx-auto py-6">
          <PagePreview />
        </div>
        
        {/* Toggle Settings Button - positioned at bottom of preview when settings hidden */}
        {!showSettings && (
          <div className="max-w-md mx-auto pb-6 flex justify-center">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-emerald-700 transition-all hover:shadow-xl"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <ChevronUp className="w-5 h-5" />
              <span className="text-sm font-semibold">إظهار الإعدادات</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div 
        className={`fixed left-0 right-0 bg-white border-t border-gray-200 shadow-lg transition-all duration-300 ${
          showSettings ? 'bottom-0' : '-bottom-full'
        }`}
        style={{ zIndex: 40 }}
      >
        {/* Hide Settings Button - at top of settings panel */}
        <div className="border-b border-gray-100 py-2 px-4 flex justify-center">
          <button
            onClick={() => setShowSettings(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 px-4 py-1.5 rounded-full hover:bg-emerald-50 transition-all"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <ChevronDown className="w-4 h-4" />
            <span className="text-sm font-semibold">إخفاء الإعدادات</span>
          </button>
        </div>

        <div className="flex items-center justify-around px-1 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-2 sm:px-4 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="border-t border-gray-100 bg-gray-50 max-h-80 overflow-y-auto">
          {activeTab === 'theme' && <ThemeSelector />}
          {activeTab === 'header' && <HeaderEditor />}
          {activeTab === 'links' && <LinkEditor />}
          {activeTab === 'wallpaper' && <WallpaperEditor />}
          {activeTab === 'style' && <StyleEditor />}
        </div>
      </div>

      {/* Welcome Message */}
      {showWelcome && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 transition-all duration-300" 
          style={{ zIndex: 50 }}
          onClick={() => setShowWelcome(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all duration-300 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  مرحباً بك في bio.sa! 👋
                </h3>
                <p className="text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  أنشئ صفحتك الشخصية في دقائق
                </p>
              </div>
            </div>
            
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-3 bg-emerald-50 p-3 rounded-xl">
                <Palette className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    اختر الثيم المفضل
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    9 ثيمات جاهزة للاختيار من بينها
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-xl">
                <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    أضف معلوماتك
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    الصورة، الاسم، والوصف
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                <Eye className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    المعاينة المباشرة
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    كل تغيير يظهر مباشرة في الأعلى
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-xl">
                <ChevronDown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    إخفاء الإعدادات
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    اضغط \"إخفاء الإعدادات\" لرؤية أوضح
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowWelcome(false)}
              className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white px-6 py-3 rounded-full font-bold hover:shadow-lg transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              ابدأ الآن ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}