import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { BRAND_NAME } from '../lib/site';
import { StaffMember, adminCall, getStaffToken, setStaffToken } from './adminApi';
import { CustomerDetail } from './CustomerDetail';
import { Customers } from './Customers';
import { Reports, Requests, Reviews } from './Queues';
import { AuditLog, Prices, StaffAdmin } from './Settings';
import { Button, ErrorNote, Field, inputClass } from './ui';

type Section = 'customers' | 'reviews' | 'requests' | 'reports' | 'prices' | 'staff' | 'audit';

const SECTIONS: { id: Section; label: string; managerOnly?: boolean }[] = [
  { id: 'customers', label: 'العملاء' },
  { id: 'reviews', label: 'مراجعة المحتوى' },
  { id: 'requests', label: 'الطلبات' },
  { id: 'reports', label: 'البلاغات' },
  { id: 'prices', label: 'الأسعار' },
  { id: 'staff', label: 'الموظفون', managerOnly: true },
  { id: 'audit', label: 'سجل العمليات', managerOnly: true },
];

function StaffLogin({ onLogin }: { onLogin: (staff: StaffMember) => void }) {
  // The setup form is for the very first manager only (needs ADMIN_SETUP_TOKEN).
  const [setup, setSetup] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', setupToken: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setBusy(true);
      setError('');
      const response = await adminCall<{ token: string; staff: StaffMember }>(setup ? 'bootstrap' : 'login', form);
      setStaffToken(response.token);
      onLogin(response.staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الدخول.');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-xl font-black text-gray-900">
          إدارة {BRAND_NAME} {setup && '— إعداد حساب المدير'}
        </h1>
        {setup && (
          <>
            <Field label="رمز الإعداد (ADMIN_SETUP_TOKEN)">
              <input value={form.setupToken} onChange={set('setupToken')} className={inputClass} dir="ltr" />
            </Field>
            <Field label="اسم المدير">
              <input value={form.name} onChange={set('name')} className={inputClass} />
            </Field>
          </>
        )}
        <Field label="البريد الإلكتروني">
          <input type="email" value={form.email} onChange={set('email')} className={inputClass} dir="ltr" autoComplete="username" />
        </Field>
        <Field label="كلمة المرور">
          <input type="password" value={form.password} onChange={set('password')} className={inputClass} dir="ltr" autoComplete={setup ? 'new-password' : 'current-password'} />
        </Field>
        <ErrorNote message={error} />
        <Button tone="primary" type="submit" disabled={busy || !form.email || !form.password} className="w-full">
          {setup ? 'إنشاء حساب المدير' : 'دخول'}
        </Button>
        <button type="button" onClick={() => setSetup(!setup)} className="block w-full text-center text-xs text-gray-500 hover:underline">
          {setup ? 'لدي حساب' : 'إعداد أول مرة'}
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [checking, setChecking] = useState(Boolean(getStaffToken()));
  const [section, setSection] = useState<Section>('customers');
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!getStaffToken()) return;

    adminCall<{ staff: StaffMember }>('me')
      .then((response) => setStaff(response.staff))
      .catch(() => setStaffToken(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    document.title = `إدارة ${BRAND_NAME}`;
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-gray-100" />;
  }

  if (!staff) {
    return (
      <div dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <StaffLogin onLogin={setStaff} />
      </div>
    );
  }

  const isManager = staff.role === 'manager';
  const openCustomer = (userId: string) => {
    setSection('customers');
    setCustomerId(userId);
  };

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="text-lg font-black text-gray-900">إدارة {BRAND_NAME}</div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {staff.name} · {isManager ? 'مدير' : 'موظف'}
            </span>
            <button
              onClick={() => {
                setStaffToken(null);
                setStaff(null);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {SECTIONS.filter((item) => !item.managerOnly || isManager).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSection(item.id);
                setCustomerId(null);
              }}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                section === item.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {section === 'customers' &&
          (customerId ? (
            <CustomerDetail key={customerId} userId={customerId} staff={staff} onBack={() => setCustomerId(null)} />
          ) : (
            <Customers onOpen={setCustomerId} />
          ))}
        {section === 'reviews' && <Reviews onOpen={openCustomer} />}
        {section === 'requests' && <Requests onOpen={openCustomer} />}
        {section === 'reports' && <Reports onOpen={openCustomer} />}
        {section === 'prices' && <Prices isManager={isManager} />}
        {section === 'staff' && isManager && <StaffAdmin me={staff} />}
        {section === 'audit' && isManager && <AuditLog />}
      </main>
    </div>
  );
}
