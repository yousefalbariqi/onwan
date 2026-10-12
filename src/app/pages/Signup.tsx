import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { UserPlus } from 'lucide-react';
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthLayout';
import { signup } from '../lib/api';
import { USERNAME_PATTERN, pageHost } from '../lib/site';
import { useAuthSuccess } from '../lib/useAuthSuccess';

const MIN_PASSWORD_LENGTH = 8;

// NEW-01/NEW-02, ACCT-01: the name was chosen on the landing page; here the
// beneficiary enters the mobile number, then the email, then a password.
export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = (searchParams.get('username') || '').toLowerCase();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onSuccess = useAuthSuccess();

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) {
      navigate('/', { replace: true });
    }
  }, [navigate, username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (phone.length < 8) {
      setError('يرجى إدخال رقم جوال صحيح.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف.`);
      return;
    }

    try {
      setError('');
      setLoading(true);
      onSuccess(await signup({ username, phone, email, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب الآن.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={UserPlus} title="إنشاء حساب الجهة" subtitle="أنشئ الحساب وجهّز صفحتك الآن؛ تُنشر للجمهور بعد إتمام الاشتراك.">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="text-sm text-emerald-600 mb-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          رابط صفحتك
        </div>
        <div className="text-xl font-bold text-emerald-900 text-right" style={{ fontFamily: 'Cairo, sans-serif' }} dir="ltr">
          {pageHost(username)}
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          label="رقم الجوال"
          hint="للتواصل معك ولإدارة الاشتراك. مثال: 0512345678"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="05XXXXXXXX"
          maxLength={20}
          required
          autoFocus
        />
        <AuthField
          label="البريد الإلكتروني"
          hint="تسجّل به الدخول، ويصلك عليه رمز التأكيد."
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          placeholder="name@example.org"
          required
        />
        <AuthField
          label="كلمة المرور"
          hint={`${MIN_PASSWORD_LENGTH} أحرف على الأقل.`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <AuthError message={error} />
        <AuthSubmit loading={loading} disabled={!phone || !email || !password}>
          إنشاء الحساب
        </AuthSubmit>
      </form>

      <p className="text-sm text-center mt-6 text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        لديك حساب؟{' '}
        <Link to="/login" className="font-bold text-emerald-600 hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </AuthLayout>
  );
}
