import { useEffect, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { nonprofitCall } from '../lib/api';
import type { PageTemplate } from '../lib/pageDesign';
import { TemplatePreview } from './TemplatePreview';

type ListResult = { templates: PageTemplate[]; more: boolean; categories: string[] };

// «القوالب الجاهزة» in the association's editor: the templates the manager has
// shown, nine at a time. Tapping one tries it on the draft (undo or history
// bring the old look back); «اعتماد» counts it as used. Content never changes.
// Only templates from «صانع القوالب» are offered (owner decision, 4 Nov 2026):
// never the former colour themes, even when none is shown yet.
export function TemplateGallery({ initialCategory = '' }: { initialCategory?: string }) {
  const { applyDesign } = usePageContext();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  useEffect(() => { setCategory(initialCategory); }, [initialCategory]);
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState<{ id: string; used: boolean } | null>(null);
  const request = useRef(0);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => { rail.current?.scrollTo({ left: 0 }); }, [query, category]);

  const load = (offset: number) => {
    const id = ++request.current;
    setLoading(true);
    nonprofitCall<ListResult>({ action: 'templates.list', query, category, offset })
      .then((next) => {
        if (id !== request.current) return;
        setResult((prev) => (offset && prev ? { ...next, templates: [...prev.templates, ...next.templates] } : next));
        setFailed(false);
      })
      .catch(() => { if (id === request.current) setFailed(true); })
      .finally(() => { if (id === request.current) setLoading(false); });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(0), query ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const track = (id: string, event: 'tried' | 'used') => { void nonprofitCall({ action: 'templates.track', id, event }).catch(() => undefined); };
  const tryTemplate = (template: PageTemplate) => {
    applyDesign(template.design);
    setApplied({ id: template.id, used: false });
    track(template.id, 'tried');
  };

  const nothingShown = !query && !category && result && result.templates.length === 0;
  if (failed && !result) return <TemplatesUnavailable onRetry={() => load(0)} />;
  if (nothingShown) return <p className="p-5 text-center text-sm text-[#8e8e93]" style={{ fontFamily: 'Tajawal, sans-serif' }}>لا توجد قوالب بعد.</p>;

  return (
    <div className="space-y-4 p-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <p className="text-sm text-[#737373]">اختر قالبًا لتجربته على صفحتك. يتغيّر التصميم كله، ويبقى محتواك كما هو، ويمكنك التراجع.</p>
      <label className="flex items-center gap-2 rounded-xl bg-[#f2f2f7] px-3">
        <Search className="h-4 w-4 text-[#8e8e93]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في القوالب" aria-label="ابحث في القوالب" className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] focus:outline-none" />
      </label>
      {result && result.categories.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {['', ...result.categories].map((item) => (
            <button key={item || 'all'} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${category === item ? 'bg-[#111111] text-white' : 'bg-[#f2f2f7] text-[#3a3a3c]'}`}>{item || 'الكل'}</button>
          ))}
        </div>
      )}
      {!result && loading && <div className="-mx-5 flex gap-3 overflow-hidden px-5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[390/844] w-28 shrink-0 animate-pulse rounded-xl bg-[#f2f2f7]" />)}</div>}
      {result && result.templates.length === 0 && <p className="py-6 text-center text-sm text-[#8e8e93]">لا توجد قوالب مطابقة.</p>}
      <div ref={rail} role="region" aria-label="استعراض القوالب" tabIndex={0} className="-mx-5 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-5 pb-3 pt-1 [scroll-padding-inline:1.25rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {result?.templates.map((template) => {
          const active = applied?.id === template.id;
          return (
            <div key={template.id} className="w-28 shrink-0 snap-start space-y-2 sm:w-[124px]">
              <button type="button" onClick={() => tryTemplate(template)} aria-pressed={active} aria-label={`تجربة قالب ${template.name}`} className={`relative block w-full rounded-2xl outline-offset-2 ${active ? 'outline-2 outline-[#FF6B2C] [outline-style:solid]' : ''}`}>
                <TemplatePreview design={template.design} phone />
              </button>
              <p className="flex items-center justify-center gap-1 text-xs font-bold text-[#111111]">{active && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#FF6B2C]" />}<span className="truncate">{template.name}</span></p>
              {active && (
                <button type="button" disabled={applied.used} onClick={() => { track(template.id, 'used'); setApplied({ id: template.id, used: true }); }} className="w-full rounded-full bg-[#FF6B2C] py-1 text-xs font-bold text-white disabled:bg-[#FFF0E8] disabled:text-[#F25A18]">
                  {applied.used ? 'معتمد — احفظ' : 'اعتماد'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {result?.more && (
        <button type="button" disabled={loading} onClick={() => load(result.templates.length)} className="w-full rounded-xl bg-[#f2f2f7] py-2.5 text-sm font-bold text-[#111111] disabled:opacity-50">{loading ? '…' : 'عرض المزيد'}</button>
      )}
    </div>
  );
}

function TemplatesUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3 p-5 text-center text-sm text-[#8e8e93]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <p>تعذّر تحميل القوالب.</p>
      <button type="button" onClick={onRetry} className="rounded-full bg-[#f2f2f7] px-4 py-2 font-bold text-[#111111]">إعادة المحاولة</button>
    </div>
  );
}

type Shelf = { category: string; templates: PageTemplate[] };

// Under the association's editor: every shown template, one row per category
// in the order the categories were added. Tapping one tries it on the draft.
export function TemplateShelves({ desktop, onShowAll }: { desktop: boolean; onShowAll: (category: string) => void }) {
  const { applyDesign } = usePageContext();
  const [shelves, setShelves] = useState<Shelf[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tried, setTried] = useState('');
  const load = () => {
    setFailed(false);
    nonprofitCall<{ shelves: Shelf[] }>({ action: 'templates.shelves' })
      .then((next) => setShelves(next.shelves))
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  if (failed) return <TemplatesUnavailable onRetry={load} />;
  if (!shelves || !shelves.length) return null;
  const card = desktop ? 'w-[124px]' : 'w-28';
  return (
    <>
      {shelves.map((shelf) => (
        <section key={shelf.category || 'other'}>
          <div className="mb-3 flex items-end justify-between px-1">
            <h2 className="text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{shelf.category || 'قوالب أخرى'}</h2>
            <button type="button" onClick={() => onShowAll(shelf.category)} className="text-sm font-bold text-emerald-700">عرض الكل</button>
          </div>
          <div role="region" aria-label={`قوالب ${shelf.category || 'أخرى'}`} tabIndex={0} className={desktop ? 'flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : '-mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 pt-1 [scroll-padding-inline:1rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}>
            {shelf.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                aria-pressed={tried === template.id}
                aria-label={`تجربة قالب ${template.name}`}
                onClick={() => {
                  applyDesign(template.design);
                  setTried(template.id);
                  void nonprofitCall({ action: 'templates.track', id: template.id, event: 'tried' }).catch(() => undefined);
                }}
                className={`${card} shrink-0 snap-start text-right transition-transform active:scale-[0.97]`}
              >
                <span className={`relative block rounded-2xl ${tried === template.id ? 'ring-2 ring-emerald-400/70 ring-offset-2' : ''}`}>
                  <TemplatePreview design={template.design} phone />
                </span>
                <span className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-[#3a3a3c]">{tried === template.id && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}<span className="truncate">{template.name}</span></span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
