import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { login, signup } from '../lib/api';
import { useAuthSuccess } from '../lib/useAuthSuccess';

type AuthMode = 'signup' | 'login';

interface AuthModalProps {
  mode: AuthMode;
  username?: string;
  // Opened over the editor: keep the guest's design, and offer the other mode in place.
  inEditor?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

// The modal intentionally has no dismiss action: registration starts only
// after a name has been picked and continues in this focused step.
export default function AuthModal({ mode: initialMode, username, inEditor = false }: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const onSuccess = useAuthSuccess({ keepDraft: inEditor && initialMode === 'signup' });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSignup = mode === 'signup';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isSignup) {
      if (phone.length < 8) {
        setError('يرجى إدخال رقم جوال صحيح.');
        return;
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`لزيادة أمان حسابك، اختر كلمة مرور من ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`);
        return;
      }
    }

    try {
      setError('');
      setLoading(true);

      if (isSignup) {
        onSuccess(await signup({ username: username || '', phone, email, password }));
      } else {
        onSuccess(await login(identifier, password));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isSignup ? 'تعذر إنشاء الحساب الآن.' : 'تعذر تسجيل الدخول الآن.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/10 p-4" role="presentation">
      <section
        className="animate-auth-modal-in relative w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        dir="rtl"
      >
        <button
          type="button"
          onClick={() => navigate(username ? `/?username=${encodeURIComponent(username)}` : '/')}
          className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:right-6 sm:top-6"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
        <div className="mb-5 text-center">
          <h1 id="auth-modal-title" className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {isSignup ? 'إنشاء حساب الجهة' : 'تسجيل الدخول'}
          </h1>
          <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {isSignup ? 'أكمل بياناتك للبدء في تجهيز الصفحة.' : 'أدخل بيانات حسابك للمتابعة.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          {isSignup ? (
            <>
              <ModalField
                label="رقم الجوال"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder="05XXXXXXXX"
                maxLength={20}
                autoFocus
              />
              <ModalField
                label="البريد الإلكتروني"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value.trim())}
                placeholder="name@example.org"
              />
              <ModalField
                label="كلمة المرور"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                hint={`${MIN_PASSWORD_LENGTH} أحرف على الأقل، ويُفضّل أن تجمع بين حروف وأرقام.`}
              />
            </>
          ) : (
            <>
              <ModalField
                label="البريد الإلكتروني أو رقم الجوال"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value.trim())}
                placeholder="05XXXXXXXX"
                autoFocus
              />
              <ModalField
                label="كلمة المرور"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </>
          )}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{error}</div>}

          <button
            type="submit"
            disabled={loading || (isSignup ? !phone || !email || !password : !identifier || !password)}
            className="mt-1 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-lime-500 to-emerald-500 px-4 py-3 text-base font-bold text-white transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {loading ? 'لحظات...' : isSignup ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        {isSignup ? (
          <p className="mt-4 text-center text-sm text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            لديك حساب؟{' '}
            <button type="button" onClick={() => (inEditor ? (setError(''), setMode('login')) : navigate('/?auth=login'))} className="font-bold text-emerald-700 hover:underline">
              سجّل الدخول
            </button>
          </p>
        ) : (
          <div className="mt-4 flex items-center justify-between text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <Link to="/reset-password" className="font-bold text-emerald-700 hover:underline">
              نسيت كلمة المرور؟
            </Link>
            <Link to="/?focus=name" className="font-bold text-emerald-700 hover:underline">
              إنشاء حساب جديد
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function ModalField({ label, hint, ...inputProps }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-right">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>{label}</span>
      <input
        {...inputProps}
        required
        dir="ltr"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center text-base text-gray-900 outline-none transition-colors placeholder:text-center placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      />
      {hint && <span className="mt-1 block text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>{hint}</span>}
    </label>
  );
}
