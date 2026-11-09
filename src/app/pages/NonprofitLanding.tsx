import { Link } from 'react-router';
import { nonprofitPath } from '../lib/nonprofit';
import { useEffect, useState } from 'react';
import { ArrowUpLeft, BadgeCheck, History, Link2, QrCode, UserPlus, Wallet, Images, Megaphone } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '../lib/site';
import { OnwanLogo } from '../components/OnwanLogo';
import { NonprofitFooter } from '../components/NonprofitFooter';
import { clearLocalAccountData, clearSessionToken, getSessionToken } from '../lib/session';
import { onboardingPending } from '../lib/nonprofitOnboarding';


// Note 31: colours are the «عنوان» brand tokens (onwan-brand.html).
// The association page, media, Apple Wallet and saved contact rotate
// in the same spot with a slow crossfade and a slight
// settle, never moving the frame itself. Each has its own two captions.
const SLIDES = [
  { src: '/nonprofit/phone-page.webp', alt: 'صفحة جمعية على «عنوان» في الجوال: الشعار والتعريف وأزرار التواصل والوثائق', top: { icon: BadgeCheck, text: 'وثائقكم الرسمية\nفي صفحتكم' }, bottom: { icon: Link2, text: 'رابط واحد\nلكل شيء' } },
  { src: '/nonprofit/phone-media-transparent.png', alt: 'صفحة عنوان تعرض مقاطع الفيديو والصور وروابط المبادرات', top: { icon: Images, text: 'مقاطعكم وصوركم\nفي صفحة واحدة' }, bottom: { icon: Megaphone, text: 'عرّفوا بمبادراتكم\nوقرّبوا أثركم' } },
  { src: '/nonprofit/phone-wallet.webp', alt: 'بطاقة الجمعية في محفظة Apple Wallet مع رمز QR يفتح الصفحة', top: { icon: Wallet, text: 'في كل وقت معك\nمعلومات الجمعية' }, bottom: { icon: QrCode, text: 'رمز QR\nيفتح صفحتكم' } },
  { src: '/nonprofit/phone-contact.webp', alt: 'زر حفظ جهة الاتصال في صفحة الجمعية، وبطاقة الجمعية محفوظة في جهات اتصال الآيفون بالجوال والبريد والرابط', top: { icon: UserPlus, text: 'حفظ جهة الاتصال\nبضغطة واحدة' }, bottom: { icon: History, text: 'بياناتكم في جوالهم\nلسنوات' } },
];
const SLIDE_MS = 4500;
// The first screen is already showing while the page opens, so its first
// turn is shorter; the rotation starts only once every screen has loaded.
const FIRST_SLIDE_MS = 3000;

function Scene() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    const next = (delay: number) => {
      timer = window.setTimeout(() => { setActive((index) => (index + 1) % SLIDES.length); next(SLIDE_MS); }, delay);
    };
    // A screen that fails to load does not hold the others back.
    Promise.all(SLIDES.map((item) => { const image = new Image(); image.src = item.src; return image.decode().catch(() => undefined); }))
      .then(() => { if (!stopped) next(FIRST_SLIDE_MS); });
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);
  const slide = SLIDES[active];
  const Chip = ({ icon: Icon, text, dark, className }: { icon: typeof Wallet; text: string; dark?: boolean; className: string }) => (
    <div aria-hidden="true" className={`absolute flex items-center gap-2 whitespace-pre-line rounded-2xl px-3 py-2.5 text-xs font-bold leading-5 shadow-md motion-safe:[animation:np-chip_.7s_ease-out] ${dark ? 'bg-[#111111] text-white shadow-[#111111]/15' : 'bg-white text-[#111111] shadow-[#111111]/10'} ${className}`}>
      <Icon size={18} className={dark ? 'text-[#FF6B2C]' : ''} />{text}
    </div>
  );
  return (
    <div className="relative mx-auto w-full max-w-md">
      <style>{'@keyframes np-chip{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
      <div aria-hidden="true" className="absolute inset-x-6 inset-y-4 rounded-[3rem] bg-[#FFF0E8]" />
      {/* Framed for the widest screen (two phones), so every slide keeps the same height. */}
      <div className="relative mx-auto aspect-[768/1100] w-60 sm:w-80">
        {SLIDES.map((item, index) => (
          <img key={item.src} src={item.src} alt={item.alt} aria-hidden={index !== active} draggable={false}
            className={`absolute inset-0 h-full w-full object-contain drop-shadow-[0_18px_30px_rgba(17,17,17,0.18)] transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none ${index === active ? 'scale-100 opacity-100' : 'scale-[0.985] opacity-0'}`} />
        ))}
      </div>
      <Chip key={`t${active}`} {...slide.top} dark className="left-0 top-[30%]" />
      <Chip key={`b${active}`} {...slide.bottom} className="bottom-6 right-0 sm:bottom-10" />
    </div>
  );
}

export default function NonprofitLanding() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'عنوان للجمعيات الأهلية';
    return () => { document.title = previous; };
  }, []);
  const signedIn = Boolean(getSessionToken());
  return (
    <div dir="rtl" className="flex min-h-[100svh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <a href="#" aria-label="عنوان للجمعيات — الرئيسية" className="flex items-center gap-3"><OnwanLogo /></a>
        {/* Note 23: a signed-in association comes back here, still signed in. */}
        {signedIn ? (
          <button type="button" onClick={() => { clearSessionToken(); clearLocalAccountData(); window.location.assign(nonprofitPath()); }} className="min-h-11 rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111]">تسجيل الخروج</button>
        ) : (
          <Link to={nonprofitPath('login')} className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4">تسجيل الدخول</Link>
        )}
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="text-[2rem] font-bold tracking-[-0.02em] leading-[1.45] sm:text-5xl sm:leading-[1.5]">لرسالتكم أثر.<br /><span className="text-[#FF6B2C]">ولجمعيتكم عنوان.</span></h1>
          <p className="mt-3 max-w-lg text-base leading-8 text-[#737373] sm:mt-5 sm:text-lg sm:leading-9"><span className="block font-bold text-[#111111]">حضور يليق بكم</span>نقرّبكم أكثر من المستفيدين والداعمين.</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
            {/* Note 30: one large filled start button for a new association. */}
            <Link to={nonprofitPath(signedIn ? (onboardingPending() ? 'onboarding' : 'builder') : 'signup')} className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#FF6B2C] px-8 py-3.5 text-base font-bold text-white shadow-md shadow-[#FF6B2C]/25 transition hover:bg-[#F25A18] active:scale-[0.98] focus-visible:outline-[#FF6B2C] focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto sm:text-lg">{signedIn ? 'متابعة تصميم صفحة الجمعية' : 'أنشئ صفحة جمعيتك'} <ArrowUpLeft size={19} aria-hidden="true" /></Link>
            {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center px-2 text-sm font-bold underline underline-offset-4">تواصلوا معنا</a>}
          </div>
          <p className="mt-2 text-xs text-[#737373]">منتج مخصص للجمعيات الخيرية بتكلفة مخفّضة.</p>
          {/* Note 30: the second way in, for an association that already has an account. */}
          {!signedIn && (
            <p className="mt-6 border-t border-[#E7E7E7] pt-4 text-sm text-[#737373]">لديكم حساب؟ <Link to={nonprofitPath('login')} className="inline-flex min-h-11 items-center font-bold text-[#111111] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">دخول بوابة الجمعية</Link></p>
          )}
        </div>
        <div className="flex flex-col items-center gap-6 pb-4">
          <Scene />
          <div className="relative isolate mx-6 w-[calc(100%_-_3rem)] max-w-[25rem] py-3">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 inset-y-1 -z-10 rounded-full bg-[#FF6B2C]/[0.08] blur-xl" />
            <p className="whitespace-nowrap text-center text-[clamp(10px,2.65vw,14px)] font-medium leading-8 text-[#111111]">
              عام من الحضور وأثر يصل أبعد بقيمة <span className="relative inline-block font-bold text-[#FF6B2C] after:absolute after:inset-x-0 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#FF6B2C]/25">243 ريال</span> في السنة
            </p>
          </div>
        </div>
      </main>
      <NonprofitFooter />
    </div>
  );
}
