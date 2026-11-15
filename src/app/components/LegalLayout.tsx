import { useEffect } from 'react';
import { Link } from 'react-router';
import { journeyPath, type JourneyKind } from '../lib/journey';
import { OnwanLogo } from './OnwanLogo';
import { BrandFooter } from './BrandFooter';

export function LegalLayout({ title, sections, kind }: { title: string; sections: { heading?: string; body: React.ReactNode }[]; kind: JourneyKind }) {
  useEffect(() => { const previous = document.title; document.title = `${title} — عنوان`; window.scrollTo(0, 0); return () => { document.title = previous; }; }, [title]);
  return <div dir="rtl" className="flex min-h-[100svh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
      <Link to={journeyPath(kind)} aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
      <Link to={journeyPath(kind)} className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111]">الرئيسية</Link>
    </header>
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-4 sm:px-6">
      <h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{title}</h1>
      <div className="mt-6 space-y-5 text-base leading-8 text-[#737373]">{sections.map((section, index) => <section key={index}>{section.heading && <h2 className="mb-1 text-lg font-bold text-[#111111]">{section.heading}</h2>}<p>{section.body}</p></section>)}</div>
    </main>
    <BrandFooter kind={kind} />
  </div>;
}
