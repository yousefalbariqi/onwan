import { useState } from 'react';
import { Link } from 'react-router';
import { LogIn } from 'lucide-react';
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthLayout';
import { login } from '../lib/api';
import { useAuthSuccess } from '../lib/useAuthSuccess';

// NEW-03: email login for anyone who already has an account.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onSuccess = useAuthSuccess();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setError('');
      setLoading(true);
      onSuccess(await login(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول الآن.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={LogIn} title="تسجيل الدخول" subtitle="ادخل بالبريد الإلكتروني وكلمة المرور.">
      <form onSubmit={handleSubmit} noValidate>
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
        <AuthField
          label="كلمة المرور"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <AuthError message={error} />
        <AuthSubmit loading={loading} disabled={!email || !password}>
          دخول
        </AuthSubmit>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <Link to="/reset-password" className="font-bold text-emerald-600 hover:underline">
          نسيت كلمة المرور؟
        </Link>
        <Link to="/" className="text-gray-600 hover:underline">
          إنشاء حساب جديد
        </Link>
      </div>
    </AuthLayout>
  );
}
