import { nonprofitPath } from '../lib/nonprofit';
import { arabicSlug } from '../lib/arabicSlug';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { checkUsername, login, signup } from '../lib/api';
import { pageHost } from '../lib/site';
import { useAuthSuccess } from '../lib/useAuthSuccess';
import { PasswordInput } from './PasswordInput';
import { TurnstileBox, useTurnstile } from '../lib/turnstile';

type AuthMode = 'signup' | 'login';
type Field = 'phone' | 'email' | 'password' | 'identifier';

interface AuthModalProps {
  mode: AuthMode;
  nonprofit?: boolean;
  username?: string;
  // Opened over the editor: keep the guest's design, and offer the other mode in place.
  inEditor?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

// Which field a server message is about, so it shows under that field.
function fieldOf(message: string, isSignup: boolean): Field | null {
  if (/جوال|الهاتف/.test(message)) return isSignup ? 'phone' : 'identifier';
  if (/البريد|الإيميل/.test(message)) return isSignup ? 'email' : 'identifier';
  if (/كلمة المرور/.test(message)) return 'password';
  return null;
}

// Notes 50–51: «إنشاء حسابك» opens by itself over the editor for a new
// visitor, and cannot be closed to keep editing: the account comes first. One
// grouped card of fields, a short error under the field it concerns, one
// button. After signup the editor opens on the chosen page name.
// The suggested link, or the first free variant of it (name-2, name-3, …).
async function freeName(base: string) {
  for (let i = 1; i <= 9; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 27)}-${i}`;
    const result = await checkUsername(candidate).catch(() => null);
    if (!result || result.available) return candidate;
  }
  return base;
}

export default function AuthModal({ mode: initialMode, username, inEditor = false, nonprofit = false }: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const onSuccess = useAuthSuccess();
  // Note 22: the association types its Arabic name; the link is suggested from it.
  const [organizationName, setOrganizationName] = useState('');
  const nonprofitUsername = arabicSlug(organizationName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const isSignup = mode === 'signup';
  const human = useTurnstile();
  const humanOk = human.status === 'off' || human.status === 'ready';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isSignup) {
      const found: typeof errors = {};
      if (!/^0?5\d{8}$/.test(phone) && phone.length < 8) found.phone = 'رقم الجوال غير مكتمل.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = 'تحقق من البريد الإلكتروني.';
      if (password.length < MIN_PASSWORD_LENGTH) found.password = `${MIN_PASSWORD_LENGTH} أحرف على الأقل.`;
      if (Object.keys(found).length) { setErrors(found); return; }
    }

    try {
      setErrors({});
      setLoading(true);

      if (isSignup) {
        onSuccess(await signup({ username: nonprofit ? await freeName(nonprofitUsername) : username || '', phone, email, password, ...(nonprofit ? { nonprofit: true, organizationName: organizationName.trim() } : {}) }), { keepDraft: inEditor, newNonprofit: nonprofit });
      } else {
        onSuccess(await login(identifier, password), { keepDraft: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : isSignup ? 'تعذر إنشاء الحساب الآن.' : 'تعذر تسجيل الدخول الآن.';
      setErrors({ [fieldOf(message, isSignup) ?? 'form']: message });
    } finally {
      setLoading(false);
    }
  };

  const clear = (field: Field) => setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current));
  // ألوان هوية الجمعيات (nonprofit.onwan.link) — تُطبَّق على نافذة الدخول/التسجيل فقط
  const surface = nonprofit ? 'bg-[#faf9f6]' : 'bg-[#f2f2f7]';
  const accentText = nonprofit ? 'text-[#6c8050]' : 'text-[#0a84ff]';
  const primaryButton = nonprofit ? 'bg-[#173c36] shadow-[0_6px_16px_rgba(23,60,54,0.28)]' : 'bg-[#0a84ff] shadow-[0_6px_16px_rgba(10,132,255,0.28)]';
  const ready = isSignup ? Boolean(phone && email && password && (!nonprofit || nonprofitUsername)) : Boolean(identifier && password);

  return (
    // Note 58: centred on every screen. The overlay itself scrolls, so with
    // the keyboard open or on a short screen the fields and the button stay
    // reachable and the card never leaves the screen.
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/25 backdrop-blur-[2px]" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-6">
      <section
        className={`animate-auth-modal-in relative w-full max-w-[400px] scroll-mt-6 rounded-[28px] ${surface} px-5 pb-7 pt-6 shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        dir="rtl"
        style={{ fontFamily: 'Tajawal, sans-serif' }}
      >
        {/* Outside the editor the visitor may go back; in it the account comes first (note 50). */}
        {!inEditor && (
          <button type="button" onClick={() => navigate(nonprofit ? nonprofitPath() : username ? `/?username=${encodeURIComponent(username)}` : '/')} className={`absolute right-4 top-4 flex h-9 items-center gap-1 rounded-full px-2 text-[15px] ${accentText}`}>
            <ArrowRight className="h-4 w-4" />رجوع
          </button>
        )}

        <div className="mb-5 text-center">
          <h1 id="auth-modal-title" className="text-[26px] font-black leading-tight text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {isSignup ? 'إنشاء حسابك' : 'تسجيل الدخول'}
          </h1>
          <p className="mt-1 text-[15px] text-[#6e6e73]">{isSignup ? 'أكمل بياناتك للبدء في تجهيز صفحتك' : 'أدخل بيانات حسابك للمتابعة'}</p>
          {isSignup && username && (
            <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" dir="ltr">{pageHost(username)}</span>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="overflow-hidden rounded-2xl bg-white">
            {isSignup ? (
              <>
                {nonprofit && <Row><input aria-label="اسم الجمعية بالعربية" value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="اسم الجمعية بالعربية" maxLength={80} className={inputClass} /></Row>}
                <Row label="الجوال" error={errors.phone}>
                  <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^0-9]/g, '')); clear('phone'); }} placeholder="05XXXXXXXX" maxLength={20} autoFocus aria-invalid={Boolean(errors.phone)} className={inputClass} dir="ltr" />
                </Row>
                <Row label="البريد" error={errors.email}>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value.trim()); clear('email'); }} placeholder="name@example.org" aria-invalid={Boolean(errors.email)} className={inputClass} dir="ltr" />
                </Row>
                <Row label="كلمة المرور" error={errors.password} last>
                  <PasswordInput autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل`} aria-invalid={Boolean(errors.password)} className={inputClass} dir="ltr" />
                </Row>
              </>
            ) : (
              <>
                <Row label="الجوال أو البريد" error={errors.identifier}>
                  <input type="text" autoComplete="username" value={identifier} onChange={(e) => { setIdentifier(e.target.value.trim()); clear('identifier'); }} placeholder="05XXXXXXXX" autoFocus className={inputClass} dir="ltr" />
                </Row>
                <Row label="كلمة المرور" error={errors.password} last>
                  <PasswordInput autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} placeholder="••••••••" className={inputClass} dir="ltr" />
                </Row>
              </>
            )}
          </div>

          <div className="mt-3"><TurnstileBox /></div>
          {isSignup && nonprofit && nonprofitUsername && <p className="mt-3 px-1 text-[13px] text-[#6e6e73]">الرابط المقترح: <span dir="ltr" className="font-bold text-[#173c36]">{nonprofitUsername}.onwan.link</span> — يمكن تعديله لاحقًا من لوحة الجمعية.</p>}
          {errors.form && <p role="alert" className="mt-3 px-1 text-[13px] text-[#ff3b30]">{errors.form}</p>}

          <button
            type="submit"
            disabled={loading || !ready || !humanOk}
            className={`mt-5 flex min-h-[52px] w-full items-center justify-center rounded-2xl ${primaryButton} text-[17px] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isSignup ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        {isSignup ? (
          <p className="mt-4 text-center text-[15px] text-[#6e6e73]">
            لديك حساب؟{' '}
            <button type="button" onClick={() => (inEditor || nonprofit ? (setErrors({}), setMode('login')) : navigate('/?auth=login'))} className={`font-bold ${accentText}`}>سجّل الدخول</button>
          </p>
        ) : (
          <div className="mt-4 flex items-center justify-between px-1 text-[15px]">
            <Link to={nonprofit && !window.location.hostname.startsWith('nonprofit.') ? '/nonprofit/reset-password' : '/reset-password'} className={accentText}>نسيت كلمة المرور؟</Link>
            {(inEditor && initialMode === 'signup') || nonprofit ? (
              <button type="button" onClick={() => { setErrors({}); setMode('signup'); }} className={`font-bold ${accentText}`}>إنشاء حساب جديد</button>
            ) : (
              <Link to="/?focus=name" className={`font-bold ${accentText}`}>إنشاء حساب جديد</Link>
            )}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-transparent py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';

// A grouped-list row: label on the right, the field beside it, and its own
// short error underneath.
function Row({ label, error, last = false, children }: { label?: string; error?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={last ? '' : 'border-b border-[#e5e5ea]'}>
      <label className="flex items-center gap-3 px-4">
        {label && <span className="w-[86px] shrink-0 text-[15px] text-[#1d1d1f]">{label}</span>}
        <span className="min-w-0 flex-1">{children}</span>
      </label>
      {error && <p role="alert" className="px-4 pb-2.5 text-[13px] text-[#ff3b30]">{error}</p>}
    </div>
  );
}

