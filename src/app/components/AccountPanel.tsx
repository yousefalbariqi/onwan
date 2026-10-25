import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ContactRound,
  CreditCard,
  Globe,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  MessageCircle,
  Nfc,
  Palette,
  Smartphone,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { RequestType, accountCall, resendWait, sendEmailCode, sendSupportRequest, verifyEmailCode } from '../lib/api';
import { ROOT_DOMAIN, SUPPORT_WHATSAPP, USERNAME_PATTERN, pageHost } from '../lib/site';
import { downloadVCard } from '../lib/vcard';
import { AccountSecurity, CHANGE_LABELS, DOMAIN_STATUS, DesignServicePage, DomainPage, NfcPage, VisitsPage, useOverview, type Change } from './AccountServices';
import { ConfirmSheet, Group, Notice, PrimaryButton, SettingsRow } from './ios';

// «الإعدادات», laid out like iOS Settings: a summary card, then short grouped
// rows; each row opens a page of its own with one main button. Nothing is
// asked twice, and a confirmation appears only where something can be lost.

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
const SUBSCRIPTION_STATUS = { pending_payment: 'بانتظار الدفع', active: 'فعّال', expired: 'منتهٍ' };
const PAGE_STATUS = { published: 'منشورة', suspended: 'موقوفة', draft: 'غير منشورة' } as const;

type Page = 'root' | 'page' | 'subscription' | 'card' | 'account' | 'visits' | 'design' | 'domain' | 'nfc' | 'support' | `change-${Change}`;

const TITLES: Record<string, string> = {
  page: 'الصفحة', subscription: 'الاشتراك', card: 'بطاقتك الرقمية', account: 'الحساب', visits: 'زيارات الصفحة',
  design: 'خدمة «صمّم لي»', domain: 'دومين خاص', nfc: 'قطع NFC', support: 'التواصل مع الإدارة',
  'change-password': 'كلمة المرور', 'change-phone': 'رقم الجوال', 'change-email': 'البريد الإلكتروني',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-u-ca-gregory-nu-latn', { dateStyle: 'long' });
}

function remainingDays(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 text-[15px]">
      <span className="shrink-0 text-[#1d1d1f]">{label}</span>
      <span className="min-w-0 truncate text-[#8e8e93]">{value}</span>
    </div>
  );
}

export function AccountPanel() {
  const navigate = useNavigate();
  const { pageData, account, setAccount, updatePageData, resetDesign, logout, isDirty } = usePageContext();
  const { overview, reload } = useOverview();
  const [page, setPage] = useState<Page>('root');
  const [confirm, setConfirm] = useState<null | 'reset' | 'logout'>(null);
  const [toast, setToast] = useState('');
  const [newName, setNewName] = useState('');
  const [nameNotice, setNameNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [code, setCode] = useState('');
  const [emailNotice, setEmailNotice] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('message');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestNotice, setRequestNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [walletNotice, setWalletNotice] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);

  // Each page opens at its top (not on first opening the panel).
  useEffect(() => {
    if (firstPage.current) { firstPage.current = false; return; }
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [page]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!account) return null;

  const subscription = account.subscription;
  const daysLeft = subscription ? remainingDays(subscription.expiresAt) : null;
  const hasRenewalInvoice = Boolean(subscription?.renewalInvoice);
  const expired = Boolean(subscription && (subscription.status === 'expired' || (daysLeft !== null && daysLeft <= 0)));
  const renewalSoon = !hasRenewalInvoice && !expired && daysLeft !== null && daysLeft <= 90;
  const selectedRequest = REQUEST_OPTIONS.find((option) => option.id === requestType);
  const go = (next: Page) => setPage(next);

  const runEmailAction = async (action: () => Promise<{ tone: 'good' | 'info'; text: string }>) => {
    try {
      setEmailBusy(true);
      setEmailNotice(await action());
    } catch (err) {
      setEmailNotice({ tone: resendWait(err) ? 'info' : 'bad', text: err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.' });
    } finally {
      setEmailBusy(false);
    }
  };

  const changeName = async () => {
    try {
      setNameBusy(true);
      const response = await accountCall('name.change', { username: newName });
      setAccount(response.account);
      // The address is not part of the editable draft.
      if (!isDirty) updatePageData({ username: response.username });
      setNameNotice({ tone: 'good', text: isDirty ? 'تم تغيير الاسم. احفظ تعديلاتك ثم حدّث الصفحة ليظهر الاسم الجديد.' : 'تم تغيير الاسم وحجز الجديد.' });
      setNewName('');
    } catch (err) {
      setNameNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'تعذر تغيير الاسم.' });
    } finally {
      setNameBusy(false);
    }
  };

  const sendRequest = async () => {
    try {
      setRequestBusy(true);
      const response = await sendSupportRequest(requestType, requestMessage);
      setRequestNotice({ tone: 'good', text: response.message });
      setRequestMessage('');
    } catch (err) {
      setRequestNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'تعذر إرسال الطلب.' });
    } finally {
      setRequestBusy(false);
    }
  };

  const doLogout = () => {
    logout();
    navigate('/');
  };

  // ——— the pages ———
  const renderPage = () => {
    switch (page) {
      case 'page':
        return (
          <>
            <Group title="الرابط">
              <InfoRow label="الرابط" value={<span dir="ltr">{pageData.username ? pageHost(pageData.username) : '—'}</span>} />
              <InfoRow label="الحالة" value={PAGE_STATUS[account.pageStatus]} />
            </Group>
            {account.pageStatus === 'suspended' && <Notice tone="warn">{account.suspensionMessage || 'الصفحة موقوفة من الإدارة.'} لإعادة التفعيل أرسل طلبًا من «التواصل مع الإدارة».</Notice>}
            {!account.nameFixed && (
              <>
                <Group title="تغيير الاسم" footer={pageData.username
                  ? `الاسم محجوز لك مؤقتًا${account.nameHoldExpiresAt ? ` حتى ${formatDate(account.nameHoldExpiresAt)}` : ''}، ويُثبَّت بعد الدفع.`
                  : 'انتهى حجز اسمك وأخذه مستخدم آخر. اختر اسمًا جديدًا لتكمل التسجيل.'}>
                  <label className="flex min-h-[48px] items-center gap-1 px-4" dir="ltr">
                    <input value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, ''))} placeholder="new-name" maxLength={30} aria-label="الاسم الجديد" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
                    <span className="shrink-0 text-[15px] text-[#8e8e93]">.{ROOT_DOMAIN}</span>
                  </label>
                </Group>
                <PrimaryButton busy={nameBusy} disabled={!USERNAME_PATTERN.test(newName)} onClick={changeName}>تغيير الاسم</PrimaryButton>
                {nameNotice && <Notice tone={nameNotice.tone}>{nameNotice.text}</Notice>}
              </>
            )}
            {account.pageStatus === 'draft' && account.nameFixed && <PrimaryButton tone="green" onClick={() => navigate('/plan-selection')}>انشر صفحتك</PrimaryButton>}
          </>
        );

      case 'subscription':
        return subscription ? (
          <>
            {hasRenewalInvoice && <Notice tone="bad">فاتورة تجديد #{subscription.renewalInvoice?.number} بقيمة {subscription.renewalInvoice?.amount} ريال بانتظار السداد. لا يُمدَّد الاشتراك إلا بعد تأكيد الدفع.</Notice>}
            {!hasRenewalInvoice && expired && <Notice tone="bad">انتهت مدة الاشتراك. جدّد الآن حتى تبقى صفحتك وخدماتها فعّالة.</Notice>}
            {renewalSoon && <Notice tone="warn">متبقي {daysLeft} {daysLeft === 1 ? 'يوم' : 'يومًا'}. يمكنك التجديد مبكرًا لضمان استمرار صفحتك.</Notice>}
            <Group title="تفاصيل الاشتراك">
              <InfoRow label="النوع" value={PLAN_NAMES[subscription.plan]} />
              <InfoRow label="الحالة" value={SUBSCRIPTION_STATUS[subscription.status]} />
              <InfoRow label="البداية" value={formatDate(subscription.startsAt)} />
              <InfoRow label="الانتهاء" value={formatDate(subscription.expiresAt)} />
            </Group>
            <PrimaryButton tone={hasRenewalInvoice || expired ? 'red' : 'blue'} onClick={() => navigate('/renewal')}>{hasRenewalInvoice ? 'عرض فاتورة التجديد' : 'تجديد الاشتراك'}</PrimaryButton>
            <p className="px-4 text-center text-xs text-[#8e8e93]">التجديد التلقائي يتاح بعد ربط بوابة الدفع وحفظ موافقتك عليه.</p>
          </>
        ) : (
          <>
            <Notice>لا يوجد اشتراك بعد.</Notice>
            {account.pageStatus === 'draft' && <PrimaryButton tone="green" onClick={() => navigate('/plan-selection')}>انشر صفحتك</PrimaryButton>}
          </>
        );

      case 'card':
        return (
          <>
            <p className="px-4 text-[13px] leading-6 text-[#6e6e73]">احتفظ ببيانات جهتك على جوالك، وشاركها بسهولة مع العملاء والزوار.</p>
            <PrimaryButton onClick={() => downloadVCard(pageData)}><ContactRound className="h-5 w-5" />حفظ جهة الاتصال</PrimaryButton>
            <p className="-mt-3 px-4 text-xs leading-5 text-[#8e8e93]">ملف VCF يعمل على iPhone وAndroid، فيه الاسم والشعار والجوال والبريد والرابط.</p>
            <Group title="المحفظة" footer={account.pageStatus !== 'published' ? 'تتفعّل بطاقة المحفظة بعد نشر الصفحة.' : undefined}>
              <SettingsRow icon={WalletCards} tone="bg-[#1d1d1f]" label="Apple Wallet" value="معاينة" onClick={() => setWalletNotice('معاينة Apple Wallet جاهزة. لإضافة البطاقة فعليًا نحتاج إعداد شهادة Apple لتوقيع ملف البطاقة عند الإطلاق.')} />
              <SettingsRow icon={Smartphone} tone="bg-[#0a84ff]" label="Google Wallet" value="معاينة" onClick={() => setWalletNotice('معاينة Google Wallet جاهزة. الإضافة الفعلية تتطلب ربط حساب Google Wallet Issuer لخدمة عنوان.')} />
            </Group>
            {walletNotice && <Notice>{walletNotice}</Notice>}
          </>
        );

      case 'account':
        return (
          <>
            {!account.emailVerified && (
              <>
                <Group title="تأكيد البريد" footer="أدخل الرمز الذي وصلك على بريدك.">
                  <div className="px-4" dir="ltr">
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} maxLength={4} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • •" aria-label="رمز التأكيد" className="w-full bg-transparent py-3 text-center text-2xl tracking-[0.6em] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
                  </div>
                </Group>
                <PrimaryButton busy={emailBusy} disabled={code.length !== 4} onClick={() => runEmailAction(async () => {
                  const response = await verifyEmailCode(code);
                  setAccount(response.account);
                  setToast('تم تأكيد البريد');
                  return { tone: 'good', text: 'تم تأكيد البريد.' };
                })}>تأكيد البريد</PrimaryButton>
                <button type="button" disabled={emailBusy} onClick={() => runEmailAction(async () => ({ tone: 'info', text: (await sendEmailCode()).message }))} className="block w-full text-center text-sm text-[#0a84ff] disabled:text-[#c7c7cc]">أرسل رمزًا جديدًا</button>
                {emailNotice && <Notice tone={emailNotice.tone}>{emailNotice.text}</Notice>}
              </>
            )}
            <Group title="بيانات الدخول" footer="أي تغيير يحتاج رمزًا نرسله إلى بريدك المسجل.">
              <SettingsRow icon={Mail} tone="bg-[#0a84ff]" label="البريد الإلكتروني" value={<span dir="ltr">{account.email || '—'}</span>} badge={account.emailVerified ? undefined : 'غير مؤكد'} onClick={() => go('change-email')} />
              <SettingsRow icon={Smartphone} tone="bg-[#34c759]" label="رقم الجوال" value={<span dir="ltr">{account.phone}</span>} onClick={() => go('change-phone')} />
              <SettingsRow icon={KeyRound} tone="bg-[#8e8e93]" label="كلمة المرور" value="••••••••" onClick={() => go('change-password')} />
            </Group>
          </>
        );

      case 'change-email':
      case 'change-phone':
      case 'change-password':
        return <AccountSecurity key={page} change={page.slice(7) as Change} onAccount={setAccount} onDone={(message) => { setToast(message || `تم حفظ ${CHANGE_LABELS[page.slice(7) as Change]}`); go('account'); }} />;

      case 'visits':
        return overview ? <VisitsPage overview={overview} /> : null;
      case 'design':
        return overview ? <DesignServicePage overview={overview} reload={reload} /> : null;
      case 'domain':
        return overview ? <DomainPage overview={overview} reload={reload} /> : null;
      case 'nfc':
        return overview ? <NfcPage overview={overview} reload={reload} nameFixed={account.nameFixed} /> : null;

      case 'support':
        return (
          <>
            <Group title="نوع الطلب">
              <label className="flex min-h-[48px] items-center px-4">
                <select value={requestType} onChange={(e) => { setRequestType(e.target.value as RequestType); setRequestNotice(null); }} aria-label="نوع الطلب" className="w-full bg-transparent py-3 text-[16px] text-[#1d1d1f] focus:outline-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {REQUEST_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </Group>
            {selectedRequest?.note && <Notice tone="warn">{selectedRequest.note}</Notice>}
            <Group title="التفاصيل">
              <div className="px-4 py-2">
                <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} rows={4} maxLength={4000} aria-label="تفاصيل الطلب" placeholder={requestType === 'change_subdomain' ? 'اكتب الاسم الجديد المطلوب…' : 'اكتب تفاصيل طلبك…'} className="w-full resize-none bg-transparent py-1 text-[16px] leading-7 text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
              </div>
            </Group>
            <PrimaryButton busy={requestBusy} disabled={requestMessage.trim().length < 3} onClick={sendRequest}>إرسال الطلب</PrimaryButton>
            {requestNotice && <Notice tone={requestNotice.tone}>{requestNotice.text}</Notice>}
            {!!SUPPORT_WHATSAPP && (
              <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 text-[15px] font-bold text-[#1f8a3b]">
                <MessageCircle className="h-4 w-4" />
                أو راسلنا على واتساب
              </a>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const statusTone = account.pageStatus === 'published' ? 'bg-[#34c759]/12 text-[#1f7a35]' : account.pageStatus === 'suspended' ? 'bg-[#ff9500]/12 text-[#9a5b00]' : 'bg-[#e5e5ea] text-[#3a3a3c]';
  const subscriptionValue = subscription ? `${PLAN_NAMES[subscription.plan]} · ${expired ? 'منتهٍ' : SUBSCRIPTION_STATUS[subscription.status]}` : 'لا يوجد';
  const backTarget: Page = page.startsWith('change-') ? 'account' : 'root';

  return (
    <div className="space-y-6 bg-[#f2f2f7] px-4 py-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div ref={topRef} className="-mt-5 h-0" aria-hidden="true" />

      {page === 'root' ? (
        <>
          {/* Summary card, like the Apple ID card at the top of Settings. */}
          <section className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5ea] text-[#8e8e93]">
                {pageData.profileImage ? <img src={pageData.profileImage} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{pageData.name || 'صفحتك'}</span>
                <span className="block truncate text-[13px] text-[#8e8e93]" dir="ltr" style={{ textAlign: 'right' }}>{pageData.username ? pageHost(pageData.username) : '—'}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone}`}>{PAGE_STATUS[account.pageStatus]}</span>
            </div>
            {account.pageStatus === 'draft' && (
              <div className="mt-4">
                <PrimaryButton tone="green" onClick={() => navigate('/plan-selection')}>انشر صفحتك</PrimaryButton>
              </div>
            )}
          </section>

          {/* Only what needs attention, one line each. */}
          {(hasRenewalInvoice || expired || renewalSoon || account.pageStatus === 'suspended' || !account.emailVerified || !account.nameFixed) && (
            <Group title="يحتاج انتباهك">
              {(hasRenewalInvoice || expired) && <SettingsRow icon={AlertTriangle} tone="bg-[#ff3b30]" label={hasRenewalInvoice ? 'فاتورة تجديد بانتظار السداد' : 'انتهى الاشتراك'} onClick={() => go('subscription')} />}
              {renewalSoon && <SettingsRow icon={CalendarDays} tone="bg-[#ff9500]" label={`متبقي ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'يومًا'} على الاشتراك`} onClick={() => go('subscription')} />}
              {account.pageStatus === 'suspended' && <SettingsRow icon={AlertTriangle} tone="bg-[#ff9500]" label="الصفحة موقوفة من الإدارة" onClick={() => go('page')} />}
              {!account.emailVerified && <SettingsRow icon={Mail} tone="bg-[#ff9500]" label="أكّد بريدك الإلكتروني" onClick={() => go('account')} />}
              {!account.nameFixed && <SettingsRow icon={Link2} tone="bg-[#ff9500]" label={pageData.username ? 'اسم صفحتك محجوز مؤقتًا' : 'اختر اسمًا لصفحتك'} onClick={() => go('page')} />}
            </Group>
          )}

          <Group title="صفحتك">
            <SettingsRow icon={Link2} tone="bg-[#0a84ff]" label="الصفحة" value={PAGE_STATUS[account.pageStatus]} onClick={() => go('page')} />
            <SettingsRow icon={CreditCard} tone="bg-[#34c759]" label="الاشتراك" value={subscriptionValue} onClick={() => go('subscription')} />
            <SettingsRow icon={ContactRound} tone="bg-[#5856d6]" label="بطاقتك الرقمية" onClick={() => go('card')} />
            <SettingsRow icon={BarChart3} tone="bg-[#ff9500]" label="زيارات الصفحة" value={overview ? `${overview.stats.last30.toLocaleString('ar-u-nu-latn')} هذا الشهر` : undefined} onClick={() => go('visits')} />
          </Group>

          <Group title="الحساب">
            <SettingsRow icon={UserRound} tone="bg-[#8e8e93]" label="الحساب وتسجيل الدخول" value={<span dir="ltr">{account.email || account.phone}</span>} onClick={() => go('account')} />
          </Group>

          {overview && (
            <Group title="خدمات عنوان">
              <SettingsRow icon={Sparkles} tone="bg-[#af52de]" label="صمّم لي" value={overview.design.package?.state === 'in_progress' ? 'قيد التنفيذ' : overview.design.package?.state === 'pending_payment' ? 'بانتظار الدفع' : overview.design.package?.state === 'done' ? 'مكتملة' : undefined} onClick={() => go('design')} />
              {account.nameFixed && <SettingsRow icon={Globe} tone="bg-[#0a84ff]" label="دومين خاص" value={overview.domain.current ? DOMAIN_STATUS[overview.domain.current.status] ?? '' : undefined} onClick={() => go('domain')} />}
              <SettingsRow icon={Nfc} tone="bg-[#1d1d1f]" label="قطع NFC" value={overview.nfc.orders.length ? `${overview.nfc.orders.length} طلب` : undefined} onClick={() => go('nfc')} />
            </Group>
          )}

          <Group title="المساعدة">
            <SettingsRow icon={MessageCircle} tone="bg-[#34c759]" label="التواصل مع الإدارة" onClick={() => go('support')} />
          </Group>

          <Group title="التصميم" footer="يعيد الثيم والخلفية والأزرار والخط إلى الشكل الافتراضي، ولا يمس الاسم أو الوصف أو الشعار أو المحتوى.">
            <SettingsRow icon={Palette} tone="bg-[#ff2d55]" label="استعادة التصميم الافتراضي" onClick={() => setConfirm('reset')} />
          </Group>

          <button type="button" onClick={() => (isDirty ? setConfirm('logout') : doLogout())} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] text-[#ff3b30] active:bg-[#f2f2f7]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <button type="button" onClick={() => go(backTarget)} className="flex h-10 items-center gap-1 rounded-full pl-3 text-[15px] text-[#0a84ff]">
              <ChevronRight className="h-5 w-5" />
              {backTarget === 'account' ? 'الحساب' : 'الإعدادات'}
            </button>
            <h3 className="px-1 text-[26px] font-black leading-tight text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{TITLES[page]}</h3>
          </div>
          {renderPage()}
        </>
      )}

      {confirm === 'reset' && (
        <ConfirmSheet
          tone="default"
          title="استعادة التصميم الافتراضي؟"
          message="يتغير الشكل في المعاينة فقط، ولا يصل لصفحتك إلا بعد «احفظ تعديلاتي». المحتوى لا يتأثر."
          confirmLabel="استعادة"
          cancelLabel="إلغاء"
          onConfirm={() => { resetDesign(); setConfirm(null); setToast('أُعيد التصميم الافتراضي'); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'logout' && (
        <ConfirmSheet title="تسجيل الخروج؟" message="لديك تعديلات لم تُحفظ وستُفقد عند الخروج." confirmLabel="الخروج بدون حفظ" cancelLabel="البقاء" onConfirm={doLogout} onCancel={() => setConfirm(null)} />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4" role="status">
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-black/5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34c759] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
