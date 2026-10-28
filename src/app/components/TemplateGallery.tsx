import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { nonprofitCall } from '../lib/api';
import type { PageTemplate } from '../lib/pageDesign';
import { TemplatePreview } from './TemplatePreview';

type ListResult = { templates: PageTemplate[]; more: boolean; categories: string[] };

// «القوالب الجاهزة» in the association's editor: the templates the manager has
// shown, nine at a time. Tapping one tries it on the draft (undo or history
// bring the old look back); «اعتماد» counts it as used. Content never changes.
// Until any template is shown, the former colour themes stay (fallback).
export function TemplateGallery({ fallback }: { fallback: ReactNode }) {
  const { applyDesign } = usePageContext();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState<{ id: string; used: boolean } | null>(null);
  const request = useRef(0);

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
  if (failed && !result) return <>{fallback}</>;
  if (nothingShown) return <>{fallback}</>;

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
      {!result && loading && <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[9/13] animate-pulse rounded-2xl bg-[#f2f2f7]" />)}</div>}
      {result && result.templates.length === 0 && <p className="py-6 text-center text-sm text-[#8e8e93]">لا توجد قوالب مطابقة.</p>}
      <div className="grid grid-cols-3 gap-3">
        {result?.templates.map((template) => {
          const active = applied?.id === template.id;
          return (
            <div key={template.id} className="space-y-1.5">
              <button type="button" onClick={() => tryTemplate(template)} aria-pressed={active} aria-label={`تجربة قالب ${template.name}`} className={`relative block w-full rounded-2xl outline-offset-2 ${active ? 'outline-2 outline-[#FF6B2C] [outline-style:solid]' : ''}`}>
                <TemplatePreview design={template.design} />
                {active && <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6B2C] text-white"><Check className="h-4 w-4" /></span>}
              </button>
              <p className="truncate text-center text-xs font-bold text-[#111111]">{template.name}</p>
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
