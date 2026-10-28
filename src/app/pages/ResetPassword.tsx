import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { TurnstileBox, useHumanOk } from '../lib/turnstile';
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthLayout';
import { PasswordRules, Row, authTheme, inputClass } from '../components/AuthModal';
import { PasswordInput } from '../components/PasswordInput';
import { NonprofitAuthBackdrop } from './NonprofitPortal';
import { confirmPasswordReset, requestPasswordReset } from '../lib/api';
import { nonprofitPath } from '../lib/nonprofit';
import { useAuthSuccess } from '../lib/useAuthSuccess';
import { EMAIL_HINT, PASSWORD_HINT, isValidEmailAddress, passwordProblem } from '../../../shared/accountRules';

// ACCT-06: a one-time code to the registered email, then a new password.
function useResetFlow() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const humanOk = useHumanOk();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const onSuccess = useAuthSuccess();
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    if (!resendSeconds) return;
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);
  const changeEmail = () => { setStep('email'); setCode(''); setPassword(''); setError(''); setNotice(''); };

  const request = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmailAddress(email)) { setError(EMAIL_HINT); return; }
    try {
      setError('');
      setLoading(true);
      const response = await requestPasswordReset(email);
      setNotice(response.message);
      setStep('code');
      setCode('');
      setResendSeconds(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرمز الآن.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    // Note 07: the new password follows the same rules as at sign-up.
    const weak = passwordProblem(password);
    if (weak) { setError(weak); return; }
    try {
      setError('');
      setLoading(true);
      onSuccess(await confirmPasswordReset(email, code, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور الآن.');
    } finally {
      setLoading(false);
    }
  };

  return { step, humanOk, email, setEmail, code, setCode, password, setPassword, loading, error, notice, request, confirm, changeEmail, resendSeconds };
}

export default function ResetPassword({ nonprofit = false }: { nonprofit?: boolean }) {
  return nonprofit ? <NonprofitReset /> : <GeneralReset />;
}

function GeneralReset() {
  const flow = useResetFlow();
  return (
    <AuthLayout
      icon={KeyRound}
      title="استعادة كلمة المرور"
      subtitle={flow.step === 'email' ? 'نرسل رمزًا مؤقتًا إلى بريدك المسجل.' : 'أدخل الرمز الذي وصلك ثم كلمة المرور الجديدة.'}
      backTo="/login"
    >
      {flow.step === 'email' ? (
        <form onSubmit={flow.request} noValidate>
          <AuthField label="البريد الإلكتروني" type="email" autoComplete="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value.trim())} placeholder="name@example.com" required autoFocus />
          <TurnstileBox />
          <AuthError message={flow.error} />
          <AuthSubmit loading={flow.loading} disabled={!flow.email || !flow.humanOk}>إرسال الرمز</AuthSubmit>
        </form>
      ) : (
        <form onSubmit={flow.confirm} noValidate>
          {flow.notice && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>{flow.notice}</div>
          )}
          <AuthField label="رمز الاستعادة" hint="4 أرقام، صالح لمدة 10 دقائق ولمرة واحدة." type="text" inputMode="numeric" autoComplete="one-time-code" value={flow.code} onChange={(e) => flow.setCode(e.target.value.replace(/[^0-9]/g, ''))} maxLength={4} required autoFocus />
          <AuthField label="كلمة المرور الجديدة" hint={PASSWORD_HINT} type="password" autoComplete="new-password" value={flow.password} onChange={(e) => flow.setPassword(e.target.value)} required />
          <AuthError message={flow.error} />
          <AuthSubmit loading={flow.loading} disabled={flow.code.length !== 4 || Boolean(passwordProblem(flow.password))}>حفظ كلمة المرور والدخول</AuthSubmit>
          <ResetRecovery flow={flow} />
        </form>
      )}
    </AuthLayout>
  );
}

// Note 09: the nonprofit reset looks like its sign-in and sign-up — the same
// card, grouped fields and «عنوان» colours over the same page.
function NonprofitReset() {
  const flow = useResetFlow();
  const navigate = useNavigate();
  const { surface, accentText, primaryButton } = authTheme(true);
  const button = (label: string, disabled: boolean) => (
    <button type="submit" disabled={flow.loading || disabled} className={`mt-5 flex min-h-[52px] w-full items-center justify-center rounded-2xl ${primaryButton} text-[17px] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none`} style={{ fontFamily: 'Cairo, sans-serif' }}>
      {flow.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
    </button>
  );
  return (
    <NonprofitAuthBackdrop>
      <section className={`relative w-full max-w-[400px] rounded-[28px] ${surface} px-5 pb-7 pt-6 shadow-2xl`} role="dialog" aria-modal="true" aria-labelledby="reset-title" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <button type="button" onClick={() => navigate(nonprofitPath('login'))} className={`absolute right-4 top-4 flex h-9 items-center gap-1 rounded-full px-2 text-[15px] ${accentText}`}>
          <ArrowRight className="h-4 w-4" />رجوع
        </button>
        <div className="mb-5 text-center">
          <h1 id="reset-title" className="text-[26px] font-black leading-tight text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>استعادة كلمة المرور</h1>
          <p className="mt-1 text-[15px] text-[#737373]">{flow.step === 'email' ? 'نرسل رمزًا مؤقتًا إلى بريدك المسجل' : 'أدخل الرمز الذي وصلك ثم كلمة المرور الجديدة'}</p>
        </div>
        {flow.step === 'email' ? (
          <form onSubmit={flow.request} noValidate>
            <div className="overflow-hidden rounded-2xl bg-white">
              <Row label="البريد الإلكتروني" last>
                <input type="email" autoComplete="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value.trim())} placeholder="name@example.com" autoFocus className={inputClass} dir="ltr" />
              </Row>
            </div>
            <div className="mt-3"><TurnstileBox /></div>
            {flow.error && <p role="alert" className="mt-3 px-1 text-[13px] text-[#DC2626]">{flow.error}</p>}
            {button('إرسال الرمز', !flow.email || !flow.humanOk)}
          </form>
        ) : (
          <form onSubmit={flow.confirm} noValidate>
            {flow.notice && <p className="mb-3 rounded-xl bg-[#FFF0E8] px-3 py-2.5 text-[13px] text-[#111111]">{flow.notice}</p>}
            <div className="overflow-hidden rounded-2xl bg-white">
              <Row label="رمز الاستعادة">
                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={flow.code} onChange={(e) => flow.setCode(e.target.value.replace(/[^0-9]/g, ''))} maxLength={4} placeholder="4 أرقام" autoFocus className={inputClass} dir="ltr" />
              </Row>
              <Row label="كلمة المرور" last>
                <PasswordInput autoComplete="new-password" value={flow.password} onChange={(e) => flow.setPassword(e.target.value)} placeholder="••••••••" aria-describedby="password-rules" className={inputClass} dir="ltr" />
              </Row>
            </div>
            <PasswordRules password={flow.password} />
            {flow.error && <p role="alert" className="mt-3 px-1 text-[13px] text-[#DC2626]">{flow.error}</p>}
            {button('حفظ كلمة المرور والدخول', flow.code.length !== 4 || Boolean(passwordProblem(flow.password)))}
            <ResetRecovery flow={flow} />
          </form>
        )}
      </section>
    </NonprofitAuthBackdrop>
  );
}

function ResetRecovery({ flow }: { flow: ReturnType<typeof useResetFlow> }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-center text-[#737373]">البريد المستخدم: <span dir="ltr">{flow.email}</span></p>
      <TurnstileBox />
      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={flow.loading} onClick={flow.changeEmail} className="font-bold underline disabled:opacity-50">تغيير البريد الإلكتروني</button>
        <button type="button" disabled={flow.loading || !flow.humanOk || flow.resendSeconds > 0} onClick={flow.request} className="font-bold underline disabled:opacity-50">{flow.resendSeconds > 0 ? `إعادة الإرسال بعد ${flow.resendSeconds} ثانية` : 'إعادة إرسال الرمز'}</button>
      </div>
    </div>
  );
}
