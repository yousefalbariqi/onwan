import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Copy, LogOut } from 'lucide-react';
import { themes } from '../context/PageContext';
import { BRAND_NAME, ROOT_DOMAIN, USERNAME_PATTERN } from '../lib/site';
import { Badge, Button, Card, Empty, ErrorNote, Field, PLAN_NAMES, formatDate, inputClass, useAction, useLoad } from '../admin/ui';
import { PartnerAccount, getPartnerToken, partnerCall, setPartnerToken } from './partnerApi';

function money(value: number) {
  return `${value.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`;
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'تم النسخ' : 'نسخ رابط الدفع'}
    </button>
  );
}

function PartnerLogin({ onLogin }: { onLogin: (partner: PartnerAccount) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            const response = await partnerCall<{ token: string; partner: PartnerAccount }>('login', { email, password });
            setPartnerToken(response.token);
            onLogin(response.partner);
          });
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg"
      >
        <h1 className="text-xl font-black text-gray-900">بوابة شركاء {BRAND_NAME}</h1>
        <Field label="البريد الإلكتروني">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} className={inputClass} dir="ltr" autoComplete="username" />
        </Field>
        <Field label="كلمة المرور">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} dir="ltr" autoComplete="current-password" />
        </Field>
        <ErrorNote message={action.error} />
        <Button tone="primary" type="submit" disabled={action.busy || !email || !password} className="w-full">
          دخول
        </Button>
        <Link to="/partners" className="block text-center text-xs text-gray-500 hover:underline">
          لست شريكًا؟ قدّم طلب شراكة
        </Link>
      </form>
    </div>
  );
}

const emptyOrder = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  username: '',
  bio: '',
  plan: 'annual',
  salePrice: '',
  themeId: themes[0].id,
  termsAccepted: false,
};

// B2B-03/04/10: register the customer, choose name/design/plan and the sale
// price, record their consent, and send them the payment link.
function NewOrder({ partner, onCreated }: { partner: PartnerAccount; onCreated: () => void }) {
  const [form, setForm] = useState(emptyOrder);
  const [created, setCreated] = useState<{ orderNumber: number; payLink: string; emailed: boolean } | null>(null);
  const action = useAction(onCreated);
  const floor = form.plan === 'annual' ? partner.priceAnnual : partner.priceMonthly;
  const price = Number(form.salePrice);
  const set = (key: keyof typeof emptyOrder) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: event.target.value });

  const valid =
    floor !== null &&
    form.customerName.trim().length > 1 &&
    form.customerPhone.length >= 8 &&
    form.customerEmail.includes('@') &&
    USERNAME_PATTERN.test(form.username) &&
    price >= floor &&
    form.termsAccepted;

  return (
    <Card title="تسجيل عميل جديد">
      {created && (
        <div className="mb-4 space-y-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-bold">تم إنشاء الطلب #{created.orderNumber}</div>
          <div>
            {created.emailed ? 'أُرسل رابط الدفع إلى بريد العميل.' : 'تعذر إرسال البريد؛ انسخ الرابط وأرسله للعميل.'} يمكنك أيضًا إرساله عبر واتساب:
          </div>
          <div className="break-all rounded-lg bg-white p-2 text-xs" dir="ltr">{created.payLink}</div>
          <CopyLink link={created.payLink} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم الجهة">
          <input value={form.customerName} onChange={set('customerName')} className={inputClass} />
        </Field>
        <Field label="اسم الرابط">
          <div className="flex items-center gap-2" dir="ltr">
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
              className={inputClass}
              placeholder="name"
            />
            <span className="text-xs text-gray-500">.{ROOT_DOMAIN}</span>
          </div>
        </Field>
        <Field label="جوال العميل">
          <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} dir="ltr" inputMode="numeric" />
        </Field>
        <Field label="بريد العميل (يصله رابط الدفع ورابط كلمة المرور)">
          <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value.trim() })} className={inputClass} dir="ltr" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="تعريف مختصر بالجهة (اختياري)">
            <textarea value={form.bio} onChange={set('bio')} rows={2} maxLength={150} className={`${inputClass} resize-none`} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600">التصميم</span>
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setForm({ ...form, themeId: theme.id })}
                title={theme.name}
                className={`h-10 w-10 rounded-lg border-2 ${form.themeId === theme.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'}`}
                style={{ background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.buttonColor} 50%)` }}
              />
            ))}
          </div>
        </div>
        <Field label="الاشتراك">
          <select value={form.plan} onChange={set('plan')} className={inputClass}>
            <option value="annual">سنوي</option>
            <option value="monthly">شهري</option>
          </select>
        </Field>
        <Field label={floor === null ? 'سعر البيع' : `سعر البيع (لا يقل عن ${money(floor)})`}>
          <input type="number" min={floor ?? 0} step="0.01" value={form.salePrice} onChange={set('salePrice')} className={inputClass} dir="ltr" disabled={floor === null} />
        </Field>
      </div>

      {floor === null ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">لم تحدد إدارة {BRAND_NAME} سعرك لهذا الاشتراك بعد. تواصل مع الإدارة.</p>
      ) : (
        price >= floor && <p className="mt-2 text-xs text-gray-500">ربحك من هذا الاشتراك: {money(price - floor)}</p>
      )}

      <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={form.termsAccepted} onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })} />
        وافق العميل على شروط استخدام {BRAND_NAME}، وأُوضح له أن الحساب يصبح ملكه وحده بعد الدفع.
      </label>

      <ErrorNote message={action.error} />
      <Button
        tone="primary"
        className="mt-3"
        disabled={action.busy || !valid}
        onClick={() =>
          action.run(async () => {
            const { themeId, ...order } = form;
            const response = await partnerCall('orders.create', {
              ...order,
              salePrice: price,
              theme: themes.find((theme) => theme.id === themeId),
            });
            setCreated(response);
            setForm(emptyOrder);
          })
        }
      >
        إنشاء الطلب وإرسال رابط الدفع
      </Button>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-black text-gray-900">{value}</div>
    </div>
  );
}

function Dashboard({ partner, onLogout }: { partner: PartnerAccount; onLogout: () => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const loadSummary = useCallback(
    // The end date is inclusive for the person choosing it.
    () => partnerCall('summary', { from: from || null, to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : null }),
    [from, to],
  );
  const summary = useLoad<any>(loadSummary);
  const loadOrders = useCallback(() => partnerCall('orders.list'), []);
  const orders = useLoad<any>(loadOrders);
  const action = useAction(orders.reload);
  const totals = summary.data?.totals;
  const stopped = partner.status !== 'active';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-black text-gray-900">{partner.shopName}</div>
            <div className="text-xs text-gray-500">بوابة شركاء {BRAND_NAME}</div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {stopped && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            حسابك موقوف حاليًا: لا يمكن تسجيل عملاء جدد. سجلاتك وعمولاتك محفوظة. تواصل مع إدارة {BRAND_NAME}.
          </div>
        )}

        <Card
          title="حسابي"
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-600">
              من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-36`} />
              إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-36`} />
            </div>
          }
        >
          <ErrorNote message={summary.error} />
          {totals && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="عدد العملاء" value={totals.customers} />
              <Stat label="المستحق" value={money(totals.earned)} />
              <Stat label="المصروف" value={money(totals.paid)} />
              <Stat label="المتبقي (الرصيد الكلي)" value={money(totals.remaining)} />
              <Stat label="تجديدات مصروفة" value={totals.renewalsPaid} />
              <Stat label="آخر صرف" value={formatDate(totals.lastPayoutAt)} />
            </div>
          )}
          {totals?.renewalsUnpriced > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              لديك {totals.renewalsUnpriced} تجديدًا مسجّلًا لم تُحتسب قيمته بعد؛ تضاف إلى المستحق عند احتسابها من الإدارة.
            </p>
          )}

          {summary.data?.payouts.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {summary.data.payouts.map((payout: any, index: number) => (
                <li key={index} className="flex items-center justify-between py-2">
                  <span>
                    صرف {money(payout.amount)}
                    {payout.note && <span className="mr-2 text-xs text-gray-500">{payout.note}</span>}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(payout.paid_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!stopped && <NewOrder partner={partner} onCreated={orders.reload} />}

        <Card title="طلبات بانتظار الدفع">
          <ErrorNote message={orders.error || action.error} />
          {orders.data?.awaiting.length === 0 && <Empty>لا توجد طلبات بانتظار الدفع.</Empty>}
          <ul className="divide-y divide-gray-100">
            {orders.data?.awaiting.map((order: any) => (
              <li key={order.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">#{order.order_number}</span> {order.customer_name}{' '}
                    <span className="text-xs text-gray-500" dir="ltr">{order.username}.{ROOT_DOMAIN}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {PLAN_NAMES[order.plan]} · {money(order.sale_price)} · {formatDate(order.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyLink link={order.payLink} />
                  {!stopped && (
                    <Button disabled={action.busy} className="!px-2 !py-1 !text-xs" onClick={() => action.run(() => partnerCall('orders.resend', { id: order.id }))}>
                      إعادة إرسال الرابط بالبريد
                    </Button>
                  )}
                  <Button
                    disabled={action.busy}
                    className="!px-2 !py-1 !text-xs"
                    onClick={() => window.confirm(`إلغاء الطلب #${order.order_number}؟`) && action.run(() => partnerCall('orders.cancel', { id: order.id }))}
                  >
                    إلغاء الطلب
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {orders.data && (
            <p className="mt-3 text-xs text-gray-500">
              الطلب غير المدفوع يختفي من هنا بعد {orders.data.windowDays} أيام. لتعديل طلب ألغِه وأنشئ طلبًا جديدًا.
            </p>
          )}
        </Card>

        <Card title="العملاء المكتملون">
          {orders.data?.completed.length === 0 && <Empty>لا يوجد عملاء مكتملون بعد.</Empty>}
          <ul className="divide-y divide-gray-100">
            {orders.data?.completed.map((order: any) => (
              <li key={order.order_number} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-bold">#{order.order_number}</span> {order.customer_name} <Badge tone="green">مكتمل</Badge>
                </div>
                <span className="text-xs text-gray-600">
                  عمولتك: {money(order.commission)}
                  {order.renewals > 0 && ` · ${order.renewals} تجديد`} · {formatDate(order.completed_at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">بعد اكتمال التسجيل يصبح حساب العميل مستقلًا، ويظهر لك اسمه ورقم الطلب وعمولتك فقط.</p>
        </Card>
      </main>
    </div>
  );
}

export default function PartnerPortal() {
  const [partner, setPartner] = useState<PartnerAccount | null>(null);
  const [checking, setChecking] = useState(Boolean(getPartnerToken()));

  useEffect(() => {
    document.title = `شركاء ${BRAND_NAME}`;

    if (!getPartnerToken()) return;

    partnerCall<{ partner: PartnerAccount }>('me')
      .then((response) => setPartner(response.partner))
      .catch(() => setPartnerToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-gray-100" />;
  }

  return (
    <div dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      {partner ? (
        <Dashboard
          partner={partner}
          onLogout={() => {
            setPartnerToken(null);
            setPartner(null);
          }}
        />
      ) : (
        <PartnerLogin onLogin={setPartner} />
      )}
    </div>
  );
}
