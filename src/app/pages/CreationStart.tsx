import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Store, UserRound, Video } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { CREATION_CATEGORIES, readCreationCategory, saveCreationCategory, type CreationCategory } from '../lib/creationStart';
import '../../styles/creation-start.css';

const ICONS = { person: UserRound, video: Video, store: Store, heart: HeartHandshake };

// Stage one is intentionally independent of account kind, authentication and billing.
export default function CreationStart() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<CreationCategory | null>(readCreationCategory);
  const [confirmed, setConfirmed] = useState(false);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'صفحتك، بطريقتك — عنوان';
    return () => { document.title = previous; };
  }, []);
  const select = (id: CreationCategory) => { setSelected(id); setConfirmed(false); saveCreationCategory(id); };
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 }[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? CREATION_CATEGORIES.length - 1 : (index + delta + CREATION_CATEGORIES.length) % CREATION_CATEGORIES.length;
    select(CREATION_CATEGORIES[next].id);
    choices.current[next]?.focus();
  };
  return <div className="creation-start" dir="rtl">
    <div className="creation-start__frame">
      <header className="creation-start__header">
        <Link to="/" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
        <Link to="/" className="creation-start__back" aria-label="العودة للرئيسية"><ArrowRight size={22} aria-hidden="true" /></Link>
      </header>
      <div className="creation-start__progress" aria-label="الخطوة 1 من 3: نوع الصفحة">
        <div className="creation-start__step"><span>لنبدأ بصفحتك</span><span>الخطوة 1 من 3</span></div>
        <div className="creation-start__segments" aria-hidden="true"><span className="is-current" /><span /><span /></div>
      </div>
      <main className="creation-start__main">
        <div className="creation-start__intro">
          <h1>صفحتك، بطريقتك.</h1>
          <p>اجمع روابطك وصورك وملفاتك في صفحة واحدة.<br className="creation-start__mobile-break" /> جرّب بنفسك قبل التسجيل.</p>
        </div>
        <h2 id="creation-category-question">لمن تريد إنشاء الصفحة؟</h2>
        <div className="creation-start__grid" role="radiogroup" aria-labelledby="creation-category-question" dir="ltr">
          {CREATION_CATEGORIES.map((item, index) => {
            const Icon = ICONS[item.icon];
            const active = selected === item.id;
            return <button key={item.id} ref={element => { choices.current[index] = element; }} type="button" role="radio" aria-checked={active}
              tabIndex={active || (!selected && index === 0) ? 0 : -1} onKeyDown={event => move(event, index)} onClick={() => select(item.id)}
              className={`creation-start__choice${active ? ' is-selected' : ''}`} dir="rtl">
              <Icon size={34} strokeWidth={1.65} aria-hidden="true" />
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
            navigate('/signup?step=templates');
          }}><span>شاهد التصاميم المناسبة</span><ArrowLeft size={21} aria-hidden="true" /></button>
          <p className="creation-start__hint" role="status" aria-live="polite">{confirmed ? `اختيارك محفوظ: ${CREATION_CATEGORIES.find(item => item.id === selected)?.label}` : 'بدون تسجيل. اختر ما يناسبك وجرّب.'}</p>
        </div>
      </main>
    </div>
  </div>;
}
