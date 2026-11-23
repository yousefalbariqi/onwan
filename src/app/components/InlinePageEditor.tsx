import { TemporaryPasswordGate } from './TemporaryPasswordGate';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, Eye, Image, Layers, Link2, Check, Loader2, Palette, Pencil, Plus, RectangleHorizontal, Redo2, Save, Settings, Settings2, Share2, Type, Undo2, UserRound, X } from 'lucide-react';
import { FONT_OPTIONS, usePageContext } from '../context/PageContext';
import { PageView } from './PageView';
import { draftHasContent, editorPreview, withSampleLinks } from '../lib/editorPreview';
import { closeInlinePanel, settleInlinePageMotion } from '../lib/inlinePanelMotion';
import { buttonMetrics } from '../lib/buttonSizes';
import { pageColors } from '../lib/readableColors';
import { MobileHeaderEditor } from './MobileHeaderEditor';
import { FormattingTextarea } from './FormattingTextarea';
import { LinkEditor } from './LinkEditor';
import { BackgroundSettings } from './BackgroundSettings';
import { StyleEditor } from './StyleEditor';
import { SharingPanel } from './QRCodeDisplay';
import { PrelaunchTools } from './PrelaunchTools';
import { AccountPanel } from './AccountPanel';
import { NonprofitSettings } from './NonprofitSettings';
import { CreationInlineTemplates } from './CreationInlineTemplates';
import { TemplateGallery } from './TemplateGallery';
import './inlinePageEditor.css';

type Panel = 'name' | 'bio' | 'image' | 'content' | 'customize' | 'wallpaper' | 'buttons' | 'fonts' | 'colors' | 'templates' | 'style' | 'sharing' | 'settings';
const TITLES: Record<Panel, string> = { name: 'الاسم', bio: 'النبذة', image: 'الصورة', content: 'المحتوى', customize: 'تخصيص صفحتك', wallpaper: 'الخلفية', buttons: 'الأزرار', fonts: 'النص', colors: 'الألوان', templates: 'الثيم', style: 'الأسلوب', sharing: 'المشاركة', settings: 'الإعدادات' };

export function InlinePageEditor({ localOnly = false, savedLabel, onAdvanced, onBack, onContinue, continueLabel = 'التالي' }: { localOnly?: boolean; savedLabel?: string; onAdvanced: () => void; onBack?: () => void; onContinue?: () => void; continueLabel?: string }) {
  const { pageData, updatePageData, saveDraft, save, saving, loadingPage, conflict, hasPendingChanges, undo, redo, canUndo, canRedo, savedDraftData, savedPageData, discardDraftChanges, enableManualDraftSaving, account, logout } = usePageContext();
  const baseline = savedDraftData ?? savedPageData;
  const hasEdits = Boolean(baseline && JSON.stringify(pageData) !== JSON.stringify(baseline));
  const [contentEpoch, setContentEpoch] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const discardDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { enableManualDraftSaving(); }, [enableManualDraftSaving]);
  useEffect(() => {
    const element = discardDialog.current;
    if (discardOpen && element && !element.open) { element.showModal(); element.querySelector<HTMLButtonElement>('button:last-child')?.focus(); }
    if (!discardOpen && element?.open) element.close();
  }, [discardOpen]);
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [templateControls, setTemplateControls] = useState<HTMLDivElement | null>(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const pageElement = useRef<HTMLElement>(null);
  const previousBounds = useRef<DOMRect | null>(null);
  const pageMotion = useRef<Animation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [addRequest, setAddRequest] = useState<{ requestId: number; afterId: string | null }>();
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const closing = useRef(false);
  const usedKeyboard = useRef(false);
  const pendingMedia = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaState = useCallback((busy: boolean) => { pendingMedia.current = busy; setMediaBusy(busy); }, []);

  const capturePage = () => {
    previousBounds.current = pageElement.current?.getBoundingClientRect() ?? null;
    pageMotion.current?.cancel();
  };
  useLayoutEffect(() => {
    const element = pageElement.current;
    const before = previousBounds.current;
    previousBounds.current = null;
    if (!element || !before || !element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const after = element.getBoundingClientRect();
    const width = element.offsetWidth;
    if (!width || !after.width) return;
    // Keep the same visible rectangle across normal-flow/fixed layout changes.
    const layoutLeft = after.left - (width - after.width) / 2;
    const frame = (bounds: DOMRect) => ({
      transformOrigin: '0 0',
      transform: `translate(${bounds.left - layoutLeft}px, ${bounds.top - after.top}px) scale(${bounds.width / width})`,
    });
    pageMotion.current = element.animate([frame(before), frame(after)], { duration: 280, easing: 'cubic-bezier(.22, .68, 0, 1)' });
    return () => { pageMotion.current?.cancel(); };
  }, [panel, panelClosing]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panel && !element.open) element.show();
    // Every tool opens at its top, not where the previous tool was scrolled to.
    if (panel) { const scroller = element.querySelector<HTMLElement>('.inline-editor__sheet-scroll'); if (scroller) scroller.scrollTop = 0; }
    if (!panel) { if (element.open) element.close(); if (usedKeyboard.current) returnFocus.current?.focus({ preventScroll: true }); }
    if (panel === 'name') sheetInput.current?.focus();
    else if (panel) { const sheet = element.querySelector<HTMLElement>('.inline-editor__sheet'); if (sheet) { sheet.tabIndex = -1; sheet.focus({ preventScroll: true }); } }
  }, [panel]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let settle: number | undefined;
    const resize = () => {
      const element = workspace.current;
      if (!element) return;
      // iOS can keep reporting the small viewport after the keyboard closes,
      // so the keyboard only counts while a text field actually has focus.
      const active = document.activeElement;
      const typing = active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        || (active instanceof HTMLInputElement && !['range', 'color', 'file', 'checkbox', 'radio', 'button'].includes(active.type));
      const visible = viewport?.height ?? window.innerHeight;
      const keyboard = typing && visible < window.innerHeight * .8;
      const height = keyboard ? visible : window.innerHeight;
      // Follow the keyboard directly; a CSS transition here makes the sheet lag and jump.
      element.dataset.viewportMoving = '1';
      window.clearTimeout(settle);
      settle = window.setTimeout(() => { delete element.dataset.viewportMoving; }, 360);
      if (!keyboard && window.scrollY && element.classList.contains('has-panel')) window.scrollTo(0, 0);
      if (keyboard) element.dataset.keyboard = '1'; else delete element.dataset.keyboard;
      element.style.setProperty('--inline-viewport', `${height}px`);
      // The page is drawn as a phone (390 wide) and the sheet crops its lower part.
      element.style.setProperty('--inline-preview-scale', String(Math.min(keyboard ? .62 : .5, (window.innerWidth - 32) / 390)));
      element.style.setProperty('--inline-viewport-top', `${keyboard ? viewport?.offsetTop ?? 0 : 0}px`);
    };
    // iOS can finish closing the keyboard without a last viewport event.
    const timers: number[] = [];
    const afterBlur = () => { timers.push(window.setTimeout(resize, 90), window.setTimeout(resize, 420)); };
    document.addEventListener('focusout', afterBlur);
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => { window.clearTimeout(settle); timers.forEach(window.clearTimeout); document.removeEventListener('focusout', afterBlur); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, [loadingPage]);
  // Note 14: while editing the name or bio, the preview shows that very text.
  useEffect(() => {
    const page = pageElement.current;
    const root = workspace.current;
    if (!page || !root) return;
    root.style.removeProperty('--inline-focus-y');
    if (panel !== 'name' && panel !== 'bio') return;
    const frame = window.requestAnimationFrame(() => {
      const target = page.querySelector<HTMLElement>(panel === 'name' ? 'h1' : '.page-composition-content h1 ~ p, .page-composition-content .onwan-inline-target p');
      if (!target) return;
      const bounds = page.getBoundingClientRect();
      const scale = bounds.width / page.offsetWidth || 1;
      root.style.setProperty('--inline-focus-y', `${Math.max(0, (target.getBoundingClientRect().top - bounds.top) / scale - 70)}px`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panel]);
  // Focus only returns to the page for keyboard users; a finger leaves no ring behind.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => { if (event.key === 'Tab') usedKeyboard.current = true; };
    const pointer = () => { usedKeyboard.current = false; };
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pointerdown', pointer, true);
    return () => { window.removeEventListener('keydown', keys, true); window.removeEventListener('pointerdown', pointer, true); };
  }, []);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);
  const persist = async () => {
    setError('');
    if (!hasEdits) return;
    await saveDraft();
    setSavedFlash(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedFlash(false), 1800);
  };
  // A one-time hint: the page itself is the editor.
  const [hint, setHint] = useState(() => { try { return !localStorage.getItem('onwan_editor_hint_v1'); } catch { return false; } });
  const dismissHint = () => { setHint(false); try { localStorage.setItem('onwan_editor_hint_v1', '1'); } catch { /* The hint may simply show again. */ } };
  const close = async () => {
    if (closing.current) return;
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل الإغلاق.'); return; }
    closing.current = true;
    // Drop the keyboard first, so the sheet goes down in one move.
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      capturePage();
      setPanelClosing(true);
      await closeInlinePanel(dialog.current, typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // The page animation starts after React commits the new layout, slightly
      // after the sheet. Let it finish before cleaning up its layout effect.
      await settleInlinePageMotion(pageMotion.current);
      setPanel(null); setPanelClosing(false); setExpanded(false); setSelected(null);
      // X means done: the next visit starts at the list, unless half-typed work needs finishing.
      if (panel === 'content' && !draftHasContent(pageData.editorForm)) { if (pageData.editorForm) updatePageData({ editorForm: undefined }); setFocusId(null); setContentEpoch(value => value + 1); }
    }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ التعديلات. حاول مجددًا.'); }
    finally { closing.current = false; }
  };
  const leave = async (action: () => void, requireClean = false) => {
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل المتابعة.'); return; }
    if (requireClean && hasEdits) { setError('احفظ تعديلاتك أو ألغِها قبل الانتقال.'); return; }
    try { action(); } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); }
  };
  const open = (value: Panel) => { if (closing.current) return; if (hint) dismissHint(); returnFocus.current = typeof document === 'undefined' ? null : document.activeElement as HTMLElement; capturePage(); setPanelClosing(false); setExpanded(false); setPanel(value); setError(''); };
  const addContent = () => {
    setSelected(null); setFocusId(null);
    setAddRequest({ requestId: ++sequence.current, afterId: pageData.links.at(-1)?.id ?? null });
    open('content');
  };
  const [continuing, setContinuing] = useState(false);
  const continueBusy = useRef(false);
  const finish = async (saveFirst = false) => {
    if (continueBusy.current || saving || conflict || loadingPage) return;
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل المتابعة.'); return; }
    try {
      setError('');
      if (hasEdits && !saveFirst) { setError('احفظ تعديلاتك أو ألغِها قبل المتابعة.'); return; }
      if (!onContinue) return;
      if (pageData.editorForm) throw new Error('أكمل العنصر المفتوح أو ألغِه قبل المتابعة.');
      continueBusy.current = true; setContinuing(true);
      if (localOnly) { if (hasEdits) await saveDraft(); onContinue(); return; }
      await save();
      if (hasPendingChanges()) throw new Error('لديك تعديلات أحدث؛ احفظها قبل المتابعة.');
      onContinue();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ الصفحة.'); }
    finally { continueBusy.current = false; setContinuing(false); }
  };
  // Editor phase 1: the dock is for how the page looks, nothing else.
  const designTools = [
    { id: 'content' as const, label: 'المحتوى', Icon: Link2 },
    { id: 'templates' as const, label: 'الثيم', Icon: Layers },
    { id: 'image' as const, label: 'الصورة', Icon: UserRound },
    { id: 'wallpaper' as const, label: 'الخلفية', Icon: Image },
    { id: 'fonts' as const, label: 'النص', Icon: Type },
    { id: 'buttons' as const, label: 'الأزرار', Icon: RectangleHorizontal },
    { id: 'colors' as const, label: 'الألوان', Icon: Palette },
    { id: 'sharing' as const, label: 'المشاركة', Icon: Share2 },
    { id: 'settings' as const, label: 'الإعدادات', Icon: Settings },
  ];
  // Each tool shows its current state, so the page's look reads from the dock.
  const buttonRadius = ({ pill: 999, rounded: 7, square: 1 } as Record<string, number>)[pageData.buttonStyle.shape] ?? 7;
  const buttonFill = pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor ? pageData.buttonStyle.customColor : pageData.theme.buttonColor;
  const pageBackground = pageData.wallpaper.type === 'gradient' || pageData.wallpaper.type === 'color' ? pageData.wallpaper.value : pageData.theme.background;
  const pageFont = FONT_OPTIONS.find(font => font.id === pageData.typography?.font)?.family;
  const toolPreview = (id: string) => {
    if (id === 'templates') return <span className="inline-editor__art-theme" style={{ background: pageBackground, color: pageData.theme.textColor, fontFamily: pageFont }}>أب<i style={{ background: pageData.buttonStyle.border ? 'transparent' : buttonFill, borderColor: buttonFill, borderRadius: buttonRadius }} /></span>;
    if (id === 'wallpaper' && pageData.wallpaper.type !== 'image' && pageData.wallpaper.type !== 'video') return <span className="inline-editor__art-fill" style={{ background: pageBackground }} />;
    if (id === 'fonts') return <span className="inline-editor__art-font" style={{ fontFamily: pageFont }}>أب</span>;
    if (id === 'buttons') return <i className="inline-editor__art-button" style={{ background: pageData.buttonStyle.border ? 'transparent' : buttonFill, borderColor: buttonFill, borderRadius: buttonRadius }} />;
    if (id === 'colors') return <span className="inline-editor__art-colors"><i style={{ background: pageData.theme.background }} /><i style={{ background: buttonFill }} /><i style={{ background: pageData.theme.textColor }} /></span>;
    return null;
  };
  const addStyle = {
    color: pageData.customColors?.paragraphColor || pageData.customColors?.bioColor || pageColors(pageData).text,
    minHeight: Math.max(44, buttonMetrics(pageData.buttonStyle).height),
    borderRadius: ({ pill: '999px', rounded: '12px', square: '0px' } as Record<string, string>)[pageData.buttonStyle.shape] || '16px',
  };

  if (loadingPage) return <div className="inline-editor__loading" role="status"><Loader2 className="animate-spin" />جارٍ تحميل الصفحة…</div>;
  return <div ref={workspace} className={`inline-editor${preview ? ' is-preview' : ''}${hasEdits ? ' is-editing' : ''}${panel && !panelClosing ? ' has-panel' : ''}${expanded ? ' is-panel-expanded' : ''}`} dir="rtl" data-panel={panel ?? undefined} style={{ '--inline-tint': pageData.theme.background } as React.CSSProperties} onKeyDown={event => { if (panel && !discardOpen && event.key === 'Escape') { event.preventDefault(); void close(); } }}>
    <header className="inline-editor__toolbar">
      <div className="inline-editor__tools">
        {onBack && <button type="button" aria-label="العودة" disabled={hasEdits || saving || mediaBusy} onClick={() => void leave(onBack, true)}><ChevronRight size={20} /></button>}
        <h1 className="sr-only">{preview ? 'معاينة' : 'محرر الصفحة'}</h1>
        {!preview && <button type="button" className="inline-editor__preview-action" disabled={saving || mediaBusy} onClick={() => void leave(() => { setPreview(true); setPanel(null); })}><Eye size={18} aria-hidden="true" />معاينة</button>}
      </div>
      <div className="inline-editor__tools">
        
        {preview && <button type="button" aria-label="تحرير الصفحة" onClick={() => setPreview(false)}><Pencil size={18} />تحرير</button>}
        {hasEdits && <div className="inline-editor__history" role="group" aria-label="سجل التعديلات المحلية">
          <button type="button" aria-label="تراجع عن التعديل" disabled={!canUndo || saving || mediaBusy} onClick={undo}><Undo2 size={19} /></button>
          <button type="button" aria-label="إعادة التعديل" disabled={!canRedo || saving || mediaBusy} onClick={redo}><Redo2 size={19} /></button>
        </div>}
        {hasEdits ? <>
          <button type="button" className="inline-editor__cancel" disabled={saving || mediaBusy} onClick={() => { setError(''); setDiscardOpen(true); }}>إلغاء</button>
          <button type="button" className="inline-editor__save" disabled={saving || conflict || mediaBusy} onClick={() => void persist().catch(problem => setError(problem instanceof Error ? problem.message : 'تعذر الحفظ. حاول مجددًا.'))}>{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}<span>حفظ</span></button>
        </> : onContinue && <button type="button" className="inline-editor__save" disabled={saving || loadingPage || conflict || mediaBusy} onClick={() => void finish()}>{saving ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}<span>{continueLabel.includes('حفظ') ? 'التالي' : continueLabel}</span></button>}

      </div>
    </header>
    <p className="sr-only" role="status" aria-live="polite">{hasEdits ? 'تعديلات محلية لم ترسل إلى المسودة' : 'لا توجد تعديلات محلية معلقة'}</p>
    {error && !panel && <p className="inline-editor__error" role="alert">{error}</p>}
    {!preview && <p className="sr-only">اضغط على أي عنصر لتعديله، أو أضف محتوى جديدًا.</p>}
    <div className="inline-editor__stage">
    <main ref={pageElement} inert={panel ? true : undefined} className={`inline-editor__page${preview ? ' is-preview' : ''}`}>
      <PageView data={preview ? pageData : panel ? withSampleLinks(editorPreview(pageData)) : editorPreview(pageData)} variant="public" showIncomplete={!preview && !panel}
        selectedItemId={preview || panel ? null : selected}
        onIdentityClick={preview ? undefined : field => { setSelected(field); open(field); }}
        onItemClick={preview ? undefined : id => { setSelected(id); setFocusId(id); open('content'); }}>
        {!preview && <button type="button" className="inline-editor__add" style={addStyle} aria-haspopup="dialog" onClick={addContent}><Plus size={20} aria-hidden="true" /><span>إضافة</span></button>}
      </PageView>
    </main>
    {panel && !panelClosing && !expanded && <button type="button" className="inline-editor__preview-dismiss" aria-label="تكبير معاينة الصفحة وإغلاق لوحة الأدوات" disabled={saving || mediaBusy} onClick={() => void close()} />}
    </div>
    {savedFlash && <p className="inline-editor__toast" role="status"><Check size={17} aria-hidden="true" />تم الحفظ</p>}
    {hint && !preview && !panel && <button type="button" className="inline-editor__hint" onClick={dismissHint}>اضغط أي عنصر في صفحتك لتعديله<X size={15} aria-hidden="true" /></button>}
    {!preview && <footer className="inline-editor__dock">
      <nav className="inline-editor__design-tools" aria-label="أدوات الهوية">
        {designTools.map(({ id, label, Icon }) => <button type="button" key={id} aria-haspopup="dialog" onClick={() => open(id)}>
          <span className={`inline-editor__tool-art inline-editor__tool-art--${id}`} aria-hidden="true" >
            {toolPreview(id) ?? (id === 'image' && pageData.profileImage ? <img src={pageData.profileImage} alt="" style={{ objectFit: pageData.profileStyle.fit ?? 'cover', objectPosition: `${pageData.profileStyle.positionX ?? 50}% ${pageData.profileStyle.positionY ?? 50}%` }} /> : <Icon size={25} strokeWidth={1.6} />)}
          </span><span>{label}</span>
        </button>)}
      </nav>

    </footer>}

    {!localOnly && <TemporaryPasswordGate />}
    <dialog ref={dialog} className="inline-editor__dialog" aria-labelledby="inline-panel-title" onCancel={event => { event.preventDefault(); void close(); }} onClick={event => { if (event.target === event.currentTarget) void close(); }}>
      <div className="inline-editor__sheet">
        <header className="inline-editor__sheet-header"><div><button type="button" className="inline-editor__handle" aria-label={expanded ? 'تصغير لوحة الأدوات' : 'توسيع لوحة الأدوات'} aria-expanded={expanded} onClick={() => { if (!dragged.current) setExpanded(!expanded); dragged.current = false; }} onPointerDown={event => { dragged.current = false; dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { if (dragStart.current !== null && Math.abs(event.clientY - dragStart.current) > 24) { dragged.current = true; setExpanded(event.clientY < dragStart.current); dragStart.current = null; } }} onPointerCancel={() => { dragStart.current = null; }} /><div ref={setTemplateControls} className="inline-editor__template-controls" hidden={panel !== 'templates' || !localOnly} /><h2 className={panel === 'templates' && localOnly ? 'sr-only' : undefined} id="inline-panel-title">{panel ? TITLES[panel] : 'أدوات الصفحة'}</h2></div><button type="button" onPointerUp={event => { event.preventDefault(); void close(); }} onClick={() => void close()} aria-label="إغلاق اللوحة" disabled={saving}><X size={20} /></button></header>
        {mediaBusy && <p role="status" className="px-4 py-2 text-sm text-[#737373]">جارٍ تجهيز الوسائط…</p>}
        {error && <p className="inline-editor__error" role="alert">{error}</p>}
        <fieldset disabled={saving} className="inline-editor__sheet-scroll" data-builder-panel-scroll>
          <div hidden={panel !== 'content'}>
            <LinkEditor key={contentEpoch} mobileOverview inline draftSave externalSave onBusyChange={mediaState} focusId={focusId} onFocused={() => setFocusId(null)} addRequest={addRequest} onCommitted={() => { void close(); }} />
          </div>
          {panel === 'name' && <label className="inline-editor__field">اسم الصفحة<input ref={sheetInput} value={pageData.name} maxLength={80} onChange={event => updatePageData({ name: event.target.value })} /></label>}
          {panel === 'bio' && <div className="inline-editor__field"><label>نبذة الصفحة</label><FormattingTextarea value={pageData.bio} format={pageData.typography?.bioFormat} onChange={(bio, bioFormat) => updatePageData({ bio, typography: { ...pageData.typography, bioFormat } })} className="w-full resize-none rounded-xl border border-[#ddd8cb] bg-white p-3 text-base" aria-label="نبذة الصفحة" maxLength={300} rows={5} /></div>}
          {panel === 'image' && <MobileHeaderEditor logoZoomOut logoBanner essentials onBusyChange={mediaState} />}
          {panel === 'customize' && <div className="inline-editor__customize">{[
            { id: 'wallpaper' as const, label: 'الخلفية', Icon: Image }, { id: 'fonts' as const, label: 'الخطوط', Icon: Type }, { id: 'colors' as const, label: 'الألوان', Icon: Palette }, { id: 'buttons' as const, label: 'الأزرار', Icon: Settings2 }, { id: 'image' as const, label: 'الصورة والهوية', Icon: Pencil }, { id: 'templates' as const, label: 'الثيمات', Icon: Layers },
          ] .map(item => <button key={item.id} type="button" onClick={() => open(item.id)}><item.Icon size={23} />{item.label}</button>)}{<button type="button" className="inline-editor__preview-toggle" aria-label={preview ? 'تحرير الصفحة' : 'معاينة'} aria-pressed={preview} onClick={() => void leave(() => { setPreview(!preview); setPanel(null); })}>{preview ? <Pencil size={18} /> : <Eye size={18} />}<span>{preview ? 'تحرير' : 'معاينة'}</span></button>}<button type="button" onClick={() => void leave(onAdvanced)}><Settings2 size={23} />المصمم المتقدم</button></div>}
          {panel === 'wallpaper' && <BackgroundSettings onBusyChange={mediaState} />}
          {panel === 'style' && <><StyleEditor onBusyChange={mediaState} embedded /><div className="inline-editor__customize"><button type="button" onClick={() => void leave(() => { setPreview(true); setPanel(null); })}><Eye size={20} />معاينة الصفحة</button><button type="button" onClick={() => void leave(onAdvanced)}><Settings2 size={20} />المصمم المتقدم</button></div></>}
          {(panel === 'sharing' || panel === 'settings') && localOnly && <PrelaunchTools kind={panel} needsSave={hasEdits} busy={continuing || saving} disabled={!onContinue || conflict || loadingPage || mediaBusy} onContinue={() => void finish(true)} />}
          {(panel === 'settings' || panel === 'sharing') && !localOnly && (panel === 'sharing' ? <SharingPanel username={pageData.username} /> : account?.kind === 'nonprofit' ? <NonprofitSettings onLogout={() => { if (hasEdits) { setError('احفظ تعديلاتك أو ألغِها قبل تسجيل الخروج.'); return; } if (window.confirm('تسجيل الخروج من حسابك؟')) { logout(); onBack?.(); } }} /> : <AccountPanel />)}
          {panel === 'settings' && <button type="button" className="inline-editor__advanced-row" onClick={() => void leave(onAdvanced)}><Settings2 size={20} aria-hidden="true" /><span><b>المصمم المتقدم</b><small>كل خيارات التصميم في شاشة واحدة</small></span></button>}
          {(panel === 'fonts' || panel === 'colors' || panel === 'buttons') && <StyleEditor key={panel} onBusyChange={mediaState} initialTab={panel === 'fonts' ? 'text' : panel} embedded single />}
          {panel === 'templates' && (localOnly ? <CreationInlineTemplates controlsTarget={templateControls} onSearchOpen={() => setExpanded(true)} /> : <TemplateGallery />)}
        </fieldset>

      </div>
    </dialog>
    <dialog ref={discardDialog} className="inline-editor__discard" aria-labelledby="inline-discard-title" onCancel={event => { event.preventDefault(); setDiscardOpen(false); }}>
      <h2 id="inline-discard-title">إلغاء التعديلات؟</h2>
      <p>ستعود الصفحة إلى آخر مسودة محفوظة. لن تتغير النسخة المحفوظة.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="inline-editor__discard-confirm" disabled={saving} onClick={() => void discardDraftChanges().then(() => { setContentEpoch(value => value + 1); setError(''); setDiscardOpen(false); if (panel) void close(); }).catch(problem => setError(problem instanceof Error ? problem.message : 'تعذر استرجاع النسخة المحلية.'))}>إلغاء التعديلات</button>
      <button type="button" autoFocus onClick={() => setDiscardOpen(false)}>متابعة التعديل</button>
    </dialog>
  </div>;
}
