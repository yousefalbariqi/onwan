import { TemporaryPasswordGate } from './TemporaryPasswordGate';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Eye, Image, Layers, Loader2, MoreHorizontal, Palette, Pencil, Plus, Redo2, Settings2, Type, Undo2, UserRound, X } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { PageView } from './PageView';
import { editorPreview } from '../lib/editorPreview';
import { closeInlinePanel } from '../lib/inlinePanelMotion';
import { buttonMetrics } from '../lib/buttonSizes';
import { HeaderEditor } from './HeaderEditor';
import { FormattingTextarea } from './FormattingTextarea';
import { LinkEditor } from './LinkEditor';
import { WallpaperEditor } from './WallpaperEditor';
import { StyleEditor } from './StyleEditor';
import { CreationInlineTemplates } from './CreationInlineTemplates';
import { TemplateGallery } from './TemplateGallery';
import './inlinePageEditor.css';

type Panel = 'name' | 'bio' | 'image' | 'content' | 'customize' | 'wallpaper' | 'buttons' | 'fonts' | 'colors' | 'templates';
const TITLES: Record<Panel, string> = { name: 'الاسم', bio: 'النبذة', image: 'الصورة والاسم', content: 'المحتوى', customize: 'تخصيص صفحتك', wallpaper: 'الخلفية', buttons: 'الأزرار', fonts: 'الخطوط', colors: 'الألوان', templates: 'القوالب' };

export function InlinePageEditor({ localOnly = false, savedLabel, onAdvanced, onBack, onContinue, continueLabel = 'التالي' }: { localOnly?: boolean; savedLabel?: string; onAdvanced: () => void; onBack?: () => void; onContinue?: () => void; continueLabel?: string }) {
  const { pageData, updatePageData, saveDraft, save, saving, loadingPage, draftState, conflict, hasPendingChanges, undo, redo, canUndo, canRedo, moveLink } = usePageContext();
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
  const more = useRef<HTMLDetailsElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const closing = useRef(false);
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
    if (!panel) { if (element.open) element.close(); returnFocus.current?.focus({ preventScroll: true }); }
    if (panel === 'name') sheetInput.current?.focus();
    else if (panel) element.querySelector<HTMLButtonElement>('.inline-editor__sheet-header button')?.focus();
  }, [panel]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      const width = Math.min(window.innerWidth, 680);
      workspace.current?.style.setProperty('--inline-viewport', `${height}px`);
      workspace.current?.style.setProperty('--inline-preview-scale', String(Math.min(.65, Math.max(.12, (height * .39 - 94) / 700), (window.innerWidth - 40) / width)));
      workspace.current?.style.setProperty('--inline-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (more.current && !more.current.contains(event.target as Node)) more.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const dismissMore = () => { if (more.current) more.current.open = false; };
  const persist = async () => { setError(''); await saveDraft(); };
  const close = async () => {
    if (closing.current) return;
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل الإغلاق.'); return; }
    closing.current = true;
    try {
      await persist();
      capturePage();
      setPanelClosing(true);
      await closeInlinePanel(dialog.current, typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // The page animation starts after React commits the new layout, slightly
      // after the sheet. Let it finish before cleaning up its layout effect.
      await pageMotion.current?.finished.catch(() => undefined);
      setPanel(null); setPanelClosing(false); setExpanded(false); setSelected(null);
    }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ التعديلات. حاول مجددًا.'); }
    finally { closing.current = false; }
  };
  const leave = async (action: () => void) => {
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل المتابعة.'); return; }
    try { await persist(); action(); } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); }
  };
  const open = (value: Panel) => { if (closing.current) return; returnFocus.current = typeof document === 'undefined' ? null : document.activeElement as HTMLElement; dismissMore(); capturePage(); setPanelClosing(false); setExpanded(false); setPanel(value); setError(''); };
  const addContent = () => {
    setSelected(null); setFocusId(null);
    setAddRequest({ requestId: ++sequence.current, afterId: pageData.links.at(-1)?.id ?? null });
    open('content');
  };
  const finish = async () => {
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل المتابعة.'); return; }
    try {
      setError('');
      if (!onContinue) { await persist(); return; }
      await save();
      if (hasPendingChanges()) throw new Error('لديك تعديلات أحدث؛ احفظها قبل المتابعة.');
      onContinue();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ الصفحة.'); }
  };
  const designTools = [
    { id: 'templates' as const, label: 'الثيمات', Icon: Layers },
    { id: 'image' as const, label: 'الصورة والاسم', Icon: UserRound },
    { id: 'wallpaper' as const, label: 'الخلفية', Icon: Image },
    { id: 'fonts' as const, label: 'الخطوط', Icon: Type },
    { id: 'buttons' as const, label: 'الأزرار', Icon: Settings2 },
    { id: 'colors' as const, label: 'الألوان', Icon: Palette },
  ];
  const addStyle = {
    color: pageData.customColors?.paragraphColor || pageData.customColors?.bioColor || pageData.theme.textColor,
    minHeight: Math.max(44, buttonMetrics(pageData.buttonStyle).height),
    borderRadius: ({ pill: '999px', rounded: '12px', square: '0px' } as Record<string, string>)[pageData.buttonStyle.shape] || '16px',
  };
  const selectedLink = pageData.links.find(item => item.id === selected);
  const status = loadingPage ? 'جارٍ تحميل الصفحة…' : saving ? 'جارٍ الحفظ…' : draftState === 'error' ? 'تعذر الحفظ — أعد المحاولة' : draftState === 'saved' ? (savedLabel || (localOnly ? 'محفوظة على هذا الجهاز' : 'المسودة محفوظة')) : 'تعديلات غير محفوظة';
  if (loadingPage) return <div className="inline-editor__loading" role="status"><Loader2 className="animate-spin" />جارٍ تحميل الصفحة…</div>;
  return <div ref={workspace} className={`inline-editor${preview ? ' is-preview' : ''}${panel && !panelClosing ? ' has-panel' : ''}${expanded ? ' is-panel-expanded' : ''}`} dir="rtl" onKeyDown={event => { if (panel && event.key === 'Escape') { event.preventDefault(); void close(); } }}>
    <header className="inline-editor__toolbar">
      <div className="inline-editor__tools">
        {onBack && <button type="button" aria-label="العودة" onClick={() => void leave(onBack)}><ChevronRight size={20} /></button>}
        <h1 className="inline-editor__title">{preview ? 'معاينة' : 'الهوية'}</h1>
      </div>
      <div className="inline-editor__tools">
        <button type="button" className="inline-editor__preview-toggle" aria-label={preview ? 'تحرير الصفحة' : 'معاينة'} aria-pressed={preview} onClick={() => void leave(() => { setPreview(!preview); setPanel(null); })}>{preview ? <Pencil size={18} /> : <Eye size={18} />}<span>{preview ? 'تحرير' : 'معاينة'}</span></button>
        {onContinue && <button type="button" className="inline-editor__save" disabled={saving || loadingPage || conflict || mediaBusy} onClick={() => void finish()}>{saving ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}<span>{continueLabel.includes('حفظ') ? 'التالي' : continueLabel}</span></button>}
        {!preview && <details ref={more} className="inline-editor__more" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
        }}>
          <summary aria-label="المزيد من أدوات التحرير"><MoreHorizontal size={21} aria-hidden="true" /></summary>
          <div className="inline-editor__more-actions" role="group" aria-label="أدوات التحرير">
            <button type="button" aria-label="تراجع" disabled={!canUndo} onClick={() => { undo(); dismissMore(); }}><Undo2 size={18} />تراجع</button>
            <button type="button" aria-label="إعادة" disabled={!canRedo} onClick={() => { redo(); dismissMore(); }}><Redo2 size={18} />إعادة</button>
            <button type="button" aria-label="المصمم المتقدم" onClick={() => { dismissMore(); void leave(onAdvanced); }}><Settings2 size={18} />المصمم المتقدم</button>
          </div>
        </details>}
      </div>
    </header>
    <div className="inline-editor__status" role="status" aria-live="polite"><button type="button" aria-label="حفظ المسودة" disabled={saving || mediaBusy} onClick={() => void persist().catch(problem => setError(problem.message))}>{draftState === 'saved' && <Check size={13} />}{status}</button></div>
    {error && !panel && <p className="inline-editor__error" role="alert">{error}</p>}
    {!preview && <p className="sr-only">اضغط على أي عنصر لتعديله، أو أضف محتوى جديدًا.</p>}
    <div className="inline-editor__stage">
    <main ref={pageElement} inert={panel ? true : undefined} className={`inline-editor__page${preview ? ' is-preview' : ''}`}>
      <PageView data={preview ? pageData : editorPreview(pageData)} variant="public" showIncomplete={!preview && !panel}
        selectedItemId={preview || panel ? null : selected}
        onIdentityClick={preview ? undefined : field => { setSelected(field); open(field); }}
        onItemClick={preview ? undefined : id => { setSelected(id); setFocusId(id); open('content'); }}>
        {!preview && <button type="button" className="inline-editor__add" style={addStyle} aria-haspopup="dialog" onClick={addContent}><Plus size={20} aria-hidden="true" /><span>إضافة محتوى</span></button>}
      </PageView>
    </main>
    </div>
    {!preview && <footer className="inline-editor__dock">
      <nav className="inline-editor__design-tools" aria-label="أدوات الهوية">
        {designTools.map(({ id, label, Icon }) => <button type="button" key={id} aria-haspopup="dialog" onClick={() => open(id)}>
          <span className={`inline-editor__tool-art inline-editor__tool-art--${id}`} aria-hidden="true" style={id === 'wallpaper' || id === 'templates' ? { backgroundColor: pageData.theme.background, color: pageData.theme.textColor } : undefined}>
            {id === 'image' && pageData.profileImage ? <img src={pageData.profileImage} alt="" /> : <Icon size={25} strokeWidth={1.6} />}
          </span><span>{label}</span>
        </button>)}
      </nav>

    </footer>}

    {!localOnly && <TemporaryPasswordGate />}
    <dialog ref={dialog} className="inline-editor__dialog" aria-labelledby="inline-panel-title" onCancel={event => { event.preventDefault(); void close(); }} onClick={event => { if (event.target === event.currentTarget) void close(); }}>
      <div className="inline-editor__sheet">
        <header className="inline-editor__sheet-header"><div><button type="button" className="inline-editor__handle" aria-label={expanded ? 'تصغير لوحة الأدوات' : 'توسيع لوحة الأدوات'} aria-expanded={expanded} onClick={() => { if (!dragged.current) setExpanded(!expanded); dragged.current = false; }} onPointerDown={event => { dragged.current = false; dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { if (dragStart.current !== null && Math.abs(event.clientY - dragStart.current) > 24) { dragged.current = true; setExpanded(event.clientY < dragStart.current); dragStart.current = null; } }} onPointerCancel={() => { dragStart.current = null; }} /><div ref={setTemplateControls} className="inline-editor__template-controls" hidden={panel !== 'templates' || !localOnly} /><h2 className={panel === 'templates' && localOnly ? 'sr-only' : undefined} id="inline-panel-title">{panel ? TITLES[panel] : 'أدوات الصفحة'}</h2></div><button type="button" onClick={() => void close()} aria-label="إغلاق اللوحة" disabled={saving}><X size={20} /></button></header>
        {mediaBusy && <p role="status" className="px-4 py-2 text-sm text-[#737373]">جارٍ تجهيز الوسائط…</p>}
        {error && <p className="inline-editor__error" role="alert">{error}</p>}
        <div className="inline-editor__sheet-scroll" data-builder-panel-scroll>
          <div hidden={panel !== 'content'}>
            {selectedLink && <div className="inline-editor__item-actions"><button type="button" aria-label="نقل العنصر للأعلى" onClick={() => moveLink(selectedLink.id, 'up')}><ArrowUp size={18} /></button><button type="button" aria-label="نقل العنصر للأسفل" onClick={() => moveLink(selectedLink.id, 'down')}><ArrowDown size={18} /></button></div>}
            <LinkEditor inline draftSave externalSave onBusyChange={mediaState} focusId={focusId} onFocused={() => setFocusId(null)} addRequest={addRequest} onCommitted={() => { void close(); }} />
          </div>
          {panel === 'name' && <label className="inline-editor__field">اسم الصفحة<input ref={sheetInput} value={pageData.name} maxLength={80} onChange={event => updatePageData({ name: event.target.value })} /></label>}
          {panel === 'bio' && <div className="inline-editor__field"><label>نبذة الصفحة</label><FormattingTextarea value={pageData.bio} format={pageData.typography?.bioFormat} onChange={(bio, bioFormat) => updatePageData({ bio, typography: { ...pageData.typography, bioFormat } })} className="w-full resize-none rounded-xl border border-[#ddd8cb] bg-white p-3 text-base" aria-label="نبذة الصفحة" maxLength={300} rows={5} /></div>}
          {panel === 'image' && <HeaderEditor logoZoomOut logoBanner onBusyChange={mediaState} />}
          {panel === 'customize' && <div className="inline-editor__customize">{[
            { id: 'wallpaper' as const, label: 'الخلفية', Icon: Image }, { id: 'fonts' as const, label: 'الخطوط', Icon: Type }, { id: 'colors' as const, label: 'الألوان', Icon: Palette }, { id: 'buttons' as const, label: 'الأزرار', Icon: Settings2 }, { id: 'image' as const, label: 'الصورة والهوية', Icon: Pencil }, { id: 'templates' as const, label: 'القوالب', Icon: Layers },
          ].map(item => <button key={item.id} type="button" onClick={() => open(item.id)}><item.Icon size={23} />{item.label}</button>)}</div>}
          {panel === 'wallpaper' && <WallpaperEditor onBusyChange={mediaState} />}
          {(panel === 'fonts' || panel === 'colors' || panel === 'buttons') && <StyleEditor key={panel} onBusyChange={mediaState} initialTab={panel === 'fonts' ? 'text' : panel} embedded />}
          {panel === 'templates' && (localOnly ? <CreationInlineTemplates controlsTarget={templateControls} onSearchOpen={() => setExpanded(true)} /> : <TemplateGallery />)}
        </div>

      </div>
    </dialog>
  </div>;
}
