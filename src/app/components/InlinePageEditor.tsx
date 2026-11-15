import { TemporaryPasswordGate } from './TemporaryPasswordGate';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Eye, Image, Layers, Loader2, Palette, Pencil, Redo2, Save, Settings2, Type, Undo2, X } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { PageView } from './PageView';
import { editorPreview } from '../lib/editorPreview';
import { HeaderEditor } from './HeaderEditor';
import { FormattingTextarea } from './FormattingTextarea';
import { LinkEditor } from './LinkEditor';
import { WallpaperEditor } from './WallpaperEditor';
import { StyleEditor } from './StyleEditor';
import { CreationInlineTemplates } from './CreationInlineTemplates';
import { TemplateGallery } from './TemplateGallery';
import './inlinePageEditor.css';

type Panel = 'name' | 'bio' | 'image' | 'content' | 'customize' | 'wallpaper' | 'buttons' | 'fonts' | 'colors' | 'templates';
const TITLES: Record<Panel, string> = { name: 'الاسم', bio: 'النبذة', image: 'الصورة والهوية', content: 'المحتوى', customize: 'تخصيص صفحتك', wallpaper: 'الخلفية', buttons: 'الأزرار', fonts: 'الخطوط', colors: 'الألوان', templates: 'القوالب' };

export function InlinePageEditor({ localOnly = false, savedLabel, onAdvanced, onBack, onContinue, continueLabel = 'التالي' }: { localOnly?: boolean; savedLabel?: string; onAdvanced: () => void; onBack?: () => void; onContinue?: () => void; continueLabel?: string }) {
  const { pageData, updatePageData, saveDraft, save, saving, loadingPage, draftState, conflict, hasPendingChanges, undo, redo, canUndo, canRedo, moveLink } = usePageContext();
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [addRequest, setAddRequest] = useState<{ requestId: number; afterId: string | null }>();
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const closing = useRef(false);
  const pendingMedia = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaState = useCallback((busy: boolean) => { pendingMedia.current = busy; setMediaBusy(busy); }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panel && !element.open) element.showModal();
    if (!panel && element.open) element.close();
    if (panel === 'name') sheetInput.current?.focus();
  }, [panel]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => dialog.current?.style.setProperty('--inline-viewport', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize);
    return () => viewport?.removeEventListener('resize', resize);
  }, []);
  const persist = async () => { setError(''); await saveDraft(); };
  const close = async () => {
    if (closing.current) return;
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل الإغلاق.'); return; }
    closing.current = true;
    try { await persist(); setPanel(null); setSelected(null); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ التعديلات. حاول مجددًا.'); }
    finally { closing.current = false; }
  };
  const leave = async (action: () => void) => {
    if (pendingMedia.current) { setError('انتظر اكتمال تجهيز الملف أو الصورة قبل المتابعة.'); return; }
    try { await persist(); action(); } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); }
  };
  const open = (value: Panel) => { setPanel(value); setError(''); };
  const selectedLink = pageData.links.find(item => item.id === selected);
  const status = loadingPage ? 'جارٍ تحميل الصفحة…' : saving ? 'جارٍ الحفظ…' : draftState === 'error' ? 'تعذر الحفظ — أعد المحاولة' : draftState === 'saved' ? (savedLabel || (localOnly ? 'محفوظة على هذا الجهاز' : 'المسودة محفوظة')) : 'تعديلات غير محفوظة';
  if (loadingPage) return <div className="inline-editor__loading" role="status"><Loader2 className="animate-spin" />جارٍ تحميل الصفحة…</div>;
  return <div className="inline-editor" dir="rtl">
    <header className="inline-editor__toolbar">
      <div className="inline-editor__tools">
        {onBack && <button type="button" aria-label="العودة" onClick={() => void leave(onBack)}><ChevronRight size={20} /></button>}
        <button type="button" onClick={() => void leave(() => { setPreview(!preview); setPanel(null); })}>{preview ? <Pencil size={18} /> : <Eye size={18} />}<span>{preview ? 'تحرير الصفحة' : 'معاينة'}</span></button>
        {!preview && <button type="button" onClick={() => open('customize')}><Palette size={18} /><span>تخصيص</span></button>}
      </div>
      <div className="inline-editor__tools">
        <button type="button" aria-label="تراجع" disabled={!canUndo || preview} onClick={undo}><Undo2 size={18} /></button>
        <button type="button" aria-label="إعادة" disabled={!canRedo || preview} onClick={redo}><Redo2 size={18} /></button>
        <button type="button" aria-label="حفظ المسودة" disabled={saving || loadingPage} onClick={() => void persist().catch(problem => setError(problem.message))}>{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}</button>
      </div>
    </header>
    <div className="inline-editor__status" role="status" aria-live="polite">{draftState === 'saved' && <Check size={13} />}{status}</div>
    {error && !panel && <p className="inline-editor__error" role="alert">{error}</p>}
    {!preview && <p className="inline-editor__help">اضغط على أي عنصر لتعديله، أو أضف محتوى جديدًا.</p>}
    <main className={`inline-editor__page${preview ? ' is-preview' : ''}`}>
      <PageView data={preview ? pageData : editorPreview(pageData)} variant="public" showIncomplete={!preview}
        selectedItemId={preview ? null : selected}
        onIdentityClick={preview ? undefined : field => { setSelected(field); open(field); }}
        onItemClick={preview ? undefined : id => { setSelected(id); setFocusId(id); open('content'); }}
        onAddAfter={preview ? undefined : afterId => { setSelected(null); setAddRequest({ requestId: ++sequence.current, afterId }); open('content'); }} />
    </main>
    {!preview && <footer className="inline-editor__bottom"><button type="button" onClick={() => void leave(onAdvanced)}><Settings2 size={17} />المصمم المتقدم</button>{onContinue && <button type="button" className="inline-editor__next" disabled={saving || conflict} onClick={async () => {
      try { setError(''); await save(); if (hasPendingChanges()) throw new Error('لديك تعديلات أحدث؛ احفظها قبل المتابعة.'); onContinue(); }
      catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ الصفحة.'); }
    }}>{continueLabel}</button>}</footer>}
    {!localOnly && <TemporaryPasswordGate />}
    <dialog ref={dialog} className="inline-editor__dialog" aria-labelledby="inline-panel-title" onCancel={event => { event.preventDefault(); void close(); }} onClick={event => { if (event.target === event.currentTarget) void close(); }}>
      <div className="inline-editor__sheet">
        <header className="inline-editor__sheet-header"><div><span className="inline-editor__handle" /><h2 id="inline-panel-title">{panel ? TITLES[panel] : 'أدوات الصفحة'}</h2></div><button type="button" onClick={() => void close()} aria-label="إغلاق اللوحة وحفظ المسودة" disabled={saving}><X size={20} /></button></header>
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
          {panel === 'templates' && (localOnly ? <CreationInlineTemplates /> : <TemplateGallery />)}
        </div>
        <footer className="inline-editor__sheet-footer"><span>{status}</span><button type="button" onClick={() => void close()} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ وإغلاق'}</button></footer>
      </div>
    </dialog>
  </div>;
}
