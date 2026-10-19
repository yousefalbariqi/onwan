import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BRAND_NAME, ROOT_DOMAIN } from '../lib/site';
import { useAuthSuccess } from '../lib/useAuthSuccess';
import { Button, ErrorNote, Field, PLAN_NAMES, inputClass, useAction } from '../admin/ui';
import { partnerCall } from './partnerApi';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-xl font-black text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// B2B-01: partnership application.
export function PartnerApply() {
  const [form, setForm] = useState({ shopName: '', contactName: '', email: '', phone: '', city: '', password: '' });
  const [done, setDone] = useState('');
  const action = useAction();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  if (done) {
    return (
      <Shell title="تم استلام طلبك">
        <p className="text-sm text-gray-700">{done}</p>
      </Shell>
    );
  }

  return (
    <Shell title={`كن شريك طباعة لـ${BRAND_NAME}`}>
      <p className="text-sm text-gray-600">
        سجّل عملاءك من الجمعيات والشركات في {BRAND_NAME} من محلّك، واحصل على ربح الاشتراك الأول وعمولة التجديد.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => setDone((await partnerCall('apply', form)).message));
        }}
      >
        <Field label="اسم المحل"><input value={form.shopName} onChange={set('shopName')} className={inputClass} /></Field>
        <Field label="اسم المسؤول"><input value={form.contactName} onChange={set('contactName')} className={inputClass} /></Field>
        <Field label="المدينة"><input value={form.city} onChange={set('city')} className={inputClass} /></Field>
        <Field label="رقم الجوال"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} dir="ltr" inputMode="numeric" /></Field>
        <Field label="البريد الإلكتروني"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} className={inputClass} dir="ltr" /></Field>
        <Field label="كلمة المرور (8 أحرف على الأقل)"><input type="password" value={form.password} onChange={set('password')} className={inputClass} dir="ltr" autoComplete="new-password" /></Field>
        <ErrorNote message={action.error} />
        <Button tone="primary" type="submit" className="w-full" disabled={action.busy || !form.shopName || !form.contactName || !form.email || form.phone.length < 8 || form.password.length < 8}>
          إرسال طلب الشراكة
        </Button>
      </form>
      <Link to="/partner" className="block text-center text-xs text-gray-500 hover:underline">
        لديك حساب شريك؟ سجّل الدخول
      </Link>
    </Shell>
  );
}

// The customer's side of the link a partner sends them.
export function PayOrder() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    partnerCall('order.view', { token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل الطلب.'));
  }, [token]);

  if (error) {
    return <Shell title="رابط الدفع"><ErrorNote message={error} /></Shell>;
  }

  if (!data) {
    return <Shell title="رابط الدفع"><p className="text-sm text-gray-500">جاري التحميل...</p></Shell>;
  }

  const { order } = data;

  return (
    <Shell title={`اشتراك ${order.customerName} في ${BRAND_NAME}`}>
      <dl className="divide-y divide-gray-100 text-sm">
        {[
          ['رقم الطلب', `#${order.orderNumber}`],
          ['سُجّل عبر', order.shopName],
          ['رابط الصفحة', <span dir="ltr">{order.username}.{ROOT_DOMAIN}</span>],
          ['الاشتراك', PLAN_NAMES[order.plan]],
          ['المبلغ', `${order.price} ريال`],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-semibold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      {order.status === 'completed' ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          تم تأكيد الدفع وصفحتك منشورة. وصلك على بريدك رابط إنشاء كلمة المرور.
        </p>
      ) : (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          الدفع الإلكتروني غير مفعّل بعد. أتمّ السداد مع المحل، وبعد تأكيده من إدارة {BRAND_NAME} تُنشر صفحتك ويصلك على بريدك رابط آمن
          لإنشاء كلمة مرورك. الحساب يكون ملكك وحدك.
        </p>
      )}
    </Shell>
  );
}

// B2B-05: first entry — the customer creates their own password.
export function Welcome() {
  const { token } = useParams();
  const [info, setInfo] = useState<{ email: string; username: string } | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  const onSuccess = useAuthSuccess();

  useEffect(() => {
    partnerCall('welcome.view', { token })
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : 'الرابط غير صالح.'));
  }, [token]);

  if (error) {
    return (
      <Shell title="إنشاء كلمة المرور">
        <ErrorNote message={error} />
        <Link to="/reset-password" className="block text-center text-sm font-semibold text-emerald-700 hover:underline">
          نسيت كلمة المرور
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={`مرحبًا بك في ${BRAND_NAME}`}>
      {info && (
        <>
          <p className="text-sm text-gray-700">
            صفحتك <span dir="ltr" className="font-semibold">{info.username}.{ROOT_DOMAIN}</span> جاهزة. هذا الحساب مستقل وملكك وحدك: المحل الذي
            سجّلك لا يملك كلمة مرورك ولا يستطيع الدخول أو التعديل.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => onSuccess(await partnerCall('welcome.setPassword', { token, password })));
            }}
          >
            <Field label="بريد الدخول">
              <input value={info.email} readOnly className={`${inputClass} bg-gray-50`} dir="ltr" />
            </Field>
            <Field label="كلمة المرور (8 أحرف على الأقل)">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} dir="ltr" autoComplete="new-password" autoFocus />
            </Field>
            <ErrorNote message={action.error} />
            <Button tone="primary" type="submit" className="w-full" disabled={action.busy || password.length < 8}>
              حفظ كلمة المرور والدخول
            </Button>
          </form>
        </>
      )}
    </Shell>
  );
}
