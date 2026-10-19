import { ReactNode, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '../context/PageContext';

export function SectionLayout({ heading, items, renderItem, lang }: { heading: Link; items: Link[]; renderItem: (item: Link) => ReactNode; lang: 'ar' | 'en' }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const current = Math.min(active, Math.max(0, items.length - 1));
  const layout = heading.display?.sectionLayout ?? 'list';
  const title = (lang === 'en' && heading.titleEn) || heading.title;
  const go = (index: number) => {
    const element = rail.current?.children[index] as HTMLElement | undefined;
    if (!element) return;
    const reduced = element.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
    setActive(index);
  };
  return <section aria-label={title} className="min-w-0 space-y-4">
    {renderItem(heading)}
    {layout === 'carousel' ? <>
      <div ref={rail} role="region" aria-label={`${title} — ${lang === 'en' ? 'carousel' : 'شرائح أفقية'}`} tabIndex={0} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.target !== event.currentTarget) return;
        event.preventDefault();
        const delta = event.key === (lang === 'ar' ? 'ArrowLeft' : 'ArrowRight') ? 1 : -1;
        go(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, current + delta)));
      }} onScroll={() => {
        const element = rail.current;
        if (!element || !element.children.length) return;
        const box = element.getBoundingClientRect();
        const distances = Array.from(element.children).map(child => { const rect = child.getBoundingClientRect(); return Math.abs(lang === 'ar' ? rect.right - box.right : rect.left - box.left); });
        setActive(distances.indexOf(Math.min(...distances)));
      }} className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-2 focus-visible:outline-offset-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {items.map((item, index) => <div key={item.id} role="group" aria-roledescription={lang === 'en' ? 'slide' : 'شريحة'} aria-label={`${index + 1} / ${items.length}`} className="min-w-0 w-[88%] shrink-0 snap-start last:snap-end">{renderItem(item)}</div>)}
      </div>
      {items.length > 1 && <div className="flex items-center justify-center gap-3">
        <button type="button" aria-label={lang === 'en' ? 'Previous slide' : 'الشريحة السابقة'} disabled={current === 0} onClick={() => go(current - 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30 disabled:opacity-30">{lang === 'ar' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        <span aria-live="polite" dir="ltr" className="text-xs tabular-nums">{current + 1} / {items.length}</span>
        <button type="button" aria-label={lang === 'en' ? 'Next slide' : 'الشريحة التالية'} disabled={current >= items.length - 1} onClick={() => go(current + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30 disabled:opacity-30">{lang === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
      </div>}
    </> : <div className={layout === 'grid' ? 'grid grid-cols-2 items-start gap-3' : 'space-y-4'}>
      {items.map(item => <div key={item.id} className={`min-w-0 ${layout === 'grid' && (item.display?.kind === 'video' || item.display?.kind === 'text') ? 'col-span-2' : ''}`}>{renderItem(item)}</div>)}
    </div>}
  </section>;
}
