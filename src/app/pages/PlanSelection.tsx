import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Check, ChevronDown, Clock, Globe, Minus, Nfc, Plus, Sparkles } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { Account, Plan, accountCall } from '../lib/api';
import { BRAND_NAME, pageHost } from '../lib/site';

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
  demoPrices?: boolean;
  partnerOffer?: { shopName: string } | null;
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
const fieldClass = 'block w-full bg-transparent px-4 py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#8e8e93] focus:outline-none';

const NFC_DEMO_VIDEO = '/media/nfc-demo.mp4';

// An add-on in the Apple manner: an icon, a friendly question, what it gives,
// the price, and one «إضافة» that becomes «مُضاف».
function AddOn({ icon: Icon, tone, title, children, price, added, onToggle, disabled, action }: { icon: typeof Sparkles; tone: string; title: string; children: React.ReactNode; price: React.ReactNode; added: boolean; onToggle: () => void; disabled?: boolean; action?: string }) {
  return (
    <section className={`rounded-[26px] bg-white p-5 transition-shadow sm:p-6 ${added ? 'shadow-[0_0_0_2px_#34c759,0_8px_24px_rgba(52,199,89,0.12)]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.05)]'}`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${tone}`}><Icon className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-black leading-snug text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{title}</h2>
          <div className="mt-1.5 text-[15px] leading-7 text-[#6e6e73]">{children}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#f2f2f7] pt-4">
        <span className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{price}</span>
        <button type="button" onClick={onToggle} disabled={disabled} aria-pressed={added} className={`flex min-h-10 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold transition-colors disabled:opacity-40 ${added ? 'bg-[#34c759] text-white' : 'bg-[#0a84ff]/10 text-[#0a84ff]'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
          {added ? <><Check className="h-4 w-4" strokeWidth={3} />مُضاف</> : action ?? 'إضافة'}
        </button>
      </div>
    </section>
  );
}

// The NFC explainer video; until the file exists, a small animation shows the idea.
function NfcVideo() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3c]">
      {!failed && <video src={NFC_DEMO_VIDEO} muted loop autoPlay playsInline controls={false} preload="metadata" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" aria-label="فيديو توضيحي لقطعة NFC" />}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center gap-6" aria-label="جوال يقترب من قطعة NFC فتفتح الصفحة">
          <span className="h-16 w-16 rounded-2xl bg-white/90 shadow-lg" />
          <span className="h-24 w-12 animate-[nfc-tap_2.4s_ease-in-out_infinite] rounded-[14px] border-2 border-white/80 bg-white/10" />
          <style>{'@keyframes nfc-tap{0%,100%{transform:translateX(-28px)}45%,60%{transform:translateX(18px)}}'}</style>
        </div>
      )}
    </div>
  );
}

// NEW-04: one cart for the plan, «صمّم لي» and NFC pieces, paid together.
// NEW-05: before paying, a summary with the link and the total including
// shipping (note 48: the QR code and the Wallet preview left this card).
export default function PlanSelection() {
  const navigate = useNavigate();
  // ?design=1: the beneficiary chose «صمّم لي» in the builder.
  const [searchParams] = useSearchParams();
  const { pageData, setAccount, isAuthenticated, loadingPage } = usePageContext();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [plan, setPlan] = useState<Plan>('annual');
  const [design, setDesign] = useState(false);
  const [nfc, setNfc] = useState({ quantity: '0', name: '', phone: '', city: '', address: '' });
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

        if (!response.cart) {
          const available = response.plans.find(item => item.priceSar !== null);
          if (available) setPlan(available.plan);
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
    // With no prices yet, the server creates a zero-value test cart on confirmation.
    if (demoPaymentEnabled && !quote.partnerOffer && total === null) {
      navigate(`/payment/demo?cart=TEST&total=0&plan=${plan}`);
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
          <section className="mx-auto max-w-md rounded-[26px] bg-white p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#34c759] text-white"><Check className="h-6 w-6" strokeWidth={3} /></span>
            <h2 className="mt-3 text-xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>اشتراكك فعّال</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">{PLAN_LABELS[subscription.plan].name}. «صمّم لي» وقطع NFC تُطلب من «الإعدادات» في المحرر.</p>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,640px)_minmax(320px,360px)] lg:items-start lg:justify-center lg:gap-8">
            <div className="space-y-5">
              {quote.partnerOffer && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">أسعار خاصة عبر {quote.partnerOffer.shopName} · تُنسب أول عملية شراء لهذا الشريك.</p>}
              {quote.demoPrices && <p className="rounded-xl bg-[#ff9500]/12 px-4 py-2.5 text-center text-[13px] font-bold text-[#9a5b00]">سعر تجريبي — الأسعار هنا للتجربة فقط وليست نهائية.</p>}

              {/* Note 43: two choices only. */}
              <section>
                <h2 className="mb-3 px-1 text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختر اشتراكك</h2>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="الاشتراك">
                  {quote.plans.map((item) => {
                    const active = plan === item.plan;
                    return (
                      <button key={item.plan} type="button" role="radio" aria-checked={active} onClick={() => choosePlan(item.plan)} className={`relative rounded-[22px] bg-white p-4 text-right transition-shadow sm:p-5 ${active ? 'shadow-[0_0_0_2px_#0a84ff]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.05)]'}`}>
                        <span className={`absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-[#0a84ff] text-white' : 'border-2 border-[#d1d1d6]'}`}>{active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                        {/* Owner decision (25 Oct 2026): the annual plan is the recommended one. */}
                        {item.plan === 'annual' && <span className="mb-1 inline-block rounded-full bg-[#34c759] px-2 py-0.5 text-[11px] font-bold text-white">الأفضل للعميل</span>}
                        <span className="block text-[15px] font-bold text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{PLAN_LABELS[item.plan].name}</span>
                        <span className="mt-2 block text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{item.priceSar === null ? '—' : money(item.priceSar)}</span>
                        <span className="block text-xs text-[#8e8e93]">{item.priceSar === null ? 'يُعلن قريبًا' : PLAN_LABELS[item.plan].period}</span>
                        {item.priceSar !== null && item.discountPercent ? <span className="mt-2 inline-block rounded-full bg-[#34c759]/12 px-2 py-0.5 text-xs font-bold text-[#1f7a35]">خصم {item.discountPercent}%</span> : null}
                      </button>
                    );
                  })}
                </div>

                {/* Note 44: a small, quiet line — text, box, «تطبيق». */}
                <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-[13px]">
                  <span className="text-[#8e8e93]">كود خصم؟</span>
                  <input value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCode(null); setCodeNotice(''); }} placeholder="CODE" aria-label="كود الخصم" dir="ltr" maxLength={40} className="h-8 w-28 rounded-lg bg-white px-2 text-center text-[13px] text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] placeholder:text-[#c7c7cc] focus:outline-none focus:shadow-[0_0_0_2px_#0a84ff]" />
                  <button type="button" onClick={() => applyCode()} disabled={!codeInput.trim() || listPrice === null} className="font-bold text-[#0a84ff] disabled:text-[#c7c7cc]">تطبيق</button>
                  {code && <span className="font-bold text-[#1f7a35]">✓ خصم {money(code.discount)}</span>}
                  {codeNotice && <span className="w-full text-[#ff3b30]">{codeNotice}</span>}
                </div>
              </section>

              <h2 className="px-1 pt-2 text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>أضف لصفحتك <span className="text-[15px] font-bold text-[#8e8e93]">(اختياري)</span></h2>

              {/* Note 45 */}
              {quote.designAvailable ? (
                <AddOn icon={Sparkles} tone="bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400" title="وش رأيك نخلي فريقنا يصمم صفحتك؟" price={quote.designPriceSar === null ? 'يُعلن قريبًا' : money(quote.designPriceSar)} added={design} onToggle={() => setDesign(!design)} disabled={quote.designPriceSar === null}>
                  فريق {BRAND_NAME} يصمم صفحتك لك بالأدوات نفسها التي بين يديك، ويبقى على تواصل معك ويعدّل حتى توصل لشكل يعجبك.
                </AddOn>
              ) : (
                <p className="rounded-2xl bg-white px-5 py-4 text-sm text-[#6e6e73]">لديك طلب «صمّم لي» قائم، وفريقنا على تواصل معك.</p>
              )}

              {/* Note 46: the idea, the video, then the choice. */}
              <AddOn
                icon={Nfc}
                tone="bg-[#1d1d1f]"
                title="شارك صفحتك بلمسة"
                price={nfcPriced ? <>{money(quote.nfcUnitPrice as number)} <span className="text-xs font-bold text-[#8e8e93]">للقطعة</span></> : 'يُعلن قريبًا'}
                added={quantity > 0}
                disabled={!nfcPriced}
                action="أضف قطعة"
                onToggle={() => setNfc({ ...nfc, quantity: quantity > 0 ? '0' : '1' })}
              >
                قطعة أنيقة تفتح صفحتك بمجرد أن يقرّب أحدهم جواله منها — بلا تطبيق ولا كتابة رابط. حل عصري للمشاركة السريعة في مكتبك أو معرضك أو على بطاقتك.
                <NfcVideo />
                {quantity > 0 && nfcPriced && (
                  <div className="mt-4 space-y-3 text-[#1d1d1f]">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px]">عدد القطع</span>
                      <div className="flex items-center rounded-full bg-[#f2f2f7] p-1" dir="ltr">
                        <button type="button" onClick={() => setNfc({ ...nfc, quantity: String(Math.max(0, quantity - 1)) })} aria-label="أقل" className="flex h-8 w-8 items-center justify-center rounded-full active:bg-white"><Minus className="h-4 w-4" /></button>
                        <span className="w-8 text-center font-bold">{quantity}</span>
                        <button type="button" onClick={() => setNfc({ ...nfc, quantity: String(quantity + 1) })} aria-label="أكثر" className="flex h-8 w-8 items-center justify-center rounded-full active:bg-white"><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-[#f2f2f7]">
                      <input value={nfc.name} onChange={setNfcField('name')} placeholder="اسم المستلم" className={fieldClass} />
                      <input value={nfc.phone} onChange={(e) => setNfc({ ...nfc, phone: e.target.value.replace(/[^0-9]/g, '') })} placeholder="جوال المستلم" className={fieldClass} dir="ltr" inputMode="numeric" style={{ textAlign: 'right' }} />
                      <input value={nfc.city} onChange={setNfcField('city')} placeholder="المدينة" className={fieldClass} />
                      <textarea value={nfc.address} onChange={setNfcField('address')} placeholder="عنوان الشحن بالتفصيل" rows={2} className={`${fieldClass} resize-none`} />
                    </div>
                    <p className="text-xs text-[#8e8e93]">الشحن {money(quote.nfcShippingPrice as number)}، ونتواصل معك قبل الشحن.</p>
                  </div>
                )}
              </AddOn>

              {/* Note 47 */}
              <AddOn
                icon={Globe}
                tone="bg-[#0a84ff]"
                title="رابط باسمك أنت"
                price={quote.domainPriceSar === null ? 'يُعلن قريبًا' : money(quote.domainPriceSar)}
                added={wantsDomain}
                disabled={quote.domainPriceSar === null}
                action="نعم، أريدها"
                onToggle={() => setWantsDomain(!wantsDomain)}
              >
                بدل ما يكون رابط صفحتك باسم عام، خلّه باسمك أو باسم مؤسستك — أكثر رسمية وأكثر ثقة عند من يزورك. هل تريد هذه الخدمة؟
                {wantsDomain && (
                  <div className="mt-4 space-y-2">
                    <input value={domain} onChange={(e) => setDomain(e.target.value.trim().toLowerCase())} placeholder="link.example.org" aria-label="الدومين" dir="ltr" className="h-11 w-full rounded-xl bg-[#f2f2f7] px-3 text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]" />
                    <details className="text-[13px] text-[#6e6e73]">
                      <summary className="flex cursor-pointer list-none items-center gap-1 font-bold text-[#0a84ff]">كيف يعمل؟<ChevronDown className="h-3.5 w-3.5" /></summary>
                      <ul className="mt-2 list-disc space-y-1 pr-5 leading-6">
                        <li>تحتاج دومينًا تملكه جهتك أو نطاقًا فرعيًا منه؛ {BRAND_NAME} لا يبيع الدومينات.</li>
                        <li>بعد الدفع نعطيك سطرًا واحدًا يضيفه مسؤول التقنية عندكم، ثم نفعّله.</li>
                        <li>رابط {BRAND_NAME} الحالي يبقى يعمل، فلا تتأثر رموز QR ولا قطع NFC.</li>
                      </ul>
                    </details>
                  </div>
                )}
              </AddOn>
            </div>

            {/* Note 48: the summary keeps the link and the numbers, nothing else. */}
            <aside className="rounded-[26px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-6 lg:sticky lg:top-[76px]">
              <h2 className="text-[19px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>ملخص الطلب</h2>
              <div className="mt-3 rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="text-xs text-[#8e8e93]">رابط صفحتك</p>
                <p className="truncate text-[15px] font-bold text-[#1d1d1f]" dir="ltr" style={{ textAlign: 'right' }}>{username ? pageHost(username) : '—'}</p>
                {!quote.account.nameFixed && <p className="mt-1 text-xs text-[#9a5b00]">محجوز لك ويُثبَّت بعد الدفع.</p>}
              </div>

              <dl className="mt-4 space-y-2.5 text-[15px]">
                <div className="flex justify-between gap-3"><dt className="text-[#6e6e73]">{PLAN_LABELS[plan].name}</dt><dd className="font-bold">{listPrice === null ? '—' : money(listPrice)}</dd></div>
                {generalDiscount > 0 && <div className="flex justify-between gap-3 text-[#1f7a35]"><dt>خصم {planInfo?.discountPercent}%</dt><dd className="font-bold">− {money(generalDiscount)}</dd></div>}
                {code && code.discount > 0 && <div className="flex justify-between gap-3 text-[#1f7a35]"><dt>كود {code.value}</dt><dd className="font-bold">− {money(code.discount)}</dd></div>}
                {wantsDesign && <div className="flex justify-between gap-3"><dt className="text-[#6e6e73]">صمّم لي</dt><dd className="font-bold">{money(quote.designPriceSar as number)}</dd></div>}
                {quantity > 0 && nfcPriced && (
                  <>
                    <div className="flex justify-between gap-3"><dt className="text-[#6e6e73]">قطع NFC × {quantity}</dt><dd className="font-bold">{money(quantity * (quote.nfcUnitPrice as number))}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-[#6e6e73]">الشحن</dt><dd className="font-bold">{money(quote.nfcShippingPrice as number)}</dd></div>
                  </>
                )}
                {domainChosen && <div className="flex justify-between gap-3"><dt className="min-w-0 truncate text-[#6e6e73]">رابط باسمك</dt><dd className="font-bold">{money(quote.domainPriceSar as number)}</dd></div>}
                <div className="flex justify-between gap-3 border-t border-[#e5e5ea] pt-3 text-[17px]"><dt className="font-black">الإجمالي</dt><dd className="font-black">{total === null ? '—' : money(total)}</dd></div>
              </dl>

              {error && <p role="alert" className="mt-4 rounded-xl bg-[#ff3b30]/10 px-3 py-2.5 text-sm text-[#c4251c]">{error}</p>}
              {pendingCart && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#ff9500]/12 px-3 py-2.5 text-[13px] leading-6 text-[#9a5b00]">
                  <Clock className="mt-1 h-4 w-4 shrink-0" />
                  السلة #{pendingCart.cartNumber} بإجمالي {money(pendingCart.total)} بانتظار الدفع. يمكنك تعديلها وإرسالها من جديد.
                </p>
              )}

              <button onClick={handleSubmit} disabled={submitting || (!demoPaymentEnabled && (total === null || !nfcComplete || !domainValid))} className="mt-5 hidden min-h-[52px] w-full rounded-2xl bg-[#34c759] text-[17px] font-bold text-white shadow-[0_6px_16px_rgba(52,199,89,0.3)] transition-transform active:scale-[0.98] disabled:opacity-50 lg:block" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {submitting ? 'لحظات…' : pendingCart ? 'تحديث السلة' : demoPaymentEnabled ? 'المتابعة إلى الدفع التجريبي' : 'المتابعة إلى الدفع'}
              </button>
              <p className="mt-2 hidden text-center text-xs text-[#8e8e93] lg:block">دفعة واحدة بالريال السعودي لكل ما في السلة.</p>
            </aside>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(0,0,0,0.1)] backdrop-blur lg:hidden">
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
