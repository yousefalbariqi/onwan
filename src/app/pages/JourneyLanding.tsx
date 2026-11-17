import { journeyPath, type JourneyKind } from '../lib/journey';
import { PUBLIC_PLAN_PRICES } from '../../../shared/planPrices';
import { Link } from 'react-router';
import { NONPROFIT_ANNUAL_PRICE_LABEL } from '../lib/nonprofit';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpLeft, BadgeCheck, History, Link2, QrCode, UserPlus, Wallet, Images, Megaphone } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '../lib/site';
import { OnwanLogo } from '../components/OnwanLogo';
import { BrandFooter } from '../components/BrandFooter';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';
import { onboardingPending } from '../lib/journeyOnboarding';


// Each scene keeps the original product image and its captions together.
const SLIDES = [
  { src: '/nonprofit/phone-page.webp', alt: 'صفحة جمعية على «عنوان» في الجوال: الشعار والتعريف وأزرار التواصل والوثائق', top: { icon: BadgeCheck, text: 'وثائقكم الرسمية\nفي صفحتكم' }, bottom: { icon: Link2, text: 'رابط واحد\nلكل شيء' } },
  { src: '/nonprofit/phone-media-transparent.png', alt: 'صفحة عنوان تعرض مقاطع الفيديو والصور وروابط المبادرات', top: { icon: Images, text: 'مقاطعكم وصوركم\nفي صفحة واحدة' }, bottom: { icon: Megaphone, text: 'عرّفوا بمبادراتكم\nوقرّبوا أثركم' } },
  { src: '/nonprofit/phone-wallet.webp', alt: 'بطاقة الجمعية في محفظة Apple Wallet مع رمز QR يفتح الصفحة', top: { icon: Wallet, text: 'في كل وقت معك\nمعلومات الجمعية' }, bottom: { icon: QrCode, text: 'رمز QR\nيفتح صفحتكم' } },
  { src: '/nonprofit/phone-contact.webp', alt: 'زر حفظ جهة الاتصال في صفحة الجمعية، وبطاقة الجمعية محفوظة في جهات اتصال الآيفون بالجوال والبريد والرابط', top: { icon: UserPlus, text: 'حفظ جهة الاتصال\nبضغطة واحدة' }, bottom: { icon: History, text: 'بياناتكم في جوالهم\nلسنوات' } },
];
function Scene({ nonprofit }: { nonprofit: boolean }) {
  const slides = nonprofit ? SLIDES : SLIDES.map((slide, index) => ({ ...slide, alt: ['صفحة عنوان تجمع التعريف وروابط التواصل', 'الصور والمقاطع في صفحة عنوان', 'بطاقة عنوان في المحفظة مع رمز QR', 'حفظ جهة الاتصال من صفحة عنوان'][index], top: { ...slide.top, text: ['هويتك وروابطك\nفي صفحتك', 'مقاطعك وصورك\nفي صفحة واحدة', 'في كل وقت معك\nمعلوماتك', 'حفظ جهة الاتصال\nبضغطة واحدة'][index] }, bottom: { ...slide.bottom, text: ['رابط واحد\nلكل شيء', 'عرّف بخدماتك\nوشارك أعمالك', 'رمز QR\nيفتح صفحتك', 'بياناتك في جوالهم\nلسنوات'][index] } }));
  const [active, setActive] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
      }
    }, { root, threshold: 0.6 });
    Array.from(root.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  const goTo = (index: number) => {
    const root = viewport.current;
    const card = root?.children[index] as HTMLElement | undefined;
    if (!root || !card) return;
    // Relative geometry avoids browser differences in RTL scrollLeft values.
    root.scrollBy({ left: card.getBoundingClientRect().right - root.getBoundingClientRect().right,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return (
    <section className="landing-gallery" aria-label="اكتشف إمكانات عنوان" aria-roledescription="معرض شرائح">
      <div className="landing-gallery__viewport" ref={viewport} dir="rtl" tabIndex={0}
        aria-label="صور المنتج، اسحب للتنقل بين البطاقات"
        onKeyDown={(event) => {
          const next = event.key === 'ArrowLeft' ? active + 1 : event.key === 'ArrowRight' ? active - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : null;
          if (next !== null) { event.preventDefault(); goTo(Math.max(0, Math.min(slides.length - 1, next))); }
        }}>
        {slides.map((item, index) => (
          <div key={item.src} data-index={index} className={`landing-gallery__card landing-gallery__card--${index}`}
            role="group" aria-roledescription="شريحة" aria-label={`${index + 1} من ${slides.length}`}>
            <div className="landing-gallery__art">
              <img src={item.src} alt={item.alt} draggable={false} width={768} height={1100}
                loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
              <div className="landing-gallery__chip landing-gallery__chip--top" aria-hidden="true">
                <item.top.icon size={18} />{item.top.text}
              </div>
              <div className="landing-gallery__chip landing-gallery__chip--bottom" aria-hidden="true">
                <item.bottom.icon size={18} />{item.bottom.text}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="landing-gallery__controls">
        <span className="landing-gallery__hint">اسحب لاكتشاف المزيد</span>
        <div className="landing-gallery__dots" aria-label="اختيار البطاقة">
          {slides.map((item, index) => <button key={item.src} type="button"
            aria-label={`عرض البطاقة ${index + 1}: ${item.top.text.replace('\n', ' ')}`}
            aria-current={active === index ? 'true' : undefined} onClick={() => goTo(index)}><span /></button>)}
        </div>
      </div>
    </section>
  );
}

export default function JourneyLanding({ kind = 'nonprofit' }: { kind?: JourneyKind }) {
  const nonprofit = kind === 'nonprofit';
  const path = (page = '') => journeyPath(kind, page);
  useEffect(() => {
    const previous = document.title;
    document.title = nonprofit ? 'عنوان للجمعيات الأهلية' : 'عنوان — كل ما يعرّف بك في رابط واحد';
    return () => { document.title = previous; };
  }, [nonprofit]);
  const signedIn = Boolean(getSessionToken());
  return (
    <div dir="rtl" className="flex min-h-[100svh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <a href="#" aria-label={nonprofit ? "عنوان للجمعيات — الرئيسية" : "عنوان — الرئيسية"} className="flex items-center gap-3"><OnwanLogo /></a>
        {/* Note 23: a signed-in association comes back here, still signed in. */}
        {signedIn ? (
          <button type="button" onClick={() => { clearSessionToken(); clearLocalAccountData(); window.location.assign(path()); }} className="min-h-11 rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111]">تسجيل الخروج</button>
        ) : (
          <Link to={path('login')} className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4">تسجيل الدخول</Link>
        )}
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-7 px-4 pb-6 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="text-[2rem] font-bold tracking-[-0.02em] leading-[1.45] sm:text-5xl sm:leading-[1.5]">{nonprofit ? 'لرسالتكم أثر.' : 'كل ما يعرّف بك.'}<br /><span className="text-[#FF6B2C]">{nonprofit ? 'ولجمعيتكم عنوان.' : 'في رابط يحمل عنوانك.'}</span></h1>
          <p className="mt-3 max-w-lg text-base leading-8 text-[#737373] sm:mt-5 sm:text-lg sm:leading-9"><span className="block font-bold text-[#111111]">حضور يليق بكم</span>{nonprofit ? 'نقرّبكم أكثر من المستفيدين والداعمين.' : 'اجمع تعريفك وروابطك وصورك وملفاتك في صفحة تحمل هويتك.'}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
            {/* Note 30: one large filled start button for a new association. */}
            <Link to={path(signedIn ? (onboardingPending(kind) ? 'onboarding' : 'builder') : 'signup')} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#FF6B2C] px-8 py-3.5 text-base font-bold text-white shadow-md shadow-[#FF6B2C]/25 transition hover:bg-[#F25A18] active:scale-[0.98] focus-visible:outline-[#FF6B2C] focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto sm:text-lg">{signedIn ? (nonprofit ? 'متابعة تصميم صفحة الجمعية' : 'متابعة تصميم صفحتك') : (nonprofit ? 'أنشئ صفحة جمعيتك' : 'أنشئ صفحتك')} <ArrowUpLeft size={19} aria-hidden="true" /></Link>
            {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center px-2 text-sm font-bold underline underline-offset-4">تواصلوا معنا</a>}
          </div>
          <p className="mt-2 text-xs text-[#737373]">{nonprofit ? 'منتج مخصص للجمعيات الخيرية بتكلفة مخفّضة.' : 'جرّب تصميم صفحتك'}</p>

        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 pb-4">
          <Scene nonprofit={nonprofit} />
          <div className="relative isolate mx-6 w-[calc(100%_-_3rem)] max-w-[25rem] py-3">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 inset-y-1 -z-10 rounded-full bg-[#FF6B2C]/[0.08] blur-xl" />
            <p className="whitespace-nowrap text-center text-[clamp(10px,2.65vw,14px)] font-medium leading-8 text-[#111111]">
              {nonprofit ? 'عام من الحضور وأثر يصل أبعد بقيمة ' : 'اشتراك سنوي بقيمة '}<span className="relative inline-block font-bold text-[#FF6B2C] after:absolute after:inset-x-0 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#FF6B2C]/25">{nonprofit ? NONPROFIT_ANNUAL_PRICE_LABEL : PUBLIC_PLAN_PRICES.annual.toLocaleString('ar-SA')} ريال فقط في السنة</span>
            </p>
          </div>
        </div>
      </main>
      <BrandFooter kind={kind} />
    </div>
  );
}
