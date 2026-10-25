import { Link } from 'react-router';
import { nonprofitPath } from '../lib/nonprofit';
import { useEffect } from 'react';
import { ArrowDown, ArrowUpLeft, HeartHandshake, Link2, Palette, Globe2, Check } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '../lib/site';

const features = [
  { Icon: Link2, title: 'روابط الجمعية في مكان واحد', body: 'عرّفوا بجمعيتكم واجمعوا روابط البرامج والمبادرات وقنوات التواصل في صفحة واضحة.' },
  { Icon: Palette, title: 'صفحة تشبه هويتكم', body: 'شعار الجمعية وألوانها ومحتواها، بتصميم يناسب رسالتكم ويسهل تصفحه على الجوال.' },
  { Icon: Globe2, title: 'عنوان يناسب جمعيتكم', body: 'اختاروا رابطًا على عنوان، أو اطلبوا ربط الصفحة بنطاق الجمعية بعد التنسيق والتفعيل.' },
];

export default function NonprofitLanding() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'عنوان للجمعيات الخيرية';
    return () => { document.title = previous; };
  }, []);
  return (
    <div dir="rtl" className="min-h-screen bg-[#faf9f6] text-[#173c36]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <a href="#nonprofit-content" className="sr-only focus:not-sr-only focus:block focus:p-4">انتقل إلى المحتوى</a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-7">
        <a href="#" aria-label="عنوان للجمعيات — الرئيسية" className="flex items-center gap-3"><span className="text-3xl font-extrabold">عنوان<span className="text-[#6c9464]">.</span></span><span className="border-r border-[#173c36]/20 pr-3 text-xs sm:text-sm">للجمعيات الخيرية</span></a>
        <Link to={nonprofitPath('login')} className="rounded-full border border-[#173c36]/20 px-4 py-2 text-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4">تسجيل الدخول</Link>
      </header>
      <main id="nonprofit-content">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#e8eee2] px-4 py-2 text-sm"><HeartHandshake size={18} aria-hidden="true" /> مساحة مخصصة للجمعيات الخيرية</span>
            <h1 className="text-4xl font-extrabold leading-[1.55] sm:text-5xl">لرسالتكم أثر.<br /><span className="text-[#6c8050]">ولجمعيتكم عنوان.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-9 text-[#53665e] sm:text-lg">صفحة واحدة تعرّف بجمعيتكم، تجمع روابطكم، وتقرّب برامجكم ومبادراتكم من المستفيدين والداعمين.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={nonprofitPath('signup')} className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#173c36] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28584e]">ابدأ تصميم صفحة الجمعية <ArrowDown size={17} aria-hidden="true" /></Link>
              {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-bold underline underline-offset-4">تواصلوا معنا <ArrowUpLeft size={17} aria-hidden="true" /></a>}
            </div>
          </div>
          <div className="relative rounded-[2.5rem] bg-[#e8eee2] p-7 sm:p-12" aria-label="مثال توضيحي لشكل صفحة جمعية">
            <div className="mx-auto max-w-xs rounded-[2rem] border border-white bg-[#fffefa] p-6 shadow-xl shadow-[#173c36]/5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173c36] text-white"><HeartHandshake size={32} aria-hidden="true" /></div>
              <p className="mt-5 text-center text-xl font-bold">اسم جمعيتكم</p>
              <p className="mt-2 text-center text-sm leading-7 text-[#6d786f]">رسالتكم ومبادراتكم، أقرب للجميع.</p>
              <div className="mt-6 space-y-3">{['تعرّف على الجمعية', 'برامجنا ومبادراتنا', 'تواصل معنا'].map(label => <div key={label} className="flex items-center justify-between rounded-xl bg-[#eef1e9] px-4 py-4 text-sm font-bold"><span>{label}</span><ArrowUpLeft size={16} aria-hidden="true" /></div>)}</div>
              <p className="mt-6 text-center text-xs text-[#7a837b]">تصوّر توضيحي للصفحة</p>
            </div>
          </div>
        </section>
        <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-14">
          <p className="text-sm font-bold text-[#6c8050]">حضور واضح، يعكس رسالتكم</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">كل ما يهم جمهوركم، في عنوان واحد.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">{features.map(({ Icon, title, body }) => <article key={title} className="rounded-3xl border border-[#173c36]/10 bg-white p-7"><Icon size={26} className="text-[#6c8050]" aria-hidden="true" /><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-8 text-[#647168]">{body}</p></article>)}</div>
        </section>
        <section id="journey" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-14">
          <div className="rounded-[2rem] bg-[#173c36] p-7 text-white sm:p-12">
            <h2 className="text-2xl font-bold">من فكرتكم إلى صفحة جمعيتكم</h2>
            <ol className="mt-8 grid gap-7 md:grid-cols-3">{[['صمّموا صفحتكم', 'اختاروا الهوية وأضيفوا المحتوى وشاهدوا المعاينة.'], ['اطلبوا عرض سعر', 'نراجع احتياجكم ونتواصل معكم بشأن العرض المناسب.'], ['ننطلق بعد التفعيل', 'تُنشر الصفحة ويُربط عنوانها بعد الاتفاق والتفعيل.']].map(([title, body], i) => <li key={title}><span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-sm">{i + 1}</span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-8 text-white/75">{body}</p></li>)}</ol>
            <p className="mt-9 flex items-start gap-2 border-t border-white/15 pt-6 text-sm leading-7 text-white/80"><Check size={18} className="mt-1 shrink-0" aria-hidden="true" />صمّموا وشاهدوا المعاينة الخاصة، ثم اطلبوا عرض السعر. النشر بعد الاتفاق وتفعيل الإدارة.</p>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 py-8 text-xs leading-6 text-[#68766c]"><span>عنوان — للجمعيات الخيرية</span><span dir="ltr">nonprofit.onwan.link</span></footer>
    </div>
  );
}
