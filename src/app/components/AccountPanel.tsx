import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, CalendarDays, ContactRound, LogOut, MailCheck, MessageCircle, RotateCcw, Send, Smartphone, WalletCards } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { RequestType, accountCall, sendEmailCode, sendSupportRequest, verifyEmailCode } from '../lib/api';
import { ROOT_DOMAIN, SUPPORT_WHATSAPP, USERNAME_PATTERN, pageHost } from '../lib/site';
import { downloadVCard } from '../lib/vcard';
import { AccountSecurity, AccountServices } from './AccountServices';

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

function remainingDays(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // iOS Settings style: grey caption above a white rounded card.
    <section>
      <h4 className="mb-1.5 px-4 text-[13px] font-bold text-[#6e6e73]" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {title}
      </h4>
      <div className="space-y-3 rounded-2xl bg-white p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="-mx-4 flex min-h-[40px] items-center justify-between gap-3 border-b border-[#e5e5ea] px-4 pb-3 text-[15px] last:border-0" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <span className="text-[#1d1d1f]">{label}</span>
      <span className="text-[#8e8e93]">{value}</span>
    </div>
  );
}

export function AccountPanel() {
  const navigate = useNavigate();
  const { pageData, account, setAccount, updatePageData, resetDesign, logout, isDirty } = usePageContext();
  const [newName, setNewName] = useState('');
  const [nameNotice, setNameNotice] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [code, setCode] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('message');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestNotice, setRequestNotice] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [walletNotice, setWalletNotice] = useState('');

  if (!account) {
    return null;
  }

  const subscription = account.subscription;
  const daysLeft = subscription ? remainingDays(subscription.expiresAt) : null;
  const hasRenewalInvoice = Boolean(subscription?.renewalInvoice);
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
    <div className="space-y-6 bg-[#f2f2f7] px-4 py-5">
      <Section title="الصفحة">
        <Row label="الرابط" value={<span dir="ltr">{pageData.username ? pageHost(pageData.username) : '—'}</span>} />
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
        {!account.nameFixed && (
          <div className="space-y-2 rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {pageData.username
                ? `الاسم محجوز لك مؤقتًا${account.nameHoldExpiresAt ? ` حتى ${formatDate(account.nameHoldExpiresAt)}` : ''} ويُثبَّت بعد الدفع. يمكنك تغييره الآن.`
                : 'انتهى حجز اسمك وأخذه مستخدم آخر. اختر اسمًا جديدًا لتكمل التسجيل.'}
            </p>
            <div className="flex items-center gap-2" dir="ltr">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="new-name"
                maxLength={30}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-gray-500">.{ROOT_DOMAIN}</span>
              <button
                disabled={nameBusy || !USERNAME_PATTERN.test(newName)}
                onClick={async () => {
                  try {
                    setNameBusy(true);
                    const response = await accountCall('name.change', { username: newName });
                    setAccount(response.account);
                    // The address is not part of the editable draft.
                    if (!isDirty) updatePageData({ username: response.username });
                    setNameNotice(isDirty ? 'تم تغيير الاسم. احفظ تعديلاتك ثم حدّث الصفحة ليظهر الاسم الجديد.' : 'تم تغيير الاسم وحجز الجديد.');
                    setNewName('');
                  } catch (err) {
                    setNameNotice(err instanceof Error ? err.message : 'تعذر تغيير الاسم.');
                  } finally {
                    setNameBusy(false);
                  }
                }}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                تغيير
              </button>
            </div>
            {nameNotice && <p className="text-xs text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{nameNotice}</p>}
          </div>
        )}
        {account.pageStatus === 'draft' && (
          <button
            onClick={() => navigate('/plan-selection')}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            سلة التسجيل والنشر
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
            <Row label="تاريخ بداية الاشتراك" value={formatDate(subscription.startsAt)} />
            <Row label="تاريخ الانتهاء" value={formatDate(subscription.expiresAt)} />
            {hasRenewalInvoice ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="text-sm font-bold">فاتورة تجديد بانتظار السداد</p>
                    <p className="mt-1 text-xs leading-5">
                      فاتورة #{subscription.renewalInvoice?.number} بقيمة {subscription.renewalInvoice?.amount} ريال. لا يتم تمديد الاشتراك إلا بعد تأكيد الدفع.
                    </p>
                  </div>
                </div>
              </div>
            ) : subscription.status === 'expired' || (daysLeft !== null && daysLeft <= 0) ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                  <div><p className="text-sm font-bold">انتهت مدة الاشتراك</p><p className="mt-1 text-xs leading-5">جدّد الآن حتى تبقى صفحتك وخدماتها فعّالة.</p></div>
                </div>
              </div>
            ) : daysLeft !== null && daysLeft <= 90 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-5 w-5 flex-none" />
                  <div><p className="text-sm font-bold">متبقي {daysLeft} {daysLeft === 1 ? 'يوم' : 'يومًا'} على الاشتراك</p><p className="mt-1 text-xs leading-5">يمكنك التجديد مبكرًا لضمان استمرار صفحتك.</p></div>
                </div>
              </div>
            ) : null}
            <button
              onClick={() => navigate('/renewal')}
              className={`w-full rounded-lg py-2 text-sm font-bold text-white ${hasRenewalInvoice || subscription.status === 'expired' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'}`}
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {hasRenewalInvoice ? 'عرض فاتورة التجديد' : 'تجديد الاشتراك'}
            </button>
            <p className="text-center text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>التجديد التلقائي يتاح بعد ربط بوابة الدفع وحفظ موافقتك عليه.</p>
          </>
        ) : (
          <p className="text-sm text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            لا يوجد اشتراك بعد.
          </p>
        )}
      </Section>

      <Section title="بطاقتك الرقمية">
        <p className="text-xs leading-5 text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          احتفظ ببيانات جهتك على جوالك، وشاركها بسهولة مع العملاء والزوار.
        </p>

        <button
          onClick={() => downloadVCard(pageData)}
          className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-right transition hover:bg-emerald-100"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <ContactRound className="h-5 w-5" />
            حفظ جهة الاتصال VCF
          </span>
          <span className="text-[11px] font-semibold text-emerald-700">iPhone وAndroid</span>
        </button>
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          ينزّل بطاقة جهة اتصال باسم الجهة مع الشعار والجوال والبريد والرابط، متى كانت هذه البيانات مضافة في صفحتك.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setWalletNotice('معاينة Apple Wallet جاهزة. لإضافة البطاقة فعليًا نحتاج إعداد شهادة Apple لتوقيع ملف البطاقة عند الإطلاق.')}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-gray-950 px-2 text-center text-white transition hover:bg-gray-800"
          >
            <WalletCards className="h-5 w-5" />
            <span className="text-xs font-bold">Apple Wallet</span>
            <span className="text-[10px] text-gray-400">إضافة البطاقة</span>
          </button>
          <button
            onClick={() => setWalletNotice('معاينة Google Wallet جاهزة. الإضافة الفعلية تتطلب ربط حساب Google Wallet Issuer لخدمة عنوان.')}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-center text-gray-900 transition hover:bg-gray-50"
          >
            <Smartphone className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-bold">Google Wallet</span>
            <span className="text-[10px] text-gray-500">إضافة البطاقة</span>
          </button>
        </div>
        {account.pageStatus !== 'published' && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            ستتفعّل بطاقة Wallet بعد نشر الصفحة؛ أما ملف VCF فيمكنك تنزيله الآن.
          </p>
        )}
        {walletNotice && <p className="rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{walletNotice}</p>}
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
                maxLength={4}
                inputMode="numeric"
                placeholder="الرمز"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm focus:outline-none focus:border-emerald-500"
                dir="ltr"
              />
              <button
                disabled={emailBusy || code.length !== 4}
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
      </Section>

      <AccountSecurity onAccount={setAccount} />

      <AccountServices nameFixed={account.nameFixed} />

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
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] text-[#ff3b30]"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        <LogOut className="h-4 w-4" />
        تسجيل الخروج
      </button>
    </div>
  );
}
