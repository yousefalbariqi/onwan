import { createGuestPageSource } from '../lib/creationDraftSource';
import { searchCreationTemplates } from '../lib/creationTemplateSearch';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Search, X } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { PhonePreview } from '../components/PhonePreview';
import { TemplatePreview } from '../components/TemplatePreview';
import { mergeWithDefaults } from '../context/PageContext';
import { readCreationCategory } from '../lib/creationStart';
import { creationSample, creationTemplates, readCreationDraft, readTemplateChoice, saveTemplateChoice, templateGroup, templatePreviewData, type TemplateGroup } from '../lib/creationTemplates';
import '../../styles/creation-templates.css';

export default function CreationTemplates() {
  const navigate = useNavigate();
  const [group] = useState<TemplateGroup>(() => templateGroup(readCreationCategory()));
  const [selected, setSelected] = useState(() => readTemplateChoice(group) || creationTemplates(group)[0].id);
  const [draft, setDraft] = useState(readCreationDraft);
  const [continuing, setContinuing] = useState(false);
  const continuePending = useRef(false);
  useEffect(() => { let alive = true; void createGuestPageSource().load().then(result => { if (alive) setDraft(result.pageData); }).catch(() => undefined); return () => { alive = false; }; }, []);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const groupLabel = { personal: 'تصاميم أفراد', business: 'تصاميم أنشطة تجارية', nonprofit: 'تصاميم قطاع غير ربحي' }[group];
  const suggestions = { personal: ['تصوير', 'محتوى', 'أعمال'], business: ['محاماة', 'عيادة', 'هندسة'], nonprofit: ['جمعية', 'مبادرة', 'تبرع'] }[group];
  useEffect(() => {
    // Safari may resize only the visual viewport when the keyboard opens.
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      screen.current?.style.setProperty('--themes-height', `${viewport.height}px`);
      setKeyboardOpen(viewport.height < window.innerHeight * .8);
    };
    resize(); viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);
  const openSearch = () => {
    // Keep focus in the tap event so iOS can open the software keyboard.
    flushSync(() => { setExpanded(true); setSearchOpen(true); });
    searchInput.current?.focus({ preventScroll: true });
  };
  const closeSearch = () => {
    searchInput.current?.blur(); setQuery(''); setSearchOpen(false); setExpanded(false);
    window.requestAnimationFrame(() => searchToggle.current?.focus({ preventScroll: true }));
  };
  const toggleSheet = () => { if (searchOpen) closeSearch(); else setExpanded(value => !value); };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const templates = creationTemplates(group);
  const results = searchCreationTemplates(templates, query);
  const active = templates.find(item => item.id === selected) || templates[0];
  const resultLabel = results.length === 0 ? 'لا توجد تصاميم مطابقة' : results.length === 1 ? 'تصميم واحد مطابق' : results.length === 2 ? 'تصميمان مطابقان' : `${results.length.toLocaleString('ar-SA')} تصاميم مطابقة`;
  const canContinue = results.some(item => item.id === active.id);
  const content = draft || creationSample(group);
  const sample = { ...content, links: content.links?.map(link => ({ ...link, url: link.url || 'https://example.com' })) };
  const preview = mergeWithDefaults(templatePreviewData(sample, active));
  useEffect(() => { const previous = document.title; document.title = 'اختر تصميم صفحتك — عنوان'; return () => { document.title = previous; }; }, []);
  const choose = (id: string) => { setSelected(id); setError(''); saveTemplateChoice(group, id); };
  return <div ref={screen} className={`creation-themes${expanded ? ' is-expanded' : ''}${keyboardOpen ? ' is-keyboard' : ''}`} dir="rtl">
    <header className="creation-themes__header">
      <Link to="/signup" className="creation-themes__back" aria-label="العودة لاختيار نوع الصفحة"><ArrowRight size={22} aria-hidden="true" /></Link>
      <div className="creation-themes__progress" role="progressbar" aria-label="الخطوة 2 من 3: اختر التصميم" aria-valuemin={0} aria-valuemax={3} aria-valuenow={2}><span /></div>
      <Link to="/" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
    </header>
    <main className="creation-themes__layout">
      <section className="creation-themes__stage" aria-label={`معاينة تصميم ${active.name}`} style={{ '--theme-tint': active.tint } as React.CSSProperties}>
        <div className="creation-themes__phone"><PhonePreview data={preview} interactive={false} /></div>
        <p className="creation-themes__preview-caption">{active.name}<span>معاينة صفحتك</span></p>
      </section>
      <section className="creation-themes__sheet" aria-labelledby="creation-themes-title">
        <div className="creation-themes__sheet-heading">
          <button type="button" className="creation-themes__handle" aria-label={expanded ? 'تقليص لوحة التصاميم' : 'توسيع لوحة التصاميم'} aria-expanded={expanded} aria-controls="creation-template-options"
            onPointerDown={event => { drag.current = { y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerUp={event => {
              if (!drag.current) return;
              const distance = event.clientY - drag.current.y;
              drag.current.moved = Math.abs(distance) > 28;
              if (drag.current.moved) {
                if (distance > 0 && searchOpen) closeSearch();
                else setExpanded(distance < 0);
              }
            }}
            onPointerCancel={() => { drag.current = null; }}
            onClick={() => { if (!drag.current?.moved) toggleSheet(); drag.current = null; }}><span aria-hidden="true" /></button>
          <div className="creation-themes__heading-row">
            {searchOpen ? <div className="creation-themes__search" role="search" aria-label="البحث في التصاميم">
              <Search size={18} aria-hidden="true" />
              <input ref={searchInput} type="search" aria-label="ابحث عن مجال أو اسم تصميم" placeholder="مجالك أو اسم التصميم…" value={query}
                onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }}
                aria-describedby="creation-search-status" autoComplete="off" maxLength={120} />
              {query && <button type="button" onClick={() => { setQuery(''); searchInput.current?.focus(); }} aria-label="مسح البحث"><X size={16} aria-hidden="true" /></button>}
              <button type="button" onClick={closeSearch} aria-label="إغلاق البحث والعودة للمعاينة"><ArrowRight size={19} aria-hidden="true" /></button>
            </div> : <>
              <div><h1 id="creation-themes-title">اختر تصميمك</h1><p>{groupLabel} <span aria-hidden="true">·</span> <Link to="/signup" aria-label="تغيير نوع الصفحة">تغيير النوع</Link></p></div>
              <button ref={searchToggle} type="button" className="creation-themes__search-toggle" onClick={openSearch} aria-label="البحث عن تصميم أو مجال" aria-expanded={searchOpen}><Search size={20} aria-hidden="true" /></button>
            </>}
          </div>
          {searchOpen && <>
            <h1 id="creation-themes-title" className="sr-only">البحث في التصاميم</h1>
            {!query.trim() && <div className="creation-themes__suggestions" aria-label="مجالات مقترحة">{suggestions.map(value => <button type="button" key={value} onClick={() => setQuery(value)}>{value}</button>)}</div>}
            <p id="creation-search-status" className="creation-themes__search-status" role="status" aria-live="polite">{query.trim() ? `${resultLabel} في ${groupLabel}` : 'ابحث باسم التصميم أو مجالك'}</p>
          </>}
        </div>
        <div id="creation-template-options" className="creation-themes__options" role="radiogroup" aria-label="التصاميم المتاحة">
          {results.map((template, index) => <button ref={node => { buttons.current[index] = node; }} key={template.id} type="button" role="radio" aria-checked={active.id === template.id} tabIndex={active.id === template.id || (!canContinue && index === 0) ? 0 : -1} aria-label={`تصميم ${template.name}`} className={`creation-themes__option${active.id === template.id ? ' is-selected' : ''}`} onClick={() => choose(template.id)} onKeyDown={event => {
            const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
            if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? results.length - 1 : (index + delta + results.length) % results.length;
            choose(results[next].id); buttons.current[next]?.focus();
          }}><span className="creation-themes__thumbnail"><TemplatePreview design={template.design} sample={sample} phone />{active.id === template.id && <span className="creation-themes__selected-mark"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>}</span><span className="creation-themes__name">{template.name}</span></button>)}
          {!results.length && <div className="creation-themes__empty"><Search size={26} aria-hidden="true" /><h2>ما لقينا تصميمًا مطابقًا</h2><p>جرّب اسم تصميم أو مجالًا آخر.</p><button type="button" onClick={() => setQuery('')}>عرض كل التصاميم</button></div>}
        </div>
        <footer className="creation-themes__footer">
          {error && <p role="alert" className="creation-themes__error">{error}</p>}
          <button type="button" className="creation-themes__continue" disabled={!canContinue || continuing} onClick={async () => {
            if (!canContinue || continuePending.current) return;
            continuePending.current = true; setContinuing(true); setError('');
            try {
              const source = createGuestPageSource({ cloud: false });
              const latest = await source.load().catch(() => ({ pageData: draft || creationSample(group) }));
              const next = mergeWithDefaults(templatePreviewData(latest.pageData, active));
              if (next.profileImage === '/template-samples/mark.svg') next.profileImage = '';
              await source.saveDraft!(next);
              saveTemplateChoice(group, active.id); navigate('/signup?step=save');
            } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر الاحتفاظ بالتصميم. حاول مجددًا.'); }
            finally { continuePending.current = false; setContinuing(false); }
          }}>{continuing ? 'جارٍ تجهيز صفحتك…' : 'استخدم هذا التصميم'}<ArrowLeft size={20} aria-hidden="true" /></button>
          <p className="creation-themes__hint" role="status" aria-live="polite">{canContinue ? `${active.name} · جرّب التعديل بدون تسجيل` : 'اختر تصميمًا من النتائج أو غيّر البحث'}</p>
        </footer>
      </section>
    </main>
  </div>;
}
