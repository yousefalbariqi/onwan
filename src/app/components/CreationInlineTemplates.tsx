import { usePageContext } from '../context/PageContext';
import { useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { searchCreationTemplates } from '../lib/creationTemplateSearch';
import { readCreationCategory, saveCreationCategory } from '../lib/creationStart';
import { creationTemplates, saveTemplateChoice, templateGroup, TEMPLATE_GROUPS, type TemplateGroup } from '../lib/creationTemplates';
import { ArrowRight, Check, Search } from 'lucide-react';

export function CreationInlineTemplates({ onSearchOpen, controlsTarget }: { onSearchOpen?: () => void; controlsTarget?: HTMLElement | null }) {
  const { pageData, applyDesign } = usePageContext();
  const [group, setGroup] = useState<TemplateGroup>(() => templateGroup(readCreationCategory()));
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const results = searchCreationTemplates(creationTemplates(group), query);
  const closeSearch = () => { setQuery(''); setSearchOpen(false); window.requestAnimationFrame(() => toggle.current?.focus()); };
  const groupLabel = { personal: 'تصاميم أفراد', business: 'تصاميم أنشطة تجارية', nonprofit: 'تصاميم قطاع غير ربحي' }[group];
  const suggestions = { personal: ['تصوير', 'محتوى', 'أعمال'], business: ['محاماة', 'عيادة', 'هندسة'], nonprofit: ['جمعية', 'مبادرة', 'تبرع'] }[group];
  const controls = <div className="inline-editor__template-heading">
    {searchOpen ? <div className="inline-editor__template-search">
      <Search size={20} aria-hidden="true" />
      <input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="ابحث عن قالب أو مجال" placeholder="مجالك أو اسم التصميم…" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }} />
      <button type="button" aria-label="العودة إلى القوالب ومسح البحث" onClick={closeSearch}><ArrowRight size={20} /></button>
    </div> : <>
      <div><span className="inline-editor__template-title">القوالب</span><p>{groupLabel}<span aria-hidden="true"> · </span><button type="button" aria-expanded={categoriesOpen} aria-controls="inline-template-categories" onClick={() => setCategoriesOpen(!categoriesOpen)}>تغيير</button></p></div>
      <button ref={toggle} type="button" aria-label="البحث في القوالب" className="inline-editor__search-toggle" onClick={() => { flushSync(() => { setCategoriesOpen(false); setSearchOpen(true); onSearchOpen?.(); }); input.current?.focus({ preventScroll: true }); }}><Search size={20} /></button>
    </>}
  </div>;
  return <>
    {controlsTarget ? createPortal(controls, controlsTarget) : controls}
    {!searchOpen && categoriesOpen && <div id="inline-template-categories" className="inline-editor__template-chips" role="group" aria-label="تصنيف القوالب">{TEMPLATE_GROUPS.map(item => <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => { setGroup(item.id); setCategoriesOpen(false); }}>{item.label}</button>)}</div>}
    {searchOpen && <div className="inline-editor__template-chips" role="group" aria-label="مجالات مقترحة">{suggestions.map(item => <button type="button" key={item} aria-pressed={query === item} onClick={() => setQuery(item)}>{item}</button>)}</div>}
    {searchOpen && <p className="sr-only" role="status" aria-live="polite">{results.length} تصاميم مطابقة</p>}
    <div className="inline-editor__templates">{results.map(template => <button type="button" key={template.id} aria-label={`تطبيق قالب ${template.name}`} aria-pressed={pageData.theme.id === template.design.theme.id} onClick={() => { applyDesign(template.design); saveTemplateChoice(group, template.id); if (templateGroup(readCreationCategory()) !== group) saveCreationCategory(group); }} className="inline-editor__template">
    <span className="inline-editor__swatch" aria-hidden="true" style={{ background: template.design.theme.background, color: template.design.theme.textColor, fontFamily: template.design.typography.font === 'amiri' ? 'Amiri, serif' : 'Cairo, sans-serif' }}>
      <span>أب</span><i style={{ background: template.design.theme.buttonColor, borderRadius: template.design.buttonStyle.shape === 'pill' ? 999 : template.design.buttonStyle.shape === 'square' ? 0 : 12, border: template.design.buttonStyle.border ? '1px solid currentColor' : 'none' }} />
      {pageData.theme.id === template.design.theme.id && <b><Check size={13} /></b>}
    </span><span>{template.name}</span>
  </button>)}</div>
    {!results.length && <div className="inline-editor__template-empty"><p>ما لقينا تصميمًا مطابقًا. جرّب اسمًا أو مجالًا آخر.</p><button type="button" onClick={() => setQuery('')}>مسح البحث</button></div>}
  </>;
}
