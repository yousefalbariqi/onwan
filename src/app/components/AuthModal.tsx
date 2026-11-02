import { nonprofitPath } from '../lib/nonprofit';
import { arabicSlug } from '../lib/arabicSlug';
import { toAsciiDigits } from '../lib/digits';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Link2, Loader2 } from 'lucide-react';
import { ApiError, checkUsername, login, signup } from '../lib/api';
import { pageHost } from '../lib/site';
import { useAuthSuccess } from '../lib/useAuthSuccess';
import { PasswordInput } from './PasswordInput';
import { TurnstileBox, useTurnstile } from '../lib/turnstile';
import { EMAIL_HINT, PHONE_HINT, isValidEmailAddress, normalizeSaudiMobile, passwordChecks, passwordProblem } from '../../../shared/accountRules';

type AuthMode = 'signup' | 'login';
type Field = 'phone' | 'email' | 'password' | 'identifier';

interface AuthModalProps {
  mode: AuthMode;
  nonprofit?: boolean;
  username?: string;
  // Opened over the editor: keep the guest's design, and offer the other mode in place.
  inEditor?: boolean;
}


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
export default function AuthModal({ mode: initialMode, username, inEditor = false, nonprofit = false }: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const onSuccess = useAuthSuccess();
  // Note 22: the association types its Arabic name; the link is suggested from it.
  const [organizationName, setOrganizationName] = useState('');
  // Note 24: the link shows small under the name; «تعديل» opens a field for it.
  const [editingLink, setEditingLink] = useState(false);
  const [customLink, setCustomLink] = useState('');
  const nonprofitUsername = editingLink ? customLink : arabicSlug(organizationName);
  const [linkState, setLinkState] = useState<{ name: string; status: 'checking' | 'available' | 'unavailable' | 'error'; reason?: string } | null>(null);
  const [linkRetry, setLinkRetry] = useState(0);
  useEffect(() => {
    if (!nonprofit || mode !== 'signup' || !nonprofitUsername) { setLinkState(null); return; }
    let live = true;
    const controller = new AbortController();
    setLinkState({ name: nonprofitUsername, status: 'checking' });
    let timeout: number | undefined;
    const timer = window.setTimeout(async () => {
      timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const result = await checkUsername(nonprofitUsername, controller.signal);
        if (live) setLinkState({ name: nonprofitUsername, status: result.available ? 'available' : 'unavailable', reason: result.reason ?? undefined });
      } catch {
        if (live) setLinkState({ name: nonprofitUsername, status: 'error', reason: 'تعذر التحقق من الرابط الآن. أعد المحاولة.' });
      } finally {
        window.clearTimeout(timeout);
      }
    }, 400);
    return () => { live = false; window.clearTimeout(timer); window.clearTimeout(timeout); controller.abort(); };
  }, [nonprofit, mode, nonprofitUsername, linkRetry]);
  const linkReady = !nonprofit || (linkState?.name === nonprofitUsername && linkState.status === 'available');
  const checkingLink = Boolean(nonprofitUsername && (linkState?.name !== nonprofitUsername || linkState.status === 'checking'));
  const linkTaken = !checkingLink && (linkState?.status === 'unavailable' || linkState?.status === 'error');
  const linkSize = nonprofitUsername.length > 20 ? 'text-[15px]' : nonprofitUsername.length > 13 ? 'text-[17px]' : 'text-[20px]';
  const startLinkEdit = () => { setCustomLink(nonprofitUsername); setEditingLink(true); };
  const linkTone = checkingLink ? 'text-[#737373]' : linkState?.status === 'available' ? 'text-[#15803D]' : linkTaken ? 'text-[#DC2626]' : 'text-[#111111]';
  // A taken link opens its field at once, so another name can be typed.
  useEffect(() => {
    if (linkState?.status === 'unavailable' && linkState.name === nonprofitUsername && !editingLink) { setCustomLink(nonprofitUsername); setEditingLink(true); }
  }, [linkState, nonprofitUsername, editingLink]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const isSignup = mode === 'signup';
  const human = useTurnstile();
  const humanOk = human.status === 'off' || human.status === 'ready';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (loading || !humanOk || (isSignup && nonprofit && (!organizationName.trim() || !nonprofitUsername || !linkReady))) return;

    // Note 07: the same rules the server applies (shared/accountRules.ts).
    if (isSignup) {
      const found: typeof errors = {};
      if (!normalizeSaudiMobile(phone)) found.phone = PHONE_HINT;
      if (!isValidEmailAddress(email)) found.email = EMAIL_HINT;
      const weak = passwordProblem(password);
      if (weak) found.password = weak;
      if (Object.keys(found).length) { setErrors(found); return; }
    } else if (!isValidEmailAddress(identifier)) {
      setErrors({ identifier: EMAIL_HINT });
      return;
    }

    try {
      setErrors({});
      setLoading(true);

      if (isSignup) {
        onSuccess(await signup({ username: nonprofit ? nonprofitUsername : username || '', phone: normalizeSaudiMobile(phone) ?? phone, email, password, ...(nonprofit ? { nonprofit: true, organizationName: organizationName.trim() } : {}) }), { keepDraft: inEditor, newNonprofit: nonprofit });
      } else {
        onSuccess(await login(identifier, password), { keepDraft: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : isSignup ? 'تعذر إنشاء الحساب الآن.' : 'تعذر تسجيل الدخول الآن.';
      if (isSignup && nonprofit && err instanceof ApiError && err.code?.startsWith('username_')) {
        setLinkState({ name: nonprofitUsername, status: 'unavailable', reason: message });
      }
      setErrors({ [fieldOf(message, isSignup) ?? 'form']: message });
    } finally {
      setLoading(false);
    }
  };

  // Typing never shows red: it hides this field's message until the visitor leaves it again.
  const clear = (field: Field) => {
    setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current));
    setTouched((current) => (current[field] ? { ...current, [field]: false } : current));
  };
  // Note 09: the nonprofit account pages use the «عنوان» brand (onwan-brand.html).
  const { surface, accentText, primaryButton } = authTheme(nonprofit);
  // Every field is judged when the visitor leaves it or presses the button —
  // never while typing; the checklist under the password is the live guide.
  const blur = (field: Field) => () => setTouched((current) => ({ ...current, [field]: true }));
  const phoneHint = touched.phone && phone && !normalizeSaudiMobile(phone) ? PHONE_HINT : undefined;
  const emailHint = touched.email && email && !isValidEmailAddress(email) ? EMAIL_HINT : undefined;
  const loginEmailHint = touched.identifier && identifier && !isValidEmailAddress(identifier) ? EMAIL_HINT : undefined;
  const passwordHint = touched.password && password ? passwordProblem(password) ?? undefined : undefined;
  const ready = isSignup ? Boolean(normalizeSaudiMobile(phone) && isValidEmailAddress(email) && !passwordProblem(password) && (!nonprofit || (organizationName.trim() && nonprofitUsername && linkReady))) : Boolean(identifier && password);

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
                {nonprofit && <>
                  <Row><input aria-label="اسم الجمعية" value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="اسم الجمعية" maxLength={80} disabled={loading} autoFocus className={inputClass} /></Row>
                </>}
                <Row label="الجوال" error={errors.phone ?? phoneHint}>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(toAsciiDigits(e.target.value).replace(/[^0-9+]/g, '')); clear('phone'); }} onBlur={blur('phone')} placeholder="05XXXXXXXX" maxLength={16} autoFocus={!nonprofit} aria-invalid={Boolean(errors.phone ?? phoneHint)} className={inputClass} dir="ltr" />
                </Row>
                <Row label="البريد الإلكتروني" error={errors.email ?? emailHint} stacked>
                  <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value.trim()); clear('email'); }} onBlur={blur('email')} placeholder="name@example.com" aria-invalid={Boolean(errors.email ?? emailHint)} className={inputClassStacked} dir="ltr" />
                </Row>
                <Row label="كلمة المرور" error={errors.password ?? passwordHint} last={!nonprofit}>
                  <PasswordInput autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} onBlur={blur('password')} placeholder="••••••••" aria-invalid={Boolean(errors.password ?? passwordHint)} aria-describedby="password-rules" className={inputClass} dir="ltr" />
                </Row>
                {/* The suggested link is the last, full-width row — an important result of the data above. */}
                {nonprofit && (organizationName.trim() || editingLink) && (
                  <div className="px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-[#8e8e93]">رابط جمعيتكم</span>
                      {!editingLink && <button type="button" disabled={loading} onClick={startLinkEdit} className="text-[13px] font-bold text-[#F25A18]">تعديل</button>}
                    </div>
                    {!editingLink ? (
                      // The whole link stays visible: smaller type for long names, wrapping only as a last resort.
                      <button type="button" disabled={loading} onClick={startLinkEdit} aria-label="تعديل الرابط" className="flex w-full items-center gap-2 text-start">
                        <Link2 className="h-5 w-5 shrink-0 text-[#FF6B2C]" />
                        <span dir="ltr" className={`min-w-0 flex-1 break-all font-black ${linkSize} ${linkTone}`}>{nonprofitUsername || '…'}.onwan.link</span>
                        {checkingLink && nonprofitUsername && <Loader2 aria-label="جارٍ التحقق من توفر الرابط" className="h-4 w-4 shrink-0 animate-spin text-[#737373]" />}
                      </button>
                    ) : (
                      <div className={`flex items-center overflow-hidden rounded-xl bg-[#f7f7f7] ring-1 ${linkTaken ? 'ring-[#DC2626]' : 'ring-[#e5e5ea] focus-within:ring-[#FF6B2C]'}`} dir="ltr">
                        <input autoFocus aria-label="رابط الصفحة" aria-invalid={linkTaken} value={customLink} disabled={loading} onChange={e => setCustomLink(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={30} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[17px] font-bold focus:outline-none" />
                        <span className="pr-3 text-[15px] text-[#8e8e93]">.onwan.link</span>
                      </div>
                    )}
                    <div role="status" aria-live="polite">
                      {!nonprofitUsername ? <p className="mt-1.5 text-[13px] text-[#737373]">أدخل الرابط للتحقق من توفره.</p>
                        : !checkingLink && linkTaken ? (
                          <p className="mt-1.5 text-[13px] text-[#DC2626]">{linkState?.reason || 'هذا الرابط غير متاح. اختر اسمًا آخر.'}
                            {linkState?.status === 'error' && <button type="button" onClick={() => setLinkRetry(value => value + 1)} className="mr-2 font-bold underline">إعادة المحاولة</button>}
                          </p>
                        ) : null}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Note 08: sign-in is by email only. A failed sign-in concerns both
                    fields, so its error is shown under the box, not between them. */}
                <Row label="البريد الإلكتروني" stacked>
                  <input type="email" inputMode="email" autoComplete="email" value={identifier} onChange={(e) => { setIdentifier(e.target.value.trim()); clear('identifier'); }} onBlur={blur('identifier')} placeholder="name@example.com" autoFocus aria-invalid={Boolean(errors.identifier || loginEmailHint)} className={inputClassStacked} dir="ltr" />
                </Row>
                <Row label="كلمة المرور" last>
                  <PasswordInput autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} placeholder="••••••••" className={inputClass} dir="ltr" />
                </Row>
              </>
            )}
          </div>

          {isSignup && <PasswordRules password={password} />}
          {/* The link's helper note stays below the table, as a help note. */}
          {isSignup && nonprofit && (organizationName.trim() || editingLink) && (
            <p className="mt-2 px-1 text-[13px] text-[#737373]">يُعتمد الرابط عند تفعيل الحساب، ويمكنكم لاحقًا استخدام نطاقكم الخاص (الدومين).</p>
          )}
          {/* A login failure concerns both fields: shown here, below them and before Turnstile. */}
          {!isSignup && (errors.identifier || errors.password || loginEmailHint || errors.form) && (
            <p role="alert" className="mt-3 px-1 text-[13px] text-[#ff3b30]">{errors.identifier || errors.password || loginEmailHint || errors.form}</p>
          )}
          <div className="mt-3"><TurnstileBox /></div>
          {isSignup && errors.form && <p role="alert" className="mt-3 px-1 text-[13px] text-[#ff3b30]">{errors.form}</p>}

          <button
            type="submit"
            disabled={loading || !ready || !humanOk}
            className={`mt-5 flex min-h-[52px] w-full items-center justify-center rounded-2xl ${primaryButton} text-[17px] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {loading ? <span className="flex items-center gap-2"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />{isSignup ? 'جارٍ إنشاء الحساب…' : 'جارٍ تسجيل الدخول…'}</span> : isSignup ? 'إنشاء الحساب' : 'دخول'}
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

// Note 09: one look for every account page — the general one, and the «عنوان»
// brand on the nonprofit pages (also used by the password reset there).
export function authTheme(nonprofit: boolean) {
  return nonprofit
    ? { surface: 'bg-[#F8F8F6]', accentText: 'text-[#FF6B2C]', primaryButton: 'bg-[#FF6B2C] shadow-[0_6px_16px_rgba(255,107,44,0.28)] hover:bg-[#F25A18]' }
    : { surface: 'bg-[#f2f2f7]', accentText: 'text-[#0a84ff]', primaryButton: 'bg-[#0a84ff] shadow-[0_6px_16px_rgba(10,132,255,0.28)]' };
}

// Note 07: the password rules as a live checklist under the fields.
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul id="password-rules" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[12px]" aria-live="polite">
      {passwordChecks(password).map((item) => (
        <li key={item.label} className={item.ok ? 'text-[#16A34A]' : 'text-[#8e8e93]'}>{item.ok ? '✓' : '•'} {item.label}</li>
      ))}
    </ul>
  );
}

export const inputClass = 'w-full bg-transparent py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';
// Stacked layout: label above, so the input keeps the full width and a long
// email stays reviewable to its end without shrinking the font.
export const inputClassStacked = 'w-full bg-transparent pb-2.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';

// A grouped-list row. Default: label on the right, the field beside it. With
// `stacked`, the label sits above and the field takes the whole width below —
// used for the email, where seeing the full address matters more than the row.
export function Row({ label, error, last = false, stacked = false, children }: { label?: string; error?: string; last?: boolean; stacked?: boolean; children: React.ReactNode }) {
  return (
    <div className={last ? '' : 'border-b border-[#e5e5ea]'}>
      <label className={stacked ? 'block px-4 pt-2' : 'flex items-center gap-3 px-4'}>
        {label && <span className={stacked ? 'mb-0.5 block text-[12px] font-medium text-[#8e8e93]' : 'min-w-[86px] shrink-0 whitespace-nowrap text-[15px] text-[#1d1d1f]'}>{label}</span>}
        <span className={stacked ? 'block min-w-0' : 'min-w-0 flex-1'}>{children}</span>
      </label>
      {error && <p role="alert" className="px-4 pb-2.5 text-[13px] text-[#ff3b30]">{error}</p>}
    </div>
  );
}

