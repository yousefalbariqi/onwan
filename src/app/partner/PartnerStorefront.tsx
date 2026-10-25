import { accountCall } from '../lib/api';
import { getSessionToken } from '../lib/session';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ROOT_DOMAIN, getSubdomainUsername } from '../lib/site';
import { partnerCall } from './partnerApi';

// Note 57: also shown on the partner's own link (bawariq.onwan.link). The
// building and buying happen on the main site, where the account lives; the
// partner is remembered on the server once the visitor signs up.
export default function PartnerStorefront({ partnerId: givenId }: { partnerId?: string } = {}) {
  const params = useParams();
  const partnerId = givenId ?? params.partnerId;
  const [searchParams] = useSearchParams();
  const onPartnerHost = Boolean(givenId) && Boolean(getSubdomainUsername());
  const navigate = useNavigate();
  const [partner, setPartner] = useState<{ id: string; shopName: string; monthly: number | null; annual: number | null } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    sessionStorage.removeItem('onwan_partner_ref');
    let active = true;
    partnerCall('storefront.view', { partnerId }).then(r => { if (!active) return; setPartner(r.partner); sessionStorage.setItem('onwan_partner_ref', r.partner.id); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [partnerId]);
  const start = async () => {
    if (!partner) return;
    if (onPartnerHost) { window.location.href = `https://${ROOT_DOMAIN}/via/${partner.id}?start=1`; return; }
    setBusy(true);
    try { sessionStorage.setItem('onwan_partner_ref', partner.id); if (getSessionToken()) { await accountCall('referral.claim', { partnerId: partner.id }); sessionStorage.removeItem('onwan_partner_ref'); navigate('/builder'); } else navigate('/?focus=name'); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر فتح العرض.'); } finally { setBusy(false); }
  };
  // Arriving from the partner's own link: carry straight on.
  useEffect(() => { if (partner && !onPartnerHost && searchParams.get('start') === '1') void start(); }, [partner]); // eslint-disable-line react-hooks/exhaustive-deps

  return <main className="grid min-h-screen place-items-center bg-gray-50 p-4" dir="rtl">
    <section className="w-full max-w-xl space-y-6 rounded-3xl bg-white p-8 shadow-sm">
      <p className="text-sm font-bold text-emerald-700">عنوان · شركاء البيع</p>
      <h1 className="text-2xl font-black">{partner ? `أنشئ صفحتك عبر ${partner.shopName}` : 'رابط الشريك'}</h1>
      {error ? <p role="alert" className="text-red-700">{error}</p> : !partner ? <p>جارٍ تحميل العرض…</p> : <>
        <p className="leading-7 text-gray-600">صمّم صفحتك بنفسك بالمحرر الكامل، ثم أكمل تسجيلك واشتراكك. هذه الأسعار خاصة برابط الشريك، وحسابك يبقى ملكك وحدك.</p>
        <div className="grid grid-cols-2 gap-3">{[['شهري', partner.monthly], ['سنوي', partner.annual]].map(([label, price]) => <div key={label} className="rounded-2xl bg-gray-50 p-5"><p>{label}</p><strong className="mt-2 block text-xl">{price == null ? 'غير متاح' : `${price} ريال`}</strong></div>)}</div>
        <button disabled={busy || (partner.monthly === null && partner.annual === null)} onClick={() => void start()} className="w-full rounded-2xl bg-emerald-600 p-4 font-bold text-white disabled:opacity-40">ابدأ تصميم صفحتك</button>
      </>}
      <Link to="/" className="block text-center text-sm text-gray-500">العودة للرئيسية</Link>
    </section>
  </main>;
}
