import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageProvider, PageSource, mergeWithDefaults, usePageContext } from '../context/PageContext';
import Builder from '../pages/Builder';
import { PartnerAccount, partnerCall, getPartnerToken } from './partnerApi';
import { ROOT_DOMAIN, USERNAME_PATTERN } from '../lib/site';
import { Button, ErrorNote, Field, inputClass } from '../admin/ui';

function OrderFlow({ partner, orderId, draftKey }: { partner: PartnerAccount; orderId?: string; draftKey: string }) {
  const navigate = useNavigate();
  const { pageData, save } = usePageContext();
  const [checkout, setCheckout] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', username: '', plan: 'annual', price: '', terms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ orderNumber: number; emailed: boolean; payLink: string } | null>(null);
  // Note 57: an order made with «مع تصميم» is a draft until it is reviewed and sent.
  const [meta, setMeta] = useState<{ status: string; customerName: string; customerEmail: string; username: string; plan: 'monthly' | 'annual'; salePrice: number; partnerPrice: number; designPrice: number } | null>(null);
  useEffect(() => { if (orderId) partnerCall('orders.getDraft', { id: orderId }).then((r) => setMeta(r.order ?? null)).catch(() => undefined); }, [orderId]);
  const isDraft = meta?.status === 'draft';
  async function sendOffer() {
    if (busy || !orderId) return;
    setBusy(true); setError('');
    try {
      await save();
      await partnerCall('orders.markReady', { id: orderId });
      setCreated(await partnerCall('orders.send', { id: orderId }));
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال العرض.'); }
    finally { setBusy(false); }
  }
  const floor = form.plan === 'annual' ? partner.priceAnnual : partner.priceMonthly;
  const value = form.price === '' ? (form.plan === 'annual' ? partner.saleAnnual : partner.saleMonthly) ?? floor : Number(form.price);
  async function send() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await save();
      const response = await partnerCall('orders.create', { customerName: pageData.name, customerEmail: form.email, customerPhone: form.phone,
        username: form.username.trim().toLowerCase(), plan: form.plan, salePrice: value, termsAccepted: form.terms, pageData });
      setCreated(response);
      sessionStorage.removeItem(draftKey);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال الطلب.'); }
    finally { setBusy(false); }
  }
  return <>
    <Builder staffEdit={{ title: 'تجهيز صفحة العميل', onExit: () => navigate('/partner'), onContinue: () => { if (isDraft) void save().then(() => partnerCall('orders.markReady', { id: orderId })).catch(() => undefined); setCheckout(true); }, continueLabel: isDraft ? 'جاهز للمراجعة' : orderId ? 'إنهاء التعديل' : 'إرسال للعميل' }} />
    {checkout && isDraft && meta && (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <section className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#f2f2f7] px-5 pb-7 pt-5 sm:rounded-[28px]">
          {created ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759] text-2xl text-white">✓</span>
              <h1 className="text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>أُرسل العرض #{created.orderNumber}</h1>
              <p className="text-[15px] leading-7 text-[#6e6e73]">{created.emailed ? 'وصل العميلَ رابط آمن يعاين فيه تصميمه ثم يشتري.' : 'حُفظ الطلب، لكن تعذر إرسال البريد. شارك الرابط أدناه.'}</p>
              <input readOnly value={created.payLink} className={inputClass} dir="ltr" onFocus={(e) => e.target.select()} />
              {partner.testMode && <a href={created.payLink} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#34c759] text-[17px] font-bold text-white">فتح رابط العميل (تجربة)</a>}
              <button onClick={() => navigate('/partner')} className="min-h-[52px] w-full rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white">العودة إلى الطلبات</button>
            </div>
          ) : (
            <div className="space-y-4">
              <h1 className="text-center text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>مراجعة العرض</h1>
              <dl className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white text-[15px]">
                {[
                  ['العميل', meta.customerName],
                  ['البريد', <span dir="ltr">{meta.customerEmail}</span>],
                  ['رابط الصفحة', <span dir="ltr">{meta.username}.{ROOT_DOMAIN}</span>],
                  ['الباقة', meta.plan === 'annual' ? 'سنوي' : 'شهري'],
                  ['الاشتراك', `${meta.salePrice} ريال`],
                  ['التصميم', meta.designPrice ? `${meta.designPrice} ريال` : 'مجانًا'],
                  ['الإجمالي', `${meta.salePrice + meta.designPrice} ريال`],
                ].map(([label, value]) => <div key={String(label)} className="flex min-h-[48px] items-center justify-between gap-3 px-4"><dt className="text-[#6e6e73]">{label}</dt><dd className="truncate font-bold text-[#1d1d1f]">{value}</dd></div>)}
              </dl>
              <p className="px-1 text-[13px] leading-6 text-[#8e8e93]">يصل العميل رابط يرى فيه صفحته كما ستظهر، فيوافق ويدفع أو يطلب تعديلًا. لا يُرسل له أي رابط تعديل.</p>
              <ErrorNote message={error} />
              <button disabled={busy} onClick={sendOffer} className="min-h-[52px] w-full rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] disabled:opacity-50" style={{ fontFamily: 'Cairo, sans-serif' }}>{busy ? 'جارٍ الإرسال…' : 'إرسال للعميل'}</button>
              <button disabled={busy} onClick={() => setCheckout(false)} className="block w-full text-center text-[15px] text-[#0a84ff]">العودة للتصميم</button>
            </div>
          )}
        </section>
      </div>
    )}
    {checkout && !isDraft && <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-50 p-4" dir="rtl"><section className="mx-auto my-6 max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-black">{created ? `الطلب #${created.orderNumber}` : orderId ? 'تم حفظ تصميم الطلب' : 'إرسال رابط إكمال الاشتراك'}</h1>
      {orderId ? <><p>تم حفظ التعديلات على الطلب. يبقى رابط العميل نفسه؛ يمكنك إعادة إرساله من البوابة.</p><Button onClick={() => navigate('/partner')}>العودة للطلبات</Button></> : created ? <>
        <p>{created.emailed ? 'أُرسل الرابط إلى بريد العميل. يكمل العميل الاشتراك بنفسه، وتبقى العملية مسجّلة باسمك.' : 'حُفظ الطلب، لكن تعذر إرسال البريد. أعد إرساله من البوابة أو شارك الرابط أدناه.'}</p>
        <input readOnly value={created.payLink} className={inputClass} dir="ltr" onFocus={e => e.target.select()} />
        <Button tone="primary" onClick={() => navigate('/partner')}>العودة لبوابة الشريك</Button>
      </> : <>
        <p className="text-sm leading-6 text-gray-500">التصميم جاهز لـ«{pageData.name || 'العميل'}». يُرسل الرابط إلى البريد فقط؛ رقم الجوال لبيانات حساب العميل.</p>
        <Field label="اسم رابط الصفحة"><div dir="ltr" className="flex items-center gap-2"><input className={inputClass} value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} /><span>.{ROOT_DOMAIN}</span></div></Field>
        <Field label="بريد العميل"><input type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value.trim() })} dir="ltr" /></Field>
        <Field label="جوال العميل (لا نرسل إليه رسالة)"><input className={inputClass} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} dir="ltr" inputMode="tel" /></Field>
        <Field label="الباقة"><select className={inputClass} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value, price: '' })}><option value="annual">سنوي</option><option value="monthly">شهري</option></select></Field>
        <Field label={floor === null ? 'الباقة غير مسعّرة من الإدارة' : `سعر البيع — الحد الأدنى ${floor} ريال`}><input type="number" min={floor ?? 0} step="0.01" className={inputClass} value={value ?? ''} onChange={e => setForm({ ...form, price: e.target.value })} /></Field>
        {floor !== null && value !== null && <p className="text-sm text-emerald-700">ربح البيع: {Math.max(0, value - floor).toFixed(2)} ريال</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.terms} onChange={e => setForm({ ...form, terms: e.target.checked })} />وافق العميل على الشروط وعلى انتقال إدارة الحساب إليه بعد الدفع.</label>
        <ErrorNote message={error} />
        <Button tone="primary" disabled={busy || !pageData.name.trim() || !USERNAME_PATTERN.test(form.username) || !form.email.includes('@') || form.phone.length < 8 || !form.terms || floor === null || value === null || value < floor} onClick={send}>{busy ? 'جارٍ إرسال الطلب…' : 'إنشاء الطلب وإرساله بالبريد'}</Button>
        <button disabled={busy} onClick={() => setCheckout(false)} className="block text-sm text-gray-500">العودة للتصميم</button>
      </>}
    </section></div>}
  </>;
}

export default function PartnerOrderEditor() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerAccount | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { partnerCall('me').then(r => { if (r.partner.status !== 'active') throw Error('حساب الشريك غير متاح للبيع.'); setPartner(r.partner); }).catch(e => setError(e.message)); }, []);
  const draftKey = `onwan_partner_draft:${partner?.id ?? ''}:${orderId ?? 'new'}`;
  const source = useMemo<PageSource>(() => ({
    uploadToken: getPartnerToken,
    load: async () => orderId ? partnerCall('orders.getDraft', { id: orderId }) : { pageData: mergeWithDefaults(JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')) },
    save: async pageData => {
      if (orderId) return partnerCall('orders.saveDraft', { id: orderId, pageData });
      sessionStorage.setItem(draftKey, JSON.stringify(pageData));
      return { pageData };
    },
  }), [draftKey, orderId]);
  if (error) return <main className="p-8 text-center" dir="rtl"><p>{error}</p><button onClick={() => navigate('/partner')}>العودة لبوابة الشريك</button></main>;
  if (!partner) return <main className="p-8 text-center">جارٍ فتح المحرر…</main>;
  return <PageProvider source={source}><OrderFlow partner={partner} orderId={orderId} draftKey={draftKey} /></PageProvider>;
}
