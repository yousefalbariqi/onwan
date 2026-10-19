import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageData, SavedVersion, Theme, themes, usePageContext } from '../context/PageContext';
import { PhonePreview } from '../components/PhonePreview';
import { PageView } from '../components/PageView';
import { HeaderEditor } from '../components/HeaderEditor';
import { WallpaperEditor } from '../components/WallpaperEditor';
import { StyleEditor } from '../components/StyleEditor';
import { LinkEditor } from '../components/LinkEditor';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { AccountPanel } from '../components/AccountPanel';
import { accountCall } from '../lib/api';
import { BRAND_NAME, pageHost, pageUrl } from '../lib/site';
import { Palette, User, Image as ImageIcon, Sparkles, Link2, Eye, Home, ArrowLeft, Save, ExternalLink, Settings, ChevronLeft, X, Check, Share2, Undo2, History } from 'lucide-react';
import AuthModal from '../components/AuthModal';

type Tab = 'theme' | 'header' | 'wallpaper' | 'style' | 'links' | 'account';

// `staffEdit` is set when an employee edits a customer's page from the
// administration panel (PERM-01): same editor, without the owner-only parts.
export default function Builder({ staffEdit }: { staffEdit?: { onExit: () => void } }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guestPreview = searchParams.get('onboarding') === 'signup';
  const guestUsername = (searchParams.get('username') || '').trim().toLowerCase();
  const [activeTab, setActiveTab] = useState<Tab>('header');
  const [mobilePanel, setMobilePanel] = useState<Tab | null>(null);
  const [showGuestAuth, setShowGuestAuth] = useState(false);
  const [undoWallpaper, setUndoWallpaper] = useState<PageData['wallpaper'] | null>(null);
  const [undoTheme, setUndoTheme] = useState<Theme | null>(null);
  const [designNotice, setDesignNotice] = useState('');
  const [showWelcome, setShowWelcome] = useState(() => {
    if (staffEdit || guestPreview || localStorage.getItem('bio_sa_welcome_seen')) return false;
    localStorage.setItem('bio_sa_welcome_seen', '1');
    return true;
  });
  const { pageData, savedPageData, replacePageData, savedHistory, restoreVersion, account, isAuthenticated, loadingPage, isDirty, saving, save, updateTheme, updateWallpaper } = usePageContext();
  const [saveError, setSaveError] = useState('');
  // «صمّم لي» is offered at the start of building and stays on offer until the
  // beneficiary takes it or pays; taking it leads to the cart with it selected.
  const [designOffer, setDesignOffer] = useState<{ priceSar: number | null } | null>(null);
  const isDraft = !guestPreview && account?.pageStatus === 'draft';

  useEffect(() => {
    if (staffEdit || guestPreview || !isDraft) {
      setDesignOffer(null);
      return;
    }

    accountCall('overview')
      .then((overview) => setDesignOffer(overview.design.canPurchase ? { priceSar: overview.design.priceSar } : null))
      .catch(() => undefined);
  }, [staffEdit, guestPreview, isDraft]);

  const chooseDesignService = () => {
    if (isDirty && !window.confirm('لديك تعديلات غير محفوظة ستُفقد عند الانتقال للسلة. المتابعة؟')) return;
    navigate('/plan-selection?design=1');
  };
  const isPublished = account?.pageStatus === 'published';
  const completionItems = [
    { label: 'اسم للجهة', done: pageData.name.trim().length >= 2 },
    { label: 'تعريف مختصر', done: pageData.bio.trim().length >= 8 },
    { label: 'رابط واحد', done: pageData.links.some((link) => link.display?.kind !== 'heading' && !link.hidden && link.title.trim() && link.url.trim()) },
  ];
  const missingItems = completionItems.filter((item) => !item.done);
  const completionCount = completionItems.length - missingItems.length;
  const pageStatusLabel = isDirty ? 'تعديلات غير محفوظة' : isPublished ? 'منشورة الآن' : 'مسودة محفوظة';

  const applyQuickWallpaper = (value: string) => {
    setUndoWallpaper(pageData.wallpaper);
    setUndoTheme(null);
    setDesignNotice('تم تطبيق الخلفية');
    updateWallpaper({ type: 'gradient', value });
  };

  const noteThemeChange = (themeName: string) => {
    setUndoTheme(pageData.theme);
    setUndoWallpaper(null);
    setDesignNotice(`تم تطبيق ثيم ${themeName}`);
  };

  useEffect(() => {
    if (!loadingPage && !isAuthenticated && !guestPreview) {
      if (staffEdit) {
        staffEdit.onExit();
      } else {
        navigate('/login');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loadingPage, navigate, guestPreview]);

  // PAGE-07: nothing reaches the public page until this explicit save.
  const handleSave = async () => {
    if (guestPreview) return;

    try {
      setSaveError('');
      await save();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'تعذر حفظ التعديلات.');
    }
  };

  const handleShare = () => {
    navigate('/plan-selection');
  };

  const [shareNotice, setShareNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const sharePage = async () => {
    const url = pageUrl(pageData.username);
    try {
      if (navigator.share) {
        await navigator.share({ title: pageData.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNotice('تم نسخ الرابط');
    } catch {
      // the share sheet was dismissed
    }
  };

  const restore = (version: SavedVersion) => {
    if (isDirty && !window.confirm('استرجاع هذا التصميم؟ ستُستبدل تعديلاتك غير المحفوظة.')) return;
    restoreVersion(version.data);
    setShowHistory(false);
  };

  const renderVersion = (version: SavedVersion, wide = false) => (
    <button key={version.savedAt} onClick={() => restore(version)} className={`${wide ? 'w-full' : 'w-[31%]'} shrink-0 text-right transition-transform active:scale-[0.97]`}>
      <span className="relative block aspect-[9/19] overflow-hidden rounded-[22px] border-4 border-[#d1d1d6] opacity-90 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
        <span className="absolute right-0 top-0 block w-[400%] origin-top-right scale-[0.25] [&>div]:!min-h-[1500px] [&>div]:!rounded-none [&>div]:!shadow-none"><PageView data={version.data} variant="preview" /></span>
      </span>
      <span className="mt-1.5 block text-center text-[11px] font-bold text-[#6e6e73]">{new Date(version.savedAt).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' })}</span>
    </button>
  );

  const openPanel = (tab: Tab) => {
    setActiveTab(tab);
    setMobilePanel(tab);
  };

  const tabs = [
    { id: 'header' as Tab, label: 'الهوية', icon: User },
    { id: 'links' as Tab, label: 'الروابط', icon: Link2 },
    { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon },
    { id: 'style' as Tab, label: 'الأسلوب', icon: Sparkles },
    { id: 'account' as Tab, label: 'الحساب', icon: Settings },
  ].filter((tab) => (!staffEdit && !guestPreview) || tab.id !== 'account');

  const renderActivePanel = () => {
    // Themes live inside «الخلفية» now; 'theme' just opens it on that segment.
    if (activeTab === 'theme') {
      return <WallpaperEditor key="themes" initialSegment="themes" onThemeSelected={noteThemeChange} />;
    }

    if (activeTab === 'header') {
      return <HeaderEditor />;
    }

    if (activeTab === 'links') {
      return <LinkEditor />;
    }

    if (activeTab === 'wallpaper') {
      const segment = pageData.wallpaper.type === 'video' ? 'video' : pageData.wallpaper.type === 'image' ? 'photo' : pageData.wallpaper.type === 'gradient' ? 'gradients' : 'colors';
      return <WallpaperEditor key="wallpaper" initialSegment={segment} onThemeSelected={noteThemeChange} />;
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

  if (!isAuthenticated && !guestPreview) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" dir="rtl">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              if (!staffEdit) return navigate('/');
              if (!isDirty || window.confirm('لديك تعديلات غير محفوظة ستُفقد. الخروج؟')) staffEdit.onExit();
            }}
            className={`${staffEdit ? '' : 'hidden sm:block '}p-2 hover:bg-gray-100 rounded-lg transition-all`}
            title={staffEdit ? 'العودة إلى لوحة الإدارة' : 'العودة للرئيسية'}
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          {staffEdit && (
            <div className="text-base font-bold text-emerald-600 sm:text-xl" style={{ fontFamily: 'Cairo, sans-serif' }}>
              تعديل صفحة عميل
            </div>
          )}
          <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
          <div className="text-xs sm:text-sm text-gray-600 hidden sm:block" style={{ fontFamily: 'Tajawal, sans-serif' }} dir="ltr">
            {pageData.username ? pageHost(pageData.username) : guestUsername ? pageHost(guestUsername) : ''}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {!staffEdit && !guestPreview && <QRCodeDisplay username={pageData.username} />}
          {guestPreview && (
            <button
              onClick={() => setShowGuestAuth(true)}
              className="flex h-10 items-center rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-95"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              title="أنشئ حسابك لحفظ صفحتك"
            >
              حفظ صفحتي
            </button>
          )}
          <button
            hidden={Boolean(staffEdit || guestPreview)}
            onClick={() => navigate('/preview')}
            className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-gray-100 px-2.5 sm:px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
            title="معاينة التعديلات قبل الحفظ"
          >
            <Eye className="h-5 w-5" />
            <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
              معاينة
            </span>
          </button>
          {isPublished && (
            <a
              href={pageUrl(pageData.username)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-gray-100 px-2.5 sm:px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
              title="افتح الصفحة المنشورة كما يراها الجمهور"
            >
              <ExternalLink className="h-5 w-5" />
              <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
                الصفحة المنشورة
              </span>
            </a>
          )}
          {designOffer && (
            <button
              onClick={chooseDesignService}
              className="flex h-10 w-[104px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-l from-violet-600 via-fuchsia-500 to-orange-400 text-sm font-bold text-white shadow-[0_4px_14px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              title={`فريق ${BRAND_NAME} يصمم صفحتك عنك${designOffer.priceSar !== null ? ` بـ ${designOffer.priceSar} ريال` : ''}`}
            >
              <Sparkles className="h-4 w-4" />
              صمّم لي
            </button>
          )}
          {!guestPreview && (
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="hidden lg:flex h-10 items-center gap-2 bg-gray-900 text-white px-5 rounded-full text-sm font-bold transition-all disabled:bg-gray-200 disabled:text-gray-500"
              title={isPublished ? 'حفظ التعديلات ونشرها للجمهور' : 'حفظ التعديلات'}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {saving ? 'جاري الحفظ...' : isDirty ? 'حفظ التعديلات' : isPublished ? 'منشورة' : 'مسودة محفوظة'}
              </span>
            </button>
          )}
          {!guestPreview && account?.pageStatus === 'draft' && (
            <button
              onClick={handleShare}
              className="flex h-10 w-[104px] items-center justify-center gap-1.5 bg-gradient-to-r from-lime-500 to-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-95 rounded-full text-sm font-bold hover:shadow-lg transition-all"
              title="اشترك لنشر الصفحة للجمهور"
            >
              <span style={{ fontFamily: 'Cairo, sans-serif' }}>التالي</span>
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

      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto scroll-smooth bg-[#f5f5f7]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <main className="mx-auto max-w-md space-y-7 px-4 pb-10 pt-5">
          {/* Apple-style row of round shortcuts, scrolls sideways */}
          <section className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'header' as Tab, label: 'الهوية', icon: User, tone: 'bg-[#7cc4ff] text-[#0b4fa8]' },
              { id: 'links' as Tab, label: 'الروابط', icon: Link2, tone: 'bg-[#c9a6f5] text-[#5b21b6]' },
              { id: 'style' as Tab, label: 'الأسلوب', icon: Sparkles, tone: 'bg-[#ffad4d] text-[#9a3412]' },
              { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon, tone: 'bg-[#1d1d1f] text-white' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => openPanel(item.id)} className="flex w-[68px] shrink-0 snap-start flex-col items-center gap-2 transition-transform active:scale-95">
                  <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-full shadow-sm ${item.tone}`}><Icon className="h-7 w-7" /></span>
                  <span className="text-xs font-bold text-[#3a3a3c]" style={{ fontFamily: 'Cairo, sans-serif' }}>{item.label}</span>
                </button>
              );
            })}
          </section>

          <section>
            <h2 className="mb-3 px-1 text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>الشكل الحالي</h2>
            <div className="flex items-stretch gap-2.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <button onClick={() => (staffEdit || guestPreview ? openPanel('header') : navigate('/preview'))} className="w-[40%] shrink-0 text-right transition-transform active:scale-[0.98]">
                <PhonePreview interactive={false} />
                <span className="mt-2 block text-center text-xs font-bold text-[#3a3a3c]">{isDirty ? 'الحالي · غير محفوظ' : 'الحالي'}</span>
              </button>

              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                {[
                  {
                    label: saving ? 'جارٍ…' : 'حفظ',
                    icon: Save,
                    onClick: guestPreview ? () => setShowGuestAuth(true) : handleSave,
                    disabled: !guestPreview && (!isDirty || saving),
                    primary: true,
                  },
                  {
                    // Drops the unsaved changes and goes back to the last saved version.
                    label: 'رجوع',
                    icon: Undo2,
                    onClick: () => {
                      if (savedPageData && window.confirm('إلغاء التعديلات غير المحفوظة والرجوع لآخر نسخة محفوظة؟')) replacePageData(savedPageData);
                    },
                    disabled: !isDirty || !savedPageData,
                    primary: false,
                  },
                  ...(staffEdit
                    ? []
                    : [{
                        label: isPublished ? 'مشاركة' : 'نشر',
                        icon: isPublished ? Share2 : ArrowLeft,
                        onClick: isPublished ? sharePage : guestPreview ? () => setShowGuestAuth(true) : handleShare,
                        disabled: false,
                        primary: false,
                      }]),
                  ...(staffEdit || guestPreview
                    ? []
                    : [{ label: 'الإعدادات', icon: Settings, onClick: () => openPanel('account'), disabled: false, primary: false }]),
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button key={action.label} onClick={action.onClick} disabled={action.disabled} className="group flex flex-col items-center gap-1.5 disabled:opacity-40">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform group-active:scale-90 ${action.primary && !action.disabled ? 'bg-emerald-600 text-white shadow-[0_6px_14px_rgba(5,150,105,0.35)]' : 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.08)]'}`}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <span className="text-[11px] font-bold text-[#3a3a3c]">{action.label}</span>
                    </button>
                  );
                })}
                {shareNotice && <p className="text-center text-[10px] font-bold text-emerald-700">{shareNotice}</p>}
              </div>

              <div className="w-[30%] shrink-0 self-center">
                {savedHistory[0] ? (
                  renderVersion(savedHistory[0], true)
                ) : (
                  <div className="flex aspect-[9/19] flex-col items-center justify-center gap-2 rounded-[22px] bg-[#e9e9ee] p-3 text-center">
                    <History className="h-6 w-6 text-[#aeaeb2]" />
                    <span className="text-[11px] font-bold leading-4 text-[#8e8e93]">لا توجد تصاميم سابقة</span>
                  </div>
                )}
                {savedHistory.length > 1 ? (
                  <button onClick={() => setShowHistory(true)} className="mt-2 block w-full text-center text-xs font-bold text-emerald-700">السابقة ({savedHistory.length})</button>
                ) : (
                  <span className="mt-2 block text-center text-xs font-bold text-[#8e8e93]">السابق</span>
                )}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between px-1">
              <h2 className="text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>مميزة</h2>
              <button onClick={() => openPanel('theme')} className="text-sm font-bold text-emerald-700">عرض الكل</button>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {themes.map((theme) => {
                const isSelected = pageData.theme.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (isSelected) return;
                      noteThemeChange(theme.name);
                      updateTheme(theme);
                    }}
                    className="w-[31%] shrink-0 snap-start text-right transition-transform active:scale-[0.97]"
                  >
                    <span className={`relative block aspect-[9/19] overflow-hidden rounded-[22px] border shadow-[0_8px_18px_rgba(15,23,42,0.14)] ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-400/70 ring-offset-2' : 'border-black/5'}`} style={{ background: theme.background }}>
                      <span className="absolute inset-x-0 top-3 text-center text-lg font-bold tracking-tight" style={{ color: theme.textColor }}>9:41</span>
                      <span className="absolute left-1/2 top-12 h-7 w-7 -translate-x-1/2 rounded-full opacity-30" style={{ backgroundColor: theme.textColor }} />
                      {[0, 1, 2].map((row) => (
                        <span key={row} className="absolute inset-x-3 h-4 rounded-lg" style={{ top: `${50 + row * 13}%`, backgroundColor: theme.buttonColor }} />
                      ))}
                      {isSelected && <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-3.5 w-3.5" /></span>}
                    </span>
                    <span className="mt-2 block truncate text-center text-xs font-bold text-[#3a3a3c]">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between px-1">
              <h2 className="text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>الخلفيات المقترحة</h2>
              <button onClick={() => openPanel('wallpaper')} className="text-sm font-bold text-emerald-700">تخصيص</button>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { name: 'الخلفية الحالية', style: pageData.wallpaper.type === 'gradient' ? { background: pageData.wallpaper.value } : pageData.wallpaper.type === 'image' ? { backgroundImage: `url(${pageData.wallpaper.value})`, backgroundPosition: pageData.wallpaper.position ?? 'center', backgroundSize: 'cover' } : { backgroundColor: pageData.wallpaper.type === 'video' ? pageData.theme.background : pageData.wallpaper.value, ...(pageData.wallpaper.type === 'video' && pageData.wallpaper.poster ? { backgroundImage: `url(${pageData.wallpaper.poster})`, backgroundSize: 'cover' } : {}) } },
                { name: 'بحر هادئ', value: 'linear-gradient(145deg, #c4ecff 0%, #61a6ff 45%, #1e4ba8 100%)', style: { background: 'linear-gradient(145deg, #c4ecff 0%, #61a6ff 45%, #1e4ba8 100%)' } },
                { name: 'فجر دافئ', value: 'linear-gradient(145deg, #fedb8c 0%, #f5a0b6 45%, #ad78d1 100%)', style: { background: 'linear-gradient(145deg, #fedb8c 0%, #f5a0b6 45%, #ad78d1 100%)' } },
                { name: 'ليل أنيق', value: 'linear-gradient(145deg, #334155 0%, #0f172a 55%, #020617 100%)', style: { background: 'linear-gradient(145deg, #334155 0%, #0f172a 55%, #020617 100%)' } },
                { name: 'غابة هادئة', value: 'linear-gradient(145deg, #d9f99d 0%, #34d399 52%, #047857 100%)', style: { background: 'linear-gradient(145deg, #d9f99d 0%, #34d399 52%, #047857 100%)' } },
                { name: 'رمل ناعم', value: 'linear-gradient(145deg, #fef3c7 0%, #f4c98a 50%, #c49b75 100%)', style: { background: 'linear-gradient(145deg, #fef3c7 0%, #f4c98a 50%, #c49b75 100%)' } },
              ].map((wallpaper) => {
                const isSelected = !!wallpaper.value && pageData.wallpaper.type === 'gradient' && pageData.wallpaper.value === wallpaper.value;
                return (
                <button
                  key={wallpaper.name}
                  onClick={() => {
                    if (wallpaper.value) {
                      applyQuickWallpaper(wallpaper.value);
                      return;
                    }
                    openPanel('wallpaper');
                  }}
                  className="w-[31%] shrink-0 snap-start text-right transition-transform active:scale-[0.97]"
                >
                  <span className={`relative block aspect-[9/19] overflow-hidden rounded-[22px] border shadow-[0_10px_20px_rgba(15,23,42,0.14)] transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-400/70 ring-offset-2' : 'border-white/70'}`} style={wallpaper.style}>
                    <span className="absolute inset-x-3 top-3 text-center text-lg font-bold tracking-tight text-white/90 drop-shadow-sm">9:41</span>
                    <span className="absolute inset-x-4 top-10 h-1.5 rounded-full bg-white/45" />
                    <span className="absolute inset-x-3 bottom-8 h-7 rounded-2xl bg-white/35 backdrop-blur-sm" />
                    <span className="absolute inset-x-3 bottom-3 h-4 rounded-full bg-white/35" />
                    {isSelected && <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-4 w-4" /></span>}
                  </span>
                  <span className="mt-2 block truncate px-0.5 text-center text-xs font-bold text-[#3a3a3c]">{wallpaper.name}</span>
                </button>
                );
              })}
            </div>
          </section>

        </main>

        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/35" onClick={() => setShowHistory(false)}>
            <section className="max-h-[88vh] w-full overflow-hidden rounded-t-[30px] bg-[#f7f7f8]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
                <button onClick={() => setShowHistory(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8ed] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
                <h2 className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>الأشكال السابقة</h2>
                <span className="w-9" />
              </div>
              <p className="px-5 pt-3 text-xs text-[#6e6e73]">اضغط على تصميم لإرجاعه إلى المحرر، ثم احفظ إن أعجبك.</p>
              <div className="grid max-h-[calc(88vh-90px)] grid-cols-3 gap-3 overflow-y-auto p-5">
                {savedHistory.map((version) => renderVersion(version, true))}
              </div>
            </section>
          </div>
        )}

        {mobilePanel && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/35" onClick={() => setMobilePanel(null)}>
            <section
              className={`w-full overflow-hidden rounded-t-[30px] bg-[#f7f7f8] shadow-[0_-12px_40px_rgba(0,0,0,0.2)] h-[94dvh] max-h-[94dvh]`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-black/5 bg-[#f7f7f8]/95 px-5 pb-3 pt-2 backdrop-blur">
                <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[#c7c7cc]" />
                <div className="flex items-center justify-between">
                  <button onClick={() => setMobilePanel(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8ed] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
                  <h2 className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{mobilePanel === 'theme' ? 'الخلفية' : tabs.find((tab) => tab.id === mobilePanel)?.label}</h2>
                  <button onClick={() => setMobilePanel(null)} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700" style={{ fontFamily: 'Cairo, sans-serif' }}>تم</button>
                </div>
              </div>
              <div className={`overflow-y-auto scroll-smooth h-[calc(94dvh-74px)] bg-[#f2f2f7]`}>{renderActivePanel()}</div>
            </section>
          </div>
        )}

        {(undoWallpaper || undoTheme) && (
          <div className={`fixed inset-x-4 z-[60] mx-auto max-w-sm rounded-2xl bg-[#1d1d1f] p-3 text-white shadow-2xl bottom-5`} role="status">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm">{designNotice}</span>
              <button
                onClick={() => {
                  if (undoWallpaper) updateWallpaper(undoWallpaper);
                  if (undoTheme) updateTheme(undoTheme);
                  setUndoWallpaper(null);
                  setUndoTheme(null);
                  setDesignNotice('');
                }}
                className="rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black text-white"
              >تراجع</button>
              <button onClick={() => { setUndoWallpaper(null); setUndoTheme(null); setDesignNotice(''); }} className="text-white/70" aria-label="إغلاق الرسالة"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {(undoWallpaper || undoTheme) && (
        <div className="fixed bottom-6 left-6 z-[60] hidden w-[320px] rounded-2xl bg-[#1d1d1f] p-3 text-white shadow-2xl lg:block" role="status">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm">{designNotice}</span>
            <button
              onClick={() => {
                if (undoWallpaper) updateWallpaper(undoWallpaper);
                if (undoTheme) updateTheme(undoTheme);
                setUndoWallpaper(null);
                setUndoTheme(null);
                setDesignNotice('');
              }}
              className="rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black text-white"
            >تراجع</button>
            <button onClick={() => { setUndoWallpaper(null); setUndoTheme(null); setDesignNotice(''); }} className="text-white/70" aria-label="إغلاق الرسالة"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

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
                  hidden={Boolean(staffEdit || guestPreview)}
                  onClick={() => navigate('/preview')}
                  className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Eye className="h-4 w-4" />
                  <span>فتح المعاينة</span>
                </button>
              </div>

              <div className="mx-auto w-full max-w-[420px]">
                <PhonePreview />
                <p className="mt-3 text-center text-xs text-gray-500">نفس تنسيق الصفحة الفعلية، مصغّر بالكامل. مرّر داخل المعاينة لرؤية بقية المحتوى.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 50 }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
            <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              مرحبًا بك في {BRAND_NAME} 👋
            </h3>
            <p className="text-sm text-gray-600 mb-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              كيف تحب تجهيز صفحة جهتك؟
            </p>

            <div className="space-y-3">
              {designOffer && (
                <button
                  onClick={chooseDesignService}
                  className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-right transition-all hover:bg-emerald-100"
                >
                  <div className="flex items-center gap-2 text-base font-bold text-emerald-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <Sparkles className="w-5 h-5" />
                    صمّم لي
                  </div>
                  <p className="mt-1 text-xs text-emerald-900" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                    فريق {BRAND_NAME} يصمم الصفحة عنك لمرة واحدة ويعتمدها معك عبر واتساب
                    {designOffer.priceSar !== null ? ` — ${designOffer.priceSar} ريال تُدفع مع الاشتراك` : ''}.
                  </p>
                </button>
              )}

              <button
                onClick={() => setShowWelcome(false)}
                className="w-full rounded-xl border-2 border-gray-200 p-4 text-right transition-all hover:border-gray-300"
              >
                <div className="flex items-center gap-2 text-base font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <Palette className="w-5 h-5" />
                  سأصمّم بنفسي
                </div>
                <p className="mt-1 text-xs text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  اختر الثيم وأضف الشعار والتعريف والروابط. التغييرات تظهر في المعاينة فورًا ولا تصل للجمهور إلا بعد «حفظ»، والصفحة تُنشر بعد إتمام الاشتراك.
                </p>
              </button>
            </div>

            {designOffer && (
              <p className="mt-4 text-center text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                خيار «صمّم لي» يبقى ظاهرًا أعلى المحرر إن غيّرت رأيك لاحقًا.
              </p>
            )}
          </div>
        </div>
      )}
      {guestPreview && showGuestAuth && <AuthModal mode="signup" username={guestUsername} />}
    </div>
  );
}
