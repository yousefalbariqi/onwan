import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { PagePreview } from '../components/PagePreview';
import { ThemeSelector } from '../components/ThemeSelector';
import { HeaderEditor } from '../components/HeaderEditor';
import { WallpaperEditor } from '../components/WallpaperEditor';
import { StyleEditor } from '../components/StyleEditor';
import { LinkEditor } from '../components/LinkEditor';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { AccountPanel } from '../components/AccountPanel';
import { BRAND_NAME, pageHost, pageUrl } from '../lib/site';
import { Palette, User, Image as ImageIcon, Sparkles, Link2, Eye, Home, ChevronDown, ChevronUp, ArrowLeft, Save, ExternalLink, Settings } from 'lucide-react';

type Tab = 'theme' | 'header' | 'wallpaper' | 'style' | 'links' | 'account';

export default function Builder() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('theme');
  const [showSettings, setShowSettings] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (localStorage.getItem('bio_sa_welcome_seen')) return false;
    localStorage.setItem('bio_sa_welcome_seen', '1');
    return true;
  });
  const { pageData, account, isAuthenticated, loadingPage, isDirty, saving, save } = usePageContext();
  const [saveError, setSaveError] = useState('');
  const isPublished = account?.pageStatus === 'published';

  useEffect(() => {
    if (!loadingPage && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loadingPage, navigate]);

  // PAGE-07: nothing reaches the public page until this explicit save.
  const handleSave = async () => {
    try {
      setSaveError('');
      await save();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'تعذر حفظ التعديلات.');
    }
  };

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
    { id: 'header' as Tab, label: 'الهوية', icon: User },
    { id: 'links' as Tab, label: 'الروابط', icon: Link2 },
    { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon },
    { id: 'style' as Tab, label: 'الأزرار', icon: Sparkles },
    { id: 'account' as Tab, label: 'الحساب', icon: Settings },
  ];

  const renderActivePanel = () => {
    if (activeTab === 'theme') {
      return <ThemeSelector />;
    }

    if (activeTab === 'header') {
      return <HeaderEditor />;
    }

    if (activeTab === 'links') {
      return <LinkEditor />;
    }

    if (activeTab === 'wallpaper') {
      return <WallpaperEditor />;
    }

    if (activeTab === 'account') {
      return <AccountPanel />;
    }

    return <StyleEditor />;
  };

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            جاري تحميل صفحتك...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/')}
            className="hidden sm:block p-2 hover:bg-gray-100 rounded-lg transition-all"
            title="العودة للرئيسية"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <div className="text-lg sm:text-xl font-bold text-emerald-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {BRAND_NAME}
          </div>
          <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
          <div className="text-xs sm:text-sm text-gray-600 hidden sm:block" style={{ fontFamily: 'Tajawal, sans-serif' }} dir="ltr">
            {pageData.username ? pageHost(pageData.username) : ''}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <QRCodeDisplay username={pageData.username} />
          <button
            onClick={() => navigate('/preview')}
            className="flex items-center gap-1 sm:gap-2 bg-gray-100 text-gray-700 px-2 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold hover:bg-gray-200 transition-all"
            title="معاينة التعديلات قبل الحفظ"
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
              معاينة
            </span>
          </button>
          {isPublished && (
            <a
              href={pageUrl(pageData.username)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 sm:gap-2 bg-gray-100 text-gray-700 px-2 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold hover:bg-gray-200 transition-all"
              title="افتح الصفحة المنشورة كما يراها الجمهور"
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
                الصفحة المنشورة
              </span>
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 sm:gap-2 bg-gray-900 text-white px-3 sm:px-5 py-2.5 rounded-full text-sm font-bold transition-all disabled:bg-gray-200 disabled:text-gray-500"
            title={isPublished ? 'حفظ التعديلات ونشرها للجمهور' : 'حفظ التعديلات'}
          >
            <Save className="w-4 h-4" />
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>
              {saving ? 'جاري الحفظ...' : isDirty ? 'حفظ' : 'محفوظ'}
            </span>
          </button>
          {account?.pageStatus === 'draft' && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-lime-500 to-emerald-500 text-white px-3 sm:px-5 py-2.5 rounded-full text-sm font-bold hover:shadow-lg transition-all"
              title="اشترك لنشر الصفحة للجمهور"
            >
              <span style={{ fontFamily: 'Cairo, sans-serif' }}>نشر</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {(saveError || (account && !account.emailVerified) || account?.pageStatus === 'suspended') && (
        <div className="space-y-1 border-b border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {saveError && <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{saveError}</div>}
          {account?.pageStatus === 'suspended' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              صفحتك موقوفة من الإدارة وغير ظاهرة للجمهور. التفاصيل في تبويب «الحساب».
            </div>
          )}
          {account && !account.emailVerified && (
            <button onClick={() => setActiveTab('account')} className="block w-full rounded-lg bg-amber-50 px-3 py-2 text-right text-amber-800">
              بريدك الإلكتروني غير مؤكد — أكّده من تبويب «الحساب».
            </button>
          )}
        </div>
      )}

      <div className="lg:hidden flex-1 min-h-0 flex flex-col">
        <div className={`flex-1 overflow-y-auto px-4 transition-all duration-300 ${showSettings ? 'pb-24' : 'pb-4'}`}>
          <div className="max-w-md mx-auto py-6">
            <PagePreview />
          </div>

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

        <div
          className={`fixed left-0 right-0 bg-white border-t border-gray-200 shadow-lg transition-all duration-300 ${
            showSettings ? 'bottom-0' : '-bottom-full'
          }`}
          style={{ zIndex: 40 }}
        >
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
                    isActive ? 'bg-emerald-50 text-emerald-600' : 'text-gray-500 hover:bg-gray-50'
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

          <div className="border-t border-gray-100 bg-gray-50 max-h-80 overflow-y-auto">{renderActivePanel()}</div>
        </div>
      </div>

      <div className="hidden lg:block flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-[minmax(360px,420px)_minmax(0,560px)] justify-center gap-8 px-6 py-6">
          <aside className="h-full overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-100 px-5 py-5">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  تخصيص الصفحة
                </h2>
                <p className="mt-1 text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  حرر صفحتك من هنا، والمعاينة تبقى واضحة طوال الوقت.
                </p>
              </div>

              <div className="border-b border-gray-100 p-3">
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition-all ${
                          isActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                        style={{ fontFamily: 'Cairo, sans-serif' }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-50">{renderActivePanel()}</div>
            </div>
          </aside>

          <section className="h-full overflow-y-auto rounded-[32px] border border-gray-200 bg-gradient-to-br from-white via-gray-50 to-emerald-50/50 px-8 py-8 shadow-sm">
            <div className="mx-auto flex min-h-full max-w-[460px] flex-col">
              <div className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <div>
                  <div className="text-sm font-semibold text-emerald-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    معاينة مباشرة
                  </div>
                  <p className="mt-1 text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    تعرض تعديلاتك غير المحفوظة. الجمهور يرى آخر نسخة محفوظة فقط.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/preview')}
                  className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Eye className="h-4 w-4" />
                  <span>فتح المعاينة</span>
                </button>
              </div>

              <div className="mx-auto w-full max-w-[420px]">
                <PagePreview />
              </div>
            </div>
          </section>
        </div>
      </div>

      {showWelcome && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 transition-all duration-300"
          style={{ zIndex: 50 }}
          onClick={() => setShowWelcome(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all duration-300 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  مرحبًا بك في {BRAND_NAME} 👋
                </h3>
                <p className="text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  جهّز صفحة جهتك في دقائق
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
                    ثيمات جاهزة مع تخصيص الألوان والخط والخلفية
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-xl">
                <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    أضف هوية الجهة
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    الشعار، الاسم، التعريف، والروابط والملفات
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                <Eye className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    معاينة ثم حفظ
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    التغييرات تظهر في المعاينة فورًا، ولا تصل للجمهور إلا بعد «حفظ»
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-xl">
                <ChevronDown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    النشر
                  </p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    تُنشر الصفحة للجمهور بعد إتمام الاشتراك
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
