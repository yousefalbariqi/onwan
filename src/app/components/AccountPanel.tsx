import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, MailCheck, MessageCircle, RotateCcw, Send } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { RequestType, sendEmailCode, sendSupportRequest, verifyEmailCode } from '../lib/api';
import { SUPPORT_WHATSAPP, pageHost } from '../lib/site';

const REQUEST_OPTIONS: { id: RequestType; label: string; note?: string }[] = [
  { id: 'message', label: 'رسالة أو استفسار' },
  {
    id: 'change_subdomain',
    label: 'تغيير رابط الصفحة',
    note: 'خدمة مدفوعة وتحتاج موافقة الإدارة. بعد التغيير يُحوَّل الرابط القديم إلى الجديد 30 يومًا فقط ثم يتوقف، وأي رمز QR مطبوع بالرابط القديم سيتوقف معه.',
  },
  { id: 'pause_page', label: 'إيقاف الصفحة مؤقتًا' },
  { id: 'reactivate_page', label: 'إعادة تفعيل الصفحة' },
  { id: 'stop_renewal', label: 'إيقاف تجديد الاشتراك', note: 'تبقى صفحتك فعّالة حتى نهاية المدة المدفوعة.' },
  { id: 'more_storage', label: 'زيادة مساحة الملفات', note: 'زيادة المساحة مقابل رسوم تحددها الإدارة.' },
  { id: 'invoice', label: 'طلب فاتورة' },
  { id: 'delete_account', label: 'حذف الحساب', note: 'الحذف نهائي وتنفذه الإدارة بعد مراجعة الطلب.' },
];

const PLAN_NAMES = { monthly: 'شهري', annual: 'سنوي' };

const SUBSCRIPTION_STATUS = {
  pending_payment: 'بانتظار الدفع',
  active: 'فعّال',
  expired: 'منتهٍ',
};

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('ar-u-ca-gregory-nu-latn', { dateStyle: 'long' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <h4 className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export function AccountPanel() {
  const navigate = useNavigate();
  const { pageData, account, setAccount, resetDesign, logout, isDirty } = usePageContext();
  const [code, setCode] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('message');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestNotice, setRequestNotice] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  if (!account) {
    return null;
  }

  const subscription = account.subscription;
  const selectedRequest = REQUEST_OPTIONS.find((option) => option.id === requestType);

  const runEmailAction = async (action: () => Promise<string>) => {
    try {
      setEmailBusy(true);
      setEmailNotice(await action());
    } catch (err) {
      setEmailNotice(err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.');
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSendRequest = async () => {
    try {
      setRequestBusy(true);
      const response = await sendSupportRequest(requestType, requestMessage);
      setRequestNotice(response.message);
      setRequestMessage('');
    } catch (err) {
      setRequestNotice(err instanceof Error ? err.message : 'تعذر إرسال الطلب.');
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Section title="الصفحة">
        <Row label="الرابط" value={<span dir="ltr">{pageHost(pageData.username)}</span>} />
        <Row
          label="الحالة"
          value={
            account.pageStatus === 'published'
              ? 'منشورة'
              : account.pageStatus === 'suspended'
                ? 'موقوفة'
                : 'غير منشورة'
          }
        />
        {account.pageStatus === 'draft' && (
          <button
            onClick={() => navigate('/plan-selection')}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            اشترك لنشر الصفحة
          </button>
        )}
        {account.pageStatus === 'suspended' && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {account.suspensionMessage || 'الصفحة موقوفة من الإدارة.'} لإعادة التفعيل أرسل طلبًا من الأسفل.
          </p>
        )}
      </Section>

      <Section title="الاشتراك">
        {subscription ? (
          <>
            <Row label="النوع" value={PLAN_NAMES[subscription.plan]} />
            <Row label="الحالة" value={SUBSCRIPTION_STATUS[subscription.status]} />
            <Row label="تاريخ الانتهاء" value={formatDate(subscription.expiresAt)} />
          </>
        ) : (
          <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            لا يوجد اشتراك بعد.
          </p>
        )}
      </Section>

      <Section title="الحساب">
        <Row label="البريد" value={<span dir="ltr">{account.email || '—'}</span>} />
        <Row label="الجوال" value={<span dir="ltr">{account.phone}</span>} />
        {account.emailVerified ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <MailCheck className="h-4 w-4" />
            البريد مؤكد
          </div>
        ) : (
          <div className="space-y-2 rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              بريدك غير مؤكد. أدخل الرمز الذي وصلك أو اطلب رمزًا جديدًا.
            </p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                inputMode="numeric"
                placeholder="الرمز"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm focus:outline-none focus:border-emerald-500"
                dir="ltr"
              />
              <button
                disabled={emailBusy || code.length !== 6}
                onClick={() =>
                  runEmailAction(async () => {
                    const response = await verifyEmailCode(code);
                    setAccount(response.account);
                    return 'تم تأكيد البريد.';
                  })
                }
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                تأكيد
              </button>
              <button
                disabled={emailBusy}
                onClick={() => runEmailAction(async () => (await sendEmailCode()).message)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
              >
                إرسال رمز
              </button>
            </div>
            {emailNotice && (
              <p className="text-xs text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{emailNotice}</p>
            )}
          </div>
        )}
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          لتعديل البريد أو الجوال أرسل طلبًا للإدارة. لتغيير كلمة المرور استخدم «نسيت كلمة المرور» في صفحة الدخول.
        </p>
      </Section>

      <Section title="التواصل مع إدارة عنوان">
        <select
          value={requestType}
          onChange={(e) => {
            setRequestType(e.target.value as RequestType);
            setRequestNotice('');
          }}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {REQUEST_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedRequest?.note && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {selectedRequest.note}
          </p>
        )}
        <textarea
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={requestType === 'change_subdomain' ? 'اكتب الاسم الجديد المطلوب...' : 'اكتب تفاصيل طلبك...'}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-right focus:outline-none focus:border-emerald-500"
          style={{ fontFamily: 'Tajawal, sans-serif' }}
        />
        <button
          onClick={handleSendRequest}
          disabled={requestBusy || requestMessage.trim().length < 3}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2 text-sm font-bold text-white disabled:opacity-50"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Send className="h-4 w-4" />
          إرسال
        </button>
        {requestNotice && (
          <p className="text-xs text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{requestNotice}</p>
        )}
        {!!SUPPORT_WHATSAPP && (
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <MessageCircle className="h-4 w-4" />
            واتساب الإدارة
          </a>
        )}
      </Section>

      <Section title="التصميم">
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          يعيد الثيم والخلفية والأزرار والخط إلى الشكل الافتراضي. لا يحذف الاسم أو الوصف أو الشعار أو الأزرار والملفات.
        </p>
        <button
          onClick={() => {
            if (window.confirm('استعادة التصميم الافتراضي؟ المحتوى لن يتأثر، ولن يُنشر التغيير إلا بعد «حفظ».')) {
              resetDesign();
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <RotateCcw className="h-4 w-4" />
          استعادة التصميم الافتراضي
        </button>
      </Section>

      <button
        onClick={() => {
          if (isDirty && !window.confirm('لديك تعديلات غير محفوظة ستُفقد. تسجيل الخروج؟')) return;
          logout();
          navigate('/');
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        <LogOut className="h-4 w-4" />
        تسجيل الخروج
      </button>
    </div>
  );
}
