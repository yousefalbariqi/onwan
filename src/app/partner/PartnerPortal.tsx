import { useCallback, useEffect, useState } from 'react';
import { TurnstileBox } from '../lib/turnstile';
import { Link } from 'react-router';
import { Copy, LogOut, Plus, ArrowLeft, Pencil } from 'lucide-react';
import { BRAND_NAME, ROOT_DOMAIN } from '../lib/site';
import { Badge, Button, Card, Empty, ErrorNote, Field, PLAN_NAMES, formatDate, inputClass, useAction, useLoad } from '../admin/ui';
import { PartnerAccount, getPartnerToken, partnerCall, setPartnerToken } from './partnerApi';
import { PasswordInput } from '../components/PasswordInput';

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

// Note 54: partners sign in with a code sent to their email; a partner who
// already has a password may still use it.
function PartnerLogin({ onLogin }: { onLogin: (partner: PartnerAccount) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'code' | 'password'>('code');
  const [sent, setSent] = useState('');
  const action = useAction();
  const finish = (response: { token: string; partner: PartnerAccount }) => {
    setPartnerToken(response.token);
    onLogin(response.partner);
  };
  const field = 'block w-full bg-transparent px-4 py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';

  return (
    <div className="flex min-h-screen items-end justify-center bg-[#f2f2f7] sm:items-center sm:p-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            if (method === 'password') return finish(await partnerCall('login', { email, password }));
            if (!sent) return setSent((await partnerCall<{ message: string }>('login.sendCode', { email })).message);
            finish(await partnerCall('login.verifyCode', { email, code }));
          });
        }}
        className="w-full max-w-[400px] space-y-5 px-5 pb-8 pt-10"
      >
        <div className="text-center">
          <h1 className="text-[26px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>بوابة الشركاء</h1>
          <p className="mt-1 text-[15px] text-[#6e6e73]">{method === 'code' ? 'نرسل رمز الدخول إلى بريدك' : 'ادخل بكلمة مرورك'}</p>
        </div>
        <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value.trim()); setSent(''); }} placeholder="البريد الإلكتروني" aria-label="البريد الإلكتروني" className={field} dir="ltr" style={{ textAlign: 'right' }} autoComplete="username" autoFocus />
          {method === 'password' && <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" aria-label="كلمة المرور" className={field} dir="ltr" autoComplete="current-password" />}
          {method === 'code' && sent && <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="• • • •" aria-label="رمز الدخول" inputMode="numeric" autoComplete="one-time-code" className={`${field} text-center text-2xl tracking-[0.6em]`} dir="ltr" />}
        </div>
        {sent && method === 'code' && <p className="px-1 text-[13px] text-[#1f7a35]">{sent}</p>}
        <TurnstileBox />
        <ErrorNote message={action.error} />
        <button type="submit" disabled={action.busy || !email || (method === 'password' ? !password : Boolean(sent) && code.length !== 4)} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] disabled:bg-[#c7c7cc] disabled:shadow-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {action.busy ? 'لحظات…' : method === 'password' || sent ? 'دخول' : 'أرسل رمز الدخول'}
        </button>
        <div className="flex items-center justify-between px-1 text-[15px]">
          <button type="button" onClick={() => { setMethod(method === 'code' ? 'password' : 'code'); setSent(''); setCode(''); }} className="text-[#0a84ff]">{method === 'code' ? 'لدي كلمة مرور' : 'الدخول برمز'}</button>
          <Link to="/partners" className="font-bold text-[#0a84ff]">قدّم طلب شراكة</Link>
        </div>
      </form>
    </div>
  );
}

function SalesLink({ partner }: { partner: PartnerAccount }) {
  const [monthly, setMonthly] = useState(String(partner.saleMonthly ?? ''));
  const [annual, setAnnual] = useState(String(partner.saleAnnual ?? ''));
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const action = useAction();
  // Note 57/65: the partner's own address when the administration set one.
  const link = partner.slug ? `https://${partner.slug}.${ROOT_DOMAIN}` : `${window.location.origin}/via/${partner.id}`;
  return <>
  <Card title="إعدادات التسعير">
    <p className="mb-4 text-sm leading-6 text-gray-500">أسعارك لعملائك. تُطبّق تلقائيًا على كل بيع جديد، من رابطك ومن «بيع جديد». الطلبات المرسلة أو المدفوعة تبقى بسعرها.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`سعر البيع الشهري${partner.priceMonthly === null ? ' — غير متاح' : ` — الحد الأدنى ${partner.priceMonthly} ريال`}`}><input type="number" step="0.01" min={partner.priceMonthly ?? 0} disabled={partner.priceMonthly === null} value={monthly} onChange={e => { setMonthly(e.target.value); setSaved(false); }} className={inputClass} /></Field>
      <Field label={`سعر البيع السنوي${partner.priceAnnual === null ? ' — غير متاح' : ` — الحد الأدنى ${partner.priceAnnual} ريال`}`}><input type="number" step="0.01" min={partner.priceAnnual ?? 0} disabled={partner.priceAnnual === null} value={annual} onChange={e => { setAnnual(e.target.value); setSaved(false); }} className={inputClass} /></Field>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button tone="primary" disabled={action.busy} onClick={() => action.run(async () => { await partnerCall('storefront.save', { monthly: monthly || null, annual: annual || null }); setSaved(true); })}>{action.busy ? 'جارٍ الحفظ…' : 'حفظ الأسعار'}</Button>{saved && <span className="text-sm text-emerald-700">حُفظت الأسعار</span>}</div>
    <ErrorNote message={action.error} />
  </Card>
  <Card title="رابطك الخاص">
    <p className="mb-3 text-sm leading-6 text-gray-500">شارك رابطك ليصمّم العميل صفحته بنفسه ويشتري بأسعارك. تُنسب العملية إليك بعد تأكيد الدفع.</p>
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3"><input aria-label="رابط البيع" readOnly value={link} dir="ltr" className="min-w-0 flex-1 bg-transparent text-sm" onFocus={e => e.target.select()} /><button className="text-sm font-bold text-emerald-700" onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice('تم نسخ رابط البيع'); } catch { setNotice('حدد الرابط وانسخه يدويًا.'); } }}>نسخ الرابط</button><a href={link} target="_blank" rel="noreferrer" className="text-sm text-gray-500">معاينة العرض</a></div>
    {notice && <p role="status" className="mt-2 text-sm text-emerald-700">{notice}</p>}
  </Card>
  </>;
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

        {!stopped && <>
          <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-gray-950 p-6 text-white">
            <div><p className="mb-2 text-sm font-bold text-emerald-300">بيع جديد</p><h2 className="text-xl font-black">سجّل عميلك في دقيقة</h2><p className="mt-2 text-sm leading-6 text-gray-300">بيانات العميل والاشتراك، ثم أرسل له العرض مباشرة أو صمّم صفحته أولًا. يعاين ويدفع، وتُسجَّل العملية باسمك.</p></div>
            <Link to="/partner/new" className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-950"><Plus className="h-4 w-4" />بيع جديد<ArrowLeft className="h-4 w-4" /></Link>
          </section>
          <SalesLink partner={partner} />
        </>}

        {/* Note 57: every order shows its state — مسودة، جاهز للإرسال، بانتظار العميل، مدفوع، ملغى. */}
        {orders.data?.drafts?.length > 0 && (
          <Card title="قيد التجهيز">
            <ul className="divide-y divide-gray-100">
              {orders.data.drafts.map((order: any) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <span className="font-bold">#{order.order_number}</span> {order.customer_name}{' '}
                    <Badge tone={order.ready_at ? 'green' : 'gray'}>{order.ready_at ? 'جاهز للإرسال' : 'مسودة'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!stopped && <Link to={`/partner/edit/${order.id}`} className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white"><Pencil className="h-3 w-3" />{order.ready_at ? 'مراجعة وإرسال' : 'متابعة التصميم'}</Link>}
                    <Button disabled={action.busy} className="!px-2 !py-1 !text-xs" onClick={() => window.confirm(`إلغاء الطلب #${order.order_number}؟`) && action.run(() => partnerCall('orders.cancel', { id: order.id }))}>إلغاء</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="بانتظار العميل">
          <ErrorNote message={orders.error || action.error} />
          {orders.data?.awaiting.length === 0 && <Empty>لا توجد طلبات بانتظار الدفع.</Empty>}
          <ul className="divide-y divide-gray-100">
            {orders.data?.awaiting.map((order: any) => (
              <li key={order.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">#{order.order_number}</span> {order.customer_name}{' '}
                    {/* Note 64: where the customer is with the order. */}
                    {order.revision_requested_at ? <Badge tone="red">بانتظار التعديل</Badge> : order.with_design && !order.approved_at ? <Badge tone="amber">بانتظار موافقة العميل</Badge> : <Badge tone="amber">بانتظار الدفع</Badge>}{' '}
                    <span className="text-xs text-gray-500" dir="ltr">{order.username}.{ROOT_DOMAIN}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {PLAN_NAMES[order.plan]} · {money(order.sale_price)} · {formatDate(order.created_at)}
                  </span>
                </div>
                {order.revision_requested_at && order.revision_note && (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-900">طلب العميل: {order.revision_note}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyLink link={order.payLink} />
                  {!stopped && <Link to={`/partner/edit/${order.id}`} className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"><Pencil className="h-3 w-3" />تعديل التصميم</Link>}
                  {!stopped && (
                    <Button disabled={action.busy} className="!px-2 !py-1 !text-xs" onClick={() => action.run(async () => { const response = await partnerCall('orders.resend', { id: order.id }); if (!response.emailed && !partner.testMode) throw new Error('تعذر إرسال البريد. يمكنك نسخ الرابط وإرساله للعميل.'); })}>
                      {order.revision_requested_at ? 'إرسال النسخة المعدّلة' : 'إعادة إرسال الرابط بالبريد'}
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
              الطلب غير المدفوع يختفي من هنا بعد {orders.data.windowDays} أيام. يمكنك تعديل تصميمه قبل الدفع من زر «تعديل التصميم».
            </p>
          )}
        </Card>

        <Card title="العملاء المكتملون">
          {orders.data?.completed.length === 0 && <Empty>لا يوجد عملاء مكتملون بعد.</Empty>}
          <ul className="divide-y divide-gray-100">
            {orders.data?.completed.map((order: any) => (
              <li key={order.order_number} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-bold">#{order.order_number}</span> {order.customer_name} <Badge tone="green">مدفوع</Badge>
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

        {orders.data?.cancelled?.length > 0 && (
          <Card title="ملغاة (آخر 30 يومًا)">
            <ul className="divide-y divide-gray-100">
              {orders.data.cancelled.map((order: any) => (
                <li key={order.order_number} className="flex items-center justify-between py-2 text-sm text-gray-600">
                  <span><span className="font-bold">#{order.order_number}</span> {order.customer_name} <Badge tone="red">ملغى</Badge></span>
                  <span className="text-xs">{formatDate(order.cancelled_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
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
