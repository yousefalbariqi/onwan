import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, Copy, Palette, UserRound } from 'lucide-react';
import { PartnerAccount, partnerCall } from './partnerApi';
import { checkUsername } from '../lib/api';
import { BRAND_NAME, ROOT_DOMAIN, USERNAME_PATTERN } from '../lib/site';

// Note 57: «بيع جديد» as one checkout-like page — the customer, the plan, how
// the page is delivered, a summary, one button. «بدون تصميم» sends the offer at
// once; «مع تصميم» saves a draft and opens the editor, and the offer is sent
// after review. The customer only ever gets a preview-and-buy link.
export default function PartnerSale() {
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerAccount | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ orderNumber: number; payLink: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', username: '', plan: 'annual' as 'annual' | 'monthly', design: false, terms: false });

  useEffect(() => {
    partnerCall<{ partner: PartnerAccount }>('me')
      .then((response) => { if (response.partner.status !== 'active') throw new Error('حساب الشريك غير متاح للبيع حاليًا.'); setPartner(response.partner); })
      .catch((err) => setError(err instanceof Error ? err.message : 'سجّل دخولك إلى بوابة الشركاء أولًا.'));
  }, []);

  const floor = partner ? (form.plan === 'annual' ? partner.priceAnnual : partner.priceMonthly) : null;
  const preset = partner ? (form.plan === 'annual' ? partner.saleAnnual : partner.saleMonthly) : null;
  // Note 65: the price is the one saved in «إعدادات التسعير» (test mode: the floor).
  const price = preset ?? (partner?.testMode ? floor : null);
  // Note 66: is the customer's link free? Checked as it is typed (the server checks again when booking).
  const [linkState, setLinkState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [linkReason, setLinkReason] = useState('');
  useEffect(() => {
    const name = form.username;
    if (!name) { setLinkState('idle'); return; }
    if (!USERNAME_PATTERN.test(name)) { setLinkState('invalid'); return; }
    setLinkState('checking');
    let current = true;
    const timer = window.setTimeout(() => {
      checkUsername(name)
        .then((result) => { if (!current) return; setLinkState(result.available ? 'available' : 'taken'); setLinkReason(result.reason ?? ''); })
        .catch(() => { if (current) setLinkState('idle'); });
    }, 400);
    return () => { current = false; window.clearTimeout(timer); };
  }, [form.username]);
  // Note 61: the partner's own design fee (0 = free), only with design.
  // Owner decision: the design fee is fixed at 39 SAR (server: PARTNER_DESIGN_PRICE_SAR).
  const designPrice = form.design ? 39 : 0;
  const total = price === null ? null : price + designPrice;
  // What still keeps the button off, said plainly (note 57).
  const missing = [
    form.name.trim().length > 1 ? '' : 'اسم العميل',
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : 'بريد صحيح',
    form.phone.length >= 9 ? '' : 'رقم الجوال',
    linkState === 'available' ? '' : 'رابط صفحة متاح',
    floor === null ? 'سعرك من الإدارة لهذا الاشتراك' : price === null ? 'سعر الاشتراك في «إعدادات التسعير»' : '',
    form.terms ? '' : 'إقرارك بشروط البيع',
  ].filter(Boolean);
  const valid = missing.length === 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await partnerCall<any>('orders.start', {
        customerName: form.name.trim(), customerEmail: form.email, customerPhone: form.phone, username: form.username,
        plan: form.plan, termsAccepted: form.terms, withDesign: form.design,
      });
      if (form.design) navigate(`/partner/edit/${response.id}`);
      else setSent(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الطلب.');
    } finally {
      setBusy(false);
    }
  };

  const row = 'flex min-h-[52px] items-center gap-3 px-4';
  const input = 'min-w-0 flex-1 bg-transparent py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f2f7] p-5" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="w-full max-w-[400px] space-y-5 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759] text-white"><Check className="h-8 w-8" strokeWidth={3} /></span>
          <h1 className="text-[26px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>أُرسل العرض #{sent.orderNumber}</h1>
          <p className="text-[15px] leading-7 text-[#6e6e73]">{sent.emailed ? 'وصل العميلَ بريدٌ فيه رابط آمن لمعاينة طلبه وإتمام الشراء.' : partner?.testMode ? 'وضع الاختبار: لم يُرسل أي بريد. افتح رابط العميل لتجربة المعاينة والدفع.' : 'حُفظ الطلب، لكن تعذر إرسال البريد. شارك الرابط مع العميل.'}</p>
          <a href={sent.payLink} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white">فتح رابط الطلب</a>
          <button onClick={() => { void navigator.clipboard.writeText(sent.payLink).then(() => setCopied(true)); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-[#0a84ff]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'تم النسخ' : 'نسخ رابط العميل'}</button>
          <Link to="/partner" className="block text-[15px] text-[#0a84ff]">العودة إلى الطلبات</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f2f7]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="sticky top-0 z-10 border-b border-black/5 bg-[#f2f2f7]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center justify-between">
          <Link to="/partner" className="flex items-center gap-1 text-[15px] text-[#0a84ff]"><ArrowRight className="h-4 w-4" />الطلبات</Link>
          <h1 className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>بيع جديد</h1>
          <span className="w-16" />
        </div>
      </div>

      <div className="mx-auto max-w-[480px] space-y-6 px-4 pb-12 pt-5">
        {partner?.testMode && <p className="rounded-xl bg-[#ff9500]/12 px-4 py-2.5 text-center text-[13px] font-bold text-[#9a5b00]">وضع الاختبار — لا يُرسل بريد لأي عميل، والدفع تجريبي بلا مبالغ حقيقية.</p>}
        <section>
          <p className="mb-1.5 px-4 text-[13px] font-bold text-[#6e6e73]">العميل</p>
          <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
            <label className={row}><span className="w-16 shrink-0 text-[15px]">الاسم</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم العميل أو المنشأة" className={input} /></label>
            <label className={row}><span className="w-16 shrink-0 text-[15px]">البريد</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} placeholder="name@example.com" className={input} dir="ltr" style={{ textAlign: 'right' }} /></label>
            <label className={row}><span className="w-16 shrink-0 text-[15px]">الجوال</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} placeholder="05XXXXXXXX" inputMode="tel" className={input} dir="ltr" style={{ textAlign: 'right' }} /></label>
            <label className={row}><span className="w-16 shrink-0 text-[15px]">الرابط</span><span className="flex min-w-0 flex-1 items-center" dir="ltr"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="name" aria-describedby="link-state" className={input} /><span className="shrink-0 text-[15px] text-[#8e8e93]">.{ROOT_DOMAIN}</span></span></label>
          </div>
        </section>

        <p id="link-state" className="-mt-4 px-4 text-[13px] leading-6" aria-live="polite">
          {linkState === 'idle' && <span className="text-[#8e8e93]">اختر رابطًا مميزًا لصفحة عميلك، يمكنه مشاركته مع الآخرين بسهولة.</span>}
          {linkState === 'checking' && <span className="text-[#8e8e93]">جارٍ التحقق… <span dir="ltr">{form.username}.{ROOT_DOMAIN}</span></span>}
          {linkState === 'available' && <span className="text-[#1f7a35]">✓ الرابط متاح: <span dir="ltr">{form.username}.{ROOT_DOMAIN}</span></span>}
          {linkState === 'taken' && <span className="text-[#ff3b30]">{linkReason || 'الرابط مستخدم بالفعل'}</span>}
          {linkState === 'invalid' && <span className="text-[#ff3b30]">أحرف إنجليزية صغيرة وأرقام وشرطة (-) فقط، بلا مسافات.</span>}
        </p>

        <section>
          <p className="mb-1.5 px-4 text-[13px] font-bold text-[#6e6e73]">الاشتراك</p>
          <div className="grid grid-cols-2 gap-3">
            {(['annual', 'monthly'] as const).map((plan) => {
              const active = form.plan === plan;
              const planPrice = partner ? (plan === 'annual' ? partner.saleAnnual : partner.saleMonthly) ?? (partner.testMode ? (plan === 'annual' ? partner.priceAnnual : partner.priceMonthly) : null) : null;
              return (
                <button key={plan} type="button" onClick={() => setForm({ ...form, plan })} aria-pressed={active} className={`rounded-2xl bg-white p-4 text-right ${active ? 'shadow-[0_0_0_2px_#0a84ff]' : ''}`}>
                  <span className="block text-[15px] font-bold text-[#1d1d1f]">{plan === 'annual' ? 'سنوي' : 'شهري'}</span>
                  <span className="block text-xs text-[#8e8e93]">{planPrice === null ? 'لم تحدد سعره بعد' : `${planPrice} ريال`}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 px-4 text-[13px] text-[#8e8e93]">السعر من <Link to="/partner" className="font-bold text-[#0a84ff]">إعدادات التسعير</Link>{price === null ? ' — حدده أولًا.' : '.'}</p>
        </section>

        <section>
          <p className="mb-1.5 px-4 text-[13px] font-bold text-[#6e6e73]">تقديم الصفحة</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ design: false, Icon: UserRound, title: 'بدون تصميم', text: 'أرسل الطلب لعميلك، وعليه مراجعة التفاصيل والدفع فقط. بعدها يصمم صفحته بنفسه.' }, { design: true, Icon: Palette, title: 'مع تصميم', text: 'صمّم الصفحة لعميلك أولًا، ثم أرسلها له للمعاينة والموافقة والدفع. تكلفة التصميم 39 ريال.' }].map(({ design, Icon, title, text }) => {
              const active = form.design === design;
              return (
                <button key={title} type="button" onClick={() => setForm({ ...form, design })} aria-pressed={active} className={`rounded-2xl bg-white p-4 text-right ${active ? 'shadow-[0_0_0_2px_#0a84ff]' : ''}`}>
                  <Icon className={`h-6 w-6 ${active ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`} />
                  <span className="mt-2 block text-[15px] font-bold text-[#1d1d1f]">{title}</span>
                  <span className="block text-xs leading-5 text-[#8e8e93]">{text}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4">
          <p className="text-[15px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>ملخص الطلب</p>
          <dl className="mt-2 space-y-1.5 text-[15px]">
            <div className="flex justify-between"><dt className="text-[#6e6e73]">اشتراك {form.plan === 'annual' ? 'سنوي' : 'شهري'}</dt><dd className="font-bold">{price ?? '—'} ريال</dd></div>
            {form.design && <div className="flex justify-between"><dt className="text-[#6e6e73]">التصميم</dt><dd className="font-bold">{`${designPrice} ريال`}</dd></div>}
            <div className="flex justify-between border-t border-[#f2f2f7] pt-1.5"><dt className="font-black">الإجمالي على العميل</dt><dd className="font-black">{total ?? '—'} ريال</dd></div>
          </dl>
          <label className="mt-3 flex items-start gap-2 border-t border-[#f2f2f7] pt-3 text-[13px] leading-6 text-[#3a3a3c]">
            <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} className="mt-1 h-4 w-4 accent-[#0a84ff]" />
            {/* Note 62: the partner's own acknowledgement, recorded with the order. */}
            أقرّ بأنني أوضحت للعميل تفاصيل الخدمة وسعرها وشروط البيع، وأتحمل مسؤولية صحة المعلومات والالتزامات التي أقدمها له، مع الالتزام بسياسات منصة {BRAND_NAME}. وتنتقل ملكية الصفحة وإدارتها للعميل بعد الدفع.
          </label>
        </section>

        {error && <p role="alert" className="rounded-xl bg-[#ff3b30]/10 px-4 py-2.5 text-sm text-[#c4251c]">{error}</p>}
        {!valid && partner && <p className="px-1 text-center text-[13px] text-[#8e8e93]">لإكمال الطلب: {missing.join('، ')}.</p>}

        <button type="button" onClick={submit} disabled={!valid || busy} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] disabled:bg-[#c7c7cc] disabled:shadow-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {busy ? 'لحظات…' : form.design ? 'المتابعة إلى التصميم' : 'إرسال العرض للعميل'}
        </button>
        <p className="text-center text-xs text-[#8e8e93]">يصل العميل رابط لمعاينة طلبه وشرائه فقط؛ لا يُرسل له أي رابط تعديل. العملية مسجّلة باسمك في {BRAND_NAME}.</p>
      </div>
    </main>
  );
}
