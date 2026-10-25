import { useState } from 'react';
import { TurnstileBox, useHumanOk } from '../lib/turnstile';
import { KeyRound } from 'lucide-react';
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthLayout';
import { confirmPasswordReset, requestPasswordReset } from '../lib/api';
import { useAuthSuccess } from '../lib/useAuthSuccess';

// ACCT-06: a one-time code to the registered email, then a new password.
export default function ResetPassword() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const humanOk = useHumanOk();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const onSuccess = useAuthSuccess();

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setError('');
      setLoading(true);
      const response = await requestPasswordReset(email);
      setNotice(response.message);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرمز الآن.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();

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

  return (
    <AuthLayout
      icon={KeyRound}
      title="استعادة كلمة المرور"
      subtitle={step === 'email' ? 'نرسل رمزًا مؤقتًا إلى بريدك المسجل.' : 'أدخل الرمز الذي وصلك ثم كلمة المرور الجديدة.'}
      backTo="/login"
    >
      {step === 'email' ? (
        <form onSubmit={handleRequest} noValidate>
          <AuthField
            label="البريد الإلكتروني"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="name@example.org"
            required
            autoFocus
          />
          <TurnstileBox />
          <AuthError message={error} />
          <AuthSubmit loading={loading} disabled={!email || !humanOk}>
            إرسال الرمز
          </AuthSubmit>
        </form>
      ) : (
        <form onSubmit={handleConfirm} noValidate>
          {notice && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {notice}
            </div>
          )}
          <AuthField
            label="رمز الاستعادة"
            hint="4 أرقام، صالح لمدة 10 دقائق ولمرة واحدة."
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={4}
            required
            autoFocus
          />
          <AuthField
            label="كلمة المرور الجديدة"
            hint="8 أحرف على الأقل."
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <AuthError message={error} />
          <AuthSubmit loading={loading} disabled={code.length !== 4 || password.length < 8}>
            حفظ كلمة المرور والدخول
          </AuthSubmit>
        </form>
      )}
    </AuthLayout>
  );
}
