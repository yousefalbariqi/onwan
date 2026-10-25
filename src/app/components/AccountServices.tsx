import { useCallback, useEffect, useState } from 'react';
import { Account, accountCall, resendWait } from '../lib/api';
import { Group, Notice, PrimaryButton } from './ios';
import { PasswordInput } from './PasswordInput';

export type Overview = {
  stats: { total: number; last30: number };
  design: {
    priceSar: number | null;
    canPurchase: boolean;
    package: { state: 'pending_payment' | 'in_progress' | 'done'; approvedAt: string | null } | null;
  };
  domain: {
    priceSar: number | null;
    current: { domain: string; status: string; price: number; instruction: { type: string; name: string; value: string } } | null;
  };
  nfc: {
    unitPrice: number | null;
    shippingPrice: number | null;
    orders: { order_number: number; quantity: number; total: number; status: string; created_at: string }[];
  };
};

const NFC_STATUS: Record<string, string> = {
  pending_payment: 'بانتظار الدفع',
  paid: 'سنتواصل معك قبل الشحن',
  contacted: 'قيد التجهيز',
  shipped: 'تم الشحن',
  cancelled: 'ملغى',
};

export const DOMAIN_STATUS: Record<string, string> = {
  pending_payment: 'بانتظار الدفع',
  awaiting_dns: 'بانتظار الربط',
  dns_verified: 'قيد التفعيل',
  active: 'مفعّل',
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ar-u-ca-gregory-nu-latn', { dateStyle: 'long' }) : '—';
}

// Inputs inside grouped rows, as in iOS Settings.
const inputClass = 'w-full bg-transparent py-3 text-[16px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';

// PAGE-15, «صمّم لي» (DES-01/02, NEW-06), DOMAIN-03 and NFC (NFC-02, NEW-07):
// one overview request feeds the settings list and each service page.
export function useOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const reload = useCallback(() => accountCall<Overview>('overview').then(setOverview).catch(() => undefined), []);
  useEffect(() => { void reload(); }, [reload]);
  return { overview, reload };
}

function useAction(reload: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const run = async (action: () => Promise<string>) => {
    try {
      setBusy(true);
      setNotice({ tone: 'good', text: await action() });
      await reload();
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, notice, run };
}

export function VisitsPage({ overview }: { overview: Overview }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-center">
        {[{ value: overview.stats.last30, label: 'آخر 30 يومًا' }, { value: overview.stats.total, label: 'منذ البداية' }].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white px-3 py-5">
            <div className="text-3xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{item.value.toLocaleString('ar-u-nu-latn')}</div>
            <div className="mt-1 text-xs text-[#8e8e93]">{item.label}</div>
          </div>
        ))}
      </div>
      <p className="px-4 text-xs leading-5 text-[#8e8e93]">تُحسب زيارة واحدة عند كل فتح لصفحتك المنشورة.</p>
    </>
  );
}

export function DesignServicePage({ overview, reload }: { overview: Overview; reload: () => Promise<unknown> }) {
  const { busy, notice, run } = useAction(reload);
  const { design } = overview;
  const pkg = design.package;
  return (
    <>
      <Group title="عن الخدمة" footer="تنتهي الخدمة باعتمادك للتصميم.">
        <p className="px-4 py-3 text-[15px] leading-7 text-[#1d1d1f]">
          يصمم فريق عنوان صفحتك لمرة واحدة، والتواصل والاعتماد عبر واتساب.
          <span className="block text-[#8e8e93]">{design.priceSar !== null ? `السعر ${design.priceSar} ريال` : 'السعر يُعلن قريبًا'}</span>
        </p>
      </Group>
      {pkg?.state === 'pending_payment' && <Notice tone="warn">طلبك مسجّل وبانتظار الدفع. سيتواصل معك الفريق عبر واتساب.</Notice>}
      {pkg?.state === 'in_progress' && <Notice tone="good">الخدمة مدفوعة والتصميم قيد التنفيذ. نتواصل معك عبر واتساب للاعتماد.</Notice>}
      {pkg?.state === 'done' && <Notice>اكتملت الخدمة باعتماد التصميم في {formatDate(pkg.approvedAt)}.</Notice>}
      {design.canPurchase && (
        <PrimaryButton busy={busy} onClick={() => run(async () => (await accountCall('design.request')).message)}>
          {pkg ? 'طلب الخدمة مجددًا' : 'اطلب الخدمة'}
        </PrimaryButton>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </>
  );
}

export function DomainPage({ overview, reload }: { overview: Overview; reload: () => Promise<unknown> }) {
  const { busy, notice, run } = useAction(reload);
  const [domainInput, setDomainInput] = useState('');
  const current = overview.domain.current;
  return (
    <>
      <p className="px-4 text-[13px] leading-6 text-[#6e6e73]">
        اعرض صفحتك على دومين جهتك مثل <span dir="ltr">link.example.org</span>. الرابط الحالي يبقى يعمل، فلا تتعطل رموز QR ولا قطع NFC.
        {overview.domain.priceSar !== null ? ` الرسوم ${overview.domain.priceSar} ريال.` : ' الخدمة تتاح قريبًا.'}
      </p>

      {!current && overview.domain.priceSar !== null && (
        <>
          <Group title="الدومين">
            <div className="px-4" dir="ltr"><input value={domainInput} onChange={(e) => setDomainInput(e.target.value.trim().toLowerCase())} placeholder="link.example.org" aria-label="الدومين" className={inputClass} /></div>
          </Group>
          <PrimaryButton busy={busy} disabled={!domainInput.includes('.')} onClick={() => run(async () => (await accountCall('domain.request', { domain: domainInput })).message)}>طلب الدومين</PrimaryButton>
        </>
      )}

      {current && (
        <>
          <Group title="دومينك">
            <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 text-[15px]">
              <span className="truncate font-bold text-[#1d1d1f]" dir="ltr">{current.domain}</span>
              <span className={current.status === 'active' ? 'text-[#34c759]' : 'text-[#8e8e93]'}>{DOMAIN_STATUS[current.status] ?? current.status}</span>
            </div>
          </Group>
          {current.status === 'pending_payment' && <Notice tone="warn">بانتظار الدفع ({current.price} ريال). سيتواصل معك الفريق.</Notice>}
          {current.status === 'awaiting_dns' && (
            <>
              <Group title="السجل المطلوب" footer="أضفه عند مزوّد الدومين (أو اطلب ذلك من مسؤول التقنية في جهتك)، ثم اضغط «تحقق من الربط».">
                {(['type', 'name', 'value'] as const).map((key) => (
                  <div key={key} className="flex min-h-[44px] items-center justify-between gap-3 px-4 text-[14px]" dir="ltr">
                    <span className="capitalize text-[#8e8e93]">{key}</span>
                    <span className="select-all break-all font-mono font-bold text-[#1d1d1f]">{current.instruction[key]}</span>
                  </div>
                ))}
              </Group>
              <PrimaryButton busy={busy} onClick={() => run(async () => (await accountCall('domain.verify')).message)}>تحقق من الربط</PrimaryButton>
            </>
          )}
          {current.status === 'dns_verified' && <Notice>تم التحقق من الدومين، وهو قيد التفعيل من فريق عنوان.</Notice>}
          {current.status === 'active' && <Notice tone="good">صفحتك تعمل على هذا الدومين.</Notice>}
        </>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </>
  );
}

export function NfcPage({ overview, reload, nameFixed }: { overview: Overview; reload: () => Promise<unknown>; nameFixed: boolean }) {
  const { busy, notice, run } = useAction(reload);
  const empty = { quantity: '1', recipientName: '', recipientPhone: '', city: '', address: '' };
  const [nfc, setNfc] = useState(empty);
  const quantity = Math.max(0, Math.floor(Number(nfc.quantity) || 0));
  const priced = overview.nfc.unitPrice !== null && overview.nfc.shippingPrice !== null;
  const total = priced ? quantity * (overview.nfc.unitPrice as number) + (overview.nfc.shippingPrice as number) : null;
  const ready = quantity >= 1 && nfc.recipientName.trim().length >= 2 && nfc.recipientPhone.length >= 8 && nfc.city.trim().length >= 2 && nfc.address.trim().length >= 5;
  const field = (key: keyof typeof empty, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex min-h-[48px] items-center gap-3 px-4">
      <span className="w-24 shrink-0 text-[15px] text-[#1d1d1f]">{label}</span>
      <input value={nfc[key]} onChange={(e) => setNfc({ ...nfc, [key]: key === 'recipientPhone' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value })} className={inputClass} {...props} />
    </label>
  );

  return (
    <>
      <p className="px-4 text-[13px] leading-6 text-[#6e6e73]">
        قطعة تفتح صفحتك عند تقريب الجوال منها، ولا تحتاج تبديلها عند تحديث صفحتك.
        {priced ? ` القطعة ${overview.nfc.unitPrice} ريال والشحن ${overview.nfc.shippingPrice} ريال.` : ' السعر يُعلن قريبًا.'}
      </p>

      {!nameFixed && <Notice>قبل إتمام الاشتراك تُضاف القطع من «سلة التسجيل» وتُدفع مع الاشتراك.</Notice>}

      {nameFixed && priced && (
        <>
          <Group title="طلب جديد">
            {field('quantity', 'عدد القطع', { type: 'number', min: 1, dir: 'ltr', inputMode: 'numeric' })}
            {field('recipientName', 'المستلم', { placeholder: 'الاسم' })}
            {field('recipientPhone', 'الجوال', { dir: 'ltr', inputMode: 'numeric', placeholder: '05XXXXXXXX' })}
            {field('city', 'المدينة')}
            <label className="block px-4 py-2">
              <span className="text-[15px] text-[#1d1d1f]">عنوان الشحن</span>
              <textarea value={nfc.address} onChange={(e) => setNfc({ ...nfc, address: e.target.value })} rows={2} placeholder="الحي، الشارع، رقم المبنى" className={`${inputClass} resize-none py-2`} />
            </label>
            <div className="flex min-h-[48px] items-center justify-between px-4 text-[15px]">
              <span className="text-[#1d1d1f]">الإجمالي شامل الشحن</span>
              <span className="font-black text-[#1d1d1f]">{quantity > 0 ? `${total} ريال` : '—'}</span>
            </div>
          </Group>
          <PrimaryButton busy={busy} disabled={!ready} onClick={() => run(async () => {
            const response = await accountCall('nfc.create', { ...nfc, quantity });
            setNfc(empty);
            return `سُجّل الطلب #${response.orderNumber} بإجمالي ${response.total} ريال. بعد تأكيد الدفع نتواصل معك ثم نشحن القطع.`;
          })}>إرسال الطلب</PrimaryButton>
        </>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {overview.nfc.orders.length > 0 && (
        <Group title="طلباتك">
          {overview.nfc.orders.map((order) => (
            <div key={order.order_number} className="flex min-h-[48px] items-center justify-between gap-3 px-4 text-[14px]">
              <span className="text-[#1d1d1f]">#{order.order_number} · {order.quantity} قطعة · {order.total} ريال</span>
              <span className="shrink-0 text-[#8e8e93]">{NFC_STATUS[order.status]}</span>
            </div>
          ))}
        </Group>
      )}
    </>
  );
}

type Change = 'password' | 'phone' | 'email';
const CHANGE_LABELS: Record<Change, string> = { password: 'كلمة المرور', phone: 'رقم الجوال', email: 'البريد الإلكتروني' };

// ACCT-05: changing the email, phone or password needs a code sent to the
// registered email; a new email is also confirmed with a code sent to it.
// Each change is a short page of its own: the code, the new value, one button.
export function AccountSecurity({ change, onAccount, onDone }: { change: Change; onAccount: (account: Account) => void; onDone: (message: string) => void }) {
  const [step, setStep] = useState<'sending' | 'code' | 'newEmailCode'>('sending');
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    try {
      setBusy(true);
      setNotice(null);
      await action();
    } catch (err) {
      // A code sent moments ago still works: that is information, not an error.
      if (resendWait(err)) setStep((current) => (current === 'sending' ? 'code' : current));
      setNotice({ tone: resendWait(err) ? 'info' : 'bad', text: err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.' });
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => run(async () => {
    const response = await accountCall('change.sendCode');
    setStep('code');
    setNotice({ tone: 'info', text: response.message });
  });

  // The code goes out as soon as the page opens.
  useEffect(() => { void sendCode(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => run(async () => {
    if (change === 'password') {
      onDone((await accountCall('change.password', { code, password: value })).message);
    } else if (change === 'phone') {
      const response = await accountCall('change.phone', { code, phone: value });
      onAccount(response.account);
      onDone(response.message);
    } else if (step === 'code') {
      const response = await accountCall('change.email.start', { code, newEmail: value });
      setStep('newEmailCode');
      setCode('');
      setNotice({ tone: 'info', text: response.message });
    } else {
      const response = await accountCall('change.email.confirm', { code });
      onAccount(response.account);
      onDone(response.message);
    }
  });

  const ready = code.length === 4 && (step !== 'code' || value.length >= (change === 'password' ? 8 : 5));

  return (
    <>
      <Group title={step === 'newEmailCode' ? 'الرمز المرسل إلى بريدك الجديد' : 'الرمز المرسل إلى بريدك المسجل'}>
        <div className="px-4" dir="ltr">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} maxLength={4} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • •" aria-label="الرمز" className={`${inputClass} text-center text-2xl tracking-[0.6em]`} />
        </div>
      </Group>
      {step === 'code' && (
        <Group title={change === 'password' ? 'كلمة المرور الجديدة' : change === 'email' ? 'البريد الجديد' : 'رقم الجوال الجديد'} footer={change === 'password' ? '8 أحرف على الأقل.' : undefined}>
          <div className="px-4" dir="ltr">
            {change === 'password' ? (
              <PasswordInput value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" aria-label={CHANGE_LABELS[change]} className={inputClass} />
            ) : <input type={change === 'email' ? 'email' : 'tel'} value={value} onChange={(e) => setValue(change === 'phone' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)} autoComplete="off" aria-label={CHANGE_LABELS[change]} className={inputClass} />}
          </div>
        </Group>
      )}
      <PrimaryButton busy={busy} disabled={!ready} onClick={submit}>{change === 'email' && step === 'code' ? 'التالي' : `حفظ ${CHANGE_LABELS[change]}`}</PrimaryButton>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {step !== 'sending' && <button type="button" disabled={busy} onClick={sendCode} className="block w-full text-center text-sm text-[#0a84ff] disabled:text-[#c7c7cc]">لم يصلك الرمز؟ أرسله مجددًا</button>}
    </>
  );
}

export { CHANGE_LABELS };
export type { Change };
