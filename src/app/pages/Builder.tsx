import { nonprofitPath } from '../lib/nonprofit';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageData, SavedVersion, themes, usePageContext } from '../context/PageContext';
import { PhonePreview } from '../components/PhonePreview';
import { PageView } from '../components/PageView';
import { wallpaperFocus } from '../components/WallpaperImage';
import { HeaderEditor } from '../components/HeaderEditor';
import { WallpaperEditor } from '../components/WallpaperEditor';
import { StyleEditor } from '../components/StyleEditor';
import { LinkEditor } from '../components/LinkEditor';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { AccountPanel } from '../components/AccountPanel';
import { accountCall } from '../lib/api';
import { BRAND_NAME, pageHost, pageUrl } from '../lib/site';
import { User, Image as ImageIcon, Sparkles, Link2, Eye, ArrowLeft, Save, Settings, X, Check, Undo2, Redo2, History, Loader2, RotateCw } from 'lucide-react';
import { EmailVerifyChip } from '../components/EmailVerifyChip';
import AuthModal from '../components/AuthModal';
import { DesignServiceSheet } from '../components/DesignServiceSheet';
import { TemporaryPasswordGate } from '../components/TemporaryPasswordGate';

export type Tab = 'theme' | 'header' | 'wallpaper' | 'style' | 'links' | 'account';

// A product built on this editor (e.g. the nonprofit editor) narrows or
// renames its sections here. Without it the general editor is unchanged.
export type EditorConfig = { sections?: Tab[]; labels?: Partial<Record<Tab, string>>; logoZoomOut?: boolean; logoBanner?: boolean };

// `staffEdit` is set when an employee edits a customer's page from the
// administration panel (PERM-01): same editor, without the owner-only parts.
export default function Builder({ staffEdit, editor }: { staffEdit?: { onExit: () => void; title?: string; onContinue?: () => void; continueLabel?: string; exitLabel?: string }; editor?: EditorConfig }) {
  const showSection = (item: { id: Tab }) => !editor?.sections || editor.sections.includes(item.id);
  const withLabel = <T extends { id: Tab; label: string }>(item: T): T => ({ ...item, label: editor?.labels?.[item.id] ?? item.label });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guestPreview = searchParams.get('onboarding') === 'signup';
  const guestUsername = (searchParams.get('username') || '').trim().toLowerCase();
  const [activeTab, setActiveTab] = useState<Tab>(editor?.sections?.[0] ?? 'header');
  const [mobilePanel, setMobilePanel] = useState<Tab | null>(null);
  const [designNotice, setDesignNotice] = useState('');
  const { pageData, savedHistory, restoreVersion, restoreDraft, undo, redo, canUndo, canRedo, account, isAuthenticated, loadingPage, isDirty, saving, save, updateTheme, updateWallpaper, draftState } = usePageContext();
  // REQ-015: what has happened to unpublished edits, in a few words.
  const draftLabel = draftState === 'saving' ? 'يحفظ المسودة…' : draftState === 'saved' ? 'محفوظة كمسودة ✓ — غير منشورة' : draftState === 'limit' ? 'وصلت للحد اليومي للحفظ' : draftState === 'error' ? 'تعذر حفظ المسودة' : 'تعديلات غير منشورة';
  const [saveError, setSaveError] = useState('');
  // Feedback of the explicit save (PAGE-07): spinner, then «تم الحفظ» briefly.
  const [justSaved, setJustSaved] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [exitPrompt, setExitPrompt] = useState<null | (() => void)>(null);
  // The draft when a panel was opened, so «×» can put it back.
  const [panelStart, setPanelStart] = useState<{ data: PageData } | null>(null);
  // «×» on a window with changes asks once: save them, or leave without them.
  const [panelExitPrompt, setPanelExitPrompt] = useState(false);
  // An add / edit form in «المحتوى» with input not yet added to the page.
  const [contentFormPending, setContentFormPending] = useState(false);
  // Note 28: a green «تم الحفظ» once the server confirmed, or the error with a retry.
  const [saveToast, setSaveToast] = useState<null | { kind: 'saved' } | { kind: 'error'; message: string }>(null);
  // «صمّم لي» stays on offer while it can be ordered (note 40): a page not yet
  // published takes it through the cart; a subscribed page orders it directly.
  const [designOffer, setDesignOffer] = useState<{ priceSar: number | null } | null>(null);
  const [designSheet, setDesignSheet] = useState(false);
  const isDraft = !guestPreview && account?.pageStatus === 'draft';
  useEffect(() => { if (!staffEdit && account?.kind === 'nonprofit') navigate(nonprofitPath('builder'), { replace: true }); }, [account?.kind, staffEdit, navigate]);
  const hasAccount = Boolean(account) && !guestPreview && !staffEdit;

  useEffect(() => {
    if (!hasAccount) {
      setDesignOffer(null);
      return;
    }

    accountCall('overview')
      .then((overview) => setDesignOffer(overview.design.canPurchase ? { priceSar: overview.design.priceSar } : null))
      .catch(() => undefined);
  }, [hasAccount, designSheet]);

  // Unsaved edits get the usual save-or-leave choice before the cart opens.
  const chooseDesignService = () => leave(() => navigate('/plan-selection?design=1'));
  const isPublished = account?.pageStatus === 'published';

  const applyQuickWallpaper = (value: string) => {
    setDesignNotice('تم تطبيق الخلفية');
    updateWallpaper({ type: 'gradient', value });
  };

  const noteThemeChange = (themeName: string) => {
    setDesignNotice(`تم تطبيق ثيم ${themeName}`);
  };

  // Short confirmations disappear on their own.
  useEffect(() => {
    if (!designNotice) return;
    const timer = window.setTimeout(() => setDesignNotice(''), 2000);
    return () => window.clearTimeout(timer);
  }, [designNotice]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1500);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  useEffect(() => {
    if (saveToast?.kind !== 'saved') return;
    const timer = window.setTimeout(() => setSaveToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [saveToast]);

  // Signed out: the editor stays on screen and, after a short look, the login
  // opens over it; after login the person carries on here.
  useEffect(() => {
    if (loadingPage || isAuthenticated || guestPreview) {
      setShowLogin(false);
      return;
    }
    if (staffEdit) {
      staffEdit.onExit();
      return;
    }
    const timer = window.setTimeout(() => setShowLogin(true), 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loadingPage, guestPreview]);

  // PAGE-07: nothing reaches the public page until this explicit save.
  // Resolves true only once the server confirmed the save — no early «تم».
  const handleSave = async () => {
    if (guestPreview || !isAuthenticated) return false;

    try {
      setSaveError('');
      if (saveToast?.kind === 'error') setSaveToast(null);
      await save();
      setJustSaved(true);
      setSaveToast({ kind: 'saved' });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ التعديلات.';
      setSaveError(message);
      setSaveToast({ kind: 'error', message });
      return false;
    }
  };

  // ⌘Z / ⇧⌘Z (Ctrl on Windows) outside text fields, where the browser's own undo applies.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Leaving the editor: wait for a running save, and offer to save first.
  const leave = (go: () => void) => {
    if (saving) {
      setExitPrompt(() => go);
      return;
    }
    if (isDirty && isAuthenticated && !guestPreview) {
      setExitPrompt(() => go);
      return;
    }
    go();
  };

  const handleShare = () => {
    navigate('/plan-selection');
  };

  const [showHistory, setShowHistory] = useState(false);

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

  // Undo and redo are one pair; the save sits apart with its own state, so the
  // two are never confused.
  const renderEditActions = (horizontal = false) => {
    const saveState = saving ? 'saving' : saveError ? 'error' : justSaved ? 'saved' : isDirty ? 'dirty' : 'clean';
    const round = 'flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-transform active:scale-90 disabled:opacity-35';
    const saveLabel = saveState === 'saving' ? 'يحفظ…' : saveState === 'saved' ? 'تم الحفظ' : saveState === 'error' ? 'إعادة المحاولة' : saveState === 'dirty' ? 'حفظ' : 'محفوظ';
    const saveIcon = saveState === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : saveState === 'saved' ? <Check className="h-5 w-5" /> : saveState === 'error' ? <RotateCw className="h-5 w-5" /> : <Save className="h-5 w-5" />;

    // Note 59 (desktop bar): a wide green «حفظ» with its icon, and quieter undo / redo.
    if (horizontal) {
      const small = 'flex h-9 w-9 items-center justify-center rounded-full text-[#3a3a3c] transition-colors hover:bg-[#f2f2f7] active:scale-90 disabled:opacity-30';
      return (
        <div className="flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {!guestPreview && isAuthenticated && (
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}
              className={`flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-all active:scale-[0.97] ${
                saveState === 'error' ? 'bg-[#ff3b30] text-white' : saveState === 'dirty' || saveState === 'saving' ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(5,150,105,0.3)] hover:bg-emerald-700' : saveState === 'saved' ? 'bg-[#34c759] text-white' : 'bg-emerald-50 text-emerald-700/60'
              }`}
            >
              {saveIcon}
              {saveLabel}
            </button>
          )}
          <span className="mx-1 h-6 w-px bg-[#e5e5ea]" aria-hidden="true" />
          <button onClick={undo} disabled={!canUndo} className={small} aria-label="تراجع" title="تراجع عن آخر تعديل"><Undo2 className="h-[18px] w-[18px]" /></button>
          <button onClick={redo} disabled={!canRedo} className={small} aria-label="إعادة" title="إعادة التعديل"><Redo2 className="h-[18px] w-[18px]" /></button>
        </div>
      );
    }

    return (
      <div className={`flex items-center ${horizontal ? 'gap-3' : 'flex-col gap-5'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className={`flex ${horizontal ? 'gap-2' : 'flex-col items-center gap-2'}`}>
          <button onClick={undo} disabled={!canUndo} className={round} aria-label="تراجع" title="تراجع عن آخر تعديل"><Undo2 className="h-5 w-5" /></button>
          <button onClick={redo} disabled={!canRedo} className={round} aria-label="إعادة" title="إعادة التعديل"><Redo2 className="h-5 w-5" /></button>
        </div>
        {!guestPreview && isAuthenticated && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'clean' || saveState === 'saved'}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-all active:scale-90 ${
                saveState === 'error' ? 'bg-[#ff3b30]' : saveState === 'dirty' ? 'bg-emerald-600 shadow-[0_6px_14px_rgba(5,150,105,0.35)]' : saveState === 'saved' ? 'bg-[#34c759]' : saveState === 'saving' ? 'bg-emerald-600' : 'bg-[#d1d1d6]'
              }`}
              aria-label="حفظ"
            >
              {saveState === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : saveState === 'saved' ? <Check className="h-6 w-6" /> : saveState === 'error' ? <RotateCw className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            </button>
            <span className={`text-[11px] font-bold ${saveState === 'error' ? 'text-[#ff3b30]' : saveState === 'saved' ? 'text-[#34c759]' : 'text-[#3a3a3c]'}`}>
              {saveState === 'saving' ? 'يحفظ…' : saveState === 'saved' ? 'تم الحفظ' : saveState === 'error' ? 'إعادة المحاولة' : saveState === 'dirty' ? 'حفظ' : 'محفوظ'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // «مميزة» and «الخلفيات المقترحة»: on the phone under the current look; on
  // the desktop (note 3) as a gallery under the editor, more cards in a row.
  const renderGalleries = (desktop: boolean) => {
    const card = desktop ? 'w-[132px]' : 'w-[31%]';
    return (
      <>
            <section>
              <div className="mb-3 flex items-end justify-between px-1">
                <h2 className="text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>مميزة</h2>
                <button onClick={() => (desktop ? setActiveTab('theme') : openPanel('theme'))} className="text-sm font-bold text-emerald-700">عرض الكل</button>
              </div>
              <div className={desktop ? "flex snap-x gap-4 overflow-x-auto pb-3" : "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
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
                      className={`${card} shrink-0 snap-start text-right transition-transform active:scale-[0.97]`}
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
                <button onClick={() => (desktop ? setActiveTab('wallpaper') : openPanel('wallpaper'))} className="text-sm font-bold text-emerald-700">عرض الكل</button>
              </div>
              <div className={desktop ? "flex snap-x gap-4 overflow-x-auto pb-3" : "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
                {[
                  { name: 'الخلفية الحالية', style: pageData.wallpaper.type === 'gradient' ? { background: pageData.wallpaper.value } : pageData.wallpaper.type === 'image' ? { backgroundImage: `url(${pageData.wallpaper.value})`, backgroundPosition: `${wallpaperFocus(pageData.wallpaper).x}% ${wallpaperFocus(pageData.wallpaper).y}%`, backgroundSize: 'cover' } : { backgroundColor: pageData.wallpaper.type === 'video' ? pageData.theme.background : pageData.wallpaper.value, ...(pageData.wallpaper.type === 'video' && pageData.wallpaper.poster ? { backgroundImage: `url(${pageData.wallpaper.poster})`, backgroundSize: 'cover' } : {}) } },
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
                      if (desktop) setActiveTab('wallpaper'); else openPanel('wallpaper');
                    }}
                    className={`${card} shrink-0 snap-start text-right transition-transform active:scale-[0.97]`}
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

      </>
    );
  };

  const openPanel = (tab: Tab) => {
    setActiveTab(tab);
    setMobilePanel(tab);
    setPanelStart({ data: pageData });
    setPanelExitPrompt(false);
  };

  const closePanel = () => {
    setMobilePanel(null);
    setPanelStart(null);
    setPanelExitPrompt(false);
  };

  const panelChanged = Boolean(panelStart && pageData !== panelStart.data);

  // «احفظ تعديلاتي»: the window closes at once and the save carries on; the
  // green confirmation (or the error with a retry) follows from the server.
  const finishPanel = () => {
    if (contentFormPending && !panelExitPrompt) {
      setPanelExitPrompt(true);
      return;
    }
    const needsSave = isDirty && !guestPreview && isAuthenticated && mobilePanel !== 'account';
    closePanel();
    if (needsSave) void handleSave();
  };

  // «×»: closes straight away unless this window changed something.
  const cancelPanel = () => {
    if (panelChanged || contentFormPending) {
      setPanelExitPrompt(true);
      return;
    }
    closePanel();
  };

  const discardPanel = () => {
    if (panelStart) restoreDraft(panelStart.data);
    closePanel();
  };

  const tabs = [
    { id: 'header' as Tab, label: 'الهوية', icon: User },
    { id: 'links' as Tab, label: 'المحتوى', icon: Link2 },
    { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon },
    { id: 'style' as Tab, label: 'الأسلوب', icon: Sparkles },
    { id: 'account' as Tab, label: 'الإعدادات', icon: Settings },
  ].filter((tab) => (!staffEdit && !guestPreview) || tab.id !== 'account').filter(showSection).map(withLabel);

  const renderActivePanel = () => {
    // Themes live inside «الخلفية» now; 'theme' just opens it on that segment.
    if (activeTab === 'theme') {
      return <WallpaperEditor key="themes" initialSegment="themes" onThemeSelected={noteThemeChange} />;
    }

    if (activeTab === 'header') {
      return <HeaderEditor logoZoomOut={editor?.logoZoomOut} logoBanner={editor?.logoBanner} />;
    }

    if (activeTab === 'links') {
      return <LinkEditor onPendingChange={setContentFormPending} />;
    }

    if (activeTab === 'wallpaper') {
      // Note 26: «ثيمات» is what the background opens on.
      return <WallpaperEditor key="wallpaper" initialSegment="themes" onThemeSelected={noteThemeChange} />;
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

  if (!staffEdit && account?.kind === 'nonprofit') return null;

  if (!isAuthenticated && staffEdit) {
    return null;
  }

  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col bg-gray-50" dir="rtl">
      <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-white px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Exit, first in the header (top right in RTL), on every screen size. */}
          <button
            onClick={() => leave(() => (staffEdit ? staffEdit.onExit() : navigate('/')))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-transform active:scale-95"
            aria-label={staffEdit ? (staffEdit.exitLabel ?? 'العودة إلى لوحة الإدارة') : 'الخروج من المحرر'}
            title={staffEdit ? (staffEdit.exitLabel ?? 'العودة إلى لوحة الإدارة') : 'الخروج من المحرر'}
          >
            <X className="h-5 w-5" />
          </button>
          {staffEdit && (
            <div className="text-base font-bold text-emerald-600 sm:text-xl" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {staffEdit.title ?? 'تعديل صفحة عميل'}
            </div>
          )}
          <div className="hidden truncate text-sm text-gray-500 sm:block" style={{ fontFamily: 'Tajawal, sans-serif' }} dir="ltr">
            {pageData.username ? pageHost(pageData.username) : guestUsername ? pageHost(guestUsername) : ''}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {staffEdit?.onContinue && <button type="button" onClick={async () => { if (await handleSave()) staffEdit.onContinue?.(); }} disabled={saving || loadingPage} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{staffEdit.continueLabel ?? 'التالي'}</button>}
          {account && !account.emailVerified && !guestPreview && !staffEdit ? (
            // Until the email is confirmed the confirmation takes the header's place.
            <EmailVerifyChip />
          ) : (
            <>
              {!staffEdit && !guestPreview && <QRCodeDisplay username={pageData.username} />}
              {designOffer && (
                <button
                  onClick={() => setDesignSheet(true)}
                  className="flex h-10 w-[104px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-l from-violet-600 via-fuchsia-500 to-orange-400 text-sm font-bold text-white shadow-[0_4px_14px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  title={`فريق ${BRAND_NAME} يصمم صفحتك عنك${designOffer.priceSar !== null ? ` بـ ${designOffer.priceSar} ريال` : ''}`}
                >
                  <Sparkles className="h-4 w-4" />
                  صمّم لي
                </button>
              )}
              {!staffEdit && !guestPreview && account?.pageStatus === 'draft' && (
                <button
                  onClick={() => leave(handleShare)}
                  className="flex h-10 w-[104px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-lime-500 to-emerald-500 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all active:scale-95"
                  title="اشترك لنشر الصفحة للجمهور"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {account?.pageStatus === 'suspended' && isAuthenticated && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 sm:text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          صفحتك موقوفة من الإدارة وغير ظاهرة للجمهور. التفاصيل في «الإعدادات».
        </div>
      )}

      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto scroll-smooth bg-[#f5f5f7]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <main className="mx-auto max-w-md space-y-7 px-4 pb-10 pt-5">
          {/* Apple-style row of round shortcuts, scrolls sideways */}
          <section className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'header' as Tab, label: 'الهوية', icon: User, tone: 'bg-[#7cc4ff] text-[#0b4fa8]' },
              { id: 'links' as Tab, label: 'المحتوى', icon: Link2, tone: 'bg-[#c9a6f5] text-[#5b21b6]' },
              { id: 'style' as Tab, label: 'الأسلوب', icon: Sparkles, tone: 'bg-[#ffad4d] text-[#9a3412]' },
              { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon, tone: 'bg-[#1d1d1f] text-white' },
              ...(staffEdit || guestPreview || !isAuthenticated ? [] : [{ id: 'account' as Tab, label: 'الإعدادات', icon: Settings, tone: 'bg-[#d1d1d6] text-[#3a3a3c]' }]),
            ].filter(showSection).map(withLabel).map((item) => {
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
                <span className="mt-2 block text-center text-xs font-bold text-[#3a3a3c]">{isDirty ? `الحالي · ${draftLabel}` : 'الحالي'}</span>
              </button>

              <div className="flex flex-1 flex-col items-center justify-center">{renderEditActions()}</div>

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

          {renderGalleries(false)}

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
          // Closed only by «×» or «تم» — never by tapping outside or dragging.
          <div className="fixed inset-0 z-50 flex items-end bg-black/35">
            <section className="h-[94dvh] max-h-[94dvh] w-full overflow-hidden rounded-t-[30px] bg-[#f7f7f8] shadow-[0_-12px_40px_rgba(0,0,0,0.2)]">
              <div className="sticky top-0 z-10 border-b border-black/5 bg-[#f7f7f8]/95 px-5 py-3 backdrop-blur">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <button onClick={cancelPanel} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8ed] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
                  <h2 className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{mobilePanel === 'theme' ? 'الخلفية' : tabs.find((tab) => tab.id === mobilePanel)?.label}</h2>
                  {mobilePanel === 'account' || guestPreview || !isAuthenticated ? <span /> : (
                    <button onClick={finishPanel} className={`justify-self-end rounded-full px-3.5 py-2 text-[13px] font-black transition-colors ${panelChanged ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(5,150,105,0.3)]' : 'bg-emerald-50 text-emerald-700'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      احفظ تعديلاتي
                    </button>
                  )}
                </div>
              </div>
              <div className="h-[calc(94dvh-64px)] overflow-y-auto scroll-smooth bg-[#f2f2f7] pb-[env(safe-area-inset-bottom)]">{renderActivePanel()}</div>
            </section>
          </div>
        )}

      </div>

      {saveToast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4" role={saveToast.kind === 'error' ? 'alert' : 'status'} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {saveToast.kind === 'saved' ? (
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-black/5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34c759] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
              تم الحفظ
            </span>
          ) : (
            <span className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-white py-2 pl-2 pr-4 text-sm text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.16)] ring-1 ring-[#ff3b30]/25">
              <span className="min-w-0 flex-1"><b className="block text-[#ff3b30]">لم تُحفظ التعديلات</b><span className="block truncate text-xs text-[#6e6e73]">{saveToast.message}</span></span>
              <button onClick={() => void handleSave()} disabled={saving} className="shrink-0 rounded-full bg-[#ff3b30] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إعادة المحاولة'}</button>
              <button onClick={() => setSaveToast(null)} aria-label="إغلاق التنبيه" className="shrink-0 rounded-full p-1 text-[#8e8e93]"><X className="h-4 w-4" /></button>
            </span>
          )}
        </div>
      )}

      {panelExitPrompt && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={() => setPanelExitPrompt(false)} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <div className="w-full max-w-[340px] overflow-hidden rounded-[22px] bg-white text-center shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="panel-exit-title">
            <p id="panel-exit-title" className="px-6 pb-1 pt-5 text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{contentFormPending ? 'لم تُضف ما كتبته بعد' : 'لديك تعديلات لم تُحفظ'}</p>
            <p className="px-6 pb-4 text-sm text-[#6e6e73]">{contentFormPending ? 'أكمل العنصر واضغط «إضافة إلى الصفحة» أو «تطبيق التعديل»، ثم احفظ.' : 'احفظها لتظهر في صفحتك، أو اخرج وتعود كما كانت.'}</p>
            <div className="space-y-2 px-4 pb-4">
              {contentFormPending ? (
                <button onClick={() => setPanelExitPrompt(false)} className="block w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold text-white">متابعة التعديل</button>
              ) : (
                <button onClick={finishPanel} className="block w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold text-white">احفظ تعديلاتي</button>
              )}
              <button onClick={discardPanel} className="block w-full rounded-xl bg-[#f2f2f7] py-3 text-[15px] font-bold text-[#ff3b30]">اخرج بدون حفظ</button>
            </div>
          </div>
        </div>
      )}

      {designNotice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status">
          <span className="rounded-full bg-[#1d1d1f]/90 px-4 py-2 text-sm font-bold text-white shadow-xl" style={{ fontFamily: 'Tajawal, sans-serif' }}>{designNotice}</span>
        </div>
      )}

      {/* Desktop: the phone layout's language on a wide screen — a rail of the
          same round sections, the open panel beside it, and the page large. */}
      <div className="hidden min-h-0 flex-1 overflow-y-auto bg-[#f5f5f7] lg:block" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[96px_minmax(380px,440px)_minmax(0,1fr)] gap-6 px-6 py-6">
          <nav className="flex flex-col items-center gap-5 pt-2">
            {[
              { id: 'header' as Tab, label: 'الهوية', icon: User, tone: 'bg-[#7cc4ff] text-[#0b4fa8]' },
              { id: 'links' as Tab, label: 'المحتوى', icon: Link2, tone: 'bg-[#c9a6f5] text-[#5b21b6]' },
              { id: 'style' as Tab, label: 'الأسلوب', icon: Sparkles, tone: 'bg-[#ffad4d] text-[#9a3412]' },
              { id: 'wallpaper' as Tab, label: 'الخلفية', icon: ImageIcon, tone: 'bg-[#1d1d1f] text-white' },
              ...(staffEdit || guestPreview || !isAuthenticated ? [] : [{ id: 'account' as Tab, label: 'الإعدادات', icon: Settings, tone: 'bg-[#d1d1d6] text-[#3a3a3c]' }]),
            ].filter(showSection).map(withLabel).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id || (item.id === 'wallpaper' && activeTab === 'theme');
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className="group flex flex-col items-center gap-1.5">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${item.tone} ${active ? 'scale-105 ring-[3px] ring-[#0a84ff] ring-offset-2 ring-offset-[#f5f5f7]' : 'opacity-80 group-hover:opacity-100'}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className={`text-xs font-bold ${active ? 'text-[#1d1d1f]' : 'text-[#6e6e73]'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-[#f2f2f7] shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04]">
            <div className="border-b border-black/5 bg-white/80 px-6 py-4 backdrop-blur">
              <h2 className="text-xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {activeTab === 'theme' ? 'الخلفية' : tabs.find((tab) => tab.id === activeTab)?.label}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderActivePanel()}</div>
          </aside>

          <section className="flex min-h-0 flex-col items-center gap-4">
            {/* The edit actions come first, on the right where an Arabic reader starts. */}
            <div className="flex w-full items-center justify-between rounded-full bg-white px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              {renderEditActions(true)}
              <div className="flex items-center gap-2 px-2 text-sm text-[#6e6e73]">
                <span className={`h-2 w-2 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-[#34c759]'}`} />
                {isDirty ? draftLabel : isPublished ? 'هذه النسخة المنشورة' : 'كل التعديلات محفوظة'}
              </div>
            </div>
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              <div className="aspect-[390/862] h-full max-h-[780px] max-w-full"><PhonePreview /></div>
            </div>
            {!staffEdit && !guestPreview && isAuthenticated && (
              <button onClick={() => navigate('/preview')} className="flex items-center gap-2 text-sm font-bold text-[#0a84ff]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Eye className="h-4 w-4" />
                فتح المعاينة بملء الشاشة
              </button>
            )}
          </section>
        </div>
        {/* Note 3: the themes gallery, a calm extension below the editor. */}
        <div className="mx-auto max-w-[1400px] space-y-8 px-6 pb-10 pt-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {/* Note 16: the saved earlier versions, as on the phone. */}
          <section>
            <h2 className="mb-3 text-2xl font-black text-[#1d1d1f]">الأشكال السابقة</h2>
            {savedHistory.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-[#6e6e73]">اضغط على تصميم لإرجاعه إلى المحرر، ثم احفظ إن أعجبك.</p>
                <div className="grid grid-cols-6 gap-4 xl:grid-cols-8">{savedHistory.map((version) => renderVersion(version, true))}</div>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-[#e9e9ee] px-4 py-5 text-sm font-bold text-[#8e8e93]">
                <History className="h-5 w-5 text-[#aeaeb2]" />
                لا توجد تصاميم سابقة
              </div>
            )}
          </section>
          {renderGalleries(true)}
        </div>
      </div>

      {!staffEdit && <TemporaryPasswordGate />}

      {designSheet && designOffer && (
        <DesignServiceSheet priceSar={designOffer.priceSar} published={!isDraft} onClose={() => setDesignSheet(false)} onToCart={() => { setDesignSheet(false); chooseDesignService(); }} />
      )}

      {/* Note 50: a new visitor creates the account before editing; it cannot be skipped. */}
      {guestPreview && !isAuthenticated && <AuthModal mode="signup" username={guestUsername} inEditor />}
      {showLogin && !isAuthenticated && !guestPreview && <AuthModal mode="login" inEditor />}

      {exitPrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <div className="w-full max-w-[320px] overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
            <div className="px-6 pb-4 pt-6">
              <p className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{saving ? 'لحظة، نحفظ تعديلاتك' : 'لم تُحفظ تعديلاتك بعد'}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{saving ? 'ننتظر اكتمال الحفظ قبل الخروج.' : 'هل تحفظها قبل الخروج؟'}</p>
            </div>
            <div className="divide-y divide-[#e5e5ea] border-t border-[#e5e5ea] text-[15px]">
              <button
                disabled={saving}
                onClick={async () => {
                  const go = exitPrompt;
                  if (!isDirty || (await handleSave())) {
                    setExitPrompt(null);
                    go();
                  }
                }}
                className="block w-full py-3 font-bold text-[#0a84ff] disabled:text-[#8e8e93]"
              >
                {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'حفظ والخروج'}
              </button>
              {!saving && (
                <button onClick={() => { const go = exitPrompt; setExitPrompt(null); go(); }} className="block w-full py-3 text-[#ff3b30]">الخروج دون حفظ</button>
              )}
              <button onClick={() => setExitPrompt(null)} className="block w-full py-3 text-[#1d1d1f]">البقاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
