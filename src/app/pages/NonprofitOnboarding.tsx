import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, Plus, User } from 'lucide-react';
import { ImageProblem, compressImage } from '../lib/compressImage';
import { extractColorsFromImage } from '../utils/colorExtractor';
import { usePageContext, type Link } from '../context/PageContext';
import { SOCIAL_PLATFORMS, SocialIcon, brandColor } from '../components/SocialIcons';
import { nonprofitPath } from '../lib/nonprofit';

// Note 19: right after a nonprofit signs up, «أين تتواجد جمعيتكم؟» — a grid of
// platform tiles (several may be chosen), then «عرّف بجمعيتك» (note 20): logo,
// name and a short bio. Note 25: no links are asked for here — each chosen
// platform lands in «المحتوى» as «يرجى إكمال الرابط», hidden from visitors
// until its link is added. The platform list and wording are still under study.
const PLATFORM_IDS = ['whatsapp', 'twitter', 'instagram', 'snapchat', 'tiktok', 'youtube', 'linkedin', 'facebook', 'telegram', 'website', 'email'] as const;
const BIO_LIMIT = 150;
const STEPS = 2;
const PLATFORMS = PLATFORM_IDS.map((id) => SOCIAL_PLATFORMS.find((p) => p.id === id)!);

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
  const [step, setStep] = useState<1 | 2>(1);
  const [imageError, setImageError] = useState('');
  const uploadId = useId();
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState('');
  const toEditor = () => navigate(nonprofitPath('builder'), { replace: true });

  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const finish = async () => {
    setError('');
    // No placeholder links: an empty link, hidden, marked «يرجى إكمال الرابط» in the editor.
    const existing = new Set(pageData.links.map((link) => link.platform));
    PLATFORMS.filter((p) => chosen.includes(p.id) && !existing.has(p.id as Link['platform'])).forEach((p) => {
      addLink({ title: p.name, url: '', platform: p.id as Link['platform'], iconStyle: 'color', linkType: 'url', hidden: true });
    });
    try {
      await save();
      toEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الروابط. حاول مرة أخرى.');
    }
  };

  // Name, bio and logo go straight into the page draft, so they survive going back and forth.
  const pickLogo = (file: File) => {
    setImageError('');
    compressImage(file)
      .then(async (image) => {
        updatePageData({ profileImage: image });
        updateProfileStyle({ fit: 'contain', zoom: 1, positionX: 50, positionY: 50 });
        const colors = await extractColorsFromImage(image, 8);
        if (colors.length > 0) updatePageData({ extractedColors: colors });
      })
      .catch((problem) => setImageError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.'));
  };
  const back = () => (step === 1 ? navigate(nonprofitPath()) : setStep(1));
  const next = () => (step === 2 ? finish() : setStep(2));
  const canContinue = step === 1 ? chosen.length > 0 : Boolean(pageData.name.trim()) && !saving;

  return (
    <div dir="rtl" className="flex min-h-[100dvh] flex-col bg-white text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 pt-6">
        <button type="button" onClick={back} aria-label="رجوع" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ecebe6] text-[#1d1d1f] transition-transform active:scale-95"><ChevronRight className="h-6 w-6" /></button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8e8e3]" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step} aria-label="خطوات الإعداد">
          <div className="h-full rounded-full bg-[#6c9464] transition-all duration-300" style={{ width: `${(step / (STEPS + 1)) * 100}%` }} />
        </div>
        <span className="w-12" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-44 pt-8">
        {step === 1 ? (
          <>
            <h1 className="text-center text-[28px] font-black leading-tight sm:text-[34px]">أين تتواجد جمعيتكم؟</h1>
            <p className="mt-2 text-center text-[15px] text-[#6e6e73] sm:text-base">اختاروا المنصات للبدء، ويمكنكم تعديلها في أي وقت.</p>
            <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
              {PLATFORMS.map((p) => {
                const active = chosen.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    aria-pressed={active}
                    onClick={() => toggle(p.id)}
                    // The border is always 2px — only its colour changes, so nothing shifts.
                    className={`relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-[22px] border-2 bg-white transition-colors ${active ? 'border-[#173c36]' : 'border-[#ececec] hover:border-[#d4d4d4]'}`}
                  >
                    {active && <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#173c36] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <Tile platform={p.id} />
                    <span className="text-[14px] font-bold sm:text-[15px]">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-center text-[28px] font-black leading-tight sm:text-[34px]">عرّف بجمعيتك</h1>
            <p className="mt-2 text-center text-[15px] text-[#6e6e73] sm:text-base">تظهر هذه البيانات في صفحة جمعيتكم.</p>
            <div className="mx-auto mt-8 max-w-md">
              <input id={uploadId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) pickLogo(file); }} />
              <label htmlFor={uploadId} className="relative mx-auto block h-36 w-36 cursor-pointer" aria-label={pageData.profileImage ? 'تغيير الشعار' : 'رفع الشعار'}>
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#a9aaa3]">
                  {pageData.profileImage ? <img src={pageData.profileImage} alt="" className="h-full w-full bg-white object-contain" /> : <User className="h-20 w-20 text-[#f5f5f2]" fill="currentColor" strokeWidth={0} />}
                </span>
                <span className="absolute bottom-1 left-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#173c36] text-white"><Plus className="h-6 w-6" /></span>
              </label>
              {imageError && <p role="alert" className="mt-3 text-center text-sm text-red-700">{imageError}</p>}
              <label className="mt-7 block">
                <span className="text-[16px] font-bold">اسم الجمعية</span>
                <input value={pageData.name} onChange={(e) => updatePageData({ name: e.target.value })} maxLength={80} className="mt-2 w-full rounded-2xl border-2 border-[#e2e2de] bg-white px-5 py-4 text-[17px] focus:border-[#173c36] focus:outline-none" />
              </label>
              <label className="mt-5 block">
                <span className="text-[16px] font-bold">نبذة عن الجمعية</span>
                <span className="mt-2 block rounded-2xl border-2 border-[#e2e2de] bg-white px-5 pb-3 pt-4 focus-within:border-[#173c36]">
                  <textarea value={pageData.bio} onChange={(e) => updatePageData({ bio: e.target.value.slice(0, BIO_LIMIT) })} maxLength={BIO_LIMIT} rows={4} placeholder="سطر أو سطران عن رسالة الجمعية وخدماتها" className="block w-full resize-none bg-transparent text-[17px] placeholder:text-[#8e8e93] focus:outline-none" />
                  <span className="mt-1 block text-[14px] text-[#6e6e73]" dir="ltr" style={{ textAlign: 'right' }}>{pageData.bio.length}/{BIO_LIMIT}</span>
                </span>
              </label>
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-4 text-center text-sm text-red-700">{error}</p>}
      </main>

      {/* Fixed actions, faded over the grid as in the reference. */}
      <footer className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-white/0 pt-8">
        <div className="mx-auto w-full max-w-2xl px-5 pb-6">
          <button
            type="button"
            disabled={!canContinue}
            onClick={next}
            className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#173c36] text-[17px] font-bold text-white transition-colors disabled:bg-[#e8e8e3] disabled:text-[#a3a39e]"
          >
            {saving ? 'جارٍ الحفظ…' : 'متابعة'}
          </button>
          {step === 1 && <button type="button" onClick={() => setStep(2)} className="mt-3 block w-full py-2 text-center text-[15px] font-bold text-[#6e6e73]">تخطي</button>}
        </div>
      </footer>
    </div>
  );
}
