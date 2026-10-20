import { useCallback, useEffect, useState } from 'react';
import { Account, accountCall } from '../lib/api';

type Overview = {
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

const fieldClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500';
const noteClass = 'text-xs text-gray-600';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ar-u-ca-gregory-nu-latn', { dateStyle: 'long' }) : '—';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <h4 className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

// PAGE-15, «صمّم لي» (DES-01/02, NEW-06) and NFC orders (NFC-02, NEW-07).
export function AccountServices({ nameFixed }: { nameFixed: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [notice, setNotice] = useState<{ design?: string; nfc?: string; domain?: string }>({});
  const [domainInput, setDomainInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [nfc, setNfc] = useState({ quantity: '1', recipientName: '', recipientPhone: '', city: '', address: '' });

  const reload = useCallback(() => accountCall<Overview>('overview').then(setOverview).catch(() => undefined), []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!overview) {
    return null;
  }

  const run = async (key: 'design' | 'nfc' | 'domain', action: () => Promise<string>) => {
    try {
      setBusy(true);
      const message = await action();
      setNotice({ [key]: message });
      await reload();
    } catch (err) {
      setNotice({ [key]: err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.' });
    } finally {
      setBusy(false);
    }
  };

  const { design } = overview;
  const pkg = design.package;
  const quantity = Math.max(0, Math.floor(Number(nfc.quantity) || 0));
  const nfcPriced = overview.nfc.unitPrice !== null && overview.nfc.shippingPrice !== null;
  const nfcTotal = nfcPriced ? quantity * (overview.nfc.unitPrice as number) + (overview.nfc.shippingPrice as number) : null;
  const setNfcField = (key: keyof typeof nfc) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setNfc({ ...nfc, [key]: event.target.value });

  return (
    <>
      <Section title="زيارات الصفحة">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xl font-black text-gray-900">{overview.stats.last30}</div>
            <div className={noteClass}>آخر 30 يومًا</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xl font-black text-gray-900">{overview.stats.total}</div>
            <div className={noteClass}>الإجمالي</div>
          </div>
        </div>
      </Section>

      <Section title="خدمة «صمّم لي»">
        <p className={noteClass}>
          يصمم فريق عنوان صفحتك لمرة واحدة، والتواصل والاعتماد عبر واتساب. تنتهي الخدمة باعتمادك للتصميم.
          {design.priceSar !== null ? ` سعر الباقة ${design.priceSar} ريال.` : ' السعر يُعلن قريبًا.'}
        </p>

        {pkg?.state === 'pending_payment' && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">طلبك مسجّل وبانتظار الدفع. سيتواصل معك الفريق عبر واتساب.</p>
        )}
        {pkg?.state === 'in_progress' && (
          <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">الخدمة مدفوعة والتصميم قيد التنفيذ. نتواصل معك عبر واتساب للاعتماد.</p>
        )}
        {pkg?.state === 'done' && (
          <p className="rounded-lg bg-gray-100 p-3 text-xs text-gray-700">اكتملت الخدمة باعتماد التصميم في {formatDate(pkg.approvedAt)}.</p>
        )}

        {design.canPurchase && (
          <button
            disabled={busy}
            onClick={() => run('design', async () => (await accountCall('design.request')).message)}
            className="w-full rounded-lg bg-gray-900 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {pkg ? 'طلب الخدمة مجددًا' : 'اطلب الخدمة'}
          </button>
        )}
        {notice.design && <p className={noteClass}>{notice.design}</p>}
      </Section>

      {/* DOMAIN-03: the page on the entity's own domain. */}
      {nameFixed && (
        <Section title="دومين خاص بجهتك">
          <p className={noteClass}>
            اعرض صفحتك على دومين جهتك مثل <span dir="ltr">link.example.org</span> بدل رابط عنوان. الرابط الحالي يبقى يعمل، فلا تتعطل رموز QR ولا قطع NFC.
            {overview.domain.priceSar !== null ? ` الرسوم ${overview.domain.priceSar} ريال.` : ' الخدمة تتاح قريبًا.'}
          </p>

          {!overview.domain.current && overview.domain.priceSar !== null && (
            <div className="flex gap-2">
              <input value={domainInput} onChange={(e) => setDomainInput(e.target.value.trim().toLowerCase())} placeholder="link.example.org" className={fieldClass} dir="ltr" />
              <button
                disabled={busy || !domainInput.includes('.')}
                onClick={() => run('domain', async () => (await accountCall('domain.request', { domain: domainInput })).message)}
                className="rounded-lg bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                طلب
              </button>
            </div>
          )}

          {overview.domain.current && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              <div className="font-bold text-gray-900" dir="ltr" style={{ textAlign: 'right' }}>{overview.domain.current.domain}</div>
              {overview.domain.current.status === 'pending_payment' && <div>بانتظار الدفع ({overview.domain.current.price} ريال). سيتواصل معك الفريق.</div>}
              {overview.domain.current.status === 'awaiting_dns' && (
                <>
                  <div>أضف هذا السجل عند مزوّد الدومين (أو اطلب ذلك من مسؤول التقنية في جهتك)، ثم اضغط «تحقق»:</div>
                  <table className="w-full rounded bg-white text-left" dir="ltr">
                    <tbody>
                      <tr><td className="p-1 text-gray-500">Type</td><td className="p-1 font-mono font-bold">{overview.domain.current.instruction.type}</td></tr>
                      <tr><td className="p-1 text-gray-500">Name</td><td className="p-1 font-mono font-bold">{overview.domain.current.instruction.name}</td></tr>
                      <tr><td className="p-1 text-gray-500">Value</td><td className="p-1 font-mono font-bold">{overview.domain.current.instruction.value}</td></tr>
                    </tbody>
                  </table>
                  <button
                    disabled={busy}
                    onClick={() => run('domain', async () => (await accountCall('domain.verify')).message)}
                    className="w-full rounded-lg bg-gray-900 py-2 text-sm font-bold text-white disabled:opacity-50"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    تحقق
                  </button>
                </>
              )}
              {overview.domain.current.status === 'dns_verified' && <div>تم التحقق من الدومين، وهو قيد التفعيل من فريق عنوان.</div>}
              {overview.domain.current.status === 'active' && <div className="font-semibold text-emerald-700">مفعّل — صفحتك تعمل على هذا الدومين.</div>}
            </div>
          )}
          {notice.domain && <p className={noteClass}>{notice.domain}</p>}
        </Section>
      )}

      <Section title="قطع NFC">
        <p className={noteClass}>
          قطعة تفتح صفحتك عند تقريب الجوال منها. تحديث محتوى الصفحة لا يحتاج تبديل القطعة.
          {nfcPriced
            ? ` سعر القطعة ${overview.nfc.unitPrice} ريال والشحن ${overview.nfc.shippingPrice} ريال.`
            : ' السعر يُعلن قريبًا.'}
        </p>

        {!nameFixed && (
          <p className="rounded-lg bg-gray-100 p-3 text-xs text-gray-700">قبل إتمام الاشتراك تُضاف القطع من «سلة التسجيل» وتُدفع مع الاشتراك.</p>
        )}

        {nameFixed && nfcPriced && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={1} value={nfc.quantity} onChange={setNfcField('quantity')} placeholder="عدد القطع" className={fieldClass} dir="ltr" />
              <input value={nfc.recipientName} onChange={setNfcField('recipientName')} placeholder="اسم المستلم" className={fieldClass} />
              <input value={nfc.recipientPhone} onChange={(e) => setNfc({ ...nfc, recipientPhone: e.target.value.replace(/[^0-9]/g, '') })} placeholder="جوال المستلم" className={fieldClass} dir="ltr" inputMode="numeric" />
              <input value={nfc.city} onChange={setNfcField('city')} placeholder="المدينة" className={fieldClass} />
            </div>
            <textarea value={nfc.address} onChange={setNfcField('address')} placeholder="عنوان الشحن بالتفصيل" rows={2} className={`${fieldClass} resize-none`} />
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
              <span className="text-gray-600">الإجمالي شامل الشحن</span>
              <span className="font-black text-gray-900">{quantity > 0 ? `${nfcTotal} ريال` : '—'}</span>
            </div>
            <button
              disabled={busy || quantity < 1 || nfc.recipientName.trim().length < 2 || nfc.recipientPhone.length < 8 || nfc.city.trim().length < 2 || nfc.address.trim().length < 5}
              onClick={() =>
                run('nfc', async () => {
                  const response = await accountCall('nfc.create', { ...nfc, quantity });
                  setNfc({ quantity: '1', recipientName: '', recipientPhone: '', city: '', address: '' });
                  return `سُجّل الطلب #${response.orderNumber} بإجمالي ${response.total} ريال. بعد تأكيد الدفع نتواصل معك ثم نشحن القطع.`;
                })
              }
              className="w-full rounded-lg bg-gray-900 py-2 text-sm font-bold text-white disabled:opacity-50"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              إرسال الطلب
            </button>
          </>
        )}
        {notice.nfc && <p className={noteClass}>{notice.nfc}</p>}

        {overview.nfc.orders.length > 0 && (
          <ul className="divide-y divide-gray-100 text-xs text-gray-700">
            {overview.nfc.orders.map((order) => (
              <li key={order.order_number} className="flex items-center justify-between py-2">
                <span>
                  #{order.order_number} · {order.quantity} قطعة · {order.total} ريال
                </span>
                <span className="font-semibold">{NFC_STATUS[order.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

type Change = 'password' | 'phone' | 'email';

// ACCT-05: changing the email, phone or password needs a code sent to the
// registered email; a new email is also confirmed with a code sent to it.
export function AccountSecurity({ onAccount }: { onAccount: (account: Account) => void }) {
  const [change, setChange] = useState<Change | null>(null);
  const [step, setStep] = useState<'code' | 'newEmailCode'>('code');
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    try {
      setBusy(true);
      setNotice('');
      await action();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.');
    } finally {
      setBusy(false);
    }
  };

  const start = (next: Change) =>
    run(async () => {
      const response = await accountCall('change.sendCode');
      setChange(next);
      setStep('code');
      setCode('');
      setValue('');
      setNotice(response.message);
    });

  const finish = (message: string, account?: Account) => {
    if (account) onAccount(account);
    setChange(null);
    setNotice(message);
  };

  const submit = () =>
    run(async () => {
      if (change === 'password') {
        finish((await accountCall('change.password', { code, password: value })).message);
      } else if (change === 'phone') {
        const response = await accountCall('change.phone', { code, phone: value });
        finish(response.message, response.account);
      } else if (step === 'code') {
        const response = await accountCall('change.email.start', { code, newEmail: value });
        setStep('newEmailCode');
        setCode('');
        setNotice(response.message);
      } else {
        const response = await accountCall('change.email.confirm', { code });
        finish(response.message, response.account);
      }
    });

  const labels: Record<Change, string> = { password: 'كلمة المرور', phone: 'رقم الجوال', email: 'البريد الإلكتروني' };

  return (
    <Section title="تعديل بيانات الدخول">
      {!change ? (
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(labels) as Change[]).map((key) => (
            <button
              key={key}
              disabled={busy}
              onClick={() => start(key)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={4}
            inputMode="numeric"
            placeholder={step === 'newEmailCode' ? 'الرمز المرسل إلى البريد الجديد' : 'الرمز المرسل إلى بريدك المسجل'}
            className={`${fieldClass} text-center`}
            dir="ltr"
          />
          {step === 'code' && (
            <input
              type={change === 'password' ? 'password' : change === 'email' ? 'email' : 'tel'}
              value={value}
              onChange={(e) => setValue(change === 'phone' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
              placeholder={change === 'password' ? 'كلمة المرور الجديدة (8 أحرف على الأقل)' : change === 'email' ? 'البريد الجديد' : 'رقم الجوال الجديد'}
              className={fieldClass}
              dir="ltr"
              autoComplete={change === 'password' ? 'new-password' : 'off'}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={busy || code.length !== 4 || (step === 'code' && value.length < (change === 'password' ? 8 : 5))}
              onClick={submit}
              className="rounded-lg bg-gray-900 py-2 text-sm font-bold text-white disabled:opacity-50"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {change === 'email' && step === 'code' ? 'التالي' : `حفظ ${labels[change]}`}
            </button>
            <button onClick={() => setChange(null)} className="rounded-lg bg-gray-100 py-2 text-sm font-bold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {notice && <p className={noteClass}>{notice}</p>}
    </Section>
  );
}
