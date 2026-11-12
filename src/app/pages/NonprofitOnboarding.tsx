import { nonprofitCall } from '../lib/api';
import { onboardingItems, type OnboardingChoice as Choice } from '../lib/nonprofitSelection';
import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, FileText, Image as ImageIcon, Play, Plus, User } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { ImageProblem, compressImage } from '../lib/compressImage';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { usePageContext } from '../context/PageContext';
import { SOCIAL_PLATFORMS, SocialIcon, brandColor } from '../components/SocialIcons';
import { NONPROFIT_ANNUAL_PRICE_LABEL, nonprofitPath } from '../lib/nonprofit';
import { preloadMedia } from '../lib/mediaUpload';
import { OFFICIAL_DOCUMENTS } from '../lib/officialDocuments';
import { finishOnboarding, onboardingPending, onboardingProgress, saveOnboarding } from '../lib/nonprofitOnboarding';

// Note 19: right after a nonprofit signs up, «أين تتواجد جمعيتكم؟» — a grid of
// platform tiles (several may be chosen), then «عرّف بجمعيتك» (note 20): logo,
// name and a short bio. Note 25: no links are asked for here — each chosen
// platform lands in «المحتوى» as «يرجى إكمال الرابط», hidden from visitors
// until its link is added. The platform list and wording are still under study.
// Note 13: content tiles (a clip, a picture, a file) sit between the platforms,
// and the four official documents close the grid. Each chosen one becomes a
// hidden item waiting in the editor, like a platform without its link.
const social = (id: string): Choice => ({ id, name: SOCIAL_PLATFORMS.find((p) => p.id === id)!.name, kind: 'platform' });
const doc = (id: string): Choice => {
  const item = OFFICIAL_DOCUMENTS.find((d) => d.id === id)!;
  return { id: `doc-${item.id}`, name: item.title, kind: 'document', docType: item.id };
};
const CHOICES: Choice[] = [
  social('whatsapp'),
  doc('registration'),
  { id: 'video', name: 'مقطع', kind: 'content' },
  social('twitter'),
  social('instagram'),
  { id: 'image', name: 'صورة مخصصة', kind: 'content' },
  social('snapchat'),
  social('tiktok'),
  { id: 'file', name: 'ملف مخصص', kind: 'content' },
  social('youtube'),
  social('linkedin'),
  social('facebook'),
  social('telegram'),
  social('website'),
  social('email'),
  // «وثيقة ترخيص الجمعية» is not offered here; it stays in the editor's «الوثائق الرسمية».
  doc('fundraising'),
  doc('governance'),
];
const VISIBLE_CHOICES = CHOICES.slice(0, 12);
const BIO_LIMIT = 300;
const STEPS = 3;

// Note 19 (update): each logo as its owner shows it. Official Simple Icons
// paths (SVG, sharp on Retina). Platforms whose mark is an app tile get their
// official tile; marks that already carry their own shape (YouTube, Facebook,
// LinkedIn, Telegram) are drawn alone in their brand colour, with nothing added.
const TILES: Record<string, { background?: string; glyph: string; filter?: string }> = {
  instagram: { background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)', glyph: '#ffffff' },
  whatsapp: { background: '#25D366', glyph: '#ffffff' },
  tiktok: { background: '#000000', glyph: '#ffffff', filter: 'drop-shadow(-1.5px -1.5px 0 #25F4EE) drop-shadow(1.5px 1.5px 0 #FE2C55)' },
  twitter: { background: '#000000', glyph: '#ffffff' },
  snapchat: { background: '#FFFC00', glyph: '#ffffff', filter: 'drop-shadow(0 0 0.8px #000) drop-shadow(0 0 0.4px #000)' },
  website: { background: '#000000', glyph: '#ffffff' },
  email: { background: '#1d1d1f', glyph: '#ffffff' },
  youtube: { glyph: '#FF0000' },
  facebook: { glyph: '#0866FF' },
  linkedin: { glyph: '#0A66C2' },
  telegram: { glyph: '#26A5E4' },
};

// Note 13: tiles for content, and the official documents' own mark.
const CONTENT_TILES = { video: { Icon: Play, background: '#FF6B2C' }, image: { Icon: ImageIcon, background: '#111111' }, file: { Icon: FileText, background: '#737373' } };

function ChoiceTile({ choice }: { choice: Choice }) {
  if (choice.kind === 'document') return <span className="flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16"><img src="/nonprofit/official-docs.png" alt="" className="h-12 w-auto sm:h-14" /></span>;
  if (choice.kind === 'content') {
    const { Icon, background } = CONTENT_TILES[choice.id];
    return <span className="flex h-14 w-14 items-center justify-center rounded-[22%] text-white sm:h-16 sm:w-16" style={{ background }}><Icon className="h-7 w-7" fill={choice.id === 'video' ? 'currentColor' : 'none'} /></span>;
  }
  return <Tile platform={choice.id} />;
}

function Tile({ platform }: { platform: string }) {
  const tile = TILES[platform] ?? { background: brandColor(platform), glyph: '#ffffff' };
  // One optical size for every logo: tiles are 56/64 px with a 30 px mark; a
  // bare mark fills most of the same box.
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[22%] sm:h-16 sm:w-16" style={tile.background ? { background: tile.background } : undefined}>
      <span className="flex" style={{ filter: tile.filter }}>
        <SocialIcon platform={platform} iconStyle="color" color={tile.glyph} size={tile.background ? 30 : 48} />
      </span>
    </span>
  );
}

export function NonprofitOnboarding() {
  const navigate = useNavigate();
  const { pageData, updatePageData, updateProfileStyle, addLink, save, saving } = usePageContext();
  // Note 14: the step and the chosen tiles survive leaving and coming back.
  const [step, setStep] = useState<1 | 2 | 3>(() => onboardingProgress()?.step ?? 1);
  const [imageError, setImageError] = useState('');
  const uploadId = useId();
  const [chosen, setChosen] = useState<string[]>(() => (onboardingProgress()?.chosen ?? []).filter(id => VISIBLE_CHOICES.some(choice => choice.id === id)));
  // Only an open setup is remembered; opening this page again after it was
  // finished does not lock the editor.
  useEffect(() => { if (onboardingPending()) saveOnboarding({ step, chosen }); }, [step, chosen]);
  const [error, setError] = useState('');
  const finishing = useRef(false);
  const [starting, setStarting] = useState(false);
  const toEditor = () => navigate(nonprofitPath('builder'), { replace: true });

  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setError('');
    setStarting(true);
    try {
      const additions = onboardingItems(VISIBLE_CHOICES, chosen, pageData.links);
      flushSync(() => additions.forEach(addLinkItem => addLink(addLinkItem)));
      // Save the identity/logo before recording the server-side start event.
      await save();
      await nonprofitCall({ action: 'start-creation', organizationName: pageData.name });
      finishOnboarding();
      toEditor();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'تعذر بدء إنشاء الصفحة. حاول مجددًا.');
    } finally {
      finishing.current = false;
      setStarting(false);
    }
  };

  // Name, bio and logo go straight into the page draft, so they survive going back and forth.
  const pickLogo = (file: File) => {
    setImageError('');
    compressImage(file)
      .then(async (image) => {
        updatePageData({ profileImage: image });
        // Note 18: the logo starts uploading now, while the name and bio are typed.
        preloadMedia(image);
        updateProfileStyle({ fit: 'contain', zoom: 1, positionX: 50, positionY: 50 });
        const colors = await extractColorsFromImage(image, 8);
        if (colors.length > 0) updatePageData({ extractedColors: colors });
      })
      .catch((problem) => setImageError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'));
  };
  const back = () => { if (starting) return; if (step === 1) navigate(nonprofitPath()); else setStep(step === 3 ? 2 : 1); };
  const next = () => { if (step === 3) void finish(); else setStep(step === 1 ? 2 : 3); };
  const canContinue = step === 1 ? chosen.length > 0 : Boolean(pageData.name.trim()) && !saving && !starting;

  return (
    <div dir="rtl" className="relative isolate flex min-h-[100dvh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 pt-6">
        <button type="button" onClick={back} aria-label="رجوع" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ecebe6] text-[#1d1d1f] transition-transform active:scale-95"><ChevronRight className="h-6 w-6" /></button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8e8e3]" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step} aria-label="خطوات الإعداد">
          <div className="h-full rounded-full bg-[#FF6B2C] transition-all duration-300" style={{ width: `${(step / STEPS) * 100}%` }} />
        </div>
        <span className="w-12" />
      </header>

      {step === 1 && <>
        <aside aria-label="مثال على صفحة الجمعية المنشورة" className="pointer-events-none fixed left-[max(2rem,calc((100vw-1320px)/2))] top-40 hidden w-56 text-center xl:block">
          <img src="/nonprofit/phone-page.webp" alt="مثال لصفحة عنوان على الجوال، تضم التعريف بالجمعية وروابط التواصل والوثائق" className="mx-auto w-48 opacity-80" />
          <p className="mt-5 text-sm font-bold">هنا تظهر اختياراتك</p>
          <p className="mt-1 text-xs leading-6 text-[#737373]">في صفحة واحدة يفتحها زوّار جمعيتك.</p>
        </aside>
        <aside aria-label="أمثلة للمحتوى الذي يمكنك إضافته" className="fixed right-[max(2rem,calc((100vw-1320px)/2))] top-60 hidden w-52 xl:block">
          <p className="mb-4 text-sm font-bold">مساحة لكل ما يعرّف بكم</p>
          <div className="space-y-3">
            {[{ Icon: Play, title: 'مقطع تعريفي', detail: 'عرّف برسالتكم وأثركم' }, { Icon: ImageIcon, title: 'صورة', detail: 'شارك لحظة من أنشطتكم' }, { Icon: FileText, title: 'ملف أو وثيقة', detail: 'قرّب تقاريركم من الداعمين' }].map(({ Icon, title, detail }) => <div key={title} className="flex items-center gap-3 rounded-2xl border border-[#E7E7E7] bg-white px-4 py-4"><Icon size={21} className="shrink-0 text-[#FF6B2C]" /><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#737373]">{detail}</p></div></div>)}
          </div>
          <p className="mt-4 text-xs leading-6 text-[#737373]">تختار الآن، وتضيف التفاصيل في المحرر.</p>
        </aside>
      </>}
      <main className={`relative mx-auto w-full max-w-2xl flex-1 px-5 pt-8 ${step === 3 ? 'pb-10' : 'pb-52'}`}>
        {step === 1 ? (
          <>
            <div className="mb-6 flex justify-center"><OnwanLogo /></div>
            <h1 className="text-center text-[26px] font-bold leading-relaxed sm:text-[32px]">أضف روابط وملفات <span className="text-[#FF6B2C]">لصفحتك</span></h1>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-7 text-[#737373] sm:text-base">اختر ما تود البدء به ليظهر في صفحة جمعيتك.<br />ويمكنك إضافة المزيد وتعديل اختياراتك لاحقًا من المحرر.</p>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#E7E7E7] bg-white px-4 py-3 xl:hidden">
              <img src="/nonprofit/phone-page.webp" alt="مثال لصفحة الجمعية على الجوال" className="h-24 w-auto shrink-0" />
              <div><p className="text-sm font-bold">اختياراتك، في صفحة واحدة</p><p className="mt-1 text-xs leading-6 text-[#737373]">روابط التواصل، المقاطع، الصور والوثائق.<br />اختر الآن وأكمل التفاصيل في المحرر.</p></div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
              {VISIBLE_CHOICES.map((p) => {
                const active = chosen.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    aria-pressed={active}
                    onClick={() => toggle(p.id)}
                    // The border is always 2px — only its colour changes, so nothing shifts.
                    className={`relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-[22px] border-2 bg-white transition-colors ${active ? 'border-[#FF6B2C] ring-2 ring-[#FF6B2C]/10' : 'border-[#ececec] hover:border-[#d4d4d4]'}`}
                  >
                    {active && <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B2C] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <ChoiceTile choice={p} />
                    <span className="px-1 text-center text-[13px] font-bold leading-tight sm:text-[15px]">{p.name}</span>
                  </button>
                );
              })}
              <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[22px] border-2 border-[#FF6B2C]/20 bg-[#FFF0E8] px-2 text-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#FF6B2C] sm:h-14 sm:w-14"><Plus size={28} strokeWidth={1.75} aria-hidden="true" /></span>
                <span className="text-[13px] font-bold sm:text-[15px]">والمزيد</span>
                <span className="text-[10px] leading-[1.4] text-[#737373] sm:text-xs">أضف أي رابط أو محتوى<br />لاحقًا من المحرر</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs leading-6 text-[#737373]">ما لقيت منصتك؟ تابع، ويمكنك إضافة رابطها أو صور وملفات ومقاطع لاحقًا من محرر الصفحة.</p>
          </>
        ) : step === 2 ? (
          <>
            <h1 className="text-center text-[28px] font-black leading-tight sm:text-[34px]">عرّف بجمعيتك</h1>
            <p className="mt-2 text-center text-[15px] text-[#6e6e73] sm:text-base">تظهر هذه البيانات في صفحة جمعيتكم.</p>
            <div className="mx-auto mt-8 max-w-md">
              <input id={uploadId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) pickLogo(file); }} />
              <label htmlFor={uploadId} className="relative mx-auto block h-36 w-36 cursor-pointer" aria-label={pageData.profileImage ? 'تغيير الشعار' : 'رفع الشعار'}>
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#a9aaa3]">
                  {pageData.profileImage ? <img src={pageData.profileImage} alt="" className="h-full w-full bg-white object-contain" /> : <User className="h-20 w-20 text-[#f5f5f2]" fill="currentColor" strokeWidth={0} />}
                </span>
                <span className="absolute bottom-1 left-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#FF6B2C] text-white"><Plus className="h-6 w-6" /></span>
              </label>
              {imageError && <p role="alert" className="mt-3 text-center text-sm text-red-700">{imageError}</p>}
              <label className="mt-7 block">
                <span className="text-[16px] font-bold">اسم الجمعية</span>
                <input value={pageData.name} onChange={(e) => updatePageData({ name: e.target.value })} maxLength={80} className="mt-2 w-full rounded-2xl border-2 border-[#e2e2de] bg-white px-5 py-4 text-[17px] focus:border-[#FF6B2C] focus:outline-none" />
              </label>
              <label className="mt-5 block">
                <span className="text-[16px] font-bold">نبذة عن الجمعية</span>
                <span className="mt-2 block rounded-2xl border-2 border-[#e2e2de] bg-white px-5 pb-3 pt-4 focus-within:border-[#FF6B2C]">
                  <textarea value={pageData.bio} onChange={(e) => updatePageData({ bio: e.target.value.slice(0, BIO_LIMIT) })} maxLength={BIO_LIMIT} rows={4} placeholder="سطر أو سطران عن رسالة الجمعية وخدماتها" className="block w-full resize-none bg-transparent text-[17px] placeholder:text-[#8e8e93] focus:outline-none" />
                  <span className="mt-1 block text-[14px] text-[#6e6e73]" dir="ltr" style={{ textAlign: 'right' }}>{pageData.bio.length}/{BIO_LIMIT}</span>
                </span>
              </label>
            </div>
          </>
        ) : (
          <section aria-labelledby="plan-title" className="mx-auto max-w-xl">
            <div className="mb-6 text-center">
              <span className="text-xs font-bold tracking-wide text-[#b54a1b]">خطوتك الأولى لحضور أكبر</span>
              <h1 id="plan-title" className="mt-3 text-[28px] font-black leading-relaxed sm:text-[34px]">باقة عنوان للجمعيات</h1>
              <p className="mt-2 text-sm leading-7 text-[#737373]">كل ما يعرّف بجمعيتك، في رابط واحد.</p>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-[#e6e2dc] bg-white shadow-[0_12px_40px_-24px_rgba(59,38,19,0.2)]">
              <div className="flex items-center gap-3 border-b border-[#eee9e2] bg-[#fcfaf6] px-6 py-5 sm:px-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#ebe6df] bg-white">
                  {pageData.profileImage ? <img src={pageData.profileImage} alt="شعار الجمعية" className="h-full w-full object-contain p-1" /> : <User size={24} className="text-[#b6aa98]" aria-hidden="true" />}
                </div>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{pageData.name || 'جمعيتك'}</p><p className="mt-1 text-xs text-[#737373]">مساحة خاصة تحمل هويتكم</p></div>
                <span className="mr-auto shrink-0 rounded-full border border-[#e7dfd3] bg-white px-3 py-1.5 text-xs font-bold text-[#78634b]">اشتراك سنوي</span>
              </div>
              <div className="px-6 py-7 sm:px-8">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                  <strong className="text-[72px] font-bold leading-none tracking-tight text-[#161614]">{NONPROFIT_ANNUAL_PRICE_LABEL}</strong>
                  <div className="pb-1"><p className="text-lg font-bold">ريال فقط</p><p className="mt-1 text-sm text-[#737373]">في السنة</p></div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#737373]">تُدفع دفعة واحدة سنويًا.</p>
                <div className="my-6 h-px bg-[#efede8]" />
                <h2 className="text-base font-bold">حضور متكامل، يشبه جمعيتك.</h2>
                <ul className="mt-5 space-y-4">
                  {['روابطكم ووثائقكم ومبادراتكم في صفحة واحدة', 'تصميم يعكس هوية الجمعية وشعارها', 'تعديل المحتوى وتحديثه من محرر سهل'].map(feature => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[#52524e]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fff0e7] text-[#c64f18]"><Check size={12} strokeWidth={2.5} aria-hidden="true" /></span>{feature}</li>)}
                </ul>
                <button type="button" disabled={!canContinue} onClick={next} className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#FF6B2C] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#ef5a1b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c64f18] disabled:cursor-wait disabled:opacity-60">
                  {starting ? 'جارٍ بدء إنشاء الصفحة…' : saving ? 'جارٍ الحفظ…' : 'ابدأ إنشاء صفحة جمعيتك'}
                  {!starting && !saving && <ChevronRight size={19} className="rotate-180" aria-hidden="true" />}
                </button>
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-6 text-[#737373]"><Check size={14} className="shrink-0 text-[#687c5a]" aria-hidden="true" />إعداد الصفحة ومعاينتها قبل الدفع</p>
              </div>
            </div>
          </section>
        )}
        {error && <p role="alert" className="mt-4 text-center text-sm text-red-700">{error}</p>}
      </main>

      {/* Fixed actions, faded over the grid as in the reference. */}
      {step !== 3 && <footer className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#F8F8F6] via-[#F8F8F6] to-[#F8F8F6]/0 pt-8">
        <div className="mx-auto w-full max-w-2xl px-5 pb-6">
          {step === 2 && (
            <p className="mb-3 text-center text-[13px] leading-6 text-[#6e6e73]">
              بالمتابعة توافق على <a href={nonprofitPath('terms')} className="font-bold text-[#FF6B2C] underline underline-offset-2">الشروط والأحكام</a>. «عنوان» مخصّص للجمعيات والمنظمات.
            </p>
          )}
          <button
            type="button"
            disabled={!canContinue}
            onClick={next}
            className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#FF6B2C] text-[17px] font-bold text-white transition-colors disabled:bg-[#e8e8e3] disabled:text-[#a3a39e]"
          >
            {starting ? 'جارٍ بدء إنشاء الصفحة…' : saving ? 'جارٍ الحفظ…' : 'متابعة'}
          </button>
          {step === 1 && <button type="button" onClick={() => { setChosen([]); setStep(2); saveOnboarding({ step: 2, chosen: [] }); }} className="mt-3 block w-full py-2 text-center text-[15px] font-bold text-[#6e6e73]">تخطي</button>}
        </div>
      </footer>}
    </div>
  );
}
