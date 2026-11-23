import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CreationCategoryArt } from '../components/CreationCategoryArt';
import { OnwanLogo } from '../components/OnwanLogo';
import { CREATION_CATEGORIES, readCreationCategory, saveCreationCategory, type CreationCategory } from '../lib/creationStart';
import '../../styles/creation-start.css';

// Presentation order only; category IDs and template selection remain unchanged.
const DISPLAY_CATEGORIES = ['personal', 'business', 'creator', 'nonprofit'].map(id => CREATION_CATEGORIES.find(item => item.id === id)!);

// Stage one is intentionally independent of account kind, authentication and billing.
export default function CreationStart() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<CreationCategory | null>(readCreationCategory);
  const [confirmed, setConfirmed] = useState(false);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'لمن تريد إنشاء الصفحة؟ — عنوان';
    return () => { document.title = previous; };
  }, []);
  const select = (id: CreationCategory) => { setSelected(id); setConfirmed(false); saveCreationCategory(id); };
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = { ArrowRight: -1, ArrowLeft: 1, ArrowDown: 2, ArrowUp: -2 }[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? CREATION_CATEGORIES.length - 1 : (index + delta + CREATION_CATEGORIES.length) % CREATION_CATEGORIES.length;
    select(DISPLAY_CATEGORIES[next].id);
    choices.current[next]?.focus();
  };
  return <div className="creation-start" dir="rtl">
    <div className="creation-start__frame">
      <header className="creation-start__header">
        <Link to="/" className="creation-start__back" aria-label="العودة للرئيسية"><ArrowRight size={22} aria-hidden="true" /></Link>
        <Link to="/" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
      </header>
      <div className="creation-start__progress" aria-label="الخطوة 1 من 4: نوع الصفحة">
        <div className="creation-start__step"><span>لنبدأ بصفحتك</span><span>الخطوة 1 من 4</span></div>
        <div className="creation-start__segments" aria-hidden="true"><span className="is-current" /><span /><span /><span /></div>
      </div>
      <main className="creation-start__main">
        <div className="creation-start__intro">
          <h1 id="creation-category-question">لمن تريد إنشاء الصفحة؟</h1>
          <p>اختر النوع المناسب، وتقدر تغيّره لاحقًا.</p>
        </div>
        <div className="creation-start__grid" role="radiogroup" aria-labelledby="creation-category-question" dir="rtl">
          {DISPLAY_CATEGORIES.map((item, index) => {
            const active = selected === item.id;
            return <button key={item.id} ref={element => { choices.current[index] = element; }} type="button" role="radio" aria-checked={active}
              tabIndex={active || (!selected && index === 0) ? 0 : -1} onKeyDown={event => move(event, index)} onClick={() => select(item.id)}
              className={`creation-start__choice creation-start__choice--${item.id}${active ? ' is-selected' : ''}`} dir="rtl">
              <span className="creation-start__art" aria-hidden="true"><CreationCategoryArt category={item.id} /></span>
              <span className="creation-start__choice-label">{item.label}</span>
              <span className="creation-start__check" aria-hidden="true">{active && <Check size={12} strokeWidth={2.5} />}</span>
            </button>;
          })}
        </div>
        <div className="creation-start__actions">
          <button type="button" className="creation-start__continue" disabled={!selected} onClick={() => {
            if (!selected) return;
            saveCreationCategory(selected);
            setConfirmed(true);
            navigate('/signup?step=profile');
          }}><span>التالي</span><ArrowLeft size={21} aria-hidden="true" /></button>
          <p className="sr-only" role="status" aria-live="polite">{confirmed ? `اختيارك محفوظ: ${CREATION_CATEGORIES.find(item => item.id === selected)?.label}` : ''}</p>
        </div>
      </main>
    </div>
  </div>;
}
