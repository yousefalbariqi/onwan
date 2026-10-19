import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Check, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { usePageContext } from '../context/PageContext';
import { Account, Plan, accountCall } from '../lib/api';
import { BRAND_NAME, pageHost, pageUrl } from '../lib/site';

// A real gateway will return checkoutUrl from the server. Until then, local
// development gets a clearly-labelled journey to review the screens.
const demoPaymentEnabled = import.meta.env.DEV || import.meta.env.VITE_DEMO_PAYMENT === 'true';

type Quote = {
  plans: { plan: Plan; priceSar: number | null; discountPercent: number | null }[];
  designPriceSar: number | null;
  designAvailable: boolean;
  nfcUnitPrice: number | null;
  nfcShippingPrice: number | null;
  domainPriceSar: number | null;
  cart: {
    cart_number: number;
    plan: Plan;
    design_price: number | null;
    nfc_quantity: number;
    nfc_recipient_name: string | null;
    nfc_recipient_phone: string | null;
    nfc_city: string | null;
    nfc_address: string | null;
    total: number;
    discount_code: string | null;
    custom_domain: string | null;
  } | null;
  account: Account;
};

const PLAN_LABELS: Record<Plan, { name: string; period: string }> = {
  monthly: { name: 'اشتراك شهري', period: 'شهريًا' },
  annual: { name: 'اشتراك سنوي', period: 'سنويًا' },
};

const money = (value: number) => `${value.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`;
const fieldClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500';

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[26px] border border-black/[0.045] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.035)] sm:p-6 ${className}`}>
      <h2 className="mb-4 text-base font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// NEW-04: one cart for the plan, «صمّم لي» and NFC pieces, paid together.
// NEW-05: before paying, a summary with the link, its QR code, the Apple
// Wallet card and the total including shipping.
export default function PlanSelection() {
  const navigate = useNavigate();
  // ?design=1: the beneficiary chose «صمّم لي» in the builder.
  const [searchParams] = useSearchParams();
  const { pageData, setAccount, isAuthenticated, loadingPage } = usePageContext();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [plan, setPlan] = useState<Plan>('annual');
  const [design, setDesign] = useState(false);
  const [nfc, setNfc] = useState({ quantity: '0', name: '', phone: '', city: '', address: '' });
  const [qr, setQr] = useState('');
  // DOMAIN-03: the entity's own domain, bought with the plan.
  const [wantsDomain, setWantsDomain] = useState(false);
  const [domain, setDomain] = useState('');
  // PAY-03: the code as typed, and what the server said it is worth.
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<{ value: string; discount: number } | null>(null);
  const [codeNotice, setCodeNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ cartNumber: number; total: number } | null>(null);

  useEffect(() => {
    if (!loadingPage && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loadingPage, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    accountCall<Quote>('cart.quote')
      .then((response) => {
        setQuote(response);
        setAccount(response.account);

        if (searchParams.get('design') === '1' && response.designAvailable && response.designPriceSar !== null) {
          setDesign(true);
        }

        // Reopen the cart that is already waiting for payment.
        if (response.cart) {
          setPlan(response.cart.plan);
          setDesign(response.cart.design_price !== null || searchParams.get('design') === '1');
          setCodeInput(response.cart.discount_code ?? '');
          setWantsDomain(Boolean(response.cart.custom_domain));
          setDomain(response.cart.custom_domain ?? '');
          setNfc({
            quantity: String(response.cart.nfc_quantity),
            name: response.cart.nfc_recipient_name ?? '',
            phone: response.cart.nfc_recipient_phone ?? '',
            city: response.cart.nfc_city ?? '',
            address: response.cart.nfc_address ?? '',
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل السلة.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, setAccount]);

  const username = pageData.username;

  useEffect(() => {
    if (!username) return;

    QRCode.toDataURL(pageUrl(username), { width: 300, margin: 1, errorCorrectionLevel: 'M' }).then(setQr);
  }, [username]);

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        {error ? (
          <p className="text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>{error}</p>
        ) : (
          <div className="h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin"></div>
        )}
      </div>
    );
  }

  const subscription = quote.account.subscription;
  const isActive = subscription?.status === 'active';
  const planInfo = quote.plans.find((item) => item.plan === plan);
  const listPrice = planInfo?.priceSar ?? null;
  // PAY-04: the general discount first, then the code on what remains.
  const generalDiscount = listPrice !== null && planInfo?.discountPercent ? Math.round(listPrice * planInfo.discountPercent) / 100 : 0;
  const planPrice = listPrice === null ? null : Math.max(0, Math.round((listPrice - generalDiscount - (code?.discount ?? 0)) * 100) / 100);

  const applyCode = async (forPlan: Plan = plan) => {
    if (!codeInput.trim()) {
      setCode(null);
      setCodeNotice('');
      return;
    }

    try {
      const { pricing } = await accountCall('cart.checkCode', { plan: forPlan, code: codeInput });
      setCode({ value: pricing.code, discount: pricing.codeDiscount });
      setCodeNotice('');
    } catch (err) {
      setCode(null);
      setCodeNotice(err instanceof Error ? err.message : 'تعذر التحقق من الكود.');
    }
  };

  // A code's worth depends on the plan, so it is checked again on a switch.
  const choosePlan = (next: Plan) => {
    setPlan(next);
    if (code) applyCode(next);
  };
  const quantity = Math.max(0, Math.floor(Number(nfc.quantity) || 0));
  const nfcPriced = quote.nfcUnitPrice !== null && quote.nfcShippingPrice !== null;
  const nfcTotal = quantity > 0 && nfcPriced ? quantity * (quote.nfcUnitPrice as number) + (quote.nfcShippingPrice as number) : 0;
  const wantsDesign = design && quote.designAvailable;
  const domainChosen = wantsDomain && quote.domainPriceSar !== null;
  const domainValid = !domainChosen || /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain);
  const total =
    planPrice === null ? null : planPrice + (wantsDesign ? quote.designPriceSar ?? 0 : 0) + nfcTotal + (domainChosen ? (quote.domainPriceSar as number) : 0);
  const nfcComplete = quantity === 0 || (nfc.name.trim().length > 1 && nfc.phone.length >= 8 && nfc.city.trim().length > 1 && nfc.address.trim().length > 4);
  const pendingCart = submitted ?? (quote.cart ? { cartNumber: quote.cart.cart_number, total: quote.cart.total } : null);
  const setNfcField = (key: keyof typeof nfc) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setNfc({ ...nfc, [key]: event.target.value });

  const handleSubmit = async () => {
    // Design review only: prices have not been entered yet, so there is no
    // cart, charge, subscription activation, or page publishing here.
    if (demoPaymentEnabled && total === null) {
      navigate('/payment/demo?cart=TEST&total=0');
      return;
    }

    try {
      setError('');
      setSubmitting(true);

      const response = await accountCall('cart.submit', {
        plan,
        // A typed code is always sent: the server refuses the cart rather than
        // drop a discount the customer expects.
        code: codeInput,
        domain: domainChosen ? domain : '',
        design: wantsDesign,
        nfcQuantity: quantity,
        nfcRecipientName: nfc.name,
        nfcRecipientPhone: nfc.phone,
        nfcCity: nfc.city,
        nfcAddress: nfc.address,
      });

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }

      setSubmitted({ cartNumber: response.cartNumber, total: response.total });

      if (demoPaymentEnabled) {
        const paymentParams = new URLSearchParams({
          cart: String(response.cartNumber),
          total: String(response.total),
        });
        navigate(`/payment/demo?${paymentParams.toString()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال السلة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="sticky top-0 z-30 border-b border-black/5 bg-[#f5f5f7]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button onClick={() => navigate('/builder')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#4a4a50] shadow-sm ring-1 ring-black/5" title="العودة للمحرر">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-medium text-emerald-700">الخطوة الأخيرة</p>
            <h1 className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>إتمام الطلب</h1>
          </div>
          <div className="flex h-10 items-center rounded-full bg-white px-3 text-xs font-bold text-[#6e6e73] shadow-sm ring-1 ring-black/5">دفع آمن</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 pb-28 sm:p-6 lg:pb-8">
        {isActive ? (
          <Section title="اشتراكك فعّال">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Check className="h-6 w-6 flex-shrink-0 text-emerald-600" />
              {PLAN_LABELS[subscription.plan].name}. «صمّم لي» وقطع NFC تُطلب من تبويب «الحساب» في المحرر.
            </div>
          </Section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,720px)_minmax(320px,360px)] lg:items-start lg:justify-center lg:gap-6">
            <Section title="1. الاشتراك" className="lg:col-start-1">
              <p className="mb-3 text-xs text-gray-500">نفس المزايا ومساحة التخزين في الخيارين.</p>
              <div className="space-y-2">
                {quote.plans.map((item) => (
                  <button
                    key={item.plan}
                    onClick={() => choosePlan(item.plan)}
                    className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-sm transition-all ${
                      plan === item.plan ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {PLAN_LABELS[item.plan].name}
                    </span>
                    <span className="text-gray-700">
                      {item.priceSar === null ? 'يُعلن السعر قريبًا' : `${money(item.priceSar)} ${PLAN_LABELS[item.plan].period}`}
                      {item.priceSar !== null && item.discountPercent && (
                        <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">خصم {item.discountPercent}%</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-gray-600">كود الخصم (إن وُجد)</label>
                <div className="flex gap-2">
                  <input
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value.toUpperCase());
                      setCode(null);
                    }}
                    placeholder="CODE"
                    className={fieldClass}
                    dir="ltr"
                    maxLength={40}
                  />
                  <button
                    onClick={() => applyCode()}
                    disabled={!codeInput.trim() || listPrice === null}
                    className="rounded-lg bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    تطبيق
                  </button>
                </div>
                {code && <p className="mt-1 text-xs font-semibold text-emerald-700">طُبّق الكود: خصم {money(code.discount)} على الاشتراك.</p>}
                {codeNotice && <p className="mt-1 text-xs text-red-600">{codeNotice}</p>}
                <p className="mt-1 text-xs text-gray-400">الكود يُخصم من الاشتراك فقط، ولا يشمل «صمّم لي» ولا قطع NFC.</p>
              </div>
            </Section>

            <Section title="2. خدمة «صمّم لي» (اختياري)" className="lg:col-start-1">
              {quote.designAvailable ? (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={design} onChange={(e) => setDesign(e.target.checked)} disabled={quote.designPriceSar === null} />
                  <span className="text-gray-700">
                    يصمم فريق {BRAND_NAME} صفحتك لمرة واحدة، وتنتهي الخدمة باعتمادك للتصميم.{' '}
                    <b>{quote.designPriceSar === null ? 'السعر يُعلن قريبًا.' : money(quote.designPriceSar)}</b>
                  </span>
                </label>
              ) : (
                <p className="text-sm text-gray-600">لديك طلب «صمّم لي» قائم.</p>
              )}
            </Section>

            <Section title="3. قطع NFC (اختياري)" className="lg:col-start-1">
              <p className="mb-3 text-xs text-gray-500">
                قطعة تفتح صفحتك عند تقريب الجوال منها.{' '}
                {nfcPriced ? `سعر القطعة ${money(quote.nfcUnitPrice as number)} والشحن ${money(quote.nfcShippingPrice as number)}. نتواصل معك قبل الشحن.` : 'السعر يُعلن قريبًا.'}
              </p>
              {nfcPriced && (
                <div className="space-y-2">
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    عدد القطع
                    <input type="number" min={0} value={nfc.quantity} onChange={setNfcField('quantity')} className={`${fieldClass} w-24`} dir="ltr" />
                  </label>
                  {quantity > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={nfc.name} onChange={setNfcField('name')} placeholder="اسم المستلم" className={fieldClass} />
                        <input value={nfc.phone} onChange={(e) => setNfc({ ...nfc, phone: e.target.value.replace(/[^0-9]/g, '') })} placeholder="جوال المستلم" className={fieldClass} dir="ltr" inputMode="numeric" />
                      </div>
                      <input value={nfc.city} onChange={setNfcField('city')} placeholder="المدينة" className={fieldClass} />
                      <textarea value={nfc.address} onChange={setNfcField('address')} placeholder="عنوان الشحن بالتفصيل" rows={2} className={`${fieldClass} resize-none`} />
                    </>
                  )}
                </div>
              )}
            </Section>

            <Section title="4. دومين خاص بجهتك (اختياري)" className="lg:col-start-1">
              <p className="mb-3 text-sm text-gray-700">
                بدل أن يكون رابطك <span dir="ltr" className="font-semibold">{username ? pageHost(username) : 'name.onwan.link'}</span>، تظهر صفحتك على دومين
                جهتك نفسه، مثل <span dir="ltr" className="font-semibold">link.jameia.org</span> — كأن الصفحة جزء من موقعكم الرسمي.
              </p>
              <ul className="mb-3 list-disc space-y-1 pr-5 text-xs text-gray-500">
                <li>تحتاج دومينًا تملكه جهتك (أو نطاقًا فرعيًا من دومين المنظمة). {BRAND_NAME} لا يبيع الدومينات.</li>
                <li>بعد الدفع نعطيك سطرًا واحدًا يضيفه مسؤول التقنية عندكم في إعدادات الدومين، ثم نفعّله.</li>
                <li>رابط {BRAND_NAME} يبقى يعمل معه، فلا تتأثر رموز QR ولا قطع NFC.</li>
              </ul>
              {quote.domainPriceSar === null ? (
                <p className="text-sm text-gray-500">الخدمة تتاح قريبًا.</p>
              ) : (
                <>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input type="checkbox" checked={wantsDomain} onChange={(e) => setWantsDomain(e.target.checked)} />
                    أضف الدومين الخاص — <b>{money(quote.domainPriceSar)}</b>
                  </label>
                  {wantsDomain && (
                    <input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
                      placeholder="link.example.org"
                      className={`${fieldClass} mt-2`}
                      dir="ltr"
                    />
                  )}
                </>
              )}
            </Section>

            <Section title="ملخص الطلب" className="lg:col-start-2 lg:row-start-1 lg:row-span-4 lg:sticky lg:top-[76px]">
              <div className="mb-4 rounded-xl bg-gray-50 p-3 text-sm">
                <div className="text-xs text-gray-500">رابط صفحتك</div>
                <div className="font-bold text-gray-900" dir="ltr" style={{ textAlign: 'right' }}>{username ? pageHost(username) : '—'}</div>
                {!quote.account.nameFixed && (
                  <div className="mt-1 text-xs text-amber-700">محجوز لك مؤقتًا ويُثبَّت بعد الدفع. لتغييره: تبويب «الحساب» في المحرر.</div>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 p-3 text-center">
                  {qr ? <img src={qr} alt="رمز QR لرابط الصفحة" className="mx-auto h-28 w-28" /> : <div className="mx-auto h-28 w-28 animate-pulse rounded bg-gray-100" />}
                  <div className="mt-2 text-xs text-gray-500">رمز QR للطباعة</div>
                </div>
                {/* A preview of the card only: issuing real Wallet passes is not built yet. */}
                <div className="flex flex-col justify-between rounded-xl bg-gray-900 p-3 text-white">
                  <div>
                    <div className="text-[10px] opacity-60">Apple Wallet</div>
                    <div className="mt-1 text-sm font-bold leading-tight" style={{ fontFamily: 'Cairo, sans-serif' }}>{pageData.name || 'اسم الجهة'}</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-[10px] opacity-70" dir="ltr">{username ? pageHost(username) : ''}</div>
                    {qr && <img src={qr} alt="" className="h-12 w-12 rounded bg-white p-0.5" />}
                  </div>
                </div>
              </div>
              <p className="mb-4 text-xs text-gray-500">معاينة البطاقة الرقمية. إصدارها إلى Apple Wallet سيتاح قريبًا.</p>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">{PLAN_LABELS[plan].name}</dt>
                  <dd className="font-semibold">{listPrice === null ? 'يُعلن قريبًا' : money(listPrice)}</dd>
                </div>
                {generalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>خصم {planInfo?.discountPercent}%</dt>
                    <dd className="font-semibold">− {money(generalDiscount)}</dd>
                  </div>
                )}
                {code && code.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>كود {code.value}</dt>
                    <dd className="font-semibold">− {money(code.discount)}</dd>
                  </div>
                )}
                {wantsDesign && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">«صمّم لي»</dt>
                    <dd className="font-semibold">{money(quote.designPriceSar as number)}</dd>
                  </div>
                )}
                {quantity > 0 && nfcPriced && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">قطع NFC × {quantity}</dt>
                      <dd className="font-semibold">{money(quantity * (quote.nfcUnitPrice as number))}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">الشحن</dt>
                      <dd className="font-semibold">{money(quote.nfcShippingPrice as number)}</dd>
                    </div>
                  </>
                )}
                {domainChosen && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">
                      دومين خاص <span dir="ltr">{domain}</span>
                    </dt>
                    <dd className="font-semibold">{money(quote.domainPriceSar as number)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                  <dt className="font-bold text-gray-900">الإجمالي شامل الشحن</dt>
                  <dd className="font-black text-gray-900">{total === null ? '—' : money(total)}</dd>
                </div>
              </dl>

              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              {pendingCart && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <Clock className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span>
                    السلة #{pendingCart.cartNumber} مسجّلة بإجمالي {money(pendingCart.total)} وبانتظار الدفع. الدفع الإلكتروني غير مفعّل بعد؛ سيتواصل
                    معك الفريق لإتمام السداد، وبعد تأكيده يُثبَّت اسمك وتُنشر صفحتك. يمكنك تعديل السلة وإرسالها من جديد.
                  </span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || (!demoPaymentEnabled && (total === null || !nfcComplete || !domainValid))}
                className="mt-4 hidden w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition-all hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 lg:block"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {submitting
                  ? 'لحظات...'
                  : pendingCart
                    ? 'تحديث السلة'
                    : demoPaymentEnabled
                      ? 'المتابعة إلى الدفع التجريبي'
                      : 'المتابعة إلى الدفع'}
              </button>
              {demoPaymentEnabled && total === null ? (
                <p className="mt-2 hidden text-center text-xs text-amber-700 lg:block">وضع اختبار: يمكنك فتح رحلة الدفع قبل إدخال الأسعار.</p>
              ) : (
                <p className="mt-2 hidden text-center text-xs text-gray-400 lg:block">الدفع بالريال السعودي، دفعة واحدة لكل ما في السلة.</p>
              )}
            </Section>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 py-3 shadow-[0_-8px_28px_rgba(0,0,0,0.1)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#6e6e73]">الإجمالي</p>
              <p className="truncate text-base font-black text-[#1d1d1f]" dir="ltr">{total === null ? '—' : money(total)}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || (!demoPaymentEnabled && (total === null || !nfcComplete || !domainValid))}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-all disabled:opacity-50"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {submitting ? 'لحظات...' : pendingCart ? 'تحديث السلة' : demoPaymentEnabled ? 'الدفع التجريبي' : 'المتابعة للدفع'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
